"""
KGC Lite — Clustering Engine
Core logic that decides:
  - Should this complaint merge into an existing issue?
  - Or should it create a new issue candidate?
Updates issue centroids after each merge.
"""

import logging
import uuid
from typing import Optional
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from database.models import Complaint, Issue, IssueStatusEnum, CategoryEnum
from ai.embeddings import generate_embedding, find_similar_issue, compute_centroid
from ai.classifier import generate_issue_title
from config import settings

logger = logging.getLogger(__name__)


# ── MAIN CLUSTERING FUNCTION ─────────────────────────────────────

async def process_complaint_clustering(
    db: AsyncSession,
    complaint: Complaint,
    ai_result: dict,
) -> dict:
    """
    Full clustering pipeline for a new complaint.

    1. Generate embedding for the complaint text
    2. Fetch existing PENDING/APPROVED issues in same category
    3. Find most similar issue
    4. If similar found → merge complaint into that issue
    5. If not → create new issue candidate (status=PENDING, awaits admin)

    Returns:
    {
        "action":   "merged" | "created",
        "issue_id": uuid,
        "similarity": 0.87 | None
    }
    """

    category = ai_result.get("category", "unknown")
    location = (
        ai_result.get("location_extracted")
        or complaint.location_raw
        or "Unspecified Location"
    )

    # ── Step 1: Generate embedding ────────────────────────────────
    embedding = generate_embedding(complaint.raw_text)

    if embedding:
        complaint.embedding = embedding
        await db.flush()

    # ── Step 2: Fetch existing issues in same category ────────────
    existing_issues = await _fetch_candidate_issues(db, category)

    # ── Step 3: Find similar issue ────────────────────────────────
    matched_issue = None
    if embedding and existing_issues:
        matched_issue = find_similar_issue(
            new_embedding=embedding,
            existing_issues=existing_issues,
            threshold=settings.SIMILARITY_THRESHOLD,
        )

    # ── Step 4a: MERGE into existing issue ────────────────────────
    if matched_issue:
        issue_id = matched_issue["id"]
        issue = await db.get(Issue, issue_id)

        if issue:
            complaint.issue_id = issue_id
            issue.complaint_count += 1

            # Update centroid with new embedding
            if embedding:
                all_embeddings = await _get_issue_embeddings(db, issue_id)
                issue.embedding_centroid = compute_centroid(all_embeddings)

            # Recalculate priority score
            issue.priority_score = _calculate_priority(issue)

            logger.info(
                f"✅ MERGED complaint {complaint.id} → "
                f"issue {issue_id} (count={issue.complaint_count})"
            )
            return {
                "action":     "merged",
                "issue_id":   str(issue_id),
                "similarity": matched_issue.get("similarity"),
            }

    # ── Step 4b: CREATE new issue candidate ───────────────────────
    new_issue = await _create_issue_candidate(
        db, complaint, ai_result, location, embedding
    )

    complaint.issue_id = new_issue.id
    db.add(new_issue)
    await db.flush()

    logger.info(
        f"✅ CREATED new issue candidate {new_issue.id} "
        f"for complaint {complaint.id}"
    )
    return {
        "action":     "created",
        "issue_id":   str(new_issue.id),
        "similarity": None,
    }


# ── CREATE ISSUE CANDIDATE ────────────────────────────────────────

async def _create_issue_candidate(
    db: AsyncSession,
    complaint: Complaint,
    ai_result: dict,
    location: str,
    embedding: Optional[list[float]],
) -> Issue:
    """Create a new PENDING issue from first complaint."""

    category = ai_result.get("category", "unknown")

    # Generate AI title and description
    title_result = await generate_issue_title(
        category=category,
        location=location,
        complaint_texts=[complaint.raw_text],
        complaint_count=1,
    )

    # Determine urgency-based initial priority
    urgency_boost = {"urgent": 5.0, "medium": 2.0, "minor": 0.5}
    initial_priority = urgency_boost.get(ai_result.get("urgency", "medium"), 2.0)

    issue = Issue(
        title              = title_result.get("title", f"{category.title()} Issue — {location}"),
        description        = title_result.get("description", ""),
        category           = CategoryEnum(category) if category in CategoryEnum._value2member_map_ else CategoryEnum.UNKNOWN,
        department         = title_result.get("department", "General Services"),
        location           = location,
        complaint_count    = 1,
        embedding_centroid = embedding,
        priority_score     = initial_priority,
        status             = IssueStatusEnum.PENDING,
    )

    return issue


# ── FETCH CANDIDATE ISSUES ────────────────────────────────────────

async def _fetch_candidate_issues(
    db: AsyncSession,
    category: str,
) -> list[dict]:
    """
    Fetch all active issues in same category that have embeddings.
    Returns list of dicts with id and embedding_centroid.
    """
    stmt = select(Issue).where(
        and_(
            Issue.category == category,
            Issue.status.in_([IssueStatusEnum.PENDING, IssueStatusEnum.APPROVED]),
            Issue.embedding_centroid.isnot(None),
        )
    )
    result = await db.execute(stmt)
    issues = result.scalars().all()

    return [
        {
            "id":               issue.id,
            "category":         issue.category,
            "location":         issue.location,
            "embedding_centroid": issue.embedding_centroid,
        }
        for issue in issues
    ]


# ── GET ALL EMBEDDINGS FOR AN ISSUE ──────────────────────────────

async def _get_issue_embeddings(
    db: AsyncSession,
    issue_id: uuid.UUID,
) -> list[list[float]]:
    """Fetch embeddings of all complaints in an issue for centroid update."""
    stmt = select(Complaint.embedding).where(
        and_(
            Complaint.issue_id == issue_id,
            Complaint.embedding.isnot(None),
        )
    )
    result = await db.execute(stmt)
    embeddings = [row[0] for row in result.fetchall() if row[0]]
    return embeddings


# ── PRIORITY SCORE CALCULATION ────────────────────────────────────

def _calculate_priority(issue: Issue) -> float:
    """
    Priority Score Formula:
      score = (complaint_count × 2.0)
            + (urgent_votes  × 3.0)
            + (important_votes × 1.5)
            + (minor_votes   × 0.5)
    Higher score = higher priority for officers.
    """
    score = (
        (issue.complaint_count  * 2.0) +
        (issue.votes_urgent     * 3.0) +
        (issue.votes_important  * 1.5) +
        (issue.votes_minor      * 0.5)
    )
    return round(score, 2)


# ── PUBLIC RECALCULATE (called after each vote) ───────────────────

async def recalculate_priority(
    db: AsyncSession,
    issue: Issue,
) -> float:
    """Recalculate and save priority score after a vote is cast."""
    new_score = _calculate_priority(issue)
    issue.priority_score = new_score
    await db.flush()
    logger.debug(f"Priority updated for issue {issue.id}: {new_score}")
    return new_score

"""
KGC Lite — Issues & Votes Router
GET  /issues              → list approved public issues
GET  /issues/{id}         → single issue detail
POST /issues/{id}/vote    → vote on issue (auth required)
GET  /issues/{id}/my-vote → check user's existing vote
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, desc

from database.connection import get_db
from database.models import Issue, Vote, IssueStatusEnum, VoteTypeEnum
from middleware.auth import get_current_user, get_optional_user
from ai.clustering import recalculate_priority
from database.models import User

router = APIRouter(prefix="/issues", tags=["Issues"])
logger = logging.getLogger(__name__)


# ── SCHEMAS ───────────────────────────────────────────────────────

class VoteRequest(BaseModel):
    vote_type: str  # "urgent" | "important" | "minor"


# ── LIST PUBLIC ISSUES ────────────────────────────────────────────

@router.get("")
async def list_issues(
    db:           AsyncSession    = Depends(get_db),
    current_user: Optional[User]  = Depends(get_optional_user),
    category:     Optional[str]   = Query(None, description="water|electricity|roads"),
    sort_by:      str             = Query("priority", description="priority|recent|votes"),
    location:     Optional[str]   = Query(None),
    skip:         int             = Query(0, ge=0),
    limit:        int             = Query(20, ge=1, le=100),
):
    """
    List all approved public issues.
    Citizens see issues — NOT raw complaints.
    Sortable by priority score, recent, or total votes.
    """
    stmt = select(Issue).where(Issue.status == IssueStatusEnum.APPROVED)

    # Filters
    if category:
        stmt = stmt.where(Issue.category == category)
    if location:
        stmt = stmt.where(Issue.location.ilike(f"%{location}%"))

    # Sorting
    if sort_by == "priority":
        stmt = stmt.order_by(desc(Issue.priority_score))
    elif sort_by == "recent":
        stmt = stmt.order_by(desc(Issue.created_at))
    elif sort_by == "votes":
        stmt = stmt.order_by(desc(Issue.total_votes))
    else:
        stmt = stmt.order_by(desc(Issue.priority_score))

    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    issues = result.scalars().all()

    # Get total count
    count_stmt = select(func.count(Issue.id)).where(Issue.status == IssueStatusEnum.APPROVED)
    if category:
        count_stmt = count_stmt.where(Issue.category == category)
    count_result = await db.execute(count_stmt)
    total = count_result.scalar()

    # Get user's votes for these issues (to show voted state)
    user_votes = {}
    if current_user:
        issue_ids = [i.id for i in issues]
        if issue_ids:
            vote_stmt = select(Vote).where(
                and_(Vote.user_id == current_user.id, Vote.issue_id.in_(issue_ids))
            )
            vote_result = await db.execute(vote_stmt)
            for vote in vote_result.scalars().all():
                user_votes[str(vote.issue_id)] = vote.vote_type

    return {
        "issues": [_format_issue(i, user_votes.get(str(i.id))) for i in issues],
        "total":  total,
        "skip":   skip,
        "limit":  limit,
    }


# ── SINGLE ISSUE DETAIL ───────────────────────────────────────────

@router.get("/{issue_id}")
async def get_issue(
    issue_id:     str,
    db:           AsyncSession   = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Get full detail of a single approved issue."""
    issue = await db.get(Issue, issue_id)

    if not issue or issue.status != IssueStatusEnum.APPROVED:
        raise HTTPException(status_code=404, detail="Issue not found")

    # Check user's vote
    user_vote = None
    if current_user:
        vote_stmt = select(Vote).where(
            and_(Vote.user_id == current_user.id, Vote.issue_id == issue.id)
        )
        vote_result = await db.execute(vote_stmt)
        existing = vote_result.scalar_one_or_none()
        if existing:
            user_vote = existing.vote_type

    return {
        **_format_issue(issue, user_vote),
        "description":         issue.description,
        "government_response": issue.government_response,
        "resolved_at":         issue.resolved_at,
    }


# ── VOTE ON ISSUE ─────────────────────────────────────────────────

@router.post("/{issue_id}/vote")
async def vote_on_issue(
    issue_id:     str,
    body:         VoteRequest,
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """
    Cast a vote on an approved issue.
    One vote per user per issue — enforced at DB level.
    Changing vote: removes old vote, casts new one.
    """
    # Validate vote type
    if body.vote_type not in ("urgent", "important", "minor"):
        raise HTTPException(status_code=400, detail="vote_type must be: urgent | important | minor")

    # Get issue
    issue = await db.get(Issue, issue_id)
    if not issue or issue.status != IssueStatusEnum.APPROVED:
        raise HTTPException(status_code=404, detail="Issue not found or not open for voting")

    # Check existing vote
    vote_stmt = select(Vote).where(
        and_(Vote.user_id == current_user.id, Vote.issue_id == issue.id)
    )
    vote_result = await db.execute(vote_stmt)
    existing_vote = vote_result.scalar_one_or_none()

    if existing_vote:
        if existing_vote.vote_type == body.vote_type:
            raise HTTPException(
                status_code=400,
                detail=f"You already voted '{body.vote_type}' on this issue."
            )

        # Remove old vote counts
        _decrement_vote(issue, existing_vote.vote_type)
        existing_vote.vote_type = VoteTypeEnum(body.vote_type)
        action = "changed"
    else:
        # New vote
        new_vote = Vote(
            user_id   = current_user.id,
            issue_id  = issue.id,
            vote_type = VoteTypeEnum(body.vote_type),
        )
        db.add(new_vote)
        action = "cast"

    # Update vote counts
    _increment_vote(issue, body.vote_type)
    issue.total_votes = (issue.votes_urgent or 0) + (issue.votes_important or 0) + (issue.votes_minor or 0)

    # Recalculate priority
    await recalculate_priority(db, issue)
    await db.commit()

    logger.info(
        f"✅ Vote {action}: user={current_user.mobile} "
        f"issue={issue_id} type={body.vote_type} "
        f"new_priority={issue.priority_score}"
    )

    return {
        "message":        f"Vote {action} successfully",
        "vote_type":      body.vote_type,
        "action":         action,
        "votes_urgent":   issue.votes_urgent,
        "votes_important": issue.votes_important,
        "votes_minor":    issue.votes_minor,
        "total_votes":    issue.total_votes,
        "priority_score": issue.priority_score,
    }


# ── MY VOTE ───────────────────────────────────────────────────────

@router.get("/{issue_id}/my-vote")
async def get_my_vote(
    issue_id:     str,
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """Check if the current user has voted on this issue."""
    vote_stmt = select(Vote).where(
        and_(Vote.user_id == current_user.id, Vote.issue_id == issue_id)
    )
    result = await db.execute(vote_stmt)
    vote = result.scalar_one_or_none()

    return {
        "voted":     vote is not None,
        "vote_type": vote.vote_type if vote else None,
    }


# ── HELPERS ───────────────────────────────────────────────────────

def _format_issue(issue: Issue, user_vote: Optional[str] = None) -> dict:
    """Serialize an Issue to API response format."""
    total = (issue.votes_urgent or 0) + (issue.votes_important or 0) + (issue.votes_minor or 0)

    return {
        "id":              str(issue.id),
        "title":           issue.title,
        "category":        issue.category,
        "department":      issue.department,
        "location":        issue.location,
        "district":        issue.district,
        "complaint_count": issue.complaint_count,
        "status":          issue.status,
        "priority_score":  issue.priority_score,
        "votes_urgent":    issue.votes_urgent   or 0,
        "votes_important": issue.votes_important or 0,
        "votes_minor":     issue.votes_minor     or 0,
        "total_votes":     total,
        "user_vote":       user_vote,
        "created_at":      issue.created_at,
        "updated_at":      issue.updated_at,
    }


def _increment_vote(issue: Issue, vote_type: str):
    if vote_type == "urgent":
        issue.votes_urgent    = (issue.votes_urgent    or 0) + 1
    elif vote_type == "important":
        issue.votes_important = (issue.votes_important or 0) + 1
    elif vote_type == "minor":
        issue.votes_minor     = (issue.votes_minor     or 0) + 1


def _decrement_vote(issue: Issue, vote_type: str):
    if vote_type == "urgent":
        issue.votes_urgent    = max(0, (issue.votes_urgent    or 0) - 1)
    elif vote_type == "important":
        issue.votes_important = max(0, (issue.votes_important or 0) - 1)
    elif vote_type == "minor":
        issue.votes_minor     = max(0, (issue.votes_minor     or 0) - 1)

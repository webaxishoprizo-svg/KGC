"""
KGC Lite — Admin Router
GET  /admin/dashboard        → full KPI dashboard
GET  /admin/pending          → issues awaiting approval
POST /admin/approve/{id}     → approve issue (publish to public)
POST /admin/reject/{id}      → reject issue
POST /admin/merge/{id}       → merge issue into another
PATCH /admin/issues/{id}     → update status (In Progress / Resolved)
GET  /admin/issues           → all issues with full filters
GET  /admin/complaints/raw   → raw complaint list (admin only)
POST /admin/seed             → seed demo data for testing
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, desc

from database.connection import get_db
from database.models import (
    Issue, Complaint, Vote, AdminAction, User,
    IssueStatusEnum, CategoryEnum, UrgencyEnum,
    AdminActionEnum, VoteTypeEnum
)
from middleware.auth import get_current_admin

router = APIRouter(prefix="/admin", tags=["Admin"])
logger = logging.getLogger(__name__)


# ── SCHEMAS ───────────────────────────────────────────────────────

class ApproveRequest(BaseModel):
    title:       Optional[str] = None  # admin can edit title before approving
    description: Optional[str] = None

class RejectRequest(BaseModel):
    reason: str

class MergeRequest(BaseModel):
    target_issue_id: str
    reason:          Optional[str] = None

class UpdateStatusRequest(BaseModel):
    status:              str            # "in_progress" | "resolved"
    government_response: Optional[str] = None


# ── DASHBOARD ─────────────────────────────────────────────────────

@router.get("/dashboard")
async def get_dashboard(
    admin: User          = Depends(get_current_admin),
    db:    AsyncSession  = Depends(get_db),
):
    """
    Officer dashboard KPIs:
    - Issue counts by status
    - Top priority issues
    - Department breakdown
    - Recent activity
    """
    # Issue counts by status
    status_counts = {}
    for s in IssueStatusEnum:
        result = await db.execute(
            select(func.count(Issue.id)).where(Issue.status == s)
        )
        status_counts[s.value] = result.scalar()

    # Total complaints
    complaint_count = await db.execute(select(func.count(Complaint.id)))
    total_complaints = complaint_count.scalar()

    # Total votes
    vote_count = await db.execute(select(func.count(Vote.id)))
    total_votes = vote_count.scalar()

    # Top 10 priority issues (approved)
    top_stmt = (
        select(Issue)
        .where(Issue.status == IssueStatusEnum.APPROVED)
        .order_by(desc(Issue.priority_score))
        .limit(10)
    )
    top_result = await db.execute(top_stmt)
    top_issues = top_result.scalars().all()

    # Department breakdown
    dept_stmt = (
        select(Issue.department, func.count(Issue.id).label("count"))
        .where(Issue.status == IssueStatusEnum.APPROVED)
        .group_by(Issue.department)
        .order_by(desc("count"))
    )
    dept_result = await db.execute(dept_stmt)
    dept_breakdown = [
        {"department": row[0], "count": row[1]}
        for row in dept_result.fetchall()
    ]

    # Category breakdown
    cat_stmt = (
        select(Issue.category, func.count(Issue.id).label("count"))
        .group_by(Issue.category)
    )
    cat_result = await db.execute(cat_stmt)
    category_breakdown = {row[0]: row[1] for row in cat_result.fetchall()}

    # Recent complaints (last 10)
    recent_stmt = (
        select(Complaint)
        .where(Complaint.spam_flagged == False)
        .order_by(desc(Complaint.created_at))
        .limit(10)
    )
    recent_result = await db.execute(recent_stmt)
    recent_complaints = recent_result.scalars().all()

    return {
        "summary": {
            "total_complaints": total_complaints,
            "total_votes":      total_votes,
            "issues_pending":   status_counts.get("pending",    0),
            "issues_approved":  status_counts.get("approved",   0),
            "issues_resolved":  status_counts.get("resolved",   0),
            "issues_rejected":  status_counts.get("rejected",   0),
        },
        "top_priority_issues": [_format_issue_admin(i) for i in top_issues],
        "department_breakdown": dept_breakdown,
        "category_breakdown":   category_breakdown,
        "recent_complaints": [
            {
                "id":         str(c.id),
                "text":       c.raw_text[:150],
                "category":   c.category,
                "urgency":    c.urgency,
                "ai_summary": c.ai_summary,
                "location":   c.location_extracted or c.location_raw,
                "created_at": c.created_at,
            }
            for c in recent_complaints
        ],
    }


# ── PENDING ISSUES ────────────────────────────────────────────────

@router.get("/pending")
async def get_pending_issues(
    admin:    User         = Depends(get_current_admin),
    db:       AsyncSession = Depends(get_db),
    category: Optional[str] = Query(None),
    skip:     int          = Query(0),
    limit:    int          = Query(50),
):
    """Get all issues awaiting admin review."""
    stmt = select(Issue).where(Issue.status == IssueStatusEnum.PENDING)
    if category:
        stmt = stmt.where(Issue.category == category)
    stmt = stmt.order_by(desc(Issue.priority_score)).offset(skip).limit(limit)

    result = await db.execute(stmt)
    issues = result.scalars().all()

    return {
        "issues": [_format_issue_admin(i) for i in issues],
        "total":  len(issues),
    }


# ── APPROVE ISSUE ─────────────────────────────────────────────────

@router.post("/approve/{issue_id}")
async def approve_issue(
    issue_id: str,
    body:     ApproveRequest,
    admin:    User         = Depends(get_current_admin),
    db:       AsyncSession = Depends(get_db),
):
    """
    Admin approves a pending issue → status becomes APPROVED.
    Admin can optionally edit the title/description before publishing.
    """
    issue = await db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    if issue.status != IssueStatusEnum.PENDING:
        raise HTTPException(status_code=400, detail=f"Issue is not pending (current: {issue.status})")

    # Apply admin edits
    if body.title:
        issue.title = body.title
    if body.description:
        issue.description = body.description

    issue.status      = IssueStatusEnum.APPROVED
    issue.approved_by = admin.id
    issue.approved_at = datetime.now(timezone.utc)

    # Log action
    action = AdminAction(
        admin_id = admin.id,
        issue_id = issue.id,
        action   = AdminActionEnum.APPROVE,
    )
    db.add(action)
    await db.commit()

    logger.info(f"✅ Issue {issue_id} APPROVED by admin {admin.mobile}")
    return {"message": "Issue approved and published", "issue_id": issue_id}


# ── REJECT ISSUE ──────────────────────────────────────────────────

@router.post("/reject/{issue_id}")
async def reject_issue(
    issue_id: str,
    body:     RejectRequest,
    admin:    User         = Depends(get_current_admin),
    db:       AsyncSession = Depends(get_db),
):
    """Admin rejects a pending issue with a reason."""
    issue = await db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    issue.status           = IssueStatusEnum.REJECTED
    issue.rejection_reason = body.reason

    action = AdminAction(
        admin_id = admin.id,
        issue_id = issue.id,
        action   = AdminActionEnum.REJECT,
        reason   = body.reason,
    )
    db.add(action)
    await db.commit()

    logger.info(f"❌ Issue {issue_id} REJECTED: {body.reason}")
    return {"message": "Issue rejected", "reason": body.reason}


# ── UPDATE STATUS ─────────────────────────────────────────────────

@router.patch("/issues/{issue_id}")
async def update_issue_status(
    issue_id: str,
    body:     UpdateStatusRequest,
    admin:    User         = Depends(get_current_admin),
    db:       AsyncSession = Depends(get_db),
):
    """Update issue status: in_progress or resolved."""
    issue = await db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    status_map = {
        "in_progress": IssueStatusEnum.APPROVED,  # still visible, just tagged
        "resolved":    IssueStatusEnum.RESOLVED,
    }
    if body.status not in status_map:
        raise HTTPException(status_code=400, detail="status must be: in_progress | resolved")

    issue.status = status_map[body.status]

    if body.status == "resolved":
        issue.resolved_at = datetime.now(timezone.utc)
    if body.government_response:
        issue.government_response = body.government_response

    action = AdminAction(
        admin_id = admin.id,
        issue_id = issue.id,
        action   = AdminActionEnum.RESOLVE if body.status == "resolved" else AdminActionEnum.APPROVE,
        reason   = body.government_response,
    )
    db.add(action)
    await db.commit()

    return {"message": f"Issue marked as {body.status}", "issue_id": issue_id}


# ── ALL ISSUES (with filters) ─────────────────────────────────────

@router.get("/issues")
async def get_all_issues(
    admin:    User           = Depends(get_current_admin),
    db:       AsyncSession   = Depends(get_db),
    status:   Optional[str]  = Query(None),
    category: Optional[str]  = Query(None),
    sort_by:  str            = Query("priority"),
    skip:     int            = Query(0),
    limit:    int            = Query(50),
):
    """Get all issues for admin with full filter options."""
    stmt = select(Issue)

    if status:
        stmt = stmt.where(Issue.status == status)
    if category:
        stmt = stmt.where(Issue.category == category)

    if sort_by == "priority":
        stmt = stmt.order_by(desc(Issue.priority_score))
    elif sort_by == "recent":
        stmt = stmt.order_by(desc(Issue.created_at))
    elif sort_by == "complaints":
        stmt = stmt.order_by(desc(Issue.complaint_count))

    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    issues = result.scalars().all()

    return {"issues": [_format_issue_admin(i) for i in issues], "total": len(issues)}


# ── SEED DEMO DATA ────────────────────────────────────────────────

@router.post("/seed")
async def seed_demo_data(
    admin: User         = Depends(get_current_admin),
    db:    AsyncSession = Depends(get_db),
):
    """
    Seed realistic demo data for presentation.
    Creates sample issues in all 3 categories with votes.
    """
    demo_issues = [
        {
            "title":           "Water Supply Failure — Ward 12, Mangaluru",
            "description":     "Residents of Ward 12 have been without piped water for 3 days. 47 complaints received from Srinivasa Nagar, Kondapalli Street, and surrounding areas. Elderly residents and families with children are severely affected.",
            "category":        CategoryEnum.WATER,
            "department":      "Karnataka Water Supply Board",
            "location":        "Ward 12, Mangaluru",
            "complaint_count": 47,
            "status":          IssueStatusEnum.APPROVED,
            "votes_urgent":    89,
            "votes_important": 34,
            "votes_minor":     5,
        },
        {
            "title":           "Street Lights Out — Anna Nagar, Bengaluru",
            "description":     "Multiple street lights on 3rd Avenue and 5th Cross Street have been non-functional for 2 weeks. Citizens report safety concerns, especially for women walking at night. 23 complaints filed.",
            "category":        CategoryEnum.ELECTRICITY,
            "department":      "Karnataka Electricity Board",
            "location":        "Anna Nagar, Bengaluru",
            "complaint_count": 23,
            "status":          IssueStatusEnum.APPROVED,
            "votes_urgent":    45,
            "votes_important": 67,
            "votes_minor":     12,
        },
        {
            "title":           "Dangerous Pothole — Belagavi Main Road",
            "description":     "A large pothole (approx. 3ft wide, 1ft deep) on Belagavi-Namakkal main road near Petrol Bunk junction has caused 2 minor accidents in the past week. 31 complaints received.",
            "category":        CategoryEnum.ROADS,
            "department":      "Highways Department",
            "location":        "Belagavi-Namakkal Main Road, Belagavi",
            "complaint_count": 31,
            "status":          IssueStatusEnum.APPROVED,
            "votes_urgent":    71,
            "votes_important": 28,
            "votes_minor":     3,
        },
        {
            "title":           "Borewell Motor Failure — Hubballi East",
            "description":     "Community borewell motor in Gandhi Nagar has failed. 180 residents dependent on this borewell for drinking water. Issue reported for 5 days with no response.",
            "category":        CategoryEnum.WATER,
            "department":      "Karnataka Water Supply Board",
            "location":        "Gandhi Nagar, Hubballi East",
            "complaint_count": 18,
            "status":          IssueStatusEnum.PENDING,
            "votes_urgent":    0,
            "votes_important": 0,
            "votes_minor":     0,
        },
        {
            "title":           "Transformer Overload — Mysuru RS Puram",
            "description":     "Old transformer in RS Puram causing frequent power cuts (3-4 times daily). Residents facing voltage fluctuation damaging appliances. 15 complaints filed.",
            "category":        CategoryEnum.ELECTRICITY,
            "department":      "Karnataka Electricity Board",
            "location":        "RS Puram, Mysuru",
            "complaint_count": 15,
            "status":          IssueStatusEnum.APPROVED,
            "votes_urgent":    33,
            "votes_important": 41,
            "votes_minor":     8,
        },
    ]

    created = []
    for data in demo_issues:
        # Avoid duplicates
        existing = await db.execute(select(Issue).where(Issue.title == data["title"]))
        if existing.scalar_one_or_none():
            continue

        votes_urgent    = data.pop("votes_urgent",    0)
        votes_important = data.pop("votes_important", 0)
        votes_minor     = data.pop("votes_minor",     0)

        issue = Issue(**data)
        issue.votes_urgent    = votes_urgent
        issue.votes_important = votes_important
        issue.votes_minor     = votes_minor
        issue.total_votes     = votes_urgent + votes_important + votes_minor
        issue.priority_score  = (
            data["complaint_count"] * 2.0 +
            votes_urgent            * 3.0 +
            votes_important         * 1.5 +
            votes_minor             * 0.5
        )
        if data["status"] == IssueStatusEnum.APPROVED:
            issue.approved_by = admin.id
            issue.approved_at = datetime.now(timezone.utc)

        db.add(issue)
        created.append(data["title"])

    await db.commit()
    return {
        "message": f"Seeded {len(created)} demo issues",
        "created": created,
    }


# ── HELPER ────────────────────────────────────────────────────────

def _format_issue_admin(issue: Issue) -> dict:
    return {
        "id":              str(issue.id),
        "title":           issue.title,
        "description":     issue.description,
        "category":        issue.category,
        "department":      issue.department,
        "location":        issue.location,
        "complaint_count": issue.complaint_count,
        "status":          issue.status,
        "priority_score":  issue.priority_score,
        "votes_urgent":    issue.votes_urgent    or 0,
        "votes_important": issue.votes_important or 0,
        "votes_minor":     issue.votes_minor     or 0,
        "total_votes":     issue.total_votes     or 0,
        "approved_at":     issue.approved_at,
        "rejection_reason": issue.rejection_reason,
        "government_response": issue.government_response,
        "created_at":      issue.created_at,
        "updated_at":      issue.updated_at,
    }

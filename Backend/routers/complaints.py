"""
KGC Lite — Complaints Router
POST /complaints/submit  → submit + AI process + cluster
GET  /complaints/mine    → my complaint history
GET  /complaints/{id}    → single complaint detail
"""

import logging
from datetime import datetime, date, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from database.connection import get_db
from database.models import Complaint, User, CategoryEnum, UrgencyEnum
from middleware.auth import get_current_user
from ai.classifier import classify_complaint
from ai.clustering import process_complaint_clustering
from config import settings
from middleware.rate_limit import limiter

router = APIRouter(prefix="/complaints", tags=["Complaints"])
logger = logging.getLogger(__name__)


# ── SCHEMAS ───────────────────────────────────────────────────────

class SubmitComplaintRequest(BaseModel):
    text:         str = Field(..., max_length=2000)
    location:     Optional[str] = Field(None, max_length=200)

class ComplaintResponse(BaseModel):
    complaint_id:  str
    issue_id:      Optional[str]
    action:        str       # "merged" | "created"
    category:      str
    urgency:       str
    ai_summary:    str
    spam_flagged:  bool
    similarity:    Optional[float]
    message:       str
    is_chat:       bool = False
    ai_reply:      Optional[str] = None
    department:    Optional[str] = None
    response_time: Optional[str] = None
    ticket_suffix: Optional[str] = None


# ── SUBMIT COMPLAINT ──────────────────────────────────────────────

@router.post("/submit", response_model=ComplaintResponse)
@limiter.limit("10/minute")
async def submit_complaint(
    request: Request,
    body:         SubmitComplaintRequest,
    current_user: User           = Depends(get_current_user),
    db:           AsyncSession   = Depends(get_db),
):
    """
    Full complaint submission pipeline:
    1. Rate limit check
    2. Create complaint record
    3. AI classification (Claude API)
    4. Spam check
    5. Embedding generation
    6. Clustering (merge or create issue)
    7. Return result to citizen
    """

    text = body.text.strip()
    if len(text) < 2:
        raise HTTPException(status_code=400, detail="Message too short.")
    if len(text) > 2000:
        raise HTTPException(status_code=400, detail="Complaint text too long. Maximum 2000 characters.")

    # ── Rate Limiting ─────────────────────────────────────────────
    today = date.today()
    last_date = (
        current_user.last_complaint_date.date()
        if current_user.last_complaint_date else None
    )

    if last_date == today:
        if (current_user.complaints_today or 0) >= settings.MAX_COMPLAINTS_PER_DAY:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Maximum {settings.MAX_COMPLAINTS_PER_DAY} complaints per day reached. Try again tomorrow.",
            )
    else:
        # Reset daily count on new day
        current_user.complaints_today   = 0
        current_user.last_complaint_date = datetime.now(timezone.utc)

    # ── Create Complaint Record ───────────────────────────────────
    complaint = Complaint(
        user_id      = current_user.id,
        raw_text     = text,
        location_raw = body.location,
    )
    db.add(complaint)
    await db.flush()  # get ID without committing

    # ── AI Classification ─────────────────────────────────────────
    logger.info(f"🤖 Processing complaint {complaint.id} via Claude AI...")
    ai_result = await classify_complaint(text, body.location)

    # ── Apply AI Results ──────────────────────────────────────────
    cat_map = {
        "water_supply": CategoryEnum.WATER,
        "electricity": CategoryEnum.ELECTRICITY,
        "roads": CategoryEnum.ROADS
    }
    complaint.category           = cat_map.get(ai_result["category"], CategoryEnum.UNKNOWN)
    complaint.urgency            = UrgencyEnum(ai_result["urgency"]) \
                                   if ai_result["urgency"] in UrgencyEnum._value2member_map_ \
                                   else UrgencyEnum.MEDIUM
    complaint.location_extracted = ai_result.get("location_extracted")
    complaint.keywords           = ai_result.get("keywords", [])
    complaint.ai_summary         = ai_result.get("ai_summary", text[:100])
    complaint.spam_score         = ai_result.get("spam_score", 0.0)
    complaint.spam_flagged       = ai_result.get("spam_flagged", False)
    complaint.spam_reason        = ai_result.get("spam_reason")
    
    is_chat  = ai_result.get("is_chat", False)
    ai_reply = ai_result.get("ai_reply")

    # ── Chat Handler ──────────────────────────────────────────────
    if is_chat:
        complaint.processed = True
        await db.commit()
        return ComplaintResponse(
            complaint_id = str(complaint.id),
            issue_id     = None,
            action       = "chat",
            category     = "unknown",
            urgency      = "minor",
            ai_summary   = "Chat message",
            spam_flagged = False,
            similarity   = None,
            message      = "Chat message",
            is_chat      = True,
            ai_reply     = ai_reply or "Hello! How can I help you with KGC services today?"
        )

    # ── Spam Gate ─────────────────────────────────────────────────
    if complaint.spam_flagged:
        complaint.processed = True
        await db.commit()
        logger.warning(f"🚫 Spam complaint {complaint.id}: {complaint.spam_reason}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error":  "spam_detected",
                "reason": complaint.spam_reason or "Complaint flagged as spam",
                "message": "Your complaint could not be processed. If you believe this is an error, please rephrase and resubmit.",
            }
        )

    # ── Skip clustering for "unknown" category ────────────────────
    if ai_result["category"] == "unknown":
        complaint.processed = True
        current_user.complaints_today = (current_user.complaints_today or 0) + 1
        await db.commit()
        return ComplaintResponse(
            complaint_id = str(complaint.id),
            issue_id     = None,
            action       = "pending_review",
            category     = "unknown",
            urgency      = ai_result["urgency"],
            ai_summary   = ai_result.get("ai_summary", text[:100]),
            spam_flagged = False,
            similarity   = None,
            message      = "Your complaint has been received and will be reviewed by our team.",
        )

    # ── Clustering ────────────────────────────────────────────────
    cluster_result = await process_complaint_clustering(db, complaint, ai_result)

    complaint.processed = True
    current_user.complaints_today = (current_user.complaints_today or 0) + 1
    await db.commit()

    action_messages = {
        "merged":  "Your complaint has been linked to an existing issue. Officers are already aware of this problem.",
        "created": "Your complaint has been registered. It will be reviewed and published shortly.",
    }

    logger.info(
        f"✅ Complaint {complaint.id} processed: "
        f"action={cluster_result['action']} issue={cluster_result['issue_id']}"
    )

    return ComplaintResponse(
        complaint_id = str(complaint.id),
        issue_id     = cluster_result.get("issue_id"),
        action       = cluster_result["action"],
        category     = ai_result["category"],
        urgency      = ai_result["urgency"],
        ai_summary   = ai_result.get("ai_summary", text[:100]),
        spam_flagged = False,
        similarity   = cluster_result.get("similarity"),
        message      = action_messages.get(cluster_result["action"], "Complaint received."),
        department   = ai_result.get("department"),
        response_time = ai_result.get("response_time"),
        ticket_suffix = ai_result.get("ticket_suffix"),
    )


# ── MY COMPLAINTS ─────────────────────────────────────────────────

@router.get("/mine")
async def get_my_complaints(
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 20,
):
    """Return authenticated user's complaint history."""
    stmt = (
        select(Complaint)
        .where(Complaint.user_id == current_user.id)
        .order_by(Complaint.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    complaints = result.scalars().all()

    return {
        "complaints": [
            {
                "id":               str(c.id),
                "text":             c.raw_text[:200],
                "category":         c.category,
                "urgency":          c.urgency,
                "ai_summary":       c.ai_summary,
                "location":         c.location_extracted or c.location_raw,
                "issue_id":         str(c.issue_id) if c.issue_id else None,
                "spam_flagged":     c.spam_flagged,
                "created_at":       c.created_at,
            }
            for c in complaints
        ],
        "total":  len(complaints),
        "skip":   skip,
        "limit":  limit,
    }

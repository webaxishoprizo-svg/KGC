"""
KGC Lite — Chat Router
POST /chat/message -> Handle conversational AI interaction
GET /chat/sessions -> List past sessions
GET /chat/sessions/{id} -> Get history
"""

import logging
from typing import List, Optional
import os
import uuid
from fastapi import APIRouter, Depends, Request, HTTPException, UploadFile, File

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database.connection import get_db
from database.models import User, ChatSession, ChatMessageModel
from middleware.auth import get_current_user
from middleware.rate_limit import limiter
from ai.chat_bot import process_chat, ChatMessage

router = APIRouter(prefix="/chat", tags=["Chat"])
logger = logging.getLogger(__name__)

class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str
    attachment_url: Optional[str] = None
    attachment_mime_type: Optional[str] = None

class ChatResponse(BaseModel):
    session_id: str
    reply: str
    draft_ready: bool
    draft_text: Optional[str] = None
    is_violation: bool = False

class SessionListResponse(BaseModel):
    id: str
    title: str
    updated_at: str

class FeedbackRequest(BaseModel):
    rating: str # "up" or "down"

@router.post("/message", response_model=ChatResponse)
@limiter.limit("20/minute")
async def chat_message_endpoint(
    request: Request,
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Handle a conversational turn with the AI and store history.
    """
    logger.info(f"User {current_user.id} sending chat message")
    
    session = None
    history_msgs = []
    
    if body.session_id:
        result = await db.execute(select(ChatSession).where(ChatSession.id == body.session_id, ChatSession.user_id == current_user.id))
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
            
        msg_result = await db.execute(select(ChatMessageModel).where(ChatMessageModel.session_id == session.id).order_by(ChatMessageModel.created_at))
        for m in msg_result.scalars().all():
            if not m.is_violation: # Skip adding violations to history to prevent prompt poisoning
                history_msgs.append(ChatMessage(role=m.role, text=m.text))
    else:
        # Create new session
        title = body.message[:50] + ("..." if len(body.message) > 50 else "")
        session = ChatSession(user_id=current_user.id, title=title)
        db.add(session)
        await db.flush()

    # Save user message
    user_msg = ChatMessageModel(
        session_id=session.id,
        role="user",
        text=body.message,
        attachment_url=body.attachment_url,
        attachment_mime_type=body.attachment_mime_type
    )
    db.add(user_msg)
    await db.flush()
    
    # RAG: Fetch top rated examples for self-learning
    examples_str = None
    example_result = await db.execute(
        select(ChatMessageModel)
        .where(ChatMessageModel.feedback == "up", ChatMessageModel.draft_text != None)
        .order_by(func.random())
        .limit(2)
    )
    top_examples = example_result.scalars().all()
    if top_examples:
        examples_str = "\n\n---\n\n".join([f"Example Complaint Draft:\n{ex.draft_text}" for ex in top_examples])
    
    # Process through Gemini AI, including the attachment URL if present
    ai_result = await process_chat(history_msgs, body.message, examples=examples_str, attachment_url=body.attachment_url, attachment_mime_type=body.attachment_mime_type)
    
    # STRICT SECURITY: Check for policy violation
    if ai_result.is_violation:
        # 1. Delete the user's violating message so it's not recorded
        await db.delete(user_msg)
        # 2. Suspend the user account immediately
        current_user.is_active = False
        db.add(current_user)
        await db.commit()
        # 3. Block the request
        raise HTTPException(
            status_code=403, 
            detail="ACCOUNT_SUSPENDED_POLICY_VIOLATION"
        )
    
    # Save AI response
    ai_msg = ChatMessageModel(
        session_id=session.id,
        role="model",
        text=ai_result.reply,
        draft_text=ai_result.draft_text,
        is_violation=ai_result.is_violation
    )
    db.add(ai_msg)
    
    await db.commit()
    
    return ChatResponse(
        session_id=str(session.id),
        reply=ai_result.reply,
        draft_ready=ai_result.draft_ready,
        draft_text=ai_result.draft_text,
        is_violation=ai_result.is_violation
    )

@router.get("/sessions")
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
    )
    sessions = result.scalars().all()
    
    return [
        {
            "id": str(s.id),
            "title": s.title,
            "updated_at": s.updated_at.isoformat() if s.updated_at else s.created_at.isoformat()
        } for s in sessions
    ]

@router.get("/sessions/{session_id}")
async def get_session_history(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == current_user.id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    msg_result = await db.execute(select(ChatMessageModel).where(ChatMessageModel.session_id == session.id).order_by(ChatMessageModel.created_at))
    messages = msg_result.scalars().all()
    
    return {
        "id": str(session.id),
        "title": session.title,
        "messages": [
            {
                "id": str(m.id),
                "role": m.role,
                "text": m.text,
                "draft_text": m.draft_text,
                "is_violation": m.is_violation,
                "feedback": m.feedback,
                "created_at": m.created_at.isoformat()
            } for m in messages
        ]
    }

@router.post("/messages/{message_id}/feedback")
async def submit_feedback(
    message_id: str,
    body: FeedbackRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Submit a thumbs up/down rating for a specific AI message.
    """
    result = await db.execute(select(ChatMessageModel).where(ChatMessageModel.id == message_id))
    msg = result.scalar_one_or_none()
    
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
        
    msg.feedback = body.rating
    await db.commit()
    
    return {"status": "success", "message_id": message_id, "feedback": msg.feedback}

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Upload an attachment (image, pdf, audio) for the chat.
    Returns the static URL to the uploaded file.
    """
    # Ensure uploads directory exists
    os.makedirs("uploads", exist_ok=True)
    
    # Generate unique filename
    ext = file.filename.split('.')[-1] if '.' in file.filename else 'bin'
    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join("uploads", filename)
    
    # Write to disk
    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)
        
    return {
        "url": f"/uploads/{filename}",
        "mime_type": file.content_type
    }

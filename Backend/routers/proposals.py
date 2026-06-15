from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Optional
from pydantic import BaseModel, Field
import uuid

from database.connection import AsyncSessionLocal
from database.models import User, Proposal, ProposalVote, ProposalVoteTypeEnum
from middleware.auth import get_current_user
from ai.proposal_verification import verify_proposal_safety
from middleware.rate_limit import limiter

router = APIRouter(prefix="/proposals", tags=["Proposals"])

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

class ProposalCreateRequest(BaseModel):
    content: str = Field(..., max_length=1000)
    tags: str = Field(..., max_length=100) # comma separated or space separated string
    image_url: Optional[str] = Field(None, max_length=500)

class ProposalResponse(BaseModel):
    id: str
    author: str
    handle: str
    avatar: str
    time: str
    content: str
    tags: List[str]
    upvotes: int
    downvotes: int
    comments: int
    image_url: Optional[str]

@router.get("", response_model=List[ProposalResponse])
async def list_proposals(
    limit: int = Query(20, le=50),
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Proposal, User).join(User, Proposal.user_id == User.id).order_by(desc(Proposal.created_at)).limit(limit).offset(offset)
    result = await db.execute(stmt)
    rows = result.all()
    
    response = []
    for prop, user in rows:
        tags_list = prop.tags if isinstance(prop.tags, list) else []
        response.append({
            "id": str(prop.id),
            "author": user.name or "Citizen User",
            "handle": f"@citizen_{str(user.id)[:4]}",
            "avatar": (user.name or "C")[0].upper(),
            "time": "Just now", # Need a real relative time in frontend usually, but mock for now
            "content": prop.content,
            "tags": tags_list,
            "upvotes": prop.upvotes,
            "downvotes": prop.downvotes,
            "comments": prop.comments,
            "image_url": prop.image_url
        })
    return response

@router.post("")
@limiter.limit("5/minute")
async def create_proposal(
    request: Request,
    data: ProposalCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 1. Verification Gateway (Gemini)
    verification_result = await verify_proposal_safety(data.content)
    if not verification_result["is_safe"]:
        # We return 400 with the polite reason from Gemini
        raise HTTPException(status_code=400, detail=verification_result["reason"])
        
    # 2. Parse tags
    tags_list = [t for t in data.tags.split() if t.startswith("#")]
    if not tags_list and data.tags.strip():
        # if they didn't use #, we just split by comma or space and prepend #
        parts = [p.strip() for p in data.tags.replace(",", " ").split() if p.strip()]
        tags_list = [f"#{p}" if not p.startswith("#") else p for p in parts]

    # 3. Create Proposal
    new_prop = Proposal(
        user_id=current_user.id,
        content=data.content,
        tags=tags_list,
        image_url=data.image_url,
        upvotes=1 # author upvotes by default
    )
    db.add(new_prop)
    await db.commit()
    await db.refresh(new_prop)
    
    # 4. Add author's vote
    author_vote = ProposalVote(
        user_id=current_user.id,
        proposal_id=new_prop.id,
        vote_type=ProposalVoteTypeEnum.UP
    )
    db.add(author_vote)
    await db.commit()
    
    return {"message": "Proposal submitted successfully", "proposal_id": str(new_prop.id)}

@router.post("/{proposal_id}/vote")
async def vote_proposal(
    proposal_id: str,
    vote_type: str, # "up" or "down"
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    prop = await db.get(Proposal, uuid.UUID(proposal_id))
    if not prop:
        raise HTTPException(status_code=404, detail="Proposal not found")
        
    enum_vote = ProposalVoteTypeEnum.UP if vote_type.lower() == "up" else ProposalVoteTypeEnum.DOWN
    
    # Check if user already voted
    stmt = select(ProposalVote).where(
        ProposalVote.user_id == current_user.id,
        ProposalVote.proposal_id == prop.id
    )
    existing_vote = await db.scalar(stmt)
    
    if existing_vote:
        if existing_vote.vote_type == enum_vote:
            return {"message": "Already voted this way"}
        # switch vote
        if existing_vote.vote_type == ProposalVoteTypeEnum.UP:
            prop.upvotes -= 1
        else:
            prop.downvotes -= 1
            
        existing_vote.vote_type = enum_vote
        if enum_vote == ProposalVoteTypeEnum.UP:
            prop.upvotes += 1
        else:
            prop.downvotes += 1
    else:
        # new vote
        new_vote = ProposalVote(
            user_id=current_user.id,
            proposal_id=prop.id,
            vote_type=enum_vote
        )
        db.add(new_vote)
        if enum_vote == ProposalVoteTypeEnum.UP:
            prop.upvotes += 1
        else:
            prop.downvotes += 1
            
    await db.commit()
    return {"message": "Vote recorded"}

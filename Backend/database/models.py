"""
KGC Lite — Database Models
All SQLAlchemy ORM models for the full system
"""

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text,
    DateTime, ForeignKey, Enum, JSON, Index
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum

Base = declarative_base()


# ── ENUMS ─────────────────────────────────────────────────────────

class CategoryEnum(str, enum.Enum):
    WATER       = "water"
    ELECTRICITY = "electricity"
    ROADS       = "roads"
    UNKNOWN     = "unknown"

class UrgencyEnum(str, enum.Enum):
    URGENT    = "urgent"
    MEDIUM    = "medium"
    MINOR     = "minor"

class IssueStatusEnum(str, enum.Enum):
    PENDING   = "pending"    # awaiting admin review
    APPROVED  = "approved"   # published to public
    REJECTED  = "rejected"   # discarded by admin
    MERGED    = "merged"     # merged into another issue
    RESOLVED  = "resolved"   # government resolved it

class VoteTypeEnum(str, enum.Enum):
    URGENT    = "urgent"
    IMPORTANT = "important"
    MINOR     = "minor"

class AdminActionEnum(str, enum.Enum):
    APPROVE   = "approve"
    REJECT    = "reject"
    MERGE     = "merge"
    RESOLVE   = "resolve"
    REOPEN    = "reopen"

class AuthProviderEnum(str, enum.Enum):
    EMAIL     = "email"
    GOOGLE    = "google"
    MOBILE    = "mobile"


# ── USERS ─────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mobile           = Column(String(15), unique=True, nullable=True, index=True)
    email            = Column(String(255), unique=True, nullable=True, index=True)
    hashed_password  = Column(String(255), nullable=True)
    google_id        = Column(String(255), unique=True, nullable=True, index=True)
    auth_provider    = Column(Enum(AuthProviderEnum), default=AuthProviderEnum.MOBILE)
    
    mobile_verified  = Column(Boolean, default=False)
    otp_code         = Column(String(6), nullable=True)
    otp_expires_at   = Column(DateTime(timezone=True), nullable=True)
    otp_attempts     = Column(Integer, default=0)
    is_admin         = Column(Boolean, default=False)
    is_active        = Column(Boolean, default=True)

    # Profile Data
    name             = Column(String(100), nullable=True)
    age              = Column(Integer, nullable=True)
    gender           = Column(String(20), nullable=True)
    address          = Column(Text, nullable=True)
    is_onboarded     = Column(Boolean, default=False)

    # Rate limiting
    complaints_today    = Column(Integer, default=0)
    last_complaint_date = Column(DateTime(timezone=True), nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    complaints = relationship("Complaint", back_populates="user")
    votes      = relationship("Vote",      back_populates="user")

    def __repr__(self):
        return f"<User mobile={self.mobile}>"


# ── COMPLAINTS ────────────────────────────────────────────────────

class Complaint(Base):
    __tablename__ = "complaints"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id             = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    issue_id            = Column(UUID(as_uuid=True), ForeignKey("issues.id"), nullable=True)

    # Raw input from citizen
    raw_text            = Column(Text, nullable=False)
    location_raw        = Column(String(255), nullable=True)
    image_url           = Column(String(500), nullable=True)

    # AI-extracted fields
    category            = Column(Enum(CategoryEnum), default=CategoryEnum.UNKNOWN)
    urgency             = Column(Enum(UrgencyEnum),  default=UrgencyEnum.MEDIUM)
    location_extracted  = Column(String(255), nullable=True)
    keywords            = Column(JSON, default=list)      # extracted keywords
    ai_summary          = Column(Text, nullable=True)     # AI one-line summary
    embedding           = Column(JSON, nullable=True)     # stored as list of floats

    # Spam detection
    spam_score          = Column(Float, default=0.0)      # 0.0 - 1.0
    spam_flagged        = Column(Boolean, default=False)
    spam_reason         = Column(String(255), nullable=True)

    # Processing state
    processed           = Column(Boolean, default=False)
    processing_error    = Column(Text, nullable=True)

    # Metadata
    created_at          = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user  = relationship("User",  back_populates="complaints")
    issue = relationship("Issue", back_populates="complaints")

    __table_args__ = (
        Index("ix_complaints_category",  "category"),
        Index("ix_complaints_urgency",   "urgency"),
        Index("ix_complaints_created",   "created_at"),
        Index("ix_complaints_processed", "processed"),
    )


# ── ISSUES ────────────────────────────────────────────────────────

class Issue(Base):
    __tablename__ = "issues"

    id                 = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title              = Column(String(300), nullable=False)
    description        = Column(Text, nullable=True)  # AI-generated summary
    category           = Column(Enum(CategoryEnum), nullable=False)
    department         = Column(String(100), nullable=True)
    location           = Column(String(255), nullable=False)
    district           = Column(String(100), default="Pilot District")
    ward               = Column(String(100), nullable=True)

    # Complaint aggregation
    complaint_count    = Column(Integer, default=1)
    embedding_centroid = Column(JSON, nullable=True)  # average embedding of all complaints

    # Voting aggregates (denormalised for speed)
    votes_urgent       = Column(Integer, default=0)
    votes_important    = Column(Integer, default=0)
    votes_minor        = Column(Integer, default=0)
    total_votes        = Column(Integer, default=0)

    # Priority (recalculated on each vote)
    priority_score     = Column(Float, default=0.0)

    # Admin workflow
    status             = Column(Enum(IssueStatusEnum), default=IssueStatusEnum.PENDING)
    approved_by        = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at        = Column(DateTime(timezone=True), nullable=True)
    rejection_reason   = Column(Text, nullable=True)
    merged_into        = Column(UUID(as_uuid=True), ForeignKey("issues.id"), nullable=True)

    # Government response
    government_response = Column(Text, nullable=True)
    resolved_at         = Column(DateTime(timezone=True), nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    complaints    = relationship("Complaint",    back_populates="issue")
    votes         = relationship("Vote",         back_populates="issue")
    admin_actions = relationship("AdminAction",  back_populates="issue")

    __table_args__ = (
        Index("ix_issues_status",         "status"),
        Index("ix_issues_category",       "category"),
        Index("ix_issues_priority",       "priority_score"),
        Index("ix_issues_created",        "created_at"),
    )


# ── VOTES ─────────────────────────────────────────────────────────

class Vote(Base):
    __tablename__ = "votes"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    issue_id   = Column(UUID(as_uuid=True), ForeignKey("issues.id"), nullable=False)
    vote_type  = Column(Enum(VoteTypeEnum), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user  = relationship("User",  back_populates="votes")
    issue = relationship("Issue", back_populates="votes")

    __table_args__ = (
        # One vote per user per issue — enforced at DB level
        Index("ix_votes_unique_user_issue", "user_id", "issue_id", unique=True),
    )


# ── ADMIN ACTIONS ─────────────────────────────────────────────────

class AdminAction(Base):
    __tablename__ = "admin_actions"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_id   = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    issue_id   = Column(UUID(as_uuid=True), ForeignKey("issues.id"), nullable=False)
    action     = Column(Enum(AdminActionEnum), nullable=False)
    reason     = Column(Text, nullable=True)
    action_metadata = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    issue = relationship("Issue", back_populates="admin_actions")

# ── CHAT HISTORY ──────────────────────────────────────────────────

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title      = Column(String(255), default="New Chat")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user     = relationship("User")
    messages = relationship("ChatMessageModel", back_populates="session", cascade="all, delete-orphan", order_by="ChatMessageModel.created_at")

class ChatMessageModel(Base):
    __tablename__ = "chat_messages"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id"), nullable=False)
    role       = Column(String(50), nullable=False) # "user" or "model"
    text       = Column(Text, nullable=False)
    draft_text = Column(Text, nullable=True)
    is_violation = Column(Boolean, default=False)
    feedback   = Column(String(10), nullable=True) # "up", "down", or null
    attachment_url = Column(String(500), nullable=True)
    attachment_mime_type = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    session = relationship("ChatSession", back_populates="messages")


# ── PROPOSALS (PUBLIC OPINION) ────────────────────────────────────

class ProposalVoteTypeEnum(str, enum.Enum):
    UP = "up"
    DOWN = "down"

class Proposal(Base):
    __tablename__ = "proposals"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    content    = Column(Text, nullable=False)
    image_url  = Column(String(500), nullable=True)
    tags       = Column(JSON, default=list)
    
    # Denormalized counts
    upvotes    = Column(Integer, default=0)
    downvotes  = Column(Integer, default=0)
    comments   = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user  = relationship("User")
    votes = relationship("ProposalVote", back_populates="proposal", cascade="all, delete-orphan")


class ProposalVote(Base):
    __tablename__ = "proposal_votes"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id     = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    proposal_id = Column(UUID(as_uuid=True), ForeignKey("proposals.id"), nullable=False)
    vote_type   = Column(Enum(ProposalVoteTypeEnum), nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user     = relationship("User")
    proposal = relationship("Proposal", back_populates="votes")

    __table_args__ = (
        # One vote per user per proposal
        Index("ix_proposal_votes_unique_user_proposal", "user_id", "proposal_id", unique=True),
    )

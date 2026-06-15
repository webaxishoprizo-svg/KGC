"""
KGC Lite — Database Connection
Async SQLAlchemy engine + session factory
"""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from contextlib import asynccontextmanager
import logging

from config import settings
from database.models import Base

logger = logging.getLogger(__name__)

# ── ASYNC ENGINE (for FastAPI routes) ────────────────────────────
db_url = settings.DATABASE_URL or "sqlite+aiosqlite:///kgc_lite.db"
is_sqlite = db_url.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}

async_engine = create_async_engine(
    db_url,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    **(
        {} if is_sqlite else {
            "pool_size": 10,
            "max_overflow": 20,
        }
    ),
    connect_args=connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# ── SYNC ENGINE (for Alembic migrations) ─────────────────────────
sync_db_url = settings.SYNC_DATABASE_URL or "sqlite:///kgc_lite.db"
is_sync_sqlite = sync_db_url.startswith("sqlite")
sync_engine = create_engine(
    sync_db_url,
    echo=False,
    pool_pre_ping=True,
    connect_args={"check_same_thread": False} if is_sync_sqlite else {},
)

SyncSessionLocal = sessionmaker(bind=sync_engine)


# ── DEPENDENCY: get async DB session ─────────────────────────────
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ── CREATE TABLES (for development) ──────────────────────────────
async def create_tables():
    """Create all tables if they don't exist and auto-migrate SQLite/Postgres."""
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    # Auto-migrate: Add missing columns one by one in separate transactions
    # This prevents Postgres transaction poisoning if a column already exists
    import sqlalchemy as sa
    columns = [
        "email VARCHAR(255)",
        "hashed_password VARCHAR(255)",
        "google_id VARCHAR(255)",
        "auth_provider VARCHAR(50) DEFAULT 'mobile'",
        "name VARCHAR(100)",
        "age INTEGER",
        "gender VARCHAR(20)",
        "address TEXT",
        "is_onboarded BOOLEAN DEFAULT FALSE",
    ]
    for col in columns:
        try:
            async with async_engine.begin() as conn:
                await conn.execute(sa.text(f"ALTER TABLE users ADD COLUMN {col}"))
        except Exception:
            pass
            
    # Also drop the NOT NULL constraint on mobile (for older database schemas)
    try:
        async with async_engine.begin() as conn:
            await conn.execute(sa.text("ALTER TABLE users ALTER COLUMN mobile DROP NOT NULL"))
    except Exception:
        pass
            
    logger.info("✅ Database tables created/verified/migrated")


async def drop_tables():
    """Drop all tables. DANGER: only for development reset."""
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    logger.warning("⚠️  All database tables dropped")

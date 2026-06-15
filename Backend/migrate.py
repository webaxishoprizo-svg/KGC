"""
KGC Lite — Database Migration Script
Run this to create all tables from scratch.
Simpler than full Alembic for MVP deployment.

Usage:
  python migrate.py          → create all tables
  python migrate.py --drop   → drop + recreate (DANGER: loses all data)
  python migrate.py --seed   → create tables + seed admin user
"""

import asyncio
import sys
import uuid
from datetime import datetime, timezone

from database.connection import create_tables, drop_tables, async_engine
from database.models import Base, User
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.ext.asyncio import async_sessionmaker


async def main():
    args = sys.argv[1:]

    if "--drop" in args:
        print("[WARNING] Dropping all tables...")
        await drop_tables()
        print("[SUCCESS] Tables dropped")

    print("Creating tables...")
    await create_tables()
    print("[SUCCESS] Tables created")

    if "--seed" in args or "--drop" in args:
        await seed_admin()


async def seed_admin():
    """Create a default admin user for development."""
    Session = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as db:
        from sqlalchemy import select
        result = await db.execute(
            select(User).where(User.mobile == "9999999999")
        )
        existing = result.scalar_one_or_none()

        if existing:
            print("[INFO] Admin user already exists")
            return

        admin = User(
            mobile          = "9999999999",
            mobile_verified = True,
            is_admin        = True,
            otp_code        = None,
        )
        db.add(admin)
        await db.commit()
        print("[SUCCESS] Admin user created:")
        print("   Mobile: 9999999999")
        print("   Use POST /auth/send-otp to get OTP")
        print("   (In DEBUG mode, OTP is printed to console)")


if __name__ == "__main__":
    asyncio.run(main())

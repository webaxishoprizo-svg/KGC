"""
KGC Lite — Authentication
JWT token generation/validation + OTP management
"""

import random
import string
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from config import settings
from database.connection import get_db
from database.models import User

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)


# ── OTP ───────────────────────────────────────────────────────────

def generate_otp(length: int = 6) -> str:
    """Generate a secure numeric OTP."""
    return "".join(random.choices(string.digits, k=length))


async def send_otp(mobile: str, otp: str) -> bool:
    """
    Send OTP via configured SMS provider.
    In development (SMS_PROVIDER=console), just print to logs.
    """
    if settings.SMS_PROVIDER == "console":
        logger.info(f"📱 OTP for ******{mobile[-4:]}: {otp}  ← DEV MODE (not real SMS)")
        print(f"\n{'='*40}")
        print(f"  OTP for ******{mobile[-4:]}: {otp}")
        print(f"{'='*40}\n")
        return True

    if settings.SMS_PROVIDER == "msg91":
        return await _send_msg91(mobile, otp)

    return False


async def _send_msg91(mobile: str, otp: str) -> bool:
    """Send OTP via MSG91 API."""
    import httpx
    try:
        if not settings.MSG91_TEMPLATE_ID:
            logger.error("MSG91_TEMPLATE_ID is missing! Cannot send real SMS via MSG91.")
            return False

        # MSG91 expects mobile with country code (e.g. 91 for India)
        formatted_mobile = f"91{mobile}" if len(mobile) == 10 else mobile
        
        url = "https://control.msg91.com/api/v5/otp"
        params = {
            "template_id": settings.MSG91_TEMPLATE_ID,
            "mobile": formatted_mobile,
            "authkey": settings.MSG91_API_KEY,
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                params=params,
                json={"otp": otp}
            )
            
            data = response.json()
            if data.get("type") == "error":
                logger.error(f"MSG91 error: {data.get('message')}")
                return False
                
            return response.status_code == 200
    except Exception as e:
        logger.error(f"MSG91 send failed: {e}")
        return False


# ── JWT ───────────────────────────────────────────────────────────

def create_access_token(user_id: str, is_admin: bool = False) -> str:
    """Create a signed JWT access token."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub":      str(user_id),
        "exp":      expire,
        "is_admin": is_admin,
        "type":     "access",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate JWT token. Raises HTTPException on failure."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ── FASTAPI DEPENDENCIES ──────────────────────────────────────────

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Dependency: require authenticated user."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    payload = decode_token(token)
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing user ID",
        )
        
    import uuid
    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid user ID format"
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists",
        )
    if not getattr(user, 'is_active', True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )
        
    return user


async def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Dependency: require admin user."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Dependency: optional auth (returns None if not authenticated)."""
    if not credentials:
        return None
    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None

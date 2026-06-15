"""
KGC Lite — Auth Router
Multi-provider auth: Email, Google, Mobile OTP
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr, field_validator
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from passlib.context import CryptContext
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from database.connection import get_db
from database.models import User, AuthProviderEnum
from middleware.auth import (
    generate_otp, send_otp, create_access_token, get_current_user
)
from config import settings
from middleware.rate_limit import limiter

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    if not hashed_password: return False
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)


# ── SCHEMAS ───────────────────────────────────────────────────────

class RegisterEmailRequest(BaseModel):
    email: EmailStr
    password: str
    name: str

class LoginEmailRequest(BaseModel):
    email: EmailStr
    password: str

class GoogleLoginRequest(BaseModel):
    credential: str

class SendOTPRequest(BaseModel):
    mobile: str

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, v):
        digits = "".join(filter(str.isdigit, v))
        if len(digits) < 10:
            raise ValueError("Mobile number must be at least 10 digits")
        return digits[-10:]


class VerifyOTPRequest(BaseModel):
    mobile: str
    otp:    str

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, v):
        digits = "".join(filter(str.isdigit, v))
        return digits[-10:]

    @field_validator("otp")
    @classmethod
    def validate_otp(cls, v):
        if not v.isdigit() or len(v) != 6:
            raise ValueError("OTP must be a 6-digit number")
        return v


class VerifyMsg91Request(BaseModel):
    token: str

class AuthResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user_id:      str
    email:        Optional[str] = None
    mobile:       Optional[str] = None
    auth_provider: str
    is_admin:     bool
    is_new_user:  bool
    is_onboarded: bool
    name:         Optional[str] = None

class OnboardRequest(BaseModel):
    name: str
    age: int
    gender: str
    address: str
    mobile: str
    otp: Optional[str] = None
    msg91_token: Optional[str] = None

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, v):
        digits = "".join(filter(str.isdigit, v))
        if len(digits) < 10:
            raise ValueError("Mobile number must be at least 10 digits")
        return digits[-10:]

class OnboardSendOTPRequest(BaseModel):
    mobile: str

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, v):
        digits = "".join(filter(str.isdigit, v))
        if len(digits) < 10:
            raise ValueError("Mobile number must be at least 10 digits")
        return digits[-10:]

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    address: Optional[str] = None


# ── EMAIL AUTH ───────────────────────────────────────────────────

@router.post("/register", response_model=AuthResponse)
@limiter.limit("5/minute")
async def register_email(
    request: Request, body: RegisterEmailRequest, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=body.email,
        hashed_password=get_password_hash(body.password),
        name=body.name,
        auth_provider=AuthProviderEnum.EMAIL,
        is_onboarded=False
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(str(user.id), is_admin=user.is_admin)
    return AuthResponse(
        access_token=token, user_id=str(user.id), email=user.email,
        auth_provider=user.auth_provider.value, is_admin=user.is_admin,
        is_new_user=True, is_onboarded=user.is_onboarded, name=user.name
    )

@router.post("/login", response_model=AuthResponse)
@limiter.limit("10/minute")
async def login_email(
    request: Request, body: LoginEmailRequest, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    token = create_access_token(str(user.id), is_admin=user.is_admin)
    return AuthResponse(
        access_token=token, user_id=str(user.id), email=user.email, mobile=user.mobile,
        auth_provider=user.auth_provider.value, is_admin=user.is_admin,
        is_new_user=False, is_onboarded=user.is_onboarded, name=user.name
    )


# ── GOOGLE AUTH ──────────────────────────────────────────────────

@router.post("/google", response_model=AuthResponse)
@limiter.limit("10/minute")
async def login_google(
    request: Request, body: GoogleLoginRequest, db: AsyncSession = Depends(get_db)
):
    try:
        idinfo = id_token.verify_oauth2_token(
            body.credential, google_requests.Request(), settings.GOOGLE_CLIENT_ID
        )
        email = idinfo.get("email")
        google_id = idinfo.get("sub")
        name = idinfo.get("name")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Google token")

    if not email:
        raise HTTPException(status_code=400, detail="Google token missing email")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    is_new = False

    if not user:
        is_new = True
        user = User(
            email=email, google_id=google_id, name=name,
            auth_provider=AuthProviderEnum.GOOGLE, is_onboarded=False
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    elif not user.google_id:
        user.google_id = google_id
        await db.commit()

    token = create_access_token(str(user.id), is_admin=user.is_admin)
    return AuthResponse(
        access_token=token, user_id=str(user.id), email=user.email, mobile=user.mobile,
        auth_provider=user.auth_provider.value, is_admin=user.is_admin,
        is_new_user=is_new, is_onboarded=user.is_onboarded, name=user.name
    )


# ── MSG91 WIDGET ──────────────────────────────────────────────────

@router.post("/msg91-widget-verify", response_model=AuthResponse)
@limiter.limit("5/minute")
async def verify_msg91_widget_endpoint(
    request: Request,
    body: VerifyMsg91Request,
    db:   AsyncSession = Depends(get_db),
):
    logger.info(f"Received MSG91 widget token: {body.token}")
    if not settings.MSG91_API_KEY:
        raise HTTPException(status_code=500, detail="MSG91 API Key not configured")

    async with httpx.AsyncClient() as client:
        res = await client.post(
            "https://control.msg91.com/api/v5/widget/verifyAccessToken",
            headers={"Content-Type": "application/json"},
            json={
                "authkey": settings.MSG91_API_KEY,
                "access-token": body.token
            }
        )
    
    if res.status_code != 200:
        logger.error(f"MSG91 token verification failed with status {res.status_code}: {res.text}")
        raise HTTPException(status_code=400, detail="Invalid MSG91 authentication token.")

    data = res.json()
    if data.get("type") == "error":
        raise HTTPException(status_code=400, detail=data.get("message", "Token verification failed"))

    mobile_raw = data.get("mobile")
    if not mobile_raw:
        raise HTTPException(status_code=400, detail="Could not extract mobile number from verified token")

    mobile = "".join(filter(str.isdigit, str(mobile_raw)))[-10:]

    result = await db.execute(select(User).where(User.mobile == mobile))
    user = result.scalar_one_or_none()
    
    is_new = False
    if not user:
        is_new = True
        user = User(
            mobile=mobile, mobile_verified=True, 
            auth_provider=AuthProviderEnum.MOBILE
        )
        db.add(user)
        await db.flush()
    elif not user.mobile_verified:
        user.mobile_verified = True
    
    user.otp_code = None
    user.otp_expires_at = None
    user.otp_attempts = 0
    await db.commit()

    token = create_access_token(str(user.id), is_admin=user.is_admin)
    return AuthResponse(
        access_token=token, user_id=str(user.id), email=user.email, mobile=user.mobile,
        auth_provider=user.auth_provider.value, is_admin=user.is_admin,
        is_new_user=is_new, is_onboarded=user.is_onboarded, name=user.name
    )


# ── NATIVE OTP ────────────────────────────────────────────────────
# (If building custom OTP UI without widget)

@router.post("/send-otp")
@limiter.limit("3/minute")
async def send_otp_endpoint(
    request: Request, body: SendOTPRequest, db: AsyncSession = Depends(get_db)
):
    mobile = body.mobile
    result = await db.execute(select(User).where(User.mobile == mobile))
    user = result.scalar_one_or_none()

    if not user:
        user = User(mobile=mobile, auth_provider=AuthProviderEnum.MOBILE)
        db.add(user)
        await db.flush()

    if user.otp_attempts >= settings.MAX_OTP_ATTEMPTS:
        if user.otp_expires_at and datetime.now(timezone.utc) < user.otp_expires_at:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many OTP attempts. Try again later."
            )
        else:
            user.otp_attempts = 0

    otp = generate_otp()
    user.otp_code = otp
    user.otp_expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
    user.otp_attempts = (user.otp_attempts or 0) + 1
    await db.commit()

    sent = await send_otp(mobile, otp)
    if not sent:
        raise HTTPException(status_code=500, detail="Failed to send OTP.")

    response = {"message": f"OTP sent to ******{mobile[-4:]}", "expires_in_minutes": settings.OTP_EXPIRE_MINUTES}
    if settings.DEBUG: response["otp_dev"] = otp
    return response


@router.post("/verify-otp", response_model=AuthResponse)
@limiter.limit("5/minute")
async def verify_otp_endpoint(
    request: Request, body: VerifyOTPRequest, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.mobile == body.mobile))
    user = result.scalar_one_or_none()

    if not user or not user.otp_expires_at or datetime.now(timezone.utc) > user.otp_expires_at:
        raise HTTPException(status_code=400, detail="OTP expired or invalid.")

    if user.otp_code != body.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP.")

    is_new = not user.mobile_verified
    user.mobile_verified = True
    user.otp_code = None
    user.otp_expires_at = None
    user.otp_attempts = 0
    await db.commit()

    token = create_access_token(str(user.id), is_admin=user.is_admin)
    return AuthResponse(
        access_token=token, user_id=str(user.id), email=user.email, mobile=user.mobile,
        auth_provider=user.auth_provider.value, is_admin=user.is_admin,
        is_new_user=is_new, is_onboarded=user.is_onboarded, name=user.name
    )


# ── ONBOARDING & PROFILE ──────────────────────────────────────────

@router.post("/onboard/send-otp")
@limiter.limit("3/minute")
async def onboard_send_otp_endpoint(
    request: Request,
    body: OnboardSendOTPRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.is_onboarded:
        raise HTTPException(status_code=400, detail="User is already onboarded.")
        
    mobile = body.mobile
    
    # Check if mobile is already used by another verified user
    result = await db.execute(select(User).where(User.mobile == mobile, User.id != current_user.id, User.mobile_verified == True))
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(status_code=400, detail="Mobile number is already registered to another account.")

    if current_user.otp_attempts >= settings.MAX_OTP_ATTEMPTS:
        if current_user.otp_expires_at and datetime.now(timezone.utc) < current_user.otp_expires_at:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many OTP attempts. Try again later.")
        else:
            current_user.otp_attempts = 0

    otp = generate_otp()
    current_user.otp_code = otp
    current_user.otp_expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
    current_user.otp_attempts = (current_user.otp_attempts or 0) + 1
    await db.commit()

    sent = await send_otp(mobile, otp)
    if not sent:
        raise HTTPException(status_code=500, detail="Failed to send OTP.")

    response = {"message": f"OTP sent to ******{mobile[-4:]}", "expires_in_minutes": settings.OTP_EXPIRE_MINUTES}
    if settings.DEBUG: response["otp_dev"] = otp
    return response


@router.post("/onboard")
async def onboard_user(
    body: OnboardRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.is_onboarded:
        raise HTTPException(status_code=400, detail="User is already onboarded.")
        
    # Verify OTP or MSG91 Token (Bypassed for MVP as per user request)
    pass

    # Check if mobile is taken (double check)
    result = await db.execute(select(User).where(User.mobile == body.mobile, User.id != current_user.id, User.mobile_verified == True))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Mobile number is already registered to another account.")
        
    current_user.name = body.name
    current_user.age = body.age
    current_user.gender = body.gender
    current_user.address = body.address
    current_user.mobile = body.mobile
    current_user.mobile_verified = True
    current_user.is_onboarded = True
    
    current_user.otp_code = None
    current_user.otp_expires_at = None
    current_user.otp_attempts = 0
    
    await db.commit()
    return {"message": "Profile updated successfully.", "is_onboarded": True, "name": current_user.name}


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id":               str(current_user.id),
        "name":             current_user.name,
        "email":            current_user.email,
        "mobile":           current_user.mobile,
        "age":              current_user.age,
        "gender":           current_user.gender,
        "address":          current_user.address,
        "auth_provider":    current_user.auth_provider.value if current_user.auth_provider else None,
        "is_admin":         current_user.is_admin,
        "mobile_verified":  current_user.mobile_verified,
        "is_onboarded":     current_user.is_onboarded,
        "complaints_today": current_user.complaints_today,
        "created_at":       current_user.created_at,
    }

@router.patch("/profile")
async def update_profile(
    body: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.name is not None: current_user.name = body.name
    if body.mobile is not None: current_user.mobile = body.mobile
    if body.age is not None: current_user.age = body.age
    if body.gender is not None: current_user.gender = body.gender
    if body.address is not None: current_user.address = body.address
    
    await db.commit()
    return {"message": "Profile updated successfully"}

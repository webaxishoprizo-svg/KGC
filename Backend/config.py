"""
KGC Lite — Configuration
All settings loaded from environment variables
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ── DATABASE ──────────────────────────────────────────────────
    DATABASE_URL:      str = "sqlite+aiosqlite:///kgc_lite.db"
    SYNC_DATABASE_URL: str = "sqlite:///kgc_lite.db"

    # ── GEMINI AI ─────────────────────────────────────────────────
    GEMINI_API_KEY: str
    GEMINI_MODEL:   str = "gemini-2.5-flash"
    # ── JWT ───────────────────────────────────────────────────────
    SECRET_KEY:                  str
    ALGORITHM:                   str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # ── GOOGLE AUTH ───────────────────────────────────────────────
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # ── OTP ───────────────────────────────────────────────────────
    # ── MSG91 ─────────────────────────────────────────────────────
    MSG91_API_KEY: str = "520970Als9dJueR6a1ba8b7P1"
    MSG91_TEMPLATE_ID: str | None = None
    SMS_PROVIDER:  str = "msg91"  # "console" | "msg91" | twilio
    MSG91_SENDER_ID:    str = "KGCAI"
    OTP_EXPIRE_MINUTES: int = 5
    MAX_OTP_ATTEMPTS:   int = 3

    # ── RATE LIMITING ─────────────────────────────────────────────
    MAX_COMPLAINTS_PER_DAY: int = 5
    REDIS_URL:              str = "redis://localhost:6379"

    # ── AI CONFIG ─────────────────────────────────────────────────
    SIMILARITY_THRESHOLD: float = 0.82
    EMBEDDING_MODEL:      str   = "all-MiniLM-L6-v2"

    # ── APP ───────────────────────────────────────────────────────
    APP_NAME:     str  = "KGC Lite"
    APP_VERSION:  str  = "1.0.0"
    DEBUG:        bool = True
    FRONTEND_URL: str  = "http://localhost:3000"

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

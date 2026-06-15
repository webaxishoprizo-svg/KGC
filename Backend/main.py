"""
KGC Lite — Main Application
FastAPI entry point with:
  - CORS for Lovable/Vercel frontend
  - All routers registered
  - Database startup
  - Health check
  - Global exception handling
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from config import settings
from database.connection import create_tables
from routers import auth, complaints, issues, admin, chat, proposals
from middleware.rate_limit import limiter, _rate_limit_exceeded_handler

# ── LOGGING ───────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.WARNING,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ── LIFESPAN (startup / shutdown) ────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 KGC Lite starting up...")
    await create_tables()
    logger.info("✅ Database ready")
    logger.info(f"✅ Gemini model: {settings.GEMINI_MODEL}")
    logger.info(f"✅ Frontend URL: {settings.FRONTEND_URL}")
    yield
    logger.info("👋 KGC Lite shutting down")


# ── APP ───────────────────────────────────────────────────────────
app = FastAPI(
    title       = "KGC Lite API",
    description = "AI-Based Grievance Intelligence & Issue Prioritization System",
    version     = settings.APP_VERSION,
    docs_url    = "/docs",      # Swagger UI
    redoc_url   = "/redoc",     # ReDoc
    lifespan    = lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

import os

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


# ── CORS ─────────────────────────────────────────────────────────
# Allow Cloudflare Workers frontend + localhost dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:[0-9]+)?|https://.*\.workers\.dev|https://.*\.pages\.dev",
    allow_credentials=True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)


# ── SECURE HEADERS MIDDLEWARE ─────────────────────────────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response


# ── GLOBAL EXCEPTION HANDLER ──────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again."},
    )


# ── ROUTERS ───────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(complaints.router)
app.include_router(chat.router)
app.include_router(issues.router)
app.include_router(admin.router)
app.include_router(proposals.router)


# ── HEALTH CHECK ─────────────────────────────────────────────────
@app.get("/", tags=["Health"])
async def root():
    return {
        "service": "KGC Lite API",
        "version": settings.APP_VERSION,
        "status":  "running",
        "docs":    "/docs",
    }


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "version": settings.APP_VERSION}


# ── RUN (development) ─────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host    = "0.0.0.0",
        port    = 8000,
        reload  = True,
        log_level = "info",
    )

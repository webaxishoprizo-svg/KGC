---
title: KGCBackend
emoji: 🏢
colorFrom: blue
colorTo: green
sdk: docker
pinned: false
---

# KGC Lite — Backend Setup Guide

## Stack
- **FastAPI** (Python 3.11+)
- **PostgreSQL** (database)
- **Claude API** (AI classification)
- **sentence-transformers** (complaint similarity/clustering)
- **Deployable on**: Railway / Render / Fly.io (all free tier)

---

## Local Development Setup

### 1. Prerequisites
```bash
# Python 3.11+
python --version

# PostgreSQL running locally
psql --version
```

### 2. Clone and Install
```bash
cd kgc-lite
python -m venv venv
source venv/bin/activate        # Mac/Linux
# venv\Scripts\activate         # Windows

pip install -r requirements.txt
```

### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env with your values:
```

**Minimum required in `.env`:**
```env
DATABASE_URL=postgresql+asyncpg://postgres:yourpassword@localhost:5432/kgc_lite
SYNC_DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/kgc_lite
ANTHROPIC_API_KEY=sk-ant-your-key-here
SECRET_KEY=any-long-random-string-here
```

### 4. Create Database
```bash
# In psql or pgAdmin:
CREATE DATABASE kgc_lite;
```

### 5. Run Migrations + Seed Admin
```bash
python migrate.py --seed
# Creates all tables + admin user (mobile: 9999999999)
```

### 6. Start Server
```bash
uvicorn main:app --reload --port 8000
```

### 7. Test API
Open: http://localhost:8000/docs

---

## API Quick Test (curl)

### Send OTP (dev mode — OTP printed to console)
```bash
curl -X POST http://localhost:8000/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"mobile": "9999999999"}'
```

### Verify OTP (get token)
```bash
curl -X POST http://localhost:8000/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"mobile": "9999999999", "otp": "123456"}'
```

### Submit Complaint (with token)
```bash
curl -X POST http://localhost:8000/complaints/submit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "There is no water supply in our area for 3 days. Ward 12, Mangaluru.",
    "location": "Ward 12, Mangaluru"
  }'
```

### Seed Demo Data (admin token required)
```bash
curl -X POST http://localhost:8000/admin/seed \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### List Public Issues
```bash
curl http://localhost:8000/issues
```

---

## Deploy to Railway (Recommended — Free)

### 1. Install Railway CLI
```bash
npm install -g @railway/cli
railway login
```

### 2. Create Project
```bash
railway init
railway add postgresql   # adds free PostgreSQL
```

### 3. Set Environment Variables in Railway Dashboard
```
ANTHROPIC_API_KEY = sk-ant-...
SECRET_KEY        = your-secret
FRONTEND_URL      = https://your-app.vercel.app
SMS_PROVIDER      = console
DEBUG             = false
```

### 4. Deploy
```bash
railway up
```

Railway auto-sets `DATABASE_URL` and `SYNC_DATABASE_URL` from the PostgreSQL addon.

### 5. Run Migrations on Railway
```bash
railway run python migrate.py --seed
```

---

## Connect Frontend (Lovable/Vercel)

In your Lovable/React frontend, set the API base URL:

```javascript
// src/api/config.js
export const API_BASE = process.env.VITE_API_URL || "http://localhost:8000";
```

In Vercel environment variables:
```
VITE_API_URL = https://your-railway-app.railway.app
```

---

## Full API Endpoint Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /auth/send-otp | None | Send OTP to mobile |
| POST | /auth/verify-otp | None | Verify OTP, get JWT |
| GET | /auth/me | User | Current user profile |
| POST | /complaints/submit | User | Submit + AI process complaint |
| GET | /complaints/mine | User | My complaint history |
| GET | /issues | Optional | List public issues |
| GET | /issues/{id} | Optional | Issue detail |
| POST | /issues/{id}/vote | User | Vote on issue |
| GET | /issues/{id}/my-vote | User | My vote on issue |
| GET | /admin/dashboard | Admin | Full KPI dashboard |
| GET | /admin/pending | Admin | Pending issues |
| POST | /admin/approve/{id} | Admin | Approve issue |
| POST | /admin/reject/{id} | Admin | Reject issue |
| PATCH | /admin/issues/{id} | Admin | Update status |
| GET | /admin/issues | Admin | All issues (filtered) |
| POST | /admin/seed | Admin | Seed demo data |

---

## AI Pipeline Flow

```
Complaint Text
      ↓
Claude API (claude-haiku)
      ↓
  - Category: water/electricity/roads/unknown
  - Urgency: urgent/medium/minor
  - Location extracted from text
  - Keywords extracted
  - AI summary generated (1 sentence)
  - Spam score (0.0 - 1.0)
      ↓
sentence-transformers (all-MiniLM-L6-v2)
      ↓
  - 384-dimensional embedding vector
      ↓
Cosine Similarity vs existing issues
      ↓
  > 0.82 similarity? → MERGE into existing issue
  < 0.82 similarity? → CREATE new issue (pending admin)
      ↓
Priority Score = (complaints × 2) + (urgent × 3) + (important × 1.5) + (minor × 0.5)
```

---

## Priority Score Formula

```
priority = (complaint_count  × 2.0)
         + (votes_urgent     × 3.0)
         + (votes_important  × 1.5)
         + (votes_minor      × 0.5)
```

Higher score → shown first in officer dashboard.

---

## Security Notes

- **OTP**: 6-digit, 5 min expiry, max 3 attempts
- **JWT**: 24hr expiry, RS256 signed
- **Rate limit**: 5 complaints/user/day
- **Spam**: Claude API spam score + flagging
- **Admin**: Separate `is_admin` flag, required for /admin/* routes
- **CORS**: Only allows configured FRONTEND_URL

---

## Development Tips

1. **OTP in dev mode**: OTP is printed to console AND returned in API response (`otp_dev` field). Remove this in production by setting `DEBUG=false`.

2. **Admin account**: Mobile `9999999999` is seeded as admin. Use this for the officer dashboard.

3. **Swagger UI**: Full interactive API docs at `/docs` — test everything without writing code.

4. **Embedding model**: Downloads automatically on first use (~90MB). Cached after first download.

5. **Without Claude API key**: Falls back to rule-based classifier (keyword matching). Good for testing without burning API credits.

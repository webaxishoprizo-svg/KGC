"""
KGC Lite — AI Classifier
Uses Claude API to:
  1. Classify complaint category (water/electricity/roads)
  2. Extract location from text
  3. Detect urgency level
  4. Generate a one-line AI summary
  5. Extract keywords
  6. Detect spam
"""

import json
import logging
import re
from typing import Optional
from google import genai

from config import settings

logger = logging.getLogger(__name__)

# Single Gemini client (reused across calls)
client = genai.Client(api_key=settings.GEMINI_API_KEY)


# ── MAIN CLASSIFICATION FUNCTION ─────────────────────────────────

async def classify_complaint(
    text: str,
    location_raw: Optional[str] = None
) -> dict:
    """
    Send complaint text to Claude API.
    Returns structured classification result.

    Returns:
    {
        "category":           "water" | "electricity" | "roads" | "unknown",
        "urgency":            "urgent" | "medium" | "minor",
        "location_extracted": "Ward 12, Mangaluru" | null,
        "keywords":           ["water", "pipe", "broken"],
        "ai_summary":         "Broken water pipe causing flooding in Ward 12",
        "is_chat":            false,
        "ai_reply":           null,
        "spam_score":         0.05,
        "spam_flagged":       false,
        "spam_reason":        null,
        "confidence":         0.94
    }
    """

    location_context = f"\nLocation provided by user: {location_raw}" if location_raw else ""

    prompt = f"""You are KGC AI Assistant for Karnataka Government. When a citizen submits a complaint:
1. Detect category: water_supply | electricity | roads | health | education | agriculture | revenue | other
2. Detect urgency: urgent (life/basic necessity affected) | medium (service failure) | minor (suggestion/query)
3. Extract location if mentioned
4. Generate a one-line professional summary
5. SPAM DETECTION: You must STRICTLY flag the complaint as spam (spam_flagged = true) if it contains:
   - Profanity, abusive language, or offensive content.
   - Political campaigning, party slogans, or attacks on politicians.
   - Religious hate speech, religious bias, or inappropriate religious requests.
   If flagged as spam, provide a polite 'spam_reason' explaining why it was rejected.
6. Respond ONLY in this JSON format:
{{
  "category": "string",
  "urgency": "string",
  "department": "string (full official name)",
  "location": "string or null",
  "summary": "string",
  "response_time": "string",
  "ticket_suffix": "string (3-letter dept code)",
  "is_chat": false,
  "ai_reply": "string or null",
  "spam_score": 0.0,
  "spam_flagged": false,
  "spam_reason": null,
  "confidence": 0.95,
  "keywords": ["word1", "word2"]
}}

Support Kannada text input — detect Kannada and respond with Kannada summary too.

COMPLAINT TEXT:
"{text}"{location_context}
"""

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2
            )
        )

        raw = response.text.strip()

        # Clean any accidental markdown fences
        raw = re.sub(r"```json|```", "", raw).strip()

        result = json.loads(raw)

        # Validate and sanitise fields
        result["category"]  = result.get("category",  "unknown")
        result["urgency"]   = result.get("urgency",   "medium")
        result["is_chat"]   = bool(result.get("is_chat", False))
        result["ai_reply"]  = result.get("ai_reply", None)
        result["spam_score"] = float(result.get("spam_score", 0.0))
        result["spam_flagged"] = bool(result.get("spam_flagged", False))
        result["confidence"] = float(result.get("confidence", 0.5))
        result["keywords"]  = result.get("keywords", [])[:5]
        
        # New fields
        result["department"] = result.get("department", "General Services")
        result["location_extracted"] = result.get("location")
        result["ai_summary"] = result.get("summary", "")
        result["response_time"] = result.get("response_time", "24-48 hrs")
        result["ticket_suffix"] = result.get("ticket_suffix", "GEN")

        # Map to original enum if possible
        cat_map = {
            "water_supply": "water",
            "electricity": "electricity",
            "roads": "roads"
        }
        mapped_cat = cat_map.get(result["category"], "unknown")

        logger.info(
            f"✅ Classified: category={result['category']} "
            f"urgency={result['urgency']} "
            f"spam={result['spam_flagged']} "
            f"confidence={result['confidence']:.2f}"
        )
        return result

    except json.JSONDecodeError as e:
        logger.error(f"Claude returned invalid JSON: {e}. Raw: {raw[:200]}")
        return _fallback_classification(text)

    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        return _fallback_classification(text)


# ── ISSUE TITLE GENERATOR ─────────────────────────────────────────

async def generate_issue_title(
    category: str,
    location: str,
    complaint_texts: list[str],
    complaint_count: int
) -> dict:
    """
    Generate a clean public-facing issue title and description
    from multiple complaint texts.
    """

    sample_texts = complaint_texts[:5]  # use first 5 complaints max
    combined = "\n".join([f"- {t}" for t in sample_texts])

    prompt = f"""You are creating a public issue card for a government grievance portal.
Based on these citizen complaints, create a clear, factual, professional issue title and description.

CATEGORY: {category.upper()}
LOCATION: {location}
NUMBER OF COMPLAINTS: {complaint_count}

SAMPLE COMPLAINT TEXTS:
{combined}

Create a neutral, factual public issue summary. Do NOT include personal details.
Return ONLY valid JSON:
{{
  "title": "Short clear issue title (max 10 words)",
  "description": "2-3 sentence factual description of the issue for public display",
  "department": "Exact department name: Karnataka Water Supply Board | Karnataka Electricity Board | Highways Department"
}}"""

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.3
            )
        )
        raw = response.text.strip()
        raw = re.sub(r"```json|```", "", raw).strip()
        result = json.loads(raw)
        return result

    except Exception as e:
        logger.error(f"Issue title generation failed: {e}")
        dept_map = {
            "water":       "Karnataka Water Supply Board",
            "electricity": "Karnataka Electricity Board",
            "roads":       "Highways Department",
        }
        return {
            "title":       f"{category.title()} Issue — {location}",
            "description": f"Multiple citizens have reported {category} related issues in {location}.",
            "department":  dept_map.get(category, "General Services"),
        }


# ── SPAM RE-CHECK (for borderline cases) ─────────────────────────

async def recheck_spam(text: str) -> dict:
    """
    Second-pass spam check for borderline cases (0.5 < score < 0.7).
    More thorough than the initial classification pass.
    """
    prompt = f"""Is this a genuine government service complaint or spam/abuse?

TEXT: "{text}"

Answer ONLY with JSON:
{{
  "is_spam": true|false,
  "reason": "brief reason or null",
  "confidence": 0.0-1.0
}}"""

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1
            )
        )
        raw = re.sub(r"```json|```", "", response.text.strip()).strip()
        return json.loads(raw)
    except Exception:
        return {"is_spam": False, "reason": None, "confidence": 0.5}


# ── RULE-BASED FALLBACK ───────────────────────────────────────────

def _fallback_classification(text: str) -> dict:
    """
    Simple rule-based fallback when Claude API fails.
    Uses keyword matching for basic classification.
    """
    text_lower = text.lower()

    # Category keywords
    water_kw       = ["water", "pipe", "tap", "borewell", "tanneer", "குழாய்", "தண்ணீர்",
                      "sewage", "drain", "flood", "overflow", "supply"]
    electricity_kw = ["power", "current", "electricity", "light", "streetlight", "transformer",
                      "meter", "voltage", "மின்சாரம்", "விளக்கு", "outage", "cut"]
    roads_kw       = ["road", "pothole", "street", "footpath", "traffic", "signal",
                      "சாலை", "குழி", "pavement", "bridge", "repair", "highway"]

    # Urgency keywords
    urgent_kw = ["no water", "days", "emergency", "hospital", "school", "flood",
                 "dangerous", "urgent", "immediate", "fire", "accident", "death"]

    category = "unknown"
    if any(k in text_lower for k in water_kw):
        category = "water"
    elif any(k in text_lower for k in electricity_kw):
        category = "electricity"
    elif any(k in text_lower for k in roads_kw):
        category = "roads"

    urgency = "urgent" if any(k in text_lower for k in urgent_kw) else "medium"

    dept_map = {
        "water":       "Karnataka Water Supply Board",
        "electricity": "Karnataka Electricity Board",
        "roads":       "Highways Department",
        "unknown":     "General Services",
    }

    return {
        "category":          category,
        "urgency":           urgency,
        "location_extracted": None,
        "keywords":          [],
        "ai_summary":        text[:100],
        "spam_score":        0.0,
        "spam_flagged":      False,
        "spam_reason":       None,
        "confidence":        0.4,
        "department":        dept_map.get(category, "General Services"),
        "fallback":          True,
    }

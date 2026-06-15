import google.generativeai as genai
import json
import logging
from config import settings

logger = logging.getLogger(__name__)

genai.configure(api_key=settings.GEMINI_API_KEY)
# Use a fast model for verification
model = genai.GenerativeModel('gemini-2.5-flash')

PROPOSAL_VERIFICATION_PROMPT = """
You are a strict safety and compliance AI for the Karnataka Grievance Portal.
A citizen has submitted a public policy proposal. You must analyze it to ensure it does not violate any of the following strict rules:

1. NO Political Content: It must not contain political campaigning, favor or attack any specific political party or politician.
2. NO Religious Content: It must not contain religious bias, hate speech, religious requests, or target any religious group.
3. NO Privacy Violations: It must not expose sensitive personal information (e.g., someone's private phone number, home address, Aadhaar number) maliciously.

Analyze the proposal text below.
If it violates any of these rules, you must reject it and provide a concise, polite reason why it was rejected.
If it is completely safe and focuses on public policy, infrastructure, or governance, approve it.

Return ONLY a valid JSON object in the following format:
{
  "is_safe": true or false,
  "reason": "If false, a polite 1-sentence explanation of why it was rejected (e.g., 'Your proposal was rejected because it contains political campaigning.'). If true, empty string."
}

Proposal Text:
\"\"\"{text}\"\"\"
"""

async def verify_proposal_safety(text: str) -> dict:
    """
    Calls Gemini to verify if the proposal text is safe for public viewing.
    Returns dict: {"is_safe": bool, "reason": str}
    """
    prompt = PROPOSAL_VERIFICATION_PROMPT.format(text=text)
    
    try:
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.1,
            )
        )
        
        result = json.loads(response.text)
        return {
            "is_safe": bool(result.get("is_safe", True)),
            "reason": str(result.get("reason", ""))
        }
    except Exception as e:
        logger.error(f"Gemini Verification Error: {e}")
        # In case of API failure, we might want to default to false for safety, 
        # or true to not block users. Let's default to false to be strictly safe.
        return {
            "is_safe": False,
            "reason": "Our AI safety systems are currently unavailable. Please try submitting your proposal later."
        }

"""
KGC Lite — Chatbot Conversational Engine
Uses Gemini to maintain chat context, analyze issues, and generate complaint drafts.
"""

import logging
from typing import List, Dict, Optional
import json
import logging
import os
import urllib.parse
from pydantic import BaseModel
from google import genai
from google.genai import types

from config import settings

logger = logging.getLogger(__name__)
client = genai.Client(api_key=settings.GEMINI_API_KEY)

class ChatMessage(BaseModel):
    role: str # "user" or "model"
    text: str

class ChatResponse(BaseModel):
    reply: str
    draft_ready: bool
    draft_text: Optional[str] = None
    is_violation: bool = False

SYSTEM_PROMPT = """You are KGC AI, an intelligent, human-like assistant for the Karnataka Government Grievance Portal.
Your goals:
1. Act naturally and professionally like a human assistant (e.g. ChatGPT/Gemini).
2. You must ONLY discuss topics related to Karnataka improvements, government services, public issues (water, electricity, roads, health, education, agriculture, revenue, etc.).
3. DO NOT reply to inappropriate, harmful, or irrelevant questions (refuse politely).
4. If a citizen mentions a problem or issue, DO NOT immediately submit a complaint. Instead, ASK follow-up questions to gather necessary details (e.g., exact location, duration of the issue, severity).
5. Once you have enough details (category, location, and clear description), you must output a FINAL DRAFT of the complaint for them to review.
6. When outputting the final draft, wrap the drafted text inside a special XML tag: <DRAFT_COMPLAINT>...draft text here...</DRAFT_COMPLAINT>. Make the draft formal and readable.
7. Always respond in the language the user speaks (English or Kannada).
8. SPAM & SAFETY FILTER: You MUST STRICTLY REJECT the user's message if it contains:
   - Profanity, abusive language, or offensive content.
   - Political campaigning, party slogans, or attacks on politicians.
   - Religious hate speech, religious bias, or inappropriate religious requests.
   If ANY of these are detected, DO NOT process it. Instead, reply EXACTLY with a special XML tag: <VIOLATION>Warning: Your message violates KGC safety and anti-spam policies because it contains offensive, political, or religious content. Repeated offenses may result in account suspension.</VIOLATION>. No other text should be included.

{EXAMPLES_PLACEHOLDER}
"""

async def process_chat(history: List[ChatMessage], new_message: str, examples: Optional[str] = None, attachment_url: Optional[str] = None, attachment_mime_type: Optional[str] = None) -> ChatResponse:
    try:
        current_system_prompt = SYSTEM_PROMPT
        if examples:
            current_system_prompt = current_system_prompt.replace(
                "{EXAMPLES_PLACEHOLDER}", 
                f"\n\n9. LEARNING DIRECTIVE: Here are some highly-rated past complaint drafts. Use their formatting and structure as a guide for your next draft:\n\n{examples}"
            )
        else:
            current_system_prompt = current_system_prompt.replace("{EXAMPLES_PLACEHOLDER}", "")
            
        contents = []
        for msg in history:
            role = "user" if msg.role == "user" else "model"
            contents.append(types.Content(role=role, parts=[types.Part.from_text(text=msg.text)]))
            
        user_parts = [types.Part.from_text(text=new_message)]
        if attachment_url and attachment_mime_type:
            # url comes as '/uploads/filename.jpg', map it to local filesystem
            local_path = urllib.parse.unquote(attachment_url.lstrip('/'))
            if os.path.exists(local_path):
                with open(local_path, "rb") as f:
                    file_bytes = f.read()
                user_parts.append(types.Part.from_bytes(data=file_bytes, mime_type=attachment_mime_type))
            else:
                logger.warning(f"Attachment file not found: {local_path}")
                
        contents.append(types.Content(role="user", parts=user_parts))
        
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=current_system_prompt,
                temperature=0.3,
            )
        )
        
        reply_text = response.text.strip()
        
        draft_ready = False
        draft_text = None
        is_violation = False
        
        if "<VIOLATION>" in reply_text and "</VIOLATION>" in reply_text:
            is_violation = True
            start_idx = reply_text.find("<VIOLATION>") + len("<VIOLATION>")
            end_idx = reply_text.find("</VIOLATION>")
            reply_text = reply_text[start_idx:end_idx].strip()
            
        elif "<DRAFT_COMPLAINT>" in reply_text and "</DRAFT_COMPLAINT>" in reply_text:
            draft_ready = True
            start_idx = reply_text.find("<DRAFT_COMPLAINT>") + len("<DRAFT_COMPLAINT>")
            end_idx = reply_text.find("</DRAFT_COMPLAINT>")
            draft_text = reply_text[start_idx:end_idx].strip()
            
            # Remove the tag from the visible reply
            reply_text = reply_text[:reply_text.find("<DRAFT_COMPLAINT>")].strip()
            if not reply_text:
                reply_text = "I have drafted the complaint based on your details. Please review it below. You can edit it before sending."

        return ChatResponse(
            reply=reply_text,
            draft_ready=draft_ready,
            draft_text=draft_text,
            is_violation=is_violation
        )
        
    except Exception as e:
        logger.error(f"Chat generation error: {e}")
        return ChatResponse(
            reply="I'm sorry, I encountered an error processing your request. Please try again.",
            draft_ready=False,
            draft_text=None,
            is_violation=False
        )

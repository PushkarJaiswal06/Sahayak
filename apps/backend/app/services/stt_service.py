import os
import httpx
from typing import Optional
from loguru import logger

from app.core.config import settings


class STTService:
    """Speech-to-Text using Deepgram Nova-2"""

    def __init__(self):
        self.api_key = os.getenv("DEEPGRAM_API_KEY", "")
        self.base_url = "https://api.deepgram.com/v1/listen"

    async def transcribe(self, audio_bytes: bytes, language: str = "hi-en") -> Optional[str]:
        if not self.api_key:
            logger.warning("DEEPGRAM_API_KEY not set; returning mock transcript")
            return "check my balance"

        headers = {
            "Authorization": f"Token {self.api_key}",
            "Content-Type": "audio/wav",
        }
        params = {
            "model": "nova-2",
            "language": language,
            "punctuate": "true",
            "smart_format": "true",
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self.base_url,
                    headers=headers,
                    params=params,
                    content=audio_bytes,
                )
                response.raise_for_status()
                data = response.json()
                transcript = data.get("results", {}).get("channels", [{}])[0].get("alternatives", [{}])[0].get("transcript", "")
                return transcript
        except Exception as e:
            logger.exception(f"STT error: {e}")
            return None

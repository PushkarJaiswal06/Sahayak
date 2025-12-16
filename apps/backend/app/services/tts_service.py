import os
import httpx
from typing import Optional
from loguru import logger

from app.core.config import settings


class TTSService:
    """Text-to-Speech using ElevenLabs Turbo v2"""

    def __init__(self):
        self.api_key = os.getenv("ELEVENLABS_API_KEY", "")
        self.base_url = "https://api.elevenlabs.io/v1/text-to-speech"
        self.voice_id = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")  # Rachel

    async def synthesize(self, text: str) -> Optional[str]:
        if not self.api_key:
            logger.warning("ELEVENLABS_API_KEY not set; returning None")
            return None

        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "text": text,
            "model_id": "eleven_turbo_v2",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/{self.voice_id}",
                    headers=headers,
                    json=payload,
                )
                response.raise_for_status()
                # In production, would upload to S3/CDN and return URL
                # For now, return placeholder
                return f"/audio/{hash(text)}.mp3"
        except Exception as e:
            logger.exception(f"TTS error: {e}")
            return None

    async def synthesize_stream(self, text: str):
        """Stream audio chunks for real-time playback"""
        if not self.api_key:
            return

        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "text": text,
            "model_id": "eleven_turbo_v2",
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/{self.voice_id}/stream",
                headers=headers,
                json=payload,
            ) as response:
                async for chunk in response.aiter_bytes():
                    yield chunk

import base64
import io
from typing import Optional, AsyncGenerator
from loguru import logger
import edge_tts


class TTSService:
    """Text-to-Speech using Microsoft Edge TTS (free, no API key needed)"""

    # Available voices: https://github.com/rany2/edge-tts
    # Female voices: en-US-AriaNeural, en-US-JennyNeural, en-IN-NeerjaNeural
    # Male voices: en-US-GuyNeural, en-US-ChristopherNeural, en-IN-PrabhatNeural
    DEFAULT_VOICE = "en-US-AriaNeural"  # Natural female voice

    def __init__(self):
        self.voice = self.DEFAULT_VOICE

    async def synthesize(self, text: str) -> Optional[bytes]:
        """Synthesize text to audio bytes using Edge TTS"""
        if not text or not text.strip():
            logger.warning("Empty text provided for TTS")
            return None

        try:
            communicate = edge_tts.Communicate(text, self.voice)
            audio_buffer = io.BytesIO()
            
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_buffer.write(chunk["data"])
            
            audio_bytes = audio_buffer.getvalue()
            if audio_bytes:
                logger.info(f"TTS generated {len(audio_bytes)} bytes for: '{text[:50]}...'")
                return audio_bytes
            else:
                logger.warning("Edge TTS returned empty audio")
                return None
                
        except Exception as e:
            logger.exception(f"Edge TTS error: {e}")
            raise

    async def synthesize_base64(self, text: str) -> Optional[str]:
        """Synthesize text and return as base64 encoded string"""
        audio_bytes = await self.synthesize(text)
        if audio_bytes:
            return base64.b64encode(audio_bytes).decode("utf-8")
        return None

    async def synthesize_stream(self, text: str) -> AsyncGenerator[bytes, None]:
        """Stream audio chunks for real-time playback"""
        if not text or not text.strip():
            logger.warning("Empty text provided for TTS streaming")
            return

        try:
            communicate = edge_tts.Communicate(text, self.voice)
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    yield chunk["data"]
        except Exception as e:
            logger.exception(f"Edge TTS streaming error: {e}")
            raise

    def set_voice(self, voice: str):
        """Change the TTS voice"""
        self.voice = voice
        logger.info(f"TTS voice changed to: {voice}")


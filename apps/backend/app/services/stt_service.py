import httpx
from typing import Optional
from loguru import logger


class STTService:
    """Speech-to-Text using Deepgram Nova-2"""

    def __init__(self):
        from app.core.config import settings
        self.api_key = settings.DEEPGRAM_API_KEY
        self.base_url = "https://api.deepgram.com/v1/listen"

    async def transcribe(self, audio_bytes: bytes, language: str = "en") -> Optional[str]:
        """Transcribe audio bytes to text using Deepgram"""
        if not self.api_key:
            logger.error("DEEPGRAM_API_KEY not configured")
            raise ValueError("DEEPGRAM_API_KEY not configured")

        if len(audio_bytes) < 100:
            logger.warning(f"Audio too short: {len(audio_bytes)} bytes")
            return None

        # Detect content type and encoding based on audio header
        content_type, encoding = self._detect_audio_format(audio_bytes)
        logger.debug(f"Detected audio format: {content_type}, encoding: {encoding}")
        
        headers = {
            "Authorization": f"Token {self.api_key}",
            "Content-Type": content_type,
        }
        
        params = {
            "model": "nova-2",
            "language": language,
            "punctuate": "true",
            "smart_format": "true",
        }
        
        # Add encoding for raw/unknown formats
        if encoding:
            params["encoding"] = encoding

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
                
                # Extract transcript from Deepgram response
                channels = data.get("results", {}).get("channels", [])
                if channels:
                    alternatives = channels[0].get("alternatives", [])
                    if alternatives:
                        transcript = alternatives[0].get("transcript", "")
                        confidence = alternatives[0].get("confidence", 0)
                        logger.info(f"STT transcript: '{transcript}' (confidence: {confidence:.2f})")
                        return transcript if transcript else None
                
                logger.warning("No transcript in Deepgram response")
                return None
                
        except httpx.HTTPStatusError as e:
            logger.error(f"Deepgram API error {e.response.status_code}: {e.response.text}")
            raise
        except Exception as e:
            logger.exception(f"STT error: {e}")
            raise

    def _detect_audio_format(self, audio_bytes: bytes) -> tuple[str, Optional[str]]:
        """Detect audio MIME type and encoding from bytes"""
        if len(audio_bytes) < 12:
            return "audio/webm", "opus"
        
        # Check magic bytes for common formats
        header = audio_bytes[:12]
        
        # WAV: RIFF....WAVE
        if header[:4] == b'RIFF' and header[8:12] == b'WAVE':
            return "audio/wav", None
        
        # WebM: 0x1A45DFA3 (EBML header)
        if header[:4] == b'\x1a\x45\xdf\xa3':
            return "audio/webm", None  # Deepgram auto-detects webm codec
        
        # OGG: OggS
        if header[:4] == b'OggS':
            return "audio/ogg", None
        
        # FLAC: fLaC
        if header[:4] == b'fLaC':
            return "audio/flac", None
        
        # MP3: ID3 tag or frame sync
        if header[:3] == b'ID3' or (header[0] == 0xFF and (header[1] & 0xE0) == 0xE0):
            return "audio/mp3", None
        
        # MP4/M4A: ....ftyp
        if header[4:8] == b'ftyp':
            return "audio/mp4", None
        
        # Default: assume webm from browser MediaRecorder
        logger.debug(f"Unknown audio header: {header[:8].hex()}, assuming webm")
        return "audio/webm", None

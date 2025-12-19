import uuid
import json
import base64
import time
from typing import Dict, Any, Optional
from fastapi import WebSocket
from loguru import logger

from app.services.stt_service import STTService
from app.services.llm_service import LLMService
from app.services.tts_service import TTSService
from app.services.audit_service import audit_service
from app.schemas.agent import AgentActionPlan, AgentStep


class AgentOrchestrator:
    def __init__(self):
        self.stt = STTService()
        self.llm = LLMService()
        self.tts = TTSService()
        self.user_contexts: Dict[str, dict] = {}
        self.audio_buffers: Dict[str, bytearray] = {}
        self.pending_audits: Dict[str, uuid.UUID] = {}  # plan_id -> audit_id

    async def handle_audio_chunk(self, ws: WebSocket, user_id: str, audio_bytes: bytes):
        """Accumulate audio chunks from client"""
        if user_id not in self.audio_buffers:
            self.audio_buffers[user_id] = bytearray()
        self.audio_buffers[user_id].extend(audio_bytes)
        logger.debug(f"Audio buffer for {user_id}: {len(self.audio_buffers[user_id])} bytes")

    async def handle_context_update(self, ws: WebSocket, user_id: str, payload: dict):
        """Update UI context for user"""
        self.user_contexts[user_id] = payload
        logger.debug(f"Context updated for {user_id}: {payload.get('url')}")

    async def handle_execution_result(self, ws: WebSocket, user_id: str, payload: dict):
        """Handle result after frontend executes an action plan"""
        plan_id = payload.get("plan_id")
        status = payload.get("status")
        error = payload.get("error")
        
        # Update audit log with result
        if plan_id and plan_id in self.pending_audits:
            audit_id = self.pending_audits.pop(plan_id)
            await audit_service.update_result(
                audit_id=audit_id,
                result=status,
                error=error,
            )

        if status == "success":
            text = "Done. What else can I help you with?"
        else:
            text = f"Sorry, something went wrong: {error}"

        await self._speak_to_client(ws, text)

    async def process_command(self, ws: WebSocket, user_id: str, transcript: str):
        """Process a voice command: generate plan and speak response"""
        context = self.user_contexts.get(user_id, {})
        start_time = time.time()
        
        logger.info(f"Processing command from {user_id}: '{transcript}'")
        
        try:
            # Try LLM first
            plan = await self.llm.generate_action_plan(transcript, context)
            logger.info(f"LLM generated plan with {len(plan.steps)} steps")
        except Exception as e:
            logger.warning(f"LLM failed, using keyword fallback: {e}")
            plan = self.llm.create_simple_plan(transcript)
        
        # Log command to audit trail
        try:
            audit_id = await audit_service.log_command(
                user_id=uuid.UUID(user_id),
                command_text=transcript,
                action_json=plan.model_dump(),
                result="dispatched",
                metadata={
                    "context_url": context.get("url"),
                    "step_count": len(plan.steps),
                    "llm_time_ms": int((time.time() - start_time) * 1000),
                },
            )
            # Track for later result update
            self.pending_audits[str(plan.plan_id)] = audit_id
        except Exception as e:
            logger.error(f"Failed to create audit log: {e}")

        # Speak acknowledgement FIRST (before navigation)
        speak_text = self._get_acknowledgement(plan)
        if speak_text:
            await self._speak_to_client(ws, speak_text)

        # Send action plan to frontend (may trigger navigation which closes WebSocket)
        await ws.send_json({
            "type": "ACTION_DISPATCH",
            "payload": plan.model_dump(),
        })

    async def _speak_to_client(self, ws: WebSocket, text: str):
        """Generate TTS audio and send to client"""
        try:
            # Try TTS first
            try:
                audio_bytes = await self.tts.synthesize(text)
                if audio_bytes:
                    audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
                    await ws.send_json({
                        "type": "AGENT_SPEAK",
                        "payload": {
                            "audio_base64": audio_base64,
                            "text": text,
                            "mime_type": "audio/mpeg",
                        },
                    })
                    logger.info(f"Sent TTS audio ({len(audio_bytes)} bytes) for: '{text[:50]}...'")
                    return
            except Exception as tts_err:
                logger.warning(f"TTS failed, sending text-only: {tts_err}")
            
            # Fallback to text-only (frontend can use browser TTS)
            await ws.send_json({
                "type": "AGENT_SPEAK",
                "payload": {"text": text, "audio_base64": None, "use_browser_tts": True},
            })
        except Exception as e:
            logger.error(f"Failed to send speak message: {e}")

    def _get_acknowledgement(self, plan: AgentActionPlan) -> Optional[str]:
        """Extract speak text from plan"""
        for step in plan.steps:
            if step.kind == "speak":
                return step.text
        return None

    async def finalize_audio(self, ws: WebSocket, user_id: str):
        """Process accumulated audio buffer"""
        audio_data = bytes(self.audio_buffers.pop(user_id, bytearray()))
        if not audio_data or len(audio_data) < 100:
            logger.warning(f"No/insufficient audio data for {user_id}: {len(audio_data) if audio_data else 0} bytes")
            return

        logger.info(f"Processing {len(audio_data)} bytes of audio for {user_id}")
        
        # Log first few bytes for debugging
        logger.debug(f"Audio header: {audio_data[:20].hex()}")
        
        try:
            transcript = await self.stt.transcribe(audio_data)
            if transcript:
                logger.info(f"STT transcript: '{transcript}'")
                await self.process_command(ws, user_id, transcript)
            else:
                await self._safe_speak(ws, "Sorry, I didn't catch that. Please try again.")
        except Exception as e:
            logger.error(f"Audio processing failed: {e}")
            await self._safe_speak(ws, "Sorry, there was an error. Please try again.")

    async def _safe_speak(self, ws: WebSocket, text: str):
        """Safely try to speak, ignoring WebSocket errors"""
        try:
            await self._speak_to_client(ws, text)
        except Exception as e:
            logger.warning(f"Could not send speak message (client may have disconnected): {e}")

    async def handle_text_command(self, ws: WebSocket, user_id: str, text: str):
        """Handle text-based command (for testing without voice)"""
        logger.info(f"Text command from {user_id}: '{text}'")
        await self.process_command(ws, user_id, text)

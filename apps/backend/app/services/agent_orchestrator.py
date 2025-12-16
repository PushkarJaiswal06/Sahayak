import uuid
import json
from typing import Dict, Any, Optional
from fastapi import WebSocket
from loguru import logger

from app.services.stt_service import STTService
from app.services.llm_service import LLMService
from app.services.tts_service import TTSService
from app.schemas.agent import AgentActionPlan, AgentStep


class AgentOrchestrator:
    def __init__(self):
        self.stt = STTService()
        self.llm = LLMService()
        self.tts = TTSService()
        self.user_contexts: Dict[str, dict] = {}
        self.audio_buffers: Dict[str, bytes] = {}

    async def handle_audio_chunk(self, ws: WebSocket, user_id: str, audio_bytes: bytes):
        if user_id not in self.audio_buffers:
            self.audio_buffers[user_id] = b""
        self.audio_buffers[user_id] += audio_bytes

        # For streaming, would send chunks to Deepgram; here we accumulate.
        # After silence detection or end marker, process full audio.

    async def handle_context_update(self, ws: WebSocket, user_id: str, payload: dict):
        self.user_contexts[user_id] = payload
        logger.debug(f"Context updated for {user_id}: {payload.get('url')}")

    async def handle_execution_result(self, ws: WebSocket, user_id: str, payload: dict):
        plan_id = payload.get("plan_id")
        status = payload.get("status")
        error = payload.get("error")

        if status == "success":
            text = "Done. What else can I help you with?"
        else:
            text = f"Sorry, something went wrong: {error}"

        audio_url = await self.tts.synthesize(text)
        await ws.send_json({
            "type": "AGENT_SPEAK",
            "payload": {"audio_url": audio_url, "text": text},
        })

    async def process_command(self, ws: WebSocket, user_id: str, transcript: str):
        context = self.user_contexts.get(user_id, {})

        plan = await self.llm.generate_action_plan(transcript, context)

        await ws.send_json({
            "type": "ACTION_DISPATCH",
            "payload": plan.model_dump(),
        })

        # Also speak acknowledgement
        speak_text = self._get_acknowledgement(plan)
        if speak_text:
            audio_url = await self.tts.synthesize(speak_text)
            await ws.send_json({
                "type": "AGENT_SPEAK",
                "payload": {"audio_url": audio_url, "text": speak_text},
            })

    def _get_acknowledgement(self, plan: AgentActionPlan) -> Optional[str]:
        for step in plan.steps:
            if step.kind == "speak":
                return step.text
        return None

    async def finalize_audio(self, ws: WebSocket, user_id: str):
        audio_data = self.audio_buffers.pop(user_id, b"")
        if not audio_data:
            return

        transcript = await self.stt.transcribe(audio_data)
        if transcript:
            await self.process_command(ws, user_id, transcript)

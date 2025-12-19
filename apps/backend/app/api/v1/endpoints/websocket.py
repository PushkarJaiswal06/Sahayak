import uuid
import json
import base64
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.orm import Session
from loguru import logger

from app.db.session import get_db
from app.core.security import decode_token
from app.models.user import User
from app.models.audit_log import AuditLog
from app.websockets.manager import ConnectionManager
from app.services.agent_orchestrator import AgentOrchestrator

router = APIRouter()
manager = ConnectionManager()
orchestrator = AgentOrchestrator()


@router.websocket("/ws/agent/v1")
async def agent_websocket(
    websocket: WebSocket,
    auth_token: str = Query(...),
):
    payload = decode_token(auth_token)
    if not payload:
        await websocket.close(code=4001)
        return

    user_id = payload.get("sub")
    await manager.connect(websocket, user_id)
    logger.info(f"WebSocket connected for user {user_id}")

    try:
        while True:
            try:
                data = await websocket.receive()
            except RuntimeError as e:
                # Handle "Cannot call receive once disconnect received"
                logger.debug(f"WebSocket receive error (likely navigation): {e}")
                break

            if "bytes" in data:
                # AUDIO_CHUNK binary frame
                audio_bytes = data["bytes"]
                await orchestrator.handle_audio_chunk(websocket, user_id, audio_bytes)

            elif "text" in data:
                # JSON message
                msg = json.loads(data["text"])
                msg_type = msg.get("type")
                payload_data = msg.get("payload", {})

                if msg_type == "CONTEXT_UPDATE":
                    await orchestrator.handle_context_update(websocket, user_id, payload_data)

                elif msg_type == "EXECUTION_RESULT":
                    await orchestrator.handle_execution_result(websocket, user_id, payload_data)

                elif msg_type == "AUDIO_END":
                    # Client signals end of audio recording
                    logger.info(f"Audio end signal from {user_id}")
                    await orchestrator.finalize_audio(websocket, user_id)

                elif msg_type == "TEXT_COMMAND":
                    # Text-based command for testing without voice
                    text = payload_data.get("text", "")
                    if text:
                        await orchestrator.handle_text_command(websocket, user_id, text)

                elif msg_type == "AUDIO_CHUNK_BASE64":
                    # Base64 encoded audio chunk (for browsers that can't send binary)
                    audio_b64 = payload_data.get("audio", "")
                    if audio_b64:
                        audio_bytes = base64.b64decode(audio_b64)
                        await orchestrator.handle_audio_chunk(websocket, user_id, audio_bytes)

    except WebSocketDisconnect:
        logger.info(f"User {user_id} disconnected (navigation or close)")
    except Exception as e:
        logger.warning(f"WebSocket closed for user {user_id}: {type(e).__name__}")
    finally:
        manager.disconnect(user_id)

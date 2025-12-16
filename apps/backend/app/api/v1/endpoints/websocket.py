import uuid
import json
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

    try:
        while True:
            data = await websocket.receive()

            if "bytes" in data:
                # AUDIO_CHUNK binary frame
                audio_bytes = data["bytes"]
                await orchestrator.handle_audio_chunk(websocket, user_id, audio_bytes)

            elif "text" in data:
                # JSON message
                msg = json.loads(data["text"])
                msg_type = msg.get("type")

                if msg_type == "CONTEXT_UPDATE":
                    await orchestrator.handle_context_update(websocket, user_id, msg.get("payload", {}))

                elif msg_type == "EXECUTION_RESULT":
                    await orchestrator.handle_execution_result(websocket, user_id, msg.get("payload", {}))

    except WebSocketDisconnect:
        manager.disconnect(user_id)
        logger.info(f"User {user_id} disconnected")
    except Exception as e:
        logger.exception(f"WebSocket error for user {user_id}: {e}")
        manager.disconnect(user_id)

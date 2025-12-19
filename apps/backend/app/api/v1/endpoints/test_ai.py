from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from app.services.stt_service import STTService
from app.services.llm_service import LLMService
from app.services.tts_service import TTSService

router = APIRouter(prefix="/test-ai", tags=["testing"])


class TextCommand(BaseModel):
    text: str


@router.get("/status")
async def ai_services_status():
    """Check if AI services are configured"""
    stt = STTService()
    llm = LLMService()
    tts = TTSService()
    
    return {
        "deepgram": {
            "configured": bool(stt.api_key),
            "key_prefix": stt.api_key[:8] + "..." if stt.api_key else "NOT SET"
        },
        "groq": {
            "configured": bool(llm.api_key),
            "model": llm.model,
            "key_prefix": llm.api_key[:8] + "..." if llm.api_key else "NOT SET"
        },
        "elevenlabs": {
            "configured": bool(tts.api_key),
            "voice_id": tts.voice_id,
            "key_prefix": tts.api_key[:8] + "..." if tts.api_key else "NOT SET"
        }
    }


@router.post("/llm")
async def test_llm(command: TextCommand):
    """Test LLM plan generation"""
    llm = LLMService()
    context = {"url": "/dashboard", "aria_ids": []}
    
    try:
        plan = await llm.generate_action_plan(command.text, context)
        return {
            "success": True,
            "command": command.text,
            "plan": plan.model_dump()
        }
    except Exception as e:
        # Try fallback
        plan = llm.create_simple_plan(command.text)
        return {
            "success": False,
            "error": str(e),
            "command": command.text,
            "fallback_plan": plan.model_dump()
        }


@router.post("/tts")
async def test_tts(command: TextCommand):
    """Test TTS audio generation"""
    tts = TTSService()
    
    try:
        audio_bytes = await tts.synthesize(command.text)
        return Response(content=audio_bytes, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/fallback-plan")
async def test_fallback_plan(command: TextCommand):
    """Test keyword-based fallback plan"""
    llm = LLMService()
    plan = llm.create_simple_plan(command.text)
    return {
        "command": command.text,
        "plan": plan.model_dump()
    }

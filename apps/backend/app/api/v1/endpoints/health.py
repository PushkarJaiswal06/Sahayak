from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger
import redis.asyncio as redis
import httpx

from app.db.session import get_db
from app.core.config import settings

router = APIRouter()


async def check_postgres(db: AsyncSession) -> dict:
    """Check PostgreSQL connectivity"""
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "healthy", "latency_ms": 0}
    except Exception as e:
        logger.error(f"PostgreSQL health check failed: {e}")
        return {"status": "unhealthy", "error": str(e)}


async def check_redis() -> dict:
    """Check Redis connectivity"""
    try:
        r = redis.from_url(f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}")
        await r.ping()
        await r.aclose()
        return {"status": "healthy"}
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        return {"status": "unhealthy", "error": str(e)}


async def check_deepgram() -> dict:
    """Check Deepgram API connectivity"""
    if not settings.DEEPGRAM_API_KEY:
        return {"status": "unconfigured"}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                "https://api.deepgram.com/v1/projects",
                headers={"Authorization": f"Token {settings.DEEPGRAM_API_KEY}"}
            )
            if resp.status_code in (200, 401, 403):  # API is reachable
                return {"status": "healthy"}
            return {"status": "degraded", "code": resp.status_code}
    except Exception as e:
        return {"status": "unreachable", "error": str(e)}


async def check_groq() -> dict:
    """Check Groq API connectivity"""
    if not settings.GROQ_API_KEY:
        return {"status": "unconfigured"}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                "https://api.groq.com/openai/v1/models",
                headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"}
            )
            if resp.status_code in (200, 401, 403):
                return {"status": "healthy"}
            return {"status": "degraded", "code": resp.status_code}
    except Exception as e:
        return {"status": "unreachable", "error": str(e)}


@router.get("/healthz")
async def healthz():
    """Liveness probe - basic check that app is running"""
    return {"status": "ok"}


@router.get("/readyz")
async def readyz(db: AsyncSession = Depends(get_db)):
    """Readiness probe - checks all dependencies"""
    postgres = await check_postgres(db)
    redis_status = await check_redis()
    deepgram = await check_deepgram()
    groq = await check_groq()
    
    checks = {
        "postgres": postgres,
        "redis": redis_status,
        "deepgram": deepgram,
        "groq": groq,
    }
    
    # Overall status
    critical_healthy = (
        postgres.get("status") == "healthy" and 
        redis_status.get("status") == "healthy"
    )
    
    return {
        "status": "ready" if critical_healthy else "not_ready",
        "checks": checks,
        "version": settings.VERSION,
    }


@router.get("/health")
async def health_detailed(db: AsyncSession = Depends(get_db)):
    """Detailed health check for monitoring"""
    postgres = await check_postgres(db)
    redis_status = await check_redis()
    deepgram = await check_deepgram()
    groq = await check_groq()
    
    all_healthy = all(
        c.get("status") in ("healthy", "unconfigured")
        for c in [postgres, redis_status, deepgram, groq]
    )
    
    return {
        "status": "healthy" if all_healthy else "degraded",
        "environment": settings.ENVIRONMENT,
        "version": settings.VERSION,
        "services": {
            "postgres": postgres,
            "redis": redis_status,
            "deepgram": deepgram,
            "groq": groq,
        }
    }

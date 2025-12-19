from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.api.v1.router import api_router
from app.api.v1.endpoints.websocket import router as ws_router
from app.core.config import settings
from app.core.middleware import SecurityHeadersMiddleware, RateLimitMiddleware
from app.core.logging import RequestLoggingMiddleware, setup_logging

# Initialize logging
setup_logging()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
)

# Middleware order matters (last added = first executed)
# 1. Request logging (outermost - logs everything)
app.add_middleware(RequestLoggingMiddleware)

# 2. Security headers
app.add_middleware(SecurityHeadersMiddleware)

# 3. Rate limiting
app.add_middleware(RateLimitMiddleware, requests_per_minute=100, burst=20)

# 4. CORS (innermost for API requests)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(ws_router)


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "environment": settings.ENVIRONMENT,
        "version": settings.VERSION,
    }


@app.on_event("startup")
async def on_startup() -> None:
    logger.info("Application startup")


@app.on_event("shutdown")
async def on_shutdown() -> None:
    logger.info("Application shutdown")

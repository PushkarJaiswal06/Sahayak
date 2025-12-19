"""
Logging configuration for production
- Structured JSON logging
- Request ID tracking
- PII redaction
"""
import sys
import re
import uuid
from contextvars import ContextVar
from typing import Any
from loguru import logger
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings

# Context variable for request ID
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="")

# PII patterns to redact
PII_PATTERNS = [
    (re.compile(r'\b\d{10,12}\b'), '[PHONE_REDACTED]'),  # Phone numbers
    (re.compile(r'\b\d{12}\b'), '[AADHAAR_REDACTED]'),  # Aadhaar
    (re.compile(r'\b[A-Z]{5}\d{4}[A-Z]\b'), '[PAN_REDACTED]'),  # PAN
    (re.compile(r'\b\d{9,18}\b'), '[ACCOUNT_REDACTED]'),  # Account numbers
    (re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'), '[EMAIL_REDACTED]'),
    (re.compile(r'password["\']?\s*[:=]\s*["\']?[^"\'&\s]+', re.IGNORECASE), 'password=[REDACTED]'),
    (re.compile(r'token["\']?\s*[:=]\s*["\']?[A-Za-z0-9._-]+', re.IGNORECASE), 'token=[REDACTED]'),
    (re.compile(r'api[_-]?key["\']?\s*[:=]\s*["\']?[A-Za-z0-9._-]+', re.IGNORECASE), 'api_key=[REDACTED]'),
]

# Sensitive fields to redact in structured logs
SENSITIVE_FIELDS = {
    'password', 'token', 'access_token', 'refresh_token', 'api_key',
    'secret', 'authorization', 'phone', 'email', 'aadhaar', 'pan',
    'account_number', 'ifsc', 'card_number', 'cvv', 'pin'
}


def redact_pii(message: str) -> str:
    """Redact PII from log messages"""
    for pattern, replacement in PII_PATTERNS:
        message = pattern.sub(replacement, message)
    return message


def redact_dict(data: Any, depth: int = 0) -> Any:
    """Recursively redact sensitive fields from dictionaries"""
    if depth > 10:  # Prevent infinite recursion
        return data
    
    if isinstance(data, dict):
        return {
            k: '[REDACTED]' if k.lower() in SENSITIVE_FIELDS else redact_dict(v, depth + 1)
            for k, v in data.items()
        }
    elif isinstance(data, list):
        return [redact_dict(item, depth + 1) for item in data]
    elif isinstance(data, str):
        return redact_pii(data)
    return data


def json_formatter(record: dict) -> str:
    """Format log record as JSON"""
    import json
    from datetime import datetime
    
    log_record = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "level": record["level"].name,
        "message": redact_pii(record["message"]),
        "logger": record["name"],
        "function": record["function"],
        "line": record["line"],
    }
    
    # Add request ID if available
    req_id = request_id_ctx.get()
    if req_id:
        log_record["request_id"] = req_id
    
    # Add extra fields (redacted)
    if record.get("extra"):
        extra = redact_dict(record["extra"])
        # Don't include internal loguru extras
        extra.pop("request_id", None)
        if extra:
            log_record["extra"] = extra
    
    # Add exception info if present
    if record["exception"]:
        log_record["exception"] = {
            "type": record["exception"].type.__name__ if record["exception"].type else None,
            "value": redact_pii(str(record["exception"].value)) if record["exception"].value else None,
            "traceback": record["exception"].traceback is not None,
        }
    
    return json.dumps(log_record) + "\n"


def setup_logging():
    """Configure logging based on environment"""
    # Remove default handler
    logger.remove()
    
    def dev_format(record):
        """Development format with optional request_id"""
        req_id = request_id_ctx.get()
        req_id_part = f"{req_id} | " if req_id else ""
        return (
            "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
            f"{req_id_part}"
            "<level>{message}</level>\n"
        )
    
    if settings.ENVIRONMENT == "production":
        # Production: JSON format to stdout
        logger.add(
            sys.stdout,
            format=json_formatter,
            level="INFO",
            serialize=False,
        )
    else:
        # Development: human-readable format
        logger.add(
            sys.stdout,
            format=dev_format,
            level="DEBUG",
            colorize=True,
        )
    
    # Also log to file in production
    if settings.ENVIRONMENT == "production":
        logger.add(
            "/var/log/sahayak/app.log",
            format=json_formatter,
            level="INFO",
            rotation="100 MB",
            retention="30 days",
            compression="gz",
            serialize=False,
        )


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log requests and add request IDs"""
    
    async def dispatch(self, request: Request, call_next):
        # Generate or extract request ID
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4())[:8])
        request_id_ctx.set(request_id)
        
        # Log request start
        logger.bind(request_id=request_id).info(
            f"Request started: {request.method} {request.url.path}",
            extra={
                "method": request.method,
                "path": request.url.path,
                "client_ip": request.client.host if request.client else "unknown",
            }
        )
        
        import time
        start_time = time.time()
        
        try:
            response = await call_next(request)
            
            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id
            
            # Log request completion
            duration_ms = (time.time() - start_time) * 1000
            logger.bind(request_id=request_id).info(
                f"Request completed: {request.method} {request.url.path} - {response.status_code}",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "duration_ms": round(duration_ms, 2),
                }
            )
            
            return response
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            logger.bind(request_id=request_id).exception(
                f"Request failed: {request.method} {request.url.path}",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": round(duration_ms, 2),
                    "error": str(e),
                }
            )
            raise


# Initialize logging on import
setup_logging()

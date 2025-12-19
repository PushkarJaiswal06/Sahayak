"""
Security middleware for production hardening
- Security headers (HSTS, CSP, X-Frame-Options, etc.)
- Rate limiting using Redis
"""
import time
from typing import Callable, Optional
from fastapi import Request, Response, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
import redis.asyncio as redis
from loguru import logger

from app.core.config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        
        # Strict Transport Security (HTTPS only)
        if settings.ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        
        # Prevent MIME sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # XSS Protection (legacy browsers)
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Permissions Policy (disable unnecessary APIs)
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(self), camera=(), payment=()"
        )
        
        # Content Security Policy (adjust as needed)
        if settings.ENVIRONMENT == "production":
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https:; "
                "connect-src 'self' wss: https://api.deepgram.com https://api.groq.com; "
                "font-src 'self'; "
                "frame-ancestors 'none';"
            )
        
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Redis-based rate limiting middleware"""
    
    def __init__(self, app, requests_per_minute: int = 60, burst: int = 10):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.burst = burst
        self.redis_client: Optional[redis.Redis] = None
    
    async def get_redis(self) -> redis.Redis:
        if self.redis_client is None:
            self.redis_client = redis.from_url(
                f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}",
                decode_responses=True
            )
        return self.redis_client
    
    def get_client_ip(self, request: Request) -> str:
        """Extract client IP from request, considering proxies"""
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip rate limiting for health checks
        if request.url.path in ("/health", "/api/v1/healthz", "/api/v1/readyz"):
            return await call_next(request)
        
        # Skip in development
        if settings.ENVIRONMENT == "development":
            return await call_next(request)
        
        client_ip = self.get_client_ip(request)
        key = f"rate_limit:{client_ip}"
        
        try:
            r = await self.get_redis()
            
            # Sliding window rate limiting
            now = time.time()
            window_start = now - 60  # 1 minute window
            
            pipe = r.pipeline()
            # Remove old entries
            pipe.zremrangebyscore(key, 0, window_start)
            # Count current requests
            pipe.zcard(key)
            # Add current request
            pipe.zadd(key, {str(now): now})
            # Set expiry
            pipe.expire(key, 60)
            
            results = await pipe.execute()
            request_count = results[1]
            
            # Check limit
            if request_count >= self.requests_per_minute:
                logger.warning(f"Rate limit exceeded for {client_ip}: {request_count} requests")
                raise HTTPException(
                    status_code=429,
                    detail="Too many requests. Please slow down.",
                    headers={"Retry-After": "60"}
                )
            
            response = await call_next(request)
            
            # Add rate limit headers
            response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
            response.headers["X-RateLimit-Remaining"] = str(max(0, self.requests_per_minute - request_count - 1))
            response.headers["X-RateLimit-Reset"] = str(int(now + 60))
            
            return response
            
        except redis.RedisError as e:
            # Log but don't fail if Redis is down
            logger.error(f"Rate limit Redis error: {e}")
            return await call_next(request)


class WebSocketRateLimiter:
    """Rate limiter specifically for WebSocket connections"""
    
    def __init__(
        self,
        connections_per_minute: int = 10,
        messages_per_second: int = 5
    ):
        self.connections_per_minute = connections_per_minute
        self.messages_per_second = messages_per_second
        self.redis_client: Optional[redis.Redis] = None
    
    async def get_redis(self) -> redis.Redis:
        if self.redis_client is None:
            self.redis_client = redis.from_url(
                f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}",
                decode_responses=True
            )
        return self.redis_client
    
    async def check_connection_rate(self, user_id: str) -> bool:
        """Check if user can open a new WebSocket connection"""
        if settings.ENVIRONMENT == "development":
            return True
            
        try:
            r = await self.get_redis()
            key = f"ws_conn_rate:{user_id}"
            
            count = await r.incr(key)
            if count == 1:
                await r.expire(key, 60)
            
            if count > self.connections_per_minute:
                logger.warning(f"WebSocket connection rate exceeded for user {user_id}")
                return False
            return True
            
        except redis.RedisError as e:
            logger.error(f"WebSocket rate limit error: {e}")
            return True  # Fail open
    
    async def check_message_rate(self, user_id: str) -> bool:
        """Check if user can send another message"""
        if settings.ENVIRONMENT == "development":
            return True
            
        try:
            r = await self.get_redis()
            key = f"ws_msg_rate:{user_id}"
            
            count = await r.incr(key)
            if count == 1:
                await r.expire(key, 1)
            
            if count > self.messages_per_second:
                return False
            return True
            
        except redis.RedisError as e:
            logger.error(f"WebSocket message rate limit error: {e}")
            return True


# Singleton instance for WebSocket rate limiting
ws_rate_limiter = WebSocketRateLimiter()

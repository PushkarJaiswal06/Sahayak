from fastapi import APIRouter

from app.api.v1.endpoints import health, auth, banking, bills, admin

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(banking.router)
api_router.include_router(bills.router)
api_router.include_router(admin.router)

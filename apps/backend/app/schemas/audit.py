from datetime import datetime
from typing import Optional, Any
from uuid import UUID
from pydantic import BaseModel


class AuditLogOut(BaseModel):
    id: UUID
    user_id: Optional[UUID] = None
    command_text: Optional[str] = None
    action_json: Optional[Any] = None
    result: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

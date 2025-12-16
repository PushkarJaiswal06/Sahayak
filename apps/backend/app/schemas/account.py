from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class AccountBase(BaseModel):
    type: str = "SAVINGS"


class AccountCreate(AccountBase):
    pass


class AccountOut(AccountBase):
    id: UUID
    user_id: UUID
    balance_cents: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class AccountBalance(BaseModel):
    id: UUID
    type: str
    balance: float
    status: str

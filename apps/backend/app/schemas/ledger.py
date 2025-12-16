from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class LedgerEntry(BaseModel):
    id: UUID
    account_id: UUID
    amount_cents: int
    counterparty: Optional[str] = None
    narration: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TransferRequest(BaseModel):
    beneficiary_id: UUID
    amount_cents: int
    mode: str = "IMPS"
    narration: Optional[str] = None


class TransferResponse(BaseModel):
    success: bool
    transaction_id: UUID
    message: str

from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class LedgerEntry(BaseModel):
    id: UUID
    account_id: UUID
    amount_cents: int
    type: str = "TRANSFER"
    counterparty: Optional[str] = None
    narration: Optional[str] = None
    reference_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TransferRequest(BaseModel):
    beneficiary_id: UUID
    amount_cents: int
    mode: str = "IMPS"
    narration: Optional[str] = None
    confirmed: bool = False  # For high-value transactions


class TransferResponse(BaseModel):
    success: bool
    transaction_id: Optional[UUID] = None
    message: str
    requires_confirmation: bool = False
    amount: Optional[float] = None  # Amount in rupees for confirmation dialog

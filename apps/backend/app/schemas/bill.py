from typing import Optional, List, Any
from pydantic import BaseModel


class BillCategory(BaseModel):
    id: str
    name: str
    icon: str


class BillFetchRequest(BaseModel):
    category: str
    consumer_id: str


class BillDetails(BaseModel):
    consumer_id: str
    consumer_name: str
    amount_cents: int
    due_date: str
    provider: str


class BillPayRequest(BaseModel):
    category: str
    consumer_id: str
    amount_cents: int


class BillPayResponse(BaseModel):
    success: bool
    transaction_id: str
    message: str

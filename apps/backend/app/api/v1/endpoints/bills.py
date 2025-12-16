import uuid
from typing import List
from fastapi import APIRouter, HTTPException

from app.schemas.bill import BillCategory, BillFetchRequest, BillDetails, BillPayRequest, BillPayResponse

router = APIRouter(prefix="/bills", tags=["bills"])

CATEGORIES = [
    BillCategory(id="electricity", name="Electricity", icon="⚡"),
    BillCategory(id="water", name="Water", icon="💧"),
    BillCategory(id="gas", name="Gas", icon="🔥"),
    BillCategory(id="broadband", name="Broadband", icon="📶"),
]


@router.get("/categories", response_model=List[BillCategory])
def get_categories():
    return CATEGORIES


@router.post("/fetch", response_model=BillDetails)
def fetch_bill(payload: BillFetchRequest):
    # Simulated bill fetch
    return BillDetails(
        consumer_id=payload.consumer_id,
        consumer_name="Ram Lal",
        amount_cents=125000,
        due_date="2025-12-25",
        provider=f"{payload.category.title()} Provider",
    )


@router.post("/pay", response_model=BillPayResponse)
def pay_bill(payload: BillPayRequest):
    # Simulated bill payment
    if payload.amount_cents <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")
    txn_id = str(uuid.uuid4())
    return BillPayResponse(success=True, transaction_id=txn_id, message="Bill paid successfully")

import uuid
from datetime import datetime, timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from loguru import logger

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.account import Account
from app.models.ledger import Ledger
from app.models.beneficiary import Beneficiary
from app.schemas.account import AccountOut, AccountBalance
from app.schemas.ledger import LedgerEntry, TransferRequest, TransferResponse
from app.schemas.beneficiary import BeneficiaryCreate, BeneficiaryOut
from app.core.config import settings

router = APIRouter(tags=["banking"])

# Transaction limits (in cents)
SINGLE_TRANSACTION_LIMIT = 100_000_00  # ₹1,00,000 per transaction
DAILY_LIMIT_CENTS = 500_000_00          # ₹5,00,000 per day
HIGH_VALUE_THRESHOLD = 50_000_00        # ₹50,000 requires confirmation


async def get_daily_spent(db: Session, user_id: uuid.UUID) -> int:
    """Calculate total outgoing transfers for today"""
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    account_ids = [a.id for a in db.query(Account).filter(Account.user_id == user_id).all()]
    if not account_ids:
        return 0
    
    daily_total = db.query(func.sum(func.abs(Ledger.amount_cents))).filter(
        Ledger.account_id.in_(account_ids),
        Ledger.amount_cents < 0,  # Only outgoing
        Ledger.created_at >= today_start
    ).scalar() or 0
    
    return daily_total


@router.get("/accounts", response_model=List[AccountBalance])
def list_accounts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    accounts = db.query(Account).filter(Account.user_id == user.id).all()
    return [
        AccountBalance(
            id=a.id,
            type=a.type.value,
            account_number=a.account_number,
            balance=a.balance_cents / 100,
            status=a.status,
        )
        for a in accounts
    ]


@router.get("/ledger", response_model=List[LedgerEntry])
def list_transactions(
    limit: int = Query(5, le=50),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    account_ids = [a.id for a in db.query(Account).filter(Account.user_id == user.id).all()]
    if not account_ids:
        return []
    entries = (
        db.query(Ledger)
        .filter(Ledger.account_id.in_(account_ids))
        .order_by(Ledger.created_at.desc())
        .limit(limit)
        .all()
    )
    return entries


@router.post("/transfers", response_model=TransferResponse)
async def transfer(
    payload: TransferRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Execute a transfer to a beneficiary.
    
    Limits:
    - Single transaction: ₹1,00,000
    - Daily limit: ₹5,00,000
    - High-value threshold (requires confirmation): ₹50,000
    """
    if payload.amount_cents <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    # Check single transaction limit
    if payload.amount_cents > SINGLE_TRANSACTION_LIMIT:
        raise HTTPException(
            status_code=400, 
            detail=f"Transfer exceeds maximum single transaction limit of ₹{SINGLE_TRANSACTION_LIMIT // 100:,}"
        )
    
    # Check high-value transaction confirmation
    if payload.amount_cents >= HIGH_VALUE_THRESHOLD and not payload.confirmed:
        return TransferResponse(
            success=False,
            transaction_id=None,
            message="high_value_confirmation_required",
            requires_confirmation=True,
            amount=payload.amount_cents / 100,
        )
    
    # Check daily limit
    daily_spent = await get_daily_spent(db, user.id)
    if daily_spent + payload.amount_cents > DAILY_LIMIT_CENTS:
        remaining = max(0, DAILY_LIMIT_CENTS - daily_spent) / 100
        raise HTTPException(
            status_code=400, 
            detail=f"Transfer exceeds daily limit. Remaining today: ₹{remaining:,.2f}"
        )

    beneficiary = db.query(Beneficiary).filter(
        Beneficiary.id == payload.beneficiary_id, 
        Beneficiary.user_id == user.id
    ).first()
    if not beneficiary:
        raise HTTPException(status_code=404, detail="Beneficiary not found")

    account = db.query(Account).filter(
        Account.user_id == user.id, 
        Account.status == "ACTIVE"
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="No active account")

    if account.balance_cents < payload.amount_cents:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    # Execute transfer
    account.balance_cents -= payload.amount_cents
    ledger_entry = Ledger(
        id=uuid.uuid4(),
        account_id=account.id,
        amount_cents=-payload.amount_cents,
        counterparty=beneficiary.name,
        narration=payload.narration or f"{payload.mode} to {beneficiary.nickname}",
    )
    db.add(ledger_entry)
    db.commit()
    
    logger.info(
        f"Transfer completed: user={user.id}, amount={payload.amount_cents/100}, "
        f"beneficiary={beneficiary.nickname}, txn={ledger_entry.id}"
    )

    return TransferResponse(
        success=True, 
        transaction_id=ledger_entry.id, 
        message="Transfer successful",
        requires_confirmation=False,
    )


@router.get("/transfer-limits")
async def get_transfer_limits(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get user's current transfer limits and daily usage"""
    daily_spent = await get_daily_spent(db, user.id)
    
    return {
        "single_transaction_limit": SINGLE_TRANSACTION_LIMIT / 100,
        "daily_limit": DAILY_LIMIT_CENTS / 100,
        "high_value_threshold": HIGH_VALUE_THRESHOLD / 100,
        "daily_spent": daily_spent / 100,
        "daily_remaining": max(0, DAILY_LIMIT_CENTS - daily_spent) / 100,
    }


@router.get("/beneficiaries", response_model=List[BeneficiaryOut])
def list_beneficiaries(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Beneficiary).filter(Beneficiary.user_id == user.id).all()


@router.post("/beneficiaries", response_model=BeneficiaryOut, status_code=201)
def add_beneficiary(
    payload: BeneficiaryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ben = Beneficiary(
        id=uuid.uuid4(),
        user_id=user.id,
        nickname=payload.nickname,
        name=payload.name,
        account_number=payload.account_number,
        ifsc=payload.ifsc,
        bank_name=payload.bank_name,
    )
    db.add(ben)
    db.commit()
    db.refresh(ben)
    return ben

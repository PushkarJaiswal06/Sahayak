import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

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

DAILY_LIMIT_CENTS = 50_000_00


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
def transfer(
    payload: TransferRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if payload.amount_cents <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    if payload.amount_cents > DAILY_LIMIT_CENTS:
        raise HTTPException(status_code=400, detail="Transfer exceeds daily limit")

    beneficiary = db.query(Beneficiary).filter(Beneficiary.id == payload.beneficiary_id, Beneficiary.user_id == user.id).first()
    if not beneficiary:
        raise HTTPException(status_code=404, detail="Beneficiary not found")

    account = db.query(Account).filter(Account.user_id == user.id, Account.status == "ACTIVE").first()
    if not account:
        raise HTTPException(status_code=404, detail="No active account")

    if account.balance_cents < payload.amount_cents:
        raise HTTPException(status_code=400, detail="Insufficient balance")

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

    return TransferResponse(success=True, transaction_id=ledger_entry.id, message="Transfer successful")


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

from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class BeneficiaryBase(BaseModel):
    nickname: str
    name: str
    account_number: str
    ifsc: str


class BeneficiaryCreate(BeneficiaryBase):
    pass


class BeneficiaryOut(BeneficiaryBase):
    id: UUID
    user_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

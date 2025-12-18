import uuid
import enum
from sqlalchemy import Column, String, Enum, ForeignKey, BigInteger, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.base import Base


class AccountType(str, enum.Enum):
    SAVINGS = "SAVINGS"
    CURRENT = "CURRENT"


class Account(Base):
    __tablename__ = "accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_number = Column(String(20), unique=True, index=True, nullable=True)
    type = Column(Enum(AccountType, name="account_type"), nullable=False, default=AccountType.SAVINGS)
    balance_cents = Column(BigInteger, nullable=False, default=0)
    status = Column(String(32), nullable=False, default="ACTIVE")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", backref="accounts")
    transactions = relationship("Ledger", backref="account", cascade="all, delete-orphan")

"""initial tables

Revision ID: 001_initial
Revises: 
Create Date: 2025-12-16
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Users table
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("phone_number", sa.String(32), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("password_hash", sa.String(255), nullable=True),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column("role", sa.String(16), nullable=False, server_default="USER"),
        sa.Column("voice_print_id", sa.String(128), nullable=True),
        sa.Column("pii_encrypted", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_phone", "users", ["phone_number"], unique=True)
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # Accounts table
    op.create_table(
        "accounts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("account_number", sa.String(20), nullable=True),
        sa.Column("type", sa.String(16), nullable=False, server_default="SAVINGS"),
        sa.Column("balance_cents", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(32), nullable=False, server_default="ACTIVE"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_accounts_user_id", "accounts", ["user_id"])
    op.create_index("ix_accounts_account_number", "accounts", ["account_number"], unique=True)

    # Ledger table
    op.create_table(
        "ledger",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("account_id", UUID(as_uuid=True), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount_cents", sa.BigInteger(), nullable=False),
        sa.Column("type", sa.String(32), nullable=False, server_default="TRANSFER"),
        sa.Column("counterparty", sa.String(255), nullable=True),
        sa.Column("narration", sa.String(512), nullable=True),
        sa.Column("reference_id", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ledger_account_id", "ledger", ["account_id"])
    op.create_index("ix_ledger_reference_id", "ledger", ["reference_id"])

    # Beneficiaries table
    op.create_table(
        "beneficiaries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("nickname", sa.String(64), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("account_number", sa.String(64), nullable=False),
        sa.Column("ifsc", sa.String(32), nullable=False),
        sa.Column("bank_name", sa.String(128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_beneficiaries_user_id", "beneficiaries", ["user_id"])

    # Audit logs table
    op.create_table(
        "audit_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("command_text", sa.String(1024), nullable=True),
        sa.Column("action_json", JSONB(), nullable=True),
        sa.Column("result", sa.String(256), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("beneficiaries")
    op.drop_table("ledger")
    op.drop_table("accounts")
    op.drop_table("users")

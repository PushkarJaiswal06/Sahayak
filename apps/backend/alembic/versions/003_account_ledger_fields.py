"""add account_number and ledger type fields

Revision ID: 003_account_ledger_fields
Revises: 002_user_fields
Create Date: 2025-12-18
"""

from alembic import op
import sqlalchemy as sa

revision = "003_account_ledger_fields"
down_revision = "002_user_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("accounts", sa.Column("account_number", sa.String(length=20), nullable=True))
    op.create_index("ix_accounts_account_number", "accounts", ["account_number"], unique=True)
    
    op.add_column("ledger", sa.Column("type", sa.String(length=32), nullable=False, server_default="TRANSFER"))
    op.add_column("ledger", sa.Column("reference_id", sa.String(length=64), nullable=True))
    op.create_index("ix_ledger_reference_id", "ledger", ["reference_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_ledger_reference_id", table_name="ledger")
    op.drop_column("ledger", "reference_id")
    op.drop_column("ledger", "type")
    op.drop_index("ix_accounts_account_number", table_name="accounts")
    op.drop_column("accounts", "account_number")

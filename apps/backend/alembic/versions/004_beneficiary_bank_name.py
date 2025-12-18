"""add bank_name to beneficiaries

Revision ID: 004_beneficiary_bank_name
Revises: 003_account_ledger_fields
Create Date: 2025-12-18
"""

from alembic import op
import sqlalchemy as sa

revision = "004_beneficiary_bank_name"
down_revision = "003_account_ledger_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("beneficiaries", sa.Column("bank_name", sa.String(length=128), nullable=True))


def downgrade() -> None:
    op.drop_column("beneficiaries", "bank_name")

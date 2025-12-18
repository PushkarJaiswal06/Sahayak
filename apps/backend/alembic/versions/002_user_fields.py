"""add password_hash and full_name to users

Revision ID: 002_user_fields
Revises: 001_initial
Create Date: 2025-12-18
"""

from alembic import op
import sqlalchemy as sa

revision = "002_user_fields"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("password_hash", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("full_name", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))


def downgrade() -> None:
    op.drop_column("users", "updated_at")
    op.drop_column("users", "full_name")
    op.drop_column("users", "password_hash")

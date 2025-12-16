"""initial tables

Revision ID: 001_initial
Revises: 
Create Date: 2025-12-16
"""

from alembic import op
import sqlalchemy as sa
import sqlalchemy.dialects.postgresql as psql

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    user_role = sa.Enum("USER", "ADMIN", name="user_role")
    account_type = sa.Enum("SAVINGS", "CURRENT", name="account_type")

    user_role.create(op.get_bind(), checkfirst=True)
    account_type.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", psql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("phone_number", sa.String(length=32), nullable=True, unique=True),
        sa.Column("email", sa.String(length=255), nullable=True, unique=True),
        sa.Column("role", user_role, nullable=False, server_default="USER"),
        sa.Column("voice_print_id", sa.String(length=128), nullable=True),
        sa.Column("pii_encrypted", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "accounts",
        sa.Column("id", psql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", psql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", account_type, nullable=False, server_default="SAVINGS"),
        sa.Column("balance_cents", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="ACTIVE"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    op.create_table(
        "ledger",
        sa.Column("id", psql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("account_id", psql.UUID(as_uuid=True), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount_cents", sa.BigInteger(), nullable=False),
        sa.Column("counterparty", sa.String(length=255), nullable=True),
        sa.Column("narration", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "beneficiaries",
        sa.Column("id", psql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", psql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("nickname", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("account_number", sa.String(length=64), nullable=False),
        sa.Column("ifsc", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", psql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", psql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("command_text", sa.String(length=1024), nullable=True),
        sa.Column("action_json", psql.JSONB(), nullable=True),
        sa.Column("result", sa.String(length=256), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_index("ix_accounts_user_id", "accounts", ["user_id"], unique=False)
    op.create_index("ix_ledger_account_id", "ledger", ["account_id"], unique=False)
    op.create_index("ix_beneficiaries_user_id", "beneficiaries", ["user_id"], unique=False)
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"], unique=False)
    op.create_index("ix_users_phone", "users", ["phone_number"], unique=True)
    op.create_index("ix_users_email", "users", ["email"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_phone", table_name="users")
    op.drop_index("ix_audit_logs_user_id", table_name="audit_logs")
    op.drop_index("ix_beneficiaries_user_id", table_name="beneficiaries")
    op.drop_index("ix_ledger_account_id", table_name="ledger")
    op.drop_index("ix_accounts_user_id", table_name="accounts")

    op.drop_table("audit_logs")
    op.drop_table("beneficiaries")
    op.drop_table("ledger")
    op.drop_table("accounts")
    op.drop_table("users")

    op.execute("DROP TYPE IF EXISTS account_type")
    op.execute("DROP TYPE IF EXISTS user_role")

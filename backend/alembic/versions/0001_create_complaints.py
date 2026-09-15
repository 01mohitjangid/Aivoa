"""create complaints

Revision ID: 0001
Revises:
Create Date: 2026-09-15
"""

import sqlalchemy as sa

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "complaints",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending_triage"),
        sa.Column("complaint_source", sa.String(64)),
        sa.Column("customer_name", sa.String(255)),
        sa.Column("product_name", sa.String(255)),
        sa.Column("product_strength_grade", sa.String(128)),
        sa.Column("batch_lot_number", sa.String(64)),
        sa.Column("manufacturing_date", sa.Date()),
        sa.Column("expiry_date", sa.Date()),
        sa.Column("quantity_affected", sa.Numeric(12, 3)),
        sa.Column("quantity_unit", sa.String(16), nullable=False, server_default="kg"),
        sa.Column("complaint_type", sa.String(64)),
        sa.Column("complaint_date", sa.Date()),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("initial_severity", sa.String(16)),
        sa.Column("priority", sa.String(16)),
        sa.Column("source_text", sa.Text()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_complaints_batch_lot_number", "complaints", ["batch_lot_number"])


def downgrade() -> None:
    op.drop_index("ix_complaints_batch_lot_number", table_name="complaints")
    op.drop_table("complaints")

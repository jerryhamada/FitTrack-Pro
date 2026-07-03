"""add bodyweight_logs (client-owned weigh-ins)

Revision ID: a0b1c2d3e4f5
Revises: f8a9b0c1d2e3
Create Date: 2026-07-02 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'a0b1c2d3e4f5'
down_revision: Union[str, None] = 'f8a9b0c1d2e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# unit_enum already exists — never re-create it here.
unit_enum = postgresql.ENUM('lbs', 'kg', name='unit_enum', create_type=False)


def upgrade() -> None:
    op.create_table(
        'bodyweight_logs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('client_id', sa.Integer(), sa.ForeignKey('clients.id'), nullable=False),
        sa.Column('logged_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('weight', sa.Numeric(), nullable=False),
        sa.Column('unit', unit_enum, nullable=False),
    )
    op.create_index('ix_bodyweight_logs_client_id', 'bodyweight_logs', ['client_id'])


def downgrade() -> None:
    op.drop_index('ix_bodyweight_logs_client_id', table_name='bodyweight_logs')
    op.drop_table('bodyweight_logs')

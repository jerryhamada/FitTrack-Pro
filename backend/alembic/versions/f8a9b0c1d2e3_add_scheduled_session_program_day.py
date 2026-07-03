"""add scheduled_sessions.client_program_day_id (planned workout link)

Revision ID: f8a9b0c1d2e3
Revises: e7f8a9b0c1d2
Create Date: 2026-07-02 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f8a9b0c1d2e3'
down_revision: Union[str, None] = 'e7f8a9b0c1d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'scheduled_sessions',
        sa.Column('client_program_day_id', sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        'fk_scheduled_sessions_program_day',
        'scheduled_sessions',
        'client_program_days',
        ['client_program_day_id'],
        ['id'],
    )


def downgrade() -> None:
    op.drop_constraint('fk_scheduled_sessions_program_day', 'scheduled_sessions', type_='foreignkey')
    op.drop_column('scheduled_sessions', 'client_program_day_id')

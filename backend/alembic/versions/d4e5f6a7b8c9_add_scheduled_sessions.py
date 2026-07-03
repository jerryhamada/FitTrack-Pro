"""add scheduled_sessions table

Revision ID: d4e5f6a7b8c9
Revises: c3f4a5b6d7e8
Create Date: 2026-07-02 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3f4a5b6d7e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

scheduled_status = postgresql.ENUM('upcoming', 'completed', 'cancelled', name='scheduled_status_enum')
repeat_rule = postgresql.ENUM('weekly', 'biweekly', name='repeat_rule_enum')
# Column-side references must not re-emit CREATE TYPE — the explicit .create() above handles it.
scheduled_status_col = postgresql.ENUM(
    'upcoming', 'completed', 'cancelled', name='scheduled_status_enum', create_type=False
)
repeat_rule_col = postgresql.ENUM('weekly', 'biweekly', name='repeat_rule_enum', create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    scheduled_status.create(bind, checkfirst=True)
    repeat_rule.create(bind, checkfirst=True)

    op.create_table(
        'scheduled_sessions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('trainer_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('client_id', sa.Integer(), sa.ForeignKey('clients.id'), nullable=False),
        sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', scheduled_status_col, nullable=False, server_default='upcoming'),
        sa.Column('repeat_rule', repeat_rule_col, nullable=True),
        sa.Column('series_id', sa.String(), nullable=True),
        sa.Column('workout_session_id', sa.Integer(), sa.ForeignKey('sessions.id'), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_scheduled_sessions_trainer_time', 'scheduled_sessions', ['trainer_id', 'scheduled_at'])
    op.create_index('ix_scheduled_sessions_series_id', 'scheduled_sessions', ['series_id'])


def downgrade() -> None:
    op.drop_index('ix_scheduled_sessions_series_id', table_name='scheduled_sessions')
    op.drop_index('ix_scheduled_sessions_trainer_time', table_name='scheduled_sessions')
    op.drop_table('scheduled_sessions')
    scheduled_status.drop(op.get_bind(), checkfirst=True)
    repeat_rule.drop(op.get_bind(), checkfirst=True)

"""add session_exercises (per-session exercise membership + superset grouping)

Revision ID: b1c2d3e4f5a6
Revises: a0b1c2d3e4f5
Create Date: 2026-07-02 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = 'a0b1c2d3e4f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'session_exercises',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('session_id', sa.Integer(), sa.ForeignKey('sessions.id'), nullable=False),
        sa.Column('exercise_id', sa.Integer(), sa.ForeignKey('exercises.id'), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('superset_group_id', sa.String(), nullable=True),
        sa.Column('superset_order', sa.Integer(), nullable=True),
        sa.UniqueConstraint('session_id', 'exercise_id', name='uq_session_exercise'),
    )
    op.create_index('ix_session_exercises_session_id', 'session_exercises', ['session_id'])

    # Backfill membership from existing logged sets so past sessions render as
    # standalone exercises (order by first appearance).
    conn = op.get_bind()
    conn.execute(sa.text("""
        INSERT INTO session_exercises (session_id, exercise_id, order_index)
        SELECT session_id, exercise_id, ROW_NUMBER() OVER (
            PARTITION BY session_id ORDER BY MIN(order_index)
        ) - 1
        FROM sets
        GROUP BY session_id, exercise_id
    """))


def downgrade() -> None:
    op.drop_index('ix_session_exercises_session_id', table_name='session_exercises')
    op.drop_table('session_exercises')

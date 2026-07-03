"""add notifications table

Revision ID: e7f8a9b0c1d2
Revises: d4e5f6a7b8c9
Create Date: 2026-07-02 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e7f8a9b0c1d2'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

notif_type = postgresql.ENUM(
    'client_inactive', 'new_pr', 'session_reminder', 'missed_workout',
    name='notification_type_enum',
)
notif_type_col = postgresql.ENUM(
    'client_inactive', 'new_pr', 'session_reminder', 'missed_workout',
    name='notification_type_enum', create_type=False,
)


def upgrade() -> None:
    notif_type.create(op.get_bind(), checkfirst=True)
    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('trainer_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('type', notif_type_col, nullable=False),
        sa.Column('client_id', sa.Integer(), sa.ForeignKey('clients.id', ondelete='CASCADE'), nullable=True),
        sa.Column(
            'scheduled_session_id', sa.Integer(),
            sa.ForeignKey('scheduled_sessions.id', ondelete='CASCADE'), nullable=True,
        ),
        sa.Column(
            'workout_session_id', sa.Integer(),
            sa.ForeignKey('sessions.id', ondelete='SET NULL'), nullable=True,
        ),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('dedup_key', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('trainer_id', 'dedup_key', name='uq_notification_trainer_dedup'),
    )
    op.create_index(
        'ix_notifications_trainer_read', 'notifications', ['trainer_id', 'is_read', 'created_at']
    )


def downgrade() -> None:
    op.drop_index('ix_notifications_trainer_read', table_name='notifications')
    op.drop_table('notifications')
    notif_type.drop(op.get_bind(), checkfirst=True)

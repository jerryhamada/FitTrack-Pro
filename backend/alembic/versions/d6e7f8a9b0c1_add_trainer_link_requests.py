"""self-signup clients: nullable clients.trainer_id + trainer_link_requests

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
Create Date: 2026-07-08 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd6e7f8a9b0c1'
down_revision: Union[str, None] = 'c5d6e7f8a9b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Clients created through self-signup have no trainer until a link request
    # is accepted.
    op.alter_column('clients', 'trainer_id', existing_type=sa.Integer(), nullable=True)

    # New notification type for "a client wants to connect". ADD VALUE cannot run
    # inside the migration transaction on Postgres.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'client_link_request'")

    op.create_table(
        'trainer_link_requests',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('client_id', sa.Integer(), sa.ForeignKey('clients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('trainer_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column(
            'status',
            sa.Enum('pending', 'accepted', 'declined', name='link_request_status_enum'),
            nullable=False,
            server_default='pending',
        ),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('responded_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_trainer_link_requests_client_id', 'trainer_link_requests', ['client_id'])
    op.create_index('ix_trainer_link_requests_trainer_id', 'trainer_link_requests', ['trainer_id'])


def downgrade() -> None:
    op.drop_index('ix_trainer_link_requests_trainer_id', table_name='trainer_link_requests')
    op.drop_index('ix_trainer_link_requests_client_id', table_name='trainer_link_requests')
    op.drop_table('trainer_link_requests')
    sa.Enum(name='link_request_status_enum').drop(op.get_bind(), checkfirst=True)
    # Rows with a NULL trainer_id would block this; downgrade assumes none exist.
    op.alter_column('clients', 'trainer_id', existing_type=sa.Integer(), nullable=False)
    # Postgres has no ALTER TYPE DROP VALUE — the extra enum value stays behind.

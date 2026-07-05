"""make clients.email nullable (trainers can add clients with just name + phone)

Revision ID: a1b2c3d4e5f6
Revises: c4d5e6f7a8b9
Create Date: 2026-07-04 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'c4d5e6f7a8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('clients', 'email', existing_type=sa.String(), nullable=True)


def downgrade() -> None:
    op.alter_column('clients', 'email', existing_type=sa.String(), nullable=False)

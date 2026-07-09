"""exercise library: demo image list + difficulty level for the built-in library

Revision ID: a9c0d1e2f3b4
Revises: e8a9b0c1d2f3
Create Date: 2026-07-09 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a9c0d1e2f3b4'
down_revision: Union[str, None] = 'e8a9b0c1d2f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('exercises', sa.Column('images', sa.JSON(), nullable=True))
    op.add_column('exercises', sa.Column('level', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('exercises', 'level')
    op.drop_column('exercises', 'images')

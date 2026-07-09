"""trainer join codes: shareable code clients enter to join a trainer directly

Revision ID: e8a9b0c1d2f3
Revises: d6e7f8a9b0c1
Create Date: 2026-07-08 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8a9b0c1d2f3'
down_revision: Union[str, None] = 'd6e7f8a9b0c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('trainer_profiles', sa.Column('join_code', sa.String(), nullable=True))
    op.create_unique_constraint('uq_trainer_profiles_join_code', 'trainer_profiles', ['join_code'])


def downgrade() -> None:
    op.drop_constraint('uq_trainer_profiles_join_code', 'trainer_profiles', type_='unique')
    op.drop_column('trainer_profiles', 'join_code')

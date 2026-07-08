"""add stored est_1rm to sets + backfill from existing weight/reps

Revision ID: c5d6e7f8a9b0
Revises: b2c3d4e5f6a7
Create Date: 2026-07-08 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5d6e7f8a9b0'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('sets', sa.Column('est_1rm', sa.Numeric(), nullable=True))
    # Backfill: Epley on the weight AS LOGGED (per-hand for per-side sets, not
    # doubled), in the set's own unit — mirrors services/one_rm.set_est_1rm.
    # Sets with no weight or no reps stay null.
    op.execute(
        """
        UPDATE sets
        SET est_1rm = weight * (1 + reps / 30.0)
        WHERE weight IS NOT NULL AND reps IS NOT NULL AND reps > 0
        """
    )


def downgrade() -> None:
    op.drop_column('sets', 'est_1rm')

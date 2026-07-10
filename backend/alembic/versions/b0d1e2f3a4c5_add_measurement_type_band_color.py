"""per-exercise measurement type (weight / height / band) + band_color on sets

- exercises.measurement_type generalizes the old tracks_height bool into a
  three-way choice; backfilled from tracks_height so existing data keeps meaning.
- exercise_settings holds per-trainer overrides so a trainer can change how a
  BUILT-IN exercise is measured without affecting other trainers.
- sets.band_color stores the resistance-band color for band-measured sets.

Revision ID: b0d1e2f3a4c5
Revises: a9c0d1e2f3b4
Create Date: 2026-07-10 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b0d1e2f3a4c5'
down_revision: Union[str, None] = 'a9c0d1e2f3b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'exercises',
        sa.Column('measurement_type', sa.String(), nullable=False, server_default='weight'),
    )
    op.execute("UPDATE exercises SET measurement_type = 'height' WHERE tracks_height = true")

    op.create_table(
        'exercise_settings',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('trainer_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('exercise_id', sa.Integer(), sa.ForeignKey('exercises.id'), nullable=False),
        sa.Column('measurement_type', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('trainer_id', 'exercise_id', name='uq_trainer_exercise_setting'),
    )

    op.add_column('sets', sa.Column('band_color', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('sets', 'band_color')
    op.drop_table('exercise_settings')
    op.drop_column('exercises', 'measurement_type')

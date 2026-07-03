"""add set notes and exercise muscle_group (+backfill)

Revision ID: b7d8e9f0a1c2
Revises: a1c2e3d4f5b6
Create Date: 2026-07-02 08:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7d8e9f0a1c2'
down_revision: Union[str, None] = 'a1c2e3d4f5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Keyword → muscle group backfill. ORDER MATTERS: earlier rules win (rows are only
# updated while muscle_group IS NULL), e.g. "Hamstring curls" must match hamstrings
# before the biceps '%curl%' rule, and "Reverse pec fly" must hit shoulders before
# the chest '%fly%' rule.
_BACKFILL: list[tuple[str, list[str]]] = [
    ("hamstrings", ["%rdl%", "%hamstring%"]),
    ("calves", ["%calf%"]),
    ("core", ["%crunch%", "%plank%"]),
    ("triceps", ["%triceps%", "%pushdown%", "%skull%"]),
    ("shoulders", ["%shoulder press%", "%military%", "%lateral raise%", "%delt%", "%face pull%", "%reverse pec%"]),
    ("chest", ["%bench%", "%chest%", "%push-up%", "%push up%", "%fly%", "%incline%", "%dumbbell press%"]),
    ("back", ["%row%", "%pulldown%", "%pull down%", "%pull-up%", "%pull up%", "%back extension%"]),
    ("glutes", ["%glute%", "%hip thrust%", "%abductor%", "%adductor%", "%banded walk%", "%kickback%"]),
    ("biceps", ["%curl%"]),
    ("quads", ["%squat%", "%leg press%", "%step up%", "%step-up%", "%leg extension%", "%lunge%", "%sled%"]),
]


def upgrade() -> None:
    op.add_column('sets', sa.Column('notes', sa.Text(), nullable=True))
    op.add_column('exercises', sa.Column('muscle_group', sa.String(), nullable=True))

    conn = op.get_bind()
    for muscle, patterns in _BACKFILL:
        for pattern in patterns:
            conn.execute(
                sa.text(
                    "UPDATE exercises SET muscle_group = :muscle "
                    "WHERE muscle_group IS NULL AND name ILIKE :pattern"
                ),
                {"muscle": muscle, "pattern": pattern},
            )


def downgrade() -> None:
    op.drop_column('exercises', 'muscle_group')
    op.drop_column('sets', 'notes')

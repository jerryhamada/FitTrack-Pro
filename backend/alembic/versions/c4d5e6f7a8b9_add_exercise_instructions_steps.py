"""add exercises.instructions_steps + seed steps for a few common lifts

Revision ID: c4d5e6f7a8b9
Revises: b1c2d3e4f5a6
Create Date: 2026-07-02 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import json


revision: str = 'c4d5e6f7a8b9'
down_revision: Union[str, None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Seed a handful so the numbered-steps UI has real content out of the box.
_SEED = {
    "Bench press (barbell)": [
        "Set up: lie flat, eyes under the bar, feet planted, shoulder blades pinched back and down.",
        "Unrack and hold the bar over your chest with straight arms.",
        "Lower under control to mid-chest, elbows ~45° from your torso.",
        "Press back up to lockout, keeping your back arch and glutes on the bench.",
        "Cue: drive your feet into the floor and keep wrists stacked over elbows.",
    ],
    "Back squat barbell": [
        "Set up: bar on your upper back, hands just outside shoulders, brace your core.",
        "Unrack, step back, set feet shoulder-width with toes slightly out.",
        "Break at the hips and knees together, sitting down between your legs.",
        "Descend to at least parallel, keeping your chest up and knees tracking toes.",
        "Cue: drive the floor away and keep your whole foot planted.",
    ],
    "RDL": [
        "Set up: hold the bar at your hips, feet hip-width, soft knees.",
        "Hinge at the hips, pushing them back while keeping the bar close to your legs.",
        "Lower until you feel a hamstring stretch, back flat throughout.",
        "Drive your hips forward to stand tall and squeeze your glutes.",
        "Cue: think 'push the wall behind you with your hips', not 'bend down'.",
    ],
}


def upgrade() -> None:
    op.add_column('exercises', sa.Column('instructions_steps', sa.JSON(), nullable=True))
    conn = op.get_bind()
    for name, steps in _SEED.items():
        conn.execute(
            sa.text("UPDATE exercises SET instructions_steps = :steps WHERE name = :name"),
            {"steps": json.dumps(steps), "name": name},
        )


def downgrade() -> None:
    op.drop_column('exercises', 'instructions_steps')

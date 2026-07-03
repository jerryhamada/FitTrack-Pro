"""add exercise detail fields (secondary muscles, equipment, type, media, archived)

Revision ID: c3f4a5b6d7e8
Revises: b7d8e9f0a1c2
Create Date: 2026-07-02 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3f4a5b6d7e8'
down_revision: Union[str, None] = 'b7d8e9f0a1c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Equipment backfill — first match wins (rows only update while equipment IS NULL).
_EQUIPMENT: list[tuple[str, list[str]]] = [
    ("barbell", ["%barbell%", "%ez bar%"]),
    ("dumbbell", ["%dumbbell%"]),
    ("machine", ["%machine%", "%leg press%", "%hack squat%", "%belt%", "%assisted%", "%leg extension%"]),
    ("cable", ["%cable%", "%pushdown%", "%pulldown%", "%pull down%", "%face pull%"]),
    ("bodyweight", ["%push-up%", "%push up%", "%plank%", "%step up%", "%step-up%", "%bridge%"]),
    ("band", ["%banded%"]),
    ("sled", ["%sled%"]),
]


def upgrade() -> None:
    op.add_column('exercises', sa.Column('secondary_muscles', sa.JSON(), nullable=True))
    op.add_column('exercises', sa.Column('equipment', sa.String(), nullable=True))
    op.add_column('exercises', sa.Column('exercise_type', sa.String(), nullable=True))
    op.add_column('exercises', sa.Column('demo_media_url', sa.String(), nullable=True))
    op.add_column('exercises', sa.Column('archived', sa.Boolean(), nullable=False, server_default=sa.false()))

    conn = op.get_bind()
    for equipment, patterns in _EQUIPMENT:
        for pattern in patterns:
            conn.execute(
                sa.text(
                    "UPDATE exercises SET equipment = :equipment "
                    "WHERE equipment IS NULL AND name ILIKE :pattern"
                ),
                {"equipment": equipment, "pattern": pattern},
            )

    # exercise_type from the existing subcategory taxonomy.
    conn.execute(sa.text(
        "UPDATE exercises SET exercise_type = 'compound' WHERE exercise_type IS NULL AND ("
        "subcategory ILIKE '%compound%' OR subcategory ILIKE '%squat pattern%' OR subcategory ILIKE '%hinge%')"
    ))
    conn.execute(sa.text(
        "UPDATE exercises SET exercise_type = 'isolation' WHERE exercise_type IS NULL AND ("
        "subcategory ILIKE '%isolation%' OR subcategory ILIKE '%accessory%')"
    ))


def downgrade() -> None:
    op.drop_column('exercises', 'archived')
    op.drop_column('exercises', 'demo_media_url')
    op.drop_column('exercises', 'exercise_type')
    op.drop_column('exercises', 'equipment')
    op.drop_column('exercises', 'secondary_muscles')

"""exercise library v2 (110 exercises) + height-based logging (box jumps/push-ups)

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-05 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# New exercises sourced from the trainer's updated exercise library doc (110 total,
# minus the ~49 that already matched the existing library by name). Tier tags
# ([S+]/[S]/[A+]/[A]) from the doc are intentionally not stored. "Box push-ups" isn't
# in the doc — added per the trainer's explicit ask, mirroring "Box jumps" as its own
# entry, to carry the invert-difficulty flag.
_NEW_EXERCISES: list[tuple[str, str, str]] = [
    # (name, category, muscle_group)
    ('Seated cable pec flye', 'Upper Body — Compound Push', 'chest'),
    ('Dips', 'Upper Body — Compound Push', 'chest'),
    ('Deficit push-ups', 'Upper Body — Compound Push', 'chest'),
    ('Dumbbell guillotine press', 'Upper Body — Compound Push', 'chest'),
    ('Smith machine bench press', 'Upper Body — Compound Push', 'chest'),
    ('Incline smith machine bench press', 'Upper Body — Compound Push', 'chest'),
    ('Cable crossovers', 'Upper Body — Compound Push', 'chest'),
    ('Dumbbell flye', 'Upper Body — Compound Push', 'chest'),
    ('Cable press-around', 'Upper Body — Compound Push', 'chest'),
    ('Wide-grip lat pulldown', 'Upper Body — Compound Pull', 'back'),
    ('Neutral-grip lat pulldown', 'Upper Body — Compound Pull', 'back'),
    ('One-arm lat pulldown', 'Upper Body — Compound Pull', 'back'),
    ('Meadows row', 'Upper Body — Compound Pull', 'back'),
    ('Wide-grip cable row', 'Upper Body — Compound Pull', 'back'),
    ('Wide-grip pull-ups', 'Upper Body — Compound Pull', 'back'),
    ('Neutral-grip pull-ups', 'Upper Body — Compound Pull', 'back'),
    ('Cross-body one-arm lat pulldown', 'Upper Body — Compound Pull', 'back'),
    ('Deficit pendlay row', 'Upper Body — Compound Pull', 'back'),
    ('Kroc row', 'Upper Body — Compound Pull', 'back'),
    ('Cable lat prayers', 'Upper Body — Compound Pull', 'back'),
    ('Dumbbell pullovers', 'Upper Body — Compound Pull', 'back'),
    ('Cable lateral raise', 'Upper Body — Compound Push', 'shoulders'),
    ('Cable “Y” raise', 'Upper Body — Compound Push', 'shoulders'),
    ('Behind-the-back cuffed cable lateral raise', 'Upper Body — Compound Push', 'shoulders'),
    ('Reverse cable crossover', 'Upper Body — Compound Push', 'shoulders'),
    ('Machine shoulder press', 'Upper Body — Compound Push', 'shoulders'),
    ('Atlantis standing machine lateral raise', 'Upper Body — Compound Push', 'shoulders'),
    ('Lean-in DB lateral raises', 'Upper Body — Compound Push', 'shoulders'),
    ('Rope face pulls', 'Upper Body — Compound Push', 'shoulders'),
    ('“Arnold-style” side-lying DB raises', 'Upper Body — Compound Push', 'shoulders'),
    ('Face-away Bayesian curl', 'Upper Body — Compound Pull', 'biceps'),
    ('Dumbbell preacher curl', 'Upper Body — Compound Pull', 'biceps'),
    ('Machine preacher curl', 'Upper Body — Compound Pull', 'biceps'),
    ('Preacher hammer curl', 'Upper Body — Compound Pull', 'biceps'),
    ('Standing dumbbell curl', 'Upper Body — Compound Pull', 'biceps'),
    ('Incline curl', 'Upper Body — Compound Pull', 'biceps'),
    ('Lying dumbbell curl', 'Upper Body — Compound Pull', 'biceps'),
    ('Modified 21s', 'Upper Body — Compound Pull', 'biceps'),
    ('Cheat curl', 'Upper Body — Compound Pull', 'biceps'),
    ('Strict curl', 'Upper Body — Compound Pull', 'biceps'),
    ('Hammer curl', 'Upper Body — Compound Pull', 'biceps'),
    ('Inverse Zottman curl', 'Upper Body — Compound Pull', 'biceps'),
    ('Overhead cable triceps extension (bar)', 'Upper Body — Compound Push', 'triceps'),
    ('Barbell skullcrusher', 'Upper Body — Compound Push', 'triceps'),
    ('Overhead cable triceps extension (rope)', 'Upper Body — Compound Push', 'triceps'),
    ('Katana cable triceps extension', 'Upper Body — Compound Push', 'triceps'),
    ('1-arm dumbbell overhead extension', 'Upper Body — Compound Push', 'triceps'),
    ('Dumbbell skullcrusher', 'Upper Body — Compound Push', 'triceps'),
    ('Smith machine JM press', 'Upper Body — Compound Push', 'triceps'),
    ('Cable triceps kickback', 'Upper Body — Compound Push', 'triceps'),
    ('Close-grip bench press', 'Upper Body — Compound Push', 'triceps'),
    ('Pendulum squat', 'Lower Body', 'quads'),
    ('Smith machine squat', 'Lower Body', 'quads'),
    ('Barbell front squat', 'Lower Body', 'quads'),
    ('Low-bar squat', 'Lower Body', 'quads'),
    ('Reverse Nordic', 'Lower Body', 'quads'),
    ('Box jumps', 'Lower Body', 'quads'),
    ('Walking lunges', 'Lower Body', 'glutes'),
    ('Smith machine lunge (front foot elevated)', 'Lower Body', 'glutes'),
    ('Single-leg dumbbell hip thrust', 'Lower Body', 'glutes'),
    ('Box sit-ups', 'Core', 'core'),
    ('Box push-ups', 'Upper Body — Compound Push', 'chest'),
]


def upgrade() -> None:
    conn = op.get_bind()

    # --- schema ---
    # Create the enum type once explicitly, then reference it with create_type=False
    # on every subsequent column so SQLAlchemy doesn't try (and fail) to re-create it.
    postgresql.ENUM('in', 'cm', name='distance_unit_enum').create(conn, checkfirst=True)
    distance_unit_col = postgresql.ENUM('in', 'cm', name='distance_unit_enum', create_type=False)

    op.execute("ALTER TYPE pr_type_enum ADD VALUE IF NOT EXISTS 'height_at_reps'")

    op.add_column('exercises', sa.Column('tracks_height', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column(
        'exercises', sa.Column('invert_difficulty', sa.Boolean(), nullable=False, server_default=sa.false())
    )
    op.add_column('sets', sa.Column('height', sa.Numeric(), nullable=True))
    op.add_column('sets', sa.Column('height_unit', distance_unit_col, nullable=True))
    op.add_column(
        'trainer_profiles',
        sa.Column('default_distance_unit', distance_unit_col, nullable=False, server_default='in'),
    )
    op.alter_column('prs', 'unit', existing_type=sa.Enum('lbs', 'kg', name='unit_enum'), nullable=True)
    op.add_column('prs', sa.Column('distance_unit', distance_unit_col, nullable=True))

    # --- data fix: merge duplicate "Face pulls" (old seed bug — listed under both
    # push and pull sections, both landing on muscle_group='shoulders') ---
    dupe_ids = [
        row[0]
        for row in conn.execute(
            sa.text("SELECT id FROM exercises WHERE name = 'Face pulls' ORDER BY id")
        ).fetchall()
    ]
    if len(dupe_ids) > 1:
        survivor, losers = dupe_ids[0], dupe_ids[1:]
        for loser in losers:
            # Drop loser-side rows that would collide with a unique constraint once
            # repointed onto the survivor; repoint everything else.
            conn.execute(
                sa.text(
                    "DELETE FROM exercise_favorites ef USING exercise_favorites ef2 "
                    "WHERE ef.exercise_id = :loser AND ef2.exercise_id = :survivor "
                    "AND ef.trainer_id = ef2.trainer_id"
                ),
                {"loser": loser, "survivor": survivor},
            )
            conn.execute(
                sa.text("UPDATE exercise_favorites SET exercise_id = :survivor WHERE exercise_id = :loser"),
                {"loser": loser, "survivor": survivor},
            )
            conn.execute(
                sa.text(
                    "DELETE FROM session_exercises se USING session_exercises se2 "
                    "WHERE se.exercise_id = :loser AND se2.exercise_id = :survivor "
                    "AND se.session_id = se2.session_id"
                ),
                {"loser": loser, "survivor": survivor},
            )
            conn.execute(
                sa.text("UPDATE session_exercises SET exercise_id = :survivor WHERE exercise_id = :loser"),
                {"loser": loser, "survivor": survivor},
            )
            for table in ("sets", "prs", "program_exercises", "client_program_exercises"):
                conn.execute(
                    sa.text(f"UPDATE {table} SET exercise_id = :survivor WHERE exercise_id = :loser"),
                    {"loser": loser, "survivor": survivor},
                )
            conn.execute(sa.text("DELETE FROM exercises WHERE id = :loser"), {"loser": loser})

    # --- seed the new exercises (skip any that already exist, e.g. re-running) ---
    for name, category, muscle_group in _NEW_EXERCISES:
        exists = conn.execute(
            sa.text("SELECT 1 FROM exercises WHERE trainer_id IS NULL AND name = :name"), {"name": name}
        ).first()
        if exists:
            continue
        conn.execute(
            sa.text(
                "INSERT INTO exercises (trainer_id, name, category, muscle_group, archived, "
                "tracks_height, invert_difficulty) "
                "VALUES (NULL, :name, :category, :muscle_group, false, false, false)"
            ),
            {"name": name, "category": category, "muscle_group": muscle_group},
        )

    # --- flag the two height-tracked exercises ---
    conn.execute(
        sa.text(
            "UPDATE exercises SET tracks_height = true, invert_difficulty = false "
            "WHERE trainer_id IS NULL AND name = 'Box jumps'"
        )
    )
    conn.execute(
        sa.text(
            "UPDATE exercises SET tracks_height = true, invert_difficulty = true "
            "WHERE trainer_id IS NULL AND name = 'Box push-ups'"
        )
    )


def downgrade() -> None:
    conn = op.get_bind()
    names = [n for n, _, _ in _NEW_EXERCISES]
    conn.execute(
        sa.text("DELETE FROM exercises WHERE trainer_id IS NULL AND name IN :names").bindparams(
            sa.bindparam("names", expanding=True)
        ),
        {"names": names},
    )
    op.drop_column('prs', 'distance_unit')
    op.alter_column('prs', 'unit', existing_type=sa.Enum('lbs', 'kg', name='unit_enum'), nullable=False)
    op.drop_column('trainer_profiles', 'default_distance_unit')
    op.drop_column('sets', 'height_unit')
    op.drop_column('sets', 'height')
    op.drop_column('exercises', 'invert_difficulty')
    op.drop_column('exercises', 'tracks_height')
    sa.Enum(name='distance_unit_enum').drop(conn)

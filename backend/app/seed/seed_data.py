from __future__ import annotations

from ..database import SessionLocal
from ..models.exercises import Exercise
from ..models.prs import Badge
from ..services.badges import BADGE_SEED
from .exercise_data import EXERCISES


def seed_exercises(db) -> int:
    existing = {
        (e.name, e.category, e.subcategory)
        for e in db.query(Exercise).filter(Exercise.trainer_id.is_(None)).all()
    }
    inserted = 0
    for name, category, subcategory, notes in EXERCISES:
        if (name, category, subcategory) in existing:
            continue
        db.add(Exercise(trainer_id=None, name=name, category=category, subcategory=subcategory, notes=notes))
        inserted += 1
    return inserted


def seed_badges(db) -> int:
    existing_codes = {b.code for b in db.query(Badge).all()}
    inserted = 0
    for code, name, description in BADGE_SEED:
        if code in existing_codes:
            continue
        db.add(Badge(code=code, name=name, description=description))
        inserted += 1
    return inserted


def main() -> None:
    db = SessionLocal()
    try:
        ex_count = seed_exercises(db)
        badge_count = seed_badges(db)
        db.commit()
        print(f"Seeded {ex_count} exercises, {badge_count} badges.")
    finally:
        db.close()


if __name__ == "__main__":
    main()

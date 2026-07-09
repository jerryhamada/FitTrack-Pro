"""Built-in exercise library import.

Source: free-exercise-db (https://github.com/yuhonas/free-exercise-db),
released under The Unlicense (public domain) — safe for commercial use.
The JSON is vendored at app/seed/free_exercise_db.json so seeding is
deterministic and works offline; the demo photos are self-hosted from this
repo's GitHub Pages site (docs/exercises/, same host as the invite page).

Muscle taxonomy matches mobile/src/lib/muscles.ts — legs are split into
quads / hamstrings / glutes (+ calves) rather than one "Legs" bucket.
"""
from __future__ import annotations

import json
from pathlib import Path

from ..models.exercises import Exercise

DATA_PATH = Path(__file__).parent / "free_exercise_db.json"
IMAGE_BASE = "https://jerryhamada.github.io/FitTrack-Pro/exercises/"
# Earlier dev builds hotlinked the source repo directly; rewritten on re-seed.
LEGACY_IMAGE_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/"

# Source muscle -> app muscle region (None = drop the exercise; off-taxonomy).
MUSCLE_MAP: dict[str, str | None] = {
    "abdominals": "core",
    "abductors": "glutes",
    "adductors": "quads",
    "biceps": "biceps",
    "calves": "calves",
    "chest": "chest",
    "forearms": "forearms",
    "glutes": "glutes",
    "hamstrings": "hamstrings",
    "lats": "back",
    "lower back": "back",
    "middle back": "back",
    "neck": None,
    "quadriceps": "quads",
    "shoulders": "shoulders",
    "traps": "back",
    "triceps": "triceps",
}

EQUIPMENT_MAP: dict[str, str | None] = {
    "body only": "bodyweight",
    "kettlebells": "kettlebell",
    "bands": "band",
    "e-z curl bar": "barbell",
    "medicine ball": "medicine ball",
    "exercise ball": "exercise ball",
    "foam roll": "foam roller",
    "other": None,
}


def _category_for_muscle(muscle: str) -> str:
    # Mirrors categoryForMuscle in the mobile Exercise Library form.
    if muscle in ("chest", "shoulders", "triceps"):
        return "Upper Body — Compound Push"
    if muscle in ("back", "biceps", "forearms"):
        return "Upper Body — Compound Pull"
    if muscle == "core":
        return "Core"
    return "Lower Body"


def _norm(name: str) -> str:
    return " ".join(name.lower().split())


def seed_exercise_library(db) -> tuple[int, int]:
    """Insert the built-in library as global exercises. Idempotent: rows are
    matched by normalized name; existing exercises (including the original
    hand-curated seed) are kept and only enriched where fields are missing,
    so exercise ids referenced by workout history never change."""
    entries = json.loads(DATA_PATH.read_text())

    existing = {
        _norm(e.name): e
        for e in db.query(Exercise).filter(Exercise.trainer_id.is_(None)).all()
    }

    inserted = enriched = 0
    for entry in entries:
        primary = next(
            (m for m in (MUSCLE_MAP.get(pm) for pm in entry["primaryMuscles"]) if m),
            None,
        )
        if primary is None:
            continue  # off-taxonomy (e.g. neck-only exercises)

        secondary = []
        for pm in entry["primaryMuscles"][1:] + entry["secondaryMuscles"]:
            mapped = MUSCLE_MAP.get(pm)
            if mapped and mapped != primary and mapped not in secondary:
                secondary.append(mapped)

        raw_equipment = entry.get("equipment")
        equipment = EQUIPMENT_MAP.get(raw_equipment, raw_equipment) if raw_equipment else None
        mechanic = entry.get("mechanic")
        exercise_type = mechanic if mechanic in ("compound", "isolation") else None
        images = [IMAGE_BASE + p for p in entry.get("images", [])]
        fields = {
            "category": _category_for_muscle(primary),
            "subcategory": entry["category"].title(),  # Strength / Stretching / Plyometrics / ...
            "muscle_group": primary,
            "secondary_muscles": secondary or None,
            "equipment": equipment,
            "exercise_type": exercise_type,
            "images": images or None,
            "level": entry.get("level"),
            "instructions_steps": entry.get("instructions") or None,
        }

        current = existing.get(_norm(entry["name"]))
        if current is not None:
            # Fill gaps only — never overwrite trainer-visible curation.
            changed = False
            for field, value in fields.items():
                if value is not None and getattr(current, field) in (None, [], ""):
                    setattr(current, field, value)
                    changed = True
            if current.images and any(u.startswith(LEGACY_IMAGE_BASE) for u in current.images):
                current.images = [u.replace(LEGACY_IMAGE_BASE, IMAGE_BASE) for u in current.images]
                changed = True
            enriched += int(changed)
            continue

        exercise = Exercise(trainer_id=None, name=entry["name"], **fields)
        db.add(exercise)
        existing[_norm(entry["name"])] = exercise
        inserted += 1

    return inserted, enriched

from __future__ import annotations

# Seed list sourced verbatim from the spec's exercise library outline (and cross-checked
# against the real trainer's CSV export). Seeding names/category/subcategory only -- no
# fake historical set logs, so PR detection can be exercised cleanly against real input.

LOWER_BODY = "Lower Body"
UPPER_PUSH = "Upper Body — Compound Push"
UPPER_PULL = "Upper Body — Compound Pull"

EXERCISES: list[tuple[str, str, str, str | None]] = [
    # (name, category, subcategory, notes)
    ("Back squat barbell", LOWER_BODY, "Squat pattern", None),
    ("Belt sumo squats", LOWER_BODY, "Squat pattern", None),
    ("Hack squat", LOWER_BODY, "Squat pattern", None),
    ("Leg press", LOWER_BODY, "Squat pattern", None),
    ("Bulgarian split squats", LOWER_BODY, "Squat pattern", None),
    ("Step ups", LOWER_BODY, "Squat pattern", None),
    ("Assisted step-ups", LOWER_BODY, "Squat pattern", None),
    ("RDL", LOWER_BODY, "Hip hinge / posterior chain", None),
    ("SL RDL (single-leg RDL)", LOWER_BODY, "Hip hinge / posterior chain", None),
    ("Hip thrust machine", LOWER_BODY, "Hip hinge / posterior chain", None),
    ("Glute bridge + holds", LOWER_BODY, "Hip hinge / posterior chain", None),
    ("Hamstring curls", LOWER_BODY, "Hip hinge / posterior chain", None),
    ("Flat back extensions", LOWER_BODY, "Hip hinge / posterior chain", None),
    ("Angled back extensions", LOWER_BODY, "Hip hinge / posterior chain", None),
    ("Glute kickbacks", LOWER_BODY, "Hip hinge / posterior chain", None),
    ("Barbell hip thrust", LOWER_BODY, "Hip hinge / posterior chain", None),
    ("Lying hamstrings", LOWER_BODY, "Hip hinge / posterior chain", None),
    ("Leg extension", LOWER_BODY, "Isolation / accessory", None),
    ("Hip abductors machine", LOWER_BODY, "Isolation / accessory", None),
    ("Hip adductors machine", LOWER_BODY, "Isolation / accessory", None),
    ("Banded walks", LOWER_BODY, "Isolation / accessory", None),
    ("Sled pull", LOWER_BODY, "Isolation / accessory", None),
    ("Sled push", LOWER_BODY, "Isolation / accessory", None),
    ("Calf raises", LOWER_BODY, "Isolation / accessory", None),
    ("Seated dumbbell shoulder press", UPPER_PUSH, "Compound", None),
    ("Military press barbell", UPPER_PUSH, "Compound", None),
    ("Incline dumbbell press", UPPER_PUSH, "Compound", None),
    ("Flat dumbbell press", UPPER_PUSH, "Compound", None),
    ("Bench press (barbell)", UPPER_PUSH, "Compound", None),
    ("Chest press machine", UPPER_PUSH, "Compound", None),
    (
        "Push-ups",
        UPPER_PUSH,
        "Compound",
        "Modifier: knee/box-assisted -- log via the set's modifier field (e.g. \"B60\", \"k\").",
    ),
    ("Dumbbell lateral raises", UPPER_PUSH, "Isolation", None),
    ("Front delt raises", UPPER_PUSH, "Isolation", None),
    ("Face pulls", UPPER_PUSH, "Isolation", None),
    ("Pec fly machine", UPPER_PUSH, "Isolation", None),
    ("Triceps cable pushdown", UPPER_PUSH, "Isolation", None),
    ("Low-to-high cable triceps", UPPER_PUSH, "Isolation", None),
    ("Lat pulldowns", UPPER_PULL, "Compound", None),
    ("Lat cable pull down", UPPER_PULL, "Compound", None),
    ("Low row machine", UPPER_PULL, "Compound", None),
    ("Dumbbell rows", UPPER_PULL, "Compound", None),
    ("Single-arm dumbbell rows", UPPER_PULL, "Compound", None),
    ("Supported rows", UPPER_PULL, "Compound", None),
    ("Assisted pull-ups", UPPER_PULL, "Compound", None),
    ("Reverse pec fly", UPPER_PULL, "Isolation", None),
    ("Biceps barbell curl", UPPER_PULL, "Isolation", None),
    ("EZ bar curl", UPPER_PULL, "Isolation", None),
    ("Biceps cable curl", UPPER_PULL, "Isolation", None),
    ("Biceps dumbbell cable curl (seated variant)", UPPER_PULL, "Isolation", None),
    ("Face pulls", UPPER_PULL, "Isolation", None),
    ("Cable crunches", UPPER_PULL, "Isolation", None),
    ("Cable RDL", UPPER_PULL, "Isolation", None),
]

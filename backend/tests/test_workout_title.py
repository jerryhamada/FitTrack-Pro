from app.routers.client_portal import _workout_title


def test_single_muscle_reads_as_x_day():
    assert _workout_title(["glutes"]) == "Glutes Day"
    assert _workout_title(["quads", "quads"]) == "Quads Day"


def test_coherent_splits():
    assert _workout_title(["chest", "shoulders", "triceps"]) == "Push Day"
    assert _workout_title(["back", "biceps"]) == "Pull Day"
    assert _workout_title(["quads", "hamstrings", "glutes"]) == "Leg Day"
    assert _workout_title(["core"]) == "Core Day"


def test_broader_mixes_collapse():
    assert _workout_title(["chest", "back"]) == "Upper Body"
    assert _workout_title(["quads", "core"]) == "Lower Body"
    assert _workout_title(["chest", "quads"]) == "Full Body"


def test_empty_and_none_fall_back():
    assert _workout_title([]) == "Workout"
    assert _workout_title([None, None]) == "Workout"
    # a single real muscle mixed with untagged exercises still reads specifically
    assert _workout_title([None, "glutes"]) == "Glutes Day"

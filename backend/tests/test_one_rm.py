from app.services.one_rm import estimated_1rm


def test_epley_formula():
    assert estimated_1rm(100, 10) == 100 * (1 + 10 / 30)


def test_single_rep_close_to_weight():
    result = estimated_1rm(225, 1)
    assert 225 < result < 235


def test_zero_reps_returns_weight_unchanged():
    assert estimated_1rm(150, 0) == 150


def test_higher_reps_yields_higher_estimate():
    assert estimated_1rm(100, 12) > estimated_1rm(100, 5)

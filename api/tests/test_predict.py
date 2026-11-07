import math

from api.predict import estimate, hours_to, median, predict_curve, status


def test_hours_to():
    assert round(hours_to(64, 5, 60, 0.10), 2) == 0.70
    assert round(hours_to(64, 5, 50, 0.10), 2) == 2.71


def test_hours_to_edges():
    assert hours_to(48, 5, 50, 0.10) == 0.0
    assert hours_to(64, 5, 4, 0.10) is None
    assert hours_to(64, 5, 50, 0) is None
    assert hours_to(64, 5, 50, None) is None


def test_status_precedence():
    assert status(66, 40, False, None, "leaving") == "critical"
    assert status(45, 0, False, 0.0, "leaving") == "leaving"
    assert status(45, 0, False, 0.0, "none") == "critical"
    assert status(62, 0, False, 1.2, "none") == "critical"
    assert status(62, 0, False, 3.5, "none") == "warning"
    assert status(58, 0, True, None, "none") == "warning"
    assert status(65, 0, False, 6, "none") == "cooling"
    assert status(68, 0, True, None, "none") == "heated"


def test_estimate():
    assert round(estimate(60, 5, 0.1, 1.0), 2) == round(5 + 55 * math.exp(-0.1), 2)


def test_predict_curve():
    cooling = predict_curve(64, 5, 0.10, False)
    assert len(cooling) == 25 and cooling[0] == (0, 64) and cooling[-1][0] == 360
    assert round(cooling[4][1], 2) == round(estimate(64, 5, 0.10, 1.0), 2)
    heated = predict_curve(60, 5, 0.10, True)
    assert heated[-1][1] > 67.9 and all(a[1] <= b[1] for a, b in zip(heated, heated[1:]))
    assert all(t == 64 for _, t in predict_curve(64, 5, None, False))


def test_median():
    assert median([0.3, 0.1, 0.2]) == 0.2
    assert round(median([0.1, 0.2]), 3) == 0.15
    assert median([]) is None

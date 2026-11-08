from api.risk import risk_score


def home(**kw):
    base = {"temp_f": 68.0, "co_ppm": 0.0, "heating": True, "hours_to_50": None,
            "age_band": "40-64", "medical_needs": [], "online": True}
    base.update(kw)
    return base


def test_warm_healthy_is_zero():
    assert risk_score(home(), None) == 0


def test_leaving_is_low_regardless():
    h = home(temp_f=45, heating=False, hours_to_50=0.0, age_band="75+", medical_needs=["oxygen"])
    assert risk_score(h, {"call_status": "done", "outcome": "leaving"}) == 5


def test_countdown_monotonic():
    scores = [risk_score(home(temp_f=58, heating=False, hours_to_50=h), None) for h in (0, 2, 4, 8, 12)]
    assert scores == sorted(scores, reverse=True)


def test_vulnerable_outranks_healthy_at_same_temp():
    base = dict(temp_f=57, heating=False, hours_to_50=2.0)
    assert risk_score(home(age_band="75+", medical_needs=["oxygen"], **base), None) > \
        risk_score(home(**base), None)


def test_medical_cap():
    h = home(temp_f=57, heating=False, hours_to_50=20, medical_needs=["oxygen", "heart", "mobility", "dialysis"])
    plain = home(temp_f=57, heating=False, hours_to_50=20)
    assert risk_score(h, None) - risk_score(plain, None) == 24


def test_co_dominates():
    assert risk_score(home(co_ppm=40), None) >= 30


def test_outcomes_raise_score():
    h = home(temp_f=57, heating=False, hours_to_50=3)
    base = risk_score(h, None)
    assert risk_score(h, {"call_status": "done", "outcome": "needs_help"}) == base + 15
    assert risk_score(h, {"call_status": "done", "outcome": "medical"}) == base + 20
    assert risk_score(h, {"call_status": "unreachable", "outcome": "unreachable"}) == base + 20
    assert risk_score(h, {"call_status": "no_answer", "outcome": "none"}) == base + 10
    assert risk_score(h, {"call_status": "done", "outcome": "ok"}) == base


def test_offline_adds_five_and_cap_is_100():
    h = home(temp_f=40, heating=False, hours_to_50=0, age_band="75+", co_ppm=50,
             medical_needs=["oxygen", "heart"], online=False)
    assert risk_score(h, {"call_status": "done", "outcome": "medical"}) == 100
    a = home(temp_f=57, heating=False, hours_to_50=3)
    assert risk_score({**a, "online": False}, None) == risk_score(a, None) + 5


def test_deterministic_and_int():
    h = home(temp_f=55, heating=False, hours_to_50=1.62, age_band="75+", medical_needs=["oxygen"])
    assert risk_score(h, None) == risk_score(dict(h), None)
    assert isinstance(risk_score(h, None), int)

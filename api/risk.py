"""Deterministic risk score, 0-100. Pure function: no LLM, no clock, no I/O.

Gemini never touches this. A call only shifts the score through its mapped outcome.
"""

CAP = 100
TIME_MAX = 50           # points from the hours-to-50F countdown
TIME_WINDOW_H = 8.0     # countdown beyond this many storm hours adds nothing
LEAVING_SCORE = 5       # resident is on their way to safety

AGE_POINTS = {"75+": 15, "65-74": 9}
MEDICAL_POINTS = {"oxygen": 15, "heart": 9, "mobility": 9, "dialysis": 9}
MEDICAL_CAP = 24


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def risk_score(home: dict, call: dict | None) -> int:
    """home: one entry of the /api/homes shape. call: state.calls[home_id] or None."""
    call = call or {}
    outcome = call.get("outcome", "none")
    call_status = call.get("call_status", "none")

    if outcome == "leaving":
        return LEAVING_SCORE

    temp = home.get("temp_f")
    co = home.get("co_ppm") or 0.0
    heating = bool(home.get("heating"))
    h50 = home.get("hours_to_50")

    score = 0.0

    # Time pressure: the sooner the home hits 50F, the more points.
    if h50 is not None:
        score += TIME_MAX * _clamp(1 - h50 / TIME_WINDOW_H, 0.0, 1.0)

    # Current temperature band.
    if temp is not None:
        if temp < 50:
            score += 20
        elif temp < 60:
            score += 10

    if co >= 35:
        score += 30

    # Vulnerability only matters while the home is actually in trouble.
    safe_and_warm = heating and co < 35 and (temp is None or temp >= 60)
    if not safe_and_warm:
        score += AGE_POINTS.get(home.get("age_band") or "", 0)
        needs = {n for n in (home.get("medical_needs") or []) if n}
        score += min(MEDICAL_CAP, sum(MEDICAL_POINTS.get(n, 0) for n in needs))

    # What the check-in call found.
    if outcome == "needs_help":
        score += 15
    elif outcome == "medical":
        score += 20
    if outcome == "unreachable" or call_status == "unreachable":
        score += 20
    elif call_status == "no_answer":
        score += 10

    if not home.get("online", True):
        score += 5

    return int(min(CAP, round(score)))

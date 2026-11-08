"""Deterministic risk score, 0-100. Pure function: no LLM, no clock, no I/O.

Gemini never touches this. A call only shifts the score through its mapped outcome.
"""

CAP = 100
DEPTH_MAX = 30          # points for how far below 60F the home already is
TIME_MAX = 25           # points from the hours-to-50F countdown
TIME_WINDOW_H = 4.0     # countdown beyond this many storm hours adds nothing
LEAVING_SCORE = 5       # resident is on their way to safety

AGE_POINTS = {"75+": 15, "65-74": 9}
MEDICAL_POINTS = {"oxygen": 15, "heart": 9, "mobility": 9, "dialysis": 9}
MEDICAL_CAP = 24


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


HELPED_SCORE = 0          # a responder reached the home and power is back


def risk_score(home: dict, call: dict | None) -> int:
    """home: one entry of the /api/homes shape. call: state.calls[home_id] or None."""
    call = call or {}
    outcome = call.get("outcome", "none")
    call_status = call.get("call_status", "none")

    if outcome == "leaving":
        return LEAVING_SCORE
    if outcome == "helped" and (home.get("co_ppm") or 0.0) < 35:
        return HELPED_SCORE              # carbon monoxide still counts after help, until the air clears

    temp = home.get("temp_f")
    co = home.get("co_ppm") or 0.0
    h50 = home.get("hours_to_50")
    status = home.get("status")

    # Gate: a home is only ranked once it is in danger (below 60F and falling, below 50F, or CO).
    # A call result alone never puts a home on the list.
    if status not in ("warning", "critical") and co < 35:
        return 0

    score = 0.0
    if temp is not None:                        # how cold it already is: 0 at 60F, 30 at 40F
        score += DEPTH_MAX * _clamp((60 - temp) / 20, 0.0, 1.0)
    if h50 is not None:                         # how soon it reaches 50F
        score += TIME_MAX * _clamp(1 - h50 / TIME_WINDOW_H, 0.0, 1.0)
    if co >= 35:
        score += 30
    score += AGE_POINTS.get(home.get("age_band") or "", 0)
    needs = {n for n in (home.get("medical_needs") or []) if n}
    score += min(MEDICAL_CAP, sum(MEDICAL_POINTS.get(n, 0) for n in needs))

    # What the check-in call found (Gemini's reading of the transcript): reorders homes in danger.
    if outcome == "needs_help":
        score += 15
    elif outcome == "medical":
        score += 20
    elif outcome == "ok":
        score -= 15                             # resident says they are fine for now
    if outcome == "unreachable" or call_status == "unreachable":
        score += 35                             # nobody answered: assume the worst, send help
    elif call_status == "no_answer":
        score += 10

    if not home.get("online", True):
        score += 5

    return int(max(1, min(CAP, round(score))))   # in danger: always listed, even after an "ok" call

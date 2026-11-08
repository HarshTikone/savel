"""Deterministic scripted-resident behaviour. Same home, same answers, every run."""

SHY = {"H-18": "retry", "H-35": "never"}   # H-18 answers on the retry, H-35 never answers
SEVERE_NEEDS = {"oxygen", "dialysis", "heart"}


def profile_for(home: dict) -> str:
    """One of: medical, needs_help, leaving, ok. (Shy homes are handled by answers_attempt.)"""
    needs = set(home.get("medical_needs") or [])
    if needs & SEVERE_NEEDS:
        return "medical"
    if "mobility" in needs or home.get("age_band") == "75+":
        return "needs_help"
    try:
        n = int(str(home["id"]).split("-")[1])
    except (KeyError, IndexError, ValueError):
        n = 0
    return "leaving" if n % 3 == 0 else "ok"


def answers_attempt(home_id: str, attempt: int) -> bool:
    mode = SHY.get(home_id)
    if mode == "never":
        return False
    if mode == "retry":
        return attempt >= 2
    return True

"""STUB owned by Harsh: he replaces this file keeping the signature risk_score(home, call) -> int."""


def risk_score(home: dict, call: dict | None) -> int:
    base = {"heated": 0, "cooling": 20, "warning": 50, "critical": 80, "leaving": 0}[home["status"]]
    if home.get("medical_needs"): base += 15
    if home.get("age_band") == "75+": base += 10
    if not home.get("online", True): base += 10
    return min(100, base)

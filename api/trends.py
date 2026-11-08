"""Trend check: is a home really cooling? Pure maths on the last readings, no model, no randomness.

For every home in a block that has lost power we take the last WINDOW readings, fit a robust line
(Theil-Sen, so one bad spike cannot bend it) and label the direction. The block summary says how many
homes agree ("9 of 10 homes declining").
"""
import os
from datetime import datetime
from statistics import median

from fastapi import APIRouter

from api.db import get_pool
from api.state import state

router = APIRouter()
WINDOW = int(os.getenv("TREND_WINDOW", "15"))
MIN_POINTS = 6
DECLINE_F_PER_H = 1.0     # steeper than this counts as a real decline
FLAT_F_PER_H = 0.5        # inside +/- this the house is holding temperature
NOISE_STEP_F = 0.5        # one step up by less than this is sensor noise, not warming

WINDOW_SQL = """
SELECT home_id, extract(epoch FROM time) AS t, temp_f FROM (
  SELECT home_id, time, temp_f,
         row_number() OVER (PARTITION BY home_id ORDER BY time DESC) AS rn
  FROM readings
  WHERE run_id = $1 AND home_id = ANY($2::text[]) AND time <= $3::timestamptz
    AND time > $3::timestamptz - interval '3 hours'
) s WHERE rn <= $4 ORDER BY home_id, t;
"""


def theil_sen(points: list[tuple[float, float]]) -> tuple[float, float]:
    """(slope, intercept) = median of pairwise slopes; robust to outliers."""
    slopes = [(y2 - y1) / (x2 - x1)
              for i, (x1, y1) in enumerate(points) for x2, y2 in points[i + 1:] if x2 != x1]
    slope = median(slopes) if slopes else 0.0
    intercept = median(y - slope * x for x, y in points)
    return slope, intercept


def classify(points: list[tuple[float, float]]) -> dict:
    """points: (epoch seconds, temp_f), oldest first. Returns label, slope_f_per_h, fit, monotonic."""
    pts = sorted(points)
    n = len(pts)
    if n < MIN_POINTS:
        return {"label": "insufficient", "slope_f_per_h": None, "fit": None, "monotonic": None, "n": n}
    x0 = pts[0][0]
    rel = [(t - x0, y) for t, y in pts]
    slope, icpt = theil_sen(rel)
    mean_y = sum(y for _, y in rel) / n
    ss_tot = sum((y - mean_y) ** 2 for _, y in rel)
    ss_res = sum((y - (icpt + slope * x)) ** 2 for x, y in rel)
    fit = max(0.0, 1.0 - ss_res / ss_tot) if ss_tot > 1e-9 else 0.0
    diffs = [rel[i + 1][1] - rel[i][1] for i in range(n - 1)]
    monotonic = sum(1 for d in diffs if d <= NOISE_STEP_F) / len(diffs)
    per_h = slope * 3600.0
    half = n // 2
    s1, _ = theil_sen(rel[:half + 1])
    s2, _ = theil_sen(rel[half:])
    if per_h <= -DECLINE_F_PER_H:
        label = "slowing" if (s1 < 0 and s2 > s1 * 0.4) else "declining"
        if fit < 0.3:
            label = "noisy"
    elif per_h >= FLAT_F_PER_H:
        label = "rising"
    elif abs(per_h) <= FLAT_F_PER_H:
        label = "flat"
    else:
        label = "noisy"
    return {"label": label, "slope_f_per_h": round(per_h, 2), "fit": round(fit, 2),
            "monotonic": round(monotonic, 2), "n": n}


def summarize(block: str, homes: dict[str, dict]) -> dict:
    labels = [h["label"] for h in homes.values() if h["label"] != "insufficient"]
    declining = sum(1 for lb in labels if lb in ("declining", "slowing"))
    slopes = [h["slope_f_per_h"] for h in homes.values() if h["slope_f_per_h"] is not None]
    total = len(homes)
    if not labels:
        text = f"Block {block}: not enough readings yet"
    else:
        text = f"Block {block}: {declining} of {total} homes declining"
        if slopes:
            text += f", median {median(slopes):+.1f} F/h"
    return {"block": block, "homes": total, "declining": declining, "summary": text,
            "median_slope_f_per_h": round(median(slopes), 2) if slopes else None,
            "confirmed": bool(labels) and declining >= max(1, int(0.7 * total))}


@router.get("/api/trends")
async def trends():
    dark = [b["block"] for b in (state.sim_state or {}).get("blocks", []) if not b.get("power_on")]
    if not dark or not state.run_id or state.sim_now is None:
        return {"window": WINDOW, "blocks": [], "homes": {}}
    members = {b: [h["id"] for h in state.homes_cache if h["block"] == b] for b in dark}
    ids = [i for v in members.values() for i in v]
    pool = await get_pool()
    rows = await pool.fetch(WINDOW_SQL, state.run_id, ids, state.sim_now, WINDOW)
    series: dict[str, list[tuple[float, float]]] = {}
    for r in rows:
        series.setdefault(r["home_id"], []).append((float(r["t"]), float(r["temp_f"])))
    per_home = {hid: {**classify(series.get(hid, [])), "home_id": hid} for hid in ids}
    blocks = [summarize(b, {i: per_home[i] for i in members[b]}) for b in dark if members[b]]
    return {"window": WINDOW, "blocks": blocks, "homes": per_home}

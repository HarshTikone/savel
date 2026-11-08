import math
import random

from api import trends


def series(k, n=15, t0=68.0, out=5.0, step=150, noise=0.0, seed=1, spikes=()):
    rng = random.Random(seed)
    pts = []
    for i in range(n):
        t = out + (t0 - out) * math.exp(-k * i * step / 3600)
        v = t + rng.gauss(0, noise)
        if i in spikes:
            v += 3.5
        pts.append((i * step, v))
    return pts


def test_clean_decline():
    r = trends.classify(series(0.1))
    assert r["label"] == "declining" and r["slope_f_per_h"] < -4 and r["fit"] > 0.95


def test_noise_and_one_spike_still_declining():
    r = trends.classify(series(0.1, noise=0.25, spikes=(7,)))
    assert r["label"] == "declining"


def test_flat_and_rising():
    flat = [(i * 150, 67.0) for i in range(15)]
    rising = [(i * 150, 60 + 0.1 * i) for i in range(15)]
    assert trends.classify(flat)["label"] == "flat"
    assert trends.classify(rising)["label"] == "rising"


def test_too_few_points():
    assert trends.classify(series(0.1, n=3))["label"] == "insufficient"


def test_pure_noise_is_not_a_decline():
    rng = random.Random(3)
    pts = [(i * 150, 66 + rng.gauss(0, 0.4)) for i in range(15)]
    assert trends.classify(pts)["label"] in ("flat", "noisy")


def test_block_summary():
    homes = {f"H-{i}": trends.classify(series(0.1)) | {"home_id": f"H-{i}"} for i in range(9)}
    homes["H-9"] = trends.classify([(i * 150, 67.0) for i in range(15)]) | {"home_id": "H-9"}
    s = trends.summarize("B", homes)
    assert s["declining"] == 9 and s["homes"] == 10 and s["confirmed"]
    assert s["summary"].startswith("Block B: 9 of 10 homes declining")

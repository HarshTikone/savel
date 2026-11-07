import math
from datetime import timedelta

from api.queries import INSERT_PRED_SQL, K_FIT_SQL, fetch_accuracy, fetch_latest
from api.tests.conftest import T0, insert_readings


def cooling_rows(run_id, home_id, n, start=T0, k=0.1):
    return [{"time": start + timedelta(minutes=5 * i), "run_id": run_id, "home_id": home_id,
             "temp_f": 5 + 59 * math.exp(-k * (5 * i) / 60), "outdoor_f": 5.0, "heating": False}
            for i in range(n)]


async def test_k_fit(pool, run_id):
    rows = cooling_rows(run_id, "H-01", 15)
    await insert_readings(pool, rows)
    res = await pool.fetch(K_FIT_SQL, run_id, rows[-1]["time"])
    assert len(res) == 1
    assert abs(res[0]["k_per_hour"] - 0.10) <= 0.005
    assert res[0]["n"] == 10


async def test_k_fit_skips_heated_and_below_out(pool, run_id):
    a = cooling_rows(run_id, "H-02", 8)
    a += [{**r, "time": r["time"] + timedelta(hours=1), "heating": True} for r in cooling_rows(run_id, "H-02", 5)]
    b = cooling_rows(run_id, "H-03", 9)
    b += [{"time": T0 + timedelta(minutes=50 + 5 * i), "run_id": run_id, "home_id": "H-03",
           "temp_f": 5.4, "outdoor_f": 5.0, "heating": False} for i in range(3)]
    await insert_readings(pool, a + b)
    res = await pool.fetch(K_FIT_SQL, run_id, T0 + timedelta(hours=2))
    assert res == []  # each home has fewer than 10 usable rows


async def test_latest(pool, run_id):
    rows = cooling_rows(run_id, "H-04", 3) + cooling_rows(run_id, "H-05", 4)
    await insert_readings(pool, rows)
    latest = await fetch_latest(pool, run_id)
    assert set(latest) == {"H-04", "H-05"}
    assert latest["H-04"]["time"] == T0 + timedelta(minutes=10)
    assert latest["H-05"]["time"] == T0 + timedelta(minutes=15)


async def test_accuracy_interpolation(pool, run_id):
    t1 = T0.replace(hour=1, minute=0)
    await insert_readings(pool, [
        {"time": t1, "run_id": run_id, "home_id": "H-06", "temp_f": 60.0, "heating": False},
        {"time": t1 + timedelta(minutes=10), "run_id": run_id, "home_id": "H-06", "temp_f": 58.0, "heating": False},
    ])
    made = t1 - timedelta(minutes=30)
    await pool.execute(INSERT_PRED_SQL,
                       [made, made], [run_id, run_id], ["H-06", "H-06"], [30, 30], ["learned", "global"],
                       [t1 + timedelta(minutes=4), t1], [59.0, 59.5])
    rows = await fetch_accuracy(pool, run_id, t1 + timedelta(minutes=10))
    by = {(r["horizon_min"], r["k_source"]): r for r in rows}
    assert len(rows) == 4
    assert by[(30, "learned")]["mae_f"] == 0.20 and by[(30, "learned")]["n"] == 1
    assert by[(30, "global")]["mae_f"] == 0.50 and by[(30, "global")]["n"] == 1
    assert by[(60, "learned")] == {"horizon_min": 60, "k_source": "learned", "mae_f": None, "n": 0}
    assert by[(60, "global")]["n"] == 0

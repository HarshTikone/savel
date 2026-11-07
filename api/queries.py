"""All SQL lives here. Every query is scoped to the current run_id; time comes from sim_now."""
from datetime import datetime

# PRD "k fit" ($1 = run_id, $2 = sim_now), verbatim.
K_FIT_SQL = """
WITH recent AS (
  SELECT home_id, time, temp_f, outdoor_f,
         row_number() OVER (PARTITION BY home_id ORDER BY time DESC) AS rn
  FROM readings
  WHERE run_id = $1 AND NOT heating AND temp_f > outdoor_f + 0.5
    AND time > $2::timestamptz - interval '6 hours'  -- bounds the scan only
)
SELECT home_id,
       -regr_slope(ln(temp_f - outdoor_f), extract(epoch FROM time)) * 3600 AS k_per_hour,
       count(*) AS n
FROM recent
WHERE rn <= 10
GROUP BY home_id
HAVING count(*) >= 10;
"""

# Latest reading per home in the run ($1 = run_id).
LATEST_SQL = """
SELECT DISTINCT ON (home_id) home_id, time, temp_f, co_ppm, power_on, heating, outdoor_f
FROM readings WHERE run_id = $1
ORDER BY home_id, time DESC;
"""

# One home's readings for the chart ($1 = run_id, $2 = home_id, $3 = sim_now).
SERIES_SQL = """
SELECT time, temp_f FROM (
  SELECT time, temp_f FROM readings
  WHERE run_id = $1 AND home_id = $2 AND time > $3::timestamptz - interval '6 hours' AND time <= $3::timestamptz
  ORDER BY time DESC LIMIT 300
) s ORDER BY time;
"""

INSERT_PRED_SQL = """
INSERT INTO predictions (made_at, run_id, home_id, horizon_min, k_source, target_time, predicted_f)
SELECT * FROM unnest($1::timestamptz[], $2::text[], $3::text[], $4::int[], $5::text[],
                     $6::timestamptz[], $7::float8[]);
"""

HOMES_SQL = """
SELECT id, block, lat, lon, age_band, medical_needs, language, phone, battery FROM homes ORDER BY id;
"""

# PRD "Accuracy" ($1 = run_id, $2 = sim_now), verbatim.
ACCURACY_SQL = """
SELECT p.horizon_min, p.k_source,
  round(avg(abs(p.predicted_f - CASE WHEN b.time = a.time THEN a.temp_f
       ELSE a.temp_f + (b.temp_f - a.temp_f) * extract(epoch FROM p.target_time - a.time)
                                              / extract(epoch FROM b.time - a.time) END))::numeric, 2) AS mae_f,
  count(*) AS n
FROM predictions p
JOIN LATERAL (SELECT time, temp_f FROM readings r
              WHERE r.run_id = p.run_id AND r.home_id = p.home_id AND r.time <= p.target_time
              ORDER BY r.time DESC LIMIT 1) a ON true
JOIN LATERAL (SELECT time, temp_f FROM readings r
              WHERE r.run_id = p.run_id AND r.home_id = p.home_id AND r.time >= p.target_time
              ORDER BY r.time LIMIT 1) b ON true
WHERE p.run_id = $1 AND p.target_time <= $2
  AND NOT EXISTS (SELECT 1 FROM readings r
                  WHERE r.run_id = p.run_id AND r.home_id = p.home_id
                    AND r.time BETWEEN p.made_at AND p.target_time AND r.heating)
GROUP BY p.horizon_min, p.k_source
ORDER BY p.horizon_min, p.k_source;
"""

ACCURACY_GROUPS = [(30, "learned"), (30, "global"), (60, "learned"), (60, "global")]


async def fetch_k_fit(pool, run_id: str, sim_now: datetime) -> dict[str, float]:
    rows = await pool.fetch(K_FIT_SQL, run_id, sim_now)
    return {r["home_id"]: float(r["k_per_hour"]) for r in rows if r["k_per_hour"] is not None}


async def fetch_latest(pool, run_id: str) -> dict[str, dict]:
    return {r["home_id"]: dict(r) for r in await pool.fetch(LATEST_SQL, run_id)}


async def fetch_accuracy(pool, run_id: str | None, sim_now: datetime | None) -> list[dict]:
    """Always four rows (30/60 x learned/global); empty groups get mae_f None, n 0."""
    found = {}
    if run_id and sim_now:
        for r in await pool.fetch(ACCURACY_SQL, run_id, sim_now):
            found[(r["horizon_min"], r["k_source"])] = (float(r["mae_f"]), int(r["n"]))
    return [{"horizon_min": h, "k_source": k, "mae_f": found.get((h, k), (None, 0))[0],
             "n": found.get((h, k), (None, 0))[1]} for h, k in ACCURACY_GROUPS]

"""SAVEL simulator: 40 synthetic homes in North Buffalo during a winter storm.

Every real second it advances `speed` storm seconds, applies Newton cooling / furnace
heating / CO from blocked vents, and POSTs one batch of readings to INGEST_URL.
Timestamps are *simulated* UTC time. Control endpoints listen on :8001 (internal only).

    python sim/simulator.py                # run (performs one reset on startup)
    python sim/simulator.py --write-homes  # write sim/homes.json and exit
"""
from __future__ import annotations

import asyncio
import json
import logging
import math
import os
import random
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException

log = logging.getLogger("sim")
logging.basicConfig(level=logging.INFO, format="%(asctime)s sim %(levelname)s %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)

INGEST_URL = os.getenv("INGEST_URL", "http://localhost:8000/api/ingest")
SPEEDUP = int(os.getenv("SPEEDUP", "300"))
SEED = int(os.getenv("SEED", "42"))
PREWARM_BLOCK = os.getenv("PREWARM_BLOCK", "B").upper()
PREWARM_MINUTES = int(os.getenv("PREWARM_MINUTES", "80"))
OUTDOOR_F = float(os.getenv("OUTDOOR_F", "5"))
DEMO_PHONE_HOMES = os.getenv("DEMO_PHONE_HOMES", "")

HOMES_JSON = Path(__file__).resolve().parent / "homes.json"
BLOCKS = ["A", "B", "C", "D"]
CENTER = (42.9470, -78.8520)
BLOCK_OFFSETS = {"A": (0.006, -0.008), "B": (0.006, 0.008), "C": (-0.006, -0.008), "D": (-0.006, 0.008)}
LIVE_START = datetime(2026, 11, 8, 2, 0, 0, tzinfo=timezone.utc)  # 9:00 PM Buffalo
SETPOINT_F = 68.0
HEAT_RATE = 1.5           # per hour, approach to setpoint when heating
CO_RISE = 60.0            # ppm per storm hour with a blocked vent and a running furnace
CO_FALL = 120.0           # ppm per storm hour once the vent is clear
CO_TRIP, CO_UNTRIP, CO_CAP = 70.0, 5.0, 400.0
NOISE_F = 0.3
PLACEHOLDER_PHONE = "+1-000-000-0000"


# ---------------------------------------------------------------- homes
def parse_demo_phones(spec: str) -> dict[str, str]:
    out = {}
    for part in spec.split(","):
        if ":" in part:
            hid, phone = part.split(":", 1)
            out[hid.strip()] = phone.strip()
    return out


def build_homes(phones: dict[str, str] | None = None) -> list[dict]:
    """40 homes, fully deterministic from SEED. `phones` overrides demo-home numbers."""
    rng = random.Random(SEED)
    demo_ids = set(parse_demo_phones(DEMO_PHONE_HOMES)) or {"H-13", "H-16", "H-27"}
    phones = phones or {}
    homes = []
    for n in range(1, 41):
        hid = f"H-{n:02d}"
        block = BLOCKS[(n - 1) // 10]
        i = (n - 1) % 10
        dlat, dlon = BLOCK_OFFSETS[block]
        lat = CENTER[0] + dlat + (i // 5 - 0.5) * 0.0016 + rng.uniform(-0.0004, 0.0004)
        lon = CENTER[1] + dlon + (i % 5 - 2) * 0.0018 + rng.uniform(-0.0004, 0.0004)
        age_band = rng.choices(["18-39", "40-64", "65-74", "75+"], weights=[30, 35, 20, 15])[0]
        needs = []
        if rng.random() < 0.3:
            needs = rng.sample(["oxygen", "mobility", "heart", "dialysis"], rng.choice([1, 1, 2]))
        language = rng.choices(["en", "es", "ar", "bn"], weights=[70, 15, 8, 7])[0]
        battery = rng.random() < 0.75
        k = round(rng.uniform(0.05, 0.16), 3)
        t0 = round(rng.uniform(66.5, 69.5), 2)
        h = {
            "id": hid, "block": block, "lat": round(lat, 5), "lon": round(lon, 5),
            "age_band": age_band, "medical_needs": ",".join(needs), "language": language,
            "phone": f"+1-716-555-{100 + n:04d}", "battery": battery, "k_per_hour": k,
            "initial_temp_f": t0,
        }
        if hid == "H-13":
            h.update(medical_needs="oxygen", age_band="65-74")
        if hid == "H-16":
            h.update(age_band="75+", medical_needs="mobility")
        if hid == "H-27":
            h.update(medical_needs="")
        if hid in demo_ids:
            h.update(k_per_hour=0.14, battery=True, phone=phones.get(hid, PLACEHOLDER_PHONE))
        homes.append(h)
    return homes


# ---------------------------------------------------------------- simulation state
class Sim:
    def __init__(self) -> None:
        self.homes = build_homes(parse_demo_phones(DEMO_PHONE_HOMES))
        self.by_id = {h["id"]: h for h in self.homes}
        self.lock = asyncio.Lock()
        self.client: httpx.AsyncClient | None = None
        self.run_id = ""
        self.sim_now = LIVE_START
        self.speed = SPEEDUP
        self.outdoor_f = OUTDOOR_F
        self.power = {b: True for b in BLOCKS}
        self.temp: dict[str, float] = {}
        self.co: dict[str, float] = {}
        self.vent_blocked: dict[str, bool] = {}
        self.tripped: dict[str, bool] = {}
        self.noise = random.Random(SEED + 1)

    # -- physics
    def heating(self, hid: str) -> bool:
        return self.power[self.by_id[hid]["block"]] and not self.tripped[hid]

    def step(self, dt_s: float) -> None:
        dt_h = dt_s / 3600.0
        for h in self.homes:
            hid = h["id"]
            power_on = self.power[h["block"]]
            if self.vent_blocked[hid] and power_on and not self.tripped[hid]:
                self.co[hid] = min(CO_CAP, self.co[hid] + CO_RISE * dt_h)
                if self.co[hid] >= CO_TRIP:
                    self.tripped[hid] = True
            elif not self.vent_blocked[hid]:
                self.co[hid] = max(0.0, self.co[hid] - CO_FALL * dt_h)
                if self.tripped[hid] and self.co[hid] < CO_UNTRIP:
                    self.tripped[hid] = False
            t = self.temp[hid]
            if self.heating(hid):
                t += (SETPOINT_F - t) * (1 - math.exp(-HEAT_RATE * dt_h))
            else:
                t = self.outdoor_f + (t - self.outdoor_f) * math.exp(-h["k_per_hour"] * dt_h)
            self.temp[hid] = t
        self.sim_now += timedelta(seconds=dt_s)

    def batch(self) -> list[dict]:
        ts = self.sim_now.strftime("%Y-%m-%dT%H:%M:%SZ")
        rows = []
        for h in self.homes:
            hid = h["id"]
            power_on = self.power[h["block"]]
            if not power_on and not h["battery"]:
                continue  # sensor offline: no mains, no battery
            rows.append({
                "time": ts, "home_id": hid,
                "temp_f": round(self.temp[hid] + self.noise.uniform(-NOISE_F, NOISE_F), 2),
                "co_ppm": round(self.co[hid], 2), "power_on": power_on,
                "heating": self.heating(hid), "outdoor_f": self.outdoor_f, "run_id": self.run_id,
            })
        return rows

    async def post(self, rows: list[dict]) -> None:
        if not rows or self.client is None:
            return
        try:
            r = await self.client.post(INGEST_URL, json=rows)
            if r.status_code >= 300:
                log.warning("ingest %s: %s", r.status_code, r.text[:200])
        except httpx.HTTPError as e:
            log.warning("ingest unreachable: %s", e.__class__.__name__)

    # -- run control (caller holds the lock)
    async def reset(self, prewarm: int) -> dict:
        rid = "r-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")  # identifier only
        if rid == self.run_id or self.run_id.startswith(rid + "-"):
            suffix = int(self.run_id.rsplit("-", 1)[1]) + 1 if self.run_id.startswith(rid + "-") else 2
            rid = f"{rid}-{suffix}"
        self.run_id = rid
        self.noise = random.Random(SEED + 1)
        self.speed = SPEEDUP
        self.outdoor_f = OUTDOOR_F
        self.power = {b: True for b in BLOCKS}
        for h in self.homes:
            self.temp[h["id"]] = h["initial_temp_f"]
            self.co[h["id"]] = 0.0
            self.vent_blocked[h["id"]] = False
            self.tripped[h["id"]] = False
        # Open at 9:00 PM with PREWARM_BLOCK already `prewarm` storm minutes into its outage.
        self.sim_now = LIVE_START - timedelta(minutes=prewarm)
        if prewarm > 0:
            self.power[PREWARM_BLOCK] = False
            steps = prewarm // 5
            for _ in range(steps):
                self.step(300)
                await self.post(self.batch())
            rest = prewarm - steps * 5
            if rest:
                self.step(rest * 60)
        log.info("reset run_id=%s prewarm=%s sim_now=%s", rid, prewarm, self.sim_now.isoformat())
        return {"run_id": rid, "sim_now": iso(self.sim_now), "speed": self.speed, "prewarm": prewarm}

    def state(self) -> dict:
        return {
            "run_id": self.run_id, "sim_now": iso(self.sim_now), "outdoor_f": self.outdoor_f,
            "speed": self.speed, "blocks": [{"block": b, "power_on": self.power[b]} for b in BLOCKS],
        }

    async def tick_forever(self) -> None:
        loop = asyncio.get_running_loop()
        while True:
            started = loop.time()
            try:
                async with self.lock:
                    self.step(self.speed)
                    await self.post(self.batch())
            except Exception:  # never let the tick loop die
                log.exception("tick failed")
            await asyncio.sleep(max(0.0, 1.0 - (loop.time() - started)))


def iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


sim = Sim()


@asynccontextmanager
async def lifespan(_: FastAPI):
    sim.client = httpx.AsyncClient(timeout=3.0)
    async with sim.lock:
        await sim.reset(PREWARM_MINUTES)
    task = asyncio.create_task(sim.tick_forever())
    yield
    task.cancel()
    await sim.client.aclose()


app = FastAPI(title="SAVEL simulator", lifespan=lifespan)


def _block(block: str) -> str:
    b = block.upper()
    if b not in BLOCKS:
        raise HTTPException(404, f"unknown block {block}")
    return b


def _home(home_id: str) -> str:
    if home_id not in sim.by_id:
        raise HTTPException(404, f"unknown home {home_id}")
    return home_id


@app.post("/cut_power/{block}")
async def cut_power(block: str):
    async with sim.lock:
        sim.power[_block(block)] = False
    return sim.state()


@app.post("/restore_power/{block}")
async def restore_power(block: str):
    async with sim.lock:
        sim.power[_block(block)] = True
    return sim.state()


@app.post("/block_vent/{home_id}")
async def block_vent(home_id: str):
    async with sim.lock:
        sim.vent_blocked[_home(home_id)] = True
    return {"home_id": home_id, "vent_blocked": True}


@app.post("/clear_vent/{home_id}")
async def clear_vent(home_id: str):
    async with sim.lock:
        sim.vent_blocked[_home(home_id)] = False
    return {"home_id": home_id, "vent_blocked": False}


@app.post("/outdoor/{temp_f}")
async def outdoor(temp_f: str):
    try:
        v = float(temp_f)
    except ValueError:
        raise HTTPException(400, f"bad outdoor temperature {temp_f}")
    if not -30 <= v <= 60:
        raise HTTPException(400, "outdoor_f must be between -30 and 60")
    async with sim.lock:
        sim.outdoor_f = v
    return sim.state()


@app.post("/speed/{x}")
async def speed(x: str):
    try:
        v = int(x)
    except ValueError:
        raise HTTPException(400, f"bad speed {x}")
    if not 1 <= v <= 3600:
        raise HTTPException(400, "speed must be between 1 and 3600")
    async with sim.lock:
        sim.speed = v
    return sim.state()


@app.post("/reset")
async def reset(prewarm: int | None = None):
    p = PREWARM_MINUTES if prewarm is None else prewarm
    if not 0 <= p <= 600:
        raise HTTPException(400, "prewarm must be between 0 and 600 minutes")
    async with sim.lock:
        return await sim.reset(p)


@app.get("/state")
async def state():
    return sim.state()


@app.get("/homes")
async def homes():
    return [{k: v for k, v in h.items() if k != "initial_temp_f"} for h in sim.homes]


def write_homes() -> None:
    homes = build_homes()  # placeholder phones only; real numbers come from runtime env
    out = [{k: v for k, v in h.items() if k != "initial_temp_f"} for h in homes]
    HOMES_JSON.write_text(json.dumps(out, indent=2) + "\n")
    print(f"wrote {len(out)} homes to {HOMES_JSON}")


if __name__ == "__main__":
    if "--write-homes" in sys.argv:
        write_homes()
        sys.exit(0)
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("SIM_PORT", "8001")), log_level="warning")

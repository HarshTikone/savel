"""Upsert sim/homes.json into the homes table.  Usage: python -m api.seed_homes"""
import asyncio
import json
import os
from pathlib import Path

import asyncpg

from api.db import DATABASE_URL

HOMES_JSON = Path(__file__).resolve().parent.parent / "sim" / "homes.json"

UPSERT_SQL = """
INSERT INTO homes (id, block, lat, lon, age_band, medical_needs, language, phone, battery)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
ON CONFLICT (id) DO UPDATE SET block = EXCLUDED.block, lat = EXCLUDED.lat, lon = EXCLUDED.lon,
  age_band = EXCLUDED.age_band, medical_needs = EXCLUDED.medical_needs,
  language = EXCLUDED.language, phone = EXCLUDED.phone, battery = EXCLUDED.battery
"""


def demo_phones() -> dict[str, str]:
    out = {}
    for part in os.getenv("DEMO_PHONE_HOMES", "").split(","):
        if ":" in part:
            hid, phone = part.split(":", 1)
            out[hid.strip()] = phone.strip()
    return out


async def seed(conn) -> int:
    homes = json.loads(HOMES_JSON.read_text())
    phones = demo_phones()
    await conn.executemany(UPSERT_SQL, [
        (h["id"], h["block"], h["lat"], h["lon"], h.get("age_band"), h.get("medical_needs", ""),
         h.get("language", "en"), phones.get(h["id"], h.get("phone")), h.get("battery", True))
        for h in homes
    ])
    return len(homes)


async def main() -> None:
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        n = await seed(conn)
        print(f"seeded {n} homes")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())

"""Live check: one real Gemini extraction. Usage: python scripts/test_gemini.py (reads .env, prints no secrets)."""
import asyncio
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
for line in pathlib.Path(".env").read_text().splitlines():
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1)
        import os; os.environ.setdefault(k.strip(), v.strip())

from api.agent.extract import extract, map_outcome

T = [{"role": "agent", "text": "Hi, this is SAVEL checking on you. Do you have heat?"},
     {"role": "resident", "text": "No, it's freezing. My mother uses oxygen and I can't drive anywhere."}]


async def main():
    d = await extract(T)
    print(d, "->", map_outcome(d))
    assert d["source"] == "gemini", "Gemini was not used; check GEMINI_API_KEY / model"

asyncio.run(main())

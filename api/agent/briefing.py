"""Responder briefings. Gemini writes the prose from facts we pass in; a template is the fallback.

Briefings explain the ranking. They never change it (risk is api/risk.py, deterministic).
"""
import asyncio
import logging
import os

from fastapi import APIRouter, HTTPException

from api.agent import manager
from api.state import state

log = logging.getLogger("api.agent.briefing")
router = APIRouter()
TIMEOUT_S = float(os.getenv("GEMINI_TIMEOUT_S", "12"))
_cache: dict[tuple, dict] = {}

FACT_RULES = ("Use ONLY the facts given. Do not invent names, addresses, numbers or medical details. "
              "Plain language, no markdown, no bullet characters.")


def _hours(h):
    return "not cooling" if h is None else ("below 50F now" if h <= 0 else f"about {h:.1f} hours to 50F")


def home_facts(home: dict) -> str:
    last = manager.last_extracted.get(home["id"])
    call = ""
    if last and last["run_id"] == state.run_id:
        e = last["extracted"]
        call = f" Call result ({last['source']}): {e.get('summary') or 'no summary'}."
    needs = ", ".join(home.get("medical_needs") or []) or "none listed"
    return (f"Home {home['id']} on Block {home['block']}: {home['temp_f']}F indoors, {_hours(home.get('hours_to_50'))}. "
            f"Heating: {'on' if home['heating'] else 'off'}. CO {home['co_ppm']} ppm. Resident age band: {home.get('age_band') or 'unknown'}, "
            f"medical needs: {needs}, language: {home.get('language')}. Sensor {'online' if home['online'] else 'offline (estimated)'}. "
            f"Risk score {home['risk']} of 100, status {home['status']}, call status {home['call_status']}, outcome {home['outcome']}.{call}")


def template_briefing(home: dict) -> str:
    action = {"medical": "Send medical help first.", "needs_help": "Send a responder; resident asked for help.",
              "unreachable": "Resident did not answer twice; do an in-person welfare check.",
              "leaving": "Resident is leaving for a warm place; confirm arrival."}.get(
        home["outcome"], "Monitor; check in again if the temperature keeps falling.")
    if home["co_ppm"] >= 35:
        action = "Possible carbon monoxide. Get the resident out and send help now."
    return home_facts(home) + " Recommended action: " + action


def _gemini_sync(prompt: str) -> str:
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    r = client.models.generate_content(model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"), contents=prompt,
                                       config=types.GenerateContentConfig(temperature=0.2))
    return (r.text or "").strip()


async def _write(prompt: str, fallback: str) -> tuple[str, str]:
    if os.getenv("GEMINI_API_KEY"):
        try:
            text = await asyncio.wait_for(asyncio.to_thread(_gemini_sync, prompt), TIMEOUT_S)
            if text:
                return text, "gemini"
        except Exception as e:
            log.warning("gemini briefing failed (%s); using template", type(e).__name__)
    return fallback, "template"


async def home_briefing(home: dict) -> dict:
    key = ("home", state.run_id, home["id"], home["outcome"], home["status"], home["risk"] // 10)
    if key not in _cache:
        prompt = ("Write a 3 sentence briefing for an emergency responder about this home. Say who is at risk, why, and "
                  f"the recommended action. {FACT_RULES}\n\n{home_facts(home)}")
        text, source = await _write(prompt, template_briefing(home))
        _cache[key] = {"home_id": home["id"], "text": text, "source": source}
    return _cache[key]


async def incident_summary(homes: list[dict]) -> dict:
    top = homes[:5]
    cold = sum(1 for h in homes if h["status"] in ("warning", "critical"))
    facts = f"{cold} of {len(homes)} homes are in warning or critical. Top priorities:\n" + "\n".join(home_facts(h) for h in top)
    key = ("incident", state.run_id, tuple((h["id"], h["outcome"], h["status"], h["risk"] // 10) for h in top), cold)
    if key not in _cache:
        fallback = (f"{cold} of {len(homes)} homes are in warning or critical. Top priorities: "
                    + "; ".join(f"{h['id']} (risk {h['risk']}, {h['outcome']})" for h in top) + ".")
        prompt = f"Write a 4 sentence incident summary for the incident commander. {FACT_RULES}\n\n{facts}"
        text, source = await _write(prompt, fallback)
        _cache[key] = {"text": text, "source": source, "homes_at_risk": cold}
    return _cache[key]


@router.get("/api/homes/{home_id}/briefing")
async def briefing_route(home_id: str):
    home = next((h for h in state.homes_cache if h["id"] == home_id), None)
    if home is None:
        raise HTTPException(404, f"unknown home {home_id}")
    return await home_briefing(home)


@router.get("/api/incident/summary")
async def incident_route():
    if not state.homes_cache:
        return {"text": "No data yet.", "source": "template", "homes_at_risk": 0}
    return await incident_summary(state.homes_cache)

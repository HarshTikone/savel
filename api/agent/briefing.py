"""Responder briefings. Gemini writes the prose from facts we pass in; a template is the fallback.

Briefings explain the ranking. They never change it (risk is api/risk.py, deterministic).
"""
import asyncio
import logging
import os

from fastapi import APIRouter, HTTPException

from api.agent import manager
from api.agent.extract import gemini_models
from api.state import state

log = logging.getLogger("api.agent.briefing")
router = APIRouter()
TIMEOUT_S = float(os.getenv("GEMINI_TIMEOUT_S", "12"))
_cache: dict[tuple, dict] = {}

FACT_RULES = ("Use ONLY the facts given. Do not invent names, addresses, numbers or medical details. "
              "Plain language, no markdown, no bullet characters.")


def _hours(h):
    return "not cooling" if h is None else ("below 50F now" if h <= 0 else f"about {h:.1f} hours to 50F")


CALL_WORDS = {"ok": "answered and said they are fine", "needs_help": "answered and asked for help",
              "medical": "answered and reported a medical problem", "leaving": "answered and is leaving for a warm place",
              "unreachable": "did not answer the check-in call"}


def live_home(home: dict) -> dict:
    """The cached home plus the call state as it is right now (calls change between loop cycles)."""
    c = state.calls.get(home["id"])
    if not c:
        return home
    return {**home, "call_status": c.get("call_status", home.get("call_status")), "outcome": c.get("outcome", home.get("outcome")),
            "call_result": c.get("call_result") or home.get("call_result")}


def _call_line(home: dict) -> str:
    result = home.get("call_result") or (home["outcome"] if home["outcome"] in CALL_WORDS else None)
    if home.get("call_status") in ("ringing", "in_call"):
        return "Check-in call in progress."
    if not result:
        return "Not called yet."
    line = f"Resident {CALL_WORDS.get(result, result)}."
    last = manager.last_extracted.get(home["id"])
    if last and last["run_id"] == state.run_id and result != "unreachable":
        summary = (last["extracted"] or {}).get("summary")
        if summary:
            line += f" Call summary: {summary}"
    return line


def home_facts(home: dict) -> str:
    needs = ", ".join(home.get("medical_needs") or []) or "none listed"
    slope = home.get("slope_f_per_h")
    trend = ("heating on" if home.get("heating") else
             f"falling {abs(slope):.1f}F per hour" if slope is not None and slope < 0 else "holding steady")
    helped = " Help has been delivered and power restored." if home["outcome"] == "helped" else ""
    return (f"Home {home['id']} on Block {home['block']}: {home['temp_f']}F indoors, {trend}, {_hours(home.get('hours_to_50'))}. "
            f"Power {'on' if home.get('power_on') else 'off'}. CO {home['co_ppm']} ppm. Resident age band: {home.get('age_band') or 'unknown'}, "
            f"medical needs: {needs}, language: {home.get('language')}. Sensor {'online' if home['online'] else 'offline (estimated)'}. "
            f"Risk score {home['risk']} of 100, status {home['status']}. {_call_line(home)}{helped}")


def recommended_action(home: dict) -> str:
    if home["co_ppm"] >= 35:
        return "Possible carbon monoxide: get the resident out and send help now."
    if home["outcome"] == "helped":
        return "Help delivered; keep monitoring until the home is warm again."
    if home.get("heating") and home["status"] in ("recovering", "heated"):
        return "Power is back; monitor until the home is warm."
    result = home.get("call_result") or home["outcome"]
    return {"medical": "Send medical help first.", "needs_help": "Send a responder; the resident asked for help.",
            "unreachable": "No answer: send someone in person now.",
            "leaving": "Resident is leaving for a warm place; confirm they arrived.",
            "ok": "Resident says they are fine; call again if the temperature keeps falling."}.get(
        result, "Send help first if it keeps falling below 50F." if home["status"] == "critical"
        else "Monitor; the check-in call goes out automatically.")


def template_briefing(home: dict) -> str:
    """Short handoff a responder can read in five seconds; used when Gemini is unavailable."""
    needs = ", ".join(home.get("medical_needs") or [])
    who = ", ".join(x for x in [home.get("age_band"), f"on {needs}" if needs else ""] if x)
    slope = home.get("slope_f_per_h")
    temp = f"{home['temp_f']:.0f}F" + (" and falling" if (slope is not None and slope < 0 and not home.get("heating")) else "")
    result = home.get("call_result") or (home["outcome"] if home["outcome"] in CALL_WORDS else None)
    call = {"unreachable": "didn't answer", "needs_help": "asked for help", "medical": "reported a medical problem",
            "ok": "said they're fine", "leaving": "is leaving"}.get(result, "")
    parts = [home["id"], who, temp, call]
    head = ", ".join(p for p in parts if p)
    return f"{head}. {recommended_action(home)}"


def _gemini_sync(prompt: str) -> str:
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    last = None
    for model in gemini_models():
        try:
            r = client.models.generate_content(model=model, contents=prompt,
                                               config=types.GenerateContentConfig(temperature=0.2))
            return (r.text or "").strip()
        except Exception as e:
            log.warning("gemini model %s failed (%s)", model, type(e).__name__)
            last = e
    raise last


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
    key = ("home", state.run_id, home["id"], home["outcome"], home.get("call_result"), home["status"],
           home["risk"] // 10, int(home["temp_f"] // 3))
    if key not in _cache:
        prompt = ("Write a short handoff for an emergency responder about this home, at most 2 sentences and 45 words. "
                  "Start with the home id, then who is at risk and why, then the action. Lead with urgency if the resident "
                  f"did not answer, needs help, or the home is below 50F. {FACT_RULES}\n\nRule-based recommended action: "
                  f"{recommended_action(home)}\n\n{home_facts(home)}")
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
    return await home_briefing(live_home(home))


@router.get("/api/incident/summary")
async def incident_route():
    if not state.homes_cache:
        return {"text": "No data yet.", "source": "template", "homes_at_risk": 0}
    return await incident_summary(state.homes_cache)

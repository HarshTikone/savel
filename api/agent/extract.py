"""Turn a call transcript into structured facts. Gemini first, keyword fallback second.

Extraction only describes what the resident said. It never sets risk or ranking:
api/risk.py does that from the mapped outcome.
"""
import asyncio
import json
import logging
import os
import re

log = logging.getLogger("api.agent.extract")

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_TIMEOUT_S = float(os.getenv("GEMINI_TIMEOUT_S", "12"))
FIELDS = ("has_heat", "needs_help", "medical_issue", "can_leave")

PROMPT = """You read a short welfare check-in call between an automated agent and a resident during a winter power outage.
Return JSON only, describing what the RESIDENT said:
- has_heat: true if they have working heat, false if not, null if unclear
- needs_help: true if they ask for or clearly need help, false if they say they are fine, null if unclear
- medical_issue: true if they or someone with them has a medical problem (oxygen, chest pain, breathing, dizziness, dialysis), else false
- can_leave: true if they can and will go somewhere warm, false if they cannot, null if unclear
- summary: one plain sentence for a responder
Never invent facts. If the transcript is empty or the resident never answered, use null and false as appropriate.

Transcript:
"""

SCHEMA = {
    "type": "object",
    "properties": {
        "has_heat": {"type": "boolean", "nullable": True},
        "needs_help": {"type": "boolean", "nullable": True},
        "medical_issue": {"type": "boolean"},
        "can_leave": {"type": "boolean", "nullable": True},
        "summary": {"type": "string"},
    },
    "required": ["has_heat", "needs_help", "medical_issue", "can_leave", "summary"],
}


def transcript_text(transcript: list[dict] | str | None) -> str:
    if not transcript:
        return ""
    if isinstance(transcript, str):
        return transcript
    return "\n".join(f"{t.get('role', 'unknown')}: {t.get('text', '')}" for t in transcript)


def _resident_lines(text: str) -> str:
    lines = [ln.split(":", 1)[1] for ln in text.splitlines()
             if ln.lower().startswith(("resident:", "user:"))]
    return " ".join(lines) if lines else text


def _has(text: str, words: tuple) -> bool:
    return any(re.search(w, text) for w in words)


def fallback_extract(text: str) -> dict:
    """Deterministic keyword extractor (English and Spanish). Used when Gemini is down."""
    t = _resident_lines(text).lower()
    if not t.strip():
        return {"has_heat": None, "needs_help": None, "medical_issue": False,
                "can_leave": None, "summary": "No response from resident.", "source": "fallback"}
    no_heat = _has(t, (r"no heat", r"without heat", r"\bfreezing\b", r"it'?s cold", r"heat (is )?(off|out|not)",
                       r"sin calefacci", r"hace frio", r"hace frío"))
    has_heat = False if no_heat else (True if _has(t, (r"heat (is )?(on|working)", r"\bwarm\b", r"tengo calefacci")) else None)
    medical = _has(t, (r"oxygen", r"chest", r"breath", r"dizzy", r"dialysis", r"insulin", r"ox[ií]geno", r"respirar", r"\bsick\b", r"\bfaint"))
    help_ = _has(t, (r"need help", r"\bhelp\b", r"ayuda", r"\bscared\b", r"can'?t cope"))
    fine = _has(t, (r"i'?m (fine|okay|ok)", r"we'?re (fine|okay|ok)", r"no help", r"estoy bien"))
    needs_help = True if (help_ and not fine) or medical or no_heat and not fine else (False if fine else None)
    cant = _has(t, (r"can'?t (leave|drive|walk|go)", r"cannot (leave|drive)", r"no puedo", r"no car", r"stuck"))
    can = _has(t, (r"i can (leave|go|drive)", r"on my way", r"going to (my|a) (sister|friend|shelter|neighbor)", r"puedo ir"))
    can_leave = False if cant else (True if can else None)
    bits = []
    bits.append("no heat" if has_heat is False else "heat reported working" if has_heat else "heat status unclear")
    if medical:
        bits.append("medical concern mentioned")
    if can_leave is False:
        bits.append("cannot leave")
    elif can_leave:
        bits.append("able to leave")
    return {"has_heat": has_heat, "needs_help": needs_help, "medical_issue": medical,
            "can_leave": can_leave, "summary": ", ".join(bits).capitalize() + ".", "source": "fallback"}


def _gemini_sync(text: str) -> dict:
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    resp = client.models.generate_content(
        model=GEMINI_MODEL, contents=PROMPT + text,
        config=types.GenerateContentConfig(response_mime_type="application/json",
                                           response_schema=SCHEMA, temperature=0))
    return json.loads(resp.text)


def _clean(d: dict, source: str) -> dict:
    out = {}
    for k in ("has_heat", "needs_help", "can_leave"):
        v = d.get(k)
        out[k] = v if isinstance(v, bool) else None
    out["medical_issue"] = bool(d.get("medical_issue"))
    out["summary"] = str(d.get("summary") or "")[:300]
    out["source"] = source
    return out


async def extract(transcript: list[dict] | str | None) -> dict:
    """Never raises. Returns the four fields plus summary and source ('gemini' or 'fallback')."""
    text = transcript_text(transcript)
    if text.strip() and os.getenv("GEMINI_API_KEY"):
        try:
            data = await asyncio.wait_for(asyncio.to_thread(_gemini_sync, text), GEMINI_TIMEOUT_S)
            return _clean(data, "gemini")
        except Exception as e:  # network, quota, bad JSON: keep the demo alive
            log.warning("gemini extraction failed (%s); using fallback", type(e).__name__)
    return _clean(fallback_extract(text), "fallback")


def map_outcome(extracted: dict | None) -> str:
    """Extraction -> outcome enum. Unreachable is decided by the call manager, not here."""
    if not extracted:
        return "none"
    if extracted.get("needs_help") and extracted.get("medical_issue"):
        return "medical"
    if extracted.get("needs_help"):
        return "needs_help"
    if extracted.get("can_leave") and extracted.get("needs_help") is not True:
        return "leaving"
    return "ok"

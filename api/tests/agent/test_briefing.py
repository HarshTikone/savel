import httpx
import pytest

from api.agent import briefing, manager
from api.state import state


def home(**kw):
    h = {"id": "H-13", "block": "B", "temp_f": 56.0, "co_ppm": 0.0, "heating": False, "hours_to_50": 1.6,
         "age_band": "75+", "medical_needs": ["oxygen"], "language": "en", "online": True, "risk": 78,
         "status": "warning", "call_status": "done", "outcome": "medical"}
    h.update(kw)
    return h


def test_facts_and_template():
    t = briefing.template_briefing(home())
    assert "H-13" in t and "oxygen" in t and "medical help" in t
    assert "about 1.6 hours" in briefing.home_facts(home())
    assert "carbon monoxide" in briefing.template_briefing(home(co_ppm=50, outcome="none"))


def test_short_handoff_for_an_unanswered_call():
    t = briefing.template_briefing(home(temp_f=48.2, slope_f_per_h=-6.5, status="critical", call_status="unreachable",
                                        outcome="unreachable", call_result="unreachable"))
    assert t.startswith("H-13, 75+, on oxygen, 48F and falling, didn't answer.")
    assert "send someone in person" in t
    assert len(t.split()) <= 25


def test_helped_home_and_call_result_kept():
    h = home(outcome="helped", call_result="unreachable", heating=True, status="recovering", power_on=True)
    assert "keep monitoring" in briefing.template_briefing(h)
    facts = briefing.home_facts(h)
    assert "did not answer" in facts and "Help has been delivered" in facts


@pytest.fixture
async def web(monkeypatch):
    from api.main import app
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    briefing._cache.clear()
    manager.last_extracted.clear()
    state.run_id, state.homes_cache = "r-b", [home(), home(id="H-14", risk=10, outcome="ok", status="heated", heating=True)]
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
        yield c


async def test_routes(web):
    r = await web.get("/api/homes/H-13/briefing")
    assert r.status_code == 200 and r.json()["source"] == "template" and "H-13" in r.json()["text"]
    assert (await web.get("/api/homes/H-99/briefing")).status_code == 404
    s = (await web.get("/api/incident/summary")).json()
    assert s["homes_at_risk"] == 1 and "H-13" in s["text"]


async def test_gemini_text_used_when_available(web, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "x")
    monkeypatch.setattr(briefing, "_gemini_sync", lambda p: "Briefing from gemini.")
    r = await web.get("/api/homes/H-13/briefing")
    assert r.json() == {"home_id": "H-13", "text": "Briefing from gemini.", "source": "gemini"}


async def test_gemini_failure_falls_back(web, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "x")
    def boom(p): raise RuntimeError("x")
    monkeypatch.setattr(briefing, "_gemini_sync", boom)
    assert (await web.get("/api/homes/H-13/briefing")).json()["source"] == "template"

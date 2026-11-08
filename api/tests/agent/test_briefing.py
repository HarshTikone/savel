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
    assert "H-13" in t and "oxygen" in t and "about 1.6 hours" in t and "medical help" in t
    assert "carbon monoxide" in briefing.template_briefing(home(co_ppm=50, outcome="none"))


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

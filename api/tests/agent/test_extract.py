import pytest

from api.agent import extract as ex


def tr(*resident):
    out = []
    for r in resident:
        out += [{"role": "agent", "text": "Are you okay?"}, {"role": "resident", "text": r}]
    return out


def test_no_heat_oxygen_cant_leave_is_medical():
    d = ex.fallback_extract(ex.transcript_text(tr("It's freezing, no heat. My mother uses oxygen and I can't drive.")))
    assert d["has_heat"] is False and d["medical_issue"] and d["can_leave"] is False
    assert ex.map_outcome(d) == "medical"


def test_fine_resident_is_ok():
    d = ex.fallback_extract(ex.transcript_text(tr("I'm fine, heat is on, thanks.")))
    assert d["needs_help"] is False and d["has_heat"] is True
    assert ex.map_outcome(d) == "ok"


def test_leaving():
    d = ex.fallback_extract(ex.transcript_text(tr("It's cold but I'm fine, I'm on my way to my sister's.")))
    assert ex.map_outcome(d) == "leaving"


def test_needs_help_without_medical():
    d = ex.fallback_extract(ex.transcript_text(tr("No heat and I need help, please.")))
    assert ex.map_outcome(d) == "needs_help"


def test_spanish():
    d = ex.fallback_extract(ex.transcript_text(tr("Hace frio, no tengo calefaccion y necesito ayuda, uso oxigeno.")))
    assert d["has_heat"] is False and d["medical_issue"] and ex.map_outcome(d) == "medical"


def test_empty_transcript():
    d = ex.fallback_extract("")
    assert d["has_heat"] is None and ex.map_outcome(d) == "ok"
    assert ex.map_outcome(None) == "none"


async def test_extract_uses_fallback_without_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    d = await ex.extract(tr("No heat, need help"))
    assert d["source"] == "fallback" and d["needs_help"] is True


async def test_extract_falls_back_on_gemini_error(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "x")
    def boom(_): raise RuntimeError("down")
    monkeypatch.setattr(ex, "_gemini_sync", boom)
    d = await ex.extract(tr("No heat, need help"))
    assert d["source"] == "fallback"


async def test_extract_uses_gemini_when_ok(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "x")
    monkeypatch.setattr(ex, "_gemini_sync", lambda _: {"has_heat": False, "needs_help": True,
                        "medical_issue": False, "can_leave": None, "summary": "s"})
    d = await ex.extract(tr("anything"))
    assert d["source"] == "gemini" and ex.map_outcome(d) == "needs_help"


def test_transcript_text_accepts_plain_strings():
    t = ex.transcript_text(["SAVEL: hi", "Resident: no heat"])
    assert t == "SAVEL: hi\nResident: no heat"
    assert ex.fallback_extract(t)["has_heat"] is False


def test_gemini_model_order(monkeypatch):
    monkeypatch.setenv("GEMINI_MODEL", "a-model")
    assert ex.gemini_models() == ["a-model", ex.GEMINI_FALLBACK_MODEL]
    monkeypatch.setenv("GEMINI_MODEL", ex.GEMINI_FALLBACK_MODEL)
    assert ex.gemini_models() == [ex.GEMINI_FALLBACK_MODEL]

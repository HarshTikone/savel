import hashlib
import hmac
import json

import httpx
import pytest

from api import calls
from api.agent import elevenlabs as el
from api.agent import manager

SECRET = "whsec_test"


def sign(body: bytes, ts="1700000000", secret=SECRET):
    sig = hmac.new(secret.encode(), f"{ts}.".encode() + body, hashlib.sha256).hexdigest()
    return f"t={ts},v0={sig}"


PAYLOAD = {"type": "post_call_transcription", "data": {
    "transcript": [{"role": "agent", "message": "Is your heat on?"}, {"role": "user", "message": "No heat, need help"},
                   {"role": "user", "message": None}],
    "conversation_initiation_client_data": {"dynamic_variables": {"home_id": "H-13", "resident_label": "x"}}}}


def test_signature():
    body = b'{"a":1}'
    assert el.verify_signature(body, sign(body), SECRET)
    assert not el.verify_signature(body, sign(body, secret="other"), SECRET)
    assert not el.verify_signature(body + b" ", sign(body), SECRET)
    assert not el.verify_signature(body, None, SECRET)
    assert not el.verify_signature(body, sign(body), "")


def test_parse():
    home, lines = el.parse_post_call(PAYLOAD)
    assert home == "H-13" and lines == ["SAVEL: Is your heat on?", "Resident: No heat, need help"]
    assert el.parse_post_call({"type": "post_call_audio"}) is None


@pytest.fixture
async def web(monkeypatch):
    from api.main import app
    seen = []

    async def fake(home_id, lines):
        seen.append((home_id, lines))
        return True

    monkeypatch.setattr(manager, "handle_live_transcript", fake)
    monkeypatch.setenv("ELEVENLABS_WEBHOOK_SECRET", SECRET)
    monkeypatch.delenv("ALLOW_UNSIGNED_WEBHOOK", raising=False)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
        yield c, seen


async def test_webhook_accepts_signed(web):
    c, seen = web
    body = json.dumps(PAYLOAD).encode()
    r = await c.post("/api/calls/webhook", content=body, headers={"elevenlabs-signature": sign(body)})
    assert r.status_code == 204
    import asyncio
    await asyncio.sleep(0.05)
    assert seen == [("H-13", ["SAVEL: Is your heat on?", "Resident: No heat, need help"])]


async def test_webhook_rejects_bad_signature(web):
    c, seen = web
    body = json.dumps(PAYLOAD).encode()
    assert (await c.post("/api/calls/webhook", content=body)).status_code == 401
    assert (await c.post("/api/calls/webhook", content=body, headers={"elevenlabs-signature": sign(body, secret="no")})).status_code == 401
    assert seen == []


async def test_webhook_ignores_other_events(web):
    c, seen = web
    body = json.dumps({"type": "post_call_audio", "data": {}}).encode()
    r = await c.post("/api/calls/webhook", content=body, headers={"elevenlabs-signature": sign(body)})
    assert r.status_code == 204 and seen == []


async def test_calls_current_null_when_idle(web):
    c, _ = web
    manager._current = None
    r = await c.get("/api/calls/current")
    assert r.status_code == 200 and r.json() is None

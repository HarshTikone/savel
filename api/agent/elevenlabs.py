"""ElevenLabs post-call webhook helpers: signature check and payload parsing."""
import hashlib
import hmac
import os

ROLE_NAMES = {"agent": "SAVEL", "user": "Resident"}


def verify_signature(raw_body: bytes, header: str | None, secret: str | None = None) -> bool:
    """Header looks like 't=<unix>,v0=<hex>'; v0 = HMAC-SHA256(secret, '<t>.<body>')."""
    secret = secret if secret is not None else os.getenv("ELEVENLABS_WEBHOOK_SECRET", "")
    if not secret or not header:
        return False
    parts = dict(p.split("=", 1) for p in header.split(",") if "=" in p)
    ts, sig = parts.get("t"), parts.get("v0")
    if not ts or not sig:
        return False
    expected = hmac.new(secret.encode(), f"{ts}.".encode() + raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig)


def parse_post_call(payload: dict) -> tuple[str | None, list[str]] | None:
    """-> (home_id, ['SAVEL: ...', 'Resident: ...']) or None if this is not a transcript event."""
    if payload.get("type") != "post_call_transcription":
        return None
    data = payload.get("data") or {}
    init = data.get("conversation_initiation_client_data") or {}
    variables = init.get("dynamic_variables") or {}
    home_id = variables.get("home_id") or (data.get("metadata") or {}).get("home_id")
    lines = []
    for turn in data.get("transcript") or []:
        text = (turn.get("message") or "").strip()
        if text:
            lines.append(f"{ROLE_NAMES.get(turn.get('role'), 'Resident')}: {text}")
    return (home_id, lines)

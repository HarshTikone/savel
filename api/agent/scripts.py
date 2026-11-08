"""Scripted check-in transcripts, as 'SAVEL: ...' / 'Resident: ...' strings (what the dashboard renders)."""
from api.agent.profiles import profile_for

_EN = {
    "intro": "Hello, this is SAVEL, an automated check-in during the power outage. Is your heat working?",
    "ok": ["No, it went out, but I'm fine. I have blankets and I'm okay."],
    "needs_help": ["No heat, it's freezing in here and I need help. I can't get out easily."],
    "medical": ["No heat. It's freezing and I use oxygen, I'm having trouble breathing. I need help."],
    "leaving": ["No heat, but I'm fine. I'm on my way to my sister's place now."],
    "close": {"ok": "Thank you. Stay warm, and call if anything changes.",
              "needs_help": "I'm flagging this for a responder right now. Please stay where you are.",
              "medical": "I'm alerting a responder immediately. Stay on the line if you can.",
              "leaving": "Good. Stay safe, and thank you."},
}
_ES = {
    "intro": "Hola, soy SAVEL, una llamada automática durante el corte de luz. ¿Tiene calefacción?",
    "ok": ["No, se fue, pero estoy bien. Tengo mantas y estoy bien."],
    "needs_help": ["No tengo calefacción, hace frio y necesito ayuda. No puedo salir."],
    "medical": ["No tengo calefacción, hace frio, uso oxigeno y me cuesta respirar. Necesito ayuda."],
    "leaving": ["No tengo calefacción, pero estoy bien. Voy en camino a casa de mi hermana."],
    "close": {"ok": "Gracias. Abríguese, y llame si algo cambia.",
              "needs_help": "Aviso a un socorrista ahora mismo. Quédese donde está.",
              "medical": "Aviso a un socorrista de inmediato. Quédese en la línea si puede.",
              "leaving": "Bien. Cuídese, gracias."},
}


def build_transcript(home: dict) -> list[str]:
    t = _ES if home.get("language") == "es" else _EN
    p = profile_for(home)
    return [f"SAVEL: {t['intro']}", *[f"Resident: {line}" for line in t[p]], f"SAVEL: {t['close'][p]}"]

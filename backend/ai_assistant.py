from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any


SYSTEM_PROMPT = """Sos un asistente financiero dentro de una webapp llamada bonos.

La app analiza bonos argentinos, LECAPs, CER, TAMAR, tasas, cauciones y datos historicos cargados por el usuario.

Reglas:
- No inventes datos de mercado.
- Si faltan datos, decilo claramente.
- Usa siempre ticker base normalizado: AL30, GD30, AL35, GD35, etc.
- Si el usuario escribe AL30D, AL30C o AL30 T+1, interpretalo como familia AL30 y usa mercado/liquidacion como dimensiones separadas.
- La clave logica de una serie historica es ticker base + dato + mercado + liquidacion + fecha.
- Para analisis relativo, preferi spreads, ratios, z-scores, curvas y butterflies.
- Para calculos, usa herramientas internas disponibles. No inventes resultados si faltan datos.
- No ejecutes SQL libre.
- No modifiques datos sin confirmacion explicita.
- Cuando respondas, mostrale al usuario que datos usaste, que formula aplicaste y que limitaciones hay.
"""


def answer_ai_question(
    question: str,
    memory_notes: list[dict[str, Any]] | None = None,
    app_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    question = question.strip()
    memory_notes = memory_notes or []
    app_context = app_context or {}
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    model = os.getenv("OPENAI_MODEL", "gpt-5.5").strip() or "gpt-5.5"
    if not question:
        return {"status": "error", "answer": "Escribi una pregunta para el asistente.", "model": None}
    if not api_key:
        return {
            "status": "missing_api_key",
            "model": model,
            "answer": (
                "OPENAI_API_KEY no esta configurada. Dejo preparada la pregunta con memoria y contexto, "
                "pero todavia no puedo llamar al modelo desde el backend."
            ),
            "question": question,
            "memory_notes_used": len(memory_notes),
            "context": app_context,
        }

    payload = {
        "model": model,
        "instructions": SYSTEM_PROMPT,
        "input": _build_model_input(question, memory_notes, app_context),
    }
    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        return {"status": "openai_error", "model": model, "answer": "Error al llamar a OpenAI.", "detail": detail}
    except (urllib.error.URLError, TimeoutError) as exc:
        return {"status": "openai_error", "model": model, "answer": "No se pudo conectar con OpenAI.", "detail": str(exc)}
    return {
        "status": "ok",
        "model": model,
        "answer": _extract_response_text(data),
        "raw_id": data.get("id"),
        "memory_notes_used": len(memory_notes),
    }


def _build_model_input(question: str, memory_notes: list[dict[str, Any]], app_context: dict[str, Any]) -> str:
    compact_memory = [
        {
            "title": note.get("title"),
            "category": note.get("category"),
            "content": note.get("content"),
            "tags": note.get("tags"),
        }
        for note in memory_notes[:8]
    ]
    return json.dumps(
        {
            "question": question,
            "app_context": app_context,
            "technical_memory": compact_memory,
        },
        ensure_ascii=True,
    )


def _extract_response_text(data: dict[str, Any]) -> str:
    output_text = data.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text.strip()
    chunks = []
    for item in data.get("output", []) or []:
        for content in item.get("content", []) or []:
            text = content.get("text")
            if isinstance(text, str):
                chunks.append(text)
    return "\n".join(chunks).strip() or "El modelo no devolvio texto."

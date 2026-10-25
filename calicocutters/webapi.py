"""JSON bridge used by the Pyodide worker in the browser."""

from __future__ import annotations

import json

from . import __version__
from . import engine


def saludar() -> str:
    return json.dumps({"ok": True, "version": __version__})


def _clean_parts(result: dict) -> dict:
    return {
        **result,
        "parts": [
            {k: v for k, v in part.items() if k != "mesh"}
            for part in result.get("parts", [])
        ],
    }


def analizar(payload: str) -> str:
    try:
        result = engine.analyze(json.loads(payload))
        return json.dumps({"ok": True, **result})
    except Exception as exc:
        return json.dumps({"ok": False, "error": str(exc)})


def construir(payload: str) -> str:
    try:
        result = engine.build(json.loads(payload))
        return json.dumps({"ok": True, **_clean_parts(result)})
    except Exception as exc:
        return json.dumps({"ok": False, "error": str(exc)})


def exportar_3mf(payload: str) -> str:
    try:
        result = engine.export_3mf(json.loads(payload))
        return json.dumps({"ok": True, **result})
    except Exception as exc:
        return json.dumps({"ok": False, "error": str(exc)})


def exportar_3mf_multi(payload: str) -> str:
    try:
        result = engine.export_3mf_multi(json.loads(payload))
        return json.dumps({"ok": True, **result})
    except Exception as exc:
        return json.dumps({"ok": False, "error": str(exc)})

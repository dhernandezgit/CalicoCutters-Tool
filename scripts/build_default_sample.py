from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from calicocutters.engine import DEFAULT_SETTINGS, build
from calicocutters.shape import parse_svg
SHAPES = ROOT / "src" / "data" / "shapes.ts"
OUT = ROOT / "src" / "data" / "defaultSample.json"


def heart_svg() -> tuple[str, str]:
    text = SHAPES.read_text(encoding="utf-8")
    match = re.search(
        r'id:\s*"heart".*?name:\s*"([^"]+)".*?svg:\s*svg\(`(.*?)`\)',
        text,
        re.S,
    )
    if not match:
        raise RuntimeError("No se encontro el ejemplo heart en shapes.ts")
    name, body = match.group(1), match.group(2)
    return name, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' + body + "</svg>"


def main() -> None:
    name, svg = heart_svg()
    shape = parse_svg(svg, "heart.svg", 75.0)
    shape.name = name
    shape.source_kind = "builtin"
    color = "#f39ab1"
    settings = {**DEFAULT_SETTINGS, "color": color}
    result = build({"shape": shape.to_dict(), "settings": settings})
    payload = {
        "shape": {
            **shape.to_dict(),
            "id": "builtin-heart",
            "sourceKind": shape.source_kind,
        },
        "settings": settings,
        "color": color,
        "build": {
            "parts": [
                {
                    key: part[key]
                    for key in (
                        "name", "color", "stl_b64", "bounds", "volume",
                        "triangles", "preview_offset",
                    )
                }
                for part in result["parts"]
            ],
            "warnings": result["warnings"],
            "checks": result["checks"],
            "build_ms": result["build_ms"],
            "material_grams": result["material_grams"],
            "dimensions": result["dimensions"],
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()

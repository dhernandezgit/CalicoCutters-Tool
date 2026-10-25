"""CalicoCutters geometry engine: cutter, stamp, imprint and export."""

from __future__ import annotations

import base64
import json
import math
import time
from dataclasses import dataclass, field
from typing import Any

from shapely import affinity
from shapely.geometry import MultiPolygon, Polygon
from shapely.ops import unary_union

from .mesh import (
    Mesh,
    build_cutter,
    build_imprint,
    build_roller,
    build_sandwich,
    build_stamp,
    extrude_polygon,
    rounded_rect,
    three_mf_bytes,
)
from .shape import Shape

DEFAULT_SETTINGS: dict[str, Any] = {
    "mode": "cutter-stamp",
    "sizeMode": "longest",
    "longest": 80.0,
    "width": 80.0,
    "height": 80.0,
    "lockAspect": True,
    "printer": "fdm04",
    "lineWidth": 0.4,
    "layerHeight": 0.2,
    "autoPrintable": True,
    "bladeThickness": 0.8,
    "bladeDepth": 12.0,
    "tipWidth": 0.4,
    "chamferHeight": 2.0,
    "sharpEdge": True,
    "extraBlade": False,
    "extraBladeDepth": 6.0,
    "extraBladeThickness": 0.4,
    "baseHeight": 3.5,
    "baseWidth": 4.0,
    "baseShape": "chamfer",
    "addPressHandle": False,
    "pressHandleLength": 26.0,
    "pressHandleWidth": 10.0,
    "pressHandlePosition": 50.0,
    "addBar": False,
    "barAngle": 0.0,
    "barPosition": 50.0,
    "barWidth": 1.2,
    "stampBack": 5.5,
    "stampRelief": 3.0,
    "stampClearance": 0.8,
    "stampRemoveOuterEdge": False,
    "stampEdgeMethod": "preserve",
    "imprintDepth": 4.5,
    "color": "#f39ab1",
    "multiRows": 2,
    "multiCols": 2,
    "multiSpacing": 4.0,
    "sandwichSealWidth": 4.0,
    "sandwichGap": 0.5,
    "sandwichDentSize": 3.0,
    "sandwichDentSpacing": 8.0,
    "sandwichDentDepth": 2.0,
    "rollerDiameter": 35.0,
    "rollerLength": 90.0,
    "rollerRelief": 1.0,
    "rollerBore": 8.0,
    "rollerRepeatsAround": 2,
    "rollerRepeatsAlong": 1,
    "rollerRim": 2.0,
}

PRINTERS = {
    "fdm04": {"line": 0.4, "layer": 0.2, "minWall": 0.8, "tip": 0.4},
    "fdm06": {"line": 0.6, "layer": 0.3, "minWall": 1.2, "tip": 0.6},
    "resin": {"line": 0.05, "layer": 0.05, "minWall": 0.6, "tip": 0.3},
}


def _settings(raw: dict[str, Any] | None) -> dict[str, Any]:
    out = dict(DEFAULT_SETTINGS)
    if raw:
        for k, v in raw.items():
            if k in out and v is not None:
                out[k] = v
    out["longest"] = float(out["longest"])
    out["width"] = float(out["width"])
    out["height"] = float(out["height"])
    out["lineWidth"] = float(out["lineWidth"])
    out["layerHeight"] = float(out["layerHeight"])
    for key in (
        "bladeThickness", "bladeDepth", "tipWidth", "chamferHeight",
        "extraBladeDepth", "extraBladeThickness",
        "baseHeight", "baseWidth", "pressHandleLength", "pressHandleWidth",
        "pressHandlePosition", "barAngle", "barPosition", "barWidth",
        "stampBack", "stampRelief", "stampClearance", "imprintDepth",
        "multiSpacing", "sandwichSealWidth", "sandwichGap", "sandwichDentSize",
        "sandwichDentSpacing", "sandwichDentDepth", "rollerDiameter",
        "rollerLength", "rollerRelief", "rollerBore", "rollerRim",
    ):
        out[key] = float(out[key])
    return out


def _transform_poly(poly: Polygon, sx: float, sy: float) -> Polygon:
    return affinity.scale(poly, sx, sy, origin=(0, 0))


def _sized_geometry(shape: Shape, settings: dict[str, Any]) -> tuple[Polygon, list[Polygon]]:
    main = shape.main_polygon
    b = main.bounds
    bw = max(1e-6, b[2] - b[0])
    bh = max(1e-6, b[3] - b[1])
    if settings["sizeMode"] == "longest":
        sx = sy = float(settings["longest"]) / max(bw, bh)
    elif settings.get("lockAspect", True):
        sx = sy = float(settings["width"]) / bw
    else:
        sx = float(settings["width"]) / bw
        sy = float(settings["height"]) / bh
    main = _transform_poly(main, sx, sy)
    details = [_transform_poly(p, sx, sy) for p in shape.detail_polygons]
    clipped: list[Polygon] = []
    for d in details:
        c = d.intersection(main)
        if c.is_empty:
            continue
        if isinstance(c, Polygon) and c.area > 1e-5:
            clipped.append(c)
        elif isinstance(c, MultiPolygon):
            clipped.extend(p for p in c.geoms if p.area > 1e-5)
    return main, clipped


def _bar_polygon(main: Polygon, settings: dict[str, Any]) -> Polygon:
    b = main.bounds
    diag = math.hypot(b[2] - b[0], b[3] - b[1]) + max(12.0, settings["baseWidth"] * 2)
    width = max(0.8, settings["barWidth"])
    bar = Polygon([
        (-diag / 2, -width / 2),
        (diag / 2, -width / 2),
        (diag / 2, width / 2),
        (-diag / 2, width / 2),
    ])
    bar = affinity.rotate(bar, settings["barAngle"], origin=(0, 0))
    offset = ((settings["barPosition"] - 50.0) / 50.0) * (max(b[2] - b[0], b[3] - b[1]) * 0.5)
    rx, ry = 0.0, offset
    # Rotate the position offset with the bar so "position" remains intuitive.
    a = math.radians(settings["barAngle"])
    rx = -math.sin(a) * offset
    ry = math.cos(a) * offset
    return affinity.translate(bar, rx, ry)


def _add_cutter_extras(mesh: Mesh, main: Polygon, settings: dict[str, Any]) -> Mesh:
    b = main.bounds
    width = b[2] - b[0]
    height = b[3] - b[1]
    if settings.get("addPressHandle"):
        length = max(settings["pressHandleLength"], settings["pressHandleWidth"] * 1.2)
        wid = max(settings["pressHandleWidth"], settings["baseWidth"] + 1)
        pos = (settings["pressHandlePosition"] - 50.0) / 50.0
        cx = pos * max(0.0, (width - length) * 0.5)
        cy = b[1] - wid * 0.35
        handle = rounded_rect(length, wid, wid * 0.45)
        handle = affinity.translate(handle, cx, cy)
        mesh = mesh.append(extrude_polygon(handle, 0.0, max(3.0, settings["baseHeight"] + 1.2)))
    if settings.get("addBar") and settings["barWidth"] >= 0.4:
        bar = _bar_polygon(main, settings)
        mesh = mesh.append(extrude_polygon(bar, 0.0, max(2.0, settings["baseHeight"] + settings["bladeDepth"] * 0.7)))
    return mesh


def _bounds_dict(mesh: Mesh) -> dict[str, list[float]]:
    return mesh.bounds


def _part(name: str, mesh: Mesh, color: str) -> dict[str, Any]:
    return {
        "name": name,
        "color": color,
        "mesh": mesh,
        "stl_b64": base64.b64encode(mesh.stl_bytes()).decode("ascii"),
        "bounds": _bounds_dict(mesh),
        "volume": float(mesh.volume()),
        "triangles": int(mesh.triangles),
    }


def _nested_pair(parts: list[dict[str, Any]]) -> bool:
    names = {p["name"] for p in parts}
    return len(parts) == 2 and "Cortador" in names and "Sello" in names


def _arrange(parts: list[dict[str, Any]], gap: float = 8.0) -> None:
    if len(parts) < 2 or _nested_pair(parts):
        for p in parts:
            p["preview_offset"] = [0.0, 0.0, 0.0]
        return
    widths = [p["bounds"]["max"][0] - p["bounds"]["min"][0] for p in parts]
    total = sum(widths) + gap * (len(parts) - 1)
    cursor = -total / 2
    for p, w in zip(parts, widths):
        p["preview_offset"] = [float(cursor + w / 2), 0.0, 0.0]
        cursor += w + gap


def _check(level: str, title: str, detail: str) -> dict[str, str]:
    return {"level": level, "title": title, "detail": detail}


def _checks(parts: list[dict[str, Any]], settings: dict[str, Any], warnings: list[str]) -> list[dict[str, str]]:
    line = settings["lineWidth"]
    out: list[dict[str, str]] = []
    bt = settings["bladeThickness"]
    out.append(_check(
        "ok" if bt >= line * 2 else "error",
        f"Cuchilla de {bt:.2f} mm",
        f"{bt / line:.1f} líneas de {line:.2f} mm. Mínimo recomendado: 2 líneas.",
    ))
    tip = settings["tipWidth"]
    out.append(_check(
        "ok" if tip >= line * 0.75 else "warn",
        f"Filo de {tip:.2f} mm",
        "Ancho de filo imprimible." if tip >= line * 0.75 else "Puede desaparecer en el slicer.",
    ))
    clearance = settings["stampClearance"]
    out.append(_check(
        "ok" if clearance >= line * 1.5 else "warn",
        f"Holgura del sello de {clearance:.2f} mm",
        f"{clearance / line:.1f} líneas. Recomendado: 2 líneas ({line * 2:.1f} mm).",
    ))
    if settings["mode"] in {"cutter-stamp", "stamp"}:
        out.append(_check(
            "ok" if settings["stampBack"] >= 4 else "warn",
            f"Respaldo del sello de {settings['stampBack']:.1f} mm",
            "Suficiente para presionar sin doblarse." if settings["stampBack"] >= 4 else "Menos de 4 mm puede doblarse.",
        ))
    if settings.get("addBar"):
        out.append(_check(
            "ok" if settings["barWidth"] >= line * 3 else "warn",
            f"Barra de {settings['barWidth']:.2f} mm",
            "Tres líneas: estructura suficiente." if settings["barWidth"] >= line * 3 else "Menos de 3 líneas puede ser frágil.",
        ))
    for p in parts:
        w = p["bounds"]["max"][0] - p["bounds"]["min"][0]
        d = p["bounds"]["max"][1] - p["bounds"]["min"][1]
        out.append(_check(
            "ok" if w <= 250 and d <= 250 else "warn",
            f"{p['name']}: {w:.1f} × {d:.1f} mm",
            "Cabe en una cama Bambu de 256 × 256 mm." if w <= 250 and d <= 250
            else "No cabe en una cama de 256 × 256 mm.",
        ))
    if settings["printer"] == "fdm04" and settings["layerHeight"] > 0.3:
        out.append(_check("warn", f"Capa de {settings['layerHeight']:.2f} mm", "Para detalles finos, usa 0,2 mm o menos."))
    if settings["printer"] == "fdm04" and settings["bladeDepth"] < 8:
        out.append(_check("warn", f"Cuchilla de {settings['bladeDepth']:.1f} mm", "Para galleta suelen necesitarse 10–15 mm."))
    if settings["baseHeight"] < 2:
        out.append(_check("warn", f"Base de {settings['baseHeight']:.1f} mm", "Una base tan fina puede romperse. Recomendado: 3–4 mm."))
    out.append(_check(
        "warn" if warnings else "ok",
        f"{len(warnings)} aviso(s) de geometría" if warnings else "Geometría validada",
        " ".join(warnings) if warnings else "Malla generada. Revisa el slicer antes de imprimir.",
    ))
    return out


def _generate_meshes(shape: Shape, settings: dict[str, Any]) -> tuple[list[tuple[str, Any, str]], list[str], Polygon, list[Polygon]]:
    main, details = _sized_geometry(shape, settings)
    warnings = list(shape.warnings)
    if settings["mode"] in {"stamp", "cutter-stamp"} and not details:
        warnings.append("El sello no tiene relieve interior; se imprimirá como una base plana.")
    if settings["bladeThickness"] < PRINTERS[settings["printer"]]["minWall"]:
        warnings.append(
            f"La cuchilla de {settings['bladeThickness']:.2f} mm está por debajo de "
            f"{PRINTERS[settings['printer']]['minWall']:.1f} mm."
        )
    if settings["tipWidth"] < settings["lineWidth"] * 0.75:
        warnings.append("La punta es más fina que una línea de impresión.")
    if settings["stampClearance"] < settings["lineWidth"] * 1.5:
        warnings.append("La holgura del sello es muy justa para imprimir.")

    if settings.get("stampRemoveOuterEdge") and details:
        inner_zone = main.buffer(-max(0.8, settings["lineWidth"] * 2), join_style=1, quad_segs=8)
        if not inner_zone.is_empty:
            kept: list[Polygon] = []
            for d in details:
                if settings.get("stampEdgeMethod") == "offset":
                    q = d.intersection(inner_zone)
                    if not q.is_empty and q.area > 0.01:
                        if isinstance(q, Polygon):
                            kept.append(q)
                        elif isinstance(q, MultiPolygon):
                            kept.extend(g for g in q.geoms if g.area > 0.01)
                elif inner_zone.contains(d.representative_point()):
                    kept.append(d)
            details = kept
            if not details:
                warnings.append("Quitar borde del sello: no quedan detalles interiores dentro del contorno.")

    parts: list[tuple[str, Any, str]] = []
    try:
        if settings["mode"] in {"cutter", "cutter-stamp"}:
            cutter = build_cutter(
                main,
                blade_thickness=settings["bladeThickness"],
                blade_depth=settings["bladeDepth"],
                tip_width=settings["tipWidth"],
                chamfer_height=settings["chamferHeight"],
                base_height=settings["baseHeight"],
                base_width=settings["baseWidth"],
                sharp_edge=bool(settings["sharpEdge"]),
                extra_blade=bool(settings.get("extraBlade")),
                extra_blade_depth=settings.get("extraBladeDepth", 0),
                extra_blade_thickness=settings.get("extraBladeThickness", 0),
            )
            cutter = _add_cutter_extras(cutter, main, settings)
            parts.append(("Cortador", cutter, "#f39ab1"))
        if settings["mode"] in {"stamp", "cutter-stamp"}:
            stamp = build_stamp(
                main,
                details,
                back_height=settings["stampBack"],
                relief=settings["stampRelief"],
                clearance=settings["stampClearance"],
            )
            parts.append(("Sello", stamp, "#b7a4e8"))
        if settings["mode"] == "imprint":
            imprint = build_imprint(
                main,
                details,
                blade_thickness=settings["bladeThickness"],
                blade_depth=settings["bladeDepth"],
                tip_width=settings["tipWidth"],
                chamfer_height=settings["chamferHeight"],
                base_height=settings["baseHeight"],
                base_width=settings["baseWidth"],
                imprint_depth=settings["imprintDepth"],
            )
            parts.append(("Impronta", imprint, "#f39ab1"))
        if settings["mode"] == "multicutter":
            base = build_cutter(
                main,
                blade_thickness=settings["bladeThickness"],
                blade_depth=settings["bladeDepth"],
                tip_width=settings["tipWidth"],
                chamfer_height=settings["chamferHeight"],
                base_height=settings["baseHeight"],
                base_width=settings["baseWidth"],
                sharp_edge=bool(settings["sharpEdge"]),
                extra_blade=bool(settings.get("extraBlade")),
                extra_blade_depth=settings.get("extraBladeDepth", 0),
                extra_blade_thickness=settings.get("extraBladeThickness", 0),
            )
            base = _add_cutter_extras(base, main, settings)
            rows = max(1, int(settings["multiRows"]))
            cols = max(1, int(settings["multiCols"]))
            b = base.bounds
            cell_w = b["max"][0] - b["min"][0]
            cell_d = b["max"][1] - b["min"][1]
            spacing = float(settings["multiSpacing"])
            multi = None
            for r in range(rows):
                for c in range(cols):
                    copy = base.translated([c * (cell_w + spacing), r * (cell_d + spacing), 0.0])
                    multi = copy if multi is None else multi.append(copy)
            if multi is not None:
                # Center the grid around the origin.
                mb = multi.bounds
                multi = multi.translated([
                    -(mb["min"][0] + mb["max"][0]) / 2,
                    -(mb["min"][1] + mb["max"][1]) / 2,
                    0.0,
                ])
                parts.append(("Puzzle", multi, "#f39ab1"))
        if settings["mode"] == "sandwich":
            sandwich = build_sandwich(
                main,
                blade_thickness=settings["bladeThickness"],
                blade_depth=settings["bladeDepth"],
                tip_width=settings["tipWidth"],
                chamfer_height=settings["chamferHeight"],
                base_height=settings["baseHeight"],
                base_width=settings["baseWidth"],
                seal_width=settings["sandwichSealWidth"],
                gap=settings["sandwichGap"],
                dent_size=settings["sandwichDentSize"],
                dent_spacing=settings["sandwichDentSpacing"],
                dent_depth=settings["sandwichDentDepth"],
            )
            parts.append(("Cortador sándwich", sandwich, "#f39ab1"))
        if settings["mode"] == "roller":
            roller = build_roller(
                main,
                diameter=settings["rollerDiameter"],
                length=settings["rollerLength"],
                relief=settings["rollerRelief"],
                bore=settings["rollerBore"],
                repeats_around=int(settings["rollerRepeatsAround"]),
                repeats_along=int(settings["rollerRepeatsAlong"]),
                rim=settings["rollerRim"],
            )
            parts.append(("Rodillo", roller, "#f39ab1"))
    except Exception as exc:
        raise ValueError(f"No se pudo generar la geometría: {exc}") from exc
    if not parts:
        raise ValueError("No se ha generado ninguna pieza.")
    return parts, warnings, main, details


def _wire_parts(raw: list[tuple[str, Any, str]]) -> list[dict[str, Any]]:
    return [_part(name, mesh, color) for name, mesh, color in raw]


def build(payload: dict[str, Any]) -> dict[str, Any]:
    t0 = time.perf_counter()
    shape = Shape.from_dict(payload["shape"])
    settings = _settings(payload.get("settings"))
    raw, warnings, _main, _details = _generate_meshes(shape, settings)
    parts = _wire_parts(raw)
    _arrange(parts)
    checks = _checks(parts, settings, warnings)
    total_volume = sum(p["volume"] for p in parts)
    return {
        "parts": parts,
        "warnings": list(dict.fromkeys(warnings)),
        "checks": checks,
        "build_ms": (time.perf_counter() - t0) * 1000.0,
        "material_grams": total_volume / 1000.0 * 1.24,
        "dimensions": {
            "width": max(p["bounds"]["max"][0] for p in parts) - min(p["bounds"]["min"][0] for p in parts),
            "height": max(p["bounds"]["max"][1] for p in parts) - min(p["bounds"]["min"][1] for p in parts),
            "depth": max(p["bounds"]["max"][2] for p in parts) - min(p["bounds"]["min"][2] for p in parts),
        },
    }


def analyze(payload: dict[str, Any]) -> dict[str, Any]:
    from .shape import analyze_bytes

    data = base64.b64decode(payload["data_b64"])
    shape = analyze_bytes(data, payload.get("filename", "diseño.png"), float(payload.get("target_mm", 75.0)))
    return {"shape": shape.to_dict()}


def _place_parts(raw: list[tuple[str, Any, str]], gap: float = 8.0) -> list[tuple[str, Mesh, str, tuple[float, float, float]]]:
    names = {n for n, _m, _c in raw}
    if len(raw) == 2 and "Cortador" in names and "Sello" in names:
        # Nest the stamp inside the cutter's opening.  Both stay on the bed;
        # the clearance means they remain separate printable objects.
        return [(n, m, c, (0.0, 0.0, 0.0)) for n, m, c in raw]
    widths = [mesh.bounds["max"][0] - mesh.bounds["min"][0] for _n, mesh, _c in raw]
    total = sum(widths) + gap * max(0, len(raw) - 1)
    cursor = -total / 2
    placed: list[tuple[str, Mesh, str, tuple[float, float, float]]] = []
    for (name, mesh, color), width in zip(raw, widths):
        placed.append((name, mesh, color, (float(cursor + width / 2), 0.0, 0.0)))
        cursor += width + gap
    return placed


def export_3mf(payload: dict[str, Any]) -> dict[str, Any]:
    shape = Shape.from_dict(payload["shape"])
    settings = _settings(payload.get("settings"))
    raw, _warnings, _main, _details = _generate_meshes(shape, settings)
    if settings.get("color"):
        raw = [(n, m, str(settings["color"])) for n, m, _c in raw]
    placed = _place_parts(raw)
    selected = set(payload.get("parts") or [p[0] for p in placed])
    placed = [p for p in placed if p[0] in selected]
    data = three_mf_bytes(placed, payload.get("name", "calicocutters"))
    return {"data_b64": base64.b64encode(data).decode("ascii")}


def export_3mf_multi(payload: dict[str, Any]) -> dict[str, Any]:
    """All selected designs in one 3MF, with objects named per design."""
    items = payload.get("items", [])
    if not items:
        raise ValueError("No hay diseños para exportar.")
    placed_all: list[tuple[str, Mesh, str, tuple[float, float, float]]] = []
    gap = 12.0
    cursor_x = 0.0
    for item in items:
        shape = Shape.from_dict(item["shape"])
        settings = _settings(item.get("settings"))
        raw, _warnings, _main, _details = _generate_meshes(shape, settings)
        if settings.get("color"):
            raw = [(n, m, str(settings["color"])) for n, m, _c in raw]
        placed = _place_parts(raw)
        name_prefix = item.get("name") or shape.name
        widths = [mesh.bounds["max"][0] - mesh.bounds["min"][0] for _n, mesh, _c, _o in placed]
        group_width = sum(widths) + gap * max(0, len(placed) - 1)
        for obj_name, mesh, color, (ox, oy, oz) in placed:
            placed_all.append((
                f"{name_prefix} · {obj_name}",
                mesh,
                color,
                (cursor_x + ox, oy, oz),
            ))
        cursor_x += group_width + gap * 2
    # Center the whole collection around the origin.
    if placed_all:
        minx = min(mesh.bounds["min"][0] + off[0] for _n, mesh, _c, off in placed_all)
        maxx = max(mesh.bounds["max"][0] + off[0] for _n, mesh, _c, off in placed_all)
        shift = -(minx + maxx) / 2
        placed_all = [(n, m, c, (o[0] + shift, o[1], o[2])) for n, m, c, o in placed_all]
    data = three_mf_bytes(placed_all, payload.get("name", "calicocutters"))
    return {"data_b64": base64.b64encode(data).decode("ascii")}

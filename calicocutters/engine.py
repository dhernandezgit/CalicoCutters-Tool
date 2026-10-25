"""CalicoCutters geometry engine: cutter, stamp, imprint and export."""

from __future__ import annotations

import base64
import json
import math
import re
import time
from typing import Any

import numpy as np
from shapely import affinity
from shapely.geometry import LineString, MultiPolygon, Point, Polygon
from shapely.ops import unary_union

from .mesh import (
    Mesh,
    build_bookmark,
    build_cake_pop,
    build_cutter,
    build_imprint,
    build_practice,
    build_roller,
    build_sandwich,
    build_stamp,
    build_stencil,
    build_topper,
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
    "bedModel": "bambu-p2s",
    "bedWidth": 256.0,
    "bedDepth": 256.0,
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
    "pressHandlesBothEnds": False,
    "addBar": False,
    "barAngle": 0.0,
    "barPosition": 50.0,
    "barWidth": 1.2,
    "stampBack": 5.5,
    "stampRelief": 3.0,
    "stampClearance": 0.8,
    "stampRemoveOuterEdge": False,
    "stampRecessed": False,
    "stampEdgeMethod": "preserve",
    "stampBorder": True,
    "stampBorderWidth": 1.6,
    "mirror": False,
    "mirrorPair": False,
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
    "stencilWidth": 100.0,
    "stencilHeight": 100.0,
    "stencilRows": 3,
    "stencilCols": 3,
    "stencilSpacing": 3.0,
    "stencilMargin": 3.0,
    "stencilShapeSize": 15.0,
    "stencilPattern": "grid",
    "stencilBridges": True,
    "stencilBridgeWidth": 1.2,
    "stencilThickness": 1.5,
    "topperThickness": 5.0,
    "topperRelief": 2.0,
    "topperBacking": 2.0,
    "topperPinLength": 40.0,
    "topperPinWidth": 6.0,
    "topperPinPosition": 0.0,
    "topperInvert": False,
    "practiceThickness": 3.0,
    "practiceWallHeight": 8.0,
    "practiceWallWidth": 1.4,
    "bookmarkWidth": 50.0,
    "bookmarkHeight": 150.0,
    "bookmarkThickness": 2.4,
    "bookmarkCorner": 6.0,
    "bookmarkMargin": 6.0,
    "bookmarkHole": True,
    "bookmarkHoleDiameter": 6.0,
    "bookmarkHoleMargin": 10.0,
    "bookmarkRelief": 0.8,
    "bookmarkDesignStyle": "line",
    "cakePopMoldHeight": 18.0,
    "cakePopMoldWall": 2.4,
    "cakePopBase": 2.0,
    "cakePopStickHole": 4.8,
    "cakePopHoleClearance": 0.4,
    "cakePopPlungerClearance": 0.6,
    "cakePopPlungerBack": 2.5,
    "cakePopRelief": 2.0,
    "setCount": 3,
    "setStep": 0.18,
    "setSpacing": 10.0,
    "preprocessSmooth": False,
    "preprocessAmount": 0.25,
    "preprocessSimplify": 0.12,
    "preprocessPreserveCorners": False,
    "preprocessSmoothDetails": False,
    "preprocessRemoveTiny": False,
    "preprocessMinDetail": 0.8,
    "alignmentHole": True,
    "alignmentHoleDiameter": 1.8,
}

PRINTERS = {
    "fdm04": {"line": 0.4, "layer": 0.2, "minWall": 0.8, "tip": 0.4},
    "fdm06": {"line": 0.6, "layer": 0.3, "minWall": 1.2, "tip": 0.6},
    "resin": {"line": 0.05, "layer": 0.05, "minWall": 0.6, "tip": 0.3},
}


VALID_MODES = {
    "cutter-stamp", "cutter", "stamp", "imprint", "multicutter", "sandwich",
    "roller", "stencil", "topper", "practice", "cakepop", "cutter-set",
    "bookmark",
}

# Every numeric setting has a safe range.  Values outside the range are
# clamped instead of reaching Shapely as zero/negative/degenerate geometry.
_NUMERIC_RANGES: dict[str, tuple[float, float]] = {
    "longest": (20.0, 240.0),
    "width": (15.0, 240.0),
    "height": (15.0, 240.0),
    "lineWidth": (0.05, 1.2),
    "layerHeight": (0.05, 0.5),
    "bedWidth": (50.0, 1000.0),
    "bedDepth": (50.0, 1000.0),
    "bladeThickness": (0.4, 5.0),
    "bladeDepth": (5.0, 25.0),
    "tipWidth": (0.2, 2.0),
    "chamferHeight": (0.2, 5.0),
    "extraBladeDepth": (0.0, 25.0),
    "extraBladeThickness": (0.2, 5.0),
    "baseHeight": (1.0, 12.0),
    "baseWidth": (1.0, 20.0),
    "pressHandleLength": (10.0, 80.0),
    "pressHandleWidth": (5.0, 30.0),
    "pressHandlePosition": (0.0, 100.0),
    "barAngle": (0.0, 179.0),
    "barPosition": (0.0, 100.0),
    "barWidth": (0.8, 8.0),
    "stampBack": (2.0, 15.0),
    "stampRelief": (0.5, 10.0),
    "stampClearance": (0.2, 4.0),
    "stampBorderWidth": (0.5, 6.0),
    "imprintDepth": (1.0, 12.0),
    "multiSpacing": (0.0, 30.0),
    "sandwichSealWidth": (0.8, 12.0),
    "sandwichGap": (0.0, 5.0),
    "sandwichDentSize": (1.0, 8.0),
    "sandwichDentSpacing": (2.0, 40.0),
    "sandwichDentDepth": (0.2, 6.0),
    "rollerDiameter": (15.0, 120.0),
    "rollerLength": (20.0, 200.0),
    "rollerRelief": (0.2, 6.0),
    "rollerBore": (0.0, 40.0),
    "rollerRim": (0.0, 10.0),
    "stencilWidth": (30.0, 250.0),
    "stencilHeight": (30.0, 250.0),
    "stencilSpacing": (0.5, 20.0),
    "stencilMargin": (0.0, 20.0),
    "stencilShapeSize": (0.0, 80.0),
    "stencilBridgeWidth": (0.6, 5.0),
    "stencilThickness": (0.6, 5.0),
    "topperThickness": (1.0, 15.0),
    "topperRelief": (0.2, 10.0),
    "topperBacking": (0.0, 15.0),
    "topperPinLength": (5.0, 150.0),
    "topperPinWidth": (2.0, 25.0),
    "topperPinPosition": (-100.0, 100.0),
    "practiceThickness": (1.0, 12.0),
    "practiceWallHeight": (2.0, 25.0),
    "practiceWallWidth": (0.6, 8.0),
    "bookmarkWidth": (20.0, 150.0),
    "bookmarkHeight": (50.0, 300.0),
    "bookmarkThickness": (1.2, 8.0),
    "bookmarkCorner": (0.0, 30.0),
    "bookmarkMargin": (2.0, 30.0),
    "bookmarkHoleDiameter": (2.0, 20.0),
    "bookmarkHoleMargin": (5.0, 60.0),
    "bookmarkRelief": (0.0, 3.0),
    "cakePopMoldHeight": (6.0, 40.0),
    "cakePopMoldWall": (1.2, 8.0),
    "cakePopBase": (1.0, 8.0),
    "cakePopStickHole": (2.5, 12.0),
    "cakePopHoleClearance": (0.0, 2.0),
    "cakePopPlungerClearance": (0.2, 2.5),
    "cakePopPlungerBack": (1.0, 8.0),
    "cakePopRelief": (0.2, 8.0),
    "setStep": (0.05, 0.45),
    "setSpacing": (2.0, 40.0),
    "preprocessAmount": (0.0, 1.5),
    "preprocessSimplify": (0.0, 0.8),
    "preprocessMinDetail": (0.1, 20.0),
    "alignmentHoleDiameter": (0.8, 5.0),
}

_INTEGER_RANGES: dict[str, tuple[int, int]] = {
    "multiRows": (1, 6),
    "multiCols": (1, 6),
    "rollerRepeatsAround": (1, 16),
    "rollerRepeatsAlong": (1, 16),
    "stencilRows": (1, 10),
    "stencilCols": (1, 10),
    "setCount": (2, 6),
}

_BOOLEAN_KEYS = {
    "lockAspect", "autoPrintable", "sharpEdge", "extraBlade",
    "addPressHandle", "pressHandlesBothEnds", "addBar", "stampRemoveOuterEdge", "stampBorder",
    "mirror", "mirrorPair", "stencilBridges", "topperInvert", "stampRecessed",
    "bookmarkHole",
    "preprocessSmooth", "preprocessPreserveCorners", "preprocessSmoothDetails", "preprocessRemoveTiny",
    "alignmentHole",
}


def _as_bool(value: Any) -> bool:
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "si", "sí", "on"}
    return bool(value)


def _clamp_number(value: Any, low: float, high: float, default: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        number = default
    if not math.isfinite(number):
        number = default
    return max(low, min(high, number))


def _clamp_int(value: Any, low: int, high: int, default: int) -> int:
    try:
        number = int(round(float(value)))
    except (TypeError, ValueError):
        number = default
    return max(low, min(high, number))


def _settings(raw: dict[str, Any] | None) -> dict[str, Any]:
    out = dict(DEFAULT_SETTINGS)
    if raw:
        for k, v in raw.items():
            if k in out and v is not None:
                out[k] = v
    mode = str(out.get("mode", "cutter-stamp"))
    if mode not in VALID_MODES:
        raise ValueError(f"Modo de creación no válido: {mode}")
    out["mode"] = mode
    out["sizeMode"] = "wh" if str(out.get("sizeMode")) == "wh" else "longest"
    out["printer"] = str(out.get("printer")) if str(out.get("printer")) in PRINTERS else "fdm04"
    out["baseShape"] = str(out.get("baseShape")) if str(out.get("baseShape")) in {"rect", "chamfer", "round"} else "chamfer"
    out["stampEdgeMethod"] = "offset" if str(out.get("stampEdgeMethod")) == "offset" else "preserve"
    out["stencilPattern"] = "diagonal" if str(out.get("stencilPattern")) == "diagonal" else "random" if str(out.get("stencilPattern")) == "random" else "grid"
    out["bookmarkDesignStyle"] = str(out.get("bookmarkDesignStyle")) if str(out.get("bookmarkDesignStyle")) in {"line", "relief", "none"} else "line"
    out["bedModel"] = str(out.get("bedModel") or "bambu-p2s")[:40]
    for key in _BOOLEAN_KEYS:
        out[key] = _as_bool(out.get(key))
    for key, (low, high) in _NUMERIC_RANGES.items():
        out[key] = _clamp_number(out.get(key), low, high, float(DEFAULT_SETTINGS[key]))
    for key, (low, high) in _INTEGER_RANGES.items():
        out[key] = _clamp_int(out.get(key), low, high, int(DEFAULT_SETTINGS[key]))
    # A bore wider than the roller body is unusable; leave at least 1 mm of wall.
    out["rollerBore"] = min(out["rollerBore"], max(0.0, out["rollerDiameter"] / 2 - 1.0))
    # Keep the stick channel inside the shaped cavity.
    out["cakePopStickHole"] = min(out["cakePopStickHole"], out["longest"] * 0.35)
    color = str(out.get("color") or "#f39ab1")
    out["color"] = color if re.fullmatch(r"#[0-9a-fA-F]{6}", color) else "#f39ab1"
    return out


def _transform_poly(poly: Polygon, sx: float, sy: float) -> Polygon:
    return affinity.scale(poly, sx, sy, origin=(0, 0))


def _smooth_polygon(poly: Polygon, amount: float) -> Polygon:
    if amount <= 0 or poly.is_empty:
        return poly
    try:
        rounded = poly.buffer(amount, join_style=1, quad_segs=8)
        rounded = rounded.buffer(-amount, join_style=1, quad_segs=8)
        fixed = rounded if rounded.is_valid else rounded.buffer(0)
        if isinstance(fixed, MultiPolygon):
            fixed = max(fixed.geoms, key=lambda p: p.area)
        return fixed if not fixed.is_empty else poly
    except Exception:
        return poly


def _preprocess_geometry(
    main: Polygon,
    details: list[Polygon],
    settings: dict[str, Any],
    warnings: list[str],
) -> tuple[Polygon, list[Polygon]]:
    """Lightly clean traced/large SVG geometry without destroying corners."""
    if not settings["preprocessSmooth"]:
        return main, details
    tolerance = settings["preprocessSimplify"]
    if tolerance > 0:
        simplified = main.simplify(tolerance, preserve_topology=True)
        if not simplified.is_empty:
            main = simplified
        new_details: list[Polygon] = []
        for d in details:
            q = d.simplify(tolerance, preserve_topology=True)
            if not q.is_empty and q.area > 0.01:
                new_details.append(q)
        details = new_details
    if not settings["preprocessPreserveCorners"] and settings["preprocessAmount"] > 0:
        main = _smooth_polygon(main, settings["preprocessAmount"])
        if settings.get("preprocessSmoothDetails"):
            details = [
                _smooth_polygon(d, settings["preprocessAmount"])
                for d in details
            ]
    if settings["preprocessRemoveTiny"]:
        minimum = settings["preprocessMinDetail"]
        before = len(details)
        details = [d for d in details if d.area >= minimum]
        removed = before - len(details)
        if removed > 0:
            warnings.append(
                f"Se han descartado {removed} detalle(s) minúsculo(s) menores de "
                f"{minimum:.1f} mm² para evitar líneas frágiles."
            )
    return main, details


def _sized_geometry(shape: Shape, settings: dict[str, Any]) -> tuple[Polygon, list[Polygon], list[str]]:
    warnings: list[str] = []
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
    if settings.get("mirror"):
        main = affinity.scale(main, -1, 1, origin=(0, 0))
        details = [affinity.scale(p, -1, 1, origin=(0, 0)) for p in details]
    main, details = _preprocess_geometry(main, details, settings, warnings)
    clipped: list[Polygon] = []
    for d in details:
        c = d.intersection(main)
        if c.is_empty:
            continue
        if isinstance(c, Polygon) and c.area > 1e-5:
            clipped.append(c)
        elif isinstance(c, MultiPolygon):
            clipped.extend(p for p in c.geoms if p.area > 1e-5)
    return main, clipped, warnings


def _alignment_locations(
    main: Polygon,
    settings: dict[str, Any],
) -> tuple[tuple[float, float, float] | None, tuple[float, float, float] | None]:
    """Return matching radial alignment holes for cutter base and stamp plate.

    The two holes sit at the same angle from the shape centre, like the index
    dots on a camera lens.  They are deliberately small and live outside the
    cutting line (cutter) or inside the back plate (stamp), so the silhouette
    is untouched.
    """
    if not settings.get("alignmentHole"):
        return None, None
    radius = max(0.4, settings["alignmentHoleDiameter"] / 2)
    clearance = settings["stampClearance"]
    base_width = settings["baseWidth"]
    c = main.centroid
    minx, miny, maxx, maxy = main.bounds
    span = max(maxx - minx, maxy - miny, 1.0)
    base_band = (
        main.buffer(base_width + 0.4, join_style=1, quad_segs=8)
        .difference(main.buffer(-0.4, join_style=1, quad_segs=8))
    )
    stamp_poly = main.buffer(-clearance, join_style=1, quad_segs=8)
    if stamp_poly.is_empty:
        return None, None
    # Try several directions and take the first place where both materials
    # have room for a clean through-hole.
    for degrees in (45, 135, 315, 225, 55, 305, 125, 270, 90, 0, 180):
        angle = math.radians(degrees)
        dx, dy = math.cos(angle), math.sin(angle)
        far = Point(c.x + dx * span * 2.0, c.y + dy * span * 2.0)
        try:
            boundary = LineString([(c.x, c.y), (far.x, far.y)]).intersection(main.boundary)
        except Exception:
            continue
        candidates: list[Point] = []
        if boundary.geom_type == "Point":
            candidates = [boundary]
        elif boundary.geom_type in {"MultiPoint", "GeometryCollection"}:
            candidates = [p for p in boundary.geoms if p.geom_type == "Point"]
        for hit in candidates:
            cutter_center = Point(
                hit.x + dx * (radius + 0.9),
                hit.y + dy * (radius + 0.9),
            )
            if not base_band.contains(cutter_center.buffer(radius + 0.15)):
                continue
            stamp_center = Point(
                hit.x - dx * (clearance + (settings["stampBorderWidth"] if settings.get("stampBorder") else 0) + radius + 0.55),
                hit.y - dy * (clearance + (settings["stampBorderWidth"] if settings.get("stampBorder") else 0) + radius + 0.55),
            )
            if not stamp_poly.contains(stamp_center.buffer(radius + 0.2)):
                continue
            return (
                (float(cutter_center.x), float(cutter_center.y), float(radius)),
                (float(stamp_center.x), float(stamp_center.y), float(radius)),
            )
    return None, None


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
        if settings.get("pressHandlesBothEnds"):
            top_handle = rounded_rect(length, wid, wid * 0.45)
            top_handle = affinity.translate(top_handle, cx, b[3] + wid * 0.35)
            mesh = mesh.append(extrude_polygon(top_handle, 0.0, max(3.0, settings["baseHeight"] + 1.2)))
    if settings.get("addBar") and settings["barWidth"] >= 0.4:
        bar = _bar_polygon(main, settings)
        mesh = mesh.append(extrude_polygon(bar, 0.0, max(2.0, settings["baseHeight"] + settings["bladeDepth"] * 0.7)))
    return mesh


def _build_cutter_set(main: Polygon, settings: dict[str, Any]) -> Mesh:
    """Several progressively smaller cutters of the same motif, one object."""
    count = max(2, int(settings["setCount"]))
    step = float(settings["setStep"])
    spacing = float(settings["setSpacing"])
    # Do not silently repeat the same size when the requested reduction would
    # reach the 35 % floor before the requested number of cutters.
    count = min(count, max(2, int(0.65 / max(step, 0.01)) + 1))
    factors = [max(0.35, 1.0 - i * step) for i in range(count)]
    meshes: list[Mesh] = []
    for factor in factors:
        scaled = affinity.scale(main, factor, factor, origin="center")
        cutter_align, _stamp_align = _alignment_locations(scaled, settings)
        mesh = build_cutter(
            scaled,
            blade_thickness=settings["bladeThickness"],
            blade_depth=settings["bladeDepth"],
            tip_width=settings["tipWidth"],
            chamfer_height=settings["chamferHeight"],
            base_height=settings["baseHeight"],
            base_width=settings["baseWidth"],
            sharp_edge=bool(settings["sharpEdge"]),
            base_shape=str(settings.get("baseShape", "chamfer")),
            alignment=cutter_align,
        )
        if mesh.triangles:
            meshes.append(mesh)
    if not meshes:
        return Mesh(np.zeros((0, 3)), np.zeros((0, 3), dtype=np.int64))
    placed: list[Mesh] = []
    cursor = 0.0
    for mesh in meshes:
        b = mesh.bounds
        width = b["max"][0] - b["min"][0]
        placed.append(mesh.translated([cursor - b["min"][0], 0.0, 0.0]))
        cursor += width + spacing
    total = cursor - spacing
    out = placed[0]
    for mesh in placed[1:]:
        out = out.append(mesh)
    return out.translated([-total / 2, 0.0, 0.0])


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


def _check(level: str, title: str, detail: str, code: str | None = None) -> dict[str, str]:
    out = {"level": level, "title": title, "detail": detail}
    if code:
        out["code"] = code
    return out


def _checks(
    parts: list[dict[str, Any]],
    settings: dict[str, Any],
    warnings: list[str],
    main: Polygon | None = None,
    details: list[Polygon] | None = None,
) -> list[dict[str, str]]:
    line = settings["lineWidth"]
    mode = settings["mode"]
    cutter_like = mode in {"cutter", "cutter-stamp", "imprint", "multicutter", "sandwich", "cutter-set"}
    stamp_like = mode in {"stamp", "cutter-stamp"}
    out: list[dict[str, str]] = []

    if cutter_like:
        bt = settings["bladeThickness"]
        out.append(_check(
            "ok" if bt >= line * 2 else "error",
            f"Cuchilla de {bt:.2f} mm",
            f"{bt / line:.1f} líneas de {line:.2f} mm. Mínimo recomendado: 2 líneas.",
            "thin_blade",
        ))
        tip = settings["tipWidth"]
        out.append(_check(
            "ok" if tip >= line * 0.75 else "warn",
            f"Filo de {tip:.2f} mm",
            "Ancho de filo imprimible." if tip >= line * 0.75 else "Puede desaparecer en el slicer.",
            "thin_tip",
        ))
        if bt < PRINTERS[settings["printer"]]["minWall"]:
            out.append(_check(
                "warn",
                f"Cuchilla por debajo del perfil {PRINTERS[settings['printer']]['minWall']:.1f} mm",
                "Aumenta el grosor o usa un perfil con línea más fina.",
                "thin_blade",
            ))
        if settings["bladeDepth"] < 8:
            out.append(_check("warn", f"Cuchilla de {settings['bladeDepth']:.1f} mm", "Para galleta suelen necesitarse 10–15 mm.", "blade_depth"))
        if settings["bladeDepth"] >= 16 and bt < line * 3:
            out.append(_check(
                "warn",
                "Cuchilla alta y fina",
                "Una pared alta y delgada puede oscilar, despegarse o romperse con el tiempo. Sube el grosor a 3 líneas o baja la profundidad a 12 mm.",
                "tall_blade",
            ))
        if settings["baseHeight"] < 2:
            out.append(_check("warn", f"Base de {settings['baseHeight']:.1f} mm", "Una base tan fina puede romperse. Recomendado: 3–4 mm.", "base_height"))
        if settings.get("extraBlade") and (settings["extraBladeDepth"] < 1 or settings["extraBladeThickness"] < line):
            out.append(_check(
                "warn",
                "Cuchilla extra demasiado fina",
                "Aumenta el grosor o la profundidad de la cuchilla extra para que aporte refuerzo real.",
                "extra_blade",
            ))
        if settings.get("addBar") and mode in {"cutter", "cutter-stamp", "multicutter"}:
            out.append(_check(
                "ok" if settings["barWidth"] >= line * 3 else "warn",
                f"Barra de {settings['barWidth']:.2f} mm",
                "Tres líneas: estructura suficiente." if settings["barWidth"] >= line * 3 else "Menos de 3 líneas puede ser frágil.",
                "bar_width",
            ))
        if mode == "cutter-set" and parts:
            if main is not None:
                span = max(main.bounds[2] - main.bounds[0], main.bounds[3] - main.bounds[1])
                factor = max(0.35, 1.0 - (settings["setCount"] - 1) * settings["setStep"])
                smallest = span * factor + settings["baseWidth"] * 2
            else:
                smallest = min((p["bounds"]["max"][0] - p["bounds"]["min"][0]) for p in parts)
            out.append(_check(
                "ok" if smallest >= 35 else "warn",
                f"Cortador más pequeño de {smallest:.1f} mm",
                "Los cortadores de menos de 35 mm son difíciles de manejar y pueden romperse." if smallest < 35 else "Tamaños manejables para un set.",
                "small_set",
            ))
            if settings["setSpacing"] < 4:
                out.append(_check("warn", f"Separación del set de {settings['setSpacing']:.1f} mm", "Deja al menos 4–8 mm entre cortadores para poder separarlos sin romperlos.", "set_spacing"))

    if mode == "multicutter" and settings["multiSpacing"] < 2:
        out.append(_check("warn", f"Separación del puzzle de {settings['multiSpacing']:.1f} mm", "Deja al menos 2–4 mm entre copias; si no, se fusionan al imprimir.", "multi_spacing"))

    if stamp_like:
        clearance = settings["stampClearance"]
        out.append(_check(
            "ok" if clearance >= line * 1.5 else "warn",
            f"Holgura del sello de {clearance:.2f} mm",
            f"{clearance / line:.1f} líneas. Recomendado: 2 líneas ({line * 2:.1f} mm).",
            "clearance",
        ))
        out.append(_check(
            "ok" if settings["stampBack"] >= 4 else "warn",
            f"Respaldo del sello de {settings['stampBack']:.1f} mm",
            "Suficiente para presionar sin doblarse." if settings["stampBack"] >= 4 else "Menos de 4 mm puede doblarse.",
            "stamp_back",
        ))
        if settings["stampRelief"] > 5:
            out.append(_check("warn", f"Relieve de {settings['stampRelief']:.1f} mm", "Un relieve muy alto es frágil y puede romperse con el tiempo. Prueba 2–3 mm.", "stamp_relief"))
        if settings.get("stampRecessed") and settings["stampRelief"] > settings["stampBack"] - 1.0:
            out.append(_check("warn", "Hundido demasiado profundo", "Deja al menos 1 mm de respaldo bajo el relieve negativo.", "stamp_recess"))
        if details:
            small = [d for d in details if d.area < 2.2 or d.buffer(-line * 0.5).is_empty]
            if small:
                out.append(_check(
                    "warn",
                    f"{len(small)} detalle(s) fino(s) en el sello",
                    "Los detalles pequeños y altos pueden desgastarse, doblarse o caerse con el tiempo. Reduce el relieve a 2 mm o engorda el dibujo.",
                    "small_details",
                ))

    if mode == "sandwich":
        if settings["sandwichSealWidth"] < line * 2:
            out.append(_check("warn", f"Sellado de {settings['sandwichSealWidth']:.1f} mm", "Un sellado de menos de 2 líneas puede romperse al cerrar el sándwich.", "sandwich_seal"))
        if settings["sandwichDentDepth"] > settings["sandwichSealWidth"]:
            out.append(_check("warn", "Muescas más profundas que el sellado", "Reduce la profundidad de las muescas para no debilitar el anillo.", "sandwich_dent"))

    if mode == "roller":
        max_bore = max(0.0, settings["rollerDiameter"] * 0.55)
        out.append(_check(
            "ok" if settings["rollerBore"] <= max_bore else "warn",
            f"Eje de {settings['rollerBore']:.1f} mm",
            "Deja pared suficiente para el eje." if settings["rollerBore"] <= max_bore else "El eje es demasiado grande para el diámetro del rodillo; deja al menos 3 mm de pared.",
            "roller_bore",
        ))
        if settings["rollerRelief"] > settings["rollerDiameter"] * 0.25:
            out.append(_check("warn", "Relieve del rodillo muy alto", "Un relieve alto puede engancharse o romperse. Prueba 1–2 mm.", "roller_relief"))

    if mode == "stencil":
        if settings["stencilThickness"] < max(0.8, line * 2):
            out.append(_check(
                "warn",
                f"Stencil de {settings['stencilThickness']:.1f} mm",
                "Una lámina tan fina se puede romper al despegar. Usa al menos 1,5 mm.",
                "stencil_thin",
            ))
        if settings["stencilMargin"] < 1:
            out.append(_check("warn", "Margen del stencil muy justo", "Deja al menos 2–3 mm de material alrededor del patrón para que no se rompa.", "stencil_margin"))
        if 0 < settings["stencilShapeSize"] < 8:
            out.append(_check("warn", f"Forma de {settings['stencilShapeSize']:.0f} mm", "Las aberturas de menos de 8 mm son difíciles de limpiar y pueden romperse.", "stencil_small"))
        if not settings["stencilBridges"] and main is not None and main.interiors:
            out.append(_check("warn", "Islas interiores sin puentes", "El dibujo tiene zonas interiores que quedarán sueltas. Activa los puentes del stencil.", "stencil_islands"))

    if mode == "topper":
        if settings["topperThickness"] < 2:
            out.append(_check("warn", f"Base de {settings['topperThickness']:.1f} mm", "Una base de topper tan fina se dobla. Usa 3–5 mm.", "topper_thin"))
        if settings["topperPinWidth"] < max(3.0, line * 4):
            out.append(_check(
                "warn",
                f"Pin de {settings['topperPinWidth']:.1f} mm",
                "Un pin estrecho se dobla o se rompe dentro del bizcocho. Usa al menos 6 mm.",
                "topper_pin",
            ))
        if settings["topperPinLength"] < 15:
            out.append(_check("warn", f"Pin de {settings['topperPinLength']:.0f} mm", "Un pin corto no sujeta el topper. Usa al menos 30–50 mm.", "topper_pin_length"))
        if settings["topperBacking"] < 1:
            out.append(_check("warn", "Topper sin respaldo perimetral", "Añade 2–5 mm de respaldo para que los detalles finos no queden sueltos.", "topper_backing"))

    if mode == "practice":
        if settings["practiceWallWidth"] < max(0.8, line * 2):
            out.append(_check(
                "warn",
                f"Pared de práctica de {settings['practiceWallWidth']:.1f} mm",
                "La pared puede romperse al desmoldar. Usa al menos 2 líneas.",
                "practice_wall",
            ))
        if settings["practiceThickness"] < 2:
            out.append(_check("warn", "Fondo de práctica fino", "Usa al menos 3 mm para que no se comba.", "practice_base"))

    if mode == "bookmark":
        if settings["bookmarkThickness"] < max(1.6, line * 3):
            out.append(_check("warn", f"Marcapáginas de {settings['bookmarkThickness']:.1f} mm", "Una lámina de menos de 2 mm se dobla. Usa 2–3 mm.", "bookmark_thin"))
        if settings["bookmarkHeight"] < 80:
            out.append(_check("warn", f"Marcapáginas de {settings['bookmarkHeight']:.0f} mm", "Para una página de libro suele necesitarse al menos 100 mm.", "bookmark_short"))
        if settings.get("bookmarkHole"):
            if settings["bookmarkHoleDiameter"] < line * 2:
                out.append(_check("warn", "Agujero de cinta demasiado pequeño", "Usa al menos 4–6 mm para pasar una cinta o lana.", "bookmark_hole"))
            if settings["bookmarkHoleDiameter"] > settings["bookmarkWidth"] * 0.4:
                out.append(_check("warn", "Agujero de cinta demasiado grande", "Deja al menos 6 mm de material a cada lado.", "bookmark_hole_large"))
        if settings["bookmarkRelief"] > max(0.2, settings["bookmarkThickness"]):
            out.append(_check("warn", "Relieve del marcapáginas muy alto", "Reduce el relieve o aumenta el grosor de la lámina.", "bookmark_relief"))

    if mode == "cakepop":
        if settings["cakePopMoldWall"] < max(1.2, line * 3):
            out.append(_check("warn", f"Pared del molde de {settings['cakePopMoldWall']:.1f} mm", "Usa al menos 3 líneas para que el molde no se deforme.", "cakepop_wall"))
        if settings["cakePopStickHole"] < 4:
            out.append(_check("warn", f"Agujero de {settings['cakePopStickHole']:.1f} mm", "Un palito estándar necesita unos 4,5–5 mm con holgura.", "cakepop_hole"))
        if settings["cakePopPlungerClearance"] < max(0.4, line * 1.5) - 0.01:
            out.append(_check("warn", "Holgura del prensador muy justa", "Aumenta la holgura para que el prensador no se atasque.", "cakepop_clearance"))
        if settings["cakePopMoldHeight"] < 10:
            out.append(_check("warn", "Molde cake pop poco profundo", "Usa 15–20 mm para que el cake pop tenga cuerpo.", "cakepop_depth"))

    if settings.get("alignmentHole") and (cutter_like or stamp_like):
        if settings["alignmentHoleDiameter"] < line * 2:
            out.append(_check("warn", f"Punto de alineación de {settings['alignmentHoleDiameter']:.1f} mm", "Usa al menos 2 líneas para que el agujero no se cierre al imprimir.", "alignment_hole"))
        if settings["baseWidth"] < settings["alignmentHoleDiameter"] + 0.8:
            out.append(_check("warn", "Punto de alineación sin espacio", "Aumenta el ancho de la base o reduce el agujero de alineación.", "alignment_space"))

    for p in parts:
        w = p["bounds"]["max"][0] - p["bounds"]["min"][0]
        d = p["bounds"]["max"][1] - p["bounds"]["min"][1]
        bed_w = max(1.0, settings["bedWidth"] - 2.0)
        bed_d = max(1.0, settings["bedDepth"] - 2.0)
        out.append(_check(
            "ok" if w <= bed_w and d <= bed_d else "warn",
            f"{p['name']}: {w:.1f} × {d:.1f} mm",
            f"Cabe en una cama de {bed_w:.0f} × {bed_d:.0f} mm." if w <= bed_w and d <= bed_d
            else f"No cabe en una cama de {bed_w:.0f} × {bed_d:.0f} mm.",
            "bed",
        ))
    if settings["printer"] == "fdm04" and settings["layerHeight"] > 0.3:
        out.append(_check("warn", f"Capa de {settings['layerHeight']:.2f} mm", "Para detalles finos, usa 0,2 mm o menos.", "layer"))
    if settings["printer"] == "fdm06" and settings["layerHeight"] > 0.32:
        out.append(_check("warn", f"Capa de {settings['layerHeight']:.2f} mm", "Con boquilla de 0,6 mm usa 0,3 mm o menos para conservar detalles.", "layer"))
    if settings["printer"] == "resin" and settings["layerHeight"] > 0.12:
        out.append(_check("warn", f"Capa de {settings['layerHeight']:.2f} mm", "Para resina, 0,05–0,1 mm conserva mejor los detalles.", "layer"))
    if main is not None and main.buffer(-line * 0.5, join_style=1, quad_segs=8).is_empty:
        out.append(_check(
            "warn",
            "Zonas finas en la silueta",
            "Algunas zonas son más estrechas que una línea de impresión. Se pueden romper o desprender con el tiempo. Aumenta el tamaño o simplifica el dibujo.",
            "thin_shape",
        ))
    out.append(_check(
        "warn" if warnings else "ok",
        f"{len(warnings)} aviso(s) de geometría" if warnings else "Geometría validada",
        " ".join(warnings) if warnings else "Malla generada. Revisa el slicer antes de imprimir.",
        "geometry",
    ))
    return out


def _generate_meshes(shape: Shape, settings: dict[str, Any]) -> tuple[list[tuple[str, Any, str]], list[str], Polygon, list[Polygon]]:
    main, details, pre_warnings = _sized_geometry(shape, settings)
    warnings = list(shape.warnings) + pre_warnings
    cutter_modes = {"cutter", "cutter-stamp", "imprint", "multicutter", "sandwich", "cutter-set"}
    stamp_modes = {"stamp", "cutter-stamp"}
    cutter_alignment, stamp_alignment = _alignment_locations(main, settings)
    if settings.get("alignmentHole"):
        if settings["mode"] in cutter_modes and cutter_alignment is None:
            warnings.append("No hay espacio para el punto de alineación en la base del cortador con este tamaño.")
        if settings["mode"] in stamp_modes and stamp_alignment is None:
            warnings.append("No hay espacio para el punto de alineación en el sello con este tamaño.")
    if settings["mode"] in stamp_modes and not details:
        warnings.append("El sello no tiene relieve interior; se imprimirá como una base plana.")
    if settings["mode"] in cutter_modes and settings["bladeThickness"] < PRINTERS[settings["printer"]]["minWall"]:
        warnings.append(
            f"La cuchilla de {settings['bladeThickness']:.2f} mm está por debajo de "
            f"{PRINTERS[settings['printer']]['minWall']:.1f} mm."
        )
    if settings["mode"] in cutter_modes and settings["tipWidth"] < settings["lineWidth"] * 0.75:
        warnings.append("La punta es más fina que una línea de impresión.")
    if settings["mode"] in stamp_modes and settings["stampClearance"] < settings["lineWidth"] * 1.5:
        warnings.append("La holgura del sello es muy justa para imprimir.")

    if settings["mode"] in stamp_modes and settings.get("stampRemoveOuterEdge") and details:
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
                base_shape=str(settings.get("baseShape", "round")),
                alignment=cutter_alignment,
            )
            cutter = _add_cutter_extras(cutter, main, settings)
            parts.append(("Cortador", cutter, "#f39ab1"))
        if settings["mode"] == "cutter-set":
            cutters = _build_cutter_set(main, settings)
            parts.append(("Set de cortadores", cutters, "#f39ab1"))
        if settings["mode"] in {"stamp", "cutter-stamp"}:
            stamp = build_stamp(
                main,
                details,
                back_height=settings["stampBack"],
                relief=settings["stampRelief"],
                clearance=settings["stampClearance"],
                border=bool(settings.get("stampBorder", True)),
                border_width=float(settings.get("stampBorderWidth", 1.6)),
                alignment=stamp_alignment,
                recessed=bool(settings.get("stampRecessed")),
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
                base_shape=str(settings.get("baseShape", "round")),
                sharp_edge=bool(settings["sharpEdge"]),
                alignment=cutter_alignment,
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
                base_shape=str(settings.get("baseShape", "round")),
                alignment=cutter_alignment,
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
                base_shape=str(settings.get("baseShape", "round")),
                sharp_edge=bool(settings["sharpEdge"]),
                alignment=cutter_alignment,
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
        if settings["mode"] == "stencil":
            stencil = build_stencil(
                main,
                width=settings["stencilWidth"],
                height=settings["stencilHeight"],
                rows=int(settings["stencilRows"]),
                cols=int(settings["stencilCols"]),
                spacing=settings["stencilSpacing"],
                thickness=settings["stencilThickness"],
                shape_size=settings["stencilShapeSize"],
                margin=settings["stencilMargin"],
                pattern=str(settings["stencilPattern"]),
                bridges=bool(settings["stencilBridges"]),
                bridge_width=settings["stencilBridgeWidth"],
            )
            parts.append(("Stencil", stencil, "#f39ab1"))
        if settings["mode"] == "topper":
            topper = build_topper(
                main,
                details,
                thickness=settings["topperThickness"],
                relief=settings["topperRelief"],
                pin_length=settings["topperPinLength"],
                pin_width=settings["topperPinWidth"],
                backing=settings["topperBacking"],
                pin_position=settings["topperPinPosition"],
                invert=bool(settings["topperInvert"]),
            )
            parts.append(("Topper", topper, "#f39ab1"))
        if settings["mode"] == "practice":
            practice = build_practice(
                main,
                thickness=settings["practiceThickness"],
                wall_height=settings["practiceWallHeight"],
                wall_width=settings["practiceWallWidth"],
            )
            parts.append(("Galleta de práctica", practice, "#f39ab1"))
        if settings["mode"] == "bookmark":
            bookmark = build_bookmark(
                main,
                details,
                width=settings["bookmarkWidth"],
                height=settings["bookmarkHeight"],
                thickness=settings["bookmarkThickness"],
                corner=settings["bookmarkCorner"],
                margin=settings["bookmarkMargin"],
                hole=bool(settings["bookmarkHole"]),
                hole_diameter=settings["bookmarkHoleDiameter"],
                hole_margin=settings["bookmarkHoleMargin"],
                relief=settings["bookmarkRelief"],
                style=str(settings["bookmarkDesignStyle"]),
                line_width=settings["lineWidth"],
            )
            parts.append(("Marcapáginas", bookmark, "#f39ab1"))
        if settings["mode"] == "cakepop":
            tray, plunger = build_cake_pop(
                main,
                details,
                mold_height=settings["cakePopMoldHeight"],
                mold_wall=settings["cakePopMoldWall"],
                base_height=settings["cakePopBase"],
                stick_hole=settings["cakePopStickHole"],
                hole_clearance=settings["cakePopHoleClearance"],
                plunger_clearance=settings["cakePopPlungerClearance"],
                plunger_back=settings["cakePopPlungerBack"],
                plunger_relief=settings["cakePopRelief"],
            )
            parts.append(("Molde cake pop", tray, "#f39ab1"))
            parts.append(("Prensador", plunger, "#b7a4e8"))
    except Exception as exc:
        raise ValueError(f"No se pudo generar la geometría: {exc}") from exc
    if settings.get("mirrorPair") and settings["mode"] in {"cutter", "cutter-stamp", "stamp"}:
        mirrored_main = affinity.scale(main, -1, 1, origin=(0, 0))
        mirrored_details = [affinity.scale(d, -1, 1, origin=(0, 0)) for d in details]
        mirror_cut_align, mirror_stamp_align = _alignment_locations(mirrored_main, settings)
        if settings["mode"] in {"cutter", "cutter-stamp"}:
            mirror_cutter = build_cutter(
                mirrored_main,
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
                base_shape=str(settings.get("baseShape", "round")),
                alignment=mirror_cut_align,
            )
            mirror_cutter = _add_cutter_extras(mirror_cutter, mirrored_main, settings)
            parts.append(("Cortador espejo", mirror_cutter, "#f39ab1"))
        if settings["mode"] in {"stamp", "cutter-stamp"}:
            mirror_stamp = build_stamp(
                mirrored_main,
                mirrored_details,
                back_height=settings["stampBack"],
                relief=settings["stampRelief"],
                clearance=settings["stampClearance"],
                border=bool(settings.get("stampBorder", True)),
                border_width=float(settings.get("stampBorderWidth", 1.6)),
                alignment=mirror_stamp_align,
                recessed=bool(settings.get("stampRecessed")),
            )
            parts.append(("Sello espejo", mirror_stamp, "#b7a4e8"))
    if not parts:
        raise ValueError("No se ha generado ninguna pieza.")
    return parts, warnings, main, details


def _wire_parts(raw: list[tuple[str, Any, str]]) -> list[dict[str, Any]]:
    return [_part(name, mesh, color) for name, mesh, color in raw]


def build(payload: dict[str, Any]) -> dict[str, Any]:
    t0 = time.perf_counter()
    shape = Shape.from_dict(payload["shape"])
    settings = _settings(payload.get("settings"))
    raw, warnings, main, details = _generate_meshes(shape, settings)
    parts = _wire_parts(raw)
    _arrange(parts)
    checks = _checks(parts, settings, warnings, main, details)
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
    if len(data) > 30 * 1024 * 1024:
        raise ValueError("El archivo supera 30 MB. Usa una imagen más ligera.")
    shape = analyze_bytes(
        data,
        payload.get("filename", "diseño.png"),
        float(payload.get("target_mm", 75.0)),
        force_filled=bool(payload.get("force_filled", False)),
    )
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
        if not placed:
            continue
        minx = min(mesh.bounds["min"][0] + off[0] for _n, mesh, _c, off in placed)
        maxx = max(mesh.bounds["max"][0] + off[0] for _n, mesh, _c, off in placed)
        shift = cursor_x - minx
        for obj_name, mesh, color, (ox, oy, oz) in placed:
            placed_all.append((
                f"{name_prefix} · {obj_name}",
                mesh,
                color,
                (ox + shift, oy, oz),
            ))
        cursor_x += (maxx - minx) + gap * 2
    # Center the whole collection around the origin.
    if placed_all:
        minx = min(mesh.bounds["min"][0] + off[0] for _n, mesh, _c, off in placed_all)
        maxx = max(mesh.bounds["max"][0] + off[0] for _n, mesh, _c, off in placed_all)
        shift = -(minx + maxx) / 2
        placed_all = [(n, m, c, (o[0] + shift, o[1], o[2])) for n, m, c, o in placed_all]
    data = three_mf_bytes(placed_all, payload.get("name", "calicocutters"))
    return {"data_b64": base64.b64encode(data).decode("ascii")}

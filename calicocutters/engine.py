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
from shapely.geometry import LineString, MultiPolygon, Point, Polygon, box
from shapely.ops import unary_union

from .mesh import (
    Mesh,
    _append_all,
    build_bookmark,
    build_cake_pop,
    build_cake_pop_two,
    build_cake_pop_tray,
    build_cutter,
    build_imprint,
    build_multicutter,
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
from .shape import Shape, _clean_polygon

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
    "baseShape": "rect",
    "addPressHandle": False,
    "pressHandleLength": 26.0,
    "pressHandleWidth": 10.0,
    "pressHandlePosition": 50.0,
    "pressHandleShape": "rounded",
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
    "stampBacking": "outline",
    "stampBackingPadding": 2.0,
    "stampGrip": False,
    "stampGripDiameter": 20.0,
    "stampGripDepth": 2.0,
    "stampDetailCurve": "none",
    "stampDetailGrow": 0.0,
    "mirror": False,
    "mirrorPair": False,
    "imprintDepth": 4.5,
    "imprintInvert": False,
    "imprintEdgesOnly": False,
    "imprintBaseWidth": 1.2,
    "imprintEdgeWidth": 1.2,
    "color": "#f39ab1",
    "multiRows": 2,
    "multiCols": 2,
    "multiSpacing": 4.0,
    "sandwichPart": "both",
    "sandwichDentShape": "round",
    "sandwichDentRound": False,
    "sandwichDentRadius": 1.0,
    "sandwichOffsetOutward": False,
    "sandwichSealWidth": 4.0,
    "sandwichGap": 0.5,
    "sandwichDentSize": 3.0,
    "sandwichDentSpacing": 8.0,
    "sandwichDentDepth": 2.0,
    "rollerDiameter": 35.0,
    "rollerLength": 90.0,
    "rollerRelief": 1.0,
    "rollerSourceScale": 100.0,
    "rollerRimHeight": 1.2,
    "rollerBore": 8.0,
    "rollerRepeatsAround": 2,
    "rollerRepeatsAlong": 1,
    "rollerRim": 2.0,
    "rollerPattern": "grid",
    "rollerPatternMode": "drawing",
    "rollerMargin": 0.0,
    "rollerRotate": False,
    "rollerInvert": False,
    "rollerBack": 0.0,
    "rollerRemoveEdge": False,
    "rollerDepthCurve": "round",
    "stencilLayout": "grid",
    "stencilWidth": 100.0,
    "stencilHeight": 100.0,
    "stencilRows": 1,
    "stencilCols": 1,
    "stencilSpacing": 3.0,
    "stencilMargin": 3.0,
    "stencilShapeSize": 0.0,
    "stencilPattern": "grid",
    "stencilBridges": True,
    "stencilBridgeWidth": 1.2,
    "stencilThickness": 1.5,
    "stencilLineWidth": 1.2,
    "topperThickness": 5.0,
    "topperRelief": 2.0,
    "topperBacking": 2.0,
    "topperPinLength": 40.0,
    "topperPinWidth": 6.0,
    "topperPinPosition": 0.0,
    "topperInvert": False,
    "topperDepthCurve": "none",
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
    "bookmarkDesignStyle": "relief",
    "pageClipGap": 0.6,
    "pageClipBridge": 4.0,
    "pageClipFlare": 0.0,
    "pageClipLip": 1.0,
    "pageClipHingeThickness": 0.6,
    "cakePopMoldHeight": 18.0,
    "cakePopMoldWall": 2.4,
    "cakePopBase": 2.0,
    "cakePopStickHole": 4.8,
    "cakePopHoleClearance": 0.4,
    "cakePopPlungerClearance": 0.6,
    "cakePopPlungerBack": 2.5,
    "cakePopRelief": 2.0,
    "cakePopPlungerFace": "imprint",
    "cakePopPlungerMode": "single",
    "cakePopTray": False,
    "cakePopTrayRotation": 180.0,
    "cakePopTrayDepth": 50.0,
    "cakePopTrayClearance": 1.0,
    "cakePopTrayMargin": 5.0,
    "cakePopTrayLength": 25.0,
    "cakePopTrayHeight": 12.0,
    "cutterSetMode": "sizes",
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
    "stampBackingPadding": (0.0, 12.0),
    "stampGripDiameter": (4.0, 60.0),
    "stampGripDepth": (0.5, 6.0),
    "stampDetailGrow": (0.0, 2.0),
    "imprintDepth": (1.0, 12.0),
    "imprintBaseWidth": (0.3, 8.0),
    "imprintEdgeWidth": (0.4, 4.0),
    "multiSpacing": (0.0, 30.0),
    "sandwichSealWidth": (0.8, 12.0),
    "sandwichGap": (0.0, 5.0),
    "sandwichDentSize": (1.0, 8.0),
    "sandwichDentSpacing": (2.0, 40.0),
    "sandwichDentDepth": (0.2, 6.0),
    "sandwichDentRadius": (0.2, 4.0),
    "rollerDiameter": (15.0, 120.0),
    "rollerLength": (20.0, 200.0),
    "rollerRelief": (0.2, 6.0),
    "rollerSourceScale": (10.0, 100.0),
    "rollerRimHeight": (0.0, 6.0),
    "rollerBore": (0.0, 40.0),
    "rollerRim": (0.0, 10.0),
    "rollerMargin": (0.0, 20.0),
    "rollerBack": (0.0, 8.0),
    "stencilWidth": (30.0, 250.0),
    "stencilHeight": (30.0, 250.0),
    "stencilSpacing": (0.5, 20.0),
    "stencilMargin": (0.0, 20.0),
    "stencilShapeSize": (0.0, 80.0),
    "stencilBridgeWidth": (0.6, 5.0),
    "stencilThickness": (0.6, 5.0),
    "stencilLineWidth": (0.4, 3.0),
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
    "pageClipGap": (0.2, 3.0),
    "pageClipBridge": (2.0, 10.0),
    "pageClipFlare": (0.0, 12.0),
    "pageClipLip": (0.4, 2.5),
    "pageClipHingeThickness": (0.3, 1.2),
    "cakePopMoldHeight": (6.0, 40.0),
    "cakePopMoldWall": (1.2, 8.0),
    "cakePopBase": (1.0, 8.0),
    "cakePopStickHole": (2.5, 12.0),
    "cakePopHoleClearance": (0.0, 2.0),
    "cakePopPlungerClearance": (0.2, 2.5),
    "cakePopPlungerBack": (1.0, 8.0),
    "cakePopRelief": (0.2, 8.0),
    "cakePopTrayRotation": (0.0, 359.0),
    "cakePopTrayDepth": (10.0, 90.0),
    "cakePopTrayClearance": (0.2, 5.0),
    "cakePopTrayMargin": (1.0, 20.0),
    "cakePopTrayLength": (0.0, 80.0),
    "cakePopTrayHeight": (4.0, 30.0),
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
    "rollerRepeatsAround": (1, 32),
    "rollerRepeatsAlong": (1, 32),
    "stencilRows": (1, 10),
    "stencilCols": (1, 10),
    "setCount": (2, 6),
}

_BOOLEAN_KEYS = {
    "lockAspect", "autoPrintable", "sharpEdge", "extraBlade",
    "addPressHandle", "pressHandlesBothEnds", "addBar", "stampRemoveOuterEdge", "stampBorder",
    "mirror", "mirrorPair", "stencilBridges", "topperInvert", "stampRecessed", "imprintInvert", "imprintEdgesOnly", "sandwichDentRound", "sandwichOffsetOutward", "stampGrip",
    "rollerRotate", "rollerInvert", "rollerRemoveEdge",
    "cakePopTray",
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
    out["baseShape"] = str(out.get("baseShape")) if str(out.get("baseShape")) in {"rect", "chamfer", "round"} else "rect"
    out["pressHandleShape"] = (
        str(out.get("pressHandleShape"))
        if str(out.get("pressHandleShape")) in {"round", "rect", "rounded"}
        else "rounded"
    )
    out["stampEdgeMethod"] = "offset" if str(out.get("stampEdgeMethod")) == "offset" else "preserve"
    out["stampDetailCurve"] = (
        str(out.get("stampDetailCurve"))
        if str(out.get("stampDetailCurve")) in {"chamfer", "round"}
        else "none"
    )
    out["sandwichPart"] = str(out.get("sandwichPart")) if str(out.get("sandwichPart")) in {"both", "cutter", "seal"} else "both"
    out["cutterSetMode"] = str(out.get("cutterSetMode")) if str(out.get("cutterSetMode")) in {"sizes", "shapes"} else "sizes"
    out["sandwichDentShape"] = str(out.get("sandwichDentShape")) if str(out.get("sandwichDentShape")) in {"triangle", "square"} else "round"
    out["stampBacking"] = str(out.get("stampBacking")) if str(out.get("stampBacking")) in {"rect"} else "outline"
    out["stencilPattern"] = "diagonal" if str(out.get("stencilPattern")) == "diagonal" else "random" if str(out.get("stencilPattern")) == "random" else "grid"
    out["stencilLayout"] = str(out.get("stencilLayout")) if str(out.get("stencilLayout")) in {"dimensions", "computed"} else "grid"
    out["rollerPattern"] = str(out.get("rollerPattern")) if str(out.get("rollerPattern")) in {"brick", "mirror"} else "grid"
    out["rollerPatternMode"] = str(out.get("rollerPatternMode")) if str(out.get("rollerPatternMode")) in {"drawing", "silhouette"} else "drawing"
    out["topperDepthCurve"] = str(out.get("topperDepthCurve")) if str(out.get("topperDepthCurve")) in {"chamfer", "round"} else "none"
    out["cakePopPlungerFace"] = str(out.get("cakePopPlungerFace")) if str(out.get("cakePopPlungerFace")) in {"outline", "none"} else "imprint"
    out["cakePopPlungerMode"] = str(out.get("cakePopPlungerMode")) if str(out.get("cakePopPlungerMode")) in {"two"} else "single"
    out["rollerDepthCurve"] = str(out.get("rollerDepthCurve")) if str(out.get("rollerDepthCurve")) in {"none", "chamfer", "round"} else "round"
    out["bookmarkDesignStyle"] = str(out.get("bookmarkDesignStyle")) if str(out.get("bookmarkDesignStyle")) in {"line", "relief", "none"} else "relief"
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


def _handle_polygon(length: float, width: float, shape: str) -> Polygon:
    if shape == "rect":
        return box(-length / 2.0, -width / 2.0, length / 2.0, width / 2.0)
    if shape == "round":
        return rounded_rect(length, width, width / 2.0)
    return rounded_rect(length, width, width * 0.45)


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
        shape = str(settings.get("pressHandleShape", "rounded"))
        handle = _handle_polygon(length, wid, shape)
        handle = affinity.translate(handle, cx, cy)
        mesh = mesh.append(extrude_polygon(handle, 0.0, max(3.0, settings["baseHeight"] + 1.2)))
        if settings.get("pressHandlesBothEnds"):
            top_handle = _handle_polygon(length, wid, shape)
            top_handle = affinity.translate(top_handle, cx, b[3] + wid * 0.35)
            mesh = mesh.append(extrude_polygon(top_handle, 0.0, max(3.0, settings["baseHeight"] + 1.2)))
    if settings.get("addBar") and settings["barWidth"] >= 0.4:
        bar = _bar_polygon(main, settings)
        mesh = mesh.append(extrude_polygon(bar, 0.0, max(2.0, settings["baseHeight"] + settings["bladeDepth"] * 0.7)))
    return mesh


def _sized_components(shape: Shape, settings: dict[str, Any]) -> list[Polygon]:
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
    comps: list[Polygon] = []
    for comp in shape.component_polygons:
        q = _transform_poly(comp, sx, sy)
        if settings.get("mirror"):
            q = affinity.scale(q, -1, 1, origin=(0, 0))
        clean = _clean_polygon(q)
        if clean is not None and clean.area > 1e-4:
            comps.append(clean)
    if not comps:
        comps = [main]
    # Keep only top-level disconnected shapes: interior islands belong to the
    # design, not to the cutter set.
    top: list[Polygon] = []
    for i, p in enumerate(comps):
        inside = False
        for j, other in enumerate(comps):
            if i == j or other.area <= p.area * 1.02:
                continue
            if other.contains(p.representative_point()):
                inside = True
                break
        if not inside:
            top.append(p)
    return top or comps


def _build_cutter_set_shapes(components: list[Polygon], settings: dict[str, Any]) -> Mesh:
    """One separate cutter per disconnected traced shape, arranged in a row."""
    spacing = float(settings["setSpacing"])
    bounds = [p.bounds for p in components]
    widths = [max(1e-6, b[2] - b[0]) for b in bounds]
    total = sum(widths) + spacing * max(0, len(components) - 1)
    cursor = -total / 2.0
    parts: list[Mesh] = []
    for p, width in zip(components, widths):
        align, _stamp_align = _alignment_locations(p, settings)
        mesh = build_cutter(
            p,
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
            base_shape=str(settings.get("baseShape", "rect")),
            alignment=align,
        )
        parts.append(mesh.translated([cursor + width / 2.0, 0.0, 0.0]))
        cursor += width + spacing
    return _append_all(parts)


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


def _bounds_dict(obj: Any) -> dict | None:
    try:
        return obj["bounds"] if isinstance(obj, dict) else obj.bounds
    except Exception:
        return None


def _fits_nested(cutter: Any, stamp: Any) -> bool:
    try:
        cb = _bounds_dict(cutter)
        sb = _bounds_dict(stamp)
        if not cb or not sb:
            return True
        cw = cb["max"][0] - cb["min"][0]
        ch = cb["max"][1] - cb["min"][1]
        sw = sb["max"][0] - sb["min"][0]
        sh = sb["max"][1] - sb["min"][1]
        return sw <= cw - 3.0 and sh <= ch - 3.0
    except Exception:
        return True


def _nested_pair(parts: list[dict[str, Any]]) -> bool:
    names = {p["name"] for p in parts}
    if len(parts) != 2 or "Cortador" not in names or "Sello" not in names:
        return False
    cutter = next(p for p in parts if p["name"] == "Cortador")
    stamp = next(p for p in parts if p["name"] == "Sello")
    return _fits_nested(cutter, stamp)


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
    cutter_like = mode in {"cutter", "cutter-stamp", "imprint", "multicutter", "cutter-set"} or (
        mode == "sandwich" and settings.get("sandwichPart", "both") != "seal"
    )
    stamp_like = mode in {"stamp", "cutter-stamp"} or (
        mode == "sandwich" and settings.get("sandwichPart", "both") != "cutter"
    )
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
        out.append(_check("warn", f"Separación del multicortador de {settings['multiSpacing']:.1f} mm", "Deja al menos 2–4 mm entre copias; si no, se fusionan al imprimir.", "multi_spacing"))

    if stamp_like:
        if settings["mode"] == "cutter-stamp":
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

    if mode == "sandwich" and settings.get("sandwichPart", "both") != "seal":
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
        around = max(1, int(settings["rollerRepeatsAround"]))
        along = max(1, int(settings["rollerRepeatsAlong"]))
        cell_min = min(
            2 * math.pi * (settings["rollerDiameter"] / 2) / around,
            settings["rollerLength"] / along,
        ) - settings["rollerMargin"] * 2
        if cell_min < 8:
            out.append(_check(
                "warn",
                f"Repeticiones de ~{max(0.0, cell_min):.0f} mm",
                "Demasiadas repeticiones para este diámetro o longitud; el dibujo quedaría diminuto. Reduce las repeticiones o aumenta el rodillo.",
                "roller_repeats",
            ))

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
        if settings["stencilLineWidth"] < max(0.6, line * 1.5):
            out.append(_check(
                "warn",
                f"Línea de stencil de {settings['stencilLineWidth']:.1f} mm",
                "Las líneas y el contorno pueden romperse al limpiar la plantilla. Usa al menos 1,2 mm.",
                "stencil_line",
            ))
        if 0 < settings["stencilShapeSize"] < 8:
            out.append(_check("warn", f"Forma de {settings['stencilShapeSize']:.0f} mm", "Las aberturas de menos de 8 mm son difíciles de limpiar y pueden romperse.", "stencil_small"))
        cols = max(1, int(settings["stencilCols"]))
        rows = max(1, int(settings["stencilRows"]))
        if cols * rows > 1 and settings["stencilShapeSize"] <= 0:
            cell = min(
                (settings["stencilWidth"] - settings["stencilMargin"] * 2) / cols,
                (settings["stencilHeight"] - settings["stencilMargin"] * 2) / rows,
            ) - settings["stencilSpacing"]
            if cell < 8:
                out.append(_check(
                    "warn",
                    f"Repeticiones de ~{max(0, cell):.0f} mm",
                    "Hay demasiadas filas o columnas para el tamaño de la lámina; la forma quedaría muy pequeña. Reduce las repeticiones o aumenta la lámina.",
                    "stencil_repeats",
                ))
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
        if settings["topperRelief"] > settings["topperThickness"]:
            out.append(_check("warn", f"Relieve de {settings['topperRelief']:.1f} mm", "Un relieve más alto que la base puede ser frágil; usa 2–4 mm o aumenta el grosor de la base.", "topper_relief"))

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
            out.append(_check("warn", f"Pinza de {settings['bookmarkThickness']:.1f} mm", "Una lámina de menos de 2 mm se dobla. Usa 2–3 mm.", "bookmark_thin"))
        if settings["bookmarkHeight"] < 50:
            out.append(_check("warn", f"Pinza de {settings['bookmarkHeight']:.0f} mm", "Para una página de libro suele necesitarse al menos 50 mm de alto.", "bookmark_short"))
        if settings["bookmarkRelief"] > max(0.2, settings["bookmarkThickness"]):
            out.append(_check("warn", "Marcado de la pinza demasiado profundo", "Reduce la profundidad o aumenta el grosor de la lámina para no debilitar la placa.", "bookmark_relief"))
        if settings["pageClipLip"] > settings["bookmarkThickness"] - 0.4:
            out.append(_check("warn", "Pivote demasiado alto", "Reduce la altura del pivote o aumenta el grosor de la placa para que no sobresalga.", "bookmark_pivot"))
        if settings["pageClipBridge"] > settings["bookmarkWidth"] * 0.35:
            out.append(_check("warn", "Pivote demasiado grande", "Un pivote grande debilita la prensa; usa un diámetro menor o una pinza más ancha.", "bookmark_pivot_size"))

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
            out.append(_check("warn", f"Punto de alineación de {settings['alignmentHoleDiameter']:.1f} mm", "Usa al menos 2 líneas para que el hundido se vea bien en la base.", "alignment_hole"))
        if settings["baseWidth"] < settings["alignmentHoleDiameter"] + 0.8:
            out.append(_check("warn", "Punto de alineación sin espacio", "Aumenta el ancho de la base o reduce el punto de alineación.", "alignment_space"))

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
    cutter_modes = {"cutter", "cutter-stamp", "imprint", "multicutter", "cutter-set"}
    if settings["mode"] == "sandwich" and settings.get("sandwichPart", "both") != "seal":
        cutter_modes.add("sandwich")
    stamp_modes = {"stamp", "cutter-stamp"}
    if settings["mode"] == "sandwich" and settings.get("sandwichPart", "both") != "cutter":
        stamp_modes.add("sandwich")
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
    if settings["mode"] == "cutter-stamp" and settings["stampClearance"] < settings["lineWidth"] * 1.5:
        warnings.append("La holgura del sello es muy justa para imprimir.")
    if settings["mode"] == "roller" and settings.get("rollerPattern") in {"brick", "mirror"}:
        requested = int(settings["rollerRepeatsAround"])
        if requested > 1 and requested % 2 == 1:
            warnings.append(
                f"Patrón {settings['rollerPattern']}: se usan {requested + 1} repeticiones "
                "alrededor para cerrar la costura."
            )
    if settings["mode"] == "roller" and settings.get("rollerRemoveEdge") and not details:
        warnings.append(
            "Quitar borde exterior: el dibujo no tiene detalles interiores; se usa la silueta."
        )

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
                base_shape=str(settings.get("baseShape", "rect")),
                alignment=cutter_alignment,
            )
            cutter = _add_cutter_extras(cutter, main, settings)
            parts.append(("Cortador", cutter, "#f39ab1"))
        if settings["mode"] == "cutter-set":
            if settings.get("cutterSetMode") == "shapes":
                cutters = _build_cutter_set_shapes(_sized_components(shape, settings), settings)
            else:
                cutters = _build_cutter_set(main, settings)
            parts.append(("Set de cortadores", cutters, "#f39ab1"))
        if settings["mode"] in {"stamp", "cutter-stamp"}:
            stamp = build_stamp(
                main,
                details,
                back_height=settings["stampBack"],
                relief=settings["stampRelief"],
                clearance=settings["stampClearance"] if settings["mode"] == "cutter-stamp" else 0.0,
                border=bool(settings.get("stampBorder", True)),
                border_width=float(settings.get("stampBorderWidth", 1.6)),
                border_height=(
                    max(0.3, min(0.8, settings["stampRelief"] * 0.3))
                    if settings["mode"] == "cutter-stamp"
                    else 0.0
                ),
                alignment=stamp_alignment,
                recessed=bool(settings.get("stampRecessed")),
                detail_curve=str(settings.get("stampDetailCurve", "none")),
                detail_grow=float(settings.get("stampDetailGrow", 0.0)),
                backing=str(settings.get("stampBacking", "outline")),
                backing_padding=float(settings.get("stampBackingPadding", 2.0)),
                grip=bool(settings.get("stampGrip")),
                grip_diameter=float(settings.get("stampGripDiameter", 20.0)),
                grip_depth=float(settings.get("stampGripDepth", 2.0)),
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
                base_shape=str(settings.get("baseShape", "rect")),
                sharp_edge=bool(settings["sharpEdge"]),
                alignment=cutter_alignment,
                detail_curve=str(settings.get("stampDetailCurve", "none")),
                detail_grow=float(settings.get("stampDetailGrow", 0.0)),
                extra_blade=bool(settings.get("extraBlade")),
                extra_blade_depth=settings.get("extraBladeDepth", 0),
                extra_blade_thickness=settings.get("extraBladeThickness", 0),
                invert=bool(settings.get("imprintInvert")),
                edges_only=bool(settings.get("imprintEdgesOnly")),
                base_inset=float(settings.get("imprintBaseWidth", 1.2)),
                edge_width=float(settings.get("imprintEdgeWidth", 1.2)),
            )
            imprint = _add_cutter_extras(imprint, main, settings)
            parts.append(("Impronta", imprint, "#f39ab1"))
        if settings["mode"] == "multicutter":
            multi = build_multicutter(
                main,
                blade_thickness=settings["bladeThickness"],
                blade_depth=settings["bladeDepth"],
                tip_width=settings["tipWidth"],
                chamfer_height=settings["chamferHeight"],
                base_height=settings["baseHeight"],
                base_width=settings["baseWidth"],
                rows=max(1, int(settings["multiRows"])),
                cols=max(1, int(settings["multiCols"])),
                spacing=settings["multiSpacing"],
                sharp_edge=bool(settings["sharpEdge"]),
                extra_blade=bool(settings.get("extraBlade")),
                extra_blade_depth=settings.get("extraBladeDepth", 0),
                extra_blade_thickness=settings.get("extraBladeThickness", 0),
                base_shape=str(settings.get("baseShape", "rect")),
                add_press_handle=bool(settings.get("addPressHandle")),
                press_handle_length=settings.get("pressHandleLength", 30),
                press_handle_width=settings.get("pressHandleWidth", 12),
                press_handle_position=settings.get("pressHandlePosition", 50),
                press_handle_shape=str(settings.get("pressHandleShape", "rounded")),
                press_handles_both_ends=bool(settings.get("pressHandlesBothEnds")),
            )
            if settings.get("addBar") and settings["barWidth"] >= 0.4:
                mb = multi.bounds
                multi_box = box(mb["min"][0], mb["min"][1], mb["max"][0], mb["max"][1])
                bar = _bar_polygon(multi_box, settings)
                multi = multi.append(extrude_polygon(
                    bar, 0.0, max(2.0, settings["baseHeight"] + settings["bladeDepth"] * 0.7)
                ))
            parts.append(("Multicortador", multi, "#f39ab1"))
        if settings["mode"] == "sandwich":
            sandwich_part = str(settings["sandwichPart"])
            if sandwich_part in {"both", "cutter"}:
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
                    base_shape=str(settings.get("baseShape", "rect")),
                    sharp_edge=bool(settings["sharpEdge"]),
                    alignment=cutter_alignment,
                )
                parts.append(("Cortador sándwich", sandwich, "#f39ab1"))
            if sandwich_part in {"both", "seal"}:
                sandwich_stamp = build_stamp(
                    main,
                    details,
                    back_height=settings["stampBack"],
                    relief=settings["stampRelief"],
                    clearance=settings["stampClearance"],
                    border=bool(settings.get("stampBorder", True)),
                    border_width=float(settings.get("stampBorderWidth", 1.6)),
                    alignment=stamp_alignment,
                    recessed=bool(settings.get("stampRecessed")),
                    detail_curve=str(settings.get("stampDetailCurve", "none")),
                    detail_grow=float(settings.get("stampDetailGrow", 0.0)),
                )
                parts.append(("Sello sándwich", sandwich_stamp, "#b7a4e8"))
        if settings["mode"] == "roller":
            roller = build_roller(
                main,
                diameter=settings["rollerDiameter"],
                length=settings["rollerLength"],
                relief=settings["rollerRelief"],
                source_scale=settings["rollerSourceScale"] / 100.0,
                rim_height=settings["rollerRimHeight"],
                bore=settings["rollerBore"],
                repeats_around=int(settings["rollerRepeatsAround"]),
                repeats_along=int(settings["rollerRepeatsAlong"]),
                rim=settings["rollerRim"],
                pattern=str(settings.get("rollerPattern", "grid")),
                pattern_mode=str(settings.get("rollerPatternMode", "drawing")),
                margin=settings.get("rollerMargin", 0.0),
                rotate=bool(settings.get("rollerRotate")),
                invert=bool(settings.get("rollerInvert")),
                back=settings.get("rollerBack", 0.0),
                remove_edge=bool(settings.get("rollerRemoveEdge")),
                depth_curve=str(settings.get("rollerDepthCurve", "round")),
                details=details,
            )
            parts.append(("Rodillo", roller, "#f39ab1"))
        if settings["mode"] == "stencil":
            stencil = build_stencil(
                main,
                details,
                width=settings["stencilWidth"],
                height=settings["stencilHeight"],
                rows=int(settings["stencilRows"]),
                cols=int(settings["stencilCols"]),
                spacing=settings["stencilSpacing"],
                thickness=settings["stencilThickness"],
                shape_size=settings["stencilShapeSize"],
                margin=settings["stencilMargin"],
                pattern=str(settings["stencilPattern"]),
                layout=str(settings.get("stencilLayout", "grid")),
                bridges=bool(settings["stencilBridges"]),
                bridge_width=settings["stencilBridgeWidth"],
                line_width=settings["stencilLineWidth"],
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
                detail_curve=str(settings.get("topperDepthCurve", "none")),
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
            bookmark_base, bookmark_press = build_bookmark(
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
                gap=settings["pageClipGap"],
                bridge=settings["pageClipBridge"],
                flare=settings["pageClipFlare"],
                lip=settings["pageClipLip"],
                hinge_thickness=settings["pageClipHingeThickness"],
            )
            parts.append(("Base pinza", bookmark_base, "#f39ab1"))
            parts.append(("Prensa pinza", bookmark_press, "#b7a4e8"))
        if settings["mode"] == "cakepop":
            if settings.get("cakePopPlungerMode") == "two":
                tray, face, back = build_cake_pop_two(
                    main, details,
                    mold_height=settings["cakePopMoldHeight"],
                    mold_wall=settings["cakePopMoldWall"],
                    base_height=settings["cakePopBase"],
                    stick_hole=settings["cakePopStickHole"],
                    hole_clearance=settings["cakePopHoleClearance"],
                    plunger_clearance=settings["cakePopPlungerClearance"],
                    plunger_back=settings["cakePopPlungerBack"],
                    plunger_relief=settings["cakePopRelief"],
                    plunger_face=str(settings.get("cakePopPlungerFace", "imprint")),
                )
                parts.append(("Molde cake pop", tray, "#f39ab1"))
                parts.append(("Cara prensador", face, "#b7a4e8"))
                parts.append(("Respaldo prensador", back, "#8ed1c3"))
            else:
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
                    plunger_face=str(settings.get("cakePopPlungerFace", "imprint")),
                )
                parts.append(("Molde cake pop", tray, "#f39ab1"))
                parts.append(("Prensador", plunger, "#b7a4e8"))
            if settings.get("cakePopTray"):
                support = build_cake_pop_tray(
                    main,
                    length=settings["cakePopTrayLength"],
                    height=settings["cakePopTrayHeight"],
                    depth_percent=settings["cakePopTrayDepth"],
                    clearance=settings["cakePopTrayClearance"],
                    margin=settings["cakePopTrayMargin"],
                    rotation=settings["cakePopTrayRotation"],
                    stick_hole=settings["cakePopStickHole"] + settings["cakePopHoleClearance"] * 2.0,
                )
                parts.append(("Bandeja cake pop", support, "#8ed1c3"))
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
                base_shape=str(settings.get("baseShape", "rect")),
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
                clearance=settings["stampClearance"] if settings["mode"] == "cutter-stamp" else 0.0,
                border=bool(settings.get("stampBorder", True)),
                border_width=float(settings.get("stampBorderWidth", 1.6)),
                border_height=(
                    max(0.3, min(0.8, settings["stampRelief"] * 0.3))
                    if settings["mode"] == "cutter-stamp"
                    else 0.0
                ),
                alignment=mirror_stamp_align,
                recessed=bool(settings.get("stampRecessed")),
                detail_curve=str(settings.get("stampDetailCurve", "none")),
                detail_grow=float(settings.get("stampDetailGrow", 0.0)),
                backing=str(settings.get("stampBacking", "outline")),
                backing_padding=float(settings.get("stampBackingPadding", 2.0)),
                grip=bool(settings.get("stampGrip")),
                grip_diameter=float(settings.get("stampGripDiameter", 20.0)),
                grip_depth=float(settings.get("stampGripDepth", 2.0)),
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
    if settings["mode"] == "bookmark":
        # The strip folds in half; report the folded clip size rather than the
        # full flat print footprint.
        width = settings["bookmarkWidth"]
        height = settings["bookmarkHeight"]
        depth = 2.0 * settings["bookmarkThickness"] + 0.2
    else:
        width = max(p["bounds"]["max"][0] for p in parts) - min(p["bounds"]["min"][0] for p in parts)
        height = max(p["bounds"]["max"][1] for p in parts) - min(p["bounds"]["min"][1] for p in parts)
        depth = max(p["bounds"]["max"][2] for p in parts) - min(p["bounds"]["min"][2] for p in parts)
    return {
        "parts": parts,
        "warnings": list(dict.fromkeys(warnings)),
        "checks": checks,
        "build_ms": (time.perf_counter() - t0) * 1000.0,
        "material_grams": total_volume / 1000.0 * 1.24,
        "dimensions": {
            "width": width,
            "height": height,
            "depth": depth,
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
        cutter = next(m for n, m, _c in raw if n == "Cortador")
        stamp = next(m for n, m, _c in raw if n == "Sello")
        if _fits_nested(cutter, stamp):
            # Nest the stamp inside the cutter's opening.  Both stay on the
            # bed; the clearance means they remain separate printable objects.
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

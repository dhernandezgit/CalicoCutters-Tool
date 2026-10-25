from __future__ import annotations

import io
import zipfile

import numpy as np
import pytest
import trimesh

from calicocutters.engine import DEFAULT_SETTINGS, build, export_3mf
from calicocutters.mesh import Mesh, extrude_polygon, three_mf_bytes
from calicocutters.shape import Shape, parse_raster, parse_svg
from shapely.geometry import Polygon


HEART = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<path fill="#111" d="M50 87C42 78 16 61 16 40C16 27 26 18 38 18C44 18 48 21 50 25C52 21 56 18 62 18C74 18 84 27 84 40C84 61 58 78 50 87Z"/>
<path fill="#111" d="M50 66C46 61 33 53 33 43C33 37 38 33 43 33C46 33 49 35 50 37C51 35 54 33 57 33C62 33 67 37 67 43C67 53 54 61 50 66Z"/>
</svg>"""


def _mesh_from_b64(data: str) -> trimesh.Trimesh:
    import base64
    raw = base64.b64decode(data)
    return trimesh.load(io.BytesIO(raw), file_type="stl", force="mesh")


def test_black_artwork_becomes_calico_pink():
    shape = parse_svg(HEART, "heart.svg", 80)
    assert shape.source_color == "#f39ab1"


def test_colored_svg_keeps_original_colour():
    colored = HEART.replace('fill="#111"', 'fill="#2f6fbb"')
    shape = parse_svg(colored, "blue.svg", 80)
    assert shape.source_color == "#2f6fbb"


def test_svg_parse_normalizes_and_keeps_details():
    shape = parse_svg(HEART, "heart.svg", 80)
    assert shape.name == "heart"
    assert shape.bounds["width"] <= 80.01
    assert shape.bounds["height"] <= 80.01
    assert len(shape.details) == 1
    assert shape.source_kind == "svg"
    assert not shape.holes


def test_svg_holes_are_preserved():
    svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path fill="#000" fill-rule="evenodd" d="M10 10H90V90H10Z M35 35H65V65H35Z"/>
    </svg>"""
    shape = parse_svg(svg, "frame.svg", 60)
    assert len(shape.holes) == 1
    assert shape.main_polygon.area < 60 * 60


def test_engine_builds_cutter_and_stamp():
    shape = parse_svg(HEART, "heart.svg", 80)
    result = build({"shape": shape.to_dict(), "settings": DEFAULT_SETTINGS})
    assert [p["name"] for p in result["parts"]] == ["Cortador", "Sello"]
    assert result["build_ms"] > 0
    for part in result["parts"]:
        mesh = _mesh_from_b64(part["stl_b64"])
        assert mesh.is_watertight, part["name"]
        assert mesh.is_winding_consistent, part["name"]
        assert mesh.volume > 0
        assert part["triangles"] > 100
    cutter = result["parts"][0]
    stamp = result["parts"][1]
    assert cutter["bounds"]["max"][2] == pytest.approx(15.5, abs=0.1)
    assert stamp["bounds"]["max"][2] == pytest.approx(8.5, abs=0.1)
    assert (cutter["bounds"]["max"][0] - cutter["bounds"]["min"][0]) > (
        stamp["bounds"]["max"][0] - stamp["bounds"]["min"][0]
    )


def test_engine_printability_checks():
    shape = parse_svg(HEART, "heart.svg", 80)
    settings = {**DEFAULT_SETTINGS, "bladeThickness": 0.3, "tipWidth": 0.1}
    result = build({"shape": shape.to_dict(), "settings": settings})
    levels = {c["level"] for c in result["checks"]}
    assert "error" in levels or "warn" in levels
    assert any("Cuchilla" in c["title"] for c in result["checks"])


def test_export_3mf_has_named_objects():
    shape = parse_svg(HEART, "heart.svg", 80)
    result = export_3mf({"shape": shape.to_dict(), "settings": DEFAULT_SETTINGS, "name": "galleta"})
    import base64
    raw = base64.b64decode(result["data_b64"])
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        names = set(z.namelist())
        assert "3D/3dmodel.model" in names
        model = z.read("3D/3dmodel.model").decode()
    assert 'name="Cortador"' in model
    assert 'name="Sello"' in model
    assert "unit=\"millimeter\"" in model


def test_extrude_is_watertight():
    poly = Polygon([(0, 0), (20, 0), (20, 20), (0, 20)], [[(5, 5), (5, 15), (15, 15), (15, 5)]])
    mesh = extrude_polygon(poly, 0, 5)
    tri = trimesh.Trimesh(mesh.vertices, mesh.faces, process=True)
    assert tri.is_watertight
    assert tri.volume == pytest.approx(1500, rel=0.02)


def _line_art_png() -> bytes:
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (420, 420), "white")
    d = ImageDraw.Draw(img)
    d.ellipse((30, 30, 390, 390), outline="black", width=12)
    d.ellipse((150, 150, 220, 220), fill="black")
    d.ellipse((260, 150, 300, 190), fill="black")
    d.arc((160, 230, 300, 330), 10, 170, fill="black", width=8)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_raster_line_art_builds_shape():
    shape = parse_raster(_line_art_png(), "line_art.png", 75)
    assert shape.source_kind == "raster"
    assert shape.bounds["width"] <= 75.01
    assert shape.bounds["height"] <= 75.01
    assert len(shape.details) > 0
    assert shape.warnings


def test_built_raster_stamp_is_watertight():
    shape = parse_raster(_line_art_png(), "line_art.png", 75)
    result = build({"shape": shape.to_dict(), "settings": DEFAULT_SETTINGS})
    stamp = _mesh_from_b64(result["parts"][1]["stl_b64"])
    assert stamp.is_watertight
    assert stamp.volume > 0


def test_mesh_orientation_flip():
    # Outward-facing cube, then reverse it and make sure orientation repair fixes it.
    v = np.array([
        [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
        [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
    ], dtype=float)
    f = np.array([
        [0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7],
        [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5],
        [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7],
    ])
    mesh = Mesh(v, f).merged().orient_consistent()
    assert mesh.signed_volume() > 0
    assert mesh.volume() == pytest.approx(1.0, rel=1e-6)

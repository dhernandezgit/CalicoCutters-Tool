from __future__ import annotations

import base64
import io
import zipfile

import pytest
import trimesh

from calicocutters.engine import DEFAULT_SETTINGS, build, export_3mf, export_3mf_multi
from calicocutters.shape import parse_svg

HEART = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<path fill="#111" d="M50 87C42 78 16 61 16 40C16 27 26 18 38 18C44 18 48 21 50 25C52 21 56 18 62 18C74 18 84 27 84 40C84 61 58 78 50 87Z"/>
<path fill="#111" d="M50 66C46 61 33 53 33 43C33 37 38 33 43 33C46 33 49 35 50 37C51 35 54 33 57 33C62 33 67 37 67 43C67 53 54 61 50 66Z"/>
</svg>"""


def _mesh(part):
    return trimesh.load(io.BytesIO(base64.b64decode(part["stl_b64"])), file_type="stl", force="mesh")


def _shape():
    return parse_svg(HEART, "heart.svg", 80)


def test_default_dimensions_and_nested_parts():
    result = build({"shape": _shape().to_dict(), "settings": DEFAULT_SETTINGS})
    cutter, stamp = result["parts"]
    assert cutter["name"] == "Cortador"
    assert stamp["name"] == "Sello"
    # Default: base 3.5 + blade 12 + tip 0.0 overlap = 15.5 mm tall.
    assert cutter["bounds"]["max"][2] == pytest.approx(15.5, abs=0.05)
    assert stamp["bounds"]["max"][2] == pytest.approx(8.5, abs=0.05)
    # The stamp is nested inside the cutter, not shifted sideways.
    assert stamp["preview_offset"] == [0.0, 0.0, 0.0]
    assert cutter["preview_offset"] == [0.0, 0.0, 0.0]
    # Final outline with base is about 80 mm + 2 * 4 mm.
    assert result["dimensions"]["width"] == pytest.approx(86.8, abs=1.2)
    assert result["dimensions"]["height"] == pytest.approx(86.7, abs=1.2)
    for part in result["parts"]:
        mesh = _mesh(part)
        assert mesh.is_watertight
        assert mesh.is_winding_consistent
        assert mesh.volume > 0
        assert mesh.bounds[0][2] == pytest.approx(0.0, abs=0.01)


@pytest.mark.parametrize("mode", ["cutter", "cutter-stamp", "stamp", "imprint", "multicutter", "sandwich", "roller", "stencil", "topper", "practice", "cakepop", "cutter-set"])
def test_all_creation_modes_produce_printable_meshes(mode):
    settings = {
        **DEFAULT_SETTINGS,
        "mode": mode,
        "rollerDiameter": 30,
        "rollerLength": 45,
        "rollerBore": 6,
        "rollerRepeatsAround": 2,
        "rollerRepeatsAlong": 1,
        "multiRows": 2,
        "multiCols": 2,
        "multiSpacing": 4,
    }
    result = build({"shape": _shape().to_dict(), "settings": settings})
    assert result["parts"], mode
    for part in result["parts"]:
        mesh = _mesh(part)
        assert mesh.is_watertight, f"{mode}: {part['name']}"
        assert mesh.is_winding_consistent, f"{mode}: {part['name']}"
        assert mesh.volume > 0
        assert part["triangles"] > 10
        assert all(abs(float(v)) < 1000 for v in mesh.vertices.reshape(-1))
        assert float(mesh.bounds[0][2]) == pytest.approx(0.0, abs=0.02)


def test_actionable_printability_checks():
    shape = _shape()
    result = build({"shape": shape.to_dict(), "settings": {
        **DEFAULT_SETTINGS,
        "bladeDepth": 20,
        "bladeThickness": 0.8,
        "stampRelief": 5,
    }})
    codes = {c.get("code") for c in result["checks"]}
    assert "thin_blade" in codes
    assert "tall_blade" in codes
    assert "geometry" in codes


def test_stamp_border_can_be_removed_cleanly():
    with_border = build({"shape": _shape().to_dict(), "settings": {
        **DEFAULT_SETTINGS,
        "mode": "stamp",
        "stampBorder": True,
    }})
    without_border = build({"shape": _shape().to_dict(), "settings": {
        **DEFAULT_SETTINGS,
        "mode": "stamp",
        "stampBorder": False,
    }})
    assert with_border["parts"][0]["volume"] > without_border["parts"][0]["volume"]
    for result in (with_border, without_border):
        mesh = _mesh(result["parts"][0])
        assert mesh.is_watertight
        assert mesh.is_winding_consistent
        assert mesh.bounds[0][2] == pytest.approx(0.0, abs=0.01)
        assert mesh.bounds[1][2] == pytest.approx(8.5, abs=0.1)


def test_extra_blade_adds_material_without_breaking_mesh():
    base = build({"shape": _shape().to_dict(), "settings": DEFAULT_SETTINGS})
    extra = build({"shape": _shape().to_dict(), "settings": {
        **DEFAULT_SETTINGS,
        "extraBlade": True,
        "extraBladeDepth": 6,
        "extraBladeThickness": 0.4,
    }})
    assert extra["parts"][0]["volume"] > base["parts"][0]["volume"]
    assert _mesh(extra["parts"][0]).is_watertight


def test_puzzle_grid_repeats_cutter():
    result = build({"shape": _shape().to_dict(), "settings": {
        **DEFAULT_SETTINGS,
        "mode": "multicutter",
        "multiRows": 2,
        "multiCols": 3,
        "multiSpacing": 3,
    }})
    assert result["parts"][0]["name"] == "Puzzle"
    mesh = _mesh(result["parts"][0])
    assert mesh.is_watertight
    # Six independent cutter cells are expected.
    assert len(mesh.split(only_watertight=False)) >= 6


def test_sandwich_has_cutter_and_seal():
    result = build({"shape": _shape().to_dict(), "settings": {
        **DEFAULT_SETTINGS,
        "mode": "sandwich",
        "sandwichSealWidth": 4,
        "sandwichGap": 0.6,
    }})
    mesh = _mesh(result["parts"][0])
    assert mesh.is_watertight
    assert result["parts"][0]["volume"] > 0


def test_3mf_is_millimetres_and_has_separate_objects():
    shape = _shape()
    result = export_3mf({"shape": shape.to_dict(), "settings": DEFAULT_SETTINGS, "name": "galleta"})
    raw = base64.b64decode(result["data_b64"])
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        model = z.read("3D/3dmodel.model").decode("utf-8")
    assert 'unit="millimeter"' in model
    assert 'name="Cortador"' in model
    assert 'name="Sello"' in model
    assert model.count("<item ") == 2
    colored = export_3mf({
        "shape": shape.to_dict(),
        "settings": {**DEFAULT_SETTINGS, "color": "#f39ab1"},
        "name": "galleta",
    })
    with zipfile.ZipFile(io.BytesIO(base64.b64decode(colored["data_b64"]))) as z:
        colored_model = z.read("3D/3dmodel.model").decode("utf-8")
    assert "#f39ab1" in colored_model


def test_multi_3mf_has_one_object_per_design():
    shape = _shape()
    result = export_3mf_multi({
        "name": "coleccion",
        "items": [
            {"name": "Corazón", "shape": shape.to_dict(), "settings": {**DEFAULT_SETTINGS, "color": "#f39ab1"}},
            {"name": "Corazón 2", "shape": shape.to_dict(), "settings": {**DEFAULT_SETTINGS, "color": "#b7a4e8"}},
        ],
    })
    raw = base64.b64decode(result["data_b64"])
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        model = z.read("3D/3dmodel.model").decode("utf-8")
    assert "Corazón · Cortador" in model
    assert "Corazón 2 · Sello" in model
    assert "#f39ab1" in model
    assert "#b7a4e8" in model


def test_cutter_set_contains_several_watertight_cutters():
    result = build({"shape": _shape().to_dict(), "settings": {
        **DEFAULT_SETTINGS,
        "mode": "cutter-set",
        "setCount": 3,
        "setStep": 0.2,
        "setSpacing": 8,
    }})
    mesh = _mesh(result["parts"][0])
    assert result["parts"][0]["name"] == "Set de cortadores"
    assert mesh.is_watertight
    assert len(mesh.split(only_watertight=False)) >= 3


def test_cake_pop_has_mould_and_plunger():
    result = build({"shape": _shape().to_dict(), "settings": {
        **DEFAULT_SETTINGS,
        "mode": "cakepop",
        "cakePopMoldHeight": 18,
        "cakePopStickHole": 4.8,
    }})
    assert [p["name"] for p in result["parts"]] == ["Molde cake pop", "Prensador"]
    for part in result["parts"]:
        mesh = _mesh(part)
        assert mesh.is_watertight
        assert mesh.volume > 0


def test_stencil_stays_inside_requested_sheet():
    result = build({"shape": _shape().to_dict(), "settings": {
        **DEFAULT_SETTINGS,
        "mode": "stencil",
        "stencilWidth": 100,
        "stencilHeight": 80,
        "stencilRows": 3,
        "stencilCols": 3,
        "stencilShapeSize": 14,
        "stencilMargin": 3,
        "stencilBridges": True,
    }})
    mesh = _mesh(result["parts"][0])
    assert mesh.is_watertight
    assert mesh.bounds[1][0] - mesh.bounds[0][0] == pytest.approx(100, abs=0.2)
    assert mesh.bounds[1][1] - mesh.bounds[0][1] == pytest.approx(80, abs=0.2)


def test_multi_3mf_places_designs_without_overlap():
    import xml.etree.ElementTree as ET
    shape = _shape()
    result = export_3mf_multi({
        "name": "coleccion",
        "items": [
            {"name": "A", "shape": shape.to_dict(), "settings": {**DEFAULT_SETTINGS, "mode": "stamp"}},
            {"name": "B", "shape": shape.to_dict(), "settings": {**DEFAULT_SETTINGS, "mode": "stamp"}},
        ],
    })
    raw = base64.b64decode(result["data_b64"])
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        root = ET.fromstring(z.read("3D/3dmodel.model"))
    objects = {}
    for obj in root.iter():
        if obj.tag.endswith("object"):
            objects[obj.attrib.get("id")] = obj
    ranges = []
    for item in root.iter():
        if not item.tag.endswith("item"):
            continue
        obj = objects[item.attrib["objectid"]]
        values = item.attrib["transform"].split()
        tx = float(values[9])
        xs = [
            float(v.attrib["x"]) + tx
            for v in obj.iter()
            if v.tag.endswith("vertex")
        ]
        ranges.append((min(xs), max(xs)))
    ranges.sort()
    white = [(min(a, b), max(a, b)) for a, b in zip(ranges, ranges[1:])]
    for left, right in white:
        assert right[0] - left[1] >= 10.0

    svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path fill="#111" fill-rule="evenodd" d="M10 10H90V90H10Z M35 35H65V65H35Z"/>
    </svg>"""
    shape = parse_svg(svg, "frame.svg", 80)
    settings = {
        **DEFAULT_SETTINGS,
        "mode": "stencil",
        "stencilRows": 2,
        "stencilCols": 2,
        "stencilShapeSize": 20,
        "stencilBridges": True,
    }
    with_bridges = _mesh(build({"shape": shape.to_dict(), "settings": settings})["parts"][0])
    settings["stencilBridges"] = False
    without_bridges = _mesh(build({"shape": shape.to_dict(), "settings": settings})["parts"][0])
    assert with_bridges.is_watertight
    assert without_bridges.is_watertight
    assert len(with_bridges.split(only_watertight=False)) < len(without_bridges.split(only_watertight=False))


def test_topper_invert_relief_is_watertight():
    common = {
        **DEFAULT_SETTINGS,
        "mode": "topper",
        "topperBacking": 2,
        "topperPinLength": 35,
    }
    normal = build({"shape": _shape().to_dict(), "settings": common})
    inverted = build({"shape": _shape().to_dict(), "settings": {**common, "topperInvert": True}})
    assert _mesh(normal["parts"][0]).is_watertight
    assert _mesh(inverted["parts"][0]).is_watertight
    assert inverted["parts"][0]["volume"] != normal["parts"][0]["volume"]



def test_invalid_settings_are_clamped_instead_of_crashing():
    result = build({"shape": _shape().to_dict(), "settings": {
        **DEFAULT_SETTINGS,
        "mode": "cutter",
        "longest": 0,
        "width": -20,
        "height": 0,
        "lineWidth": 0,
        "bladeThickness": -1,
        "bladeDepth": 0,
    }})
    assert result["parts"]
    assert result["dimensions"]["width"] > 0
    assert result["dimensions"]["height"] > 0


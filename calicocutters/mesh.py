"""Mesh construction and STL/3MF writers.

No 3D CSG is required: cutter and stamp solids are built from watertight
extrusions and lofted annular profiles. Overlapping components are kept as
separate shells, which every slicer unions at slice time.
"""

from __future__ import annotations

import io
import math
import struct
import zipfile
from dataclasses import dataclass
from typing import Iterable, Sequence
from xml.sax.saxutils import escape

import numpy as np
from shapely import affinity
from shapely.geometry import LineString, MultiPolygon, Point, Polygon, box
from shapely.ops import nearest_points, unary_union
from shapely.geometry.polygon import orient

from .vendor.earcut import earcut


@dataclass
class Mesh:
    vertices: np.ndarray
    faces: np.ndarray

    def __post_init__(self) -> None:
        self.vertices = np.asarray(self.vertices, dtype=np.float64)
        self.faces = np.asarray(self.faces, dtype=np.int64)

    def append(self, other: "Mesh") -> "Mesh":
        if len(self.vertices) == 0:
            return other.copy()
        if len(other.vertices) == 0:
            return self.copy()
        offset = len(self.vertices)
        return Mesh(
            np.vstack([self.vertices, other.vertices]),
            np.vstack([self.faces, other.faces + offset]),
        )

    def copy(self) -> "Mesh":
        return Mesh(self.vertices.copy(), self.faces.copy())

    def merged(self, decimals: int = 6) -> "Mesh":
        """Merge coincident vertices so cap and wall seams are watertight."""
        if len(self.vertices) == 0 or len(self.faces) == 0:
            return self
        rounded = np.round(self.vertices, decimals=decimals)
        unique, inverse = np.unique(rounded, axis=0, return_inverse=True)
        faces = inverse[self.faces]
        keep = (
            (faces[:, 0] != faces[:, 1])
            & (faces[:, 1] != faces[:, 2])
            & (faces[:, 0] != faces[:, 2])
        )
        return Mesh(unique, faces[keep])

    def oriented(self) -> "Mesh":
        if len(self.faces) == 0:
            return self
        if self.signed_volume() < 0:
            return Mesh(self.vertices, self.faces[:, ::-1].copy())
        return self

    def orient_consistent(self) -> "Mesh":
        """Make adjacent triangles traverse shared edges in opposite directions.

        This is a tiny BFS orientation repair.  It is needed after merging cap
        and wall vertices because a closed mesh with one flipped cap is still
        watertight but slices badly.
        """
        if len(self.faces) == 0:
            return self
        faces = self.faces.copy()
        edge_map: dict[tuple[int, int], list[tuple[int, int]]] = {}
        for fi, f in enumerate(faces):
            for a, b in ((f[0], f[1]), (f[1], f[2]), (f[2], f[0])):
                key = (int(a), int(b)) if a < b else (int(b), int(a))
                direction = 1 if (int(a), int(b)) == key else -1
                edge_map.setdefault(key, []).append((fi, direction))
        visited = np.zeros(len(faces), dtype=bool)
        flips = np.zeros(len(faces), dtype=bool)
        for start in range(len(faces)):
            if visited[start]:
                continue
            visited[start] = True
            queue = [start]
            while queue:
                fi = queue.pop()
                f = faces[fi]
                for a, b in ((f[0], f[1]), (f[1], f[2]), (f[2], f[0])):
                    key = (int(a), int(b)) if a < b else (int(b), int(a))
                    raw_dir = 1 if (int(a), int(b)) == key else -1
                    effective = raw_dir * (-1 if flips[fi] else 1)
                    adj = edge_map.get(key, [])
                    if len(adj) != 2:
                        continue
                    for fj, neighbor_dir in adj:
                        if fj == fi or visited[fj]:
                            continue
                        desired = -effective
                        flips[fj] = neighbor_dir != desired
                        visited[fj] = True
                        queue.append(fj)
        faces[flips] = faces[flips][:, ::-1]
        out = Mesh(self.vertices, faces)
        return out.oriented()

    def signed_volume(self) -> float:
        if len(self.faces) == 0:
            return 0.0
        v = self.vertices
        f = self.faces
        a = v[f[:, 0]]
        b = v[f[:, 1]]
        c = v[f[:, 2]]
        return float(np.einsum("ij,ij->i", a, np.cross(b, c)).sum() / 6.0)

    def volume(self) -> float:
        return abs(self.signed_volume())

    @property
    def bounds(self) -> dict[str, list[float]]:
        if len(self.vertices) == 0:
            return {"min": [0, 0, 0], "max": [0, 0, 0]}
        return {
            "min": [float(x) for x in self.vertices.min(axis=0)],
            "max": [float(x) for x in self.vertices.max(axis=0)],
        }

    @property
    def triangles(self) -> int:
        return int(len(self.faces))

    def translated(self, offset: Sequence[float]) -> "Mesh":
        v = self.vertices.copy()
        v += np.asarray(offset, dtype=float)
        return Mesh(v, self.faces.copy())

    def stl_bytes(self) -> bytes:
        return mesh_to_stl(self)


def _triangle_area2(p: np.ndarray, q: np.ndarray, r: np.ndarray) -> float:
    return (q[0] - p[0]) * (r[1] - p[1]) - (r[0] - p[0]) * (q[1] - p[1])


def triangulate_polygon(poly: Polygon) -> tuple[np.ndarray, np.ndarray]:
    """Triangulate a Shapely polygon with holes using the vendored earcut."""
    if poly.is_empty:
        return np.zeros((0, 2)), np.zeros((0, 3), dtype=np.int64)
    poly = orient(poly, sign=1.0)
    rings: list[np.ndarray] = [np.asarray(poly.exterior.coords[:-1], dtype=float)]
    for interior in poly.interiors:
        rings.append(np.asarray(interior.coords[:-1], dtype=float))
    flat: list[float] = []
    hole_indices: list[int] = []
    cursor = 0
    for i, ring in enumerate(rings):
        if i > 0:
            hole_indices.append(cursor)
        flat.extend(ring.reshape(-1).tolist())
        cursor += len(ring)
    verts = np.asarray(flat, dtype=float).reshape(-1, 2)
    if len(verts) < 3:
        return np.zeros((0, 2)), np.zeros((0, 3), dtype=np.int64)
    try:
        faces = np.asarray(earcut(flat, hole_indices if hole_indices else None, 2), dtype=np.int64)
    except Exception:
        return np.zeros((0, 2)), np.zeros((0, 3), dtype=np.int64)
    if len(faces) % 3 != 0:
        return np.zeros((0, 2)), np.zeros((0, 3), dtype=np.int64)
    faces = faces.reshape(-1, 3)
    # Ensure every triangle is CCW in 2D.
    for i, tri in enumerate(faces):
        if _triangle_area2(verts[tri[0]], verts[tri[1]], verts[tri[2]]) < 0:
            faces[i] = tri[[0, 2, 1]]
    return verts, faces


def triangulate_rings(outer: np.ndarray, inner: np.ndarray) -> np.ndarray:
    """Triangulate an annulus, preserving every input boundary vertex."""
    flat: list[float] = []
    for ring in (outer, inner):
        flat.extend(np.asarray(ring, dtype=float).reshape(-1).tolist())
    try:
        faces = np.asarray(earcut(flat, [len(outer)] if len(inner) else None, 2), dtype=np.int64)
    except Exception:
        return np.zeros((0, 3), dtype=np.int64)
    if len(faces) % 3:
        return np.zeros((0, 3), dtype=np.int64)
    faces = faces.reshape(-1, 3)
    pts = np.vstack([outer, inner])
    for i, tri in enumerate(faces):
        a, b, c = int(tri[0]), int(tri[1]), int(tri[2])
        if _triangle_area2(pts[a], pts[b], pts[c]) < 0:
            faces[i] = [a, c, b]
    return faces


def _jitter_ring(coords, seed: int) -> list[tuple[float, float]]:
    out: list[tuple[float, float]] = []
    for i, (x, y) in enumerate(coords):
        out.append((
            float(x) + 0.001 * math.sin((i + 1) * 1.71 + seed),
            float(y) + 0.001 * math.cos((i + 1) * 2.13 + seed),
        ))
    return out


def _jitter_polygon(poly: Polygon) -> Polygon:
    """Sub-micron jitter so earcut keeps every boundary vertex.

    Without it, earcut may collapse long collinear edges; the cap then has
    fewer boundary vertices than the side wall and the STL is not watertight.
    Holes that touch the outer ring are also inset by 0.08 mm; this is far
    below print resolution and makes line-art relief triangulate reliably.
    """
    ext = _jitter_ring(list(poly.exterior.coords[:-1]), 0.0)
    ext_poly = Polygon(ext)
    holes: list[list[tuple[float, float]]] = []
    for i, ring in enumerate(poly.interiors):
        hole_poly = Polygon(ring)
        # Only inset holes that touch or nearly touch the outer ring.  Insetting
        # every hole used to deform sharp interior cusps and could leave a
        # tiny open edge at the cusp.
        if ext_poly.distance(hole_poly) < 0.05:
            q = hole_poly.buffer(-0.08, join_style=2, mitre_limit=2.0)
            if q.is_empty or q.area < 0.02:
                continue
            if q.geom_type == "Polygon" and ext_poly.buffer(0.05).contains(q):
                holes.append(_jitter_ring(list(q.exterior.coords[:-1]), i + 1.0))
                continue
        holes.append(_jitter_ring(list(ring.coords[:-1]), i + 1.0))
    return Polygon(ext, holes)


def extrude_polygon(poly: Polygon | MultiPolygon, z0: float, height: float) -> Mesh:
    """Watertight extrusion of a polygon with holes."""
    if poly is None or poly.is_empty or height <= 0:
        return Mesh(np.zeros((0, 3)), np.zeros((0, 3), dtype=np.int64))
    if isinstance(poly, MultiPolygon):
        pieces = [p for p in poly.geoms if not p.is_empty and p.area > 1e-8]
        if not pieces:
            return Mesh(np.zeros((0, 3)), np.zeros((0, 3), dtype=np.int64))
        out = extrude_polygon(pieces[0], z0, height)
        for piece in pieces[1:]:
            out = out.append(extrude_polygon(piece, z0, height))
        return out
    poly = _jitter_polygon(poly)
    verts2d, faces = triangulate_polygon(poly)
    if len(faces) == 0:
        return Mesh(np.zeros((0, 3)), np.zeros((0, 3), dtype=np.int64))
    n = len(verts2d)
    z1 = z0 + height
    bottom = np.column_stack([verts2d, np.full(n, z0)])
    top = np.column_stack([verts2d, np.full(n, z1)])
    vertices = np.vstack([bottom, top])
    all_faces: list[list[int]] = []
    for tri in faces:
        all_faces.append([int(tri[0]), int(tri[2]), int(tri[1])])  # bottom normal down
        all_faces.append([int(tri[0]) + n, int(tri[1]) + n, int(tri[2]) + n])

    # Walls: exterior and holes.
    rings = [np.asarray(poly.exterior.coords[:-1], dtype=float)]
    rings.extend(np.asarray(r.coords[:-1], dtype=float) for r in poly.interiors)
    for ri, ring in enumerate(rings):
        m = len(ring)
        if m < 3:
            continue
        base = len(vertices)
        for i in range(m):
            x, y = ring[i]
            vertices = np.vstack([vertices, [x, y, z0], [x, y, z1]])
        reverse = ri > 0
        for i in range(m):
            j = (i + 1) % m
            a = base + i * 2
            b = base + j * 2
            c = b + 1
            d = a + 1
            if reverse:
                all_faces.append([a, c, b])
                all_faces.append([a, d, c])
            else:
                all_faces.append([a, b, c])
                all_faces.append([a, c, d])
    return Mesh(vertices, np.asarray(all_faces, dtype=np.int64)).merged().orient_consistent()


def _ring_array(
    ring: Iterable[tuple[float, float]], n: int, ref: tuple[float, float] | None = None
) -> np.ndarray:
    pts = np.asarray(list(ring), dtype=float)
    if len(pts) < 3:
        return np.zeros((0, 2))
    if np.allclose(pts[0], pts[-1]):
        pts = pts[:-1]
    # Consistent start: nearest point to a reference point.  Using the same
    # reference for outer and inner loops keeps the cap ring from twisting.
    if ref is None:
        c = pts.mean(axis=0)
        ref = (float(c[0] + max(1.0, np.ptp(pts[:, 0]))), float(c[1]))
    d = np.hypot(pts[:, 0] - ref[0], pts[:, 1] - ref[1])
    start = int(np.argmin(d))
    pts = np.roll(pts, -start, axis=0)
    closed = np.vstack([pts, pts[0]])
    seg = np.linalg.norm(np.diff(closed, axis=0), axis=1)
    total = float(seg.sum())
    if total <= 1e-9:
        return np.zeros((0, 2))
    cum = np.concatenate([[0.0], np.cumsum(seg)])
    targets = np.linspace(0, total, n, endpoint=False)
    out = np.zeros((n, 2), dtype=float)
    for i, t in enumerate(targets):
        k = int(np.searchsorted(cum, t, side="right") - 1)
        k = min(max(k, 0), len(seg) - 1)
        f = (t - cum[k]) / max(seg[k], 1e-12)
        out[i] = closed[k] + (closed[k + 1] - closed[k]) * f
    # Sub-micron anti-collinear jitter: earcut otherwise collapses long
    # straight edges to their endpoints, which breaks cap/wall connectivity.
    # 0.001 mm is far below any FDM or resin feature size.
    j = np.arange(n, dtype=float)
    out[:, 0] += 0.001 * np.sin(j * 1.71)
    out[:, 1] += 0.001 * np.cos(j * 2.13)
    return out


def _signed_area(ring: np.ndarray) -> float:
    if len(ring) < 3:
        return 0.0
    x = ring[:, 0]
    y = ring[:, 1]
    return float((x * np.roll(y, -1) - np.roll(x, -1) * y).sum() / 2)


def _ring_loft(layers: list[tuple[float, np.ndarray, np.ndarray]], segments: int = 160) -> Mesh:
    """Loft annular layers. Each layer = (z, outer_loop, inner_loop).

    The outer and inner loops are resampled to the same count, so the resulting
    outer and inner surfaces connect cleanly. This is what gives the cutter a
    single watertight wall with a stepped base and a sharpened tip.
    """
    if not layers:
        return Mesh(np.zeros((0, 3)), np.zeros((0, 3), dtype=np.int64))
    first_outer = _ring_array(layers[0][1], segments)
    if len(first_outer) == 0:
        return Mesh(np.zeros((0, 3)), np.zeros((0, 3), dtype=np.int64))
    ref = (float(first_outer[0, 0]), float(first_outer[0, 1]))
    cleaned: list[tuple[float, np.ndarray, np.ndarray]] = []
    for z, outer, inner in layers:
        o = _ring_array(outer, segments, ref)
        i = _ring_array(inner, segments, ref)
        if len(o) != segments or len(i) != segments:
            continue
        if _signed_area(o) < 0:
            o = o[::-1]
        if _signed_area(i) > 0:
            i = i[::-1]
        cleaned.append((float(z), o, i))
    if len(cleaned) < 2:
        return Mesh(np.zeros((0, 3)), np.zeros((0, 3), dtype=np.int64))

    n = segments
    verts: list[list[float]] = []
    faces: list[list[int]] = []
    for z, o, i in cleaned:
        for x, y in o:
            verts.append([float(x), float(y), z])
        for x, y in i:
            verts.append([float(x), float(y), z])
    # Outer surface: each layer pair.
    for k in range(len(cleaned) - 1):
        z0, o0, i0 = cleaned[k]
        z1, o1, i1 = cleaned[k + 1]
        if abs(z1 - z0) < 1e-9 and np.allclose(o0, o1, atol=1e-7):
            pass
        else:
            a = k * 2 * n
            b = (k + 1) * 2 * n
            for j in range(n):
                j2 = (j + 1) % n
                p0 = a + j
                p1 = a + j2
                q0 = b + j
                q1 = b + j2
                faces.append([p0, p1, q1])
                faces.append([p0, q1, q0])
        if not (abs(z1 - z0) < 1e-9 and np.allclose(i0, i1, atol=1e-7)):
            a = k * 2 * n + n
            b = (k + 1) * 2 * n + n
            for j in range(n):
                j2 = (j + 1) % n
                p0 = a + j
                p1 = a + j2
                q0 = b + j
                q1 = b + j2
                faces.append([p0, p1, q1])
                faces.append([p0, q1, q0])
    # Caps.  The anti-collinear jitter in _ring_array keeps every boundary
    # vertex in earcut's output, so cap boundary edges match the wall edges.
    for layer_index, _z, flip in ((0, cleaned[0][0], True), (len(cleaned) - 1, cleaned[-1][0], False)):
        base = layer_index * 2 * n
        _, o, i = cleaned[layer_index]
        f2 = triangulate_rings(o, i)
        for tri in f2:
            if flip:
                faces.append([base + int(tri[0]), base + int(tri[2]), base + int(tri[1])])
            else:
                faces.append([base + int(tri[0]), base + int(tri[1]), base + int(tri[2])])
    return Mesh(np.asarray(verts), np.asarray(faces, dtype=np.int64)).merged().orient_consistent()


def cutter_rings(
    outer: Polygon,
    thickness: float,
    base_width: float,
    tip_width: float,
    inset: float = 0.25,
    base_shape: str = "round",
):
    """Return base, blade and tip ring polygons for an outline."""
    if base_shape == "rect":
        join_style, miter, segs = 2, 2.0, 1
    elif base_shape == "chamfer":
        join_style, miter, segs = 3, 2.0, 1
    else:
        join_style, miter, segs = 1, 2.0, 8
    expanded_base = outer.buffer(base_width, join_style=join_style, mitre_limit=miter, quad_segs=segs)
    base_ring = expanded_base.difference(outer.buffer(-inset, join_style=1, quad_segs=8))
    expanded_blade = outer.buffer(thickness, join_style=1, quad_segs=8)
    blade_ring = expanded_blade.difference(outer)
    expanded_tip = outer.buffer(max(0.2, tip_width), join_style=1, quad_segs=8)
    tip_ring = expanded_tip.difference(outer)
    return _ring_parts(base_ring), _ring_parts(blade_ring), _ring_parts(tip_ring)


def _curved_relief_layers(
    poly: Polygon, z0: float, height: float, curve: str
) -> list[tuple[Polygon, float, float]]:
    """Stacked inset layers that soften the top edge of a raised detail."""
    if poly.is_empty or height <= 0.01:
        return []
    curve = curve if curve in {"chamfer", "round"} else "none"
    if curve == "none":
        return [(poly, z0, height)]
    amount = min(0.9, max(0.25, height * 0.3))
    if curve == "chamfer":
        low = max(0.15, height - amount)
        top = poly.buffer(-amount, join_style=1, quad_segs=8)
        layers = [(poly, z0, low)]
        if not top.is_empty:
            layers.append((top, z0 + low - 0.01, min(amount, height - low) + 0.01))
        return layers
    # A two-stage loft reads as a rounded relief at normal print scale while
    # keeping a single, clean interface between the two shells.
    low = max(0.2, height * 0.65)
    top = poly.buffer(-amount * 0.55, join_style=1, quad_segs=8)
    layers = [(poly, z0, low)]
    if not top.is_empty:
        layers.append((top, z0 + low - 0.01, max(0.1, height - low) + 0.01))
    return layers


def _ring_parts(geom) -> list[Polygon]:
    if geom is None or geom.is_empty:
        return []
    if isinstance(geom, Polygon):
        return [geom]
    if isinstance(geom, MultiPolygon):
        return list(geom.geoms)
    if hasattr(geom, "geoms"):
        out: list[Polygon] = []
        for g in geom.geoms:
            out.extend(_ring_parts(g))
        return out
    return []


def _subdivide_flat(mesh: Mesh, iterations: int) -> Mesh:
    """Uniform 1-to-4 subdivision, used before wrapping onto a cylinder."""
    if iterations <= 0 or len(mesh.faces) == 0:
        return mesh
    verts = [tuple(v) for v in mesh.vertices]
    faces = [tuple(int(i) for i in f) for f in mesh.faces]
    for _ in range(iterations):
        cache: dict[tuple[int, int], int] = {}
        new_faces: list[tuple[int, int, int]] = []

        def midpoint(a: int, b: int) -> int:
            key = (a, b) if a < b else (b, a)
            cached = cache.get(key)
            if cached is not None:
                return cached
            pa = verts[a]
            pb = verts[b]
            verts.append(((pa[0] + pb[0]) / 2.0, (pa[1] + pb[1]) / 2.0, (pa[2] + pb[2]) / 2.0))
            idx = len(verts) - 1
            cache[key] = idx
            return idx

        for a, b, c in faces:
            ab = midpoint(a, b)
            bc = midpoint(b, c)
            ca = midpoint(c, a)
            new_faces.extend(((a, ab, ca), (ab, b, bc), (ca, bc, c), (ab, bc, ca)))
        faces = new_faces
    return Mesh(np.asarray(verts, dtype=float), np.asarray(faces, dtype=np.int64))


def _polygon_only(geom) -> Polygon | None:
    if geom is None or geom.is_empty:
        return None
    if isinstance(geom, MultiPolygon):
        geom = max(geom.geoms, key=lambda p: p.area)
    if not isinstance(geom, Polygon):
        return None
    if not geom.is_valid:
        geom = geom.buffer(0)
        if isinstance(geom, MultiPolygon):
            geom = max(geom.geoms, key=lambda p: p.area)
    if not isinstance(geom, Polygon) or geom.is_empty or geom.area <= 1e-6:
        return None
    return geom


def build_cutter(
    main: Polygon,
    *,
    blade_thickness: float,
    blade_depth: float,
    tip_width: float,
    chamfer_height: float,
    base_height: float,
    base_width: float,
    sharp_edge: bool = True,
    extra_blade: bool = False,
    extra_blade_depth: float = 0.0,
    extra_blade_thickness: float = 0.0,
    base_shape: str = "round",
    alignment: tuple[float, float, float] | None = None,
) -> Mesh:
    base_parts, blade_parts, tip_parts = cutter_rings(
        main, blade_thickness, base_width, tip_width, base_shape=base_shape
    )
    meshes: list[Mesh] = []
    used: set[int] = set()
    for base in base_parts:
        if not base.interiors:
            continue
        # Match the blade/tip ring that shares the same location.
        centre = base.centroid
        blade = _nearest(blade_parts, centre, used)
        tip = _nearest(tip_parts, centre, used)
        if alignment is not None:
            ax, ay, ar = alignment
            dimple = Point(ax, ay).buffer(max(0.4, ar), quad_segs=24)
            depth = min(0.5, max(0.15, base_height * 0.2))
            # A shallow dimple on the non-marking underside of the base.  It
            # is open only from below, so it never reaches the cutting face.
            bottom_poly = base.difference(dimple)
            if bottom_poly.is_empty:
                meshes.append(extrude_polygon(base, 0.0, base_height))
            else:
                meshes.append(extrude_polygon(bottom_poly, 0.0, depth))
                meshes.append(extrude_polygon(base, depth - 0.01, base_height - depth + 0.01))
            if blade is not None:
                outer_blade = list(blade.exterior.coords[:-1])
                inner_blade = list(blade.interiors[0].coords[:-1])
                blade_layers: list[tuple[float, list[tuple[float, float]], list[tuple[float, float]]]] = [
                    (max(0.01, base_height - 0.01), outer_blade, inner_blade),
                ]
                if sharp_edge and chamfer_height > 0.2 and tip is not None:
                    outer_tip = list(tip.exterior.coords[:-1])
                    inner_tip = list(tip.interiors[0].coords[:-1])
                    blade_layers.append((base_height + blade_depth - chamfer_height, outer_blade, inner_blade))
                    blade_layers.append((base_height + blade_depth, outer_tip, inner_tip))
                else:
                    blade_layers.append((base_height + blade_depth, outer_blade, inner_blade))
                meshes.append(_ring_loft(blade_layers).oriented())
            continue
        outer_base = list(base.exterior.coords[:-1])
        inner_base = list(base.interiors[0].coords[:-1])
        if blade is None:
            meshes.append(_ring_loft([
                (0.0, outer_base, inner_base),
                (base_height, outer_base, inner_base),
            ]).oriented())
            continue
        outer_blade = list(blade.exterior.coords[:-1])
        inner_blade = list(blade.interiors[0].coords[:-1])
        layers: list[tuple[float, list[tuple[float, float]], list[tuple[float, float]]]] = [
            (0.0, outer_base, inner_base),
            (base_height, outer_base, inner_base),
            (base_height, outer_blade, inner_blade),
        ]
        if sharp_edge and chamfer_height > 0.2 and tip is not None:
            outer_tip = list(tip.exterior.coords[:-1])
            inner_tip = list(tip.interiors[0].coords[:-1])
            layers.append((base_height + blade_depth - chamfer_height, outer_blade, inner_blade))
            layers.append((base_height + blade_depth, outer_tip, inner_tip))
        else:
            layers.append((base_height + blade_depth, outer_blade, inner_blade))
        meshes.append(_ring_loft(layers).oriented())
    if not meshes:
        return Mesh(np.zeros((0, 3)), np.zeros((0, 3), dtype=np.int64))
    out = meshes[0]
    for m in meshes[1:]:
        out = out.append(m)
    if extra_blade and extra_blade_depth > 0.2 and extra_blade_thickness > 0.05:
        extra_ring = main.buffer(blade_thickness + extra_blade_thickness, join_style=1, quad_segs=8).difference(main)
        for p in _ring_parts(extra_ring):
            if p.area > 0.001:
                out = out.append(extrude_polygon(
                    p,
                    max(0.0, base_height - 0.25),
                    min(extra_blade_depth, max(0.5, blade_depth - 0.5)) + 0.25,
                ))
    return out.oriented()


def _nearest(polys: list[Polygon], point, used: set[int]) -> Polygon | None:
    best = None
    best_d = float("inf")
    best_i = -1
    for i, p in enumerate(polys):
        if i in used:
            continue
        d = p.centroid.distance(point)
        if d < best_d:
            best_d = d
            best = p
            best_i = i
    if best is not None:
        used.add(best_i)
        return best
    return None


def rounded_rect(w: float, h: float, r: float) -> Polygon:
    r = max(0.0, min(r, min(w, h) / 2))
    if r <= 0:
        return box(-w / 2, -h / 2, w / 2, h / 2)
    return box(-w / 2 + r, -h / 2 + r, w / 2 - r, h / 2 - r).buffer(r, join_style=1, quad_segs=6)


def build_multicutter(
    main: Polygon,
    *,
    blade_thickness: float,
    blade_depth: float,
    tip_width: float,
    chamfer_height: float,
    base_height: float,
    base_width: float,
    rows: int,
    cols: int,
    spacing: float,
    sharp_edge: bool = True,
    extra_blade: bool = False,
    extra_blade_depth: float = 0.0,
    extra_blade_thickness: float = 0.0,
    base_shape: str = "round",
    add_press_handle: bool = False,
    press_handle_length: float = 30.0,
    press_handle_width: float = 12.0,
    press_handle_position: float = 50.0,
    press_handle_shape: str = "rounded",
    press_handles_both_ends: bool = False,
) -> Mesh:
    """A batch cutter with one shared press plate and one hole per copy.

    Each copy keeps a proper blade ring, but the individual base rings are
    replaced by a single connected plate.  The plate also gives the press
    handle something solid to attach to, so the whole grid can be used with
    one hand without separate loose cutters.
    """
    rows = max(1, int(rows))
    cols = max(1, int(cols))
    spacing = max(0.0, float(spacing))
    outer = main.buffer(base_width, join_style=1, quad_segs=8)
    ob = outer.bounds
    cell_w = max(1.0, ob[2] - ob[0])
    cell_d = max(1.0, ob[3] - ob[1])
    pitch_x = cell_w + spacing
    pitch_y = cell_d + spacing
    centers = [
        ((c - (cols - 1) / 2.0) * pitch_x, (r - (rows - 1) / 2.0) * pitch_y)
        for r in range(rows)
        for c in range(cols)
    ]

    cells = [affinity.translate(main, dx, dy) for dx, dy in centers]
    outer_cells = [cell.buffer(base_width, join_style=1, quad_segs=8) for cell in cells]
    minx = min(p.bounds[0] for p in outer_cells) - 2.0
    miny = min(p.bounds[1] for p in outer_cells) - 2.0
    maxx = max(p.bounds[2] for p in outer_cells) + 2.0
    maxy = max(p.bounds[3] for p in outer_cells) + 2.0
    plate = rounded_rect(maxx - minx, maxy - miny, 8.0)
    plate = affinity.translate(plate, (minx + maxx) / 2.0, (miny + maxy) / 2.0)
    holes = [cell.buffer(-0.25, join_style=1, quad_segs=8) for cell in cells]
    plate = plate.difference(unary_union(holes))
    parts: list[Mesh] = []
    for piece in _ring_parts(plate):
        if piece.area > 0.05:
            parts.append(extrude_polygon(piece, 0.0, base_height))

    for cell in cells:
        _, blade_parts, tip_parts = cutter_rings(
            cell, blade_thickness, base_width, tip_width, base_shape=base_shape
        )
        for index, blade in enumerate(blade_parts):
            if not blade.interiors:
                continue
            outer_blade = list(blade.exterior.coords[:-1])
            inner_blade = list(blade.interiors[0].coords[:-1])
            tip = tip_parts[index] if index < len(tip_parts) else None
            layers: list[tuple[float, list[tuple[float, float]], list[tuple[float, float]]]] = [
                (max(0.01, base_height - 0.01), outer_blade, inner_blade),
            ]
            if sharp_edge and chamfer_height > 0.2 and tip is not None and tip.interiors:
                outer_tip = list(tip.exterior.coords[:-1])
                inner_tip = list(tip.interiors[0].coords[:-1])
                layers.append((base_height + blade_depth - chamfer_height, outer_blade, inner_blade))
                layers.append((base_height + blade_depth, outer_tip, inner_tip))
            else:
                layers.append((base_height + blade_depth, outer_blade, inner_blade))
            parts.append(_ring_loft(layers).oriented())
        if extra_blade and extra_blade_depth > 0.2 and extra_blade_thickness > 0.05:
            extra_ring = cell.buffer(blade_thickness + extra_blade_thickness, join_style=1, quad_segs=8).difference(cell)
            for p in _ring_parts(extra_ring):
                if p.area > 0.001:
                    parts.append(extrude_polygon(
                        p,
                        max(0.0, base_height - 0.25),
                        min(extra_blade_depth, max(0.5, blade_depth - 0.5)) + 0.25,
                    ))

    if add_press_handle:
        width = max(6.0, min(30.0, float(press_handle_width)))
        length = max(20.0, min(maxx - minx - 4.0, max(40.0, float(press_handle_length))))
        plate_center_y = (miny + maxy) / 2.0
        offset = (float(press_handle_position) - 50.0) / 50.0 * max(0.0, (maxy - miny - width) / 2.0 - 3.0)
        positions = [plate_center_y + offset]
        if press_handles_both_ends:
            positions.append(plate_center_y - offset)
        for cy in positions:
            if press_handle_shape == "rect":
                handle = box(-length / 2.0, -width / 2.0, length / 2.0, width / 2.0)
            elif press_handle_shape == "round":
                handle = rounded_rect(length, width, width / 2.0)
            else:
                handle = rounded_rect(length, width, width * 0.45)
            handle = affinity.translate(handle, (minx + maxx) / 2.0, cy)
            parts.append(extrude_polygon(handle, base_height - 0.05, 6.0))

    if not parts:
        return Mesh(np.zeros((0, 3)), np.zeros((0, 3), dtype=np.int64))
    out = parts[0]
    for part in parts[1:]:
        out = out.append(part)
    bounds = out.bounds
    out = out.translated([
        -(bounds["min"][0] + bounds["max"][0]) / 2.0,
        -(bounds["min"][1] + bounds["max"][1]) / 2.0,
        0.0,
    ])
    return out.oriented()


def build_stamp(
    main: Polygon,
    details: list[Polygon],
    *,
    back_height: float,
    relief: float,
    clearance: float,
    border: bool = True,
    border_width: float = 1.6,
    alignment: tuple[float, float, float] | None = None,
    recessed: bool = False,
    detail_curve: str = "none",
    detail_grow: float = 0.0,
) -> Mesh:
    stamp_poly = main.buffer(-clearance, join_style=1, quad_segs=8)
    if stamp_poly.is_empty:
        stamp_poly = main.buffer(-min(0.3, clearance), join_style=1, quad_segs=8)
    if stamp_poly.is_empty:
        return Mesh(np.zeros((0, 3)), np.zeros((0, 3), dtype=np.int64))
    stamp_components = _ring_parts(stamp_poly)
    parts: list[Mesh] = []
    for stamp_component in stamp_components:
        kept_details: list[Polygon] = []
        grow = max(0.0, min(2.0, float(detail_grow)))
        grown_details = [
            d.buffer(grow / 2.0, join_style=1, quad_segs=8) if grow > 0.001 else d
            for d in details
        ]
        for d in grown_details:
            clipped = d.intersection(stamp_component)
            if clipped.is_empty:
                continue
            for p in _ring_parts(clipped):
                # Drop hairline islands and details that hug the outer edge.
                # They print as tall, fragile ridges that look like a second
                # border and never line up with the stamp frame.
                if p.area <= 0.15:
                    continue
                try:
                    if p.distance(stamp_component.exterior) < max(0.4, clearance * 0.25):
                        continue
                except Exception:
                    pass
                kept_details.append(p)
        depth = min(max(0.2, relief), max(0.2, back_height - 1.0))
        if recessed and kept_details:
            # Negative relief: the background is high and the artwork is a
            # shallow recess.  This leaves raised details in dough/fondant.
            plate_height = max(0.3, back_height - depth)
            if alignment is not None:
                ax, ay, ar = alignment
                dimple = Point(ax, ay).buffer(max(0.4, ar), quad_segs=24)
                dep = min(0.4, max(0.1, plate_height * 0.2))
                bottom_poly = stamp_component.difference(dimple)
                if stamp_component.buffer(0.05).contains(dimple) and not bottom_poly.is_empty:
                    parts.append(extrude_polygon(bottom_poly, 0.0, dep))
                    parts.append(extrude_polygon(stamp_component, dep - 0.01, plate_height - dep + 0.01))
                else:
                    parts.append(extrude_polygon(stamp_component, 0.0, plate_height))
            else:
                parts.append(extrude_polygon(stamp_component, 0.0, plate_height))
            cutouts = unary_union([d for d in grown_details if not d.is_empty])
            cover = stamp_component.difference(cutouts)
            for p in _ring_parts(cover):
                if p.area > 0.01:
                    parts.append(extrude_polygon(p, back_height - depth - 0.01, depth + 0.01))
            continue
        if alignment is not None:
            ax, ay, ar = alignment
            dimple = Point(ax, ay).buffer(max(0.4, ar), quad_segs=24)
            dep = min(0.4, max(0.12, back_height * 0.1))
            bottom_poly = stamp_component.difference(dimple)
            if stamp_component.buffer(0.05).contains(dimple) and not bottom_poly.is_empty:
                # The alignment mark belongs to the back/bed side of the
                # stamp, never to the face that presses into the dough.
                parts.append(extrude_polygon(bottom_poly, 0.0, dep))
                parts.append(extrude_polygon(stamp_component, dep - 0.01, back_height - dep + 0.01))
            else:
                parts.append(extrude_polygon(stamp_component, 0.0, back_height))
        else:
            parts.append(extrude_polygon(stamp_component, 0.0, back_height))
        if border and border_width > 0.2:
            # A true annular frame, built by subtracting an inset copy of the
            # plate.  Buffering the exterior line produced non-watertight
            # fragments on sharp SVG contours.
            inner_plate = stamp_component.buffer(
                -max(0.2, border_width), join_style=1, quad_segs=8
            )
            if inner_plate.is_empty:
                inner_plate = stamp_component.buffer(
                    -max(0.1, min(0.4, border_width / 2)), join_style=1, quad_segs=8
                )
            strip = stamp_component.difference(inner_plate) if not inner_plate.is_empty else stamp_component
            for p in _ring_parts(strip):
                if p.area > 0.01:
                    parts.append(extrude_polygon(
                        p, back_height - 0.25, max(0.3, relief) + 0.25
                    ))
        for p in kept_details:
            for layer, z0, height in _curved_relief_layers(
                p, back_height - 0.25, relief + 0.25, detail_curve
            ):
                parts.append(extrude_polygon(layer, z0, height))
    if not parts:
        return Mesh(np.zeros((0, 3)), np.zeros((0, 3), dtype=np.int64))
    out = parts[0]
    for p in parts[1:]:
        out = out.append(p)
    return out


def build_imprint(
    main: Polygon,
    details: list[Polygon],
    *,
    blade_thickness: float,
    blade_depth: float,
    tip_width: float,
    chamfer_height: float,
    base_height: float,
    base_width: float,
    imprint_depth: float,
    base_shape: str = "round",
    sharp_edge: bool = True,
    alignment: tuple[float, float, float] | None = None,
    detail_curve: str = "none",
    detail_grow: float = 0.0,
) -> Mesh:
    cutter = build_cutter(
        main,
        blade_thickness=blade_thickness,
        blade_depth=blade_depth,
        tip_width=tip_width,
        chamfer_height=chamfer_height,
        base_height=base_height,
        base_width=base_width,
        base_shape=base_shape,
        sharp_edge=sharp_edge,
        alignment=alignment,
    )
    floor_poly = main.buffer(-max(0.5, blade_thickness * 0.8), join_style=2)
    if floor_poly.is_empty:
        return cutter
    floor_z = max(1.0, base_height + blade_depth - imprint_depth)
    floor = extrude_polygon(floor_poly, 0.0, floor_z)
    out = cutter.append(floor)
    grow = max(0.0, min(2.0, float(detail_grow)))
    ceiling = floor_z + min(imprint_depth, blade_depth - 1)
    for d in details:
        source = d.buffer(grow / 2.0, join_style=1, quad_segs=8) if grow > 0.001 else d
        clipped = source.intersection(floor_poly)
        if clipped.is_empty:
            continue
        for p in _ring_parts(clipped):
            if p.area <= 0.002:
                continue
            height = max(0.15, ceiling - (floor_z - 0.25))
            for layer, z0, layer_height in _curved_relief_layers(
                p, floor_z - 0.25, height, detail_curve
            ):
                out = out.append(extrude_polygon(layer, z0, layer_height))
    return out


def build_sandwich(
    main: Polygon,
    *,
    blade_thickness: float,
    blade_depth: float,
    tip_width: float,
    chamfer_height: float,
    base_height: float,
    base_width: float,
    seal_width: float,
    gap: float,
    dent_size: float,
    dent_spacing: float,
    dent_depth: float,
    base_shape: str = "round",
    sharp_edge: bool = True,
    alignment: tuple[float, float, float] | None = None,
) -> Mesh:
    """Cutter with an integrated CookieCAD-style sealing band.

    The outer blade cuts the sandwich and the lower inner band presses the
    layers together.  A thin shelf at the bottom joins the band to the cutter
    so the tool is one printable piece.  The optional centre stamp is a
    separate part built by the engine.
    """
    cutter = build_cutter(
        main,
        blade_thickness=blade_thickness,
        blade_depth=blade_depth,
        tip_width=tip_width,
        chamfer_height=chamfer_height,
        base_height=base_height,
        base_width=base_width,
        base_shape=base_shape,
        sharp_edge=sharp_edge,
        alignment=alignment,
    )
    width = max(0.8, float(seal_width))
    seal_outer = main.buffer(-max(0.2, float(gap)), join_style=1, quad_segs=8)
    if seal_outer.is_empty:
        seal_outer = main.buffer(-0.2, join_style=1, quad_segs=8)
    seal_inner = seal_outer.buffer(-width, join_style=1, quad_segs=8)
    for _ in range(3):
        if not seal_inner.is_empty or seal_outer.is_empty:
            break
        width = max(0.4, width * 0.5)
        seal_inner = seal_outer.buffer(-width, join_style=1, quad_segs=8)
    seal_ring = (
        seal_outer.difference(seal_inner)
        if not seal_outer.is_empty and not seal_inner.is_empty
        else None
    )
    seal_height = max(2.0, base_height + blade_depth * 0.55)
    parts = [cutter]

    # Narrow shelf in the gap, overlapping both the cutter base and the seal
    # band.  It keeps the tool printable as one piece without blocking the
    # cutting edge.
    if seal_ring is not None and not seal_outer.is_empty:
        connector_outer = main.buffer(min(1.2, max(0.4, base_width * 0.35)), join_style=1, quad_segs=8)
        connector = connector_outer.difference(seal_outer)
        for p in _ring_parts(connector):
            if p.area > 0.01:
                parts.append(extrude_polygon(p, 0.0, max(1.0, base_height * 0.6)))

        for p in _ring_parts(seal_ring):
            if p.area > 0.01:
                parts.append(extrude_polygon(p, 0.0, seal_height))

    # Crimping dents distributed evenly around the middle of the band.
    if seal_ring is not None:
        for path_poly in _ring_parts(seal_outer.buffer(-width * 0.5, join_style=1, quad_segs=8)):
            if path_poly.is_empty:
                continue
            path = path_poly.exterior
            per = max(0.5, dent_spacing)
            n = max(4, int(path.length / per))
            for i in range(n):
                pt = path.interpolate((i + 0.5) / n, normalized=True)
                bump = Point(pt.x, pt.y).buffer(max(0.4, dent_size / 2), quad_segs=8)
                parts.append(extrude_polygon(bump, seal_height - 0.2, max(0.3, dent_depth)))

    return _append_all(parts).oriented()


def build_roller(
    main: Polygon,
    details: list[Polygon] | None = None,
    *,
    diameter: float,
    length: float,
    relief: float,
    bore: float,
    repeats_around: int,
    repeats_along: int,
    rim: float,
    pattern: str = "grid",
    margin: float = 0.0,
    rotate: bool = False,
    invert: bool = False,
    back: float = 0.0,
    remove_edge: bool = False,
    depth_curve: str = "none",
    pattern_mode: str = "drawing",
) -> Mesh:
    """Hollow texture roller with wrapped, repeated and curved pattern tiles."""
    radius = max(4.0, diameter / 2)
    back = max(0.0, min(8.0, float(back)))
    outer_radius = radius + back
    inner = max(0.4, min(radius - 1.0, bore / 2))
    tube = Point(0, 0).buffer(outer_radius, quad_segs=64).difference(
        Point(0, 0).buffer(inner, quad_segs=48)
    )
    parts = [extrude_polygon(tube, -length / 2, length)]
    around = max(1, int(repeats_around))
    along = max(1, int(repeats_along))
    # Brick and mirror tiles need an even count around the cylinder so the
    # pattern closes cleanly at the seam.
    if pattern in {"brick", "mirror"} and around > 1 and around % 2 == 1:
        around += 1
    cell_w = 2 * math.pi * radius / around
    cell_h = length / along
    margin = max(0.0, min(float(margin), min(cell_w, cell_h) * 0.3))
    usable_w = max(1.0, cell_w - margin * 2.0)
    usable_h = max(1.0, cell_h - margin * 2.0)

    source_details = [d for d in (details or []) if d is not None and not d.is_empty]

    # Apply the same transform to the silhouette and its interior details so
    # they stay registered.  Scaling each detail around its own centre was the
    # cause of the floating/misplaced relief lines.
    pivot = main.centroid
    b = main.bounds
    bw = max(1e-6, b[2] - b[0])
    bh = max(1e-6, b[3] - b[1])
    fit = min(usable_w / bw, usable_h / bh) * 0.9

    def prepare(geom: Polygon) -> Polygon:
        g = affinity.translate(geom, -pivot.x, -pivot.y)
        if rotate:
            g = affinity.rotate(g, 90, origin=(0, 0))
        return affinity.scale(g, fit, fit, origin=(0, 0))

    tile = prepare(main)
    tile_b = tile.bounds
    offset_x = -(tile_b[0] + tile_b[2]) / 2.0
    offset_y = -(tile_b[1] + tile_b[3]) / 2.0
    tile = affinity.translate(tile, offset_x, offset_y)
    tile_b = tile.bounds
    tile_details: list[Polygon] = []
    for detail in source_details:
        transformed = affinity.translate(prepare(detail), offset_x, offset_y)
        clipped_detail = transformed.intersection(tile)
        for p in _ring_parts(clipped_detail):
            if p.area > 0.02:
                tile_details.append(p)

    # Drawing mode uses the stamp-like line artwork: the outer outline plus
    # the interior details, not a large filled silhouette.  Silhouette mode
    # keeps the old filled pattern, with details raised on top.
    line_drawing = pattern_mode == "drawing" and bool(tile_details)
    # Engraved mode always keeps the drawing: a filled silhouette recess
    # would hide the interior lines.
    if invert and tile_details:
        line_drawing = True
    edge_w = max(0.8, min(2.5, max(0.3, relief) * 1.2))
    detail_grow = max(0.05, min(0.3, max(0.3, relief) * 0.15))
    separate_details: list[Polygon] = []
    if line_drawing:
        # Non-cutter modes follow the original drawing: use the interior
        # details, never add the cutter's outer border as a pattern line.
        detail_shapes = [
            d.buffer(detail_grow, join_style=1, quad_segs=8) for d in tile_details
        ]
        pattern_tile: Polygon | MultiPolygon = unary_union(detail_shapes)
    elif pattern_mode == "silhouette" and remove_edge and tile_details:
        pattern_tile = unary_union(tile_details)
    else:
        pattern_tile = tile
        if not invert:
            separate_details = tile_details
    if pattern_tile.is_empty:
        pattern_tile = tile
    pb = pattern_tile.bounds
    patch_w = max(usable_w * 0.98, (pb[2] - pb[0]) + edge_w)
    patch_h = max(usable_h * 0.98, (pb[3] - pb[1]) + edge_w)

    def mapped(mesh: Mesh, theta0: float, axial0: float, mirror: bool) -> Mesh:
        verts = mesh.vertices.copy()
        faces = mesh.faces.copy()
        if mirror:
            verts[:, 0] *= -1.0
            faces = faces[:, ::-1].copy()
        out = np.zeros_like(verts)
        for i, (x, y, z) in enumerate(verts):
            angle = theta0 + x / max(radius, 1e-6)
            radial = radius + z - 0.2
            out[i] = (radial * math.cos(angle), radial * math.sin(angle), axial0 + y)
        return Mesh(out, faces)

    # Large flat triangles would cut straight chords through the cylinder and
    # look like random facets in the 3D preview.  Subdivide uniformly (keeping
    # the mesh closed) until the wrapped tiles read as a smooth curve.
    max_arc = max(1.2, min(3.5, (2.0 * math.pi * radius) / 128.0))
    max_faces = 14000

    def wrapped(poly: Polygon, z0: float, height: float,
                theta0: float, axial0: float, mirror: bool,
                refine: bool = True) -> list[Mesh]:
        if poly.is_empty or height <= 0.01:
            return []
        mesh = extrude_polygon(poly, z0, height)
        if len(mesh.faces) == 0:
            return []
        if refine:
            pb = poly.bounds
            span = max(1e-6, pb[2] - pb[0])
            needed = int(math.ceil(math.log(max(1.0, span / max_arc), 2.0)))
            allowed = max(0, int(math.floor(math.log(max_faces / max(1, len(mesh.faces)), 4.0))))
            iterations = max(0, min(5, needed, allowed))
            mesh = _subdivide_flat(mesh, iterations)
        return [mapped(mesh, theta0, axial0, mirror)]

    for ia in range(around):
        for il in range(along):
            theta0 = (2 * math.pi * ia) / around
            axial0 = -length / 2 + (il + 0.5) * cell_h
            if pattern == "brick" and il % 2 == 1:
                theta0 += math.pi / around
            mirror = pattern == "mirror" and (ia + il) % 2 == 1
            if invert:
                patch = box(-patch_w / 2, -patch_h / 2, patch_w / 2, patch_h / 2)
                cut_pattern = pattern_tile.buffer(-0.08, join_style=1, quad_segs=8)
                if cut_pattern.is_empty:
                    cut_pattern = pattern_tile
                inverse = patch.difference(cut_pattern)
                for p in _ring_parts(inverse):
                    if p.area > 0.02:
                        # Keep engraved geometry flat: curved layers on the
                        # inverse can create open island caps around holes.
                        parts.extend(wrapped(
                            p, back, max(0.3, relief) + 0.25,
                            theta0, axial0, mirror, refine=False,
                        ))
            else:
                for layer_poly, z0, height in _curved_relief_layers(
                    pattern_tile, back, max(0.3, relief) + 0.25, depth_curve
                ):
                    parts.extend(wrapped(layer_poly, z0, height, theta0, axial0, mirror))
                for detail in separate_details:
                    detail_height = max(0.35, min(0.9, relief * 0.4))
                    for layer_poly, z0, height in _curved_relief_layers(
                        detail,
                        back + max(0.3, relief) - 0.05,
                        detail_height,
                        depth_curve,
                    ):
                        parts.extend(wrapped(
                            layer_poly, z0, height, theta0, axial0, mirror
                        ))
    # End rims.
    if rim > 0:
        rim_width = max(0.5, rim)
        for z0 in (-length / 2, length / 2 - rim_width):
            r_out = Point(0, 0).buffer(outer_radius + 1.2, quad_segs=64)
            # Overlap the tube wall slightly instead of sharing its surface:
            # coincident faces make the combined mesh non-manifold.
            r_in = Point(0, 0).buffer(max(0.5, outer_radius - 0.5), quad_segs=64)
            ring = r_out.difference(r_in)
            parts.append(extrude_polygon(ring, z0, rim_width))
    out = parts[0]
    for p in parts[1:]:
        out = out.append(p)
    # The roller is printed standing up: move its lowest face onto Z=0.
    lowest = out.bounds["min"][2]
    if lowest != 0:
        out = out.translated([0.0, 0.0, -lowest])
    return out


def build_stencil(
    main: Polygon,
    details: list[Polygon] | None = None,
    *,
    width: float,
    height: float,
    rows: int,
    cols: int,
    spacing: float,
    thickness: float,
    shape_size: float = 0.0,
    margin: float = 3.0,
    pattern: str = "grid",
    bridges: bool = True,
    bridge_width: float = 1.2,
    line_width: float = 1.2,
) -> Mesh:
    """Flat stencil sheet with the complete drawing repeated as openings.

    Solid silhouettes are cut as one opening.  When the artwork has interior
    details, the stencil cuts the outer outline and every interior detail so
    the result is the whole drawing, not only the outer silhouette.  A thin
    backing bridge keeps interior islands attached.
    """
    rows = max(1, int(rows))
    cols = max(1, int(cols))
    width = max(10.0, float(width))
    height = max(10.0, float(height))
    margin = max(0.0, min(float(margin), min(width, height) * 0.35))
    line_w = max(0.4, float(line_width))
    sheet = box(-width / 2, -height / 2, width / 2, height / 2)
    details = [d for d in (details or []) if d is not None and not d.is_empty]
    b = main.bounds
    bw = max(1e-6, b[2] - b[0])
    bh = max(1e-6, b[3] - b[1])
    available_w = max(4.0, width - margin * 2)
    available_h = max(4.0, height - margin * 2)
    cell_w = available_w / cols
    cell_h = available_h / rows
    gap = max(0.5, spacing) + (line_w if details else 0.0)
    fit = min((cell_w - gap) / bw, (cell_h - gap) / bh)
    if shape_size and shape_size > 0:
        fit = min(fit, float(shape_size) / max(bw, bh))
    scale = max(0.05, fit)

    pivot = main.centroid
    scaled_main = affinity.scale(main, scale, scale, origin=pivot)
    pb = scaled_main.bounds
    offset_x = -(pb[0] + pb[2]) / 2.0
    offset_y = -(pb[1] + pb[3]) / 2.0
    pattern_main = affinity.translate(scaled_main, offset_x, offset_y)
    pattern_details = [
        affinity.translate(affinity.scale(d, scale, scale, origin=pivot), offset_x, offset_y)
        for d in details
    ]

    if pattern_details:
        # Follow the original drawing: cut the interior details.  The outer
        # border is only the cutter silhouette, so it is not added here.
        pattern_cut = unary_union([
            d.buffer(max(0.05, line_w * 0.25), join_style=1, quad_segs=8)
            for d in pattern_details
        ])
    else:
        pattern_cut = pattern_main

    cb = pattern_cut.bounds
    half_pattern_w = (cb[2] - cb[0]) / 2.0
    half_pattern_h = (cb[3] - cb[1]) / 2.0
    cuts: list[Polygon] = []
    for r in range(rows):
        for c in range(cols):
            cx = -available_w / 2 + (c + 0.5) * cell_w
            cy = -available_h / 2 + (r + 0.5) * cell_h
            if pattern == "diagonal" and r % 2 == 1:
                cx += cell_w / 2
                if cx + half_pattern_w > width / 2 - margin:
                    cx -= cell_w
            elif pattern == "random":
                phase = (r * cols + c + 1) * 1.618
                cx += math.sin(phase) * cell_w * 0.14
                cy += math.cos(phase * 1.37) * cell_h * 0.14
            cuts.append(affinity.translate(pattern_cut, cx, cy))
    holes = unary_union(cuts)
    result = sheet.difference(holes)
    pieces = [p for p in _ring_parts(result) if p.area > 0.05]
    if not pieces:
        return Mesh(np.zeros((0, 3)), np.zeros((0, 3), dtype=np.int64))
    pieces.sort(key=lambda p: -p.area)
    if bridges and len(pieces) > 1:
        connected = pieces[0]
        for island in pieces[1:]:
            try:
                a, c = nearest_points(connected, island)
                bridge = LineString([a, c]).buffer(
                    max(0.5, float(bridge_width)) / 2, cap_style=2, join_style=2
                )
                connected = unary_union([connected, island, bridge])
            except Exception:
                connected = unary_union([connected, island])
        pieces = [p for p in _ring_parts(connected) if p.area > 0.05]
    parts: list[Mesh] = []
    for p in pieces:
        parts.append(extrude_polygon(p, 0.0, max(0.6, thickness)))
    if not parts:
        return Mesh(np.zeros((0, 3)), np.zeros((0, 3), dtype=np.int64))
    return _append_all(parts)


def build_topper(
    main: Polygon,
    details: list[Polygon],
    *,
    thickness: float,
    relief: float,
    pin_length: float,
    pin_width: float,
    backing: float = 0.0,
    pin_position: float = 0.0,
    invert: bool = False,
    detail_curve: str = "none",
) -> Mesh:
    """Flat cake topper with a tapered printable stake in the same plane."""
    base_poly = main.buffer(max(0.0, float(backing)), join_style=1, quad_segs=8)
    if base_poly.is_empty:
        base_poly = main
    parts = [extrude_polygon(base_poly, 0.0, max(1.0, thickness))]
    clipped_details: list[Polygon] = []
    for d in details:
        clipped = d.intersection(main)
        for p in _ring_parts(clipped):
            if p.area > 0.15:
                clipped_details.append(p)
    relief_height = max(0.3, relief) + 0.2
    if invert and clipped_details:
        # Raise the background and leave the artwork at base level.  This is the
        # same physical result as an inverted stamp without needing 3D CSG.
        # Use the original detail rings for the cut-out: re-intersecting them
        # can introduce near-duplicate vertices that make earcut create cracks.
        cover = base_poly.difference(unary_union([d for d in details if not d.is_empty]))
        for p in _ring_parts(cover):
            if p.area > 0.15:
                for layer, z0, height in _curved_relief_layers(
                    p, thickness - 0.2, relief_height, detail_curve
                ):
                    parts.append(extrude_polygon(layer, z0, height))
    else:
        for p in clipped_details:
            for layer, z0, height in _curved_relief_layers(
                p, thickness - 0.2, relief_height, detail_curve
            ):
                parts.append(extrude_polygon(layer, z0, height))
    b = base_poly.bounds
    pin_w = max(1.0, float(pin_width))
    pin_l = max(2.0, float(pin_length))
    usable = max(0.0, (b[2] - b[0]) - pin_w)
    cx = (float(pin_position) / 100.0) * usable / 2
    pin_strip = box(cx - pin_w / 2, b[1] - 1.0, cx + pin_w / 2, b[3] + 1.0)
    slice_poly = base_poly.intersection(pin_strip)
    attach_y = slice_poly.bounds[1] if not slice_poly.is_empty else b[1]
    tip_w = min(pin_w, max(1.0, pin_w * 0.72))
    chamfer = min(0.8, pin_l * 0.25)
    shoulder_y = attach_y - pin_l + min(6.0, pin_l * 0.4)
    tip_y = attach_y - pin_l
    pin = Polygon([
        (cx - pin_w / 2, attach_y + 0.5),
        (cx + pin_w / 2, attach_y + 0.5),
        (cx + pin_w / 2, shoulder_y),
        (cx + tip_w / 2, tip_y + chamfer),
        (cx + tip_w * 0.35, tip_y),
        (cx - tip_w * 0.35, tip_y),
        (cx - tip_w / 2, tip_y + chamfer),
        (cx - pin_w / 2, shoulder_y),
    ])
    if not pin.is_valid:
        pin = pin.buffer(0)
    if pin.is_empty or pin.area <= 0.01:
        return parts[0] if len(parts) == 1 else _append_all(parts)
    parts.append(extrude_polygon(pin, 0.0, max(1.0, thickness)))
    return _append_all(parts)


def build_cake_pop_tray(
    main: Polygon,
    *,
    length: float,
    height: float,
    depth_percent: float,
    clearance: float,
    margin: float,
    rotation: float,
    stick_hole: float,
) -> Mesh:
    """Support tray with a shaped pocket and a stick passage through the base."""
    rotated = affinity.rotate(main, rotation, origin="center")
    b = rotated.bounds
    shape_w = max(2.0, b[2] - b[0])
    shape_h = max(2.0, b[3] - b[1])
    cx = (b[0] + b[2]) / 2.0
    cy = (b[1] + b[3]) / 2.0
    hole = rotated.buffer(max(0.2, clearance), join_style=1, quad_segs=8)
    hole = affinity.translate(hole, -cx, -cy + length / 2.0)
    tray_w = shape_w + margin * 2.0
    footprint_h = shape_h + margin * 2.0 + max(0.0, length)
    outer = rounded_rect(tray_w, footprint_h, min(8.0, min(tray_w, footprint_h) * 0.18))
    tray_height = max(4.0, float(height))
    pocket = min(max(0.8, tray_height - 0.8), tray_height * max(0.1, min(0.9, depth_percent / 100.0)))
    bottom_h = max(0.6, tray_height - pocket)
    parts: list[Mesh] = []
    stick = Point(0.0, length / 2.0).buffer(max(0.0, stick_hole) / 2.0, quad_segs=32)
    bottom_poly = outer.difference(stick) if stick_hole > 0.1 else outer
    for p in _ring_parts(bottom_poly):
        if p.area > 0.02:
            parts.append(extrude_polygon(p, 0.0, bottom_h))
    top_poly = outer.difference(hole)
    for p in _ring_parts(top_poly):
        if p.area > 0.02:
            parts.append(extrude_polygon(p, bottom_h - 0.01, pocket + 0.01))
    if not parts:
        return Mesh(np.zeros((0, 3)), np.zeros((0, 3), dtype=np.int64))
    out = parts[0]
    for part in parts[1:]:
        out = out.append(part)
    return out.oriented()


def build_cake_pop(
    main: Polygon,
    details: list[Polygon],
    *,
    mold_height: float,
    mold_wall: float,
    base_height: float,
    stick_hole: float,
    hole_clearance: float,
    plunger_clearance: float,
    plunger_back: float,
    plunger_relief: float,
    plunger_face: str = "imprint",
) -> tuple[Mesh, Mesh]:
    """A two-piece cake-pop mould: open tray plus fitted plunger.

    The tray is a closed-bottom cavity with a central stick channel.  The
    plunger is a shallow stamp that fits inside the cavity.  Both pieces are
    built from watertight prisms; overlapping shells are unioned by the
    slicer at print time.
    """
    main = main.buffer(0)
    outer = main.buffer(max(0.8, mold_wall), join_style=1, quad_segs=8)
    if outer.is_empty:
        outer = main
    hole_r = max(1.0, (stick_hole + hole_clearance * 2) / 2)
    c = main.centroid
    stick = Point(c.x, c.y).buffer(hole_r, quad_segs=32)
    floor_poly = outer.difference(stick)
    base = extrude_polygon(floor_poly, 0.0, max(1.0, base_height))
    wall_ring = outer.difference(main)
    walls = [
        extrude_polygon(p, max(0.0, base_height - 0.25), max(0.5, mold_height) + 0.25)
        for p in _ring_parts(wall_ring)
        if p.area > 0.01
    ]
    tray = _append_all([base] + walls)
    # The plunger is deliberately slightly smaller than the cavity.
    plunger_poly = main.buffer(-max(0.2, plunger_clearance), join_style=1, quad_segs=8)
    if plunger_poly.is_empty:
        plunger_poly = main.buffer(-0.2, join_style=1, quad_segs=8)
    plunger_parts = [extrude_polygon(plunger_poly, 0.0, max(1.0, plunger_back))]
    face = str(plunger_face) if str(plunger_face) in {"imprint", "outline", "none"} else "imprint"
    relief_h = max(0.3, plunger_relief) + 0.2
    if face == "imprint":
        for d in details:
            clipped = d.intersection(plunger_poly)
            for p in _ring_parts(clipped):
                if p.area > 0.15:
                    plunger_parts.append(extrude_polygon(
                        p, max(0.0, plunger_back - 0.2), relief_h
                    ))
    elif face == "outline":
        inner = plunger_poly.buffer(-0.8, join_style=1, quad_segs=8)
        dense = plunger_poly.difference(inner) if not inner.is_empty else None
        if dense is None or dense.is_empty or dense.area <= 0.02:
            dense = plunger_poly.boundary.buffer(0.5, cap_style=1, join_style=1)
            dense = dense.intersection(plunger_poly)
        for p in _ring_parts(dense):
            if p.area > 0.02:
                plunger_parts.append(extrude_polygon(
                    p, max(0.0, plunger_back - 0.2), relief_h
                ))
    # Side grip tab, printed in the same plane as the plunger.
    pb = plunger_poly.bounds
    grip_len = max(10.0, min(26.0, (pb[3] - pb[1]) * 0.35))
    grip_wid = max(7.0, min(16.0, (pb[2] - pb[0]) * 0.18))
    grip = rounded_rect(grip_len, grip_wid, grip_wid / 2)
    grip = affinity.translate(grip, pb[2] - 1.5 + grip_len / 2, (pb[1] + pb[3]) / 2)
    plunger_parts.append(extrude_polygon(grip, 0.0, max(1.0, plunger_back)))
    return tray, _append_all(plunger_parts)


def _append_all(parts: list[Mesh]) -> Mesh:
    if not parts:
        return Mesh(np.zeros((0, 3)), np.zeros((0, 3), dtype=np.int64))
    out = parts[0]
    for p in parts[1:]:
        out = out.append(p)
    return out


def build_practice(
    main: Polygon,
    *,
    thickness: float,
    wall_height: float,
    wall_width: float,
) -> Mesh:
    """Shallow solid-backed practice cookie with a wall following the outline."""
    base = extrude_polygon(main, 0.0, max(1.0, thickness))
    ring = main.buffer(max(0.4, wall_width), join_style=1, quad_segs=8).difference(main)
    parts = [base]
    for p in _ring_parts(ring):
        if p.area > 0.01:
            parts.append(extrude_polygon(p, 0.0, max(thickness, wall_height)))
    out = parts[0]
    for p in parts[1:]:
        out = out.append(p)
    return out


def _map_mesh(mesh: Mesh, mapper) -> Mesh:
    if len(mesh.faces) == 0:
        return mesh
    vertices = np.asarray([mapper(tuple(v)) for v in mesh.vertices], dtype=float)
    return Mesh(vertices, mesh.faces.copy()).orient_consistent()


def build_bookmark(
    main: Polygon,
    details: list[Polygon],
    *,
    width: float,
    height: float,
    thickness: float,
    corner: float,
    margin: float,
    hole: bool,
    hole_diameter: float,
    hole_margin: float,
    relief: float,
    style: str = "relief",
    line_width: float = 0.4,
    gap: float = 1.0,
    bridge: float = 14.0,
    flare: float = 6.0,
    lip: float = 4.0,
    hinge_thickness: float = 0.6,
) -> Mesh:
    """Fold-over page clip that marks the page and snaps shut.

    The strip prints flat as one 50 x 150 mm rectangle, half the footprint of
    the old side-by-side pair.  A continuous living hinge across the middle
    folds the top half over the bottom half.  One inner face carries a raised
    motif and the other a matching recess, so the page is embossed.  A small
    bead/groove pair near the free edge closes the clip.
    """
    W = max(20.0, float(width))
    H = max(50.0, float(height))
    T = max(1.2, float(thickness))
    G = max(0.3, min(3.0, float(gap)))
    HINGE_T = max(0.25, min(T - 0.4, float(hinge_thickness)))
    TAB = max(0.0, min(12.0, float(flare)))
    safe_margin = max(2.0, min(float(margin), min(W, H / 2.0) * 0.3))
    half = H / 2.0
    hinge_floor = min(T - 0.6, max(0.6, T * 0.5))
    strip = rounded_rect(W, H, corner)

    lower_region = strip.intersection(box(-W / 2 - 1, -H / 2 - 1, W / 2 + 1, -G / 2))
    upper_region = strip.intersection(box(-W / 2 - 1, G / 2, W / 2 + 1, H / 2 + 1))
    hinge_region = strip.intersection(box(-W / 2 - 1, -G / 2 - 0.2, W / 2 + 1, G / 2 + 0.2))
    parts: list[Mesh] = []

    # Continuous living hinge at the middle.  It uses only the 1 mm gap and
    # leaves the two full-thickness plates free to fold.
    for p in _ring_parts(hinge_region):
        if p.area > 0.01:
            parts.append(extrude_polygon(p, 0.0, HINGE_T))

    # Clamping bead on the lower inner face and matching groove on the upper
    # inner face.  They line up across the hinge when the clip is closed.
    bead_x = min(W * 0.65, max(8.0, float(bridge)))
    bead_y = max(2.0, min(8.0, float(lip)))
    bead_len = max(1.2, min(2.2, T * 0.7))
    safe_margin = max(safe_margin, bead_y + bead_len + 1.0)
    snap_h = max(0.35, min(0.9, max(0.3, float(relief)) * 0.7))
    bead = rounded_rect(bead_x, bead_len, bead_len / 2)
    lower_bead = affinity.translate(bead, 0.0, -half + bead_y)
    upper_groove = affinity.translate(bead, 0.0, half - bead_y)

    # The raised motif and its recess are mirrored across the hinge so they
    # nest when the clip folds shut.
    if style != "none":
        detail_parts = [d for d in details if d is not None and not d.is_empty]
        if style == "line":
            line_w = max(0.8, min(2.0, float(line_width) * 2.0))
            if detail_parts:
                mark = unary_union([
                    d.boundary.buffer(line_w / 2, cap_style=1, join_style=1)
                    for d in detail_parts
                ])
            else:
                mark = main.boundary.buffer(line_w / 2, cap_style=1, join_style=1)
        else:
            mark = unary_union(detail_parts) if detail_parts else main
        if mark.is_empty:
            mark = main
    else:
        mark = None
    mark_lower: Polygon | None = None
    mark_upper: Polygon | None = None
    if mark is not None and not mark.is_empty:
        available_w = max(2.0, W - safe_margin * 2.0)
        available_h = max(2.0, (half - G / 2.0) - safe_margin * 2.0)
        mb = mark.bounds
        mw = max(1e-6, mb[2] - mb[0])
        mh = max(1e-6, mb[3] - mb[1])
        scale = min(available_w / mw, available_h / mh) * 0.98
        scaled = affinity.scale(mark, scale, scale, origin="center")
        sb = scaled.bounds
        center_y = (-half - G / 2.0) / 2.0
        mark_lower = affinity.translate(
            scaled,
            -(sb[0] + sb[2]) / 2.0,
            center_y - (sb[1] + sb[3]) / 2.0,
        )
        mark_lower = mark_lower.intersection(lower_region)
        mark_upper = affinity.scale(mark_lower, 1, -1, origin=(0, 0))
        mark_upper = mark_upper.intersection(upper_region)

    raised_h = max(0.0, min(3.0, float(relief)))
    if raised_h <= 0.01:
        mark_lower = None
        mark_upper = None
    cut_h = min(T - hinge_floor - 0.2, max(raised_h + 0.2, snap_h + 0.25))
    cut_h = max(0.3, cut_h)

    # Lower plate: full thickness plus raised motif and bead.
    for p in _ring_parts(lower_region):
        if p.area > 0.01:
            parts.append(extrude_polygon(p, 0.0, T))
    if mark_lower is not None:
        for p in _ring_parts(mark_lower):
            if p.area > 0.02:
                parts.append(extrude_polygon(p, T - 0.03, raised_h))
    for p in _ring_parts(lower_bead.intersection(lower_region)):
        if p.area > 0.01:
            for layer, z0, height in _curved_relief_layers(
                p, T - 0.03, snap_h, "round"
            ):
                parts.append(extrude_polygon(layer, z0, height))

    # Upper plate: a floor plus the top ring around the recessed motif and the
    # closure groove.  The recess lets the raised motif press the page.
    for p in _ring_parts(upper_region):
        if p.area > 0.01:
            parts.append(extrude_polygon(p, 0.0, T - cut_h))
    top = upper_region
    if mark_upper is not None and not mark_upper.is_empty:
        top = top.difference(mark_upper)
    top = top.difference(upper_groove)
    for p in _ring_parts(top):
        if p.area > 0.01:
            parts.append(extrude_polygon(p, T - cut_h, cut_h))

    # Small pull tab on the free edge of the lower plate.
    if TAB > 0.3:
        tab_w = min(W * 0.45, max(8.0, bead_x))
        tab = rounded_rect(tab_w, TAB, min(TAB / 2.0, 3.0))
        tab = affinity.translate(tab, 0.0, -half - TAB / 2.0 + 0.5)
        for p in _ring_parts(tab):
            if p.area > 0.01:
                parts.append(extrude_polygon(p, 0.0, T))

    if not parts:
        return Mesh(np.zeros((0, 3)), np.zeros((0, 3), dtype=np.int64))
    out = _append_all(parts)
    bounds = out.bounds
    out = out.translated([
        -(bounds["min"][0] + bounds["max"][0]) / 2.0,
        -(bounds["min"][1] + bounds["max"][1]) / 2.0,
        0.0,
    ])
    return out.oriented()


def mesh_to_stl(mesh: Mesh) -> bytes:
    if len(mesh.faces) == 0:
        return b""
    v = mesh.vertices
    f = mesh.faces
    triangles = v[f]
    normals = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
    lengths = np.linalg.norm(normals, axis=1)
    lengths[lengths == 0] = 1
    normals = normals / lengths[:, None]
    header = b"CalicoCutters - cortador y sello para impresion 3D".ljust(80, b" ")
    buf = io.BytesIO()
    buf.write(header)
    buf.write(struct.pack("<I", len(f)))
    for n, tri in zip(normals, triangles):
        vals = [float(n[0]), float(n[1]), float(n[2])]
        for p in tri:
            vals.extend([float(p[0]), float(p[1]), float(p[2])])
        buf.write(struct.pack("<12fH", *vals, 0))
    return buf.getvalue()


def _escape(value: str) -> str:
    return escape(value, {'"': "&quot;"})


def three_mf_bytes(parts: list[tuple[str, Mesh, str, tuple[float, float, float]]], title: str = "CalicoCutters") -> bytes:
    materials = "".join(
        f'<base name="{_escape(name)}" displaycolor="{color}" />' for name, _mesh, color, _off in parts
    )
    objects: list[str] = []
    items: list[str] = []
    for i, (name, mesh, _color, offset) in enumerate(parts):
        oid = i + 2
        verts = "".join(
            f'<vertex x="{x:.4f}" y="{y:.4f}" z="{z:.4f}"/>'
            for x, y, z in mesh.vertices
        )
        tris = "".join(
            f'<triangle v1="{int(a)}" v2="{int(b)}" v3="{int(c)}"/>'
            for a, b, c in mesh.faces
        )
        objects.append(
            f'<object id="{oid}" type="model" name="{_escape(name)}" pid="1" pindex="{i}">'
            f'<mesh><vertices>{verts}</vertices><triangles>{tris}</triangles></mesh></object>'
        )
        tx, ty, tz = offset
        items.append(f'<item objectid="{oid}" transform="1 0 0 0 1 0 0 0 1 {tx:.4f} {ty:.4f} {tz:.4f}"/>')
    model = f'''<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="es-ES" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <metadata name="Title">{_escape(title)}</metadata>
  <metadata name="Application">CalicoCutters</metadata>
  <resources><basematerials id="1">{materials}</basematerials>{''.join(objects)}</resources>
  <build>{''.join(items)}</build>
</model>'''
    content_types = '''<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>'''
    rels = '''<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>'''
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types)
        z.writestr("_rels/.rels", rels)
        z.writestr("3D/3dmodel.model", model)
    return buf.getvalue()


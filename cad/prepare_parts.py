"""Prepare the supplied mechanical parts without changing the source files."""
import hashlib
import json
from pathlib import Path

import numpy as np
import pymupdf
import trimesh

HERE = Path(__file__).resolve().parent
ASSETS = HERE.parent / "public" / "assets"
DOWNLOADS = Path.home() / "Downloads"
FILES = {
    "frame": "Full Assembly (simplified) 2.0.stl",
    "hinges": "3D Printable Hinges - ProductDesignOnline.com.stl",
    "holder": "SiPM Holder Russian Tiles.stl",
    "tile": "tile_without the fiber but with the grove.stl",
}
manifest = {}
for name, filename in FILES.items():
    source = DOWNLOADS / filename
    mesh = trimesh.load_mesh(source)
    manifest[name] = {"file": filename, "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                      "bounds_mm": mesh.bounds.tolist(), "triangles": len(mesh.faces)}
    if name in ("tile", "holder"):
        mesh.export(ASSETS / f"{name}.stl")
    if name == "tile":
        from scipy.spatial import cKDTree
        paths = mesh.section(plane_origin=[0, 0, 8.4], plane_normal=[0, 0, 1]).discrete
        outer, inner = paths[:2]
        distance = np.r_[0, np.cumsum(np.linalg.norm(np.diff(outer, axis=0), axis=1))]
        samples = np.arange(0, distance[-1], 0.25)
        dense = np.column_stack([np.interp(samples, distance, outer[:, axis]) for axis in range(3)])
        _, indices = cKDTree(dense[:, :2]).query(inner[:, :2])
        centerline = (inner + dense[indices]) / 2
        centerline = centerline[:-1]
        start = np.argmin(np.linalg.norm(centerline[:, :2] - [20, 20], axis=1))
        centerline = np.roll(centerline, -start, axis=0)
        centerline = np.vstack([centerline, centerline[0]])
        (ASSETS / "fibre-path.json").write_text(json.dumps({
            "source": "STL groove section at 8.4 mm; midpoint between groove walls",
            "points_mm": centerline[::2].tolist(), "diameter_mm": 1.0}))
    if name == "frame":
        parts = mesh.split(only_watertight=False)
        # Reuse the extrusion profile, not the unused fourth rail level.
        for out, part in (("extrusion-post", parts[5]), ("extrusion-rail", parts[3])):
            part = part.copy()
            part.vertices -= part.bounds.mean(axis=0)
            part.vertices = part.vertices[:, [0, 2, 1]] * [0.1, 0.1, -0.1]
            part.export(ASSETS / f"{out}.stl")
    if name == "hinges":
        mesh.export(ASSETS / "enclosure-source.stl")
        parts = mesh.split(only_watertight=False)
        base = next(p for p in parts if len(p.faces) == 4888)
        lid = next(p for p in parts if len(p.faces) == 8260)
        base.export(ASSETS / "case-base.stl")
        lid.vertices -= [0, 51.9, 16.2]
        lid.export(ASSETS / "case-lid.stl")

document = pymupdf.open(DOWNLOADS / "AllinOne copy.ai")
page = document[0]
drawings = page.get_drawings()
# The third plate is blank, so no lettering is confused with cutting paths.
region = pymupdf.Rect(1158, 0, 1722, 570)
paths = [d for d in drawings if region.contains(d["rect"]) and d["rect"].width + d["rect"].height > 2]
outer = [d for d in paths if len(d["items"]) == 1 and d["items"][0][0] == "l"]
points = sorted(set(tuple(p) for d in outer for p in d["items"][0][1:]))
def cross(o, a, b):
    return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])
lower, upper = [], []
for target, sequence in ((lower, points), (upper, reversed(points))):
    for point in sequence:
        while len(target) >= 2 and cross(target[-2], target[-1], point) <= 0:
            target.pop()
        target.append(point)
hull = lower[:-1] + upper[:-1]
center = (np.min(points, axis=0) + np.max(points, axis=0)) / 2
scale = 2.54 / 72  # PDF points to centimetres.
def xy(point):
    return ((np.array(point) - center) * [scale, -scale]).tolist()
holes = []
for path in paths:
    if path in outer or len(path["items"]) < 3:
        continue
    segments = []
    for item in path["items"]:
        if item[0] in ("l", "c"):
            segments.append([item[0], *[xy(p) for p in item[1:]]])
    if segments:
        holes.append(segments)
acrylic = {"outline": [xy(p) for p in hull], "holes": holes,
           "source": "AllinOne copy.ai", "units": "cm"}
(ASSETS / "acrylic.json").write_text(json.dumps(acrylic))
page.get_pixmap(matrix=pymupdf.Matrix(2, 2), clip=pymupdf.Rect(7, 0, 570, 570),
                alpha=True).save(ASSETS / "acrylic-engraving.png")
(HERE / "parts-manifest.json").write_text(json.dumps(manifest, indent=2))
print(json.dumps({"acrylic_vertices": len(hull), "holes": len(holes), "parts": manifest}, indent=2))

if __name__ == "__main__":
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection
    fig = plt.figure(figsize=(14, 6))
    for i, name in enumerate(("hinges", "holder")):
        mesh = trimesh.load_mesh(DOWNLOADS / FILES[name])
        ax = fig.add_subplot(1, 2, i+1, projection="3d")
        faces = mesh.triangles[::max(1, len(mesh.faces)//20000)]
        ax.add_collection3d(Poly3DCollection(faces, facecolor="#a7b2ab", edgecolor="#34423b", linewidth=0.1))
        for setter, axis in zip((ax.set_xlim, ax.set_ylim, ax.set_zlim), range(3)):
            setter(*mesh.bounds[:, axis])
        ax.set_box_aspect(mesh.extents.copy())
        ax.view_init(40, -65)
        ax.set_title(name)
    fig.savefig(HERE / "supplied-parts.png", dpi=150)

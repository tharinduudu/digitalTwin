"""Render the supplied nut model from three directions before placing it."""
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
import trimesh

root = Path(__file__).resolve().parents[1]
scene = trimesh.load(root / "public/assets/tslot-nut.glb")
mesh = scene.to_geometry()
mesh.vertices *= 1000
figure = plt.figure(figsize=(12, 4))
for index, (elevation, azimuth) in enumerate([(25, 35), (90, -90), (0, 0)]):
    axis = figure.add_subplot(1, 3, index + 1, projection="3d")
    axis.add_collection3d(Poly3DCollection(mesh.triangles, facecolor="#b0b8ba", edgecolor="none"))
    center = mesh.bounds.mean(axis=0)
    radius = mesh.extents.max() * 0.55
    axis.set(xlim=(center[0]-radius, center[0]+radius), ylim=(center[1]-radius, center[1]+radius),
             zlim=(center[2]-radius, center[2]+radius), xlabel="x (mm)", ylabel="y (mm)", zlabel="z (mm)")
    axis.set_box_aspect((1, 1, 1))
    axis.view_init(elev=elevation, azim=azimuth)
figure.tight_layout()
figure.savefig(root / "screenshots/tslot-nut-cad-inspection.png", dpi=180)

# The parts used in the display

The meshes are already in `public/assets`. They can be viewed without KiCad,
Python, or the original design software. The notes below are for changing or
re-exporting them later.

## Mechanical parts

These files were supplied for this detector:

| Source | Used for |
| --- | --- |
| `Full Assembly (simplified) 2.0.stl` | Actual aluminium extrusion profiles |
| `3D Printable Hinges - ProductDesignOnline.com.stl` | Enclosure base and hinged cover |
| `SiPM Holder Russian Tiles.stl` | Corner SiPM holder |
| `tile_without the fiber but with the grove.stl` | 200 x 200 x 10 mm scintillator and groove |
| `AllinOne copy.ai` | Acrylic cutting paths, holes, slots, and engraving |

The enclosure filename mentions Product Design Online. That attribution is
retained here. These supplied assets remain subject to their original authors'
rights; this repository does not relicense them as original software.

The full frame source is taller than the exhibition detector. Its lowest,
empty fourth rail level is not drawn. The remaining rails are placed at the
three occupied levels, and the post length is adjusted to the current frame
height. The extrusion cross-section is kept from the STL rather than replaced
with a square bar.

`cad/parts-manifest.json` records the original bounds, triangle counts, and
SHA-256 hashes. The original files are never overwritten by the conversion.

### Rebuild the mechanical display files

Place the five original files in your Downloads directory with the names
above. Make a Python environment and run:

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install numpy scipy trimesh pymupdf matplotlib
python cad/prepare_parts.py
```

The script takes the frame apart into connected mesh pieces. It exports one
post and one rail profile, the tile, holder, enclosure base, and cover. The
specific enclosure pieces are selected from this supplied STL; if that source
changes, inspect its components before using the same selection.

The Illustrator file has a PDF-compatible page. A blank plate is used to
extract the outline and four holes/slots. This avoids mistaking letters for
cutting paths. The marked plate is rendered separately as an engraving mask.
The source lettering is diagonal. The sheets and artwork are oriented so the
letters read across the top when viewed from the readout-box side, with the
four screw locations over the beam slots. `ACRYLIC_ANGLE` is shared by both.

For the fibre, the script takes a horizontal section at 8.4 mm in the tile.
It finds the inner and outer groove walls and places the fibre between them.
The displayed 1 mm diameter is an assumption. The loop is open at the corner,
with both ends meeting the sensor face inside the holder. There is no exposed
green lead beyond the tile. This is not an optical-transport calculation.

### Corner SiPM

`sipm.glb` comes from the S13360-2050VE STEP component in the readout's
component library. It replaces the earlier green box. The package is placed
inside the holder's rectangular recess, with its sensing face centred at
(19.021, 19.021, 8.5) mm in the original tile coordinates. Its face points
diagonally into the tile. The holder determines the placement; this is not
a measurement of the real optical coupling gap.

To rebuild the browser asset, place the component model at
`cad/S13360-2050VE.step`, then run:

```sh
kicad-cli pcb export glb --no-board-body --force \
  --output public/assets/sipm.glb cad/sipm-export.kicad_pcb
```

The green bands follow the groove towards the two ends. Their speed and
brightness are chosen for visibility, not calculated from fibre properties.

### Layer thicknesses

The tile thickness comes from its STL. The acrylic artwork is two-dimensional,
so it cannot specify the material thickness. The display uses 2 mm acrylic
and 1 mm drawer liner on each side. Change those values in `mechanics.js` when
the actual thicknesses have been measured. The liner texture is an illustration
of a woven cushion, not a scanned surface.

The tile planes coincide with the horizontal beam centre heights. A tile is
10 mm thick and the supplied holder spans 15 mm vertically; both fit within
the 20 mm extrusion height. The clear sheets sit above and below the tile.
Four illustrated socket-head screws, washers, and sliding T-nuts sit above
each upper sheet; another four face down under each lower sheet. The supplied box has three mounting-wing slots,
which receive the same type of hardware. The M4-sized fasteners are drawn
for the display, not taken from a manufacturer CAD model.

Each post-to-rail joint has a gusseted right-angle extrusion bracket. There
are two at each corner, one for each horizontal rail, giving 24 brackets
across the three levels. Each has two M4-style socket-head screws and sliding
T-nuts. The 20 mm bracket legs, gussets, and clearance holes are illustrative
geometry, not CAD for a particular supplier's bracket. Screw heads, washers,
and nuts share the same geometry throughout; shaft length follows the mount.
The repeated bracket parts are instanced in eight GPU batches.
The bottom eight brackets face upwards above their rails. The top and middle
brackets stay underneath their rails.

The sheets' 2 mm profiles sit just outside the beam height. Their broad faces
are more transparent than their edges. The cushioning is shown translucent
in the explanatory view, not as a claim that the real drawer liner is clear.
Neither layer casts a solid shadow over the scintillator in this view.

## Readout PCB

`readout-assembly.glb` was exported from the local four-channel gLOWCOST 2v2
KiCad board, `RPi_Hat.kicad_pcb`, using KiCad 10. It contains the board,
components, pads, solder mask, and silkscreen. The input hash is in
`cad/hardware-manifest.json`.

To export a replacement, run:

```sh
kicad-cli pcb export glb --force \
  --include-pads --include-silkscreen --include-soldermask \
  --output public/assets/readout-assembly.glb /path/to/RPi_Hat.kicad_pcb
```

The PCB's component model paths must resolve in that source project. Export
from its original directory so `${KIPRJMOD}` points to the component models.
The display does not modify the KiCad project.

The indicator reference designators are D2, D3, and D4. Their centres are read
from the exported CAD, not estimated by eye. The display puts a small emissive
marker at each centre to make a pulse visible. This mapping is for explaining
tile crossings; it is not a reconstruction of the loaded FPGA binary.

## Raspberry Pi 5

The Pi is the manufacturer's STEP model, not a hand-drawn substitute.

- Source: [Raspberry Pi 5 product information portal](https://pip.raspberrypi.com/categories/892-raspberry-pi-5)
- Download: **rpi-5 3D STEP - No Graphics small file**, version dated 11 June 2026
- File in the archive: `rpi-5b_no_graphics.step`
- Copyright: Raspberry Pi Ltd, 2026
- Licence: MIT, included in `cad/pi5/LICENSE.txt`

To rebuild it, download and unpack that archive into `cad/pi5`, then run:

```sh
kicad-cli pcb export glb --no-board-body --force \
  --output public/assets/raspberry-pi.glb cad/pi-export.kicad_pcb
```

The carrier file has no physical board of its own. KiCad may warn that its
outline is missing; only the STEP component is exported. The original STEP is
large, so it is not needed in the repository once the GLB has been made.

`hardware.js` changes metres to centimetres and places both boards inside the
case. First it places the Pi on the enclosure's four mounting holes. In the
original enclosure coordinates, these are x=-27.5/21.5 mm and y=-21/37 mm.
The standoffs reach z=4.9 mm. This gives the Pi's 49 x 58 mm mounting pattern.
The Pi PCB underside rests on the standoff tops.

It then uses J2 in the readout CAD and OBJ3742, the GPIO header housing in
the Pi 5 export, to line up the two rows and their mating faces. If a new Pi
export changes its body names, inspect that model before changing this name.
Bodies with matching materials are merged for drawing. Component sizes are
not stretched to force them to fit. This alignment does not replace a complete
enclosure clearance or manufacturing check.

The exported FR-4 substrate is rendered opaque. Top and bottom silkscreen use
their outward-facing CAD normals, so back lettering is not visible through the
front of the board. Soldermask and component transparency are otherwise kept.
This shared loader is used by the detector, assembly guide and readout bench;
the original GLB and KiCad project are unchanged.

The exported U5 converter housing had a 4.1 mm gap above its footprint plane.
`hardware-adjustments.js` lowers the complete component by that amount before
merging the meshes. The housing is flush, its dimensions are unchanged, and
the original KiCad file is untouched.

The top engraving uses a bright white mask at 0.95 opacity independently of
the clear acrylic. The scintillator opacity is 0.36 so its body is easier to
see without hiding the fibre. These are display choices, not optical properties.

The signal cables use the first three SMA ports, J3, J4, and J5. J6 has a
yellow cap. Each cable follows the inward-facing corner of the vertical
extrusion, then comes out at its connector height. The three cable centres
are separated, not hidden in the solid extrusion centre. No signal cable is
routed behind the box.

The box is horizontally centered as one group, keeping the Pi, readout, header,
mounts, and ports aligned inside it. The black USB-C lead and blue Ethernet
cable use opening-face centres extracted from the Pi CAD: OBJ5144 for USB-C
and OBJ4358 for the RJ45 jack. Plugs and cable jackets are illustrative geometry.
The rubber feet are tapered circular frustums, wider against the extrusion
and narrower at the table. Their top and bottom heights are unchanged.

## SiPM carrier and coax connection

The SiPM is soldered to a small carrier board, not attached directly to the
coax. The board fills the rectangular opening in the supplied holder. A
board-mounted male U.FL sits directly behind the SiPM on the opposite side.
The cable's mating plug connects there; its other end connects to one of the
first three SMA inputs on the readout. The holder's groove has its arc centre
at transverse coordinate 2.4 mm and height 8.5 mm in the STL, with a 2.4 mm
radius. From that opening, the lead follows the full long channel along the
adapter to the horizontal beam. It then follows the beam to the inside corner
of the upright. Rounded line segments keep the lead on this route without
the overshoot of an unconstrained spline through the holder walls.

`sipm-mount.js` keeps the original sensor's optical face at the fibre ends.
The optical opening is 3.8 x 3.8 mm, while the rear rectangular board slot is
13.8 x 5.9 mm. The displayed board is 13.7 x 5.8 mm with a 0.8 mm assumed
thickness. The sensor and U.FL are opposite one another near one end of the
board, not at its geometric centre. Solder joints, the U.FL base, centre contact and
mating plug are illustrative geometry, not manufacturer CAD or a verified
mechanical fit. The Hamamatsu sensor itself still uses its component model.

## Browser libraries and photograph

Three.js, OrbitControls, GLTFLoader, STLLoader, and BufferGeometryUtils are
version 0.180.0. Lucide is version 0.468.0. Their licences are in `public/vendor`.
The detector photograph was supplied by the detector's builder.

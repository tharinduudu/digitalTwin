# Tracks and acceptance

Scene distances are centimetres and height is `y`. The three tile centres are
at 12.05, -0.95 and -13.95 cm, giving 13 cm adjacent spacing. Each tile has a
20 x 20 cm bounding square and a 1 cm thickness.

## The actual tile outline

The supplied STL has a 38.042 mm cut at one corner. The physics volume uses
its convex outline, rather than treating the missing corner as scintillator:

```text
-10 <= x <= 10
-10 <= z <= 10
-x + z <= 16.1958
height - 0.5 <= y <= height + 0.5
```

Ray clipping against these seven half-spaces gives entry, exit and path length.
It includes entry through the side of a tile. Fine fibre-groove voids are not
removed from this bulk material volume.

## Where muons enter

The generation boundary is a 120 x 120 x 62 cm box enclosing the detector.
Muons enter through its top or an upstream side face. For an incident unit
direction `u`, each face is weighted by `area * max(0, -normal dot u)`.
This matters for near-horizontal tracks: restricting generation to a finite
horizontal plane would lose tracks that should enter from the sides.

Changing the box dimensions changes how many unrelated muons are generated,
not the detector's expected coincidence rate. A statistical test compares
40 cm and 120 cm wide generation boxes with decay and scattering disabled,
isolating the source-normalization and geometry check.

The energy and direction distributions come from the published sea-level
source described in [PHYSICS.md](PHYSICS.md). The earlier cos-squared model
and its acceptance normalization to 230/min are no longer used.

## The acceptance overlay

The overlay starts at the centre of the lower selected tile and ends at the
upper tile's convex outline. It is a cut-corner pyramid, not a circular cone.
For separation `L`, its straight centre-to-centre-plane limits include:

```text
|L dx| <= 10
|L dz| <= 10
-L dx + L dz <= 16.1958
```

For top-bottom spacing of 26 cm, the middle of an uncut edge is about
`atan(10/26) = 21 degrees` from vertical. The uncut diagonal corners extend
farther, while the cut corner has a smaller limit.

The label says **straight-line acceptance** because this overlay does not
include multiple scattering or average over every possible starting point.
The counters, unlike the overlay, use the finite tile volumes and transported
paths. An unscattered muon crossing both outside convex tiles also crosses
the middle volume; scattering and detector inefficiency need separate treatment.

## What a displayed track means

A trajectory stores its positions, physical times and energy deposits. The
same trajectory is used for counting and drawing. It is played at 2 ns per
second so it can be seen. Room misses are thinned for drawing only. Fibre
light and LED flashes remain illustrative, not optical or firmware predictions.

In live-detector mode, measured minute totals remain separate. The drawn
trajectories are not reconstructed tracks from those totals.

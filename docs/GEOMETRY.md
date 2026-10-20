# Tracks and acceptance

The numbers and the picture do different jobs. In detector mode, a number is
a measured total for one minute. A moving line is a possible straight particle
path, drawn to explain how the three tiles work.

## A track crossing a tile

Scene distances are in centimetres. Height is `y`. Tile centres are at
12.05, -0.95, and -13.95, matching the horizontal beams. Their separations
remain 13 cm. A track has a middle-plane position `(xm, zm)` and slopes
`(dx, dz)`. With middle-plane height `ym = -0.95`, at height `y`:

```text
x(y) = xm - (y - ym) dx
z(y) = zm - (y - ym) dz
```

It hits a tile when both coordinates are between -10 and +10 cm. One hit cannot
make a pair coincidence. A straight line passing through aligned top and
bottom squares also passes through the middle square. This is a geometric
property of this model, not a statement that a real middle channel is perfectly
efficient.

## Angular sampling

We assume an intensity per area perpendicular to the track proportional to
`cos²(theta)`. Sampling crossings of a horizontal plane adds its projected
area factor `cos(theta)`. The solid-angle element adds `sin(theta)`. Thus:

```text
p(theta) = 4 cos³(theta) sin(theta),  0 <= theta <= pi/2
cos(theta) = U^(1/4),                U uniform on [0, 1]
phi = 2 pi V,                       V uniform on [0, 1]
```

This is a convenient exhibition model, not a measured angular spectrum for
the room. Other conventions call the horizontal-plane distribution itself
`cos²(theta)`; that convention needs different sampling. The convention above
is the one used in this code.

The simulation rate is normalized by a separate 40,000-track acceptance
calculation. Increasing the sampled area from 20 x 20 cm to 120 x 120 cm
increases the proposal rate by the area ratio. It does not increase the expected
adjacent-pair count rate. In measured mode, the normalization affects only the
illustration; it does not rescale the detector's recorded counts.

## Why the overlay is not a circular cone

For a track starting at the centre of the lower selected tile, let `L` be the
separation from the upper tile. Acceptance requires:

```text
|L dx| <= 10 cm
|L dz| <= 10 cm
```

The four boundaries make a square pyramid. For the 26 cm top-bottom spacing,
the limit toward the middle of an edge is `atan(10/26)`, about 21 degrees.
Toward a corner it is `atan(sqrt(2)*10/26)`, about 29 degrees. There is no single
azimuth-independent cone angle.

Moving the starting point away from the centre shifts these limits. The
overlay is labelled with its centre reference. It does not show acceptance
integrated over every possible hit position.

## Limits

The model uses centre planes, straight paths, and ideal tile detection. It
does not simulate interactions in the frame, secondary particles, multiple
scattering, energy loss, optical transport, thresholds, or accidental
coincidences. Missed tracks are drawn faintly and thinned for performance.
Raw single-channel counts are not used as a room-muon rate because they also
contain dark and electronic pulses.

The fibre path follows the groove. The moving green bands are still
illustrative; they are not a ray-traced calculation of light transport.

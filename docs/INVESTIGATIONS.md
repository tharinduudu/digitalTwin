# Student investigation and scintillation layers

`investigate.html` is a playable local/static workspace, not a hardware control.
Tilt changes the detector normal relative to a stationary world sky, from 0°
to 90°. Azimuth is the direction of that normal's horizontal projection:
North is world -z and East is +x. The cradle tilts about local -x, then yaws about world -y, so its upward
normal points towards the selected compass bearing. The pivot
is the middle tile centre, (0, -0.95, 0) cm. Preview CAD and transported rays
share this transformation. There is no claimed physical tilting fixture.

## Rates and exposures

The source is the existing Guan energy-angle model and normalization. A fixed
64 cm cube surrounds the detector at every angle. Its faces are sampled with
projected-area weighting by `MuonSource`. Inverse rotation takes world origins
and directions into the unchanged local tile geometry before `traceMuon` runs.
The local termination boundary is larger than all transformed source entries;
it does not restrict which tiles can be crossed. Ray paths for the illustration
are transformed back into world coordinates. The world preview arrows do not
rotate with the model. Preview examples never increment observation counts.

The worker uses 800,000 or 3,000,000 source muons with fixed numerical seed
20261110. For pair hit fraction p, estimated rate is source rate × p, and the
reported standard error is source rate × sqrt(p(1-p)/N). This is numerical
sampling uncertainty, not the uncertainty of a validated detector prediction.
The calculation is stationary, open sky, sea level, ideal detection, with the
same stopping, decay and approximate scattering as the main twin. It does not
simulate passive materials, weather, geography or real optical/electronic cuts.

Each hit pattern is one of eight disjoint masks. Independent Poisson draws
for the seven nonempty masks over the chosen exposure reconstruct pair/triple
counts without pretending those counters are independent. Durations are fixed
7/30/90/180-day intervals, not named calendar months. Long-exposure Poisson
sampling uses transformed rejection; it does not generate millions of
individual arrival timestamps. Conditional on the estimated mask rates this is
a Poisson observation. It does not propagate numerical rate uncertainty into
counting realizations; the two errors are displayed separately. All repetitions
of an orientation/precision share its cached numerical estimate. Observation
seeds are saved in CSV. The CSV also records settings and numerical sample size.

Comparisons use sessionStorage when available, so going to another learning
layer and back does not discard them. CSV is the permanent export. Clearing
the table is reversible only through a previously downloaded CSV; it does
not delete measured or external data. No data are sent to a remote service.

## Scintillation explorer

`scintillation.html` has five selectable stages, a scrubber, play/pause and
restart. The conceptual molecular energy diagram distinguishes excitation,
non-radiative relaxation and fluorescence. It does not claim measured energy
levels or draw atomic electron orbits. The WLS drawing follows the bundled
source-STL groove section. Optical dot counts and times, cell grid and electrical
pulse are explicitly illustrative, not predictions of yields or a circuit solve.
The actual fluor formulation, optical yield, fibre attenuation and coupling are
not known from the supplied CAD. No arbitrary PDE is inserted.

The single-tile exercise uses a 4 GeV muon entering near the top tile centre,
with scattering and decay disabled, and uses the shared PDG polystyrene CSDA
transport to display path and mean deposit. A 0° path is 1 cm; at 70° it is
2.924 cm. It is not a pulse-height distribution or a light collection model.

## Verification

`tests/investigation.test.mjs` checks orientation normals, inverse transforms,
pivot invariance, agreement with the saved vertical-rate baseline, reduced
acceptance at 60°, generation-boundary invariance, correlated pair/triple
accounting, seeded replay, and Poisson means/variances including large means.
Software consistency does not replace validation against surveyed hardware.

## Lab scene and detailed tile view

The bench, graduated yoke, support cradle, compass and adjustment knob are
illustrative teaching geometry. The cradle follows exactly the tilt-then-yaw
transform used for the detector CAD and the inverse transport transform.
They do not enter the material transport calculation and are not supplied
or clearance-validated fabrication CAD. Earlier minimal-rotation observations
are retained with an earlier-convention label and export metadata.

The scintillation lesson now loads the actual tile and holder STLs, source
fibre curve, SiPM GLB and shared carrier assembly. Top, edge and perspective
views retain the CAD dimensions; transparency and colours are illustrative.
Optical marker motion is driven by the process scrubber/play state, not an
independent calibrated photon calculation. The molecular diagram remains
available below the 3D view to explain what the macroscopic CAD cannot show.

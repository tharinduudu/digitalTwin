# Exhibition display checks

## Integrated UI and learning-flow review — 10 November 2026

All 117 tests pass. Static build passes. Shared light studio lighting now
covers introduction, guided model, student bench and the separate tile view;
no geometry or rate-model changes were made in this UI pass. Key specified
body/secondary/action text colour pairs exceed 4.9:1; slider track against
white is 3.33:1. These are palette checks, not a full WCAG conformance audit.

Browser checks confirmed named stage controls, the guided tour's onward tile
link, loading states, a 60° prediction giving 2.000 cm and 4.812 MeV in the
shared mean-deposit model, and a suggested upright comparison preserving the
previous 7-day exposure and compass bearing. Collection completed and added
a row without relabelling earlier runs. Phone document width equals the
390 px viewport. The experiment and scintillation scenes were captured on
desktop and phone. The prior PMREM sigma warning was fixed by removing the
unnecessary initial blur; historical console entries can remain in the tab.

`docs/UI-DESIGN-REVIEW.md` records research, design decisions, contrast values,
section-level attention hypotheses and a user-study plan. There has been no
student attention/retention study or analytics deployment. No hardware was
operated and nothing was published.

## Realistic teaching scenes — 10 November 2026

All 117 tests pass, including the added compass-bearing invariance check for
the azimuthally symmetric sky. Detector, fixture and transport now use the same
tilt-then-yaw transform; old stored rows retain an earlier-convention label.
The static build passes. Browser checks covered the bench at 30° with its
compass and graduated scale, compass changes, a completed 7-day observation,
and the source tile's perspective/top/edge controls and optical playback.
Source tile/holder/sensor assets report ready. Desktop and 390 x 844 phone
screenshots show both scenes; no page overflow or browser warnings/errors were
observed. Added fixture and bench geometry are explicitly illustrative.
No hardware operation or publication occurred.

## Playable investigations and scintillation — 10 November 2026

All 116 Node tests pass, including the new rotation, baseline-rate, boundary
invariance, exposure-accounting and aggregate-Poisson tests. Static build passes
with `investigate.html` and `scintillation.html` included. Existing tests remain.

Browser checks at 1440 px desktop and 390 x 844 phone confirmed loaded CAD,
actual detector tilt while sky arrows stay vertical, a completed 30-day vertical
run and 7-day 60° east run, preserved comparison rows, a rate graph and CSV
export. A subsequent observation survived reload via sessionStorage. The phone
workspace and updated home page have no horizontal document overflow.
Checked CAD screenshot crops have RGB standard deviations above 33 (phone)
and 36 (desktop). No browser warnings or errors were logged on either new page.

The scintillation controls switch molecular, groove and microcell diagrams;
play advances to the final stage and stops; restart returns to deposition.
The single-tile control changes path from 1.000 cm at 0° to 2.924 cm at 70°,
and mean CSDA deposition from 2.406 to 7.035 MeV for the chosen 4 GeV example.
These are software-model results, not measured optical yields or pulse heights.
No detector feed requests, hardware control or publication were performed.
See `docs/INVESTIGATIONS.md` for method and limitations.

## Discovery page — 10 November 2026

All 111 Node tests pass. The static Pages build completes with both the new
`index.html` introduction and the preserved full display at `detector.html`.
The guided example uses the shared transport model; its three tile crossings,
pair accounting and approximately 0.87 ns outer-plane flight interval are tested.

Local browser checks covered a 1440 x 1000 desktop and a 390 x 844 phone.
Source CAD reports ready, the six-step controls change the explanation,
the electronics step opens the readout cover, and replay/reset are operable.
The phone document width equals its 390 px viewport. Browser logs showed no
warnings or errors. Screenshots show nonblank CAD; RGB standard deviations
in the checked scene crops exceed 36 on phone and 79 on desktop. This is a
rendering check, not validation of optical yield or detector efficiency.
The new introduction makes no detector feed request. No hardware was operated
and no publication was performed. The following older checks remain historical.

Checked locally on 20 October 2026.

## Automated tests

All 46 Node tests pass. They cover absolute flux integration, projected-area
sampling, generation-box invariance, finite-volume intersections, energy
conservation, stopping, flight time, completed bins, reproducible IDs,
log column order, partial lines, stale data, cut-corner-pyramid
boundaries, fibre endpoints, green light, mounting holes, GPIO placement,
and the SMA cable route.

The fibre endpoints lie on the sensor face inside the supplied holder. The
path stays within the 20 x 20 cm tile. These are geometry checks, not an
optical-efficiency measurement.

## Browser and CAD checks

- The new physics source was checked at desktop size and 390 x 844. The
  source label reports Guan et al., the phone has no horizontal overflow,
  and the browser reports no warnings or errors. Two desktop captures
  changed 64,098 pixels in the scene region; its pixel standard deviation
  was 41.8. All three LED counters advanced. Acceptance, pair selection,
  opening the readout and the model-details dialog were checked again.
- The supplied frame, tile, holder, acrylic, liner, and enclosure load.
- All three sensor carriers load in the holder slots. Tests keep each optical
  face unchanged and place the rear U.FL opposite it, with the coax reaching
  the existing vertical-beam route.
- The GitHub Pages simulation loads under its project path with simulated
  counts and no detector connection. The same simulation is used locally.
- Acrylic mounting holes face the beam slots. Lettering runs horizontally
  from the readout-box side, accounting for the diagonal source artwork.
- The 10 mm tile and 15 mm holder sit within each 20 mm beam height. Rendering
  and track intersections share the same recessed plane heights.
- Socket-head screws, washers and sliding T-nuts secure the acrylic and box.
- The scene contains 24 acrylic fasteners: four above and four below each
  level. Lower screw heads face downwards. There are 24 gusseted corner
  brackets with 48 screws, using the same head and nut geometry as the other
  mounts. These repeated bracket parts use eight instanced draw batches.
- Clear acrylic profiles extend outside the beams, while translucent broad
  faces and cushioning leave the scintillator and fibre visible.
- The centered enclosure has USB-C and Ethernet connections located from the
  Pi CAD. Tapered rubber feet meet the floor without sinking into it.
- Green light follows the fibre. The placeholder box and exposed green lead
  outside the tile corner have been removed.
- Room tracks include misses and tile crossings. The acceptance toggle shows
  the labelled straight-line pyramid from the lower selected tile's centre,
  including the tile's cut corner.
- The actual readout and Pi 5 CAD load with the cover closed and remain
  visible through its vents. Opening and closing the cover does not hide
  the boards. The closed view reports hardware ready before opening.
- U5 is lowered 4.1 mm without scaling. The loaded model reports a zero
  housing-to-footprint gap. The source KiCad file is unchanged.
- The scintillator uses 0.36 opacity; the fibre remains visible. Top artwork
  stays bright in both tile views. QR scanning has not been tested.
- The Pi uses the enclosure's four 49 x 58 mm mounting points. Its PCB underside
  sits at the 4.9 mm standoff height. The readout is placed from the Pi header,
  not from an independent board-centre estimate. This is not a full mechanical
  clearance check.
- Three SMA leads emerge from the vertical beam beside J3/J4/J5. No signal
  cable loops behind the enclosure. J6 remains capped.
- All three illustrative LED flash counters advance. Their markers are red.
- Wrapped/transparent tiles, acceptance, and cover controls work.
- Desktop and 390 x 844 phone screenshots show a nonblank scene. Scene-region
  pixel standard deviations were 47.3 and 47.1 respectively. Earlier successive
  desktop captures changed more than 200,000 pixels in the checked region.
- Phone layouts at 390 x 844 and 320 x 700 have no horizontal page overflow.

Earlier checks also covered 1920 x 1080 and 1366 x 768, pair selection,
pause, rotation, camera reset, photo/details dialogs, and the in-window
fullscreen fallback. Native fullscreen was denied during automation and is
not claimed as verified.

## Data and limitations

The SSH source was checked against the detector's acquisition code and minute
records. The order is 01, 02, 12, triple, then three singles. Records update
without changing acquisition. Failed reads hold the last measurements rather
than substituting simulated values.

Only minute totals are measured in detector mode. In simulation mode, the
source and approximate muon transport supply the counts and trajectories;
green light and LED timing remain illustrations. The acceptance overlay is
geometric, not a scattering envelope. See [the physics check](docs/PHYSICS.md)
for the 600-minute numerical run, model assumptions and limitations.

The server listens on localhost, port 8791. Rendering is capped near 30 frames/s,
and static CAD bodies are merged by appearance. Sustained performance on the
exhibition Pi has not been measured. Runtime assets are local, but full
airplane-mode operation has not been separately tested.

### Shared interface preview (10 November 2026)

All seven pages share `site-theme.css` and a consistent navigation header.
Browser layout checks passed at 320, 390, 768 and 1440 px widths without
document horizontal overflow. Reviewed desktop/phone screenshots and exercised
assembly complete-view and PCB back/3D controls. Source CAD dimensions and
transport calculations were not changed by this visual pass. Local only.

### First-view size, identity and learning path

Homepage second WebGL scene replaced with tightly framed source-CAD portrait;
interactive guide retained. Official cosmic.gsu.edu logo on all seven pages.
Recommended continuation follows detector → scintillation → experiment →
electronics, with assembly and network as optional branches. Saturated particle
colours, higher trail opacity and larger illustrative heads improve visibility
on the pale studio background; physics calculations are unchanged.

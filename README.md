# gLOWCOST Digital Twin

The gLOWCOST GSU muon detector is simulated here as a digital twin for STEM
activities and exhibitions.

This is an exhibition display for our three-tile cosmic muon detector. The
idea is to show what the detector does while people can also see the instrument
on the table. Particles move through the surrounding space, the tiles flash
when crossed, and the readout box can be opened to see the PCB and Raspberry Pi.

The numbers can come from the detector's latest minute file. The moving tracks
are an illustration. A minute file tells us how many coincidences were counted;
it does not tell us where each particle passed or when each LED flashed.

![Three-tile detector and geometric acceptance](docs/figures/acceptance.png)

## Start the display

**Public simulation:** [tharinduudu.github.io/digitalTwin](https://tharinduudu.github.io/digitalTwin/)

The public version is hosted on GitHub Pages. It runs entirely in the visitor's
browser and shows simulated counts, not live measurements. No paid server,
account, or connection to the lab network is needed to view it.

### Run locally

Install [Node.js](https://nodejs.org/) 20 or newer, then run:

```sh
git clone https://github.com/tharinduudu/digitalTwin.git
cd digitalTwin
node server.mjs
```

Open **http://127.0.0.1:8791/**. On a Mac, `start.command` does the same thing.
There is no npm install or build step. Three.js, the CAD models, and the other
assets are included, so simulation mode works without internet access.

Without a detector connection, the heading says **Simulation**. Counts now
come from an absolute sea-level muon source and the tile geometry. They are
not adjusted to the earlier 230/min demonstration value. Individual minutes
fluctuate because arrivals are sampled as a Poisson process.

To preview simulated data while a local detector feed is configured, open
**http://127.0.0.1:8791/?source=simulation**. This does not change the detector.

### Publish an update

Push to `main`. The Pages workflow runs the tests, copies `public/` into a
static website, and publishes it. `scripts/build-pages.mjs` marks that copy as
simulation-only. SSH code, the Node server, and local settings are not included
in the published website. Asset paths work beneath the `/digitalTwin/` address.
Each deployment gives the assets a revision directory, so a cached script
from an older version is not mixed with the new models or interface.

GitHub Pages is enabled with **GitHub Actions** as the build source. There are
no paid services in this setup. The free service still has GitHub's normal
storage, traffic and build limits.

## What can be opened or changed?

### Detector assembly guide

Open **http://127.0.0.1:8791/assembly.html** for the separate 3D assembly guide.
It uses the same CAD as the detector display. The 22 steps cover the three-level
frame, acrylic and liner sandwiches, fibres and SiPM holders, and the Pi 5 and
readout enclosure. Each step has the parts needed and a check before moving on.
Flat T-nuts are fed through open groove ends, farthest position first. Acrylic
and enclosure mounting nuts are included before the rail ends close. Corner
pieces slide along the rail grooves on the bench. Start with the frame upside
down and fit the top-layer short beams first, sliding their brackets in from the
open foot ends of the uprights. Turn the frame 90 degrees onto its side, then
fit the middle rails followed by the bottom rails through those same open ends.
Leave the feet off until these sliding operations are complete. Secure and square
the frame, then fit all three lower acrylic sheets while their undersides are
accessible from the side. Turn the frame another 90 degrees onto its feet before
adding the liners and preassembled scintillator units. The complete frame and
fitted sheets turn together; loose rail subassemblies stay on the bench.
The empty frame is labelled TOP from the start. MIDDLE appears after its four
rails are seated, then BOTTOM after the final four. These names stay with the
physical levels during both turns. Dimension arrows mark 13 cm from top to
middle and from middle to bottom, measured centre to centre, not as a clear
gap between beam edges. The guides disappear when tile installation starts.
They are not dropped into a closed slot. A missed flat nut means disassembling
the joint to regain access to the open beam end. The part-separation slider
can replay the fitting route.
The nut button opens a beam-by-beam loading check. Numbered locations distinguish
frame-joint nuts (amber), acrylic-sheet nuts (blue) and readout-box nuts (pink).
The rails become see-through for this inspection; the colours are only highlights.
The numbers are the actual insertion sequence from the arrow-marked open end.
In each groove the far nut goes first, then the middle nut, then the near nut.
Both end brackets stay off until every nut is loaded. The inspection starts with
brackets hidden; its replay shows the nuts entering before the brackets slide in.
The fitted-brackets checkbox shows the completed arrangement, not an earlier step.
The nut mesh comes from
the supplied 5537T161 STEP: its separate screw solid is excluded, and the nut is
kept at its original 15 x 8 x 3 mm dimensions. `cad/prepare_tslot_nut.py` records
the source checksum and selects the nut before the KiCad GLB export.
The liners cover the full 20 x 20 cm tile area. Each tile arrives as a unit with
its fibre already glued in, SiPM and cable fitted, and adapter covered in black
light-blocking tape. Those optical parts are not installed separately in the frame.
The full coax lead and its free SMA plug also belong to that tile unit. They move
with it through the side opening, with the free cable carried loose outside the
frame. The routing step then guides those same cables into the upright corner and
connects their free ends, one at a time. It does not add a new cable at that stage.
The loose and seated cable paths have matching lengths; the transition is an
assembly illustration, not a flexible-cable or hand-clearance simulation.
The tape uses the holder's actual surface, with a thin patch over the rear board
recess; it does not replace the holder outline with a triangular block.
Camera views, the cover control and the
complete-detector view let you inspect the build from different sides.
Liners and scintillators are opaque in this guide, while acrylic is only slightly
transparent. Rail operations take four nominal seconds per rail, and three-layer
placement steps take 12 seconds. Playback starts at 1x; slower and faster settings
are available. The camera holds a wider view by default, with the same view kept
between related steps. The focus button enables following a rail or tile level
when a closer look is needed. Dragging the view stops following; replay and
autoplay keep that choice. Autoplay leaves a short pause after each operation
before moving to the next step.

The timeline can be dragged in either direction, including back across a step
boundary. The rewind button moves back five seconds. Camera, separation and
view controls sit below the 3D view so they do not cover the parts. Instructions
and nut inspection sit in a separate right-hand panel on desktop; the panel button
can hide them to widen the view. On phones, they follow the playback controls,
leaving a taller detector view above. The simulation header links to this guide.
The camera stays on the whole layer while its screws are tightened, or on the
enclosure while fixing the Pi. It does not chase each screw. Slow amber pulses
mark the nuts that must be end-loaded before the joint closes, including the
later acrylic and box mountings. A missed nut would mean reopening that joint.
Reduced-motion mode keeps these warning rings steady.
Screws advance along their
axes and turn into the nuts after the supported part has seated; an Allen key
marks the active frame fastener. The Pi has four separate Phillips-head screws
into the enclosure supports, without frame T-nuts; a Phillips screwdriver is
shown for these screws. The enclosure and open lid are mounted together;
the lid remains on its hinge while the Pi and readout are fitted, then swings
closed. An outline marks the actual cut corner at the SiPM end of each tile.
This gap leaves room to guide the attached lead from the holder groove along the
inside face of the horizontal beam, then down the inside corner of the upright.

This is a mechanical guide, not a power-up script. It does not connect to a
detector, change bias, or start acquisition. Keep power and HV off while working
on the wiring. The actual drawings and hardware still decide fastener lengths,
clearances, optical coupling and the electrical checks before commissioning.
Partly transparent acrylic reveals the stack. The displayed route leaves room beyond the
open foot ends before sliding a rail along the post grooves, but hand and tool clearances
still need checking on the bench. The guide is not a released manufacturing process.

The guide is included in the normal static Pages build as `assembly.html`.
Its step text is in `public/assembly-steps.js`; the viewer and interface are in
`public/assembly.js`. Component lists in `mechanics.js` and board references in
`hardware.js` keep the guide aligned with later model corrections.

### Exhibition controls

- The layers button switches between wrapped and transparent tiles.
- The pyramid button shows the geometric acceptance for the selected pair.
- The box button opens the readout cover and moves the camera closer.
- The rotation button turns the detector slowly. Dragging also changes the view.
- Pause stops the animation, not the detector or the incoming minute records.
- The camera button shows a photograph of the physical detector.
- Full screen gives more room for an exhibition display.

The actual KiCad PCB export and Raspberry Pi 5 CAD load at startup and remain
inside the enclosure when it is closed. The boards can be seen through its
vents; opening the cover exposes the same assembly.
At each tile corner, the SiPM sits on a carrier PCB in the holder's rectangular
slot. A U.FL plug connects the back of that board to the coax, which runs through
the inside corner of the extrusion to an SMA input on the readout. Carrier and connector geometry
is illustrative; the sensor and holder use the supplied component models.
The three indicators flash when the illustrated track crosses the corresponding
tile. These flashes are slowed down and are not a copy of the FPGA's LED logic.

![Readout opened](docs/figures/readout-open.png)

## Use a detector's minute counts

The program only reads the log. It does not set bias, thresholds, GPIO modes,
or interrupt handlers. It does not start or stop acquisition.

First make sure normal SSH works. Replace `detector-address` with the address
of your Pi:

```sh
ssh cosmic@detector-address
```

With an existing SSH key, start the display like this:

```sh
DETECTOR_HOST=detector-address node server.mjs
```

For password login, open one reusable SSH connection first. Enter the password
at SSH's prompt, not in a script:

```sh
ssh -M -N -f -o ControlPersist=86400 \
  -S /tmp/glowcost-display-%C cosmic@detector-address
DETECTOR_HOST=detector-address node server.mjs
```

That connection lasts up to a day. The display checks the newest `.log` file
every 15 seconds and reads only its last 64 KiB. The Pi needs Python 3, but no
new Python packages. If the connection stops working, the last measurements
remain visible and the status changes. Fake counts are not substituted.

Optional settings:

| Variable | Default | What it changes |
| --- | --- | --- |
| `PORT` | `8791` | Local web server port |
| `DETECTOR_HOST` | unset | Enables measured-count mode |
| `DETECTOR_USER` | `cosmic` | SSH account |
| `DETECTOR_LOG_DIR` | `/home/cosmic/mppcInterface/firmware/libraries/slowControl` | Directory containing minute logs |
| `DETECTOR_CONTROL_PATH` | `/tmp/glowcost-display-%C` | Reusable SSH socket |

The expected column order is:

```text
coinc01, coinc02, coinc12, triple, single0, single1, single2, date and time
```

Check the acquisition code before using a different readout. Do not assume
that its second column is coincidence 1-2. Here it is coincidence 0-2.

The display shows the latest completed 60-second record and up to fifteen
recent records from that file. Its interval follows the file timestamp, which
need not land exactly on the wall-clock minute. Data more than 150 seconds old
is marked stale. A failed SSH read is shown as unavailable.

## How the model was made

The frame uses the supplied aluminium extrusion mesh. The unused fourth level
was removed, and the posts were shortened to the three-tile exhibition height.
The tiles are 20 x 20 x 1 cm, with 13 cm between their centre planes.

The tile and SiPM holder come from the supplied STL files. A section through
the groove is used to place an illustrative 1 mm fibre between the groove
walls. The acrylic outline, screw holes, slots, and engraving come from the
Illustrator file. The sheets' mounting holes face the beam slots, and the
lettering reads horizontally from the readout-box side. There is acrylic and a thin drawer-liner layer on
both sides of each tile. Their thicknesses are display assumptions, not
measurements taken from the artwork.

The scintillator and its holder sit within the horizontal beams, so neither
protrudes in a level side view. Four socket-head screws and sliding T-nuts
secure each upper sheet, and four face downwards beneath each lower sheet.
Gusseted angle brackets join the horizontal extrusions to the posts. The
brackets and readout mounts use the same screw-head and T-nut style.
The bottom layer's brackets sit above its rails; the other layers' brackets
sit below them. Faint centimetre rulers run along the three scene axes, with
one-centimetre ticks and labels every five centimetres.
Fastener dimensions are illustrative M4-sized hardware.

The clear sheets extend just beyond the beam height, so their 2 mm profiles
can be seen from the side. In the transparent view, the acrylic faces and
cushioning are faint enough to see the scintillator and fibre underneath.
The centered readout has USB-C power and Ethernet cables connected to the Pi.
Four tapered rubber feet support the frame.

The Hamamatsu S13360-2050VE component model sits in the corner holder's
recess. Both ends of the fibre stop at its sensing face. Green light moves
along the fibre towards those ends after a tile crossing. The light is slowed
down so the process can be seen; it does not predict photon travel times or
the amount of light collected.

The readout cover and base come from the supplied enclosure STL. The readout
PCB is exported from KiCad, including its components. The Pi is Raspberry Pi's
own Pi 5 STEP model. See [the asset notes](docs/ASSETS.md) for sources,
dimensions, and instructions for making the browser files again.

The assembly explains the detector. It is not a clearance check for
manufacturing the enclosure. The Pi sits on the enclosure's four standoffs,
using the 49 x 58 mm mounting pattern. The readout's J2 socket is then aligned
to the Pi GPIO header using their CAD positions. The three coax leads follow
the holder grooves and the inward-facing corner of the vertical extrusion.
They leave beside the SMA connectors, not behind the box.

## How the particle animation works

The source uses the sea-level energy and angular spectrum of
[Guan et al.](https://arxiv.org/abs/1509.06176). Muons enter the top and side
faces of a surrounding 120 x 120 x 62 cm volume, with the correct projected
area weighting. Energies span 0.1 GeV to 10 TeV. The published normalization,
not a target detector rate, sets their arrival rate.

Each muon is checked against the 1 cm thick tiles, including their cut corner.
Mean energy loss and stopping use PDG polystyrene tables. Relativistic speeds,
proper lifetime and a Gaussian thin-slab scattering approximation are included.
A miss produces no tile flash. A single hit can flash one tile but cannot
create a coincidence. The same transported muon supplies the counts and picture.

Unrelated tracks are thinned for drawing so the scene stays responsive. This
thinning does not change the simulation counters. Playback shows 2 ns of
muon flight per second. Real muons do not take seconds to cross the detector.

The yellow acceptance shape is a **cut-corner pyramid from one reference point**:
the centre of the lower selected tile. Its upper boundary follows the upper
tile outline. It is not a circular cone, nor is it the acceptance for every possible
hit position. [The geometry notes](docs/GEOMETRY.md) explain this distinction.

This is an open-sky, sea-level model with ideal detection, not a validated model
of the indoor apparatus. Building shielding, altitude and weather corrections,
transport in passive parts, secondary particles, energy-loss fluctuations,
optical transport, dark pulses, SiPM PDE and discriminator thresholds are not
included. It is not a Geant4 calculation. In live-count mode, no simulated
intersection is added to the measured numbers.

See [the physics model and checks](docs/PHYSICS.md) for equations, assumptions,
validation results and the limits of the material approximations.

## Find your way through the code

| File | Job |
| --- | --- |
| `server.mjs` | Serves the page and sends updates to browsers |
| `detector-source.mjs` | Reads and checks completed minute records over SSH |
| `simulation.mjs` | Exports the shared browser/server simulation |
| `public/simulation.js` | Samples arrivals, transports muons and accumulates count bins |
| `public/muon-source.js` | Samples the published sea-level energy/angle spectrum |
| `public/muon-transport.js` | Intersects tiles, calculates energy loss, scattering and flight |
| `public/polystyrene-data.js` | Bundled PDG stopping-power and range data |
| `public/app.js` | Connects the buttons, status, and incoming data |
| `public/scene.js` | Draws and animates the detector |
| `public/mechanics.js` | Places the supplied STL parts, acrylic, liner, and fibre |
| `public/fibre.js` | Follows the groove and animates green light towards the SiPM |
| `public/readout-placement.js` | Aligns the GPIO header and defines the side cable route |
| `public/detector-geometry.js` | Shares the recessed tile heights and acrylic orientation |
| `public/fasteners.js` | Draws socket-head screws, washers and sliding T-nuts |
| `public/corner-brackets.js` | Places and batches the gusseted extrusion brackets |
| `public/hardware.js` | Loads the PCB and Pi CAD and flashes the indicators |
| `public/acceptance.js` | Defines the selected-pair acceptance geometry |
| `public/charts.js` | Draws the count history |
| `cad/prepare_parts.py` | Converts the mechanical files into display assets |
| `tests/` | Checks rates, column mapping, timestamps, and geometry |

The code uses ordinary JavaScript modules. Static CAD bodies with the same
appearance are merged after loading. The PCB/Pi models load in the background
and remain present inside the closed box. Rendering is capped near 30 frames per second,
and hidden tabs stop drawing.

## Tests

```sh
node --test tests/*.test.mjs
```

The tests check source normalization, projected-area sampling, generation-box
invariance, energy conservation, stopping, flight time, tile geometry,
coincidence accounting, completed bins, log mapping and mechanical placement.
See [verification notes](VERIFICATION.md) for browser checks.

Third-party CAD and libraries retain their own licences. No login credentials
or detector data files are included in this repository.

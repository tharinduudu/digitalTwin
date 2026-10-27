# Readout bench

The bench is at `probe.html`. It is a teaching and circuit-inspection tool,
separate from the detector animation and the assembly guide. It does not open
the PicoScope SDK, send SSH commands, change bias voltages or read live hardware.

## Where the electrical points come from

`public/assets/probe-board.json` contains 560 named pads and 855 outer-layer
track segments from the same KiCad board used for `readout-assembly.glb`. The
board hash matches `cad/hardware-manifest.json`. Coordinates retain the KiCad
GLB convention: PCB x becomes scene x, PCB y becomes scene z, and scene y is
normal to the board. Meshes are not stretched to fit probe locations.

The actual schematic is exported into
`public/assets/readout-schematic/RPi_Hat.svg`. A KiCad XML netlist is compared
with every PCB pad. The export fails if a net splits or merges between the
two sources. There are nine label aliases in this revision, affecting 28
pads. For example, schematic `Ch0_HV0` is PCB `Ch0_DAC0`, and schematic
`Ch7_COMP3` is PCB `Ch6_COMP3`. These are name differences, not invented wires.

Probe letters sit away from the selected pads, with thin arrows and hollow
target rings. The arrowheads stop 7 pixels before the pad centre so they do
not cover the point being inspected. Labels move with the view and avoid
both targets and one another. Solid probe bodies are not drawn over the pads.

Select the probe letter before clicking a pad. Green markers belong to the
selected channel. All nets also shows other connected pads, including grey
points without a waveform model. Selecting a surface track resolves its net
to a pad on that net. Within this lumped model, there is no propagation delay
between different points on the same copper net.

In schematic view, net labels select the corresponding PCB net. Selecting a
component reference filters the node list to its pins. The quick points give
direct access to the SMA centre, amplifier input/output, threshold and logic
output for each channel. Zoom and pan are available in both views.

## How the signal is calculated

The analog template is solved offline with ngspice. The deck is stored inside
the JSON so the calculation can be inspected. Its CH0 values are:

| Element | Value or role |
| --- | --- |
| C28 | 1 uF AC coupling |
| R8 | 49.9 ohm input to ground |
| R40 | 1 kohm low-side bias feed |
| R9 / R7 | 4.9 kohm / 49.9 ohm feedback |
| OPA846 | Nominal gain 1 + 4900/49.9 = 99.1964 V/V |
| Amplifier pole | Assumed GBW/gain, using 1.75 GHz GBW |
| R27 | 200 ohm comparator input resistor |
| Comparator input capacitance | Assumed 1 pF intrinsic load, not the DNP C60 |
| SiPM terminal capacitance | Assumed 140 pF |
| One avalanche charge at 3 V overvoltage | 1.7e6 x elementary charge |
| Avalanche current shape | Difference of exponentials, 0.8 ns rise / 30 ns fall |

The template has 0.5 ns sampling from -200 ns to 1800 ns. Its integrated
current is approximately one avalanche charge. The browser scales it by the
entered fired-cell count and overvoltage relative to 3 V. A simple +/-4.65 V
output clamp demonstrates saturation. It does not reproduce overload recovery,
slew-rate limits, transistor behaviour or full feedback dynamics in saturation.
The feedback voltage follows the clamped output divided by the nominal gain.

All four channels use the same nominal response, with an illustrative 1.5 ns
offset between neighbouring injected channels. This is not a measured timing
calibration. A light-pulse acquisition injects the chosen number of avalanches
into all channels. The dark-pulse choice injects one avalanche only in the
selected channel. There is no dark-count-rate or accidental-coincidence model.

The comparator is a sampled Schmitt model with an assumed 8 mV hysteresis,
nominal 2.5 ns delay and an illustrative 0.55 ns edge time constant. Both probes
refer to the same event; the logic output is computed from its analog input
and threshold, not drawn independently. Changing threshold leaves the analog
pulse unchanged. The 22 ohm output resistor has no extra transmission-line
model in this version, so its two sides share one comparator trace.

Noise is optional and off initially. When enabled it is an explicitly
illustrative sum of sinusoids, not a measured spectrum or random dark noise.
There is no claim of correct noise statistics or event efficiency here.

## DC levels and controls

The stored calibration law is:

```text
V_DAC = 0.0005 + 2.9968 * code / 1023 V
V_effective = V_high - V_low
V_over = V_effective - V_breakdown
```

Bias and threshold codes accept hexadecimal `000` through `3FF`. The default
high side is 55.13438 V and the low-side code is `1BD`. With the assumed Vbr
of 50.83 V, these give approximately 3.00 V overvoltage. These defaults are
example model conditions, not verified settings for any newly connected SiPM.
The same bias and threshold setting is used for all four channels in this bench.

The circuit has no avalanche response at or below the assumed Vbr. Scaling far
above the reference overvoltage is an unvalidated extrapolation, not a gain,
PDE or safety prediction. Ideal DC rails are drawn as flat lines. Ripple,
startup, DAC filter settling and code-update glitches are deliberately omitted.

The 50 MHz clock is illustrative. I2C traffic, the MAX1932 switching/control
nodes, FPGA firmware outputs and LED timing have no waveform model. An
unsupported point displays a notice rather than a misleading flat zero.

## Scope behaviour

Displayed voltages and CSV values are at the probe tip. A correctly compensated
10x probe therefore shows the same tip voltage as 1x; changing attenuation is
not a way to change the circuit gain. Probe input loading and ground inductance
are not simulated. AC coupling uses an assumed 10 Hz high-pass; the 20 MHz limit
uses a single-pole low-pass. GND coupling grounds the scope input, not the PCB.

Auto mode displays a record even without an edge. Normal mode holds the last
record while waiting. Single waits for an edge and stops after capture. Moving
a probe clears the old acquisition so a trace is never relabelled as another
net. Operating-condition changes while stopped do not replace the held data.
The CSV stores the settings and node identities belonging to that acquisition.

Time cursors appear by clicking twice on the screen; the third click starts a
new pair. They report a time difference, not an inferred physical velocity.

## Ground warning

The SMA outer shield carries the SiPM high-side voltage on this design. It is
not the ground reference used for these plots. The SMA centre has the low-side
DC level plus the pulse. All voltages here are relative to PCB signal ground.
A virtual probe cannot establish the safety of a real earth-referenced scope
connection. Check the actual grounding and instrument ratings first.

## Rebuild the exported data

The source KiCad files are read, never edited. On the development Mac:

```sh
/Applications/KiCad/KiCad.app/Contents/Frameworks/Python.framework/Versions/Current/bin/python3 \
  scripts/export-probe-board.py /path/to/RPi_Hat.kicad_pcb \
  --schematic /path/to/RPi_Hat.kicad_sch

/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli sch export svg \
  --exclude-drawing-sheet --no-background-color --pages 1 \
  --output public/assets/readout-schematic /path/to/RPi_Hat.kicad_sch
```

The exporter uses KiCad's `pcbnew` API and XML netlist export, not text searches
through the schematic. It checks selected component values before running
ngspice. ngspice is currently located at `/opt/homebrew/bin/ngspice`; change
that path in the exporter on a different development machine. Visitors need
neither KiCad nor ngspice. Publishing uses the ordinary static Pages build.

## Files and checks

| File | Responsibility |
| --- | --- |
| `probe-signals.js` | Net identities, analog response, comparator, acquisition and CSV |
| `probe-board.js` | Actual CAD, pad/track selection and probe markers |
| `probe-schematic.js` | Actual SVG schematic, pan/zoom and net aliases |
| `probe-scope.js` | Scope grid, traces, scales and time cursors |
| `probe.js` | UI state, controls and acquisition lifecycle |
| `tests/probe.test.mjs` | Circuit and data-consistency checks |
| `scripts/check-probe-browser.mjs` | Optional desktop/mobile interaction and canvas checks |

Run `npm test`. For browser checks, install the free Playwright package in a
development environment and run `node scripts/check-probe-browser.mjs` while
the local server is running. `PLAYWRIGHT_MODULE`, `CHROME_PATH` and `BENCH_URL`
can point to an existing installation and preview server. Tests check that the
board and scope are nonblank, the view changes, threshold suppression works,
normal/single acquisition behaves correctly, exports work, unsupported nodes
stay honest, and the page makes no cloud-service requests.

Software checks establish implementation consistency, not experimental model
accuracy. Before using the amplitudes or timing in analysis, compare the
model with measured input/output pulses, actual bias calibration and channel
loading. Manufacturer SPICE models and a fuller circuit solve would be the
next improvement; they must not be confused with the present approximation.

## References

- [Hamamatsu S13360-2050VE](https://www.hamamatsu.com/us/en/product/optical-sensors/mppc/mppc_mppc-array/S13360-2050VE.html)
- [TI OPA846](https://www.ti.com/product/OPA846)
- [TI TLV3603](https://www.ti.com/product/TLV3603)
- [TI DAC6578](https://www.ti.com/product/DAC6578)

The source files are included with the project. There is no paid API, cloud
simulator, hosting subscription or account needed to use the bench. The
public GitHub Pages site remains subject to its normal free-service limits.

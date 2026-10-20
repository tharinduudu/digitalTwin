# Working on the display

Start with `node server.mjs`. The server prints the local address. Keep that
terminal running while editing. Refresh the page after changing JavaScript or
HTML. There is no bundler and no generated application code to debug.

## Follow one update through the program

1. `simulation.mjs` generates candidate straight tracks and checks tile hits.
2. `server.mjs` sends track packets and count snapshots over Server-Sent Events.
3. If `DETECTOR_HOST` is set, `detector-source.mjs` supplies the measured count
   records in place of simulated count bins. The track packets remain drawings.
4. `app.js` updates the numbers and gives tracks to `scene.js`.
5. `scene.js` moves each track and checks when its head reaches a tile plane.
6. A tile hit starts a tile flash and the corresponding readout indicator.
   In the transparent view, green bands also follow the fibre to the SiPM.
7. Old track geometry is removed when the particle has left the scene.

The two sources of information are kept separate on purpose. A track drawn
by the browser must never increment a number labelled as a measurement.

## Where to make common changes

- Tile heights: `TILE_HEIGHTS` in `detector-geometry.js`, shared by the scene,
  acceptance overlay, mechanical placement, and simulation. Keep the tile and
  holder recessed within the beams. Width and separation are in `GEOMETRY`.
- Synthetic count rate: `target` in the `Simulation` constructor.
- Room area: `ROOM.width` in `simulation.mjs`. The proposal rate already
  includes the area ratio, so do not add another rate multiplier.
- Acrylic orientation: `ACRYLIC_ANGLE` in `detector-geometry.js`. This turns the
  sheets and lettering together without turning the scintillator or fibre.
- Socket-head screws and T-nuts: `fasteners.js`; mounting positions are in
  `mechanics.js` and `detector-geometry.js`.
- Extrusion corner brackets: `corner-brackets.js`. The same fastener helper
  is used on both bracket legs. Geometry and materials are shared so repeated
  parts can be instanced instead of adding a draw call for every screw.
- Acrylic profile height: `ACRYLIC_OFFSET`. Face opacity is set in `scene.js`;
  edge and cushion materials are in `mechanics.js`. Both liner opacity values
  must also agree with `setCutaway()`.
- Rubber feet and floor height: `RUBBER_FOOT` and `FLOOR_Y` in the geometry module.
- Scintillator opacity: `SCINTILLATOR_OPACITY` in `detector-geometry.js` (0.36).
  Particle flashes temporarily increase it. Acrylic and cushion opacity are separate.
- Top artwork: `ENGRAVING_OPACITY` stays at 0.95 in both tile views.
- U5 housing height: `seatConverter()` in `hardware-adjustments.js` seats the
  exported housing before the readout meshes are merged. It does not edit KiCad.
- Centered enclosure and Pi cable anchors: `readout-placement.js`; plugs and
  cable paths are drawn by `buildPiCables()` in `scene.js`.
- Optical layer thickness: the sheet and cushion extrusions in `mechanics.js`.
- Fibre endpoints and green light: `fibre.js`. Keep the endpoints on the holder
  recess face, and run the fibre tests after changing that position.
- SiPM carrier PCB and rear U.FL: `sipm-mount.js`. Its cable points replace the
  temporary tile lead once the supplied holder and sensor models have loaded.
- Enclosure camera: `setBoxOpen()` in `scene.js`.
- LED pulse duration: the decay in `hardware.js`. This is a display duration,
  not the electrical pulse width.
- Log format: `parseMinuteLog()` and its tests. Confirm the actual acquisition
  program's column order before changing it.
- Status and labels: `app.js`; layout and colours: `styles.css`.

## Useful checks

```sh
node --test tests/*.test.mjs
```

In the browser console, `window.exhibition.status()` gives a read-only summary
of loaded models, active tracks, draw calls, and memory counts.
`window.exhibition.snapshot()` shows the last received record. The server also
has a read-only `/api/snapshot` endpoint.

For a UI check, test the room field, all pair buttons, acceptance on/off, lid
open/closed, wrapped/transparent tiles, pause, rotation, camera reset, and a
narrow phone layout. Check the console for missing assets. After changing a
large CAD file, watch draw calls and memory as well as its appearance.

## If something goes wrong

**No measured data:** try ordinary SSH first, then check `DETECTOR_LOG_DIR`.
The display cannot ask for a password inside its background SSH read. Use a
key or the reusable SSH connection described in the README. Do not put a
password in the code.

**Old counts:** check the displayed file interval. A successful SSH connection
does not prove the acquisition is still writing new records. The application
marks records more than 150 seconds old as stale.

**Missing PCB or Pi:** look at the CAD caption and browser console. Check the
two GLB files in `public/assets`. A failed model load does not stop the count
display.

**Slow animation:** keep hardware acceleration enabled, use fewer unrelated
room tracks, and check the CAD draw-call count. The Pi CAD starts with thousands
of bodies, which is why it is merged by material after loading. Do not remove
the coincidence tracks to make an unrelated background field busier.

**A new PCB export moves an LED:** check D2/D3/D4 in the CAD. If the designators
changed, update the indicator list in `hardware.js` rather than adding an
arbitrary offset until it looks right.

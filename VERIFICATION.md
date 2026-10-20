# Exhibition display checks

Checked locally on 20 October 2026.

## Automated tests

All 15 Node tests pass. They cover the simulation rate near 230/min per
adjacent pair, track intersections, misses and single hits, completed bins,
reproducible IDs, log column order, partial lines, stale data, square-pyramid
boundaries, fibre endpoints, green light, mounting holes, GPIO placement,
and the SMA cable route.

The fibre endpoints lie on the sensor face inside the supplied holder. The
path stays within the 20 x 20 cm tile. These are geometry checks, not an
optical-efficiency measurement.

## Browser and CAD checks

- The supplied frame, tile, holder, acrylic, liner, and enclosure load.
- Acrylic and engraving are rotated 90 degrees relative to the tile.
- Green light follows the fibre. The placeholder box and exposed green lead
  outside the tile corner have been removed.
- Room tracks include misses and tile crossings. The acceptance toggle shows
  the labelled square pyramid from the lower selected tile's centre.
- Opening the cover loads the actual readout and Pi 5 CAD without browser
  warnings or errors in the final check.
- The Pi uses the enclosure's four 49 x 58 mm mounting points. Its PCB underside
  sits at the 4.9 mm standoff height. The readout is placed from the Pi header,
  not from an independent board-centre estimate. This is not a full mechanical
  clearance check.
- Three SMA leads emerge from the vertical beam beside J3/J4/J5. No signal
  cable loops behind the enclosure. J6 remains capped.
- All three illustrative LED flash counters advance. Their markers are red.
- Wrapped/transparent tiles, acceptance, and cover controls work.
- Desktop and 390 x 844 phone screenshots show a nonblank scene. Scene-region
  pixel standard deviations were 47.3 and 46.3 respectively. Successive desktop
  captures changed more than 200,000 pixels in the checked region.
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

Only minute totals are measured. Tracks, green light, and LED timing remain
illustrations. The acceptance shape is geometric, not particle transport.

The server listens on localhost, port 8791. Rendering is capped near 30 frames/s,
and static CAD bodies are merged by appearance. Sustained performance on the
exhibition Pi has not been measured. Runtime assets are local, but full
airplane-mode operation has not been separately tested.

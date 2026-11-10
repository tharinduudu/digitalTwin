import test from 'node:test';
import assert from 'node:assert/strict';
import { guidedMuon } from '../public/guided-muon.js';
import { TILE_HEIGHTS } from '../public/detector-geometry.js';

test('the guided example crosses the actual three tile volumes and counts one triple', () => {
  const event = guidedMuon();
  assert.deepEqual(event.hits, [true, true, true]);
  assert.deepEqual(event.pairs, { c01: 1, c12: 1, c02: 1 });
  assert.equal(event.crossings.length, 3);
  for (const crossing of event.crossings) {
    assert.ok(Math.abs(crossing.point[1] - TILE_HEIGHTS[crossing.index]) <= 0.500001);
    assert.ok(crossing.depositedMeV > 0);
  }
  const elapsed = event.crossings[2].timeNs - event.crossings[0].timeNs;
  assert.ok(elapsed > 0.86 && elapsed < 0.89);
});

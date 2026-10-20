import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, sampleTrack, pairsFor, randomGenerator, ROOM } from '../simulation.mjs';

test('straight tracks crossing both outside tiles always cross the middle', () => {
  const random = randomGenerator(123);
  for (let i = 0; i < 100000; i++) {
    const pairs = pairsFor(sampleTrack(random));
    assert.ok(pairs.c02 <= pairs.c01 && pairs.c02 <= pairs.c12);
  }
});
test('adjacent pairs average close to the requested 230 per minute', () => {
  const now = Date.UTC(2026, 9, 20, 12, 0);
  const simulation = new Simulation({ now });
  const sum = { c01: 0, c12: 0 };
  for (let i = 1; i <= 240; i++) {
    simulation.advance(now + i * 60000);
    const last = simulation.snapshot().last;
    assert.equal(last.unique, last.c01 + last.c12 - last.c02);
    sum.c01 += last.c01;
    sum.c12 += last.c12;
  }
  for (const total of Object.values(sum)) assert.ok(Math.abs(total / 240 - 230) < 6);
});
test('minute bins are complete, ordered, and bounded to fifteen', () => {
  const now = Date.UTC(2026, 9, 20, 12, 0, 20);
  const simulation = new Simulation({ now });
  const state = simulation.snapshot(now);
  assert.equal(state.history.length, 15);
  assert.equal(state.last.end, state.current.start);
  assert.ok(state.last.end <= now);
  assert.equal(state.current.end - state.current.start, 60000);
  assert.equal(state.source, 'simulation');
});
test('simulation is reproducible and track events have unique IDs', () => {
  const now = Date.UTC(2026, 9, 20, 12, 0, 20);
  const a = new Simulation({ now });
  const b = new Simulation({ now });
  assert.deepEqual(a.snapshot(now), b.snapshot(now));
  const events = a.advance(now + 4000);
  assert.equal(new Set(events.map(x => x.id)).size, events.length);
  assert.ok(events.some(x => !x.hits.some(Boolean)));
  assert.ok(events.some(x => x.hits.some(Boolean)));
});
test('room tracks include misses and single hits without creating coincidences', () => {
  const random = randomGenerator(982);
  let misses = 0, singles = 0;
  for (let i = 0; i < 10000; i++) {
    const track = sampleTrack(random, ROOM.width);
    const hits = track.hits.filter(Boolean).length;
    if (!hits) misses++;
    if (hits === 1) {
      singles++;
      assert.deepEqual(pairsFor(track), { c01: 0, c12: 0, c02: 0 });
    }
  }
  assert.ok(misses > 8000);
  assert.ok(singles > 0);
});

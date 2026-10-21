import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, pairsFor, randomGenerator } from '../simulation.mjs';
import { MuonSource } from '../public/muon-source.js';
import { traceMuon } from '../public/muon-transport.js';

test('unscattered tracks through both outside convex tiles also cross the middle', () => {
  const source = new MuonSource({ room: { width: 30, top: 28, bottom: -34 } });
  const random = randomGenerator(123);
  for (let i = 0; i < 10000; i++) {
    const track = traceMuon(source.sample(random), random, { room: source.room, scatter: false, decay: false });
    const pairs = pairsFor(track);
    assert.ok(pairs.c02 <= pairs.c01 && pairs.c02 <= pairs.c12);
  }
});

test('counts come from the absolute source rate, not a 230/min target', () => {
  const now = Date.UTC(2026, 9, 20, 12, 0);
  const simulation = new Simulation({ now });
  assert.equal(simulation.snapshot(now).target, undefined);
  assert.equal(simulation.proposalRate, simulation.source.ratePerSecond);
  const counts = [];
  for (let i = 1; i <= 90; i++) {
    simulation.advance(now + i * 60000);
    const last = simulation.snapshot(now + i * 60000).last;
    assert.equal(last.unique, last.c01 + last.c12 + last.c02 - 2 * last.triple);
    assert.ok(last.c01 <= Math.min(last.singles[0], last.singles[1]));
    assert.ok(last.c12 <= Math.min(last.singles[1], last.singles[2]));
    counts.push(last.c01);
  }
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  const variance = counts.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (counts.length - 1);
  assert.ok(variance / mean > 0.55 && variance / mean < 1.6);
});

test('minute bins are complete, ordered, and bounded to fifteen', () => {
  const now = Date.UTC(2026, 9, 20, 12, 0, 20);
  const state = new Simulation({ now }).snapshot(now);
  assert.equal(state.history.length, 15);
  assert.equal(state.last.end, state.current.start);
  assert.ok(state.last.end <= now);
  assert.equal(state.current.end - state.current.start, 60000);
  assert.equal(state.source, 'simulation');
});

test('simulation is reproducible and emitted track IDs are unique', () => {
  const now = Date.UTC(2026, 9, 20, 12, 0, 20);
  const a = new Simulation({ now });
  const b = new Simulation({ now });
  assert.deepEqual(a.snapshot(now), b.snapshot(now));
  const events = a.advance(now + 4000);
  assert.equal(new Set(events.map(x => x.id)).size, events.length);
  assert.ok(events.some(x => !x.hits.some(Boolean)));
  assert.ok(events.some(x => x.hits.some(Boolean)));
  assert.ok(events.every(x => x.path.length >= 2 && x.durationNs > 0));
});

test('pair accounting handles every hit pattern without assuming a triple', () => {
  for (let mask = 0; mask < 8; mask++) {
    const hits = [0, 1, 2].map(i => !!(mask & (1 << i)));
    const pairs = pairsFor({ hits });
    assert.equal(pairs.c01, Number(hits[0] && hits[1]));
    assert.equal(pairs.c12, Number(hits[1] && hits[2]));
    assert.equal(pairs.c02, Number(hits[0] && hits[2]));
  }
});

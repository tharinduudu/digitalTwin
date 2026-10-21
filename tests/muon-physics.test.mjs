import test from 'node:test';
import assert from 'node:assert/strict';
import { MuonSource, differentialFlux, effectiveCosine, ROOM } from '../public/muon-source.js';
import { traceMuon, tileIntersection, beta, csdaRange, energyAtRange,
  scatteringRms, pointAtTime, MUON } from '../public/muon-transport.js';
import { randomGenerator, pairsFor } from '../public/simulation.js';

test('Guan formula agrees with reference evaluations and curvature endpoints', () => {
  assert.ok(Math.abs(effectiveCosine(1) - 1) < 1e-12);
  assert.ok(Math.abs(effectiveCosine(0) - 0.10345827692375463) < 1e-10);
  assert.ok(Math.abs(differentialFlux(1, 1) - 0.002319634065544143) < 1e-14);
  assert.equal(differentialFlux(-1, 0.8), 0);
  assert.ok(differentialFlux(4, 1) > differentialFlux(4, 0.2));
});

test('source normalization converges when energy and angular grids are doubled', () => {
  const base = new MuonSource();
  const fine = new MuonSource({ energyBins: 320, cosineBins: 192 });
  assert.ok(Math.abs(base.horizontalFlux / fine.horizontalFlux - 1) < 0.001);
  assert.ok(Math.abs(base.ratePerSecond / fine.ratePerSecond - 1) < 0.001);
});

test('constant intensity recovers the analytic downward flux through a box', () => {
  const source = new MuonSource({ flux: () => 1, minGeV: 1, maxGeV: 2 });
  const w = ROOM.width, h = ROOM.top - ROOM.bottom;
  const analytic = Math.PI * (w * w + 2 * w * h);
  assert.ok(Math.abs(source.ratePerSecond / analytic - 1) < 0.001);
  assert.ok(Math.abs(source.horizontalFlux / Math.PI - 1) < 0.001);
});

test('generated entries point into their chosen face; top arrivals have the projected angular law', () => {
  const source = new MuonSource({ flux: () => 1, minGeV: 1, maxGeV: 2 });
  const random = randomGenerator(154);
  let totalCosine = 0, top = 0;
  for (let i = 0; i < 50000; i++) {
    const p = source.sample(random);
    assert.ok(Math.abs(Math.hypot(...p.direction) - 1) < 1e-12);
    assert.ok(p.direction[1] < 0 && p.energyGeV >= 1 && p.energyGeV <= 2);
    if (p.face === 'top') {
      assert.equal(p.origin[1], ROOM.top);
      totalCosine += p.cosine; top++;
    } else if (p.face === 'x') assert.ok(p.origin[0] * p.direction[0] < 0);
    else assert.ok(p.origin[2] * p.direction[2] < 0);
  }
  assert.ok(Math.abs(totalCosine / top - 2 / 3) < 0.008);
});

test('the generation-box size does not set the detector coincidence rate', () => {
  const estimates = [];
  const n = 80000;
  for (const width of [40, 120]) {
    const source = new MuonSource({ room: { ...ROOM, width } });
    const random = randomGenerator(width + 871);
    let accepted = 0;
    for (let i = 0; i < n; i++) {
      accepted += pairsFor(traceMuon(source.sample(random), random,
        { room: source.room, scatter: false, decay: false })).c01;
    }
    const fraction = accepted / n;
    estimates.push({ rate: fraction * source.ratePerSecond,
      variance: fraction * (1 - fraction) / n * source.ratePerSecond ** 2 });
  }
  assert.ok(Math.abs(estimates[0].rate - estimates[1].rate)
    < 6 * Math.sqrt(estimates[0].variance + estimates[1].variance));
});

test('finite tile intersections include side entries and exclude the cut corner', () => {
  assert.equal(tileIntersection([-9, 28, 9], [0, -1, 0], 0), null);
  const side = tileIntersection([-15, 12.05, 0], [1, 0, 0], 0);
  assert.equal(side.enter, 5);
  assert.equal(side.exit, 25);
  const vertical = tileIntersection([0, 28, 0], [0, -1, 0], 0);
  assert.ok(Math.abs(vertical.exit - vertical.enter - 1) < 1e-12);
});

test('PDG CSDA range interpolation is invertible and energy cannot increase', () => {
  for (const energy of [10, 100, 1000, 4000, 1000000]) {
    assert.ok(Math.abs(energyAtRange(csdaRange(energy)) / energy - 1) < 1e-10);
  }
  const track = traceMuon({ origin: [0, 28, 0], direction: [0, -1, 0], energyGeV: 4 },
    () => 0.5, { scatter: false, decay: false });
  assert.deepEqual(track.hits, [true, true, true]);
  assert.deepEqual(track.crossings.map(hit => hit.index), [0, 1, 2]);
  const loss = track.crossings.reduce((sum, hit) => sum + hit.depositedMeV, 0);
  assert.ok(Math.abs(loss + track.crossings.at(-1).energyOutMeV - 4000) < 1e-8);
  for (const hit of track.crossings) {
    assert.ok(hit.pathCm > 0 && hit.energyOutMeV < hit.energyInMeV);
    assert.ok(hit.depositedMeV > 1.8 && hit.depositedMeV < 3);
  }
  const flight = track.crossings[1].timeNs - track.crossings[0].timeNs;
  assert.ok(flight > 13 / MUON.cCmPerNs && flight < 0.44);
});

test('a low-energy muon stops instead of passing through every tile', () => {
  const track = traceMuon({ origin: [0, 28, 0], direction: [0, -1, 0], energyGeV: 0.01 },
    () => 0.5, { scatter: false, decay: false });
  assert.equal(track.termination, 'stopped');
  assert.deepEqual(track.hits, [true, false, false]);
  assert.ok(track.crossings[0].pathCm < 1);
  assert.ok(Math.abs(track.crossings[0].depositedMeV - 10) < 1e-6);
});

test('relativistic speed and proper lifetime are used, not a fixed vertical speed', () => {
  assert.ok(beta(100) < beta(4000) && beta(4000) < 1);
  const track = traceMuon({ origin: [0, 28, 0], direction: [0, -1, 0], energyGeV: 0.1 },
    () => 0.999999999, { scatter: false });
  assert.equal(track.termination, 'decayed');
  assert.deepEqual(track.hits, [false, false, false]);
  assert.ok(track.durationNs > 0);
  assert.deepEqual(pointAtTime(track.path, 0), track.origin);
  assert.deepEqual(pointAtTime(track.path, track.durationNs), track.path.at(-1).position);
});

test('Gaussian scattering is smaller at high momentum and grows with thickness', () => {
  assert.ok(scatteringRms(100, 0.025) > scatteringRms(4000, 0.025));
  assert.ok(scatteringRms(4000, 0.1) > scatteringRms(4000, 0.025));
  assert.equal(scatteringRms(4000, 0), 0);
  const random = randomGenerator(109);
  const a = traceMuon({ origin: [0, 28, 0], direction: [0, -1, 0], energyGeV: 1 }, random, { decay: false });
  assert.ok(a.crossings.length > 1);
  assert.ok(Math.hypot(a.crossings[1].entry[0], a.crossings[1].entry[2]) > 0);
  for (let i = 1; i < a.path.length; i++) {
    const previous = a.path[i - 1], next = a.path[i];
    const distance = Math.hypot(...next.position.map((value, j) => value - previous.position[j]));
    assert.ok(distance <= (next.timeNs - previous.timeNs) * MUON.cCmPerNs + 1e-6);
  }
});

import { TILE_HEIGHTS, TILE_THICKNESS, TILE_OUTLINE } from './detector-geometry.js';
import { MuonSource, ROOM, SOURCE } from './muon-source.js';
import { traceMuon } from './muon-transport.js';
export { ROOM } from './muon-source.js';

export function randomGenerator(seed = 20261020) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let x = state;
    x = Math.imul(x ^ x >>> 15, x | 1);
    x ^= x + Math.imul(x ^ x >>> 7, x | 61);
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
  };
}

export const GEOMETRY = { width: 20, spacing: 13, thickness: TILE_THICKNESS,
  heights: TILE_HEIGHTS, outline: TILE_OUTLINE };
export function pairsFor(track) {
  const [a, b, c] = track.hits;
  return { c01: Number(a && b), c12: Number(b && c), c02: Number(a && c) };
}
const emptyCounts = () => ({ c01: 0, c12: 0, c02: 0, triple: 0,
  unique: 0, singles: [0, 0, 0], room: 0 });

export class Simulation {
  constructor({ now = Date.now(), seed = 20261020, source = new MuonSource() } = {}) {
    this.random = randomGenerator(seed);
    this.displayRandom = randomGenerator(seed ^ 0x7239);
    this.source = source;
    this.proposalRate = source.ratePerSecond;
    this.history = [];
    this.minute = Math.floor(now / 60000) * 60000 - 15 * 60000;
    this.counts = emptyCounts();
    this.sequence = 0;
    this.recent = [];
    this.next = this.minute + this.waitingTime();
    this.advance(now);
  }

  waitingTime() {
    return -Math.log(Math.max(1e-12, 1 - this.random())) / this.proposalRate * 1000;
  }

  rollTo(time) {
    while (time >= this.minute + 60000) {
      this.history.push({ start: this.minute, end: this.minute + 60000, ...this.counts });
      this.history = this.history.slice(-15);
      this.minute += 60000;
      this.counts = emptyCounts();
    }
  }

  advance(now) {
    const emitted = [];
    while (this.next <= now) {
      this.rollTo(this.next);
      const particle = this.source.sample(this.random);
      const track = traceMuon(particle, this.random, { room: this.source.room });
      const pairs = pairsFor(track);
      this.counts.room++;
      track.hits.forEach((hit, i) => { if (hit) this.counts.singles[i]++; });
      for (const key of ['c01', 'c12', 'c02']) this.counts[key] += pairs[key];
      if (track.hits.every(Boolean)) this.counts.triple++;
      if (pairs.c01 || pairs.c12 || pairs.c02) this.counts.unique++;
      // Count the complete generated flux. Thin only the unrelated room tracks
      // for drawing, using a separate RNG so display density cannot alter rates.
      if (track.hits.some(Boolean) || this.displayRandom() < ROOM.displayedMissesPerSecond / this.proposalRate) {
        const event = { ...track, id: ++this.sequence, at: this.next, pairs };
        if (now - this.next < 5000) {
          emitted.push(event);
          this.recent.push(event);
        }
      }
      this.next += this.waitingTime();
    }
    this.rollTo(now);
    this.recent = this.recent.filter(event => now - event.at < 5000);
    return emitted;
  }

  snapshot(now = Date.now()) {
    return {
      source: 'simulation', status: 'simulation', now,
      model: { ...SOURCE, horizontalFluxPerCm2Minute: this.source.horizontalFlux * 60,
        boundaryRatePerSecond: this.proposalRate, idealDetection: true,
        material: 'polystyrene', scattering: 'Gaussian thin-slab approximation',
        environment: 'sea-level open sky; no building or passive housing transport' },
      geometry: GEOMETRY, room: this.source.room, history: this.history, last: this.history.at(-1),
      current: { start: this.minute, end: this.minute + 60000, ...this.counts },
      events: this.recent, sequence: this.sequence,
    };
  }
}

// A geometric demonstration, not a transport or detector-efficiency calculation.
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

export const GEOMETRY = { width: 20, spacing: 13, thickness: 1, heights: [13, 0, -13] };
export const ROOM = { width: 120, displayedMissesPerSecond: 40 };
const inside = (x, z) => Math.abs(x) <= 10 && Math.abs(z) <= 10;

export function sampleTrack(random, width = GEOMETRY.width) {
  const x = width * (random() - 0.5);
  const z = width * (random() - 0.5);
  // Assumed I(theta) proportional to cos^2(theta). The horizontal-area
  // projection adds another cos(theta), giving cos(theta) = U^(1/4).
  const cosine = Math.max(1e-8, random()) ** 0.25;
  const tangent = Math.sqrt(1 - cosine * cosine) / cosine;
  const phi = 2 * Math.PI * random();
  const dx = tangent * Math.cos(phi);
  const dz = tangent * Math.sin(phi);
  const hits = GEOMETRY.heights.map(y => inside(x - y * dx, z - y * dz));
  return { x, z, dx, dz, hits };
}

export function pairsFor(track) {
  const [a, b, c] = track.hits;
  return { c01: Number(a && b), c12: Number(b && c), c02: Number(a && c) };
}

const emptyCounts = () => ({ c01: 0, c12: 0, c02: 0, unique: 0, singles: [0, 0, 0], room: 0 });

export class Simulation {
  constructor({ now = Date.now(), target = 230, seed = 20261020 } = {}) {
    this.random = randomGenerator(seed);
    this.displayRandom = randomGenerator(seed ^ 0x7239);
    this.target = target;
    // Estimate acceptance once with a separate seed, without biasing the run.
    const calibration = randomGenerator(91723);
    let accepted = 0;
    const trials = 40000;
    for (let i = 0; i < trials; i++) accepted += pairsFor(sampleTrack(calibration)).c01;
    this.proposalRate = target / 60 / (accepted / trials) * (ROOM.width / GEOMETRY.width) ** 2;
    this.history = [];
    this.minute = Math.floor(now / 60000) * 60000 - 15 * 60000;
    this.counts = emptyCounts();
    this.sequence = 0;
    this.recent = [];
    this.next = this.minute;
    this.advance(now);
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
      const track = sampleTrack(this.random, ROOM.width);
      const pairs = pairsFor(track);
      this.counts.room++;
      track.hits.forEach((hit, i) => { if (hit) this.counts.singles[i]++; });
      for (const key of ['c01', 'c12', 'c02']) this.counts[key] += pairs[key];
      if (pairs.c01 || pairs.c12 || pairs.c02) this.counts.unique++;
      // Every tile hit is shown. Only unrelated room tracks are thinned for display;
      // this choice never changes the detector's coincidence counters.
      if (track.hits.some(Boolean) || this.displayRandom() < ROOM.displayedMissesPerSecond / this.proposalRate) {
        const event = { ...track, id: ++this.sequence, at: this.next, pairs };
        if (now - this.next < 2500) {
          emitted.push(event);
          this.recent.push(event);
        }
      }
      this.next += -Math.log(Math.max(1e-10, 1 - this.random())) / this.proposalRate * 1000;
    }
    this.rollTo(now);
    this.recent = this.recent.filter(event => now - event.at < 2500);
    return emitted;
  }

  snapshot(now = Date.now()) {
    return {
      source: 'simulation', status: 'simulation', now, target: this.target,
      geometry: GEOMETRY, room: ROOM, history: this.history, last: this.history.at(-1),
      current: { start: this.minute, end: this.minute + 60000, ...this.counts },
      events: this.recent, sequence: this.sequence,
    };
  }
}

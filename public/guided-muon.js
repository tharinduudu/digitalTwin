import { MuonSource } from './muon-source.js';
import { traceMuon } from './muon-transport.js';
import { pairsFor, randomGenerator } from './simulation.js';

let source;
const examples = new Map();

// Select an oblique triple from the same sea-level sky as the detector.
// Holding the seed lets every step of the lesson follow the same event.
export function guidedMuon(seed = 1) {
  if (!examples.has(seed)) {
    source ??= new MuonSource();
    const random = randomGenerator(seed);
    while (true) {
      const particle = source.sample(random);
      const zenithDeg = Math.acos(particle.cosine) * 180 / Math.PI;
      if (zenithDeg < 15 || zenithDeg > 34) continue;
      const track = traceMuon(particle, random, { room: source.room });
      if (!track.hits.every(Boolean)) continue;
      examples.set(seed, { ...track, zenithDeg, pairs: pairsFor(track) });
      break;
    }
  }
  return { ...examples.get(seed), id: seed, at: Date.now() };
}

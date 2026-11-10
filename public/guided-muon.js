import { traceMuon } from './muon-transport.js';
import { pairsFor } from './simulation.js';

// A deliberate central example, transported by the same physics as the full twin.
// Disable stochastic decay/scattering to keep every replay identical and explanatory.
export function guidedMuon() {
  const track = traceMuon({ origin: [0, 27, 0], direction: [0, -1, 0], energyGeV: 4 }, () => 0.5,
    { scatter: false, decay: false });
  return { ...track, id: 1, at: Date.now(), pairs: pairsFor(track) };
}

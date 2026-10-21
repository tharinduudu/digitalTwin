import { writeFile } from 'node:fs/promises';
import { Simulation } from '../public/simulation.js';
import { MuonSource, differentialFlux } from '../public/muon-source.js';

const start = Date.UTC(2026, 9, 20, 12, 0);
const minutes = 600;
const simulation = new Simulation({ now: start, seed: 487115 });
const rows = [];
for (let i = 1; i <= minutes; i++) {
  simulation.advance(start + i * 60000);
  rows.push(simulation.snapshot(start + i * 60000).last);
}
const rate = key => {
  const total = rows.reduce((sum, row) => sum + row[key], 0);
  const mean = total / minutes;
  const variance = rows.reduce((sum, row) => sum + (row[key] - mean) ** 2, 0) / (minutes - 1);
  return { perMinute: mean, statisticalSem: Math.sqrt(total) / minutes, fano: variance / mean };
};
const fine = new MuonSource({ energyBins: 320, cosineBins: 192 });
const report = {
  model: simulation.snapshot(start).model, simulatedMinutes: minutes,
  seed: 487115, counts: Object.fromEntries(['c01', 'c12', 'c02', 'triple'].map(key => [key, rate(key)])),
  sourceConvergence: {
    relativeHorizontalFluxChange: simulation.source.horizontalFlux / fine.horizontalFlux - 1,
    relativeBoundaryRateChange: simulation.proposalRate / fine.ratePerSecond - 1 },
  spectrum: Array.from({ length: 120 }, (_, i) => {
    const energyGeV = 0.1 * 100000 ** (i / 119);
    return { energyGeV, intensity: [0, 45, 75].map(degrees =>
      differentialFlux(energyGeV, Math.cos(degrees * Math.PI / 180))) };
  }),
  note: 'Statistical errors describe the Monte Carlo only, not source-model or detector-response uncertainty.'
};
await writeFile(new URL('../docs/physics-validation.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ counts: report.counts, convergence: report.sourceConvergence }, null, 2));

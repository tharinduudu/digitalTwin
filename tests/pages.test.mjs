import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { Simulation as BrowserSimulation } from '../public/simulation.js';
import { Simulation as ServerSimulation } from '../simulation.mjs';

test('public and local demonstrations share the tested simulation', () => {
  assert.equal(BrowserSimulation, ServerSimulation);
  const state = new BrowserSimulation({ now: 6000000 }).snapshot(6000000);
  assert.equal(state.source, 'simulation');
  assert.equal(state.target, undefined);
  assert.equal(state.model.name, 'Guan et al. sea-level muons');
  assert.equal(state.history.length, 15);
});

test('browser entry points work beneath a GitHub project path', async () => {
  const root = new URL('../public/', import.meta.url);
  const names = (await readdir(root)).filter(name => /\.(html|js)$/.test(name));
  for (const name of names) {
    const source = await readFile(new URL(name, root), 'utf8');
    assert.doesNotMatch(source, /["'`]\/(?:assets|vendor|app\.js|styles\.css|api)\b/, name);
  }
});

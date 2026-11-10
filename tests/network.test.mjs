import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { decodeSnapshot, filterStations, groupLocations, networkTotals, statusKey } from '../public/network-data.js';

const snapshot = JSON.parse(await readFile(new URL('../public/assets/network-snapshot.json', import.meta.url), 'utf8'));
const stations = decodeSnapshot(snapshot);

test('the saved network summary retains all 36 public detector IDs', () => {
  assert.equal(stations.length, 36);
  assert.equal(new Set(stations.map(s => s.id)).size, 36);
  assert.deepEqual(networkTotals(stations), { records: 36, countries: 11, recent: 19, available: 31 });
  assert.equal(stations.filter(s => s.sourceCountry === 'USA').length, 3);
  assert.equal(stations.filter(s => s.sourceCountry === 'United States').length, 9);
});

test('status uses the portal assessment, not a guessed heartbeat or local time zone', () => {
  assert.equal(statusKey({ running: 'Running', stability: 'Check stability' }), 'review');
  assert.equal(statusKey({ running: 'Not recent', latest: '2026-01-01 00:00:00' }), 'older');
  const chara = stations.find(s => s.id === 'usa_MountWilson_1');
  assert.equal(chara.status, 'missing');
  assert.equal(chara.stability, 'Stable');
  assert.equal(chara.observations, 666531);
  assert.ok(chara.notes.length);
  assert.equal(chara.latest, null);
  assert.equal(stations.find(s => s.id === 'Japan_Nara_1').latest, '2026-11-05 17:59:56');
  assert.ok(snapshot.timestampNote.includes('not been converted to UTC'));
});

test('source metadata conflicts stay visible and aliases are not merged', () => {
  const singapore = stations.find(s => s.id === 'Singapore_BrasBasah_1');
  assert.equal(singapore.city, 'Santa Marta');
  assert.equal(singapore.latitude, 1.296498);
  assert.match(singapore.notes.join(' '), /Bras Basah/);
  assert.equal(filterStations(stations, { query: 'Colombo' }).length, 4);
  const colombo = stations.find(s => s.id === 'Sri_Lanka_Colombo_Detector1_West');
  assert.match(colombo.notes.join(' '), /opposite/);
  assert.equal(new URL(colombo.portalUrl).searchParams.get('site'), 'University of Colombo Detector1-East');
});

test('map grouping never discards a station and filtering searches IDs too', () => {
  const grouped = groupLocations(stations);
  assert.equal(grouped.flatMap(g => g.stations).length, stations.length);
  assert.equal(filterStations(stations, { country: 'United States' }).length, 12);
  assert.equal(filterStations(stations, { status: 'review' }).length, 2);
  assert.equal(filterStations(stations, { query: 'GSU_Atlanta_Baseline' })[0].name, 'GSU SA415 Baseline');
  assert.equal(filterStations(stations, { query: 'not a real detector' }).length, 0);
});

test('bad snapshots fail rather than plotting unknown positions or duplicate detectors', () => {
  assert.throws(() => decodeSnapshot({ schemaVersion: 2 }), /Unsupported/);
  assert.throws(() => decodeSnapshot({ ...snapshot, rows: [snapshot.rows[0], snapshot.rows[0]] }), /Duplicate/);
  const bad = [...snapshot.rows[0]];
  bad[11] = 95;
  assert.throws(() => decodeSnapshot({ ...snapshot, rows: [bad] }), /Invalid location/);
});

test('the network stays static-host compatible and identifies its snapshot', async () => {
  const html = await readFile(new URL('../public/network.html', import.meta.url), 'utf8');
  const build = await readFile(new URL('../scripts/build-pages.mjs', import.meta.url), 'utf8');
  assert.match(build, /'network.html'/);
  assert.match(html, /not live telemetry/);
  assert.match(html, /not a verified model of this station/);
  assert.equal(stations.filter(s => s.portalUrl !== snapshot.sourceUrl).length, 32);
  for (const s of stations) assert.equal(new URL(s.portalUrl).hostname, 'cosmic.gsu.edu');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMinuteLog, DetectorSource } from '../detector-source.mjs';
import { acceptanceProfile, acceptedFromCentre } from '../public/acceptance.js';

test('detector column order is 01, 02, 12, triple, singles', () => {
  const [record] = parseMinuteLog('235, 97, 208, 0, 5623, 6701, 6209, Tue Oct 20 14:30:51 2026\n');
  assert.equal(record.c01, 235);
  assert.equal(record.c02, 97);
  assert.equal(record.c12, 208);
  assert.deepEqual(record.singles, [5623, 6701, 6209]);
  assert.equal(new Date(record.end).toISOString(), '2026-10-20T18:30:51.000Z');
  assert.equal(record.end-record.start, 60000);
});
test('partial and malformed lines are not treated as measurements', () => {
  assert.equal(parseMinuteLog('1, 2, 3, 4, 5, 6, 7, Tue Oct 20 14:30:51 2026').length, 0);
  assert.equal(parseMinuteLog('garbage\n-1, 2, 3, 4, 5, 6, 7, Tue Oct 20 14:30:51 2026\n').length, 0);
});
test('live source does not substitute simulated counts while unavailable', () => {
  const source = new DetectorSource('example');
  const snapshot = source.snapshot({ last: { c01: 230 }, history: [{ c01: 230 }], events: [] });
  assert.equal(snapshot.source, 'detector');
  assert.equal(snapshot.last, undefined);
  assert.deepEqual(snapshot.history, []);
  assert.equal(snapshot.status, 'loading');
  assert.equal(snapshot.detector.ageSeconds, null);
});
test('source holds measured counts when a record becomes stale or a read fails', () => {
  const source = new DetectorSource('example');
  source.history = [{ end: 1000000, c01: 211 }];
  assert.equal(source.snapshot({}, 1100000).status, 'live');
  assert.equal(source.snapshot({}, 1200000).status, 'stale');
  source.error = 'Detector read unavailable';
  const snapshot = source.snapshot({ last: { c01: 999 } }, 1200000);
  assert.equal(snapshot.status, 'offline');
  assert.equal(snapshot.last.c01, 211);
});
test('cut-corner acceptance is defined from an explicit lower-tile centre', () => {
  assert.equal(acceptanceProfile().lower, -13.95);
  assert.equal(acceptanceProfile().upper, 12.05);
  assert.equal(acceptedFromCentre(10/26, 10/26), true);
  assert.equal(acceptedFromCentre(-10/26, 10/26), false);
  assert.equal(acceptedFromCentre(10.01/26, 0), false);
  assert.equal(acceptedFromCentre(10/13, 0, 'c01'), true);
});

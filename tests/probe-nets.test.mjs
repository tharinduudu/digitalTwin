import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { netOnFace } from '../public/probe-nets.js';

const data = JSON.parse(await readFile(new URL('../public/assets/probe-board.json', import.meta.url), 'utf8'));

test('net highlights include every pad and trace on the viewed face, but no neighbouring net', () => {
  for (const net of new Set(data.pads.map(pad => pad.net))) {
    for (const side of ['front', 'back']) {
      const selected = netOnFace(data, net, side);
      assert.deepEqual(selected.pads, data.pads.filter(pad => pad.net === net && pad[side]));
      assert.deepEqual(selected.tracks, data.tracks.filter(track => track.net === net && track.front === (side === 'front')));
    }
  }
});

test('unassigned probes have no highlighted geometry', () => {
  assert.deepEqual(netOnFace(data, undefined, 'front'), { pads: [], tracks: [] });
});

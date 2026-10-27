import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutProbeLabels } from '../public/probe-labels.js';

function checkClearance(points, width, height) {
  const layout = layoutProbeLabels(points, width, height);
  for (const item of layout.filter(Boolean)) {
    assert.ok(item.box.x >= 0 && item.box.x + item.box.width <= width);
    assert.ok(item.box.y >= 0 && item.box.y + item.box.height <= height);
    for (const point of points.filter(Boolean)) {
      const inside = point.x >= item.box.x - 12 && point.x <= item.box.x + item.box.width + 12
        && point.y >= item.box.y - 12 && point.y <= item.box.y + item.box.height + 12;
      assert.equal(inside, false, JSON.stringify({ point, item }));
    }
    assert.ok(Math.abs(Math.hypot(item.end.x - item.target.x, item.end.y - item.target.y) - 7) < 1e-8);
    assert.match(item.path, /^M .* L .* L /);
  }
  const [a, b] = layout;
  if (a && b) assert.ok(a.box.x + a.box.width <= b.box.x || b.box.x + b.box.width <= a.box.x
    || a.box.y + a.box.height <= b.box.y || b.box.y + b.box.height <= a.box.y);
  return layout;
}

test('probe arrow labels stay clear of both tips on desktop and phone viewports', () => {
  for (const width of [338, 370, 687, 900]) {
    const height = 370;
    checkClearance([{ x: width * 0.3, y: 280 }, { x: width * 0.31, y: 240 }], width, height);
    checkClearance([{ x: width * 0.7, y: 40 }, { x: width * 0.72, y: 46 }], width, height);
    checkClearance([{ x: 18, y: 20 }, { x: width - 18, y: height - 20 }], width, height);
  }
});

test('two probes on the same pad get separate labels and a common target', () => {
  const layout = checkClearance([{ x: 180, y: 220 }, { x: 180, y: 220 }], 360, 370);
  assert.deepEqual(layout[0].target, layout[1].target);
  assert.notDeepEqual(layout[0].box, layout[1].box);
});

test('neighbouring points retain their vertical order instead of crossing leaders', () => {
  const [a, b] = checkClearance([{ x: 220, y: 280 }, { x: 221, y: 235 }], 687, 370);
  assert.ok(a.box.y > b.box.y);
});

test('offscreen, rear-facing and not-yet-loaded targets have no misleading arrows', () => {
  assert.deepEqual(layoutProbeLabels([null, { x: 10, y: 10, visible: false }], 400, 370), [null, null]);
  assert.deepEqual(layoutProbeLabels([{ x: -1, y: 10 }, { x: 410, y: 10 }], 400, 370), [null, null]);
  assert.deepEqual(layoutProbeLabels([{ x: 10, y: 10 }], 0, 0), [null]);
});

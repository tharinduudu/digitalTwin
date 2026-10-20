import test from 'node:test';
import assert from 'node:assert/strict';
import { RULERS, rulerTicks, RULER_ORIGIN } from '../public/rulers.js';
import { FLOOR_Y } from '../public/detector-geometry.js';

test('three rulers use perpendicular axes and centimetre tick spacing', () => {
  assert.deepEqual(RULERS.map(r => r.axis), ['X', 'Y', 'Z']);
  assert.ok(RULER_ORIGIN[1] > FLOOR_Y);
  for (const ruler of RULERS) {
    assert.equal(ruler.direction.reduce((sum, x) => sum + x * x, 0), 1);
    const ticks = rulerTicks(ruler.length);
    ticks.forEach((tick, i) => {
      assert.equal(tick.value, i);
      assert.equal(tick.major, i % 5 === 0);
    });
  }
});

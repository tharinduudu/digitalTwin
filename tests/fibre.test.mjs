import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fibreCurve, tilePoint, FibreLight } from '../public/fibre.js';

const data = JSON.parse(readFileSync(new URL('../public/assets/fibre-path.json', import.meta.url)));

test('fibre ends lie on the SiPM face inside the corner holder', () => {
  const face = tilePoint(19.021, 19.021, 8.5, 13);
  const curve = fibreCurve(data, 13);
  assert.equal(curve.closed, false);
  for (const u of [0, 1]) {
    const end = curve.getPointAt(u);
    assert.ok(Math.abs(end.y - 13.35) < 1e-9);
    assert.ok(Math.abs((end.x - face.x) - (end.z - face.z)) < 1e-9);
    assert.ok(end.distanceTo(face) < 0.051);
  }
  for (const point of curve.getSpacedPoints(400)) {
    assert.ok(Math.abs(point.x) < 10 && Math.abs(point.z) < 10);
  }
});

test('green light moves along the fibre towards both sensor ends and expires', () => {
  const curve = fibreCurve(data, 0);
  const light = new FibreLight(curve, 0.05);
  light.excite(curve.getPointAt(0.5));
  light.update(0.13, true);
  const heads = light.glow.material.uniforms.heads.value;
  assert.ok(heads.x < 0.5 && heads.y > 0.5);
  assert.equal(light.glow.visible, true);
  light.update(2, true);
  assert.equal(light.glow.visible, false);
  light.update(0, false);
  assert.equal(light.core.visible, false);
});

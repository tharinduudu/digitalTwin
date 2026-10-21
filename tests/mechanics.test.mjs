import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import { TILE_HEIGHTS, RAIL_HALF_HEIGHT, ACRYLIC_ANGLE, ACRYLIC_MOUNTS, ACRYLIC_OFFSET, RUBBER_FOOT, FLOOR_Y } from '../public/detector-geometry.js';
import { GEOMETRY, randomGenerator } from '../simulation.mjs';
import { tileIntersection } from '../public/muon-transport.js';
import { socketFastener } from '../public/fasteners.js';

test('tile and holder fit fully within each horizontal beam height', () => {
  assert.deepEqual(GEOMETRY.heights, TILE_HEIGHTS);
  for (const height of TILE_HEIGHTS) {
    for (const halfHeight of [0.5, 0.75]) {
      assert.ok(height + halfHeight < height + RAIL_HALF_HEIGHT);
      assert.ok(height - halfHeight > height - RAIL_HALF_HEIGHT);
    }
  }
});

test('the 2 mm acrylic sheets remain visible outside the beam height', () => {
  assert.ok(ACRYLIC_OFFSET - 0.1 > RAIL_HALF_HEIGHT);
  assert.ok(-ACRYLIC_OFFSET + 0.1 < -RAIL_HALF_HEIGHT);
});

test('rubber feet are wider against the posts and narrower on the floor', () => {
  assert.ok(RUBBER_FOOT.topRadius > RUBBER_FOOT.bottomRadius);
  assert.ok(Math.abs(RUBBER_FOOT.topY - RUBBER_FOOT.height - FLOOR_Y) < 1e-9);
});

test('diagonal artwork reads along the X axis from the readout-box side', () => {
  const lettering = new THREE.Vector3(1, -1, 0)
    .applyAxisAngle(new THREE.Vector3(0, 0, 1), ACRYLIC_ANGLE)
    .applyAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  assert.ok(lettering.x > 0);
  assert.ok(Math.abs(lettering.z) < 1e-12);
  assert.equal(ACRYLIC_MOUNTS.length, 4);
  assert.ok(ACRYLIC_MOUNTS.every(([x, z]) => x === 0 || z === 0));
});

test('track intersections agree with the recessed visual tile planes', () => {
  const random = randomGenerator(137);
  for (let i = 0; i < 1000; i++) {
    const x = (random() - 0.5) * 30, z = (random() - 0.5) * 30;
    TILE_HEIGHTS.forEach((height, index) => {
      const interval = tileIntersection([x, 28, z], [0, -1, 0], index);
      const inside = Math.abs(x) <= 10 && Math.abs(z) <= 10 && -x + z <= 16.1958;
      assert.equal(!!interval, inside);
      if (interval) {
        assert.ok(Math.abs(28 - (interval.enter + interval.exit) / 2 - height) < 1e-10);
        assert.ok(Math.abs(interval.exit - interval.enter - 1) < 1e-10);
      }
    });
  }
});

test('socket-head mounting hardware includes a recessed head and sliding nut', () => {
  const fastener = socketFastener(new THREE.MeshStandardMaterial());
  assert.equal(fastener.children.length, 5);
  assert.equal(fastener.children[0].geometry.parameters.shapes.holes.length, 1);
  assert.ok(fastener.children.at(-1).position.z < 0);
});

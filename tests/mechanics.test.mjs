import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import { TILE_HEIGHTS, RAIL_HALF_HEIGHT, ACRYLIC_ANGLE, ACRYLIC_MOUNTS, ACRYLIC_OFFSET, RUBBER_FOOT, FLOOR_Y } from '../public/detector-geometry.js';
import { GEOMETRY, sampleTrack, randomGenerator } from '../simulation.mjs';
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

test('rubber feet taper towards the posts and sit on the floor', () => {
  assert.ok(RUBBER_FOOT.bottomRadius > RUBBER_FOOT.topRadius);
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
    const track = sampleTrack(random);
    TILE_HEIGHTS.forEach((height, index) => {
      const inside = Math.abs(track.x - height * track.dx) <= 10
        && Math.abs(track.z - height * track.dz) <= 10;
      assert.equal(track.hits[index], inside);
    });
  }
});

test('socket-head mounting hardware includes a recessed head and sliding nut', () => {
  const fastener = socketFastener(new THREE.MeshStandardMaterial());
  assert.equal(fastener.children.length, 5);
  assert.equal(fastener.children[0].geometry.parameters.shapes.holes.length, 1);
  assert.ok(fastener.children.at(-1).position.z < 0);
});

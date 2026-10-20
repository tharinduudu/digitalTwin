import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import { addCornerBrackets } from '../public/corner-brackets.js';
import { socketFastener } from '../public/fasteners.js';
import { TILE_HEIGHTS, ACRYLIC_OFFSET, ACRYLIC_MOUNTS } from '../public/detector-geometry.js';

test('24 gusseted angle brackets secure both rails at every frame corner', () => {
  const model = new THREE.Group();
  const counts = addCornerBrackets(model, new THREE.MeshStandardMaterial(), TILE_HEIGHTS);
  assert.equal(counts.brackets, 24);
  assert.equal(counts.screws, 48);
  assert.ok(counts.batches <= 8);
  assert.ok(model.children.every(mesh => mesh.isInstancedMesh));
  assert.equal(model.children.reduce((sum, mesh) => sum + mesh.count, 0), 24 * 14);
});

test('lower acrylic screw heads point down and their shafts enter the lower beam slots', () => {
  const screw = socketFastener(new THREE.MeshStandardMaterial(), 0.65);
  screw.rotation.x = Math.PI / 2;
  screw.position.y = -ACRYLIC_OFFSET - 0.13;
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(screw.quaternion);
  assert.ok(normal.y < -0.999);
  assert.ok(screw.position.y < -1.22);
  assert.ok(screw.position.y + 0.65 > -1);
  assert.equal(TILE_HEIGHTS.length * ACRYLIC_MOUNTS.length * 2, 24);
});

test('all mount locations share the same socket-head and sliding-nut geometry', () => {
  const material = new THREE.MeshStandardMaterial();
  const acrylic = socketFastener(material, 0.65);
  const bracket = socketFastener(material, 0.65);
  const enclosure = socketFastener(material, 0.8);
  for (const index of [0, 1, 2, 4]) {
    assert.equal(acrylic.children[index].geometry, bracket.children[index].geometry);
    assert.equal(acrylic.children[index].geometry, enclosure.children[index].geometry);
  }
});

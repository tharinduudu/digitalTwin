import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import { seatConverter } from '../public/hardware-adjustments.js';

function fixture() {
  const scene = new THREE.Group();
  const converter = new THREE.Group();
  converter.name = 'U5';
  converter.position.set(0.04, 0.001595, 0.0585);
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.01, 0.006),
    new THREE.MeshStandardMaterial({ color: '#0d0d0d' }));
  housing.position.y = 0.0091;
  const lead = new THREE.Mesh(new THREE.BoxGeometry(0.0005, 0.0066, 0.00025),
    new THREE.MeshStandardMaterial({ color: '#c8c8c8' }));
  lead.position.y = 0.0033;
  converter.add(housing, lead);
  const neighbour = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.001, 0.001));
  neighbour.position.set(0.02, 0.001595, 0.02);
  scene.add(converter, neighbour);
  return { scene, converter, housing, neighbour };
}

test('U5 housing is seated at the PCB datum without changing its size', () => {
  const { scene, converter, housing } = fixture();
  scene.updateMatrixWorld(true);
  const datum = converter.getWorldPosition(new THREE.Vector3());
  const before = new THREE.Box3().setFromObject(housing).getSize(new THREE.Vector3());
  const result = seatConverter(scene);
  const after = new THREE.Box3().setFromObject(housing);
  assert.ok(Math.abs(after.min.y - datum.y) < 1e-9);
  assert.ok(after.getSize(new THREE.Vector3()).distanceTo(before) < 1e-9);
  assert.ok(Math.abs(result.offsetMm + 4.1) < 1e-6);
  assert.ok(Math.abs(result.housingGapMm) < 1e-9);
});

test('seating U5 leaves its footprint and neighbouring components unchanged', () => {
  const { scene, converter, neighbour } = fixture();
  const position = neighbour.position.clone();
  const scale = converter.scale.clone();
  seatConverter(scene);
  assert.equal(converter.position.x, 0.04);
  assert.equal(converter.position.z, 0.0585);
  assert.ok(neighbour.position.equals(position));
  assert.ok(converter.scale.equals(scale));
});

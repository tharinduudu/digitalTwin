import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import { BEAM, headerShift, smaLeadPoints, PI_HOLES, caseMounts, mountingShift, READOUT_X, piCableAnchors } from '../public/readout-placement.js';

test('readout enclosure is horizontally centred without moving boards within the case', () => {
  assert.equal(2.2 + READOUT_X, 0);
});

test('USB-C and Ethernet anchors follow the mounted Pi CAD', () => {
  const { usbC, ethernet } = piCableAnchors();
  assert.ok(Math.abs(usbC.x + 1.02) < 1e-9);
  assert.ok(Math.abs(usbC.y + 2.17) < 1e-9);
  assert.ok(Math.abs(ethernet.y + 9.855) < 1e-9);
  assert.ok(ethernet.z > usbC.z);
});

test('all four Pi mounting holes align with the enclosure standoffs', () => {
  const axes = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0));
  const holes = PI_HOLES.map(p => new THREE.Vector3(...p).multiplyScalar(100).applyMatrix4(axes));
  const targets = caseMounts();
  const shift = mountingShift(holes, targets);
  holes.forEach((hole, i) => assert.ok(hole.clone().add(shift).distanceTo(targets[i]) < 1e-12));
  assert.ok(Math.abs(targets[0].distanceTo(targets[1]) - 4.9) < 1e-12);
  assert.ok(Math.abs(targets[0].distanceTo(targets[2]) - 5.8) < 1e-12);
});

test('Pi placement aligns its GPIO housing with the readout socket', () => {
  const socket = new THREE.Vector3(5.9, -4.7, 12.9);
  const header = new THREE.Vector3(6.8, -4.1, 11.7);
  assert.ok(header.clone().add(headerShift(socket, header)).distanceTo(socket) < 1e-12);
});

test('SMA leads exit the vertical beam and stay beside, not behind, the box', () => {
  const port = new THREE.Vector3(-1.6, -3, 15.5);
  const points = smaLeadPoints(port);
  assert.equal(points[0].x, BEAM.x);
  assert.equal(points[0].z, BEAM.z);
  assert.ok(points.every(p => p.y === port.y && p.x <= port.x - 2.25));
  assert.equal(points.at(-1).z, port.z);
  assert.equal(points.at(-1).x, port.x - 2.25);
});

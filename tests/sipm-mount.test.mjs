import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import { createSiPMMount, SENSOR_BOARD } from '../public/sipm-mount.js';
import { tilePoint } from '../public/fibre.js';
import { BEAM } from '../public/readout-placement.js';

test('carrier PCB fills the holder recess without moving the optical face', () => {
  const { mount } = createSiPMMount(new THREE.Group(), 12.05);
  const pcb = mount.getObjectByName('SiPM carrier PCB');
  assert.ok(SENSOR_BOARD.width <= 1.38 && SENSOR_BOARD.width > 1.35);
  assert.ok(SENSOR_BOARD.height <= 0.59 && SENSOR_BOARD.height > 0.55);
  assert.ok(pcb.position.x - SENSOR_BOARD.width / 2 >= -1.09);
  assert.ok(pcb.position.x + SENSOR_BOARD.width / 2 <= 0.29);
  assert.ok(mount.position.distanceTo(tilePoint(19.021, 19.021, 8.5, 12.05)) < 1e-10);
  const front = pcb.position.z - SENSOR_BOARD.thickness / 2;
  const back = pcb.position.z + SENSOR_BOARD.thickness / 2;
  assert.ok(Math.abs(19.021 * Math.SQRT2 - front * 10 - 25.2) < 1e-9);
  assert.ok(Math.abs(19.021 * Math.SQRT2 - back * 10 - 24.4) < 1e-9);
});

test('U.FL is opposite the SiPM and the coax joins the vertical beam route', () => {
  const { mount, cablePoints } = createSiPMMount(new THREE.Group(), -0.95);
  const pcb = mount.getObjectByName('SiPM carrier PCB');
  const pin = mount.getObjectByName('U.FL centre pin');
  const plug = mount.getObjectByName('U.FL cable plug');
  assert.equal(pin.position.x, 0);
  assert.equal(pin.position.y, 0);
  assert.ok(pin.position.z > pcb.position.z + SENSOR_BOARD.thickness / 2);
  assert.ok(plug.position.z > pin.position.z);
  const start = mount.worldToLocal(cablePoints[0].clone());
  assert.ok(Math.abs(start.z - plug.position.z) < 1e-9);
  const end = cablePoints.at(-1);
  assert.deepEqual(end.toArray(), [BEAM.x, -1.9, BEAM.z]);
});

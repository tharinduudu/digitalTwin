import * as THREE from './vendor/three.module.js';
import { SENSOR_BOARD } from './sipm-mount.js';

export function tapeSiPMHolder(holder, sensorMount) {
  const tape = new THREE.MeshStandardMaterial({ color: '#101211', roughness: 0.96 });
  // Keep the supplied holder's surface and outline, including the cable groove.
  holder.material = tape;
  holder.userData.lightBlockingTape = true;
  const patch = new THREE.Mesh(new THREE.BoxGeometry(SENSOR_BOARD.width + 0.06,
    SENSOR_BOARD.height + 0.06, 0.02), tape);
  patch.name = 'Light-blocking tape over the rear board recess';
  patch.position.set(SENSOR_BOARD.centreX, 0, SENSOR_BOARD.front + SENSOR_BOARD.thickness + 0.16);
  patch.userData.lightBlockingTape = true;
  sensorMount.add(patch);
  return patch;
}

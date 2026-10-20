import * as THREE from './vendor/three.module.js';

export const BEAM = { x: -11.16, z: 11.16 };

// Hole centres from the Pi 5 CAD (metres), at the PCB underside.
export const PI_HOLES = [
  [0.0035, 0.001645, -0.0035], [0.0035, 0.001645, -0.0525],
  [0.0615, 0.001645, -0.0035], [0.0615, 0.001645, -0.0525],
];

export function caseMounts() {
  // Source STL holes: x=-27.5/21.5, y=37/-21 mm; standoffs end at z=4.9 mm.
  return [[-27.5, 37], [21.5, 37], [-27.5, -21], [21.5, -21]]
    .map(([x, y]) => new THREE.Vector3(2.2 + x / 10, -5.1 + y / 10, 10.8 + 0.49));
}

export function mountingShift(holes, targets) {
  const mean = points => points.reduce((sum, p) => sum.add(p), new THREE.Vector3()).divideScalar(points.length);
  return mean(targets).sub(mean(holes));
}

export function headerShift(socket, header) {
  return socket.clone().sub(header);
}

export function smaLeadPoints(port) {
  // Leave the upright on the connector side. Never pass behind the enclosure.
  return [
    new THREE.Vector3(BEAM.x, port.y, BEAM.z),
    new THREE.Vector3(BEAM.x, port.y, 12.3),
    new THREE.Vector3(BEAM.x + 0.9, port.y, port.z),
    new THREE.Vector3(port.x - 4, port.y, port.z),
    new THREE.Vector3(port.x - 2.25, port.y, port.z),
  ];
}

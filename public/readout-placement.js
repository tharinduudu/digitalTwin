import * as THREE from './vendor/three.module.js';

export const BEAM = { x: -11.16, z: 11.16 };
export const READOUT_X = -2.2;

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

export function piCableAnchors() {
  const axes = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0));
  const firstHole = new THREE.Vector3(...PI_HOLES[0]).multiplyScalar(100).applyMatrix4(axes);
  const origin = caseMounts()[0].clone().sub(firstHole);
  const point = raw => new THREE.Vector3(...raw).multiplyScalar(100).applyMatrix4(axes).add(origin);
  // Opening-face centres from OBJ5144 (USB-C) and OBJ4358 (RJ45) in the Pi CAD.
  return { usbC: point([0.0112, 0.004081, 0.0012]),
    ethernet: point([0.08805, 0.008601, -0.01025]) };
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

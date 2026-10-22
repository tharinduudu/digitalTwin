import * as THREE from './vendor/three.module.js';
import { smoothAssembly } from './assembly-steps.js';

// The cable is carried loose above the rail until its free SMA end is connected.
function looseLead(start, length) {
  const exit = start.clone().add(new THREE.Vector3(0, 2.5, 3));
  const loop = [[0, 0, 0], [-1.5, 0, 0.2], [-5, -0.5, 0.7], [-6, -2, 3],
    [-4.5, -3.5, 5], [-1.5, -3, 4.5], [-1, -1.5, 2], [-2, -0.5, 1.5], [-1, -0.5, 1.5]];
  const curve = scale => new THREE.CatmullRomCurve3([start.clone(),
    start.clone().add(new THREE.Vector3(0, 2.5, 0.2)),
    ...loop.map(point => new THREE.Vector3(...point).multiplyScalar(scale).add(exit))]);
  let low = 0.01;
  let high = 8;
  for (let i = 0; i < 30; i++) {
    const scale = (low + high) / 2;
    if (curve(scale).getLength() < length) low = scale;
    else high = scale;
  }
  return curve((low + high) / 2);
}

export function createCarriedCoax(route, material) {
  const group = new THREE.Group();
  group.name = 'Attached coax cable and free SMA plug';
  const start = route.getPointAt(0);
  const loose = looseLead(start, route.getLength());
  const loosePoints = loose.getSpacedPoints(80);
  const routedPoints = route.getSpacedPoints(80);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(loose, 80, 0.055, 6, false), material);
  const plug = new THREE.Group();
  plug.name = 'Free SMA end';
  plug.position.copy(routedPoints.at(-1));
  group.add(cable, plug);
  let lastProgress = null;
  return {
    group, cable, plug, loose, route,
    update(progress) {
      const amount = smoothAssembly(progress);
      if (amount === lastProgress) return;
      // Seat the lead at the frame entrance first, then feed it down the post.
      // The free plug is the last section to reach its installed position.
      const points = loosePoints.map((point, index) => {
        const seated = smoothAssembly(progress * 1.5 - index / (loosePoints.length - 1) * 0.5);
        return point.clone().lerp(routedPoints[index], seated);
      });
      const curve = new THREE.CatmullRomCurve3(points);
      cable.geometry.dispose();
      cable.geometry = new THREE.TubeGeometry(curve, 80, 0.055, 6, false);
      plug.position.copy(points.at(-1));
      plug.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), curve.getTangentAt(1).normalize());
      lastProgress = amount;
    },
  };
}

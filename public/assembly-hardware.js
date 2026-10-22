import * as THREE from './vendor/three.module.js';
import { caseMounts, cableGuide } from './readout-placement.js';
import { TILE_OUTLINE } from './detector-geometry.js';

// The Pi screws enter the printed supports, not sliding frame nuts.
export function createPiFixings(material) {
  const head = new THREE.Shape();
  head.absarc(0, 0, 0.23, 0, Math.PI * 2, false);
  const cross = new THREE.Path();
  const outline = [[-.035,-.14],[.035,-.14],[.035,-.035],[.14,-.035],[.14,.035],[.035,.035],
    [.035,.14],[-.035,.14],[-.035,.035],[-.14,.035],[-.14,-.035],[-.035,-.035]];
  cross.moveTo(...outline[0]);
  for (const point of outline.slice(1)) cross.lineTo(...point);
  cross.closePath();
  head.holes.push(cross);
  const capGeometry = new THREE.ExtrudeGeometry(head, { depth: .12, bevelEnabled: true,
    bevelThickness: .025, bevelSize: .015, bevelSegments: 2, curveSegments: 20 });
  const recessGeometry = new THREE.CircleGeometry(.18, 24);
  const recessMaterial = new THREE.MeshStandardMaterial({ color: '#242724', roughness: .75 });
  const washerGeometry = new THREE.RingGeometry(.13, .26, 24);
  const washerMaterial = material.clone();
  washerMaterial.side = THREE.DoubleSide;
  const shaftGeometry = new THREE.CylinderGeometry(.125, .125, .4, 12);
  return caseMounts().map((mount, index) => {
    const screw = new THREE.Group();
    const cap = new THREE.Mesh(capGeometry, material);
    const recess = new THREE.Mesh(recessGeometry, recessMaterial);
    recess.position.z = .025;
    const washer = new THREE.Mesh(washerGeometry, washerMaterial);
    washer.position.z = .005;
    const shaft = new THREE.Mesh(shaftGeometry, material);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = -.2;
    screw.add(cap, recess, washer, shaft);
    screw.userData.drive = 'phillips';
    screw.position.copy(mount).add(new THREE.Vector3(0, 0, 0.18));
    screw.name = `Pi Phillips mounting screw ${index + 1}`;
    return screw;
  });
}

export function createPhillipsDriver(material) {
  const driver = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, 2.4, 12), material);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 1.3;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(.24, .20, 1.6, 16),
    new THREE.MeshStandardMaterial({ color: '#315e78', roughness: .7 }));
  handle.rotation.x = Math.PI / 2;
  handle.position.z = 3.25;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(.19, .04, .12), material);
  const otherBlade = new THREE.Mesh(new THREE.BoxGeometry(.04, .19, .12), material);
  blade.position.z = otherBlade.position.z = .13;
  driver.add(shaft, handle, blade, otherBlade);
  driver.name = 'Phillips screwdriver for the Pi mounting screws';
  driver.visible = false;
  return driver;
}

export function createAllenKey(material) {
  const key = new THREE.Group();
  const longArm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.9, 6), material);
  longArm.rotation.x = Math.PI / 2;
  longArm.position.z = 1.32;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.25, 6), material);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0.55, 0, 2.23);
  key.add(longArm, handle);
  key.name = 'Allen key at the screw being tightened';
  key.visible = false;
  return key;
}

export function cablePassage(height, index) {
  const guide = cableGuide(index);
  return new THREE.Vector3(guide.x, height + 0.35, guide.z);
}

export function createCutCornerGuide() {
  const group = new THREE.Group();
  group.name = 'Cable clearance at the tile cut corner';
  const [a, b] = TILE_OUTLINE.slice(1, 3);
  const points = [a, b, [a[0], b[1]]].map(([x, z]) => new THREE.Vector3(x, 0, z));
  const outline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: '#efbc52', depthTest: false, depthWrite: false }));
  outline.name = 'Actual cut-corner outline';
  outline.renderOrder = 50;
  group.add(outline);
  // The lead follows the holder groove to the beam, then turns toward the upright.
  const guide = cableGuide();
  const arrow = new THREE.ArrowHelper(new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(-7.7, 0, guide.z), 2.05, '#efbc52', .28, .16);
  for (const mesh of [arrow.line, arrow.cone]) {
    mesh.material.depthTest = false;
    mesh.material.depthWrite = false;
    mesh.renderOrder = 50;
  }
  group.add(arrow);
  return group;
}

import * as THREE from './vendor/three.module.js';

// Display dimensions approximate an M4 socket-head screw, washer and sliding nut.
// The group's +Z axis points outwards from the mounting surface.
export function socketFastener(material, length = 1) {
  const group = new THREE.Group();
  const head = new THREE.Shape();
  head.absarc(0, 0, 0.35, 0, Math.PI * 2, false);
  const socket = new THREE.Path();
  for (let i = 0; i < 6; i++) {
    const angle = -i * Math.PI / 3;
    const x = 0.175 * Math.cos(angle), y = 0.175 * Math.sin(angle);
    if (!i) socket.moveTo(x, y); else socket.lineTo(x, y);
  }
  socket.closePath();
  head.holes.push(socket);
  const cap = new THREE.Mesh(new THREE.ExtrudeGeometry(head,
    { depth: 0.4, bevelEnabled: false, curveSegments: 16 }), material);
  const recess = new THREE.Mesh(new THREE.CircleGeometry(0.175, 6),
    new THREE.MeshStandardMaterial({ color: '#171a19', roughness: 0.8 }));
  recess.position.z = 0.07;
  const washer = new THREE.Mesh(new THREE.RingGeometry(0.205, 0.45, 24), material);
  washer.material = material.clone();
  washer.material.side = THREE.DoubleSide;
  washer.position.z = 0.02;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, length, 12), material);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = -length / 2;
  const nut = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 0.25), material);
  nut.position.z = -length + 0.125;
  group.add(cap, recess, washer, shaft, nut);
  group.traverse(part => { if (part.isMesh) part.castShadow = true; });
  return group;
}

import * as THREE from './vendor/three.module.js';

// KiCad exports metres. Fasteners in this scene use centimetres, with the screw on local Z.
export function createNutGeometry(scene) {
  scene.updateMatrixWorld(true);
  const positions = [];
  scene.traverse(node => {
    if (!node.isMesh) return;
    const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
    geometry.applyMatrix4(node.matrixWorld);
    positions.push(...geometry.attributes.position.array);
    geometry.dispose();
  });
  if (!positions.length) throw Error('The T-slot nut CAD contains no mesh.');
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.center().rotateZ(-Math.PI / 2).scale(100, 100, 100);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

export const NUT_ROLES = {
  joint: { label: 'Frame joint', color: '#efbc52' },
  acrylic: { label: 'Acrylic sheet', color: '#63b5ef' },
  case: { label: 'Readout box', color: '#e394b8' },
};

import * as THREE from './vendor/three.module.js';

export function seatConverter(scene) {
  const component = scene.getObjectByName('U5');
  if (!component) throw new Error('CAD converter U5 missing');
  scene.updateMatrixWorld(true);
  const datum = component.getWorldPosition(new THREE.Vector3());
  const housing = new THREE.Box3();
  // U5 includes its leads and white markings. Only the dark housing defines its base.
  component.traverse(part => {
    if (!part.isMesh) return;
    const materials = Array.isArray(part.material) ? part.material : [part.material];
    if (materials.every(({ color }) => color && Math.max(color.r, color.g, color.b) < 0.06))
      housing.union(new THREE.Box3().setFromObject(part));
  });
  if (housing.isEmpty()) throw new Error('CAD converter housing not found');
  const shift = datum.y - housing.min.y;
  const target = datum.clone().add(new THREE.Vector3(0, shift, 0));
  component.position.copy(component.parent.worldToLocal(target));
  scene.updateMatrixWorld(true);
  return { offsetMm: shift * 1000, housingGapMm: (housing.min.y + shift - datum.y) * 1000 };
}

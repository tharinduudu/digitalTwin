import * as THREE from './vendor/three.module.js';
import { socketFastener } from './fasteners.js';

function bracketParts() {
  const plate = new THREE.Shape();
  plate.moveTo(0, -0.8);
  plate.lineTo(2, -0.8);
  plate.lineTo(2, 0.8);
  plate.lineTo(0, 0.8);
  plate.closePath();
  const hole = new THREE.Path();
  hole.absarc(1.2, 0, 0.225, 0, Math.PI * 2, true);
  plate.holes.push(hole);
  const horizontal = new THREE.ExtrudeGeometry(plate, { depth: 0.25, bevelEnabled: false, curveSegments: 12 });
  horizontal.rotateX(-Math.PI / 2);
  const swap = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1));
  const vertical = horizontal.clone().applyMatrix4(swap);
  const triangle = new THREE.Shape();
  triangle.moveTo(0.25, 0.25);
  triangle.lineTo(1.7, 0.25);
  triangle.lineTo(0.25, 1.7);
  triangle.closePath();
  const gusset = new THREE.ExtrudeGeometry(triangle, { depth: 0.12, bevelEnabled: false });
  return { horizontal, vertical, gusset };
}

export function addCornerBrackets(model, material, heights) {
  const parts = bracketParts();
  const batches = new Map();
  let bracketCount = 0;
  for (const height of heights) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    // Each post-to-rail junction has one bracket for each horizontal rail.
    for (const alongX of [true, false]) {
      const bracket = new THREE.Group();
      bracket.add(new THREE.Mesh(parts.horizontal, material), new THREE.Mesh(parts.vertical, material));
      for (const z of [-0.8, 0.68]) {
        const wall = new THREE.Mesh(parts.gusset, material);
        wall.position.z = z;
        bracket.add(wall);
      }
      const underRail = socketFastener(material, 0.65);
      underRail.rotation.x = -Math.PI / 2;
      underRail.position.set(1.2, 0.27, 0);
      const intoPost = socketFastener(material, 0.65);
      intoPost.rotation.y = Math.PI / 2;
      intoPost.rotateZ(Math.PI / 2);
      intoPost.position.set(0.27, 1.2, 0);
      bracket.add(underRail, intoPost);
      const inward = alongX ? new THREE.Vector3(-sx, 0, 0) : new THREE.Vector3(0, 0, -sz);
      const down = new THREE.Vector3(0, -1, 0);
      bracket.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(inward, down,
        new THREE.Vector3().crossVectors(inward, down)));
      bracket.position.set(sx * (alongX ? 10.16 : 11.16), height - 1,
        sz * (alongX ? 11.16 : 10.16));
      bracket.updateMatrixWorld(true);
      bracket.traverse(part => {
        if (!part.isMesh) return;
        const key = `${part.geometry.uuid}:${part.material.uuid}`;
        if (!batches.has(key)) batches.set(key, { geometry: part.geometry, material: part.material, matrices: [] });
        batches.get(key).matrices.push(part.matrixWorld.clone());
      });
      bracketCount++;
    }
  }
  // Repeated brackets and screws share GPU draw calls rather than hundreds of meshes.
  for (const batch of batches.values()) {
    const instances = new THREE.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
    batch.matrices.forEach((matrix, index) => instances.setMatrixAt(index, matrix));
    instances.instanceMatrix.needsUpdate = true;
    instances.castShadow = true;
    instances.receiveShadow = true;
    model.add(instances);
  }
  return { brackets: bracketCount, screws: bracketCount * 2, batches: batches.size };
}

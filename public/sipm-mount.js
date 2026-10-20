import * as THREE from './vendor/three.module.js';
import { tilePoint } from './fibre.js';
import { BEAM } from './readout-placement.js';

// The rear board slot is 13.8 x 5.9 mm; the optical opening is 3.8 mm square.
// Board thickness and connector details are
// illustrative; their CAD was not supplied. Dimensions here are centimetres.
export const SENSOR_BOARD = { width: 1.37, height: 0.58, thickness: 0.08, centreX: -0.4,
  front: (19.021 * Math.SQRT2 - 25.2) / 10 };

export function createSiPMMount(packageScene, height) {
  const mount = new THREE.Group();
  mount.name = 'SiPM assembly';
  const part = (name, geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mount.add(mesh);
    return mesh;
  };
  const metal = new THREE.MeshStandardMaterial({ color: '#c5c9c6', metalness: 0.8, roughness: 0.32 });
  const gold = new THREE.MeshStandardMaterial({ color: '#b99a4c', metalness: 0.7, roughness: 0.35 });
  const insulator = new THREE.MeshStandardMaterial({ color: '#dfd9c9', roughness: 0.8 });
  const boardMaterial = new THREE.MeshStandardMaterial({ color: '#245c3e', roughness: 0.8 });

  // Keep the optical face on the existing fibre endpoints. The package STEP
  // uses metres; the rest of this assembly uses the scene's centimetres.
  const sensor = packageScene.clone(true);
  sensor.name = 'Hamamatsu S13360-2050VE';
  sensor.scale.setScalar(100);
  sensor.position.set(0, -0.1615, 0.135);
  mount.add(sensor);
  const board = SENSOR_BOARD;
  const back = board.front + board.thickness;
  part('SiPM carrier PCB', new THREE.BoxGeometry(board.width, board.height, board.thickness),
    boardMaterial, board.centreX, 0, board.front + board.thickness / 2);
  for (const x of [-0.085, 0.085]) {
    part('SiPM solder joint', new THREE.BoxGeometry(0.08, 0.19, board.front - 0.135),
      metal, x, 0, (board.front + 0.135) / 2);
  }

  // Board-mounted male U.FL, then the mating cable plug directly behind it.
  part('U.FL solder base', new THREE.BoxGeometry(0.26, 0.26, 0.025), metal, 0, 0, back + 0.0125);
  const cylinder = (name, radius, length, material, z) => {
    const mesh = part(name, new THREE.CylinderGeometry(radius, radius, length, 16), material, 0, 0, z);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  };
  cylinder('U.FL dielectric', 0.08, 0.045, insulator, back + 0.0475);
  cylinder('U.FL centre pin', 0.018, 0.06, gold, back + 0.055);
  const shell = part('U.FL ground shell', new THREE.TorusGeometry(0.095, 0.018, 6, 20), metal, 0, 0, back + 0.07);
  shell.rotation.set(0, 0, 0);
  cylinder('U.FL cable plug', 0.115, 0.065, metal, back + 0.105);
  part('Coax crimp', new THREE.BoxGeometry(0.17, 0.085, 0.085), metal, -0.12, 0, back + 0.105);

  const diagonal = Math.SQRT1_2;
  mount.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(diagonal, 0, diagonal), new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(-diagonal, 0, diagonal)));
  mount.position.copy(tilePoint(19.021, 19.021, 8.5, height));
  mount.updateMatrixWorld(true);
  const localPoints = [new THREE.Vector3(-0.205, 0, back + 0.105),
    new THREE.Vector3(-0.5, 0, back + 0.105),
    new THREE.Vector3(-0.8, 0, back + 0.13),
    new THREE.Vector3(-0.8, 0, 0.8)];
  const cablePoints = localPoints.map(point => mount.localToWorld(point));
  cablePoints.push(new THREE.Vector3(BEAM.x, height - 0.95, BEAM.z));
  return { mount, cablePoints };
}

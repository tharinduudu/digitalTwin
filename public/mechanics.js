import * as THREE from 'three';
import { STLLoader } from '/vendor/loaders/STLLoader.js';
import { GLTFLoader } from '/vendor/loaders/GLTFLoader.js';
import { FibreLight, fibreCurve, tilePoint } from './fibre.js';
import { TILE_HEIGHTS, ACRYLIC_ANGLE, ACRYLIC_MOUNTS, ACRYLIC_OFFSET, RUBBER_FOOT } from './detector-geometry.js';
import { socketFastener } from './fasteners.js';

function acrylicShape(data) {
  const shape = new THREE.Shape(data.outline.map(p => new THREE.Vector2(...p)));
  for (const segments of data.holes) {
    const path = new THREE.Path();
    path.moveTo(...segments[0][1]);
    for (const [kind, , ...points] of segments) {
      if (kind === 'l') path.lineTo(...points[0]);
      else path.bezierCurveTo(...points.flat());
    }
    path.closePath();
    shape.holes.push(path);
  }
  return shape;
}

export async function installMechanicalParts(view) {
  const loader = new STLLoader();
  const [post, rail, tile, holder, base, lid, acrylic, fibre, sipm] = await Promise.all([
    ...['extrusion-post', 'extrusion-rail', 'tile', 'holder', 'case-base', 'case-lid'].map(name => loader.loadAsync(`/assets/${name}.stl`)),
    fetch('/assets/acrylic.json').then(r => r.json()),
    fetch('/assets/fibre-path.json').then(r => r.json()),
    new GLTFLoader().loadAsync('/assets/sipm.glb'),
  ]);
  const mesh = (geometry, material, position) => {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(...position);
    object.castShadow = true;
    object.receiveShadow = true;
    view.model.add(object);
    return object;
  };
  for (const old of view.frameMeshes) { view.model.remove(old); old.geometry.dispose(); }
  const top = 13.05, bottom = -17.85;
  const footGeometry = new THREE.CylinderGeometry(RUBBER_FOOT.topRadius,
    RUBBER_FOOT.bottomRadius, RUBBER_FOOT.height, 24);
  for (const x of [-11.16, 11.16]) for (const z of [-11.16, 11.16]) {
    const upright = mesh(post, view.silver, [x, (top + bottom) / 2, z]);
    upright.scale.y = (top - bottom) / 38.1;
    mesh(footGeometry, view.black, [x, RUBBER_FOOT.topY - RUBBER_FOOT.height / 2, z]);
  }
  for (const y of TILE_HEIGHTS) {
    for (const z of [-11.16, 11.16]) mesh(rail, view.silver, [0, y, z]);
    for (const x of [-11.16, 11.16]) {
      const side = mesh(rail, view.silver, [x, y, 0]);
      side.rotation.y = Math.PI / 2;
    }
  }

  tile.translate(-100, -100, -5).scale(0.1, 0.1, 0.1).rotateX(-Math.PI / 2);
  holder.translate(-100, -100, -5).scale(0.1, 0.1, 0.1).rotateX(-Math.PI / 2);
  const sheet = new THREE.ExtrudeGeometry(acrylicShape(acrylic), { depth: 0.2, bevelEnabled: false, curveSegments: 12 });
  sheet.translate(0, 0, -0.1).rotateX(-Math.PI / 2);
  const sheetEdges = new THREE.EdgesGeometry(sheet, 30);
  const edgeMaterial = new THREE.LineBasicMaterial({ color: '#d8eeeb', transparent: true, opacity: 0.5 });
  const acrylicSide = view.glass.clone();
  acrylicSide.opacity = 0.25;
  const cushion = new THREE.ExtrudeGeometry(acrylicShape(acrylic), { depth: 0.1, bevelEnabled: false, curveSegments: 8 });
  cushion.translate(0, 0, -0.05).rotateX(-Math.PI / 2);
  view.fibres = [];
  view.fibreLights = [];
  view.cushions = [];
  view.mechanicalSheets = [];
  for (const old of view.sandwichPieces) { view.model.remove(old); old.geometry.dispose(); }
  view.tiles.forEach((item, index) => {
    const y = TILE_HEIGHTS[index];
    item.tile.geometry.dispose();
    item.tile.geometry = tile;
    item.edges.geometry.dispose();
    item.edges.geometry = new THREE.EdgesGeometry(tile, 35);
    mesh(holder, view.darkMetal, [0, y, 0]);
    const sensor = new THREE.Group();
    const packageModel = sipm.scene.clone(true);
    // The optical face is the negative-Z face of this component STEP model.
    packageModel.position.set(0, -0.001615, 0.00135);
    sensor.add(packageModel);
    sensor.scale.setScalar(100);
    const diagonal = Math.SQRT1_2;
    sensor.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
      new THREE.Vector3(diagonal, 0, diagonal), new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(-diagonal, 0, diagonal)));
    sensor.position.copy(tilePoint(19.021, 19.021, 8.5, y));
    view.model.add(sensor);
    for (const sign of [-1, 1]) {
      const acrylicSheet = mesh(sheet, [view.glass, acrylicSide], [0, y + sign * ACRYLIC_OFFSET, 0]);
      acrylicSheet.rotation.y = ACRYLIC_ANGLE;
      // Keep a visible sheet profile without casting an opaque shadow over the tile.
      acrylicSheet.castShadow = false;
      acrylicSheet.add(new THREE.LineSegments(sheetEdges, edgeMaterial));
      view.mechanicalSheets.push(acrylicSheet);
      const padding = new THREE.MeshStandardMaterial({ map: view.wrap.map, color: '#7b857f',
        transparent: true, opacity: view.cutaway ? 0.055 : 0.2, roughness: 1, depthWrite: false });
      const lining = mesh(cushion, padding, [0, y + sign * 0.55, 0]);
      lining.rotation.y = ACRYLIC_ANGLE;
      lining.castShadow = false;
      view.cushions.push(lining);
    }
    for (const [x, z] of ACRYLIC_MOUNTS) {
      const screw = socketFastener(view.silver, 0.65);
      screw.rotation.x = -Math.PI / 2;
      screw.position.set(x, y + ACRYLIC_OFFSET + 0.13, z);
      // The sliding nut follows the longitudinal slot of each beam.
      if (x) screw.rotateZ(Math.PI / 2);
      view.model.add(screw);
    }
    const light = new FibreLight(fibreCurve(fibre, y), fibre.diameter_mm / 20);
    view.model.add(light.core, light.glow);
    view.fibres.push(light.core, light.glow);
    view.fibreLights.push(light);
    light.update(0, view.cutaway);
  });
  // The supplied artwork is kept as an etching mask, without redrawing the logo.
  const artwork = await new THREE.TextureLoader().loadAsync('/assets/acrylic-engraving.png');
  artwork.colorSpace = THREE.SRGBColorSpace;
  view.topText.geometry.dispose();
  view.topText.geometry = new THREE.PlaneGeometry(19.81, 19.81);
  view.topText.position.y = TILE_HEIGHTS[0] + ACRYLIC_OFFSET + 0.11;
  view.topText.rotation.z = ACRYLIC_ANGLE;
  view.topText.material.dispose();
  view.topText.material = new THREE.MeshBasicMaterial({ map: artwork, transparent: true,
    opacity: view.cutaway ? 0.22 : 0.75, depthWrite: false, side: THREE.DoubleSide });
  view.topText.material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
      '#include <map_fragment>\ndiffuseColor.rgb = vec3(0.82, 0.87, 0.84);');
  };

  // Replace the photographic approximation with the enclosure supplied as STL.
  for (const old of [...view.caseShellMeshes, ...view.fallbackHinges]) { old.removeFromParent(); old.geometry.dispose(); }
  base.scale(0.1, 0.1, 0.1);
  const enclosureBase = mesh(base, view.silver, [2.2, -5.1, 10.8]);
  view.readout.add(enclosureBase);
  // These three slots belong to the supplied enclosure's mounting wings.
  for (const [x, y] of [[-63.276, 41.097], [66.9, 41.4], [0, -87.198]]) {
    const screw = socketFastener(view.silver, 0.8);
    screw.position.set(2.2 + x / 10, -5.1 + y / 10, 11.02);
    view.readout.add(screw);
  }
  for (const old of [...view.lid.children]) { view.lid.remove(old); old.geometry?.dispose(); }
  lid.scale(0.1, 0.1, 0.1);
  const cover = new THREE.Mesh(lid, view.silver);
  cover.castShadow = true;
  view.lid.add(cover);
  view.lid.position.set(2.2, 0.09, 12.42);
  view.sourceCaseReady = true;
  view.mechanicsReady = true;
}

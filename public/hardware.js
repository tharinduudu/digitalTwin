import * as THREE from 'three';
import { GLTFLoader } from '/vendor/loaders/GLTFLoader.js';
import { mergeGeometries } from '/vendor/utils/BufferGeometryUtils.js';
import { headerShift, PI_HOLES, caseMounts, mountingShift } from './readout-placement.js';
import { seatConverter } from './hardware-adjustments.js';

// CAD is in metres. The exhibition scene uses centimetres.
const boardAxes = new THREE.Matrix4().makeBasis(
  new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0));

async function loadBoard(url, position, indicatorNames = [], headerName) {
  const { scene } = await new GLTFLoader().loadAsync(url);
  scene.updateMatrixWorld(true);
  const converter = headerName === 'J2' ? seatConverter(scene) : null;
  const indicators = indicatorNames.map(name => {
    const node = scene.getObjectByName(name);
    if (!node) throw new Error(`CAD indicator ${name} missing`);
    return new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3());
  });
  const headerNode = scene.getObjectByName(headerName);
  if (!headerNode) throw new Error(`CAD header ${headerName} missing`);
  const headerBounds = new THREE.Box3().setFromObject(headerNode);
  const header = headerBounds.getCenter(new THREE.Vector3());
  // Align the socket's underside with the top of the Pi header housing.
  header.y = headerName === 'J2' ? headerBounds.min.y : headerBounds.max.y;
  // Merge by appearance: thousands of small CAD bodies need only a few draw calls.
  const batches = new Map();
  scene.traverse(node => {
    if (!node.isMesh) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const source = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
    source.applyMatrix4(node.matrixWorld);
    const groups = source.groups.length ? source.groups : [{ start: 0, count: source.attributes.position.count, materialIndex: 0 }];
    for (const group of groups) {
      const material = materials[group.materialIndex || 0];
      const key = [material.color?.getHex(), material.metalness, material.roughness, material.opacity].join(':');
      if (!batches.has(key)) batches.set(key, { material: material.clone(), geometries: [] });
      const geometry = new THREE.BufferGeometry();
      for (const name of ['position', 'normal']) {
        const attribute = source.attributes[name];
        if (attribute) geometry.setAttribute(name, new THREE.BufferAttribute(
          attribute.array.slice(group.start * attribute.itemSize, (group.start + group.count) * attribute.itemSize), attribute.itemSize));
      }
      if (!geometry.attributes.normal) geometry.computeVertexNormals();
      batches.get(key).geometries.push(geometry);
    }
    source.dispose();
  });
  const body = new THREE.Group();
  for (const { material, geometries } of batches.values()) {
    const geometry = mergeGeometries(geometries);
    for (const item of geometries) item.dispose();
    const mesh = new THREE.Mesh(geometry, material);
    body.add(mesh);
  }
  scene.traverse(node => { if (node.isMesh) node.geometry.dispose(); });
  body.scale.setScalar(100);
  body.setRotationFromMatrix(boardAxes);
  body.updateMatrixWorld(true);
  const center = new THREE.Box3().setFromObject(body).getCenter(new THREE.Vector3());
  body.position.copy(new THREE.Vector3(...position).sub(center));
  body.updateMatrixWorld(true);
  const ports = ['J3', 'J4', 'J5', 'J6'].map(name => {
    const node = scene.getObjectByName(name);
    return node ? body.localToWorld(new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3())) : null;
  });
  const mounts = headerName === 'OBJ3742'
    ? PI_HOLES.map(p => new THREE.Vector3(...p).applyMatrix4(body.matrix)) : [];
  return { body, indicators, ports, mounts, converter, header: header.applyMatrix4(body.matrix) };
}

export class ReadoutHardware extends THREE.Group {
  constructor() {
    super();
    this.state = { pcb: false, pi: false, error: null };
    this.pulses = [0, 0, 0];
    this.flashCounts = [0, 0, 0];
    this.leds = [];
    this.visible = false;
  }

  async load() {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const [readout, pi] = await Promise.all([
        loadBoard('/assets/readout-assembly.glb', [2.2, -5.1, 13.15], ['D2', 'D3', 'D4'], 'J2'),
        loadBoard('/assets/raspberry-pi.glb', [2.2, -5.1, 11.8], [], 'OBJ3742'),
      ]);
      // The enclosure is the reference: seat the Pi first, then its HAT.
      const targets = caseMounts();
      const piShift = mountingShift(pi.mounts, targets);
      pi.body.position.add(piShift);
      pi.header.add(piShift);
      this.mountingErrorMm = Math.max(...pi.mounts.map((p, i) => p.clone().add(piShift).distanceTo(targets[i]))) * 10;
      const readoutShift = headerShift(pi.header, readout.header);
      readout.body.position.add(readoutShift);
      readout.ports.forEach(port => port?.add(readoutShift));
      this.headerErrorMm = pi.header.distanceTo(readout.header.clone().add(readoutShift)) * 10;
      this.add(pi.body);
      this.state.pi = true;
      const { body, indicators, ports } = readout;
      this.state.u5GapMm = readout.converter.housingGapMm;
      this.state.u5OffsetMm = readout.converter.offsetMm;
      this.add(body);
      indicators.forEach(point => {
        const material = new THREE.MeshStandardMaterial({ color: '#531919', emissive: '#ff2820', emissiveIntensity: 0.02 });
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.0008, 8, 6), material);
        led.position.copy(point).add(new THREE.Vector3(0, 0.0008, 0));
        body.add(led);
        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.0014, 8, 6),
          new THREE.MeshBasicMaterial({ color: '#ff443c', transparent: true, opacity: 0, depthWrite: false }));
        glow.position.copy(led.position);
        body.add(glow);
        led.userData.glow = glow;
        this.leds.push(led);
      });
      this.ports = ports;
      this.state.pcb = true;
    })().catch(error => { this.state.error = error.message; console.error('Readout CAD', error); });
    return this.loading;
  }

  flash(channel) { this.pulses[channel] = 1; this.flashCounts[channel]++; }

  update(dt) {
    this.pulses.forEach((pulse, index) => {
      this.pulses[index] *= Math.exp(-dt * 18);
      const led = this.leds[index];
      if (led) {
        led.material.emissiveIntensity = 0.02 + this.pulses[index] * 12;
        led.scale.setScalar(1 + this.pulses[index] * 0.6);
        led.userData.glow.material.opacity = this.pulses[index] * 0.6;
      }
    });
  }
}

import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { ReadoutHardware } from './hardware.js';
import { acceptanceProfile } from './acceptance.js';
import { installMechanicalParts } from './mechanics.js';
import { cableGuide, smaLeadPoints, READOUT_X, piCableAnchors } from './readout-placement.js';
import { createRulers } from './rulers.js';
import { TILE_HEIGHTS, TILE_OUTLINE, FLOOR_Y, ENGRAVING_OPACITY, SCINTILLATOR_OPACITY } from './detector-geometry.js';
import { DISPLAY_NS_PER_SECOND, pointAtTime } from './muon-transport.js';

const TILE_Y = TILE_HEIGHTS;
const READOUT_PORT_Y = [-2.5, -4.5, -6.5];
const PAIR_COLORS = { c01: '#80ecc0', c12: '#f5a394', c02: '#bcb0f6', all: '#80ecc0' };

function surfaceTexture(kind) {
  const canvas = document.createElement('canvas');
  canvas.width = kind === 'enclosure' ? 660 : 512;
  canvas.height = kind === 'enclosure' ? 240 : 512;
  const ctx = canvas.getContext('2d');
  if (kind === 'cover') {
    ctx.fillStyle = '#1f2924';
    ctx.fillRect(0, 0, 512, 512);
    for (let row = 0; row < 64; row++) for (let col = 0; col < 64; col++) {
      ctx.fillStyle = (row + col) % 2 ? '#29342e' : '#15211a';
      ctx.fillRect(col * 8, row * 8, 5, 5);
    }
  } else if (kind === 'enclosure') {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#283a2d';
    ctx.font = 'bold 200px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GSU', canvas.width / 2, canvas.height / 2);
  } else {
    ctx.clearRect(0, 0, 512, 512);
    ctx.fillStyle = '#e0e6df';
    ctx.textAlign = 'center';
    ctx.font = 'bold 49px Arial';
    ctx.fillText('GSU', 256, 180);
    ctx.font = '36px Arial';
    ctx.fillText('COSMIC MUON', 256, 240);
    ctx.fillText('TELESCOPE', 256, 290);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class TelescopeScene {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#111514');
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 250);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.32;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.append(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.enablePan = false;
    this.controls.minDistance = 15;
    this.controls.maxDistance = 105;
    this.controls.minPolarAngle = 0.38;
    this.controls.maxPolarAngle = Math.PI * 0.68;
    this.controls.autoRotateSpeed = 0.5;
    this.resetCamera();
    this.scene.add(new THREE.HemisphereLight('#f2f4f1', '#161817', 2.4));
    const key = new THREE.DirectionalLight('#f9fff1', 4.4);
    key.position.set(-30, 45, 24);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -35, right: 35, top: 35, bottom: -35, near: 1, far: 140 });
    key.shadow.bias = -0.001;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#c4dbd8', 3.2);
    rim.position.set(24, 14, -35);
    this.scene.add(rim);
    this.model = new THREE.Group();
    this.scene.add(this.model);
    this.tiles = [];
    this.flashes = [0, 0, 0];
    this.tracks = [];
    this.roomTracks = [];
    this.rings = [];
    this.selectedPair = 'all';
    this.paused = false;
    this.cutaway = true;
    this.lastFrame = 0;
    this.modelMaterials();
    this.buildFrame();
    this.frameMeshes = [...this.model.children];
    this.buildTiles();
    this.buildElectronics();
    this.buildRoomField();
    this.buildAcceptance();
    this.model.add(createRulers());
    installMechanicalParts(this).catch(error => console.error('Mechanical CAD', error))
      .then(() => this.hardware.load());
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#080a09', roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = FLOOR_Y;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.labels = [...document.querySelectorAll('[data-tile]')];
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.animate = this.animate.bind(this);
    this.animationId = requestAnimationFrame(this.animate);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clearTracks();
    });
  }

  modelMaterials() {
    this.silver = new THREE.MeshStandardMaterial({ color: '#a7b2ab', roughness: 0.33, metalness: 0.65 });
    this.darkMetal = new THREE.MeshStandardMaterial({ color: '#334039', roughness: 0.5, metalness: 0.6 });
    this.black = new THREE.MeshStandardMaterial({ color: '#111a15', roughness: 0.8 });
    this.wrap = new THREE.MeshStandardMaterial({ map: surfaceTexture('cover'), roughness: 0.83 });
    this.pcb = new THREE.MeshStandardMaterial({ color: '#075846', roughness: 0.6, metalness: 0.15 });
    this.red = new THREE.MeshStandardMaterial({ color: '#df493a', roughness: 0.5 });
    this.gold = new THREE.MeshStandardMaterial({ color: '#b3a764', roughness: 0.28, metalness: 0.8 });
    this.glass = new THREE.MeshPhysicalMaterial({ color: '#d8eee1', transparent: true, opacity: 0.045, roughness: 0.12, metalness: 0, depthWrite: false });
    this.dotGeometry = new THREE.SphereGeometry(0.12, 8, 6);
  }

  box(w, h, d, x, y, z, material, parent = this.model) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  cable(points, material = this.black, radius = 0.13) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, radius, 6, false), material);
    this.model.add(mesh);
    return mesh;
  }

  buildFrame() {
    const postTop = 12.05 + 1.35 / 2;
    const postBottom = -17.85;
    const postHeight = postTop - postBottom;
    const postCenter = (postTop + postBottom) / 2;
    for (const x of [-11.8, 11.8]) for (const z of [-11.8, 11.8]) {
      this.box(1.35, postHeight, 1.35, x, postCenter, z, this.silver);
      this.box(0.15, postHeight - 1.1, 0.06, x, postCenter, z + 0.7, this.darkMetal);
      this.box(0.06, postHeight - 1.1, 0.15, x + 0.7, postCenter, z, this.darkMetal);
      this.box(1.55, 0.5, 1.55, x, -18, z, this.black);
    }
    for (const y of [12.05, -0.95, -13.95]) {
      for (const z of [-11.8, 11.8]) {
        this.box(24.95, 1.35, 1.35, 0, y, z, this.silver);
        this.box(23.4, 0.15, 0.06, 0, y + 0.18, z + 0.69, this.darkMetal);
      }
      for (const x of [-11.8, 11.8]) this.box(1.35, 1.35, 23.5, x, y, 0, this.silver);
      for (const x of [-10.7, 10.7]) for (const z of [-10.7, 10.7]) {
        this.box(2, 0.5, 2, x, y + 0.7, z, this.darkMetal);
        const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.17, 12), this.silver);
        screw.position.set(x, y + 1, z);
        this.model.add(screw);
      }
    }
  }

  buildTiles() {
    this.sandwichPieces = [];
    this.readoutLeads = [];
    this.beamCables = [];
    this.sensorLeads = [];
    TILE_Y.forEach((y, index) => {
      const material = new THREE.MeshPhysicalMaterial({ color: '#6b9d83', transparent: true, opacity: SCINTILLATOR_OPACITY,
        roughness: 0.3, metalness: 0.05, emissive: '#7af1bd', emissiveIntensity: 0.02, depthWrite: false });
      const tile = this.box(20, 1, 20, 0, y, 0, material);
      tile.renderOrder = index + 1;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(tile.geometry), new THREE.LineBasicMaterial({ color: '#81b59a', transparent: true, opacity: 0.65 }));
      tile.add(edges);
      const cover = this.box(20.15, 1.05, 20.15, 0, y, 0, this.wrap);
      cover.visible = false;
      this.tiles.push({ tile, cover, edges });
      this.sandwichPieces.push(this.box(21.8, 0.12, 21.8, 0, y - 0.75, 0, this.glass));
      const portY = READOUT_PORT_Y[index];
      const guide = cableGuide(index);
      this.sensorLeads.push(this.cable([[-8.2, y + 0.35, 8.2], [-9.6, y + 0.35, 9.6],
        [-10.5, y - 0.7, 10.5], [guide.x, y - 0.95, guide.z]], this.black, 0.055));
      this.beamCables.push(this.cable([[guide.x, y - 0.95, guide.z],
        [guide.x, portY, guide.z]], this.black, 0.055));
      const initialPort = new THREE.Vector3(-1.65 + READOUT_X, portY, 15.55);
      this.readoutLeads.push(this.cable(smaLeadPoints(initialPort, index).map(p => p.toArray()), this.black, 0.055));
    });
    this.topText = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshBasicMaterial({ map: surfaceTexture('label'), transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
    this.topText.rotation.x = -Math.PI / 2;
    this.topText.position.set(0, 13.7, 0);
    this.model.add(this.topText);
  }

  buildElectronics() {
    this.readout = new THREE.Group();
    this.readout.position.x = READOUT_X;
    this.readout.position.z = 1.75;
    this.model.add(this.readout);
    const start = this.model.children.length;
    this.box(7.8, 9, 0.15, 2.2, -5.1, 10.9, this.silver);
    for (const x of [-1.6, 6]) this.box(0.2, 9, 4.3, x, -5.1, 13.1, this.silver);
    for (const y of [-0.7, -9.5]) this.box(7.8, 0.2, 4.3, 2.2, y, 13.1, this.silver);
    this.caseShellMeshes = this.model.children.slice(start);
    this.lid = new THREE.Group();
    this.lid.position.set(6, -5.1, 15.25);
    this.model.add(this.lid);
    this.lidAngle = 0;
    this.boxOpen = false;
    this.hardware = new ReadoutHardware();
    this.model.add(this.hardware);

    // Open grille holes leave the circuit board visible behind the front cover.
    const grille = new THREE.Shape();
    grille.moveTo(-3.9, -4.5);
    grille.lineTo(3.9, -4.5);
    grille.lineTo(3.9, 4.5);
    grille.lineTo(-3.9, 4.5);
    grille.closePath();
    for (let row = 0; row < 7; row++) for (let col = 0; col < 7; col++) {
      const x = -3.35 + col;
      const y = -3.9 + row * 0.8;
      const hole = new THREE.Path();
      hole.moveTo(x, y);
      hole.lineTo(x, y + 0.55);
      hole.lineTo(x + 0.7, y + 0.55);
      hole.lineTo(x + 0.7, y);
      hole.closePath();
      grille.holes.push(hole);
    }
    const face = new THREE.Mesh(new THREE.ExtrudeGeometry(grille, { depth: 0.18, bevelEnabled: false }), this.silver);
    face.position.set(-3.8, 0, 0);
    face.castShadow = true;
    this.lid.add(face);
    const lettering = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 2.4), new THREE.MeshStandardMaterial({
      map: surfaceTexture('enclosure'), transparent: true, roughness: 0.8, depthWrite: false
    }));
    lettering.position.set(-3.8, 3.1, 0.2);
    this.lid.add(lettering);
    this.box(12, 0.7, 0.35, 2.2, -0.9, 10.6, this.darkMetal);
    this.fallbackHinges = [];
    for (const x of [0, 2.2, 4.4]) this.fallbackHinges.push(this.box(1.2, 0.4, 0.7, x, -0.45, 14.6, this.silver));

    this.readoutBoots = [];
    this.readoutSockets = [];
    for (const y of READOUT_PORT_Y) {
      const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.6, 16), this.gold);
      socket.rotation.z = Math.PI / 2;
      socket.position.set(-1.9, y, 13.8);
      this.model.add(socket);
      this.readoutSockets.push(socket);
      const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.38, 1.8, 16), this.red);
      boot.rotation.z = Math.PI / 2;
      boot.position.set(-3, y, 13.8);
      this.model.add(boot);
      this.readoutBoots.push(boot);
    }
    const terminator = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.8, 12),
      new THREE.MeshStandardMaterial({ color: '#e4ba32', roughness: 0.6 }));
    terminator.rotation.z = Math.PI / 2;
    terminator.position.set(-2, -8.3, 13.8);
    this.model.add(terminator);
    this.terminator = terminator;
    for (const child of this.model.children.slice(start)) this.readout.add(child);
    this.buildPiCables();
  }

  buildPiCables() {
    const { usbC, ethernet } = piCableAnchors();
    const blue = new THREE.MeshStandardMaterial({ color: '#327cb1', roughness: 0.65 });
    const clearPlug = new THREE.MeshPhysicalMaterial({ color: '#c7d9d5',
      transparent: true, opacity: 0.55, roughness: 0.25, depthWrite: false });
    const plug = (size, point, material) => {
      const object = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
      object.position.copy(point);
      this.readout.add(object);
    };
    // Pi CAD is vertical here: USB-C faces left and Ethernet faces downwards.
    plug([0.45, 0.82, 0.32], usbC.clone().add(new THREE.Vector3(-0.15, 0, 0)), this.silver);
    plug([1.2, 0.95, 0.5], usbC.clone().add(new THREE.Vector3(-0.9, 0, 0)), this.black);
    plug([1.17, 1.2, 0.85], ethernet.clone().add(new THREE.Vector3(0, -0.5, 0)), clearPlug);
    plug([1.3, 0.85, 0.95], ethernet.clone().add(new THREE.Vector3(0, -1.4, 0)), blue);
    const power = this.cable([[usbC.x - 1.5, usbC.y, usbC.z],
      [-5.2, usbC.y, usbC.z], [-6, -11, usbC.z + 0.3],
      [-7, -17.4, 16], [-5, FLOOR_Y + 0.2, 19], [5, FLOOR_Y + 0.2, 21]], this.black, 0.18);
    const network = this.cable([[ethernet.x, ethernet.y - 1.8, ethernet.z],
      [ethernet.x, -16, ethernet.z + 0.2], [ethernet.x + 1, FLOOR_Y + 0.26, 16],
      [8, FLOOR_Y + 0.26, 18], [15, FLOOR_Y + 0.26, 16]], blue, 0.24);
    this.readout.add(power, network);
  }

  buildRoomField() {
    this.roomCapacity = 180;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.roomCapacity * 6), 3));
    geometry.setDrawRange(0, 0);
    this.roomLines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
      color: '#a7bcb0', transparent: true, opacity: 0.24, depthWrite: false }));
    this.roomLines.frustumCulled = false;
    this.scene.add(this.roomLines);
  }

  buildAcceptance() {
    if (this.acceptance) {
      this.acceptance.traverse(node => { node.geometry?.dispose(); node.material?.dispose(); });
      this.scene.remove(this.acceptance);
    }
    this.acceptance = new THREE.Group();
    const profile = acceptanceProfile(this.selectedPair);
    const apex = new THREE.Vector3(0, profile.lower + 0.02, 0);
    const corners = TILE_OUTLINE.map(([x, z]) => new THREE.Vector3(x, profile.upper, z));
    const triangles = [];
    const lines = [];
    corners.forEach((corner, i) => {
      triangles.push(...apex.toArray(), ...corner.toArray(), ...corners[(i + 1) % 4].toArray());
      lines.push(apex, corner, corner, corners[(i + 1) % 4]);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(triangles, 3));
    geometry.computeVertexNormals();
    this.acceptance.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: '#f5d17f',
      side: THREE.DoubleSide, transparent: true, opacity: 0.12, depthWrite: false })));
    this.acceptance.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines),
      new THREE.LineBasicMaterial({ color: '#f5d17f', transparent: true, opacity: 0.8 })));
    this.acceptance.visible = !!this.showAcceptance;
    this.scene.add(this.acceptance);
  }

  setAcceptance(value) {
    this.showAcceptance = value;
    this.acceptance.visible = value;
  }

  setBoxOpen(value) {
    this.boxOpen = value;
    if (value) {
      this.hardware.load();
      this.controls.autoRotate = false;
      this.camera.position.set(-11, 3, 42);
      this.controls.target.set(1, -5, 13);
      this.controls.update();
    } else this.resetCamera();
  }

  alignReadoutPorts() {
    const ports = this.hardware.ports;
    if (this.portsAligned || !ports?.every(Boolean)) return;
    ports.slice(0, 3).forEach((port, i) => {
      this.readoutBoots[i].position.set(port.x - 1.35, port.y, port.z);
      this.readoutSockets[i].position.set(port.x - 0.45, port.y, port.z);
      const world = this.readout.localToWorld(port.clone());
      const points = smaLeadPoints(world, i);
      this.readoutLeads[i].geometry.dispose();
      this.readoutLeads[i].geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 30, 0.055, 6, false);
      this.beamCables[i].geometry.dispose();
      const guide = cableGuide(i);
      const vertical = [new THREE.Vector3(guide.x, TILE_Y[i] - 0.95, guide.z),
        new THREE.Vector3(guide.x, world.y, guide.z)];
      this.beamCables[i].geometry = new THREE.TubeGeometry(new THREE.LineCurve3(...vertical), 1, 0.055, 6, false);
    });
    this.terminator.position.copy(ports[3]).add(new THREE.Vector3(-0.5, 0, 0));
    this.portsAligned = true;
  }

  resetCamera() {
    this.camera.position.set(51.6, 33.6, 67.2);
    this.controls.target.set(0, -3, 0);
    this.controls.update();
  }

  resize() {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    this.camera.aspect = this.width / Math.max(1, this.height);
    this.camera.fov = this.width < 700 ? 52 : 40;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height, false);
  }

  setCutaway(value) {
    this.cutaway = value;
    for (const item of this.tiles) { item.cover.visible = !value; item.tile.visible = value; }
    this.topText.material.opacity = ENGRAVING_OPACITY;
    for (const fibre of this.fibres || []) fibre.visible = value;
    for (const padding of this.cushions || []) padding.material.opacity = value ? 0.055 : 0.2;
  }

  setPair(pair) {
    this.selectedPair = pair;
    this.clearTracks();
    this.buildAcceptance();
  }

  clearTracks() {
    for (const track of this.tracks) {
      this.scene.remove(track.line, track.head);
      track.line.geometry.dispose(); track.line.material.dispose(); track.head.material.dispose();
    }
    this.tracks = [];
    this.roomTracks = [];
    this.roomLines?.geometry.setDrawRange(0, 0);
  }

  addTrack(event) {
    if (this.paused || document.hidden) return;
    const age = Math.max(0, (Date.now() - event.at) / 1000);
    if (!event.path || age * DISPLAY_NS_PER_SECOND > event.durationNs) return;
    if (!event.hits.some(Boolean)) {
      if (this.roomTracks.length < this.roomCapacity) this.roomTracks.push({ event, age });
      return;
    }
    if (this.tracks.length >= 90) return;
    const selected = this.selectedPair === 'all' || event.pairs[this.selectedPair];
    const color = !selected ? '#83998c' : event.pairs.c02 ? PAIR_COLORS.c02 : event.pairs.c01 ? PAIR_COLORS.c01
      : event.pairs.c12 ? PAIR_COLORS.c12 : '#b5c8bb';
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((event.path.length + 2) * 3), 3));
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.65, depthTest: true }));
    line.frustumCulled = false;
    const head = new THREE.Mesh(this.dotGeometry, new THREE.MeshBasicMaterial({ color }));
    this.scene.add(line, head);
    this.tracks.push({ line, head, event, age, hit: [false, false, false], color });
  }

  flash(track, index) {
    this.hardware.flash(index);
    const y = TILE_Y[index];
    const crossing = track.event.crossings.find(hit => hit.index === index);
    const [x, , z] = crossing.point;
    this.flashes[index] = 1;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.4, 28), new THREE.MeshBasicMaterial({ color: track.color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y + 0.6, z);
    this.scene.add(ring);
    this.rings.push({ mesh: ring, age: 0 });
    this.fibreLights?.[index].excite(new THREE.Vector3(x, y + 0.34, z));
  }

  updateTracks(dt) {
    for (let i = this.roomTracks.length - 1; i >= 0; i--) {
      this.roomTracks[i].age += dt;
      if (this.roomTracks[i].age * DISPLAY_NS_PER_SECOND > this.roomTracks[i].event.durationNs) this.roomTracks.splice(i, 1);
    }
    const positions = this.roomLines.geometry.attributes.position;
    this.roomTracks.forEach(({ event, age }, i) => {
      const time = age * DISPLAY_NS_PER_SECOND;
      positions.setXYZ(i * 2, ...pointAtTime(event.path, time));
      positions.setXYZ(i * 2 + 1, ...pointAtTime(event.path, Math.max(0, time - 0.2)));
    });
    positions.needsUpdate = true;
    this.roomLines.geometry.setDrawRange(0, this.roomTracks.length * 2);
    for (let i = this.tracks.length - 1; i >= 0; i--) {
      const track = this.tracks[i];
      track.age += dt;
      const time = track.age * DISPLAY_NS_PER_SECOND;
      const tailTime = Math.max(0, time - 0.28);
      const visible = [pointAtTime(track.event.path, tailTime),
        ...track.event.path.filter(p => p.timeNs > tailTime && p.timeNs < time).map(p => p.position),
        pointAtTime(track.event.path, time)];
      const p = track.line.geometry.attributes.position;
      visible.forEach((point, j) => p.setXYZ(j, ...point));
      track.line.geometry.setDrawRange(0, visible.length);
      p.needsUpdate = true;
      track.head.position.set(...visible.at(-1));
      for (const crossing of track.event.crossings) if (!track.hit[crossing.index] && time >= crossing.timeNs) {
        track.hit[crossing.index] = true;
        if (track.event.hits[crossing.index]) this.flash(track, crossing.index);
      }
      track.line.material.opacity = 0.65;
      if (time > track.event.durationNs) {
        this.scene.remove(track.line, track.head);
        track.line.geometry.dispose(); track.line.material.dispose(); track.head.material.dispose();
        this.tracks.splice(i, 1);
      }
    }
    for (let index = 0; index < 3; index++) {
      this.flashes[index] *= Math.exp(-dt * 7);
      const item = this.tiles[index];
      item.tile.material.emissiveIntensity = 0.025 + this.flashes[index] * 0.95;
      item.tile.material.opacity = SCINTILLATOR_OPACITY + this.flashes[index] * 0.2;
      item.edges.material.opacity = 0.55 + this.flashes[index] * 0.4;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const item = this.rings[i];
      item.age += dt;
      item.mesh.scale.setScalar(1 + item.age * 9);
      item.mesh.material.opacity = Math.max(0, 0.7 - item.age * 1.4);
      if (item.age > 0.6) { this.scene.remove(item.mesh); item.mesh.geometry.dispose(); item.mesh.material.dispose(); this.rings.splice(i, 1); }
    }
    for (const light of this.fibreLights || []) light.update(dt, this.cutaway);
  }

  updateLabels() {
    this.labels.forEach((label, index) => {
      const point = new THREE.Vector3(-12.6, TILE_Y[index], 12.7).project(this.camera);
      const x = Math.max(18, Math.min(this.width - 123, (point.x + 1) / 2 * this.width - 115));
      const y = Math.max(153, Math.min(this.height - 215, (-point.y + 1) / 2 * this.height - 10));
      label.style.transform = `translate(${x}px, ${y}px)`;
    });
  }

  animate(now) {
    this.animationId = requestAnimationFrame(this.animate);
    if (document.hidden || now - this.lastFrame < 1000 / 30) return;
    const dt = Math.min(0.08, (now - (this.lastFrame || now)) / 1000);
    this.lastFrame = now;
    this.controls.update(dt);
    if (!this.paused) this.updateTracks(dt);
    const targetAngle = this.boxOpen ? 1.9 : 0;
    this.lidAngle += (targetAngle - this.lidAngle) * Math.min(1, dt * 7);
    if (this.sourceCaseReady) {
      this.lid.rotation.y = 0;
      this.lid.rotation.x = Math.PI - this.lidAngle;
    } else this.lid.rotation.y = this.lidAngle;
    this.alignReadoutPorts();
    if (!this.paused) this.hardware.update(dt);
    this.updateLabels();
    this.renderer.render(this.scene, this.camera);
  }
}

import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { loadBoard } from './hardware.js';
import { identifyNet } from './probe-signals.js';
import { layoutProbeLabels } from './probe-labels.js';
import { CHANNEL_COLOURS } from './probe-scope.js';
import { netOnFace } from './probe-nets.js';

export class ProbeBoard {
  constructor(host, data, onPick, onHover) {
    this.host = host;
    this.data = data;
    this.onPick = onPick;
    this.onHover = onHover;
    this.side = 'front';
    this.channel = 0;
    this.showAll = false;
    this.probes = [];
    // Pages uses a <base> for versioned assets; marker IDs belong to this document.
    this.markerUrls = ['a', 'b'].map(letter => new URL(`#arrow-${letter}`, window.location.href).href);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#18211e');
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1500);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.append(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    this.controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 28;
    this.controls.maxDistance = 250;
    this.controls.addEventListener('change', () => this.render());
    this.scene.add(new THREE.HemisphereLight('#eef9f4', '#85928a', 2.3));
    const light = new THREE.DirectionalLight('#ffffff', 3.2);
    light.position.set(-40, 100, 45);
    this.scene.add(light);
    const backLight = new THREE.DirectionalLight('#e4f2ff', 2);
    backLight.position.set(30, -70, -40);
    this.scene.add(backLight);
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', event => { this.down = [event.clientX, event.clientY]; });
    canvas.addEventListener('pointerup', event => {
      if (this.down && Math.hypot(event.clientX - this.down[0], event.clientY - this.down[1]) < 5) {
        const pad = this.pick(event);
        if (pad) this.onPick(pad);
      }
    });
    canvas.addEventListener('pointermove', event => {
      const pad = this.pick(event);
      this.onHover(pad);
      canvas.style.cursor = pad ? 'crosshair' : 'grab';
    });
    canvas.addEventListener('pointerleave', () => this.onHover(null));
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.setView('front');
  }

  async load() {
    const { body } = await loadBoard('./assets/readout-assembly.glb', [0, 0, 0], [], 'J2');
    // Keep the export's native axes, in millimetres, for exact KiCad pad placement.
    body.rotation.set(0, 0, 0);
    body.scale.setScalar(1000);
    body.position.set(0, 0, 0);
    body.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(body);
    this.centre = bounds.getCenter(new THREE.Vector3());
    this.centre.y = 0;
    body.position.sub(this.centre);
    this.group.add(body);
    this.body = body;
    this.padMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.48, 10, 6),
      new THREE.MeshBasicMaterial({ depthTest: false, transparent: true, opacity: 0.85 }), this.data.pads.length);
    this.padMesh.renderOrder = 20;
    this.padMesh.frustumCulled = false;
    this.scene.add(this.padMesh);
    this.updatePads();
    this.render();
  }

  padPosition(pad) {
    return new THREE.Vector3(pad.x - this.centre.x,
      this.side === 'back' ? -0.2 : this.data.thickness + 0.1, pad.z - this.centre.z);
  }

  updatePads() {
    if (!this.padMesh) return;
    const matrix = new THREE.Matrix4();
    this.pickPads = [];
    this.data.pads.forEach((pad, index) => {
      const descriptor = identifyNet(pad.net);
      const active = descriptor.channel === this.channel;
      const selected = this.probes.findIndex(probe => probe?.net === pad.net);
      const visible = (this.side === 'back' ? pad.back : pad.front)
        && (this.showAll || active || this.probes.some(probe => probe?.net === pad.net));
      const size = visible ? selected >= 0 ? 1.2 : active ? 0.75 : 0.55 : 0;
      const position = this.padPosition(pad);
      matrix.compose(position, new THREE.Quaternion(), new THREE.Vector3(size, size, size));
      this.padMesh.setMatrixAt(index, matrix);
      this.padMesh.setColorAt(index, new THREE.Color(selected >= 0 ? CHANNEL_COLOURS[selected] : descriptor.type === 'unknown' ? '#7d8984'
        : descriptor.type === 'hv' ? '#ed8c7b' : active ? '#9eedd0' : '#b2bbc0'));
      if (visible) this.pickPads.push(pad);
    });
    this.padMesh.instanceMatrix.needsUpdate = true;
    if (this.padMesh.instanceColor) this.padMesh.instanceColor.needsUpdate = true;
    this.updateNetTracks();
    this.render();
  }

  updateNetTracks() {
    this.netHighlights = this.probes.map(pad => netOnFace(this.data, pad?.net, this.side));
  }

  setProbes(probes) { this.probes = probes; this.updatePads(); }
  setFilter(channel, all) { this.channel = channel; this.showAll = all; this.updatePads(); }

  setView(view) {
    this.side = view === 'back' ? 'back' : 'front';
    this.controls.enableRotate = view === '3d';
    this.camera.up.set(0, 0, -1);
    this.camera.position.set(...(view === '3d' ? [60, 95, 60] : view === 'back' ? [0, -125, 0] : [0, 125, 0]));
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.updatePads();
    this.render();
  }

  pick(event) {
    if (!this.centre) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(event.clientX - rect.left, event.clientY - rect.top);
    let nearest = null, distance = 12;
    for (const pad of this.pickPads) {
      const projected = this.padPosition(pad).project(this.camera);
      const point = new THREE.Vector2((projected.x + 1) * rect.width / 2, (1 - projected.y) * rect.height / 2);
      const delta = point.distanceTo(mouse);
      if (delta < distance) { nearest = pad; distance = delta; }
    }
    if (nearest) return nearest;
    // A surface track has the same electrical identity as any pad on that net.
    this.pointer.set(mouse.x / rect.width * 2 - 1, 1 - mouse.y / rect.height * 2);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), this.side === 'back' ? 0.2 : -this.data.thickness - 0.1);
    const hit = this.raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    if (!hit) return null;
    let best = 0.3;
    for (const track of this.data.tracks) {
      if (track.front !== (this.side !== 'back')) continue;
      const descriptor = identifyNet(track.net);
      if (!this.showAll && descriptor.channel !== this.channel) continue;
      const a = new THREE.Vector2(...track.a), b = new THREE.Vector2(...track.b);
      const p = new THREE.Vector2(hit.x + this.centre.x, hit.z + this.centre.z);
      const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / (ab.lengthSq() || 1)));
      const delta = a.addScaledVector(ab, t).distanceTo(p);
      if (delta < best) { best = delta; nearest = this.data.pads.find(pad => pad.net === track.net && (this.side === 'back' ? pad.back : pad.front)); }
    }
    return nearest;
  }

  resize() {
    const width = this.host.clientWidth, height = this.host.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
    this.host.dataset.ready = String(Boolean(this.body));
    if (!this.centre) return;
    const width = this.host.clientWidth, height = this.host.clientHeight;
    const points = this.probes.map(pad => {
      if (!pad) return null;
      const point = this.padPosition(pad).project(this.camera);
      return { x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2,
        visible: (this.side === 'back' ? pad.back : pad.front) && point.z > -1 && point.z < 1 };
    });
    const layout = layoutProbeLabels(points, width, height);
    const overlay = document.getElementById('probe-leaders');
    overlay?.setAttribute('viewBox', `0 0 ${width} ${height}`);
    // Screen-space strokes stay readable when zooming; coordinates still come from KiCad.
    const project = (x, z) => {
      const point = this.padPosition({ x, z }).project(this.camera);
      return [(point.x + 1) * width / 2, (1 - point.y) * height / 2];
    };
    this.netHighlights?.forEach((net, index) => {
      const highlight = document.getElementById(`probe-net-${index}`);
      if (!highlight) return;
      const paths = net.tracks.map(track => `M ${project(...track.a).join(' ')} L ${project(...track.b).join(' ')}`);
      net.pads.forEach(pad => {
        const [x, y] = project(pad.x, pad.z);
        paths.push(`M ${x - 3} ${y} a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0`);
      });
      highlight.setAttribute('d', paths.join(' '));
      highlight.dataset.net = this.probes[index]?.net || '';
      highlight.dataset.pads = String(net.pads.length);
      highlight.dataset.tracks = String(net.tracks.length);
    });
    this.probes.forEach((pad, index) => {
      const label = document.getElementById(`board-probe-${index}`);
      const arrow = document.getElementById(`probe-arrow-${index}`);
      const ring = document.getElementById(`probe-target-${index}`);
      const item = layout[index];
      if (!label) return;
      label.hidden = !item;
      if (arrow) arrow.style.display = item ? '' : 'none';
      if (ring) ring.style.display = item ? '' : 'none';
      if (!item) return;
      label.style.left = `${item.box.x}px`;
      label.style.top = `${item.box.y}px`;
      label.style.width = `${item.box.width}px`;
      label.textContent = `${index === 0 ? 'A' : 'B'}  ${pad.id}`;
      arrow?.setAttribute('d', item.path);
      arrow?.setAttribute('marker-end', `url("${this.markerUrls[index]}")`);
      ring?.setAttribute('cx', item.target.x);
      ring?.setAttribute('cy', item.target.y);
    });
  }
}

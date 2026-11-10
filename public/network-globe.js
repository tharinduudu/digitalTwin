import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { groupLocations, STATUS } from './network-data.js';

const RADIUS = 1.2;
export function globePosition(latitude, longitude, radius = RADIUS) {
  const lat = latitude * Math.PI / 180;
  const lon = longitude * Math.PI / 180;
  return new THREE.Vector3(radius * Math.cos(lat) * Math.cos(lon), radius * Math.sin(lat), -radius * Math.cos(lat) * Math.sin(lon));
}

// Natural Earth's land polygons become a local equirectangular texture. No map API is used.
function landTexture(land) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#d9e6e1';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#7c9b83';
  ctx.strokeStyle = '#58765e';
  ctx.lineWidth = 0.7;
  for (const feature of land.features) {
    const polygons = feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates : [feature.geometry.coordinates];
    for (const polygon of polygons) {
      ctx.beginPath();
      for (const ring of polygon) {
        ring.forEach(([lon, lat], i) => {
          const x = (lon + 180) / 360 * canvas.width;
          const y = (90 - lat) / 180 * canvas.height;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();
      }
      ctx.fill('evenodd');
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class NetworkGlobe {
  constructor(container, labels, stations, land, onSelect) {
    this.container = container;
    this.labels = labels;
    this.onSelect = onSelect;
    this.groups = groupLocations(stations);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#edf0e9');
    this.camera = new THREE.PerspectiveCamera(39, 1, 0.1, 30);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.append(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.7;
    this.controls.maxDistance = 6.8;
    this.controls.autoRotateSpeed = 0.35;
    this.controls.addEventListener('start', () => { this.destination = null; });
    this.scene.add(new THREE.AmbientLight('#d7eeed', 2));
    const sun = new THREE.DirectionalLight('#fff2d5', 1.5);
    sun.position.set(4, 5, 3);
    this.scene.add(sun);
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 96, 64),
      new THREE.MeshStandardMaterial({ map: landTexture(land), roughness: 1, metalness: 0 }));
    this.scene.add(this.earth);
    this.addGraticule();
    this.markers = [];
    this.raycaster = new THREE.Raycaster();
    for (const group of this.groups) this.addMarker(group);
    let down;
    this.renderer.domElement.addEventListener('pointerdown', event => { down = [event.clientX, event.clientY]; });
    this.renderer.domElement.addEventListener('pointerup', event => {
      if (!down || Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 5) return;
      const bounds = this.renderer.domElement.getBoundingClientRect();
      this.raycaster.setFromCamera(new THREE.Vector2((event.clientX - bounds.left) / bounds.width * 2 - 1,
        -(event.clientY - bounds.top) / bounds.height * 2 + 1), this.camera);
      const hit = this.raycaster.intersectObjects([this.earth, ...this.markers], false)[0];
      if (hit?.object.userData.group) this.chooseGroup(hit.object.userData.group);
    });
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.home(false);
    this.resize();
    this.animate = this.animate.bind(this);
    this.frame = requestAnimationFrame(this.animate);
    container.dataset.ready = 'true';
    container.dataset.locations = String(this.groups.length);
  }

  addGraticule() {
    const material = new THREE.LineBasicMaterial({ color: '#405f50', transparent: true, opacity: 0.11 });
    const line = points => this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material));
    for (let lat = -60; lat <= 60; lat += 30) {
      line(Array.from({ length: 181 }, (_, i) => globePosition(lat, i * 2 - 180, RADIUS + 0.002)));
    }
    for (let lon = -180; lon < 180; lon += 30) {
      line(Array.from({ length: 91 }, (_, i) => globePosition(i * 2 - 90, lon, RADIUS + 0.002)));
    }
  }

  addMarker(group) {
    const key = group.stations.some(s => s.status === 'review') ? 'review' :
      group.stations.some(s => s.status === 'recent') ? 'recent' :
      group.stations.some(s => s.status === 'older') ? 'older' : 'missing';
    const position = globePosition(group.latitude, group.longitude, RADIUS + 0.017);
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), new THREE.MeshBasicMaterial({ color: STATUS[key].color }));
    marker.position.copy(position);
    marker.userData.group = group;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.033, 0.039, 32), new THREE.MeshBasicMaterial({ color: STATUS[key].color, transparent: true, opacity: 0.65, side: THREE.DoubleSide }));
    ring.position.copy(position);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), position.clone().normalize());
    this.scene.add(marker, ring);
    const label = document.createElement('button');
    label.className = 'location-label';
    const place = group.stations[0];
    label.textContent = `${place.id === 'Singapore_BrasBasah_1' ? 'Singapore' : place.city.split(',')[0]}${group.stations.length > 1 ? ` (${group.stations.length})` : ''}`;
    label.title = group.stations.map(s => s.displayName).join('\n');
    label.addEventListener('click', () => this.chooseGroup(group));
    this.labels.append(label);
    group.marker = marker;
    group.ring = ring;
    group.label = label;
    this.markers.push(marker);
  }

  chooseGroup(group) {
    const station = group.stations.find(s => s.status === 'recent') || group.stations[0];
    this.onSelect(station.id);
  }

  select(id, focus = true) {
    this.selected = id;
    const group = this.groups.find(g => g.stations.some(s => s.id === id));
    for (const g of this.groups) {
      const selected = group === g;
      g.label.classList.toggle('selected', selected);
      g.ring.scale.setScalar(selected ? 1.6 : 1);
      g.marker.scale.setScalar(selected ? 1.4 : 1);
    }
    if (focus && group) {
      this.controls.autoRotate = false;
      this.destination = globePosition(group.latitude, group.longitude, 4.2 * Math.max(1, 1 / this.camera.aspect));
    }
  }

  setVisible(ids) {
    for (const group of this.groups) {
      group.filtered = !group.stations.some(s => ids.has(s.id));
      group.marker.visible = !group.filtered;
      group.ring.visible = !group.filtered;
    }
  }

  home(animate = true) {
    const position = globePosition(22, -20, 4.4 * Math.max(1, 1 / this.camera.aspect));
    if (animate) this.destination = position; else this.camera.position.copy(position);
  }

  zoom(factor) {
    this.destination = this.camera.position.clone().setLength(THREE.MathUtils.clamp(this.camera.position.length() * factor, 1.8, this.controls.maxDistance));
  }

  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    this.width = width;
    this.height = height;
    const previousScale = Math.max(1, 1 / this.camera.aspect);
    this.camera.aspect = width / Math.max(1, height);
    const scale = Math.max(1, 1 / this.camera.aspect);
    this.camera.position.multiplyScalar(scale / previousScale);
    this.destination?.multiplyScalar(scale / previousScale);
    this.controls.maxDistance = 6.8 * scale;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    this.frame = requestAnimationFrame(this.animate);
    if (document.hidden) return;
    if (this.destination) {
      const fraction = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 0.065;
      const distance = THREE.MathUtils.lerp(this.camera.position.length(), this.destination.length(), fraction);
      this.camera.position.normalize().lerp(this.destination.clone().normalize(), fraction).normalize().multiplyScalar(distance);
      if (this.camera.position.distanceTo(this.destination) < 0.003) this.destination = null;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    const occupied = [];
    // Selected labels win collisions. Occluded locations never show through Earth.
    const ordered = [...this.groups].sort((a, b) => Number(b.stations.some(s => s.id === this.selected)) - Number(a.stations.some(s => s.id === this.selected)));
    for (const group of ordered) {
      const point = group.marker.position;
      const front = point.dot(this.camera.position.clone().sub(point)) > 0;
      const screen = point.clone().project(this.camera);
      const x = (screen.x * 0.5 + 0.5) * this.width;
      const y = (-screen.y * 0.5 + 0.5) * this.height - 14;
      const crowded = occupied.some(p => Math.abs(p.x - x) < 112 && Math.abs(p.y - y) < 32);
      const visible = front && !group.filtered && !crowded && x > 45 && x < this.width - 45 && y > 125 && y < this.height - 110;
      group.label.hidden = !visible;
      if (visible) {
        group.label.style.left = `${x}px`;
        group.label.style.top = `${y}px`;
        occupied.push({ x, y });
      }
    }
    this.container.dataset.camera = this.camera.position.toArray().map(v => v.toFixed(3)).join(',');
  }
}

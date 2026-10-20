import * as THREE from './vendor/three.module.js';
import { FLOOR_Y } from './detector-geometry.js';

// Scene lengths are centimetres. These scales share an origin just outside
// the frame, rather than suggesting that the frame itself is 27 cm wide.
export const RULERS = [
  { axis: 'X', length: 27, direction: [1, 0, 0], outside: [0, 0, 1] },
  { axis: 'Y', length: 32, direction: [0, 1, 0], outside: [-1, 0, 0] },
  { axis: 'Z', length: 27, direction: [0, 0, -1], outside: [-1, 0, 0] },
];
export const RULER_ORIGIN = [-13.5, FLOOR_Y + 0.2, 13.5];

export function rulerTicks(length) {
  return Array.from({ length: Math.floor(length) + 1 }, (_, value) =>
    ({ value, major: value % 5 === 0 }));
}

function label(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  context.font = '52px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#c5d0cc';
  context.fillText(text, 128, 48);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture,
    transparent: true, opacity: 0.48, depthWrite: false, toneMapped: false }));
  sprite.scale.set(2.5, 0.94, 1);
  return sprite;
}

export function createRulers() {
  const group = new THREE.Group();
  group.name = 'Centimetre rulers';
  const origin = new THREE.Vector3(...RULER_ORIGIN);
  const vertices = [];
  for (const ruler of RULERS) {
    const direction = new THREE.Vector3(...ruler.direction);
    const outside = new THREE.Vector3(...ruler.outside);
    const point = value => origin.clone().addScaledVector(direction, value);
    vertices.push(origin, point(ruler.length));
    for (const tick of rulerTicks(ruler.length)) {
      const start = point(tick.value);
      vertices.push(start, start.clone().addScaledVector(outside, tick.major ? 0.38 : 0.2));
      if (tick.major && (tick.value || ruler.axis === 'X')) {
        const number = label(String(tick.value));
        number.position.copy(start).addScaledVector(outside, 0.85);
        if (!direction.y) number.position.y += 0.5;
        group.add(number);
      }
    }
    const name = label(`${ruler.axis} / cm`);
    name.scale.x = 3.6;
    name.position.copy(point(ruler.length + 1.2));
    if (!direction.y) name.position.y += 0.5;
    group.add(name);
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(vertices);
  group.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
    color: '#a7b9af', transparent: true, opacity: 0.25, depthWrite: false })));
  return group;
}

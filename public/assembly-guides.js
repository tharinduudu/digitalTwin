import * as THREE from './vendor/three.module.js';
import { TILE_HEIGHTS } from './detector-geometry.js';

export const FRAME_LEVELS = ['Top', 'Middle', 'Bottom'];

// Names refer to the finished detector, even while the frame is upside down.
export function frameGuideState(steps, index, progress = 1, complete = false) {
  const remaining = steps.findIndex(step => step.id === 'upper-rails');
  const tiles = steps.findIndex(step => step.id === 'tiles');
  const show = !complete && index < tiles;
  const afterRails = index > remaining;
  return {
    levels: [show, show && (afterRails || index === remaining && progress >= .5),
      show && (afterRails || index === remaining && progress >= 1)],
    spacing: [show && index >= remaining, show && (afterRails || index === remaining && progress >= .5)],
  };
}

function textLabel(text, color) {
  const canvas = document.createElement('canvas');
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.font = '600 80px Arial';
  canvas.width = Math.ceil(context.measureText(text).width) + 48;
  context.fillStyle = 'rgba(16, 24, 21, 0.88)';
  context.fillRect(0, 4, canvas.width, 120);
  context.fillStyle = color;
  context.font = '600 80px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture,
    depthTest: false, depthWrite: false, toneMapped: false, sizeAttenuation: false }));
  sprite.userData.labelAspect = canvas.width / canvas.height;
  sprite.renderOrder = 60;
  sprite.name = text;
  return sprite;
}

export function createFrameGuides(makeLabel = textLabel) {
  const group = new THREE.Group();
  group.name = 'Frame level names and centre-to-centre spacing';
  const levels = FRAME_LEVELS.map((name, index) => {
    const label = makeLabel(name.toUpperCase(), '#f1f5f2');
    label.position.set(0, TILE_HEIGHTS[index], 0);
    group.add(label);
    return label;
  });
  const dimensions = TILE_HEIGHTS.slice(0, -1).map((upper, index) => {
    const lower = TILE_HEIGHTS[index + 1];
    const dimension = new THREE.Group();
    dimension.name = `${FRAME_LEVELS[index]} to ${FRAME_LEVELS[index + 1]}: ${upper - lower} cm centre to centre`;
    const vertices = [];
    const segment = (a, b) => vertices.push(new THREE.Vector3(...a), new THREE.Vector3(...b));
    segment([14.3, lower, 0], [14.3, upper, 0]);
    for (const [y, direction] of [[lower, 1], [upper, -1]]) {
      segment([11.16, y, 0], [14.9, y, 0]);
      segment([14.3, y, 0], [13.95, y + direction * .8, 0]);
      segment([14.3, y, 0], [14.65, y + direction * .8, 0]);
    }
    const line = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(vertices),
      new THREE.LineBasicMaterial({ color: '#f3c765', depthTest: false, depthWrite: false }));
    line.renderOrder = 55;
    const label = makeLabel(`${upper - lower} cm`, '#f3c765');
    label.position.set(17.8, (upper + lower) / 2, 0);
    dimension.add(line, label);
    group.add(dimension);
    return dimension;
  });
  return { group, levels, dimensions, update(state, camera, viewportHeight) {
    levels.forEach((label, index) => { label.visible = state.levels[index]; });
    dimensions.forEach((dimension, index) => { dimension.visible = state.spacing[index]; });
    // Keep annotations readable on a phone without making their 3D positions drift.
    if (camera && viewportHeight > 0) {
      const height = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 22 / viewportHeight;
      for (const label of [...levels, ...dimensions.map(dimension => dimension.children[1])]) {
        label.scale.set(height * label.userData.labelAspect, height, 1);
      }
    }
  } };
}

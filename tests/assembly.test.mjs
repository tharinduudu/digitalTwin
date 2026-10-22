import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ASSEMBLY_STEPS, smoothAssembly, visibleAtStep } from '../public/assembly-steps.js';
import { railPose, railProgress, nutLoadingProgress, bracketInsertionProgress, orderRailNuts, sideInsertionPose,
  fasteningProgress, screwPose, assemblyTime, assemblyPosition, ASSEMBLY_FINISH, ASSEMBLY_SPEED, hingedCoverAngle,
  layerFasteningView, nutNeedsReminder, nutReminderPulse, ASSEMBLY_FOLLOW_DEFAULT, assemblyCameraStage, frameBuildPose } from '../public/assembly-motion.js';
import { LINER_SIZE, TILE_OUTLINE, FLOOR_Y } from '../public/detector-geometry.js';
import * as THREE from '../public/vendor/three.module.js';
import { addCornerBrackets } from '../public/corner-brackets.js';
import { createNutGeometry, NUT_ROLES } from '../public/tslot-nut-geometry.js';
import { tapeSiPMHolder } from '../public/assembly-tape.js';
import { SENSOR_BOARD } from '../public/sipm-mount.js';
import { createCarriedCoax } from '../public/assembly-cables.js';
import { createPiFixings, cablePassage, createCutCornerGuide } from '../public/assembly-hardware.js';
import { caseMounts, cableGuide } from '../public/readout-placement.js';

test('numbered nuts follow an insertable order, including a sheet nut between two joint nuts', () => {
  const nut = (id, x, y, role) => ({ id, rest: { x, y, z: 0 }, role, location: y > 0 ? 'Upper groove' : 'Lower groove' });
  const plan = orderRailNuts([nut('near-joint', -8, 0.6, 'joint'), nut('far-joint', 8, 0.6, 'joint'),
    nut('lower-sheet', 0, -0.6, 'acrylic'), nut('middle-sheet', 0, 0.6, 'acrylic')], 'x', 'z');
  assert.deepEqual(plan.map(nut => nut.id), ['far-joint', 'middle-sheet', 'near-joint', 'lower-sheet']);
  assert.deepEqual(plan.map(nut => nut.loadOrder + 1), [1, 2, 3, 4]);
  for (let i = 1; i < plan.length; i++) {
    const previousFinished = 0.6 * i / plan.length;
    assert.equal(nutLoadingProgress(previousFinished, plan[i].loadOrder, plan.length), 0);
    assert.equal(nutLoadingProgress(previousFinished, plan[i - 1].loadOrder, plan.length), 1);
  }
  assert.ok(plan.every(nut => nutLoadingProgress(0.6, nut.loadOrder, plan.length) === 1));
  for (let tick = 0; tick <= 100; tick++) {
    const progress = tick / 100;
    if (bracketInsertionProgress(progress) > 0) assert.ok(plan.every(nut =>
      nutLoadingProgress(progress, nut.loadOrder, plan.length) === 1));
  }
});

test('the complete loose coax and its SMA end travel with the preassembled tile', () => {
  const route = new THREE.CurvePath();
  route.add(new THREE.LineCurve3(new THREE.Vector3(-10, -0.95, 10), new THREE.Vector3(-10, -15, 10)));
  route.add(new THREE.CatmullRomCurve3([new THREE.Vector3(-10, -15, 10),
    new THREE.Vector3(-10, -15, 13), new THREE.Vector3(-7, -15, 15), new THREE.Vector3(-4, -15, 15)]));
  const lead = createCarriedCoax(route, new THREE.MeshStandardMaterial());
  assert.ok(Math.abs(lead.loose.getLength() - route.getLength()) < 1e-5);
  const tile = new THREE.Group();
  tile.add(lead.group);
  const plug = new THREE.Mesh(new THREE.CylinderGeometry());
  lead.plug.add(plug);
  lead.update(0);
  const before = plug.getWorldPosition(new THREE.Vector3());
  tile.position.set(0, 3.5, 27);
  const after = plug.getWorldPosition(new THREE.Vector3());
  assert.ok(after.sub(before).distanceTo(new THREE.Vector3(0, 3.5, 27)) < 1e-10);
  const cable = lead.cable;
  const connector = lead.plug;
  let previous = lead.plug.position.clone();
  for (let i = 0; i <= 100; i++) {
    lead.update(i / 100);
    assert.ok(lead.cable.geometry.parameters.path.getPoint(0).distanceTo(route.getPoint(0)) < 1e-10);
    assert.ok(lead.plug.position.distanceTo(previous) < 1);
    assert.equal(lead.cable, cable);
    assert.equal(lead.plug, connector);
    previous = lead.plug.position.clone();
  }
  assert.ok(lead.plug.position.distanceTo(route.getPointAt(1)) < 1e-10);
  const seated = lead.cable.geometry;
  lead.update(1);
  assert.equal(lead.cable.geometry, seated);
});

test('light-blocking tape keeps the holder CAD outline instead of adding a triangular solid', () => {
  const geometry = new THREE.BoxGeometry(4, 1.5, 3);
  const holder = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  const sensor = new THREE.Group();
  const outline = Array.from(geometry.attributes.position.array);
  const patch = tapeSiPMHolder(holder, sensor);
  assert.equal(holder.geometry, geometry);
  assert.deepEqual(Array.from(geometry.attributes.position.array), outline);
  assert.equal(holder.material.transparent, false);
  assert.equal(holder.material.opacity, 1);
  assert.equal(sensor.children.length, 1);
  assert.equal(patch.geometry.parameters.depth, 0.02);
  assert.ok(patch.geometry.parameters.width < 1.5);
  assert.equal(patch.position.x, SENSOR_BOARD.centreX);
  assert.equal(patch.userData.lightBlockingTape, true);
});

test('supplied nut mesh retains its 15 x 8 x 3 mm dimensions without the screw', async () => {
  const binary = await readFile(new URL('../public/assets/tslot-nut.glb', import.meta.url));
  assert.equal(binary.readUInt32LE(0), 0x46546c67);
  const jsonLength = binary.readUInt32LE(12);
  const gltf = JSON.parse(binary.subarray(20, 20 + jsonLength));
  const dataStart = 28 + jsonLength;
  const attribute = id => {
    const accessor = gltf.accessors[id];
    const view = gltf.bufferViews[accessor.bufferView];
    const offset = dataStart + (view.byteOffset || 0) + (accessor.byteOffset || 0);
    const width = accessor.type === 'VEC3' ? 3 : 1;
    const bytes = accessor.componentType === 5123 ? 2 : 4;
    return Array.from({ length: accessor.count * width }, (_, index) => accessor.componentType === 5126
      ? binary.readFloatLE(offset + index * bytes) : bytes === 2
        ? binary.readUInt16LE(offset + index * bytes) : binary.readUInt32LE(offset + index * bytes));
  };
  const nodes = gltf.nodes.map(source => {
    const node = new THREE.Group();
    if (source.translation) node.position.fromArray(source.translation);
    if (source.mesh !== undefined) for (const primitive of gltf.meshes[source.mesh].primitives) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(attribute(primitive.attributes.POSITION), 3));
      geometry.setIndex(attribute(primitive.indices));
      node.add(new THREE.Mesh(geometry));
    }
    return node;
  });
  gltf.nodes.forEach((node, index) => node.children?.forEach(child => nodes[index].add(nodes[child])));
  const scene = new THREE.Group();
  gltf.scenes[0].nodes.forEach(index => scene.add(nodes[index]));
  const result = createNutGeometry(scene);
  const size = result.boundingBox.getSize(new THREE.Vector3());
  [1.5, 0.8, 0.3].forEach((expected, index) => assert.ok(Math.abs(size.getComponent(index) - expected) < 1e-6));
  assert.ok(result.attributes.position.count > 3000);
  assert.ok(result.boundingBox.getCenter(new THREE.Vector3()).length() < 1e-6);
});

test('nut map separates joint, sheet and box fixings with text as well as colour', () => {
  assert.deepEqual(Object.keys(NUT_ROLES), ['joint', 'acrylic', 'case']);
  assert.equal(new Set(Object.values(NUT_ROLES).map(role => role.color)).size, 3);
  assert.ok(Object.values(NUT_ROLES).every(role => role.label.length > 5));
});

test('the faster sequence retains four nominal seconds per rail or stacked layer', () => {
  for (const [id, parts] of [['top-prefit', 4], ['upper-prefit', 8], ['top-rails', 4],
    ['upper-rails', 8], ['lower-acrylic', 3], ['lower-liner', 3], ['tiles', 3],
    ['upper-liner', 3], ['upper-acrylic', 3]]) {
    assert.equal(ASSEMBLY_STEPS.find(step => step.id === id).duration / parts, 4);
  }
  assert.equal(ASSEMBLY_SPEED, 1);
  assert.ok(assemblyTime(ASSEMBLY_STEPS, ASSEMBLY_STEPS.length - 1, 1) / ASSEMBLY_SPEED < 260);
});

test('the default camera holds an overview across related steps instead of chasing parts', () => {
  assert.equal(ASSEMBLY_FOLLOW_DEFAULT, false);
  for (const detail of ['frame', 'joint', 'joining', 'stack', 'sensor']) {
    assert.equal(assemblyCameraStage(detail), 'frame');
  }
  assert.equal(assemblyCameraStage('readout'), 'readout');
  assert.equal(assemblyCameraStage('bench'), 'bench');
});

test('timeline seeking round-trips across steps and clamps at both ends', () => {
  for (let index = 0; index < ASSEMBLY_STEPS.length; index++) for (const progress of [0.01, 0.25, 0.75, 0.99]) {
    const position = assemblyPosition(ASSEMBLY_STEPS, assemblyTime(ASSEMBLY_STEPS, index, progress));
    assert.equal(position.index, index);
    assert.ok(Math.abs(position.progress - progress) < 1e-12);
  }
  assert.deepEqual(assemblyPosition(ASSEMBLY_STEPS, -10), { index: 0, progress: 0 });
  assert.deepEqual(assemblyPosition(ASSEMBLY_STEPS, 9999), { index: ASSEMBLY_STEPS.length - 1, progress: 1 });
});

test('fasteners are inserted after part seating and spin towards a fixed captive nut', () => {
  assert.equal(fasteningProgress(.55, 0, 4), 0);
  assert.equal(screwPose(0).visible, false);
  assert.equal(screwPose(1).distance, 0);
  assert.equal(screwPose(1).turning, false);
  assert.equal(screwPose(.5).turning, true);
  let previous = Infinity;
  for (let tick = 0; tick <= 100; tick++) {
    const p = tick / 100;
    assert.ok(screwPose(p).distance <= previous);
    previous = screwPose(p).distance;
    const screws = Array.from({ length: 4 }, (_, index) => fasteningProgress(p, index, 4));
    assert.ok(screws.filter(value => value > 0 && value < 1).length <= 1);
  }
});

test('the screw view frames a complete layer rather than each fastener', () => {
  const view = layerFasteningView(-13.95);
  assert.deepEqual(view.target, [0, -13.95, 0]);
  assert.ok(Math.hypot(...view.offset) > 45);
  for (let screw = 0; screw < 4; screw++) {
    assert.deepEqual(layerFasteningView(-13.95), view);
  }
});

test('end-load warnings appear before closing access, not during later tile installation', () => {
  const bottom = { prefit: 'top-prefit', join: 'top-rails' };
  const upper = { prefit: 'upper-prefit', join: 'upper-rails' };
  assert.equal(nutNeedsReminder('post-nuts', bottom, true), true);
  assert.equal(nutNeedsReminder('post-nuts', upper, true), false);
  for (const unit of [bottom, upper]) {
    assert.equal(nutNeedsReminder(unit.prefit, unit), true);
    assert.equal(nutNeedsReminder(unit.join, unit), true);
    assert.equal(nutNeedsReminder(unit.join, unit, true), true);
    for (const step of ['tiles', 'lower-acrylic', 'pi', 'complete']) {
      assert.equal(nutNeedsReminder(step, unit), false);
    }
  }
});

test('nut reminders pulse slowly without hiding completely and respect reduced motion', () => {
  assert.ok(nutReminderPulse(0).opacity > nutReminderPulse(1).opacity);
  assert.deepEqual(nutReminderPulse(0), nutReminderPulse(2));
  for (const seconds of [0, .5, 1, 1.5, 2]) {
    assert.ok(nutReminderPulse(seconds).opacity >= .35);
    assert.ok(nutReminderPulse(seconds).opacity <= .95);
    assert.deepEqual(nutReminderPulse(seconds, true), nutReminderPulse(0, true));
  }
});

test('four Pi screws line up with the enclosure supports and do not carry T-nuts', () => {
  const screws = createPiFixings(new THREE.MeshStandardMaterial());
  assert.equal(screws.length, 4);
  screws.forEach((screw, index) => {
    assert.equal(screw.children.length, 4);
    assert.ok(screw.position.distanceTo(caseMounts()[index].add(new THREE.Vector3(0, 0, .18))) < 1e-12);
    assert.equal(screw.userData.drive, 'phillips');
    assert.equal(screw.children[0].geometry.parameters.shapes.holes[0].curves.length, 12);
  });
});

test('the enclosure is one hinged assembly and closure does not detach its lid', () => {
  assert.equal(hingedCoverAngle(0), 1.9);
  assert.equal(hingedCoverAngle(1), 0);
  assert.ok(hingedCoverAngle(.25) > hingedCoverAngle(.75));
  assert.match(ASSEMBLY_STEPS.find(step => step.id === 'case').actions.join(' '), /lid stays attached/);
  assert.match(ASSEMBLY_STEPS.find(step => step.id === 'lid').actions.join(' '), /already attached/);
});

test('cable passages are in the clear inside corner beside each SiPM adapter', () => {
  [12.05, -.95, -13.95].forEach((height, index) => {
    const point = cablePassage(height, index);
    assert.equal(point.x, cableGuide(index).x);
    assert.equal(point.z, cableGuide(index).z);
    assert.equal(point.y, height + .35);
    assert.ok(point.x - .055 > -10.16 && point.z + .055 < 10.16);
  });
});

test('the cable guide marks the actual tile cut corner, not a hole through the frame', () => {
  const guide = createCutCornerGuide();
  const vertices = guide.getObjectByName('Actual cut-corner outline').geometry.attributes.position;
  const points = Array.from({ length: vertices.count }, (_, i) => [vertices.getX(i), vertices.getZ(i)]);
  const expected = [TILE_OUTLINE[1], TILE_OUTLINE[2], [TILE_OUTLINE[1][0], TILE_OUTLINE[2][1]]];
  points.forEach((point, i) => point.forEach((value, axis) => assert.ok(Math.abs(value - expected[i][axis]) < 1e-6)));
  for (const id of ['tiles', 'coax']) {
    assert.match(ASSEMBLY_STEPS.find(step => step.id === id).actions.join(' '), /cut.corner/);
  }
});

test('assembly layers are opaque except for the substantially solid acrylic', () => {
  assert.equal(ASSEMBLY_FINISH.scintillator, 1);
  assert.equal(ASSEMBLY_FINISH.liner, 1);
  assert.ok(ASSEMBLY_FINISH.acrylic >= .8);
});

test('the seek bar, rewind and playback speed are accessible on the assembly page', async () => {
  const html = await readFile(new URL('../public/assembly.html', import.meta.url), 'utf8');
  assert.match(html, /type="range" id="assembly-progress"/);
  assert.match(html, /id="seek-back" aria-label="Seek back five seconds"/);
  assert.match(html, /id="playback-speed" aria-label="Playback speed"/);
  assert.match(html, /<option value="1" selected>1x<\/option>/);
  assert.match(html, /id="follow-part"[^>]*aria-pressed="false"/);
  assert.match(html, /id="notes-toggle"[^>]*aria-controls="step-notes"[^>]*aria-expanded="true"/);
  const viewport = html.slice(html.indexOf('<div class="viewport">'), html.indexOf('<div class="view-controls"'));
  assert.doesNotMatch(viewport, /id="nut-map-controls"|class="separation-control"|class="view-presets"/);
});

test('assembly starts inverted, turns onto its side, then stands upright after the lower sheets', () => {
  assert.equal(ASSEMBLY_STEPS.length, 22);
  assert.equal(new Set(ASSEMBLY_STEPS.map(step => step.id)).size, 22);
  const ids = ASSEMBLY_STEPS.map(step => step.id);
  const ordered = ['posts', 'post-nuts', 'top-prefit', 'top-rails', 'turn-side', 'upper-prefit',
    'upper-rails', 'feet', 'brackets', 'lower-acrylic', 'turn-upright', 'lower-liner', 'tiles', 'upper-liner', 'upper-acrylic', 'case',
    'pi', 'readout', 'coax', 'lid', 'connections', 'complete'];
  assert.deepEqual(ids, ordered);
  for (const step of ASSEMBLY_STEPS) {
    assert.ok(step.actions.length >= 2);
    assert.ok(step.check.length > 20);
    assert.equal(step.offset.length, 3);
    assert.ok(step.offset.every(Number.isFinite));
  }
  const index = id => ASSEMBLY_STEPS.findIndex(step => step.id === id);
  assert.equal(frameBuildPose(ASSEMBLY_STEPS, index('top-rails')).angle, Math.PI);
  for (const id of ['upper-prefit', 'upper-rails', 'feet', 'brackets', 'lower-acrylic']) {
    assert.equal(frameBuildPose(ASSEMBLY_STEPS, index(id)).angle, Math.PI / 2);
  }
  assert.equal(frameBuildPose(ASSEMBLY_STEPS, index('tiles')).angle, 0);
  assert.match(ASSEMBLY_STEPS[index('posts')].actions.join(' '), /Leave the feet off/);
  assert.match(ASSEMBLY_STEPS[index('lower-acrylic')].actions.join(' '), /all three lower sheets/);
});

test('quarter turns stay continuous, reversible by seeking, and clear of the bench', () => {
  for (let step = 0; step < ASSEMBLY_STEPS.length; step++) {
    if (step > 0) {
      const before = frameBuildPose(ASSEMBLY_STEPS, step - 1, 1);
      const after = frameBuildPose(ASSEMBLY_STEPS, step, 0);
      assert.ok(Math.abs(before.angle - after.angle) < 1e-12);
      assert.ok(Math.abs(before.lift - after.lift) < 1e-12);
    }
    for (let tick = 0; tick <= 100; tick++) {
      const pose = frameBuildPose(ASSEMBLY_STEPS, step, tick / 100);
      for (const x of [-12.36, 12.36]) for (const y of [FLOOR_Y, 13.05]) {
        assert.ok(x * Math.sin(pose.angle) + y * Math.cos(pose.angle) + pose.lift >= FLOOR_Y - 1e-10);
      }
      assert.equal(frameBuildPose(ASSEMBLY_STEPS, step, tick / 100, true).angle, 0);
    }
  }
});

test('top-first rails enter through the foot ends and slide only along the post axis', () => {
  for (const y of [12.05, -.95, -13.95]) {
    const unit = { rest: [11.16, y, 0], bench: [0, -15, 28], benchAngle: 0, entryY: -24 };
    assert.equal(railPose(unit, .55).position[1], -24);
    for (const t of [.55, .6, .7, .8]) {
      const pose = railPose(unit, t);
      assert.equal(pose.position[0], 11.16);
      assert.equal(pose.position[2], 0);
      assert.ok(pose.position[1] <= y);
    }
    assert.deepEqual(railPose(unit, 1).position, unit.rest);
  }
});

test('a step cannot display future parts unless complete-view is selected', () => {
  for (let step = 0; step < ASSEMBLY_STEPS.length; step++) for (let part = 0; part < ASSEMBLY_STEPS.length; part++) {
    assert.equal(visibleAtStep(part, step), part <= step);
    assert.equal(visibleAtStep(part, step, true), true);
  }
});

test('assembly transitions are bounded, monotonic and end seated', () => {
  assert.equal(smoothAssembly(-1), 0);
  assert.equal(smoothAssembly(2), 1);
  let previous = 0;
  for (let i = 0; i <= 100; i++) {
    const value = smoothAssembly(i / 100);
    assert.ok(value >= previous && value <= 1);
    previous = value;
  }
  assert.equal(1 - smoothAssembly(1), 0);
});

test('guide makes no acquisition or network-feed requests', async () => {
  const script = await readFile(new URL('../public/assembly.js', import.meta.url), 'utf8');
  assert.doesNotMatch(script, /EventSource|\/api\/|DetectorSource|WebSocket|simulation\.advance/);
  const html = await readFile(new URL('../public/assembly.html', import.meta.url), 'utf8');
  assert.match(html, /\.\/assembly\.js/);
  assert.match(html, /\.\/assets\/detector\.jpg/);
});

test('guide spells out coax high voltage and commissioning limits', () => {
  const coax = ASSEMBLY_STEPS.find(step => step.id === 'coax');
  assert.match(coax.check, /shield carries high voltage/);
  const power = ASSEMBLY_STEPS.find(step => step.id === 'connections');
  assert.match(power.actions.join(' '), /high voltage disabled/);
  assert.match(power.check, /separate commissioning steps/);
});

test('liners span the full square tile footprint and are not acrylic-shaped', () => {
  assert.deepEqual(LINER_SIZE, [20, 0.1, 20]);
});

test('tile, glued fibre, taped SiPM adapter and lead are installed as one unit', () => {
  const tile = ASSEMBLY_STEPS.find(step => step.id === 'tiles');
  assert.match(tile.actions.join(' '), /fibre is already glued/);
  assert.match(tile.actions.join(' '), /black light-blocking tape/);
  assert.match(tile.actions.join(' '), /complete unit/);
  assert.ok(!ASSEMBLY_STEPS.some(step => step.id === 'sensors'));
});

test('assembly-mode brackets retain separate rail and post screws and nuts', () => {
  const group = new THREE.Group();
  const result = addCornerBrackets(group, new THREE.MeshStandardMaterial(), [12.05, -0.95, -13.95], { individual: true });
  assert.equal(result.joints.length, 24);
  assert.equal(group.children.length, 24);
  for (const joint of result.joints) {
    assert.equal(joint.underRail.children.length, 5);
    assert.equal(joint.intoPost.children.length, 5);
    assert.equal(joint.side, joint.height === -13.95 ? 1 : -1);
  }
});

test('rail route is continuous and turns above the frame before lowering', () => {
  const unit = { rest: [11.16, -13.95, 0], bench: [0, -15, 28], benchAngle: -Math.PI / 2 };
  assert.deepEqual(railPose(unit, 0).position, unit.bench);
  assert.deepEqual(railPose(unit, 1).position, unit.rest);
  assert.equal(railPose(unit, 0.45).position[1], 25);
  assert.ok(railPose(unit, 0.45).angle > -Math.PI / 2);
  railPose(unit, 0.82).position.forEach((value, index) =>
    assert.ok(Math.abs(value - unit.rest[index]) < 1e-10));
  for (const t of [0.55, 0.6, 0.7, 0.8]) {
    const position = railPose(unit, t).position;
    assert.equal(position[0], unit.rest[0]);
    assert.equal(position[2], unit.rest[2]);
  }
  assert.equal(railPose(unit, 0.9).screwProgress, 0);
  let previous = railPose(unit, 0).position;
  for (let i = 1; i <= 1000; i++) {
    const next = railPose(unit, i / 1000).position;
    assert.ok(Math.hypot(...next.map((v, j) => v - previous[j])) < 0.5);
    previous = next;
  }
});

test('rails are installed one at a time, not as a closed square through posts', () => {
  for (let i = 0; i <= 100; i++) {
    const states = Array.from({ length: 8 }, (_, rail) => railProgress(i / 100, rail, 8));
    assert.ok(states.filter(value => value > 0 && value < 1).length <= 1);
  }
  assert.equal(railProgress(0, 0, 4), 0);
  assert.equal(railProgress(1, 3, 4), 1);
});

test('flat-nut order is farthest-first, complete before the corner pieces slide in', () => {
  assert.equal(nutLoadingProgress(0.2, 0, 3), 1);
  assert.equal(nutLoadingProgress(0.2, 1, 3), 0);
  for (const count of [1, 2, 3, 4]) for (let nut = 0; nut < count; nut++) {
    assert.equal(nutLoadingProgress(0.6, nut, count), 1);
  }
  const instructions = ASSEMBLY_STEPS.filter(step => step.phase === 'Frame')
    .flatMap(step => [...step.actions, step.check]).join(' ');
  assert.match(instructions, /Do not drop nuts into a groove from the side/);
  assert.match(instructions, /disassembly/);
  assert.match(instructions, /acrylic-sheet and readout-box mounting nuts/);
});

test('a preassembled tile enters through a side opening before lowering onto its liner', () => {
  const rest = [0, -13.95, 0];
  assert.deepEqual(sideInsertionPose(rest, 1), rest);
  for (const progress of [0, 0.2, 0.4, 0.7]) {
    const position = sideInsertionPose(rest, progress);
    assert.ok(position[1] - rest[1] > 3);
    assert.ok(position[2] >= 0);
  }
  assert.equal(sideInsertionPose(rest, 0.9)[2], 0);
});

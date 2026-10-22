import * as THREE from 'three';
import { TelescopeScene } from './scene.js';
import { ASSEMBLY_STEPS, visibleAtStep, smoothAssembly } from './assembly-steps.js';
import { railPose, railProgress, nutLoadingProgress, bracketInsertionProgress, orderRailNuts, sideInsertionPose,
  fasteningProgress, screwPose, assemblyTime, assemblyPosition, ASSEMBLY_FINISH, ASSEMBLY_SPEED, hingedCoverAngle,
  layerFasteningView, nutNeedsReminder, nutReminderPulse, ASSEMBLY_FOLLOW_DEFAULT, assemblyCameraStage, frameBuildPose } from './assembly-motion.js';
import { TILE_HEIGHTS, FLOOR_Y } from './detector-geometry.js';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { createNutGeometry, NUT_ROLES } from './tslot-nut-geometry.js';
import { tapeSiPMHolder } from './assembly-tape.js';
import { createCarriedCoax } from './assembly-cables.js';
import { createPiFixings, createAllenKey, createPhillipsDriver, cablePassage, createCutCornerGuide } from './assembly-hardware.js';

const $ = id => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const icons = () => window.lucide?.createIcons();
const stepNumber = id => ASSEMBLY_STEPS.findIndex(step => step.id === id);

class AssemblyScene extends TelescopeScene {
  constructor(container) {
    super(container, { assembly: true });
    this.paused = true;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 130;
    this.controls.enablePan = true;
    this.followPart = ASSEMBLY_FOLLOW_DEFAULT;
    this.focusRequested = false;
    this.controls.addEventListener('start', () => {
      this.cameraMotion = null; this.followPart = false;
      $('follow-part').setAttribute('aria-pressed', 'false');
    });
    this.parts = [];
    this.stepIndex = 0;
    this.separation = 0;
    this.previewComplete = false;
    this.progress = 0;
    this.beforeRender = dt => this.updateAssembly(dt);
  }

  async prepare() {
    await this.ready;
    if (this.loadError) throw this.loadError;
    if (this.hardware.state.error) throw Error(this.hardware.state.error);
    if (!this.mechanicsReady || !this.hardware.state.pcb || !this.hardware.state.pi) {
      throw Error('The detector CAD did not finish loading.');
    }
    this.alignReadoutPorts();
    // Start from an empty bench, retaining lights, camera and ground.
    this.model.traverse(node => {
      if (node.isMesh || node.isLine || node.isSprite) node.visible = false;
    });
    const p = this.mechanicalParts;
    const register = (objects, id) => objects.forEach(object => this.registerPart(object, stepNumber(id)));
    this.prepareRailUnits(p);
    const nutCad = await new GLTFLoader().loadAsync('./assets/tslot-nut.glb');
    const nutGeometry = createNutGeometry(nutCad.scene);
    for (const nut of [...this.postNuts, ...this.railUnits.flatMap(unit => unit.railNuts)]) {
      nut.object.geometry = nutGeometry;
    }
    register(p.uprights, 'posts');
    register(p.feet, 'feet');
    for (const nut of this.postNuts) register([nut.object],
      nut.unit.prefit === 'top-prefit' ? 'post-nuts' : nut.unit.join);
    for (const unit of this.railUnits) {
      register([unit.group], unit.prefit);
      register(unit.postScrews.map(item => item.object), unit.join);
    }
    register([...p.lowerAcrylic, ...p.lowerSheetFasteners], 'lower-acrylic');
    register(p.lowerLiner, 'lower-liner');
    const tileUnits = this.prepareTileUnits(p);
    register(tileUnits, 'tiles');
    register(p.upperLiner, 'upper-liner');
    register([...p.upperAcrylic, ...p.upperSheetFasteners, this.topText], 'upper-acrylic');
    // Mount the enclosure and attached open lid as one hinged unit.
    this.caseUnit = new THREE.Group();
    this.readout.add(this.caseUnit);
    for (const object of [...p.enclosure, this.lid]) this.caseUnit.attach(object);
    this.hingeRest = this.lid.position.clone();
    register([this.caseUnit, ...p.enclosureFasteners], 'case');
    register([this.hardware.piBody], 'pi');
    this.piScrews = createPiFixings(this.silver);
    this.piScrews.forEach(object => this.readout.add(object));
    register(this.piScrews, 'pi');
    register([this.hardware.readoutBody], 'readout');
    register([this.terminator], 'coax');
    register(this.piCables, 'connections');
    this.allenKey = createAllenKey(this.silver);
    this.model.add(this.allenKey);
    this.phillipsDriver = createPhillipsDriver(this.silver);
    this.model.add(this.phillipsDriver);
    this.gapMarker = createCutCornerGuide();
    this.model.add(this.gapMarker);
    this.fasteners = new Map();
    for (const object of [...p.sheetFasteners, ...p.enclosureFasteners, ...this.piScrews]) this.saveFastener(object);
    for (const unit of this.railUnits) for (const bracket of unit.brackets) this.saveFastener(bracket.screw);
    for (const unit of this.railUnits) for (const screw of unit.postScrews) this.saveFastener(screw.object);
    this.insertionSets = [
      { id: 'lower-liner', objects: p.lowerLiner },
      { id: 'tiles', objects: tileUnits },
      { id: 'upper-liner', objects: p.upperLiner },
    ].map(set => ({ id: set.id, parts: set.objects.map(object => this.parts.find(part => part.object === object))
      .sort((a, b) => a.rest.y - b.rest.y) }));
    this.sheetSets = [
      { id: 'lower-acrylic', sheets: p.lowerAcrylic, screws: p.lowerSheetFasteners },
      { id: 'upper-acrylic', sheets: p.upperAcrylic, screws: p.upperSheetFasteners },
    ].map(set => ({ id: set.id, levels: [...set.sheets].sort((a, b) => a.position.y - b.position.y)
      .map(sheet => [sheet, ...set.screws.filter(screw => Math.abs(screw.position.y - sheet.position.y) < 0.5),
        ...(sheet === p.upperAcrylic[0] ? [this.topText] : [])]
        .map(object => this.parts.find(part => part.object === object))) }));
    // Layers remain distinct during placement; only the acrylic stays partly see-through.
    for (const sheet of [...p.lowerAcrylic, ...p.upperAcrylic]) {
      for (const material of sheet.material) {
        material.opacity = ASSEMBLY_FINISH.acrylic;
        material.depthWrite = true;
        material.needsUpdate = true;
      }
    }
    for (const object of [...p.lowerLiner, ...p.upperLiner, ...p.tiles]) {
      object.material.opacity = 1;
      object.material.transparent = false;
      object.material.depthWrite = true;
      object.material.needsUpdate = true;
    }
    for (const light of this.fibreLights) light.core.material.emissiveIntensity = 0.22;
    this.prepareNutMap(p);
    this.prepared = true;
    this.container.dataset.ready = 'true';
    this.container.dataset.partCount = String(this.parts.length);
    this.container.dataset.preloadedRailNuts = String(this.railUnits.reduce((sum, unit) => sum + unit.railNuts.length, 0));
    this.container.dataset.postNuts = String(this.postNuts.length);
    this.container.dataset.carriedLeads = String(this.carriedLeads.length);
    this.container.dataset.piScrews = String(this.piScrews.length);
    this.container.dataset.hingedEnclosure = 'true';
  }

  saveFastener(object) {
    this.fasteners.set(object, { rest: object.position.clone(), rotation: object.quaternion.clone(),
      normal: new THREE.Vector3(0, 0, 1).applyQuaternion(object.quaternion) });
  }

  insertScrew(object, progress, travel = 1.8) {
    const saved = this.fasteners.get(object);
    const pose = screwPose(progress, travel);
    object.visible = pose.visible;
    object.position.copy(saved.rest).addScaledVector(saved.normal, pose.distance);
    object.quaternion.copy(saved.rotation).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), pose.angle));
    if (pose.turning) {
      object.updateWorldMatrix(true, false);
      const tool = object.userData.drive === 'phillips' ? this.phillipsDriver : this.allenKey;
      tool.position.copy(this.model.worldToLocal(object.getWorldPosition(new THREE.Vector3())));
      tool.quaternion.copy(this.model.getWorldQuaternion(new THREE.Quaternion()).invert())
        .multiply(object.getWorldQuaternion(new THREE.Quaternion()));
      tool.scale.copy(object.getWorldScale(new THREE.Vector3()));
      tool.visible = true;
      this.container.dataset.activeScrew = object.name || 'Frame mounting screw';
    }
  }

  prepareRailUnits(parts) {
    this.railUnits = [];
    this.postNuts = [];
    this.model.updateMatrixWorld(true);
    const levels = [0, 1, 2];
    for (const level of levels) for (const [index, rail] of parts.rails[level].entries()) {
      const group = new THREE.Group();
      group.position.copy(rail.position);
      this.model.add(group);
      group.attach(rail);
      const alongX = Math.abs(group.position.x) < 1;
      const joints = this.cornerMounts.joints.filter(joint => joint.height === TILE_HEIGHTS[level]
        && joint.alongX === alongX && (alongX ? joint.sz === Math.sign(group.position.z)
          : joint.sx === Math.sign(group.position.x)));
      const unit = { group, alongX, rest: group.position.toArray(), benchAngle: alongX ? 0 : -Math.PI / 2,
        name: `${['Top', 'Middle', 'Bottom'][level]} - ${alongX ? group.position.z > 0 ? 'front' : 'rear' : group.position.x < 0 ? 'left' : 'right'} rail`,
        bench: [level === 0 ? 0 : level === 1 ? -14 : 14, FLOOR_Y + 3.3, 28 + index * 3.5],
        entryY: -24,
        prefit: level === 0 ? 'top-prefit' : 'upper-prefit',
        join: level === 0 ? 'top-rails' : 'upper-rails', brackets: [], railNuts: [], postScrews: [] };
      for (const joint of joints) {
        const postNut = joint.intoPost.children.at(-1);
        const railNut = joint.underRail.children.at(-1);
        this.model.attach(postNut);
        this.postNuts.push({ object: postNut, rest: postNut.position.clone(), unit, role: 'joint' });
        group.attach(railNut);
        group.attach(joint.bracket);
        const nutRest = railNut.position.clone();
        const end = nutRest.clone();
        if (alongX) end.x = Math.sign(nutRest.x) * 10.1;
        else end.z = Math.sign(nutRest.z) * 10.1;
        unit.railNuts.push({ object: railNut, rest: nutRest, end, role: 'joint', location: 'Bracket groove' });
        unit.brackets.push({ object: joint.bracket, rest: joint.bracket.position.clone(), side: joint.side,
          screw: joint.underRail, screwRest: joint.underRail.position.clone() });
        unit.postScrews.push({ object: joint.intoPost, rest: joint.intoPost.position.clone(),
          normal: new THREE.Vector3(0, 0, 1).applyQuaternion(joint.intoPost.quaternion) });
      }
      if (joints.length !== 2) throw Error('A rail must have a bracket at each end.');
      this.railUnits.push(unit);
    }
    // Sheet and enclosure nuts must already be in the rails before their ends close.
    const mountingNuts = [
      ...parts.lowerSheetFasteners.map(object => ({ object, role: 'acrylic', location: 'Lower groove' })),
      ...parts.upperSheetFasteners.map(object => ({ object, role: 'acrylic', location: 'Upper groove' })),
      ...parts.enclosureFasteners.map(object => ({ object, role: 'case', location: 'Outside groove' })),
    ];
    for (const { object: fastener, role, location } of mountingNuts) {
      const nut = fastener.children.at(-1);
      this.model.attach(nut);
      const point = nut.position.clone();
      const distance = unit => {
        const [x, y, z] = unit.rest;
        const dx = unit.alongX ? Math.max(0, Math.abs(point.x - x) - 10.16) : point.x - x;
        const dz = unit.alongX ? point.z - z : Math.max(0, Math.abs(point.z - z) - 10.16);
        return dx * dx + (point.y - y) ** 2 + dz * dz;
      };
      const unit = this.railUnits.reduce((best, item) => distance(item) < distance(best) ? item : best);
      unit.group.attach(nut);
      unit.railNuts.push({ object: nut, rest: nut.position.clone(), end: nut.position.clone(), role, location });
    }
    for (const unit of this.railUnits) {
      const axis = unit.alongX ? 'x' : 'z';
      const across = unit.alongX ? 'z' : 'x';
      for (const nut of unit.railNuts) {
        nut.end[axis] = -11.4;
      }
      unit.railNuts = orderRailNuts(unit.railNuts, axis, across);
    }
  }

  prepareNutMap(parts) {
    this.nutMap = false;
    this.nutScope = null;
    this.nutReplayTime = null;
    this.nutReplayProgress = 1;
    this.showFittedBrackets = false;
    this.nutMarkers = new THREE.Group();
    this.model.add(this.nutMarkers);
    this.nutReminders = new THREE.Group();
    this.nutReminders.name = 'End-load these nuts before closing the joint';
    this.model.add(this.nutReminders);
    this.reminderTime = 0;
    const ringCanvas = document.createElement('canvas');
    ringCanvas.width = ringCanvas.height = 96;
    const ringContext = ringCanvas.getContext('2d');
    ringContext.strokeStyle = '#ffd875';
    ringContext.lineWidth = 6;
    ringContext.beginPath();
    ringContext.arc(48, 48, 34, 0, Math.PI * 2);
    ringContext.stroke();
    const ringTexture = new THREE.CanvasTexture(ringCanvas);
    ringTexture.colorSpace = THREE.SRGBColorSpace;
    this.nutEntryArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 3.5, '#efbc52', 0.8, 0.5);
    for (const mesh of [this.nutEntryArrow.line, this.nutEntryArrow.cone]) {
      mesh.material.depthTest = false; mesh.material.depthWrite = false; mesh.renderOrder = 50;
    }
    this.nutMarkers.add(this.nutEntryArrow);
    this.beamMaterials = [...parts.uprights, ...parts.rails.flat()].flatMap(object => {
      const materials = [];
      object.traverse(node => {
        for (const material of node.material ? Array.isArray(node.material) ? node.material : [node.material] : []) {
          materials.push({ material, opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite });
        }
      });
      return materials;
    });
    const makeMarker = (nut, number, unit) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 96;
      const context = canvas.getContext('2d');
      context.fillStyle = '#14211e'; context.strokeStyle = NUT_ROLES[nut.role].color; context.lineWidth = 7;
      context.beginPath(); context.arc(48, 48, 37, 0, Math.PI * 2); context.fill(); context.stroke();
      context.fillStyle = '#ffffff'; context.font = 'bold 43px sans-serif';
      context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(String(number), 48, 51);
      const material = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false, depthWrite: false });
      const sprite = new THREE.Sprite(material); sprite.renderOrder = 50; sprite.scale.setScalar(0.85);
      this.nutMarkers.add(sprite);
      const reminder = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTexture,
        depthTest: false, depthWrite: false, transparent: true, toneMapped: false }));
      reminder.renderOrder = 49;
      reminder.visible = false;
      this.nutReminders.add(reminder);
      return { nut, unit, sprite, reminder, number, color: nut.object.material.color.clone() };
    };
    this.nutTargets = this.railUnits.flatMap(unit => unit.railNuts.map(nut => makeMarker(nut, nut.loadOrder + 1, unit)));
    this.nutTargets.push(...this.postNuts.map((nut, index) => makeMarker(nut, index + 1, null)));
  }

  setNutMap(enabled, unit = null) {
    const wasEnabled = this.nutMap;
    this.nutMap = enabled;
    this.nutScope = unit;
    const loading = enabled && unit && ASSEMBLY_STEPS[this.stepIndex].id === unit.prefit;
    this.nutReplayTime = loading && !reducedMotion ? 0 : null;
    this.nutReplayProgress = loading && !reducedMotion ? 0 : 1;
    this.showFittedBrackets = false;
    const benchInspection = enabled && unit && ASSEMBLY_STEPS[this.stepIndex].id === unit.prefit;
    for (const rail of this.railUnits) rail.group.visible = visibleAtStep(stepNumber(rail.prefit),
      this.stepIndex, this.previewComplete) && (!benchInspection || rail === unit);
    if (enabled) {
      this.replayTime = null; this.separation = 0;
      this.updateFrameMotion(0);
    }
    for (const saved of this.beamMaterials) {
      Object.assign(saved.material, { opacity: enabled ? 0.13 : saved.opacity,
        transparent: enabled || saved.transparent, depthWrite: enabled ? false : saved.depthWrite });
      saved.material.needsUpdate = true;
    }
    for (const target of this.nutTargets) target.nut.object.material.color.copy(enabled
      ? new THREE.Color(NUT_ROLES[target.nut.role].color) : target.color);
    this.nutMarkers.visible = enabled;
    this.container.dataset.nutMap = String(enabled);
    if (enabled && unit) {
      const target = unit.group.getWorldPosition(new THREE.Vector3());
      target.y += 0.7;
      this.cameraMotion = { from: this.camera.position.clone(), to: target.clone().add(new THREE.Vector3(2, 15, 21)),
        targetFrom: this.controls.target.clone(), targetTo: target, elapsed: reducedMotion ? 1 : 0 };
    } else if (wasEnabled) this.setCamera('perspective');
  }

  updateNutMarkers() {
    if (!this.nutMap) return;
    this.model.updateMatrixWorld(true);
    this.nutEntryArrow.visible = !!this.nutScope && ASSEMBLY_STEPS[this.stepIndex].id === this.nutScope.prefit;
    if (this.nutEntryArrow.visible) {
      const unit = this.nutScope;
      const point = unit.railNuts[0].end.clone();
      point[unit.alongX ? 'x' : 'z'] = -15;
      this.nutEntryArrow.position.copy(this.model.worldToLocal(unit.group.localToWorld(point)));
      const direction = new THREE.Vector3(unit.alongX ? 1 : 0, 0, unit.alongX ? 0 : 1);
      direction.applyQuaternion(unit.group.quaternion);
      this.nutEntryArrow.setDirection(direction);
    }
    let count = 0;
    for (const { nut, unit, sprite } of this.nutTargets) {
      sprite.visible = unit ? unit.group.visible && (!this.nutScope || this.nutScope === unit)
        : !this.nutScope && nut.object.visible;
      if (!sprite.visible) continue;
      count++;
      sprite.position.copy(nut.rest);
      if (unit) unit.group.localToWorld(sprite.position);
      else this.model.localToWorld(sprite.position);
      this.model.worldToLocal(sprite.position);
      sprite.scale.setScalar(this.nutScope ? 1.15 : 0.55);
    }
    this.container.dataset.nutTargets = String(count);
  }

  updateNutReminders(dt) {
    this.reminderTime += dt;
    const current = ASSEMBLY_STEPS[this.stepIndex].id;
    const pulse = nutReminderPulse(this.reminderTime, reducedMotion);
    const rails = this.railUnits.filter(unit => unit.prefit === current || unit.join === current);
    const active = rails[Math.min(rails.length - 1, Math.floor(this.progress * rails.length))];
    const scope = this.nutMap && this.nutScope ? this.nutScope : active;
    let count = 0;
    const roles = new Set();
    this.model.updateMatrixWorld(true);
    for (const { nut, unit, reminder } of this.nutTargets) {
      const rail = unit || nut.unit;
      reminder.visible = !this.previewComplete && nut.object.visible
        && (!unit || unit.group.visible) && (!scope || rail === scope)
        && nutNeedsReminder(current, rail, !unit);
      if (!reminder.visible) continue;
      count++;
      roles.add(nut.role);
      reminder.position.copy(this.model.worldToLocal(nut.object.getWorldPosition(new THREE.Vector3())));
      reminder.material.opacity = pulse.opacity;
      reminder.scale.setScalar(pulse.scale);
    }
    $('preload-warning').hidden = count === 0;
    this.container.dataset.preloadReminders = String(count);
    this.container.dataset.preloadReminderRoles = [...roles].join(',');
    this.container.dataset.reminderOpacity = pulse.opacity.toFixed(3);
  }

  prepareTileUnits(parts) {
    this.carriedLeads = [];
    this.tileUnits = TILE_HEIGHTS.map((height, index) => {
      tapeSiPMHolder(parts.holders[index], parts.sensors[index]);
      const group = new THREE.Group();
      group.position.y = height;
      this.model.add(group);
      for (const object of [parts.tiles[index], parts.holders[index], parts.sensors[index],
        this.fibreLights[index].core, this.fibreLights[index].glow, this.sensorLeads[index]]) group.attach(object);
      const route = new THREE.CurvePath();
      // The installed path is already aligned with the measured PCB connector positions.
      for (const mesh of [this.beamCables[index], this.readoutLeads[index]]) {
        const points = mesh.geometry.parameters.path.getSpacedPoints(40)
          .map(point => group.worldToLocal(mesh.localToWorld(point)));
        route.add(new THREE.CatmullRomCurve3(points));
      }
      const lead = createCarriedCoax(route, this.black);
      group.add(lead.group);
      // Carry the existing plug, rather than making a second connector appear later.
      lead.plug.attach(this.readoutBoots[index]);
      lead.plug.attach(this.readoutSockets[index]);
      lead.group.traverse(node => { node.userData.preserveFinish = true; });
      lead.update(0);
      this.carriedLeads.push(lead);
      return group;
    });
    return this.tileUnits;
  }

  registerPart(object, step) {
    if (!object) throw Error(`Missing model component in step ${step + 1}`);
    const materials = [];
    object.traverse(node => {
      if (!node.material) return;
      const source = Array.isArray(node.material) ? node.material : [node.material];
      const copies = source.map(material => material.clone());
      node.material = Array.isArray(node.material) ? copies : copies[0];
      for (const material of copies) materials.push({ material, color: material.color?.clone(),
        preserveFinish: !!(node.userData.lightBlockingTape || node.userData.preserveFinish) });
    });
    this.parts.push({ object, step, rest: object.position.clone(), materials });
  }

  setStep(index, animate = true) {
    const previousStage = assemblyCameraStage(ASSEMBLY_STEPS[this.stepIndex].camera);
    this.stepIndex = index;
    this.previewComplete = false;
    this.separation = 0;
    this.replayTime = animate && !reducedMotion ? 0 : null;
    this.boxOpen = index >= stepNumber('case') && index < stepNumber('lid');
    $('follow-part').setAttribute('aria-pressed', String(this.followPart));
    this.lidAngle = this.boxOpen ? 1.9 : 0;
    this.updateVisibility();
    const stage = assemblyCameraStage(ASSEMBLY_STEPS[index].camera);
    if (!this.hasCameraStage || stage !== previousStage) this.setCamera('perspective');
    this.hasCameraStage = true;
  }

  updateVisibility() {
    for (const part of this.parts) {
      const visible = visibleAtStep(part.step, this.stepIndex, this.previewComplete);
      part.object.traverse(child => { child.visible = visible; });
      // The light halo belongs to the particle display, not the physical fibre.
      if (this.fibreLights.some(light => light.glow === part.object)) part.object.visible = false;
      for (const { material, color, preserveFinish } of part.materials) if (color) {
        material.color.copy(color);
        if (visible && part.step === this.stepIndex && !this.previewComplete && !preserveFinish) {
          material.color.lerp(new THREE.Color('#b7dfc6'), 0.1);
        }
      }
    }
    for (const light of this.fibreLights) light.glow.visible = false;
    this.container.dataset.step = ASSEMBLY_STEPS[this.stepIndex].id;
    this.container.dataset.completeView = String(this.previewComplete);
    this.container.dataset.visibleParts = String(this.parts.filter(p => p.object.visible).length);
  }

  setCamera(preset) {
    const detail = assemblyCameraStage(ASSEMBLY_STEPS[this.stepIndex].camera);
    const target = new THREE.Vector3(0, -3, 8);
    const position = new THREE.Vector3(52, 37, 76);
    if (detail === 'bench' && !this.previewComplete) {
      target.set(0, -14, 32); position.set(31, 16, 63);
    } else if (detail === 'readout' && !this.previewComplete) {
      target.set(0, -5, 13); position.set(-23, 14, 50);
    } else if (detail === 'cables' && !this.previewComplete) {
      target.set(-4, -2, 7); position.set(-37, 15, 42);
    }
    const distance = position.distanceTo(target);
    if (preset === 'front') position.copy(target).add(new THREE.Vector3(0, 0.03, distance));
    if (preset === 'side') position.copy(target).add(new THREE.Vector3(-distance, 0.03, 0));
    if (preset === 'top') position.copy(target).add(new THREE.Vector3(0, distance, 0.03));
    this.container.dataset.cameraTarget = JSON.stringify(target.toArray());
    this.container.dataset.cameraOffset = JSON.stringify(position.clone().sub(target).toArray());
    this.container.dataset.cameraTransitions = String(Number(this.container.dataset.cameraTransitions || 0) + 1);
    this.cameraMotion = { from: this.camera.position.clone(), to: position,
      targetFrom: this.controls.target.clone(), targetTo: target, elapsed: reducedMotion ? 1 : 0 };
  }

  updateAssembly(dt) {
    if (!this.prepared) return;
    let fraction = this.separation;
    if (this.replayTime !== null) {
      this.replayTime += dt * playbackRate;
      const duration = ASSEMBLY_STEPS[this.stepIndex].duration || 4;
      fraction = 1 - Math.min(1, this.replayTime / duration);
      if (this.replayTime >= duration) {
        this.replayTime = null;
        this.separation = 0;
      }
    }
    this.progress = 1 - fraction;
    const build = frameBuildPose(ASSEMBLY_STEPS, this.stepIndex, this.progress, this.previewComplete);
    this.model.rotation.z = build.angle;
    this.model.position.y = build.lift;
    this.model.updateMatrixWorld(true);
    this.container.dataset.frameOrientation = build.orientation;
    this.container.dataset.frameAngle = build.angle.toFixed(5);
    this.allenKey.visible = false;
    this.phillipsDriver.visible = false;
    delete this.container.dataset.activeScrew;
    for (const [object, saved] of this.fasteners) object.quaternion.copy(saved.rotation);
    for (const part of this.parts) {
      part.object.position.copy(part.rest);
      if (part.step === this.stepIndex && !this.previewComplete) {
        part.object.position.addScaledVector(new THREE.Vector3(...ASSEMBLY_STEPS[part.step].offset), fraction);
      }
    }
    if (this.nutReplayTime !== null) {
      this.nutReplayTime += dt * playbackRate;
      const duration = 4 + this.nutScope.railNuts.length * 0.9;
      this.nutReplayProgress = Math.min(1, this.nutReplayTime / duration);
      if (this.nutReplayProgress === 1) {
        this.nutReplayTime = null;
        this.showFittedBrackets = true;
        $('fitted-brackets').checked = true;
      }
    }
    this.updateFrameMotion(fraction);
    this.updateNutMarkers();
    this.updateNutReminders(dt);
    for (const set of this.insertionSets) if (ASSEMBLY_STEPS[this.stepIndex].id === set.id && !this.previewComplete) {
      set.parts.forEach((part, index) => {
        const progress = railProgress(1 - fraction, index, set.parts.length);
        part.object.position.set(...sideInsertionPose(part.rest.toArray(), progress));
      });
    }
    for (const set of this.sheetSets) if (ASSEMBLY_STEPS[this.stepIndex].id === set.id && !this.previewComplete) {
      set.levels.forEach((parts, index) => {
        const progress = railProgress(1 - fraction, index, set.levels.length);
        const placement = smoothAssembly(progress / 0.55);
        const screws = parts.filter(part => this.fasteners.has(part.object));
        for (const part of parts.filter(part => !this.fasteners.has(part.object))) {
          part.object.position.copy(part.rest).addScaledVector(new THREE.Vector3(...ASSEMBLY_STEPS[this.stepIndex].offset), 1 - placement);
        }
        screws.forEach((part, screw) => this.insertScrew(part.object, fasteningProgress(progress, screw, screws.length)));
      });
    }
    const current = ASSEMBLY_STEPS[this.stepIndex].id;
    if (!this.previewComplete && ['case', 'pi'].includes(current)) {
      const object = current === 'case' ? this.caseUnit : this.hardware.piBody;
      const part = this.parts.find(part => part.object === object);
      object.position.copy(part.rest).addScaledVector(new THREE.Vector3(...ASSEMBLY_STEPS[this.stepIndex].offset),
        1 - smoothAssembly(this.progress / 0.55));
      const screws = current === 'case' ? this.mechanicalParts.enclosureFasteners : this.piScrews;
      screws.forEach((screw, index) => this.insertScrew(screw, fasteningProgress(this.progress, index, screws.length), current === 'pi' ? 1.2 : 1.8));
    }
    // The supplied lid always remains attached at its hinge axis.
    this.lid.position.copy(this.hingeRest);
    const angle = current === 'lid' && !this.previewComplete && this.progress < 1
      ? hingedCoverAngle(this.progress) : this.boxOpen ? 1.9 : 0;
    this.lidAngle = angle;
    this.lid.rotation.set(Math.PI - angle, 0, 0);
    this.container.dataset.lidAngle = angle.toFixed(3);
    const routingStep = stepNumber('coax');
    this.carriedLeads.forEach((lead, index) => {
      const progress = this.previewComplete || this.stepIndex > routingStep ? 1
        : this.stepIndex < routingStep ? 0 : railProgress(1 - fraction, index, this.carriedLeads.length);
      lead.update(progress);
    });
    this.container.dataset.cableRouting = this.stepIndex < routingStep && !this.previewComplete ? 'loose'
      : this.stepIndex === routingStep && fraction > 0 && !this.previewComplete ? 'routing' : 'connected';
    this.gapMarker.visible = !this.previewComplete && ['tiles', 'coax'].includes(current);
    if (this.gapMarker.visible) {
      const level = Math.min(2, Math.floor(this.progress * 3));
      const index = current === 'tiles' ? 2 - level : level;
      const tile = this.tileUnits[index];
      this.gapMarker.position.copy(tile.position).add(new THREE.Vector3(0, .35, 0));
      this.container.dataset.cablePassage = 'Tile cut corner to beam to inside upright';
    } else delete this.container.dataset.cablePassage;
    if (this.followPart && !this.nutMap && !this.previewComplete && (this.replayTime !== null || this.focusRequested)) {
      this.followInstallation(1 - fraction, dt);
      this.focusRequested = false;
    }
    if (this.cameraMotion) {
      const motion = this.cameraMotion;
      motion.elapsed += dt;
      const t = smoothAssembly(motion.elapsed / 0.65);
      this.camera.position.lerpVectors(motion.from, motion.to, t);
      this.controls.target.lerpVectors(motion.targetFrom, motion.targetTo, t);
      this.controls.update();
      if (t === 1) this.cameraMotion = null;
    }
    updateTimeline(this);
  }

  followInstallation(progress, dt) {
    const current = ASSEMBLY_STEPS[this.stepIndex].id;
    let target;
    let offset = new THREE.Vector3(3, 15, 25);
    if (current === 'post-nuts') {
      target = this.postNuts[0].object.getWorldPosition(new THREE.Vector3());
      offset.set(-9, 7, 16);
      $('focus-label').textContent = 'Top joint: nut enters at the open foot end';
    }
    const rails = this.railUnits.filter(unit => unit.prefit === current || unit.join === current);
    if (rails.length) {
      const index = Math.min(rails.length - 1, Math.floor(progress * rails.length));
      const unit = rails[index];
      target = unit.group.getWorldPosition(new THREE.Vector3());
      if (unit.join === current) offset.set(24, 22, 34);
      $('focus-label').textContent = `${unit.name}: ${unit.prefit === current ? 'end-load nuts, then slide brackets' : 'slide in from the open foot ends'}`;
    }
    const insertion = this.insertionSets.find(set => set.id === current);
    const sheets = this.sheetSets.find(set => set.id === current);
    if (insertion || sheets) {
      const parts = insertion ? insertion.parts : sheets.levels.map(parts => parts[0]);
      const index = Math.min(parts.length - 1, Math.floor(progress * parts.length));
      const part = parts[index];
      target = new THREE.Vector3(part.rest.x, part.rest.y, part.rest.z + 3);
      const closing = smoothAssembly((railProgress(progress, index, parts.length) - 0.55) / 0.35);
      if (current === 'tiles') {
        target = part.object.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(-2, 0, 3));
        offset.set(-29 + closing * 6, 20 - closing * 3, 37 - closing * 6);
      } else if (sheets) {
        const view = layerFasteningView(part.rest.y);
        target.copy(this.model.localToWorld(new THREE.Vector3(...view.target)));
        offset.set(...view.offset);
      } else offset.set(27 - closing * 8, 19 - closing * 4, 35 - closing * 8);
      $('focus-label').textContent = `${['Bottom', 'Middle', 'Top'][index]} level: ${ASSEMBLY_STEPS[this.stepIndex].focus.toLowerCase()}`;
    }
    if (current === 'coax') {
      const index = Math.min(2, Math.floor(progress * 3));
      const phase = railProgress(progress, index, 3);
      const passage = cablePassage(TILE_HEIGHTS[index], index);
      const port = this.readout.localToWorld(this.hardware.ports[index].clone());
      target = phase < 0.4 ? new THREE.Vector3(-8.8, passage.y, 9.1)
        : passage.clone().lerp(port, smoothAssembly((phase - 0.4) / 0.6));
      offset.set(-8, 9, 14);
      $('focus-label').textContent = phase < 0.4 ? 'Use the tile cut-corner gap to guide the lead along the beam'
        : phase < 0.8 ? 'Guide the cable down the inside corner of the upright' : 'Seat the same SMA plug on its readout input';
    }
    if (['case', 'pi', 'readout'].includes(current)) {
      target = this.readout.localToWorld(new THREE.Vector3(2.2, -5.1, 12.5));
      offset.set(-14, 11, 29);
      $('focus-label').textContent = current === 'pi' ? 'Fasten the Pi through its four mounting holes'
        : ASSEMBLY_STEPS[this.stepIndex].focus;
    }
    if (!target) return;
    this.container.dataset.cameraTarget = JSON.stringify(target.toArray());
    this.container.dataset.cameraOffset = JSON.stringify(offset.toArray());
    if (this.replayTime === null) {
      this.cameraMotion = { from: this.camera.position.clone(), to: target.clone().add(offset),
        targetFrom: this.controls.target.clone(), targetTo: target, elapsed: reducedMotion ? 1 : 0 };
      return;
    }
    this.cameraMotion = null;
    const blend = 1 - Math.exp(-dt * 2.4);
    this.camera.position.lerp(target.clone().add(offset), blend);
    this.controls.target.lerp(target, blend);
    this.controls.update();
  }

  updateFrameMotion(fraction) {
    const current = ASSEMBLY_STEPS[this.stepIndex].id;
    const progress = 1 - fraction;
    for (const nut of this.postNuts) {
      nut.object.position.copy(nut.rest);
      if (current === 'post-nuts' && !this.previewComplete) {
        if (nut.unit.prefit === 'top-prefit') {
          nut.object.position.y += (-23 - nut.rest.y) * (1 - smoothAssembly(progress));
          nut.object.visible = progress > 0;
        }
      } else if (current === nut.unit.join && nut.unit.prefit === 'upper-prefit' && !this.previewComplete) {
        const sequence = this.railUnits.filter(item => item.join === nut.unit.join);
        const p = railProgress(progress, sequence.indexOf(nut.unit), sequence.length);
        nut.object.position.y += (-23 - nut.rest.y) * (1 - smoothAssembly(p / 0.18));
        nut.object.visible = p > 0;
      }
    }
    for (const unit of this.railUnits) {
      const joinIndex = stepNumber(unit.join);
      const joining = this.railUnits.filter(item => item.join === unit.join);
      const index = joining.indexOf(unit);
      const seated = this.previewComplete || this.stepIndex > joinIndex ? 1
        : this.stepIndex < joinIndex ? 0 : railProgress(progress, index, joining.length);
      // Loose rails stay on the bench while the installed frame turns as a unit.
      const bench = this.model.worldToLocal(new THREE.Vector3(...unit.bench)).toArray();
      const pose = railPose({ ...unit, bench }, seated);
      unit.group.position.set(...pose.position);
      const benchRotation = this.model.quaternion.clone().invert().multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), unit.benchAngle));
      unit.group.quaternion.copy(benchRotation).slerp(new THREE.Quaternion(), smoothAssembly((seated - .38) / .17));
      const prefitting = this.railUnits.filter(item => item.prefit === unit.prefit);
      const inspecting = this.nutMap && this.nutScope === unit && current === unit.prefit && !this.previewComplete;
      const prefitProgress = inspecting ? this.nutReplayProgress
        : railProgress(progress, prefitting.indexOf(unit), prefitting.length);
      for (const bracket of unit.brackets) {
        bracket.object.position.copy(bracket.rest);
        bracket.screw.position.copy(bracket.screwRest);
        if (current === unit.prefit && !this.previewComplete) {
          bracket.object.visible = this.nutMap ? inspecting && (this.showFittedBrackets || prefitProgress > 0.6 && this.nutReplayTime !== null)
            : prefitProgress > 0.6;
          const placement = bracketInsertionProgress(prefitProgress);
          const axis = unit.alongX ? 'x' : 'z';
          bracket.object.position[axis] += Math.sign(bracket.rest[axis]) * 5 * (1 - placement);
          this.insertScrew(bracket.screw, fasteningProgress(prefitProgress,
            unit.brackets.indexOf(bracket), unit.brackets.length, 0.85), 1.3);
        } else bracket.object.visible = true;
      }
      for (const nut of unit.railNuts) {
        nut.object.position.copy(nut.rest);
        if (current === unit.prefit && !this.previewComplete) {
          const p = nutLoadingProgress(prefitProgress, nut.loadOrder, unit.railNuts.length);
          nut.object.position.lerpVectors(nut.end, nut.rest, smoothAssembly(p));
          nut.object.visible = p > 0;
        }
      }
      if (inspecting) {
        const loading = prefitProgress < 0.6;
        const next = Math.min(unit.railNuts.length, Math.floor(prefitProgress / 0.6 * unit.railNuts.length) + 1);
        const status = loading ? `End-load nut ${next} of ${unit.railNuts.length}. Keep both brackets off.`
          : this.showFittedBrackets || this.nutReplayTime !== null ? 'All nuts loaded. Now slide in the brackets.'
            : `Load 1 to ${unit.railNuts.length} first. Both brackets stay off until then.`;
        $('focus-label').textContent = status;
        this.container.dataset.nutLoadingPhase = loading ? 'nuts' : this.showFittedBrackets || this.nutReplayTime !== null ? 'brackets' : 'nuts-only';
      }
      for (const screw of unit.postScrews) {
        screw.object.position.copy(screw.rest);
        if (this.stepIndex === joinIndex && !this.previewComplete) {
          this.insertScrew(screw.object, (seated - 0.86) / 0.14, 1.3);
        }
      }
    }
  }
}

let viewer;
let stepIndex = 0;
let playing = false;
let autoplayTimer;
let playbackRate = ASSEMBLY_SPEED;

function updateTimeline(scene) {
  const total = assemblyTime(ASSEMBLY_STEPS, ASSEMBLY_STEPS.length - 1, 1);
  $('assembly-progress').max = total;
  let progress = scene.progress;
  if (scene.nutMap && scene.nutScope && scene.nutReplayTime !== null) {
    const rails = scene.railUnits.filter(unit => unit.prefit === ASSEMBLY_STEPS[stepIndex].id);
    progress = (rails.indexOf(scene.nutScope) + scene.nutReplayProgress) / rails.length;
  }
  $('assembly-progress').value = assemblyTime(ASSEMBLY_STEPS, stepIndex, progress);
  $('assembly-progress').setAttribute('aria-valuetext', `${ASSEMBLY_STEPS[stepIndex].title}, ${Math.round(progress * 100)} percent`);
  scene.container.dataset.progress = progress.toFixed(4);
}

function seekTimeline(seconds) {
  if (!viewer?.prepared) return;
  setPlaying(false);
  const position = assemblyPosition(ASSEMBLY_STEPS, seconds);
  if (position.index !== stepIndex) goToStep(position.index);
  if (viewer.nutMap) updateNutControls(false);
  viewer.previewComplete = false;
  viewer.replayTime = null;
  viewer.separation = 1 - position.progress;
  viewer.progress = position.progress;
  viewer.focusRequested = viewer.followPart;
  viewer.updateVisibility();
  $('complete-view').setAttribute('aria-pressed', 'false');
  $('separation').value = String(Math.round(viewer.separation * 100));
  $('separation-value').textContent = `${Math.round(viewer.separation * 100)}%`;
  updateTimeline(viewer);
}

function buildStepList() {
  let previousPhase;
  ASSEMBLY_STEPS.forEach((step, index) => {
    if (step.phase !== previousPhase) {
      const heading = document.createElement('h3');
      heading.className = 'phase-heading'; heading.textContent = step.phase;
      $('steps').append(heading); previousPhase = step.phase;
    }
    const button = document.createElement('button');
    button.className = 'step-link'; button.dataset.step = String(index);
    button.innerHTML = `<span class="step-number">${index + 1}</span><span>${step.title}</span>`;
    button.addEventListener('click', () => goToStep(index));
    $('steps').append(button);
    $('step-select').add(new Option(`${String(index + 1).padStart(2, '0')} - ${step.title}`, String(index)));
  });
}

function updateNotes() {
  const step = ASSEMBLY_STEPS[stepIndex];
  $('phase').textContent = step.phase;
  $('step-title').textContent = step.title;
  $('part-list').textContent = step.parts;
  $('focus-label').textContent = viewer?.previewComplete ? 'Complete detector' : step.focus;
  $('check-text').textContent = step.check;
  $('actions').replaceChildren(...step.actions.map(text => {
    const item = document.createElement('li'); item.textContent = text; return item;
  }));
  $('step-count').textContent = `${String(stepIndex + 1).padStart(2, '0')} / ${ASSEMBLY_STEPS.length}`;
  $('progress-text').textContent = `${stepIndex + 1} of ${ASSEMBLY_STEPS.length}`;
  if (viewer) updateTimeline(viewer);
  $('step-select').value = String(stepIndex);
  $('previous').disabled = stepIndex === 0;
  $('next').disabled = stepIndex === ASSEMBLY_STEPS.length - 1;
  $('open-lid').disabled = stepIndex < stepNumber('case') && !viewer?.previewComplete;
  $('open-lid').setAttribute('aria-pressed', String(!!viewer?.boxOpen));
  $('complete-view').setAttribute('aria-pressed', String(!!viewer?.previewComplete));
  $('separation').value = '0';
  const movable = !['brackets', 'complete'].includes(step.id);
  $('separation').disabled = !movable;
  $('replay').disabled = !movable;
  $('separation-value').textContent = '0%';
  document.querySelectorAll('.step-link').forEach((button, index) => {
    button.classList.toggle('is-past', index < stepIndex);
    if (index === stepIndex) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
    button.querySelector('.step-number').innerHTML = index < stepIndex
      ? '<i data-lucide="check"></i>' : String(index + 1);
  });
  setViewButtons('perspective');
  icons();
}

function updateNutControls(enabled, keepScope = false) {
  if (!viewer?.prepared) return;
  const select = $('nut-rail');
  if (!keepScope) {
    select.replaceChildren(new Option('All visible rails and posts', 'all'));
    viewer.railUnits.forEach((unit, index) => {
      if (unit.group.visible) select.add(new Option(unit.name, String(index)));
    });
    const current = ASSEMBLY_STEPS[stepIndex].id;
    const first = viewer.railUnits.findIndex(unit => unit.prefit === current);
    select.value = first < 0 ? 'all' : String(first);
  }
  const unit = select.value === 'all' ? null : viewer.railUnits[Number(select.value)];
  viewer.setNutMap(enabled, unit);
  const prefitting = !!unit && ASSEMBLY_STEPS[stepIndex].id === unit.prefit && !viewer.previewComplete;
  $('replay-nuts').disabled = !prefitting;
  $('fitted-brackets').checked = false;
  $('fitted-brackets').disabled = !prefitting;
  $('focus-label').textContent = enabled ? prefitting ? 'Load nuts from the arrow end in numbered order. Brackets last.'
    : 'Select a rail during its preparation step to check the loading sequence.' : ASSEMBLY_STEPS[stepIndex].focus;
  document.body.classList.toggle('nut-map-active', enabled);
  $('nut-map-toggle').setAttribute('aria-pressed', String(enabled));
  $('nut-map-controls').hidden = !enabled;
  const inventory = $('nut-inventory');
  inventory.hidden = !enabled;
  inventory.replaceChildren();
  $('check-text').textContent = enabled
    ? 'Insert all the nuts before fitting either end bracket. Feed the farthest position first, then work back towards the open end. A missed nut means reopening the joint.'
    : ASSEMBLY_STEPS[stepIndex].check;
  if (!enabled) return;
  const nuts = unit ? unit.railNuts : viewer.railUnits.filter(item => item.group.visible).flatMap(item => item.railNuts);
  const counts = Object.entries(NUT_ROLES).map(([role, value]) => `${nuts.filter(nut => nut.role === role).length} ${value.label.toLowerCase()}`).join(' / ');
  const summary = document.createElement('strong');
  summary.textContent = unit ? `${nuts.length} rail nuts: ${counts}` : `${nuts.length} rail nuts; ${viewer.postNuts.filter(nut => nut.object.visible).length} post nuts`;
  inventory.append(summary);
  if (unit) {
    const list = document.createElement('ol');
    for (const nut of nuts) {
      const item = document.createElement('li');
      item.textContent = `${NUT_ROLES[nut.role].label}: ${nut.groove.toLowerCase()}`;
      list.append(item);
    }
    inventory.append(list);
  }
  const note = document.createElement('span');
  note.textContent = 'Numbers are the insertion order, not part IDs. Fit both brackets only after the last nut is loaded.';
  inventory.append(note);
}

function setViewButtons(preset) {
  document.querySelectorAll('[data-view]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.view === preset));
  });
}

function goToStep(index, { auto = false } = {}) {
  if (!auto) setPlaying(false);
  stepIndex = Math.max(0, Math.min(ASSEMBLY_STEPS.length - 1, index));
  viewer?.setStep(stepIndex);
  updateNotes();
  updateNutControls(!playing && ['post-nuts', 'top-prefit', 'upper-prefit'].includes(ASSEMBLY_STEPS[stepIndex].id));
  history.replaceState(null, '', `#${ASSEMBLY_STEPS[stepIndex].id}`);
  if (auto && stepIndex === ASSEMBLY_STEPS.length - 1) setPlaying(false);
}

function setPlaying(value) {
  clearTimeout(autoplayTimer);
  if (!value && viewer?.replayTime !== null && viewer?.prepared) {
    const duration = ASSEMBLY_STEPS[stepIndex].duration || 4;
    viewer.separation = 1 - Math.min(1, viewer.replayTime / duration);
    viewer.replayTime = null;
  }
  playing = value;
  $('autoplay').setAttribute('aria-pressed', String(value));
  $('autoplay').setAttribute('aria-label', value ? 'Pause assembly sequence' : 'Play assembly sequence');
  $('autoplay').title = value ? 'Pause assembly sequence' : 'Play assembly sequence';
  $('autoplay').innerHTML = `<i data-lucide="${value ? 'pause' : 'play'}"></i>`;
  icons();
  if (value) {
    if (stepIndex === ASSEMBLY_STEPS.length - 1) goToStep(0, { auto: true });
    updateNutControls(false);
    if (viewer) {
      const progress = viewer.progress >= 1 ? 0 : viewer.progress;
      viewer.replayTime = progress * (ASSEMBLY_STEPS[stepIndex].duration || 4);
      viewer.separation = 1 - progress;
      $('follow-part').setAttribute('aria-pressed', String(viewer.followPart));
    }
    const schedule = () => {
      const stepDuration = ASSEMBLY_STEPS[stepIndex].duration || 4;
      const elapsed = viewer?.replayTime || 0;
      const duration = (stepDuration - elapsed) / playbackRate + 0.8;
      autoplayTimer = setTimeout(() => {
        if (!playing) return;
        if (!document.hidden) goToStep(stepIndex + 1, { auto: true });
        if (playing) schedule();
      }, duration * 1000);
    };
    schedule();
  }
}

buildStepList();
updateNotes();
$('previous').addEventListener('click', () => goToStep(stepIndex - 1));
$('next').addEventListener('click', () => goToStep(stepIndex + 1));
$('step-select').addEventListener('change', event => goToStep(Number(event.target.value)));
$('autoplay').addEventListener('click', () => setPlaying(!playing));
$('assembly-progress').addEventListener('input', event => seekTimeline(Number(event.target.value)));
$('seek-back').addEventListener('click', () => seekTimeline(Number($('assembly-progress').value) - 5));
$('playback-speed').addEventListener('change', event => {
  playbackRate = Number(event.target.value);
  if (playing) setPlaying(true);
});
$('replay').addEventListener('click', () => {
  if (!viewer?.prepared) return;
  viewer.previewComplete = false;
  viewer.updateVisibility(); updateNotes(); updateNutControls(false);
  viewer.replayTime = 0; viewer.separation = 0;
  $('follow-part').setAttribute('aria-pressed', String(viewer.followPart));
});
$('separation').addEventListener('input', event => {
  if (!viewer?.prepared) return;
  setPlaying(false);
  viewer.replayTime = null; viewer.previewComplete = false;
  viewer.separation = Number(event.target.value) / 100;
  viewer.focusRequested = viewer.followPart;
  viewer.updateVisibility();
  $('complete-view').setAttribute('aria-pressed', 'false');
  $('open-lid').disabled = stepIndex < stepNumber('case');
  $('focus-label').textContent = ASSEMBLY_STEPS[stepIndex].focus;
  $('separation-value').textContent = `${event.target.value}%`;
});
$('complete-view').addEventListener('click', () => {
  if (!viewer?.prepared) return;
  setPlaying(false);
  viewer.previewComplete = !viewer.previewComplete;
  viewer.replayTime = null; viewer.separation = 0;
  viewer.updateVisibility(); viewer.setCamera('perspective'); updateNotes(); updateNutControls(false);
});
$('follow-part').addEventListener('click', () => {
  if (!viewer) return;
  viewer.followPart = !viewer.followPart;
  $('follow-part').setAttribute('aria-pressed', String(viewer.followPart));
  if (viewer.followPart && !viewer.nutMap) {
    viewer.focusRequested = true;
    setViewButtons('perspective');
  }
});
function stopFollowing() {
  if (viewer) viewer.followPart = false;
  $('follow-part').setAttribute('aria-pressed', 'false');
}
function setInstructionsVisible(visible) {
  $('step-notes').hidden = !visible;
  document.body.classList.toggle('instructions-collapsed', !visible);
  const button = $('notes-toggle');
  button.setAttribute('aria-expanded', String(visible));
  button.setAttribute('aria-label', visible ? 'Hide assembly instructions' : 'Show assembly instructions');
  button.title = visible ? 'Hide instructions' : 'Show instructions';
  const icon = document.createElement('i');
  icon.dataset.lucide = visible ? 'panel-right-close' : 'panel-right-open';
  button.replaceChildren(icon);
  icons();
}
$('notes-toggle').addEventListener('click', () => setInstructionsVisible($('step-notes').hidden));
$('home-view').addEventListener('click', () => { stopFollowing(); viewer?.setCamera('perspective'); setViewButtons('perspective'); });
$('nut-map-toggle').addEventListener('click', () => {
  setPlaying(false);
  if (!viewer?.nutMap) setInstructionsVisible(true);
  updateNutControls(!viewer?.nutMap, true);
});
$('nut-rail').addEventListener('change', () => updateNutControls(true, true));
$('replay-nuts').addEventListener('click', () => {
  if (!viewer?.nutScope) return;
  viewer.nutReplayTime = 0; viewer.nutReplayProgress = 0; viewer.showFittedBrackets = false;
  $('fitted-brackets').checked = false;
});
$('fitted-brackets').addEventListener('change', event => {
  if (!viewer) return;
  viewer.nutReplayTime = null; viewer.nutReplayProgress = 1;
  viewer.showFittedBrackets = event.target.checked;
});
$('open-lid').addEventListener('click', () => {
  if (!viewer) return;
  viewer.boxOpen = !viewer.boxOpen;
  $('open-lid').setAttribute('aria-pressed', String(viewer.boxOpen));
});
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  stopFollowing();
  viewer?.setCamera(button.dataset.view); setViewButtons(button.dataset.view);
}));
$('full-screen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { /* Full-screen permission is optional; the guide remains usable. */ }
});
$('parts-button').addEventListener('click', () => $('parts-dialog').showModal());
$('mobile-parts-button').addEventListener('click', () => $('parts-dialog').showModal());
$('photo-button').addEventListener('click', () => $('photo-dialog').showModal());
document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.addEventListener('keydown', event => {
  if (event.target.closest('button, input, select, dialog, a')) return;
  if (event.key === 'ArrowRight') { event.preventDefault(); goToStep(stepIndex + 1); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); goToStep(stepIndex - 1); }
});
icons();

try {
  viewer = new AssemblyScene($('scene'));
  await viewer.prepare();
  const initial = ASSEMBLY_STEPS.findIndex(step => step.id === location.hash.slice(1));
  goToStep(initial < 0 ? 0 : initial);
  $('loading').hidden = true;
} catch (error) {
  console.error('Assembly guide', error);
  $('loading').replaceChildren(document.createTextNode('The 3D parts could not be loaded. Refresh to try again.'));
  $('scene').dataset.error = error.message;
}

import { sampleTilePhotons, OPTICAL_WINDOW_NS } from './tile-photons.js';
import { pointAtTime } from './muon-transport.js';
import { randomGenerator } from './simulation.js';
import * as THREE from 'three';

// Optical effects share the extracted tile's local coordinates.
export class ScintillationScene {
  constructor(group, light, camera, controls, redraw) {
    this.group = group;
    this.light = light;
    this.camera = camera;
    this.controls = controls;
    this.redraw = redraw;
    this.stage = 0;
    this.phase = 0;
    this.angle = 0;
    this.photonPaths = [];
    this.photonGeometry = new THREE.BufferGeometry();
    this.photonPositions = new THREE.BufferAttribute(new Float32Array(192 * 3), 3);
    this.photonGeometry.setAttribute('position', this.photonPositions);
    this.photonGeometry.setDrawRange(0, 0);
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 64;
    const context = sprite.getContext('2d');
    const glow = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    glow.addColorStop(0, '#ffffff');
    glow.addColorStop(.24, '#dcfbff');
    glow.addColorStop(.43, '#1178ef');
    glow.addColorStop(.58, '#1246aa');
    glow.addColorStop(.76, 'rgba(24, 125, 255, .45)');
    glow.addColorStop(1, 'rgba(24, 125, 255, 0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, 64, 64);
    const photonTexture = new THREE.CanvasTexture(sprite);
    photonTexture.colorSpace = THREE.SRGBColorSpace;
    this.photons = new THREE.Points(this.photonGeometry,
      new THREE.PointsMaterial({
        map: photonTexture,
        size: .78,
        toneMapped: false,
        transparent: true,
        depthWrite: false,
      }));
    this.photons.renderOrder = 7;
    this.photons.frustumCulled = false;
    this.group.add(this.photons);
    this.muon=new THREE.Mesh(new THREE.SphereGeometry(.25,12,10),new THREE.MeshBasicMaterial({color:'#165ec4',toneMapped:false}));this.group.add(this.muon);
    this.track=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#165ec4',transparent:true,opacity:.95,toneMapped:false}));this.group.add(this.track);
    this.spot=new THREE.Mesh(new THREE.SphereGeometry(.24,16,12),new THREE.MeshBasicMaterial({color:'#c6e9ff',transparent:true,opacity:.7}));this.group.add(this.spot);
    this.updateTrack();
  }
  updateTrack(){const a=this.angle*Math.PI/180;this.track.geometry.dispose();this.track.geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-Math.tan(a)*5,5.5,0),new THREE.Vector3(Math.tan(a)*5,-4.5,0)]);}
  setAngle(angle, crossing, tileY) {
    this.angle = angle;
    this.updateTrack();
    if (!crossing) {
      this.photonPaths = [];
      return;
    }
    const local = ([x, y, z]) => [x, y - tileY, z];
    this.photonPaths = sampleTilePhotons({
      entry: local(crossing.entry), exit: local(crossing.exit),
    }, this.photonPositions.count, randomGenerator(617));
    this.redraw();
  }
  setView(name) {
    if (!this.group.visible) return;
    const aim = this.group.position;
    this.controls.target.copy(aim);
    if (name === 'top') this.camera.position.set(0, 39, .01);
    else if (name === 'edge') this.camera.position.set(2, 3, 38);
    else this.camera.position.set(24, 21, 29);
    this.camera.position.add(aim);
    this.controls.update();
    this.redraw();
  }
  setStage(stage, phase) {
    this.stage = stage;
    this.phase = phase;
    this.redraw();
  }
  renderEffects() {
    const t = this.phase;
    const angle = this.angle * Math.PI / 180;
    const y = 5.5 - t * 10;
    this.muon.position.set((.5 - y) * Math.tan(angle), y, 0);
    this.muon.visible = this.stage === 0;
    this.track.visible = this.stage === 0;

    const sensorFired = this.stage === 4 && t >= .23;
    this.spot.visible = this.stage === 1 || this.stage === 2 || sensorFired;
    this.spot.position.set(...(sensorFired ? [-8.098,.35,8.098] : [0,.34,0]));
    this.spot.material.color.set(sensorFired ? '#ed7300' : '#1686ed');
    this.spot.material.opacity = sensorFired ? .25 + .65 * Math.exp(-5 * (t - .23)) : .7;
    this.spot.scale.setScalar(this.stage === 1 ? 1.3 + .7 * t : 1.6);

    this.photons.visible = this.stage === 2;
    if (this.photons.visible) {
      const timeNs = t * OPTICAL_WINDOW_NS;
      let visible = 0;
      for (const path of this.photonPaths) {
        if (timeNs < path[0].timeNs || timeNs > path.at(-1).timeNs) continue;
        this.photonPositions.setXYZ(visible++, ...pointAtTime(path, timeNs));
      }
      this.photonGeometry.setDrawRange(0, visible);
      this.photonPositions.needsUpdate = true;
    }

    if (this.light) {
      this.light.glow.material.uniforms.heads.value.set(.5 - t * .5, .5 + t * .5);
      this.light.glow.visible = this.stage === 3;
      this.light.core.material.emissiveIntensity = this.stage === 3 ? .3 : .04;
    }
  }
}

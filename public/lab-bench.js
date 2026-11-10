import * as THREE from 'three';
import { rotation, PIVOT } from './investigation-model.js';

function label(text, width = 5, color = '#40584b') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  const ctx = c.getContext('2d'); ctx.fillStyle = color; ctx.font = '600 48px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 128, 48);
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: true }));
  sprite.scale.set(width, width * 96 / 256, 1); return sprite;
}
function walnut() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#d4c8af'; ctx.fillRect(0, 0, 1024, 512);
  for (let row = 0; row < 512; row++) {
    const shade = 45 + 14 * Math.sin(row * .09) + 7 * Math.sin(row * .73);
    ctx.strokeStyle = `rgba(92,82,61,.075)`; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= 1024; x += 8) ctx.lineTo(x, row + 2 * Math.sin(x * .012 + row * .07));
    ctx.stroke();
  }
  for (let row = 0; row < 512; row += 128) { ctx.fillStyle = '#b7ad97'; ctx.fillRect(0, row, 1024, 2); }
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
// A visual teaching fixture, not supplied CAD or a released mount design.
export function createLabBench(view) {
  const root = new THREE.Group(); view.scene.add(root);
  view.scene.background = new THREE.Color('#242b30');
  const steel = new THREE.MeshStandardMaterial({ color: '#aeb8af', metalness: .8, roughness: .3 });
  const dark = new THREE.MeshStandardMaterial({ color: '#697a70', metalness: .65, roughness: .4 });
  const ink = new THREE.LineBasicMaterial({ color: '#50654f' });
  const mesh = (geometry, material, position, parent = root) => {
    const m = new THREE.Mesh(geometry, material); m.position.set(...position);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const texture = walnut();
  const board = mesh(new THREE.BoxGeometry(145, 3, 100), new THREE.MeshStandardMaterial({ map: texture, roughness: .52, metalness: 0 }), [0, -40.5, 0]);
  const mount = new THREE.Group(); root.add(mount);
  mesh(new THREE.CylinderGeometry(28, 29, 2, 96), dark, [0, -37.8, 0], mount);
  mesh(new THREE.CylinderGeometry(25.5, 25.5, .6, 96), steel, [0, -36.5, 0], mount);
  for (const x of [-23, 23]) {
    mesh(new THREE.BoxGeometry(2.4, 35, 4), steel, [x, -18.8, 0], mount);
    mesh(new THREE.BoxGeometry(8, 1, 10), dark, [x, -35.6, 0], mount);
    const hub = mesh(new THREE.CylinderGeometry(2.5, 2.5, 3.5, 40), dark, [x, -.95, 0], mount);
    hub.rotation.z = Math.PI / 2;
  }
  const cradle=new THREE.Group();root.add(cradle);
  mesh(new THREE.BoxGeometry(33,1.2,30),dark,[0,-19.1,0],cradle);
  for(const x of [-16,16]){
    mesh(new THREE.BoxGeometry(1.4,17.5,4),steel,[x,-9.7,0],cradle);
    const axle=mesh(new THREE.CylinderGeometry(.8,.8,7,24),steel,[Math.sign(x)*19.5,-.95,0],cradle);axle.rotation.z=Math.PI/2;
  }
  // Quarter-circle engraved scale, fixed to the yoke while the detector tilts.
  const arc = [];
  for (let i = 0; i <= 90; i++) arc.push(new THREE.Vector3(25.5, -.95 + 15*Math.cos(i*Math.PI/180), -15*Math.sin(i*Math.PI/180)));
  mount.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(arc), ink));
  for (let i = 0; i <= 90; i += 5) {
    const a=i*Math.PI/180,r=i%15===0?13.8:14.4;
    mount.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(25.5,-.95+r*Math.cos(a),-r*Math.sin(a)),new THREE.Vector3(25.5,-.95+15*Math.cos(a),-15*Math.sin(a))]),ink));
    if(i%15===0){const s=label(`${i}°`,3.5);s.position.set(26,-.95+17.2*Math.cos(a),-17.2*Math.sin(a));mount.add(s);}
  }
  const pointer = mesh(new THREE.CylinderGeometry(.12,.12,14,12), new THREE.MeshStandardMaterial({ color:'#ed7258',emissive:'#5a1d12' }), [26,-.95+7,0],mount);
  const knob=mesh(new THREE.CylinderGeometry(1.9,1.9,1.5,32),dark,[27,-.95,0],mount);knob.rotation.z=Math.PI/2;
  // Compass is fixed in world coordinates, independent of detector tilt.
  const ring=[];for(let i=0;i<=128;i++){const a=i/128*Math.PI*2;ring.push(new THREE.Vector3(33*Math.sin(a),-38.92,-33*Math.cos(a)));}
  root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring),ink));
  for(let degrees=0;degrees<360;degrees+=10){const a=degrees*Math.PI/180,r=degrees%30===0?30.5:32;root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(r*Math.sin(a),-38.9,-r*Math.cos(a)),new THREE.Vector3(33*Math.sin(a),-38.9,-33*Math.cos(a))]),ink));}
  for(const [name,a]of [['N',0],['E',90],['S',180],['W',270]]){const s=label(name,5,name==='N'?'#92563e':'#40584b');s.position.set(37*Math.sin(a*Math.PI/180),-37.5,-37*Math.cos(a*Math.PI/180));root.add(s);}
  return { root, board, update(tilt,azimuth){
    mount.rotation.y=-azimuth*Math.PI/180;
    const turn=rotation(tilt,azimuth);
    const matrix=new THREE.Matrix4().makeBasis(...[[1,0,0],[0,1,0],[0,0,1]].map(p=>new THREE.Vector3(...turn(p))));
    cradle.quaternion.setFromRotationMatrix(matrix);
    const pivot=turn(PIVOT);cradle.position.set(...PIVOT.map((v,i)=>v-pivot[i]));
    const t=tilt*Math.PI/180;
    pointer.position.set(26,-.95+7*Math.cos(t),-7*Math.sin(t));pointer.rotation.x=-t;
  }};
}

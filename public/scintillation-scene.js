import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { STLLoader } from './vendor/loaders/STLLoader.js';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { fibreCurve, FibreLight } from './fibre.js';
import { applyStudioAppearance } from './studio-appearance.js';
import { createSiPMMount } from './sipm-mount.js';

// Actual tile/holder/sensor geometry with deliberately illustrative optical packets.
export class ScintillationScene {
  constructor(container) {
    this.container=container;this.stage=0;this.phase=0;this.angle=0;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#222b32');
    this.camera=new THREE.PerspectiveCamera(40,1,.1,150);this.camera.position.set(20,20,23);
    this.renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.2;
    container.append(this.renderer.domElement);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.enablePan=false;this.controls.minDistance=10;this.controls.maxDistance=55;
    this.scene.add(new THREE.HemisphereLight('#ebf4fa','#283b43',2.5));
    for(const [color,intensity,p]of [['#fff0d8',4,[12,25,10]],['#c4dce9',3,[-15,10,-12]]]){const l=new THREE.DirectionalLight(color,intensity);l.position.set(...p);this.scene.add(l);}
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(150,150),new THREE.MeshStandardMaterial({color:'#31414a',roughness:.85}));floor.rotation.x=-Math.PI/2;floor.position.y=-1.1;this.scene.add(floor);
    this.packets=[];
    const geometry=new THREE.SphereGeometry(.09,10,8);
    for(let i=0;i<24;i++){const p=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:'#347cb4'}));this.scene.add(p);this.packets.push(p);}
    this.muon=new THREE.Mesh(new THREE.SphereGeometry(.25,12,10),new THREE.MeshBasicMaterial({color:'#165ec4',toneMapped:false}));this.scene.add(this.muon);
    this.track=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#165ec4',transparent:true,opacity:.95,toneMapped:false}));this.scene.add(this.track);
    this.spot=new THREE.Mesh(new THREE.SphereGeometry(.24,16,12),new THREE.MeshBasicMaterial({color:'#c6e9ff',transparent:true,opacity:.7}));this.scene.add(this.spot);
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);
    applyStudioAppearance(this);
    this.ready=this.load();
    this.frame=this.frame.bind(this);requestAnimationFrame(this.frame);this.resize();
  }
  async load(){
    const loader=new STLLoader();
    const [tile,holder,data,sipm]=await Promise.all([loader.loadAsync('./assets/tile.stl'),loader.loadAsync('./assets/holder.stl'),fetch('./assets/fibre-path.json').then(r=>r.json()),new GLTFLoader().loadAsync('./assets/sipm.glb')]);
    for(const g of [tile,holder])g.translate(-100,-100,-5).scale(.1,.1,.1).rotateX(-Math.PI/2);
    this.tile=new THREE.Mesh(tile,new THREE.MeshPhysicalMaterial({color:'#8ba5ac',transparent:true,opacity:.6,metalness:0,roughness:.2,clearcoat:1,depthWrite:false}));this.scene.add(this.tile);
    this.scene.add(new THREE.LineSegments(new THREE.EdgesGeometry(tile,35),new THREE.LineBasicMaterial({color:'#657f82',transparent:true,opacity:.75})));
    this.scene.add(new THREE.Mesh(holder,new THREE.MeshStandardMaterial({color:'#252a31',roughness:.5})));
    const {mount,cableCurve}=createSiPMMount(sipm.scene,0,0);this.scene.add(mount);
    this.scene.add(new THREE.Mesh(new THREE.TubeGeometry(cableCurve,80,.055,8),new THREE.MeshStandardMaterial({color:'#151919',roughness:.6})));
    this.light=new FibreLight(fibreCurve(data,0),data.diameter_mm/20);this.scene.add(this.light.core,this.light.glow);
    this.light.core.material.color.set('#447640');this.light.core.material.emissive.set('#448b3b');this.light.glow.material.blending=THREE.NormalBlending;
    // Surface-emission schematic glow; no calibrated brightness or optical index.
    for(const [name,p,width]of [['Scintillator',[8,1.5,-1],8],['WLS fibre',[2,2,-6],6.5],['SiPM',[-9,1.8,8],5]]){
      const canvas=document.createElement('canvas');canvas.width=384;canvas.height=96;const c=canvas.getContext('2d');
      c.fillStyle='rgba(255,255,252,.94)';c.fillRect(0,0,384,96);c.fillStyle='#314e44';c.font='550 44px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(name,192,48);
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
      const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,depthWrite:false,toneMapped:false}));sprite.renderOrder=20;sprite.scale.set(width,width/4,1);sprite.position.set(...p);this.scene.add(sprite);
    }
    this.container.dataset.ready='true';this.updateTrack();
  }
  resize(){const {width,height}=this.container.getBoundingClientRect();this.camera.aspect=width/Math.max(1,height);this.camera.updateProjectionMatrix();this.renderer.setSize(width,height,false);}
  updateTrack(){const a=this.angle*Math.PI/180;this.track.geometry.dispose();this.track.geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-Math.tan(a)*5,5.5,0),new THREE.Vector3(Math.tan(a)*5,-4.5,0)]);}
  setAngle(angle){this.angle=angle;this.updateTrack();}
  setView(name){
    if(name==='top')this.camera.position.set(0,34,.01);
    else if(name==='edge')this.camera.position.set(2,2.7,33);
    else this.camera.position.set(20,20,23);
    this.controls.target.set(0,0,0);this.controls.update();
  }
  setStage(stage,phase){this.stage=stage;this.phase=phase;}
  frame(now){
    requestAnimationFrame(this.frame);if(document.hidden)return;
    const t=this.phase;
    const a=this.angle*Math.PI/180;
    const y=5.5-t*10;this.muon.position.set((.5-y)*Math.tan(a),y,0);
    this.muon.visible=this.stage<3;this.track.visible=this.stage<3;
    this.spot.visible=this.stage>0;this.spot.position.set(...(this.stage===4?[-8.098,.35,8.098]:[0,.34,0]));this.spot.material.color.set(this.stage===4?'#ffcc7c':'#c6e9ff');this.spot.scale.setScalar(1+Math.sin(t*Math.PI*2)*.2);
    for(let i=0;i<this.packets.length;i++){
      const p=this.packets[i],angle=i*2.39996;
      p.visible=this.stage===2||this.stage===3;
      const distance=(.4+(i%5)/5)*((t+i/this.packets.length)%1)*8;
      p.position.set(Math.cos(angle)*distance,.32,Math.sin(angle)*distance);
    }
    if(this.light){
      const phase=this.stage===3?this.phase:2;
      this.light.glow.material.uniforms.heads.value.set(.5-phase*.5,.5+phase*.5);
      this.light.glow.visible=this.stage===3;
      this.light.core.material.emissiveIntensity=this.stage===3?.3:.04;
    }
    this.controls.update();this.renderer.render(this.scene,this.camera);
  }
}

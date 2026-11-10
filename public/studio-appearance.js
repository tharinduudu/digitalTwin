import * as THREE from 'three';

// Shared lighting makes source CAD belong to the same warm, light interface.
// Geometry and scientific state are deliberately untouched.
export function applyStudioAppearance(view) {
  view.scene.background = new THREE.Color('#edf0e9');
  const room = new THREE.Scene();
  room.add(new THREE.Mesh(new THREE.BoxGeometry(160,160,160),new THREE.MeshBasicMaterial({color:'#b5bfb4',side:THREE.BackSide})));
  for(const [w,h,p,r,strength]of [
    [90,65,[0,65,0],[-Math.PI/2,0,0],3],
    [50,70,[-65,10,10],[0,Math.PI/2,0],2],
    [65,50,[5,10,65],[0,Math.PI,0],1.5],
  ]){
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(strength,strength,strength),side:THREE.DoubleSide}));
    panel.position.set(...p);panel.rotation.set(...r);room.add(panel);
  }
  const generator=new THREE.PMREMGenerator(view.renderer);
  const environment=generator.fromScene(room,0);
  view.scene.environment=environment.texture;
  generator.dispose();
  room.traverse(object=>{object.geometry?.dispose();if(object.material)object.material.dispose();});
  view.renderer.toneMappingExposure=.92;
  view.scene.environmentIntensity=.7;
  view.scene.traverse(object=>{
    if(object.isSprite&&object.material?.map)object.material.color.set('#536f5b');
    if(object.isHemisphereLight){object.color.set('#f5f7f0');object.groundColor.set('#9ba89c');object.intensity=1.6;}
    if(object.isDirectionalLight)object.intensity=Math.min(object.intensity,2.5);
    if(object.isMesh&&object.geometry.type==='PlaneGeometry'&&object.rotation.x<-1){
      object.material.color?.set('#dde3d7');object.material.roughness=.95;
    }
  });
  view.studioEnvironment=environment;
}

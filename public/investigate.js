import * as THREE from 'three';
import { TelescopeScene } from './scene.js';
import { createLabBench } from './lab-bench.js';
import { applyStudioAppearance } from './studio-appearance.js';
import { rotation, orientPoint, observation, RateExperiment, PIVOT } from './investigation-model.js';
const $=id=>document.getElementById(id);
let scene,bench,worker,lastResult,examples=[],exampleIndex=0,playing=true;
let runs=[];
try {
 const saved=JSON.parse(sessionStorage.getItem('glowcost-investigation-runs') || '[]');
 if(Array.isArray(saved)&&saved.every(r=>r.counts&&r.rates&&r.numericalSE&&r.minutes>0))runs=saved;
} catch { /* Storage is optional in private browsing. */ }
const rateCache=new Map();
let visualLine,visualHead,visualAge=0,currentTrack;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
playing=!reduced;
$('play-sky').textContent=playing?'Pause preview':'Play preview';
$('play-sky').setAttribute('aria-pressed',String(playing));
const bearing=a=>['North','NE','East','SE','South','SW','West','NW'][Math.round(a/45)%8];
function settings(){return {tilt:Number($('tilt').value),azimuth:Number($('azimuth').value),days:Number($('duration').value),samples:Number($('precision').value),orientationModel:'tilt-yaw-v2'};}
function updateOrientation(){
  const {tilt,azimuth}=settings();
  $('tilt-value').textContent=`${tilt}°`;
  $('orientation-summary').textContent=`${tilt}° tilt · ${bearing(azimuth)}`;
  $('azimuth-value').textContent=`${azimuth}° · ${bearing(azimuth)}`;
  bench?.update(tilt,azimuth);
  document.querySelectorAll('[data-tilt]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.tilt)===tilt)));
  document.querySelectorAll('[data-az]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.az)===azimuth)));
  if(scene){
    const turn=rotation(tilt,azimuth);
    const x=turn([1,0,0]),y=turn([0,1,0]),z=turn([0,0,1]);
    const matrix=new THREE.Matrix4().makeBasis(new THREE.Vector3(...x),new THREE.Vector3(...y),new THREE.Vector3(...z));
    scene.model.quaternion.setFromRotationMatrix(matrix);
    const pivot=turn(PIVOT);
    scene.model.position.set(...PIVOT.map((v,i)=>v-pivot[i]));
    scene.model.updateMatrixWorld(true);
    examples=[];currentTrack=null;visualLine.visible=false;visualHead.visible=false;
    // A small separate sample only supplies illustrative preview paths, never counts.
    const preview=new RateExperiment({tilt,azimuth,seed:1241});
    preview.advance(1200);
    examples=preview.result().examples;
    $('visual-status').textContent=`Virtual orientation: ${tilt}° towards ${bearing(azimuth)}. Animated examples are slowed and are not the observation data. Fixture geometry is illustrative, not fabrication CAD.`;
  }
}
try{
 scene=new TelescopeScene($('experiment-scene'));
 scene.paused=true;scene.setCutaway(false);
 bench=createLabBench(scene);
 applyStudioAppearance(scene);
 scene.camera.position.set(72,45,96);scene.controls.target.set(0,-12,0);scene.controls.update();
 for(const child of scene.scene.children)if(child.isMesh&&child.geometry.type==='PlaneGeometry')child.position.y=-42.1;
 // World arrows remain vertical as the instrument rotates.
 for(const x of [-24,24])scene.scene.add(new THREE.ArrowHelper(new THREE.Vector3(0,-1,0),new THREE.Vector3(x,28,0),14,0x4a7664,2,1));
 visualLine=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x165ec4,transparent:true,opacity:.95,toneMapped:false}));
 visualHead=new THREE.Mesh(new THREE.SphereGeometry(.5,12,8),new THREE.MeshBasicMaterial({color:0x165ec4,toneMapped:false}));
 scene.scene.add(visualLine,visualHead);visualLine.visible=false;visualHead.visible=false;
 scene.beforeRender=dt=>{
  if(!playing||!examples.length)return;
  visualAge+=dt;
  if(!currentTrack||visualAge>currentTrack.durationNs/2+1){
   currentTrack=examples[exampleIndex++%examples.length];visualAge=0;
   visualLine.geometry.dispose();visualLine.geometry=new THREE.BufferGeometry().setFromPoints(currentTrack.path.map(p=>new THREE.Vector3(...p.position)));
   // A visible display-width trail along the transported path, not a particle diameter.
   for(const child of [...visualLine.children]){visualLine.remove(child);child.geometry.dispose();child.material.dispose();}
   const points=currentTrack.path.map(p=>new THREE.Vector3(...p.position));
   for(let i=1;i<points.length;i++){
    const delta=points[i].clone().sub(points[i-1]),length=delta.length();if(length<1e-6)continue;
    const segment=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,length,6),new THREE.MeshBasicMaterial({color:0x165ec4,toneMapped:false}));
    segment.position.copy(points[i-1]).add(points[i]).multiplyScalar(.5);segment.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());visualLine.add(segment);
   }
   visualLine.visible=true;visualHead.visible=true;
  }
  const time=visualAge*2,path=currentTrack.path;
  let p=path.at(-1).position;
  for(let i=1;i<path.length;i++)if(time<=path[i].timeNs){const a=path[i-1],b=path[i],f=Math.max(0,(time-a.timeNs)/(b.timeNs-a.timeNs));p=a.position.map((v,j)=>v+(b.position[j]-v)*f);break;}
  visualHead.position.set(...p);
 };
 scene.ready.then(()=>{scene.alignReadoutPorts();updateOrientation();$('experiment-scene').dataset.ready='true';});
}catch(error){console.error(error);$('visual-status').textContent='3D unavailable. The experiment controls and numerical calculation still work.';}
for(const id of ['tilt','azimuth'])$(id).addEventListener('input',updateOrientation);
for(const button of document.querySelectorAll('[data-tilt]'))button.onclick=()=>{$('tilt').value=button.dataset.tilt;updateOrientation();};
for(const button of document.querySelectorAll('[data-az]'))button.onclick=()=>{$('azimuth').value=button.dataset.az;updateOrientation();};
$('reset-view').onclick=()=>{if(scene){scene.camera.position.set(72,45,96);scene.controls.target.set(0,-12,0);scene.controls.update();}};
$('play-sky').onclick=()=>{playing=!playing;$('play-sky').setAttribute('aria-pressed',String(playing));$('play-sky').textContent=playing?'Pause preview':'Play preview';};
function busy(value){
 for(const id of ['run','tilt','azimuth','duration','precision','next-comparison','starter-baseline'])$(id).disabled=value;
 document.querySelectorAll('[data-tilt],[data-az]').forEach(b=>b.disabled=value);
 $('cancel').hidden=!value;$('progress').hidden=!value;
}
function collect(result,config){
 lastResult=result;examples=result.examples;
 const seed=crypto.getRandomValues(new Uint32Array(1))[0];
 const sample=observation(result,config.days,seed);
 runs.push({...config,...sample,rates:result.rates,numericalSE:result.numericalSE,rateSamples:result.samples});
 renderRuns();
 $('run-status').textContent=`Run ${runs.length} saved: ${config.tilt}°, ${bearing(config.azimuth)}, ${config.days} simulated days. Numerical rate calculated from ${result.samples.toLocaleString()} source muons. Collect again for another counting realization.`;
 busy(false);
}
$('run').onclick=()=>{
 const config=settings(),key=`${config.tilt}/${config.azimuth}/${config.samples}`;
 if(rateCache.has(key)){collect(rateCache.get(key),config);return;}
 busy(true);$('progress').value=0;$('run-status').textContent='Transporting source muons through the rotated tiles…';
 worker=new Worker(new URL('./investigation-worker.js',import.meta.url),{type:'module'});
 worker.onmessage=({data})=>{
  if(data.progress!==undefined){$('progress').value=data.progress;$('run-status').textContent=`Calculating acceptance: ${Math.round(data.progress*100)}%`;}
  if(data.result){rateCache.set(key,data.result);collect(data.result,config);worker.terminate();worker=null;}
  if(data.error){$('run-status').textContent=`Calculation failed: ${data.error}`;busy(false);worker.terminate();worker=null;}
 };
 worker.onerror=()=>{$('run-status').textContent='Calculation failed. Please retry; no observation was saved.';busy(false);worker?.terminate();worker=null;};
 worker.postMessage(config);
};
$('cancel').onclick=()=>{worker?.terminate();worker=null;busy(false);$('run-status').textContent='Calculation cancelled. Previous observations are kept.';};
const number=n=>n.toLocaleString(undefined,{maximumFractionDigits:0});
function renderRuns(){
 const latest=runs.at(-1);
 $('result-insight').hidden=!latest;
 $('next-comparison').hidden=!latest;
 if(latest){
   const rate=latest.counts.c02/latest.minutes;
   $('result-insight').textContent=`Latest observation: ${rate.toFixed(2)} top–bottom coincidences per minute at ${latest.tilt}°. Compare rates to account for different exposure times.`;
   $('next-comparison').textContent=`Compare with ${latest.tilt===0?'60° tilt':'an upright detector'}`;
 }

 try {sessionStorage.setItem('glowcost-investigation-runs',JSON.stringify(runs));} catch { /* CSV remains available without browser storage. */ }
 $('runs').replaceChildren();
 for(const [i,run]of runs.entries()){
  const tr=document.createElement('tr');
  const labels=[`#${i+1} · ${run.tilt}° / ${run.azimuth}° ${bearing(run.azimuth)}`,`${run.days} days`];
  for(const text of labels){const td=document.createElement('td');td.textContent=text;tr.append(td);}
  if(!run.orientationModel){const note=document.createElement('small');note.textContent='Earlier orientation convention';tr.firstChild.append(note);}
  for(const key of ['c01','c12','c02','triple']){
   const td=document.createElement('td');td.textContent=number(run.counts[key]);
   const small=document.createElement('small');small.textContent=`${(run.counts[key]/run.minutes).toFixed(2)}/min · counting SE ${(Math.sqrt(run.counts[key])/run.minutes).toFixed(3)}`;td.append(small);
   const mc=document.createElement('small');mc.textContent=`model ${run.rates[key].toFixed(2)} ± ${run.numericalSE[key].toFixed(2)}/min (MC)`;td.append(mc);tr.append(td);
  }
  $('runs').append(tr);
 }
 if(!runs.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.textContent='No observations yet.';tr.append(td);$('runs').append(tr);}
 $('export').disabled=!runs.length;$('clear').disabled=!runs.length;drawChart();
}
function drawChart(){
 const canvas=$('comparison'),w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio,2);canvas.width=w*dpr;canvas.height=h*dpr;
 const c=canvas.getContext('2d');c.scale(dpr,dpr);c.fillStyle='#fff';c.fillRect(0,0,w,h);
 if(!runs.length){c.fillStyle='#718268';c.font='13px system-ui';c.fillText('Collect two orientations to start a comparison.',20,45);return;}
 const max=Math.max(...runs.map(r=>Math.max(r.rates.c02+3*r.numericalSE.c02,r.counts.c02/r.minutes)*1.15),1),left=50,right=w-20,top=20,bottom=h-45;
 c.font='11px system-ui';c.strokeStyle='#dce5d5';c.fillStyle='#64765a';
 for(let i=0;i<=4;i++){const y=bottom-(bottom-top)*i/4;c.beginPath();c.moveTo(left,y);c.lineTo(right,y);c.stroke();c.fillText((max*i/4).toFixed(0),5,y+4);}
 runs.forEach((r,i)=>{const x=left+(right-left)*(i+.5)/runs.length,y=bottom-(bottom-top)*r.rates.c02/max,error=(bottom-top)*r.numericalSE.c02/max;
 c.strokeStyle='#88aa76';c.lineWidth=5;c.beginPath();c.moveTo(x,y-error);c.lineTo(x,y+error);c.stroke();c.fillStyle='#285e47';c.beginPath();c.arc(x,bottom-(bottom-top)*(r.counts.c02/r.minutes)/max,4,0,Math.PI*2);c.fill();
 c.fillStyle='#64765a';c.fillText(`#${i+1}`,x-8,bottom+19);});
 c.fillText('coincidences / minute · 0–2',left,h-5);
}
$('clear').onclick=()=>{runs=[];renderRuns();};
$('export').onclick=()=>{
 const headers=['run','orientation_model','tilt_deg','azimuth_deg','days','source_samples','observation_seed','pair','count','observed_per_min','counting_SE_per_min','model_per_min','MC_SE_per_min'];
 const rows=[headers.join(',')];
 runs.forEach((r,i)=>{for(const key of ['c01','c12','c02','triple'])rows.push([i+1,r.orientationModel||'earlier-minimal-rotation',r.tilt,r.azimuth,r.days,r.rateSamples,r.seed,key,r.counts[key],r.counts[key]/r.minutes,Math.sqrt(r.counts[key])/r.minutes,r.rates[key],r.numericalSE[key]].join(','));});
 const blob=new Blob(['# Simulated stationary sea-level open-sky ideal detector; not measured data. Monte Carlo errors are not physical model uncertainties.\n'+rows.join('\n')],{type:'text/csv'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='glowcost-angle-investigation.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
new ResizeObserver(drawChart).observe($('comparison'));updateOrientation();renderRuns();

if(runs.length)$('run-status').textContent=`Restored ${runs.length} saved observation${runs.length===1?'':'s'} in this tab. Choose settings to add another.`;

$('next-comparison').onclick=()=>{
 const last=runs.at(-1);if(!last)return;
 $('tilt').value=last.tilt===0?60:0;$('azimuth').value=last.azimuth;$('duration').value=last.days;
 updateOrientation();
 $('run-status').textContent='Comparison ready: the exposure and compass bearing match your last observation. Collect data when ready.';
 $('run').focus();
};

$('starter-baseline').onclick=()=>{
 $('tilt').value=0;$('azimuth').value=0;$('duration').value=7;updateOrientation();
 $('run-status').textContent='Upright baseline ready: one simulated week. Collect it, then use the comparison suggestion to test a tilt.';
 $('run').focus();
};

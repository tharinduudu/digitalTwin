import { ScintillationScene } from './scintillation-scene.js';
import { traceMuon } from './muon-transport.js';
import { TILE_HEIGHTS } from './detector-geometry.js';
const $=id=>document.getElementById(id);
const stages=[
 ['Energy deposition','A charged particle transfers energy to electrons in the plastic. Excitation and ionization leave the material with energy to release. Only some of that deposited energy becomes light.','The moving muon is a teaching marker. Energy transfer explains the physical process; this detector does not measure the muon’s energy or the deposited energy.'],
 ['Molecular excitation','Energy can reach fluorescent molecules in an organic scintillator. They enter excited electronic states, with energy also distributed among molecular vibrations.','These are conceptual molecular energy levels, not circular electron orbits. The supplied tile’s specific fluorescent formulation is not known here.'],
 ['Relaxation and fluorescence','Some energy is lost without light, including through vibrational relaxation. A radiative transition emits a photon as the molecule returns towards a lower electronic state.','The drawing separates non-radiative relaxation from fluorescence. It does not assign an unverified wavelength, lifetime or light yield to this tile.'],
 ['Collection by the WLS fibre','Light spreads through the tile. Some reaches the wavelength-shifting fibre, is absorbed and re-emitted at a longer wavelength. A fraction travels along the fibre towards the sensor.','The fibre path follows the supplied groove section. Travelling dots show the idea; their number, speed and collection efficiency are not a photon-transport calculation.'],
 ['A SiPM avalanche','A photon reaching the Hamamatsu S13360-2050VE can trigger an avalanche in a biased microcell. The combined cell signals form an electrical pulse for the readout.','Arrival does not guarantee detection. Photon detection probability, dark noise and microcell response are not calculated in this illustration.'],
];
let phase=0,playing=false,last=0,groove=[];
let tileView;
try {tileView=new ScintillationScene($('tile-scene'));tileView.ready.catch(error=>{console.error(error);$('tile-scene').textContent='Tile CAD unavailable. The process diagrams remain available.';});}
catch(error){console.error(error);$('tile-scene').textContent='3D unavailable. Explore the diagrams below.';}
for(const b of document.querySelectorAll('[data-tile-view]'))b.onclick=()=>tileView?.setView(b.dataset.tileView);
const canvas=$('optical-canvas'),ctx=canvas.getContext('2d');
const buttons=stages.map((stage,i)=>{const b=document.createElement('button');b.textContent=`${i+1} ${['Energy','Excitation','Light','Fibre','Signal'][i]}`;b.setAttribute('aria-label',`Stage ${i+1}: ${stage[0]}`);b.onclick=()=>{playing=false;setPhase(i);};document.querySelector('.stages').append(b);return b;});
function setPhase(value){
 phase=Math.min(4.999,Math.max(0,value));const i=Math.floor(phase),[title,body,detail]=stages[i];
 $('stage-label').textContent=`STAGE ${i+1} OF 5`;
 $('continue-lab').hidden=i!==4;$('stage-title').textContent=title;$('stage-body').textContent=body;$('stage-detail').textContent=detail;
 tileView?.setStage(i,phase-i);
 $('process-time').value=phase;$('process-value').textContent=`${i+1} / 5`;
 buttons.forEach((b,j)=>{if(j===i)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
 $('play-process').textContent=playing?'Pause sequence':'Play sequence';$('play-process').setAttribute('aria-pressed',String(playing));
 $('drawing-title').textContent=i<3?'CONCEPTUAL MOLECULAR ENERGY DIAGRAM':i===3?'TILE GROOVE → WAVELENGTH-SHIFTING FIBRE':'PHOTON → MICROCELL → ELECTRICAL PULSE';
 const status=`${title}. Animation is slowed for explanation.`;if($('stage-status').textContent!==status)$('stage-status').textContent=status;draw();
}
function resize(){const d=Math.min(devicePixelRatio,2);canvas.width=canvas.clientWidth*d;canvas.height=canvas.clientHeight*d;draw();}
function line(x1,y1,x2,y2,color,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function dot(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
function text(t,x,y,color='#344b3e',size=12){ctx.fillStyle=color;ctx.font=`${size}px system-ui`;ctx.fillText(t,x,y);}
function arrow(x1,y1,x2,y2,color){line(x1,y1,x2,y2,color,2);const a=Math.atan2(y2-y1,x2-x1);line(x2,y2,x2-8*Math.cos(a-.4),y2-8*Math.sin(a-.4),color);line(x2,y2,x2-8*Math.cos(a+.4),y2-8*Math.sin(a+.4),color);}
function wave(x1,y1,x2,y2,color){ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();const dx=x2-x1,dy=y2-y1,l=Math.hypot(dx,dy);if(l<.01)return;for(let i=0;i<=80;i++){const t=i/80,o=Math.sin(t*10*Math.PI)*4;const x=x1+dx*t-dy/l*o,y=y1+dy*t+dx/l*o;if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();}
function draw(){
 const d=Math.min(devicePixelRatio,2),w=canvas.clientWidth,h=canvas.clientHeight;if(!w)return;ctx.setTransform(d,0,0,d,0,0);ctx.fillStyle='#edf0e9';ctx.fillRect(0,0,w,h);
 const stage=Math.floor(phase),t=phase-stage;
 if(stage<3){
  const l=w*.2,r=w*.75,low=h*.76,high=h*.27,relax=h*.39;
  text('Energy ↑',12,30,'#5c6d5d',11);arrow(38,110,38,70,'#5f7652');
  line(l,low,r,low,'#607751',3);text('Ground state',l,low+26);
  line(l,high,r,high,'#607751',3);line(l,relax,r,relax,'#81936e',2);text('Excited states',l,high-17);
  for(let i=1;i<3;i++)line(l,high+i*10,r,high+i*10,'#aab89b',1);
  if(stage===0){const y=low-20;arrow(12,y,w*.42,y,'#995e28');dot(12+(w*.4)*t,y,5,'#ad702e');text('Muon transfers energy',l,h*.9,'#995e28',11);}
  if(stage===1){arrow(w*.43,low-8,w*.43,high+8,'#995e28');dot(w*.43,low-(low-high)*t,6,'#995e28');text('Excitation',l,h*.9,'#995e28',12);}
  if(stage===2){wave(w*.32,high,w*.32,relax,'#8b6542');text('Heat / vibrations',w*.58,45,'#8b6542',11);arrow(w*.6,relax+5,w*.6,low-6,'#3577a7');wave(w*.6,relax+30,w*.6+Math.min(w*.26,100)*t,relax+30,'#3577a7');text('Fluorescence: a photon leaves',l,h*.9,'#3577a7',11);}
 }else if(stage===3){
  const size=Math.min(w*.72,h*.6),x=(w-size)/2,y=32;ctx.fillStyle='#dce6d5';ctx.strokeStyle='#8aa07c';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(x+size*.19,y);ctx.lineTo(x+size,y);ctx.lineTo(x+size,y+size);ctx.lineTo(x,y+size);ctx.lineTo(x,y+size*.19);ctx.closePath();ctx.fill();ctx.stroke();
  const points=groove.map(([a,b])=>[x+a/200*size,y+b/200*size]);
  ctx.strokeStyle='#4a7c48';ctx.lineWidth=3;ctx.beginPath();points.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.stroke();
  for(let i=0;i<6;i++){const a=i*Math.PI/3;wave(x+size/2,y+size/2,x+size/2+Math.cos(a)*size*.25,y+size/2+Math.sin(a)*size*.25,'#3577a7');}
  if(points.length){const k=Math.floor((1-t)*(points.length-1));dot(...points[k],5,'#44814b');}
  ctx.fillStyle='#805d2c';ctx.fillRect(x+size*.06,y+size*.04,15,15);text('SiPM',x,y+size+24,'#805d2c');text('Source groove · top view',x,h-20,'#637458',11);
 }else{
  const x=w*.25,y=55,size=Math.min(w*.4,h*.4,130);text('Illustrative microcells',x,30,'#556e48',12);
  for(let i=0;i<5;i++)for(let j=0;j<5;j++){ctx.fillStyle=(i===2&&j===2)?'#4d925d':'#bcccb1';ctx.fillRect(x+i*size/5,y+j*size/5,size/5-3,size/5-3);}
  wave(12,y+size*.5,x-5,y+size*.5,'#44814b');text('Photon',12,y+size*.5+30,'#467642',11);
  const base=h-65;line(x,base,w*.87,base,'#789169');ctx.strokeStyle='#a06a2b';ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<150;i++){const q=i/149,v=q>.2?Math.exp(-(q-.2)*8)-Math.exp(-(q-.2)*60):0;const xx=x+q*(w*.6),yy=base-v*70;if(i)ctx.lineTo(xx,yy);else ctx.moveTo(xx,yy);}ctx.stroke();text('Conceptual pulse · no voltage/time scale',20,h-22,'#5a6e4f',11);
 }
}
$('process-time').oninput=()=>{playing=false;setPhase(Number($('process-time').value));};
$('play-process').onclick=()=>{if(phase>=4.99)phase=0;playing=!playing;setPhase(phase);};
$('restart-process').onclick=()=>{playing=false;setPhase(0);};
function deposit(){const angle=Number($('crossing-angle').value),a=angle*Math.PI/180;tileView?.setAngle(angle);const event=traceMuon({origin:[0,TILE_HEIGHTS[0]+.500001,0],direction:[Math.sin(a),-Math.cos(a),0],energyGeV:4},()=>.5,{scatter:false,decay:false});const hit=event.crossings.find(h=>h.index===0);$('crossing-value').textContent=`${angle}°`;$('path-length').textContent=hit?`${hit.pathCm.toFixed(3)} cm`:'No crossing';$('energy-deposit').textContent=hit?`${hit.depositedMeV.toFixed(3)} MeV`:'—';}
$('crossing-angle').oninput=deposit;
fetch('./assets/fibre-path.json').then(r=>{if(!r.ok)throw Error('Groove unavailable');return r.json();}).then(data=>{groove=data.points_mm;draw();}).catch(error=>{$('stage-status').textContent=error.message;});
new ResizeObserver(resize).observe(canvas);
function frame(now){if(playing){phase+=Math.min((now-last)/1000,.1)/5;if(phase>=4.999){phase=4.999;playing=false;}setPhase(phase);}last=now;requestAnimationFrame(frame);}
requestAnimationFrame(frame);setPhase(0);deposit();

for(const b of document.querySelectorAll('[data-prediction]'))b.onclick=()=>{
 $('crossing-angle').value=60;deposit();
 $('prediction-feedback').hidden=false;
 $('prediction-feedback').textContent=`At 60°, the calculated path is ${$('path-length').textContent}, compared with 1.000 cm upright. The oblique path is longer. Explore the slider and compare the calculated path lengths. The detector counts events; it does not measure muon energy.`;
 b.setAttribute('aria-pressed','true');
 document.querySelectorAll('[data-prediction]').forEach(other=>{if(other!==b)other.setAttribute('aria-pressed','false');});
};

import test from 'node:test';
import assert from 'node:assert/strict';
import {rotation,orientPoint,RateExperiment,observation,poisson,PIVOT} from '../public/investigation-model.js';
import {randomGenerator} from '../public/simulation.js';
import {MuonSource} from '../public/muon-source.js';

test('tilt rotates the detector normal towards N/E and inverse preserves lengths and positions',()=>{
 const north=rotation(90,0),east=rotation(90,90);
 const close=(a,b)=>a.every((v,i)=>Math.abs(v-b[i])<1e-10);
 assert.ok(close(north([0,1,0]),[0,0,-1]));
 assert.ok(close(east([0,1,0]),[1,0,0]));
 for(const tilt of [0,30,60,90])for(const az of [0,90,203]){
  const turn=rotation(tilt,az),p=[7,-16,8];
  assert.ok(close(orientPoint(orientPoint(p,turn),turn,true),p));
  assert.ok(close(orientPoint(PIVOT,turn),PIVOT));
 }
 assert.throws(()=>rotation(100,0));
});
test('rotated transport agrees with the existing sea-level baseline and lowers rates at high tilt',()=>{
 const a=new RateExperiment().advance(200000),b=new RateExperiment({tilt:60}).advance(200000);
 assert.ok(Math.abs(a.rates.c02-82.33)<4*a.numericalSE.c02);
 assert.ok(Math.abs(a.rates.c01-167.08)<4*a.numericalSE.c01);
 assert.ok(b.rates.c02<a.rates.c02*.5);
 assert.ok(a.numericalSE.c02>0);
 assert.equal(a.maskRates.length,8);
});
test('incoming-boundary size does not normalize the ideal tilted detector rate',()=>{
 const a=new RateExperiment({tilt:30,source:new MuonSource({room:{width:64,top:32,bottom:-32}})}).advance(150000);
 const b=new RateExperiment({tilt:30,source:new MuonSource({room:{width:80,top:40,bottom:-40}})}).advance(150000);
 const se=Math.hypot(a.numericalSE.c02,b.numericalSE.c02);
 assert.ok(Math.abs(a.rates.c02-b.rates.c02)<4*se);
});
test('long exposure counts preserve triples as a subset of every pair and replay from seed',()=>{
 const result={maskRates:[0,5,5,40,5,20,40,60]};
 const a=observation(result,30,42),b=observation(result,30,42);
 assert.deepEqual(a,b);assert.equal(a.minutes,43200);
 for(const pair of ['c01','c12','c02'])assert.ok(a.counts[pair]>=a.counts.triple);
 assert.throws(()=>observation(result,0,42));
});
test('aggregate Poisson sampler has expected mean and variance at short and long exposures',()=>{
 for(const mean of [0,3,29,100,1000000]){
  const random=randomGenerator(733),n=12000;let sum=0,sum2=0;
  for(let i=0;i<n;i++){const v=poisson(mean,random);assert.ok(Number.isInteger(v)&&v>=0);sum+=v;sum2+=(v-mean)**2;}
  assert.ok(Math.abs(sum/n-mean)<6*Math.sqrt(mean/n)+.001);
  if(mean)assert.ok(Math.abs(sum2/n/mean-1)<.08);
 }
});

test('yaw changes compass bearing without inventing an east-west sky asymmetry',()=>{
 const a=new RateExperiment({tilt:60,azimuth:0}).advance(150000);
 const b=new RateExperiment({tilt:60,azimuth:90}).advance(150000);
 assert.ok(Math.abs(a.rates.c02-b.rates.c02)<4*Math.hypot(a.numericalSE.c02,b.numericalSE.c02));
});

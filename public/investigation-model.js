import { MuonSource } from './muon-source.js';
import { traceMuon } from './muon-transport.js';
import { randomGenerator } from './simulation.js';

// Fixed world boundary enclosing the reference stack at every orientation.
export const EXPERIMENT_ROOM = { width: 64, top: 32, bottom: -32 };
export const PIVOT = [0, -0.95, 0];
export const PAIRS = ['c01', 'c12', 'c02', 'triple'];
export function rotation(tilt, azimuth) {
  if (!Number.isFinite(tilt) || tilt < 0 || tilt > 90 || !Number.isFinite(azimuth)) throw new RangeError('Invalid detector orientation');
  const t = tilt * Math.PI / 180, a = azimuth * Math.PI / 180;
  // Local upward normal tilts towards geographic azimuth: N=-z, E=+x.
  const ct=Math.cos(t),st=Math.sin(t),ca=Math.cos(a),sa=Math.sin(a);
  // Tilt about local -x, then turn the whole cradle about world -y.
  // The normal points north at azimuth 0 and east at 90 degrees.
  return (p, inverse = false) => {
    if(inverse){
      const x=ca*p[0]+sa*p[2],z=-sa*p[0]+ca*p[2];
      return [x,ct*p[1]-st*z,st*p[1]+ct*z];
    }
    const y=ct*p[1]+st*p[2],z=-st*p[1]+ct*p[2];
    return [ca*p[0]-sa*z,y,sa*p[0]+ca*z];
  };
}
export function orientPoint(p, turn, inverse = false) {
  return turn(p.map((v,i) => v - PIVOT[i]), inverse).map((v,i) => v + PIVOT[i]);
}
export class RateExperiment {
  constructor({ tilt = 0, azimuth = 0, seed = 20261110, source } = {}) {
    this.turn = rotation(tilt, azimuth);
    this.source = source || new MuonSource({ room: EXPERIMENT_ROOM });
    this.random = randomGenerator(seed);
    this.samples = 0;
    this.masks = Array(8).fill(0);
    this.examples = [];
  }
  advance(count) {
    for (let i=0;i<count;i++) {
      const particle = this.source.sample(this.random);
      const local = { ...particle, origin: orientPoint(particle.origin, this.turn, true), direction: this.turn(particle.direction, true) };
      const track = traceMuon(local, this.random, { room: {width:200, top:100, bottom:-100} });
      const mask = track.hits.reduce((m, hit, index) => m | (Number(hit) << index), 0);
      this.masks[mask]++;
      if (mask && this.examples.length < 60) this.examples.push({
        hits: track.hits,
        path: track.path.map(p => ({...p, position: orientPoint(p.position, this.turn)})),
        durationNs: track.durationNs,
      });
    }
    this.samples += count;
    return this.result();
  }
  result() {
    const perMinute = this.source.ratePerSecond * 60;
    const rates = {}, numericalSE = {};
    for (const [name, bits] of [['c01',3],['c12',6],['c02',5],['triple',7]]) {
      const hits = this.masks.reduce((sum,n,mask) => sum + ((mask & bits) === bits ? n : 0),0);
      const p = hits / Math.max(1,this.samples);
      rates[name] = perMinute * p;
      numericalSE[name] = perMinute * Math.sqrt(p * (1-p) / Math.max(1,this.samples));
    }
    return { samples:this.samples, rates, numericalSE, maskRates:this.masks.map(n=>perMinute*n/Math.max(1,this.samples)), examples:this.examples };
  }
}
const logFactorial = n => {
  if (n < 2) return 0;
  if (n < 128) { let v=0;for(let i=2;i<=n;i++)v+=Math.log(i);return v; }
  const x=n+1;
  return (x-.5)*Math.log(x)-x+.5*Math.log(2*Math.PI)+1/(12*x)-1/(360*x**3)+1/(1260*x**5);
};
export function poisson(mean, random = Math.random) {
  if (!(mean >= 0) || !Number.isFinite(mean)) throw new RangeError('Invalid Poisson mean');
  if (mean < 30) {
    const limit=Math.exp(-mean);let product=1,k=0;
    do {k++;product*=random();} while(product>limit);
    return k-1;
  }
  // Hörmann transformed rejection: aggregate long exposures without generating
  // every arrival. Categories are disjoint, so pair/triple correlations survive.
  const b=.931+2.53*Math.sqrt(mean),a=-.059+.02483*b;
  const invAlpha=1.1239+1.1328/(b-3.4),vr=.9277-3.6224/(b-2);
  for (;;) {
    const u=random()-.5,v=random(),us=.5-Math.abs(u);
    if (!us) continue;
    const k=Math.floor((2*a/us+b)*u+mean+.43);
    if(k<0)continue;
    if(us>=.07&&v<=vr)return k;
    if(us<.013&&v>us)continue;
    if(Math.log(v*invAlpha/(a/(us*us)+b))<=-mean+k*Math.log(mean)-logFactorial(k))return k;
  }
}
export function observation(result, days, seed) {
  if (!(days>0 && days<=366)) throw new RangeError('Choose 1–366 days');
  const random=randomGenerator(seed),minutes=days*1440;
  const masks=result.maskRates.map((rate,i)=>i ? poisson(rate*minutes,random) : 0);
  const counts={};
  for(const [key,bits] of [['c01',3],['c12',6],['c02',5],['triple',7]])counts[key]=masks.reduce((s,n,m)=>s+((m&bits)===bits?n:0),0);
  return { counts, minutes, seed };
}

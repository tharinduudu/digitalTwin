import { TILE_HEIGHTS, TILE_THICKNESS } from './detector-geometry.js';
import { STOPPING_TABLE } from './polystyrene-data.js';
import { ROOM } from './muon-source.js';

export const MUON = { massMeV: 105.6583755, lifetimeNs: 2196.9811, cCmPerNs: 29.9792458 };
export const POLYSTYRENE = { density: 1.06, radiationLengthCm: 41.31 };
export const DISPLAY_NS_PER_SECOND = 2;
const EPSILON = 1e-7;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const point = (p, d, t) => p.map((value, i) => value + d[i] * t);
const length = p => Math.hypot(...p);
const unit = p => { const size = length(p); return p.map(value => value / size); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function beta(kineticMeV) {
  const gamma = 1 + kineticMeV / MUON.massMeV;
  return Math.sqrt(Math.max(0, 1 - 1 / (gamma * gamma)));
}

// Intersect a forward ray with convex half spaces n.p <= bound.
function clip(origin, direction, planes) {
  let enter = 0, exit = Infinity;
  for (const [normal, bound] of planes) {
    const distance = bound - dot(normal, origin), speed = dot(normal, direction);
    if (Math.abs(speed) < 1e-12) { if (distance < -EPSILON) return null; continue; }
    if (speed < 0) enter = Math.max(enter, distance / speed);
    else exit = Math.min(exit, distance / speed);
    if (exit <= enter + EPSILON) return null;
  }
  return { enter, exit };
}

export function tileIntersection(origin, direction, index) {
  const y = TILE_HEIGHTS[index], half = TILE_THICKNESS / 2;
  return clip(origin, direction, [[[1, 0, 0], 10], [[-1, 0, 0], 10],
    [[0, 0, 1], 10], [[0, 0, -1], 10], [[-1, 0, 1], 16.1958],
    [[0, 1, 0], y + half], [[0, -1, 0], -y + half]]);
}

function roomIntersection(origin, direction, room) {
  return clip(origin, direction, [[[1, 0, 0], room.width / 2], [[-1, 0, 0], room.width / 2],
    [[0, 0, 1], room.width / 2], [[0, 0, -1], room.width / 2],
    [[0, 1, 0], room.top], [[0, -1, 0], -room.bottom]]);
}

function interpolate(value, inputColumn, outputColumn) {
  const first = STOPPING_TABLE[0];
  // PDG warns that results below 10 MeV are unreliable. This short terminal
  // range is only a continuous endpoint, not a precise stopping calculation.
  if (value < first[inputColumn]) return first[outputColumn] * value / first[inputColumn];
  let low = 0, high = STOPPING_TABLE.length - 1;
  while (high - low > 1) {
    const middle = (high + low) >>> 1;
    if (STOPPING_TABLE[middle][inputColumn] <= value) low = middle;
    else high = middle;
  }
  const a = STOPPING_TABLE[low], b = STOPPING_TABLE[high];
  const fraction = Math.log(value / a[inputColumn]) / Math.log(b[inputColumn] / a[inputColumn]);
  return a[outputColumn] * (b[outputColumn] / a[outputColumn]) ** fraction;
}
export const csdaRange = kineticMeV => interpolate(kineticMeV, 0, 2);
export const energyAtRange = range => range > 0 ? interpolate(range, 2, 0) : 0;

export function scatteringRms(kineticMeV, radiationLengths) {
  if (!(radiationLengths > 0)) return 0;
  const speed = beta(kineticMeV);
  const momentum = Math.sqrt(kineticMeV * (kineticMeV + 2 * MUON.massMeV));
  return 13.6 / (speed * momentum) * Math.sqrt(radiationLengths)
    * Math.max(0, 1 + 0.038 * Math.log(radiationLengths / (speed * speed)));
}

function gaussianPair(random) {
  const radius = Math.sqrt(-2 * Math.log(Math.max(1e-12, random())));
  const phi = 2 * Math.PI * random();
  return [radius * Math.cos(phi), radius * Math.sin(phi)];
}

export function traceMuon(particle, random, { room = ROOM, scatter = true, decay = true } = {}) {
  let origin = [...particle.origin], direction = [...particle.direction];
  let kinetic = particle.energyGeV * 1000, timeNs = 0, properTime = 0, radiationLengths = 0;
  const lifetime = decay ? -MUON.lifetimeNs * Math.log(Math.max(1e-12, random())) : Infinity;
  const hits = [false, false, false], crossings = [];
  const path = [{ position: [...origin], timeNs: 0 }];
  let termination = 'left room';
  const travel = distance => {
    const speed = beta(kinetic), gamma = 1 + kinetic / MUON.massMeV;
    const remaining = (lifetime - properTime) * speed * gamma * MUON.cCmPerNs;
    const travelled = Math.max(0, Math.min(distance, remaining));
    timeNs += travelled / (speed * MUON.cCmPerNs);
    properTime += travelled / (speed * gamma * MUON.cCmPerNs);
    origin = point(origin, direction, travelled);
    path.push({ position: [...origin], timeNs });
    return travelled;
  };
  for (let step = 0; step < 4; step++) {
    let nearest = null;
    for (let index = 0; index < 3; index++) {
      if (hits[index]) continue;
      const interval = tileIntersection(origin, direction, index);
      if (interval && (!nearest || interval.enter < nearest.enter)) nearest = { ...interval, index };
    }
    if (!nearest) break;
    if (travel(nearest.enter) + EPSILON < nearest.enter) { termination = 'decayed'; break; }
    const { index } = nearest;
    const entry = [...origin], entryTime = timeNs, energyInMeV = kinetic;
    const range = csdaRange(kinetic), availableCm = range / POLYSTYRENE.density;
    const requested = Math.min(nearest.exit - nearest.enter, availableCm);
    const travelled = travel(requested);
    const remainingRange = Math.max(0, range - travelled * POLYSTYRENE.density);
    kinetic = energyAtRange(remainingRange);
    const depositedMeV = Math.max(0, energyInMeV - kinetic);
    hits[index] = depositedMeV > 0;
    crossings.push({ index, entry, exit: [...origin],
      point: entry.map((v, i) => (v + origin[i]) / 2),
      timeNs: entryTime, pathCm: travelled, depositedMeV, energyInMeV, energyOutMeV: kinetic });
    if (travelled + EPSILON < requested) { termination = 'decayed'; break; }
    if (remainingRange <= EPSILON) { termination = 'stopped'; break; }
    if (scatter) {
      const added = travelled / POLYSTYRENE.radiationLengthCm;
      const meanEnergy = (energyInMeV + kinetic) / 2;
      // Increment the cumulative Highland variance, rather than separately
      // applying its logarithmic correction to each thin layer.
      const variance = Math.max(0, scatteringRms(meanEnergy, radiationLengths + added) ** 2
        - scatteringRms(meanEnergy, radiationLengths) ** 2);
      radiationLengths += added;
      const [a, b] = gaussianPair(random).map(value => value * Math.sqrt(variance));
      const u = unit(cross(direction, Math.abs(direction[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
      const v = cross(direction, u);
      direction = unit(direction.map((value, i) => value + a * u[i] + b * v[i]));
    }
    origin = point(origin, direction, EPSILON * 2);
  }
  if (termination === 'left room') {
    const interval = roomIntersection(origin, direction, room);
    if (interval && travel(interval.exit) + EPSILON < interval.exit) termination = 'decayed';
  }
  return { ...particle, hits, crossings, path, durationNs: timeNs, termination };
}

export function pointAtTime(path, time) {
  if (time <= 0) return path[0].position;
  for (let i = 1; i < path.length; i++) {
    if (time <= path[i].timeNs) {
      const a = path[i - 1], b = path[i];
      const fraction = (time - a.timeNs) / Math.max(1e-12, b.timeNs - a.timeNs);
      return a.position.map((value, j) => value + fraction * (b.position[j] - value));
    }
  }
  return path.at(-1).position;
}

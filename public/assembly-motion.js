import { smoothAssembly } from './assembly-steps.js';

const clamp = value => Math.max(0, Math.min(1, value));
const mix = (a, b, t) => a.map((value, index) => value + (b[index] - value) * t);

// Lift clear of the posts, turn, align with their open ends, then slide down the grooves.
// The last part of the interval is reserved for starting the post screws.
export function railPose(unit, progress) {
  const t = clamp(progress);
  const points = [unit.bench, [unit.bench[0], 25, unit.bench[2]],
    [0, 25, 0], [unit.rest[0], 25, unit.rest[2]], unit.rest, unit.rest, unit.rest];
  const times = [0, 0.18, 0.38, 0.55, 0.82, 0.94, 1];
  let segment = 0;
  while (segment < times.length - 2 && t > times[segment + 1]) segment++;
  const fraction = smoothAssembly((t - times[segment]) / (times[segment + 1] - times[segment]));
  return {
    position: mix(points[segment], points[segment + 1], fraction),
    angle: unit.benchAngle * (1 - smoothAssembly((t - 0.38) / 0.17)),
    screwProgress: smoothAssembly((t - 0.94) / 0.06),
  };
}

export function railProgress(sequenceProgress, index, count) {
  return clamp(sequenceProgress * count - index);
}

export function nutLoadingProgress(progress, order, count) {
  return railProgress(progress / 0.6, order, count);
}

export function bracketInsertionProgress(progress) {
  return smoothAssembly((progress - 0.6) / 0.25);
}

// A single open end is used. Within each groove, the farthest nut must go first.
export function orderRailNuts(nuts, axis, across) {
  const grooves = new Map();
  for (const nut of nuts) {
    const key = `${Math.round(nut.rest.y * 10)}:${Math.round(nut.rest[across] * 10)}`;
    if (!grooves.has(key)) grooves.set(key, []);
    grooves.get(key).push(nut);
  }
  const groups = [...grooves.values()].sort((a, b) => b[0].rest.y - a[0].rest.y
    || b[0].rest[across] - a[0].rest[across]);
  const ordered = groups.flatMap(group => {
    const sheet = group.find(nut => nut.role === 'acrylic');
    const groove = sheet?.location || (group.some(nut => nut.role === 'case') ? 'Outside groove' : 'Bracket groove');
    return [...group].sort((a, b) => b.rest[axis] - a.rest[axis])
      .map((nut, order) => ({ ...nut, order, count: group.length, groove }));
  });
  return ordered.map((nut, loadOrder) => ({ ...nut, loadOrder }));
}

export function sideInsertionPose(rest, progress) {
  const t = clamp(progress);
  const above = [rest[0], rest[1] + 3.5, rest[2]];
  return t < 0.75
    ? mix([rest[0], rest[1] + 3.5, rest[2] + 27], above, smoothAssembly(t / 0.75))
    : mix(above, rest, smoothAssembly((t - 0.75) / 0.25));
}

// Seat the part before advancing its fasteners towards the captive nuts.
export function fasteningProgress(progress, index, count, start = 0.55) {
  return railProgress((progress - start) / (1 - start), index, count);
}

export function screwPose(progress, travel = 1.8) {
  const t = clamp(progress);
  return { visible: t > 0, distance: travel * (1 - smoothAssembly(t)),
    angle: -Math.PI * 6 * smoothAssembly(t), turning: t > 0 && t < 1 };
}

export function assemblyTime(steps, index, progress = 0) {
  return steps.slice(0, index).reduce((sum, step) => sum + (step.duration || 4), 0)
    + (steps[index].duration || 4) * clamp(progress);
}

export function assemblyPosition(steps, seconds) {
  let remaining = Math.max(0, seconds);
  for (let index = 0; index < steps.length; index++) {
    const duration = steps[index].duration || 4;
    if (remaining < duration || index === steps.length - 1) {
      return { index, progress: clamp(remaining / duration) };
    }
    remaining -= duration;
  }
}

export const ASSEMBLY_FINISH = { acrylic: 0.84, liner: 1, scintillator: 1 };
export const ASSEMBLY_SPEED = 1;
export const ASSEMBLY_FOLLOW_DEFAULT = false;

export function assemblyCameraStage(detail) {
  return ['joint', 'stack', 'sensor'].includes(detail) ? 'frame' : detail;
}

export function hingedCoverAngle(progress) {
  return 1.9 * (1 - smoothAssembly(progress));
}

export function layerFasteningView(height) {
  return { target: [0, height, 0], offset: [27, 22, 35] };
}

// These are the last steps with access to the open ends of the grooves.
export function nutNeedsReminder(step, unit, isPost = false) {
  if (isPost) return step === 'post-nuts' && unit.prefit === 'bottom-prefit' || step === unit.join;
  return step === unit.prefit || step === unit.join;
}

export function nutReminderPulse(seconds, reducedMotion = false) {
  const wave = reducedMotion ? 1 : (1 + Math.cos(Math.PI * seconds)) / 2;
  return { opacity: .35 + .6 * wave, scale: 2.6 + .3 * wave };
}

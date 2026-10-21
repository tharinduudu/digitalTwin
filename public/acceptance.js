import { TILE_HEIGHTS } from './detector-geometry.js';

export function acceptanceProfile(pair = 'all') {
  const heights = TILE_HEIGHTS;
  const [top, bottom] = (pair === 'all' ? '02' : pair.slice(1)).split('').map(Number);
  const lower = heights[bottom], upper = heights[top];
  return { lower, upper, top, bottom, halfWidth: 10,
    label: `Straight-line acceptance from tile ${bottom} centre to tile ${top}` };
}

export function acceptedFromCentre(dx, dz, pair = 'all') {
  const { lower, upper, halfWidth } = acceptanceProfile(pair);
  const x = dx * (upper - lower), z = dz * (upper - lower);
  return Math.abs(x) <= halfWidth && Math.abs(z) <= halfWidth && -x + z <= 16.1958;
}

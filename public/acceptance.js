export function acceptanceProfile(pair = 'all') {
  const heights = [13, 0, -13];
  const [top, bottom] = (pair === 'all' ? '02' : pair.slice(1)).split('').map(Number);
  const lower = heights[bottom], upper = heights[top];
  return { lower, upper, top, bottom, halfWidth: 10,
    label: `Acceptance from tile ${bottom} centre to tile ${top}` };
}

export function acceptedFromCentre(dx, dz, pair = 'all') {
  const { lower, upper, halfWidth } = acceptanceProfile(pair);
  return Math.abs(dx * (upper - lower)) <= halfWidth && Math.abs(dz * (upper - lower)) <= halfWidth;
}

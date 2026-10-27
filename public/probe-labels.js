// Labels live at the viewport edges; arrowheads stop short of the solder pad.
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const overlaps = (a, b, gap = 8) => a.x < b.x + b.width + gap && a.x + a.width + gap > b.x
  && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;

function coversPoint(box, point, clearance = 16) {
  return point.x > box.x - clearance && point.x < box.x + box.width + clearance
    && point.y > box.y - clearance && point.y < box.y + box.height + clearance;
}

export function layoutProbeLabels(points, width, height) {
  const labelWidth = Math.min(94, Math.max(64, width / 4)), labelHeight = 24, margin = 12;
  const placed = [];
  return points.map((point, index) => {
    if (!point || point.visible === false || width < 140 || height < 80
      || point.x < 0 || point.x > width || point.y < 0 || point.y > height) return null;
    const nearLeft = point.x < width / 2;
    const sides = nearLeft ? [margin, width - margin - labelWidth] : [width - margin - labelWidth, margin];
    const other = points[1 - index];
    const preferAbove = other && other.visible !== false && Math.abs(point.y - other.y) > 4
      ? point.y < other.y : index === 0;
    const offsets = preferAbove ? [-48, 48, -84, 84, -120, 120] : [48, -48, 84, -84, 120, -120];
    const candidates = [];
    sides.forEach((x, side) => offsets.forEach((offset, order) => {
      const box = { x, y: clamp(point.y + offset - labelHeight / 2, margin, height - margin - labelHeight), width: labelWidth, height: labelHeight };
      const collisions = points.filter(other => other && other.visible !== false && coversPoint(box, other)).length;
      const labelCollisions = placed.filter(other => overlaps(box, other)).length;
      candidates.push({ box, score: collisions * 10000 + labelCollisions * 10000 + side * 100 + order });
    }));
    candidates.sort((a, b) => a.score - b.score);
    const box = candidates[0].box;
    placed.push(box);
    const right = point.x >= box.x + box.width / 2;
    const start = { x: right ? box.x + box.width : box.x,
      y: clamp(point.y, box.y + 6, box.y + box.height - 6) };
    const elbow = { x: start.x + (right ? 12 : -12), y: start.y };
    const distance = Math.hypot(point.x - elbow.x, point.y - elbow.y) || 1;
    const end = { x: point.x - (point.x - elbow.x) / distance * 7,
      y: point.y - (point.y - elbow.y) / distance * 7 };
    return { box, target: { x: point.x, y: point.y }, start, elbow, end,
      path: `M ${start.x} ${start.y} L ${elbow.x} ${elbow.y} L ${end.x} ${end.y}` };
  });
}

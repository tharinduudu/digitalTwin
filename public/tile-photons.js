// Reference optical properties from the EJ-200 datasheet.
// Positions are in centimetres and optical times in nanoseconds.
export const OPTICAL_WINDOW_NS = 12;
const refractiveIndex = 1.58;
const speed = 29.9792458 / refractiveIndex;
const decayNs = 2.1;
const riseNs = .9;
const diagonal = Math.SQRT1_2;
const faces = [
  [[1, 0, 0], 10], [[-1, 0, 0], 10],
  [[0, 0, 1], 10], [[0, 0, -1], 10],
  [[-diagonal, 0, diagonal], 16.1958 * diagonal],
  [[0, 1, 0], .5], [[0, -1, 0], .5],
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const offset = (point, direction, distance) => point.map((value, axis) => value + direction[axis] * distance);

export function sampleTilePhotons(crossing, count, random) {
  return Array.from({ length: count }, () => {
    const fraction = random();
    const position = crossing.entry.map((value, axis) => value + fraction * (crossing.exit[axis] - value));
    const y = 2 * random() - 1;
    const azimuth = 2 * Math.PI * random();
    const radial = Math.sqrt(1 - y * y);
    let direction = [radial * Math.cos(azimuth), y, radial * Math.sin(azimuth)];
    // A rise-and-decay approximation using two independent exponential delays.
    const birth = -riseNs * Math.log1p(-random()) - decayNs * Math.log1p(-random());
    const path = [{ position, timeNs: birth }];
    while (path.at(-1).timeNs < OPTICAL_WINDOW_NS) {
      const current = path.at(-1);
      let distance = (OPTICAL_WINDOW_NS - current.timeNs) * speed;
      let normal;
      for (const [face, plane] of faces) {
        const incidence = dot(face, direction);
        if (incidence <= 1e-10) continue;
        const hit = (plane - dot(face, current.position)) / incidence;
        if (hit < distance) {
          distance = Math.max(0, hit);
          normal = face;
        }
      }
      const hit = offset(current.position, direction, distance);
      path.push({ position: hit, timeNs: current.timeNs + distance / speed });
      if (!normal) break;

      // Unpolarized Fresnel reflection at a smooth plastic–air interface.
      const cosine = Math.min(1, dot(normal, direction));
      const transmittedSineSquared = refractiveIndex ** 2 * (1 - cosine ** 2);
      if (transmittedSineSquared < 1) {
        const transmitted = Math.sqrt(1 - transmittedSineSquared);
        const s = (refractiveIndex * cosine - transmitted) / (refractiveIndex * cosine + transmitted);
        const p = (cosine - refractiveIndex * transmitted) / (cosine + refractiveIndex * transmitted);
        if (random() >= (s * s + p * p) / 2) break;
      }
      direction = offset(direction, normal, -2 * cosine);
    }
    return path;
  });
}

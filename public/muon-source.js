// Guan et al., arXiv:1509.06176, Eqs. (2)-(3). Energy is kinetic GeV here,
// following applications of this parametrization in muon transport studies.
export const SOURCE = Object.freeze({ name: 'Guan et al. sea-level muons',
  reference: 'https://arxiv.org/abs/1509.06176', minGeV: 0.1, maxGeV: 10000,
  energyBins: 160, cosineBins: 96, altitudeM: 0 });
export const ROOM = Object.freeze({ width: 120, top: 28, bottom: -34,
  displayedMissesPerSecond: 40 });

export function effectiveCosine(cosine) {
  const c = Math.max(0, Math.min(1, cosine));
  const [p1, p2, p3, p4, p5] = [0.102573, -0.068287, 0.958633, 0.0407253, 0.817285];
  return Math.sqrt((c * c + p1 * p1 + p2 * c ** p3 + p4 * c ** p5)
    / (1 + p1 * p1 + p2 + p4));
}

// Per cm2 perpendicular to the track, second, steradian and GeV.
export function differentialFlux(energyGeV, cosine) {
  if (!(energyGeV > 0) || cosine < 0 || cosine > 1) return 0;
  const c = effectiveCosine(cosine);
  return 0.14 * (energyGeV + 3.64 / c ** 1.29) ** -2.7
    * (1 / (1 + 1.1 * energyGeV * c / 115)
      + 0.054 / (1 + 1.1 * energyGeV * c / 850));
}

function findBin(cumulative, value) {
  let low = 0, high = cumulative.length - 1;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (value < cumulative[middle]) high = middle;
    else low = middle + 1;
  }
  return low;
}

export class MuonSource {
  constructor({ room = ROOM, energyBins = SOURCE.energyBins, cosineBins = SOURCE.cosineBins,
    minGeV = SOURCE.minGeV, maxGeV = SOURCE.maxGeV, flux = differentialFlux } = {}) {
    if (!(minGeV > 0 && maxGeV > minGeV && room.width > 0 && room.top > room.bottom)
      || !Number.isInteger(energyBins) || energyBins < 4 || !Number.isInteger(cosineBins) || cosineBins < 4) {
      throw new RangeError('Invalid muon source energy, grid or boundary dimensions');
    }
    this.room = room;
    this.energyBins = energyBins;
    this.cosineBins = cosineBins;
    this.logMin = Math.log(minGeV);
    this.dLog = Math.log(maxGeV / minGeV) / energyBins;
    this.dCos = 1 / cosineBins;
    this.cells = [];
    this.cumulative = [];
    const w = room.width, h = room.top - room.bottom;
    this.topArea = w * w;
    this.sideArea = w * h;
    this.horizontalFlux = 0;
    let integral = 0;
    const value = (i, j, horizontal = false) => {
      const energy = Math.exp(this.logMin + i * this.dLog), c = j * this.dCos;
      const projection = horizontal ? c
        : this.topArea * c + 4 / Math.PI * this.sideArea * Math.sqrt(1 - c * c);
      return flux(energy, c) * energy * projection;
    };
    for (let i = 0; i < energyBins; i++) for (let j = 0; j < cosineBins; j++) {
      const corners = [value(i, j), value(i + 1, j), value(i, j + 1), value(i + 1, j + 1)];
      if (corners.some(number => number < 0 || !Number.isFinite(number))) throw new RangeError('Muon intensity must be finite and nonnegative');
      const sum = corners.reduce((a, b) => a + b, 0);
      integral += sum / 4 * this.dLog * this.dCos * 2 * Math.PI;
      this.cells.push({ i, j, corners, sum });
      this.cumulative.push(integral);
      this.horizontalFlux += (value(i, j, true) + value(i + 1, j, true)
        + value(i, j + 1, true) + value(i + 1, j + 1, true)) / 4
        * this.dLog * this.dCos * 2 * Math.PI;
    }
    if (!(integral > 0 && Number.isFinite(integral))) throw new RangeError('Muon flux must have a finite positive integral');
    this.ratePerSecond = integral;
  }

  sample(random) {
    const cell = this.cells[findBin(this.cumulative, random() * this.ratePerSecond)];
    // A bilinear cell is a mixture of four separable linear basis functions.
    // Sampling that mixture avoids visible energy/angle binning in the tracks.
    let choice = random() * cell.sum, corner = 0;
    while (corner < 3 && choice >= cell.corners[corner]) choice -= cell.corners[corner++];
    const coordinate = upper => upper ? Math.sqrt(random()) : 1 - Math.sqrt(random());
    const energyGeV = Math.exp(this.logMin + (cell.i + coordinate(corner & 1)) * this.dLog);
    const cosine = (cell.j + coordinate(corner & 2)) * this.dCos;
    const sine = Math.sqrt(Math.max(0, 1 - cosine * cosine));
    let phi, direction, projection;
    // Directions at a box boundary are weighted by its projected area.
    const maximum = this.topArea * cosine + Math.SQRT2 * this.sideArea * sine;
    do {
      phi = 2 * Math.PI * random();
      direction = [sine * Math.cos(phi), -cosine, sine * Math.sin(phi)];
      projection = [this.topArea * cosine, this.sideArea * Math.abs(direction[0]),
        this.sideArea * Math.abs(direction[2])];
    } while (random() * maximum > projection.reduce((a, b) => a + b, 0));
    const total = projection.reduce((a, b) => a + b, 0);
    const faceChoice = random() * total;
    const { width, top, bottom } = this.room;
    const x = width * (random() - 0.5), z = width * (random() - 0.5);
    const y = bottom + random() * (top - bottom);
    let origin, face;
    if (faceChoice < projection[0]) { origin = [x, top, z]; face = 'top'; }
    else if (faceChoice < projection[0] + projection[1]) {
      origin = [direction[0] > 0 ? -width / 2 : width / 2, y, z]; face = 'x';
    } else {
      origin = [x, y, direction[2] > 0 ? -width / 2 : width / 2]; face = 'z';
    }
    return { origin, direction, energyGeV, cosine, phi, face };
  }
}

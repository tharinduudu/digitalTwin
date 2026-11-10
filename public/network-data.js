// Keep portal records separate: matching coordinates do not prove two IDs are one detector.
export const PORTAL_URL = 'https://cosmic.gsu.edu/~cosmic/dataportal/';
export const STATUS = {
  recent: { label: 'Recent data', color: '#347356' },
  review: { label: 'Check stability', color: '#98651e' },
  older: { label: 'Older data', color: '#79649b' },
  missing: { label: 'No ingested data', color: '#839297' },
};

export function statusKey(station) {
  if (station.running !== 'Running') return station.latest ? 'older' : 'missing';
  return station.stability === 'Check stability' ? 'review' : 'recent';
}

export function decodeSnapshot(snapshot) {
  if (snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.rows) || !Array.isArray(snapshot.columns)) {
    throw new Error('Unsupported station snapshot');
  }
  const seen = new Set();
  return snapshot.rows.map(row => {
    if (row.length !== snapshot.columns.length) throw new Error('Incomplete station record');
    const station = Object.fromEntries(snapshot.columns.map((name, i) => [name, row[i]]));
    if (!station.id || seen.has(station.id)) throw new Error('Duplicate or missing detector ID');
    seen.add(station.id);
    if (!Number.isFinite(station.latitude) || Math.abs(station.latitude) > 90 ||
        !Number.isFinite(station.longitude) || Math.abs(station.longitude) > 180 ||
        !Number.isSafeInteger(station.observations) || station.observations < 0) {
      throw new Error(`Invalid location or count for ${station.id}`);
    }
    station.country = station.sourceCountry === 'USA' ? 'United States' : station.sourceCountry;
    station.displayName = station.name.startsWith('display name =') ? 'University of Ruhuna (data record)' : station.name;
    station.status = statusKey(station);
    const portal = new URL(PORTAL_URL);
    const query = snapshot.portalQueries?.[station.id];
    if (query) portal.search = new URLSearchParams(query).toString();
    station.portalUrl = portal.href;
    station.notes = [];
    if (station.id === 'Singapore_BrasBasah_1') {
      station.notes.push('The summary lists Santa Marta as the city. The portal map places this record in Bras Basah, Singapore.');
    }
    if (/Colombo|Ruhuna|FDHS|Atlanta_6/.test(station.id)) {
      station.notes.push('The portal contains other similarly named records. They remain separate until their identities are confirmed.');
    }
    if (station.id === 'Sri_Lanka_Colombo_Detector1_West' || station.id === 'University of Colombo Detector 2 East') {
      station.notes.push('The source data link uses an East/West label opposite to this summary name. The original link is preserved.');
    }
    if (station.id === 'usa_MountWilson_1') {
      station.notes.push('The portal lists Stable and 666,531 observations, but has no observation dates and says Awaiting ingestion.');
    }
    return station;
  });
}

export function networkTotals(stations) {
  return {
    records: stations.length,
    countries: new Set(stations.map(s => s.country)).size,
    recent: stations.filter(s => s.running === 'Running').length,
    available: stations.filter(s => s.availability === 'Available').length,
  };
}

export function filterStations(stations, { query = '', country = '', status = '' } = {}) {
  const term = query.trim().toLocaleLowerCase();
  return stations.filter(s => (!country || s.country === country) && (!status || s.status === status) &&
    `${s.name} ${s.id} ${s.city} ${s.country} ${s.institution}`.toLocaleLowerCase().includes(term));
}

// Nearby markers share a location pin; the panel still shows every source record.
export function groupLocations(stations) {
  const groups = new Map();
  for (const station of stations) {
    const key = `${station.latitude.toFixed(1)},${station.longitude.toFixed(1)}`;
    if (!groups.has(key)) groups.set(key, { key, latitude: station.latitude, longitude: station.longitude, stations: [] });
    groups.get(key).stations.push(station);
  }
  return [...groups.values()];
}

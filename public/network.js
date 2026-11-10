import { decodeSnapshot, filterStations, groupLocations, networkTotals, STATUS } from './network-data.js';
import { NetworkGlobe } from './network-globe.js';

const $ = id => document.getElementById(id);
const integer = new Intl.NumberFormat('en-US');
let stations = [];
let globe;
let selectedId;
let locations;

function selectStation(id, focus = true) {
  const station = stations.find(s => s.id === id);
  if (!station) return;
  selectedId = id;
  const location = locations.find(g => g.stations.some(s => s.id === id));
  const status = STATUS[station.status];
  $('station-name').textContent = station.displayName;
  $('station-place').textContent = `${station.id === 'Singapore_BrasBasah_1' ? 'Bras Basah' : station.city} / ${station.country}`;
  $('selected-location').textContent = `${station.country} / ${station.displayName}`;
  $('station-status').textContent = status.label;
  $('station-status').style.color = status.color;
  $('station-latest').textContent = station.latest || 'Not available';
  const facts = [
    ['Detector ID', station.id],
    ['Institution', station.institution || 'Not listed'],
    ['Observations', integer.format(station.observations)],
    ['First record', station.first || 'Not available'],
    ['Portal status', station.running],
    ['Stability', station.stability],
    ['Data', station.availability],
    ['Location', `${station.latitude.toFixed(4)}, ${station.longitude.toFixed(4)}`],
  ];
  $('station-facts').replaceChildren(...facts.map(([key, value]) => {
    const row = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = key;
    dd.textContent = value;
    row.append(dt, dd);
    return row;
  }));
  $('nearby-records').hidden = location.stations.length < 2;
  $('nearby-list').replaceChildren(...location.stations.map(s => {
    const button = document.createElement('button');
    button.textContent = s.displayName;
    button.setAttribute('aria-pressed', String(s.id === id));
    button.addEventListener('click', () => selectStation(s.id));
    return button;
  }));
  $('metadata-note').textContent = station.notes.join(' ');
  $('metadata-note').hidden = !station.notes.length;
  $('station-portal').href = station.portalUrl;
  $('station-portal').title = `Find ${station.name} in the portal's Network summary`;
  for (const button of $('station-list').querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.id === id));
  }
  const url = new URL(window.location.href);
  url.searchParams.set('station', id);
  history.replaceState(null, '', url);
  globe?.select(id, focus);
  if (!globe?.controls.autoRotate) $('rotate-globe').setAttribute('aria-pressed', 'false');
}

function updateList() {
  const visible = filterStations(stations, {
    query: $('station-search').value,
    country: $('country-filter').value,
    status: $('status-filter').value,
  });
  $('result-count').textContent = `${visible.length} / ${stations.length}`;
  $('no-results').hidden = visible.length > 0;
  $('station-list').replaceChildren(...visible.map(station => {
    const button = document.createElement('button');
    button.className = 'station-row';
    button.dataset.id = station.id;
    button.setAttribute('aria-pressed', String(station.id === selectedId));
    button.title = `${station.displayName}: ${STATUS[station.status].label}`;
    const dot = document.createElement('span');
    dot.className = `dot ${station.status}`;
    const label = document.createElement('span');
    const name = document.createElement('strong');
    const place = document.createElement('small');
    name.textContent = station.displayName;
    place.textContent = `${station.id === 'Singapore_BrasBasah_1' ? 'Bras Basah' : station.city} / ${station.country}`;
    label.append(name, place);
    button.append(dot, label);
    button.addEventListener('click', () => selectStation(station.id));
    return button;
  }));
  globe?.setVisible(new Set(visible.map(s => s.id)));
}

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return response.json();
}

async function start() {
  const snapshot = await loadJson('./assets/network-snapshot.json');
  stations = decodeSnapshot(snapshot);
  locations = groupLocations(stations);
  const totals = networkTotals(stations);
  for (const key of ['records', 'countries', 'recent', 'available']) $('total-' + key).textContent = totals[key];
  const captured = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(snapshot.capturedAt));
  $('snapshot-label').textContent = `Portal snapshot / ${captured} UTC`;
  $('source-description').textContent = `Saved from the public ${snapshot.sourceView} on ${captured} UTC. These are portal records, not a confirmed count of unique physical detectors. Open the current portal to check for changes.`;
  $('running-definition').textContent = snapshot.runningDefinition;
  $('timestamp-note').textContent = snapshot.timestampNote;
  $('feed-note').textContent = 'Portal snapshot / not live telemetry';
  for (const country of [...new Set(stations.map(s => s.country))].sort()) {
    const option = document.createElement('option');
    option.value = country;
    option.textContent = country;
    $('country-filter').append(option);
  }
  updateList();
  selectStation(new URLSearchParams(window.location.search).get('station') || 'GSU_Atlanta_Baseline', false);
  if (!selectedId) selectStation(stations[0].id, false);
  try {
    const land = await loadJson('./assets/network-land.geojson');
    globe = new NetworkGlobe($('network-globe'), $('location-labels'), stations, land, id => selectStation(id));
    globe.select(selectedId, false);
  } catch (error) {
    console.error(error);
    $('globe-error').hidden = false;
    for (const button of document.querySelectorAll('.globe-tools button:not(#full-screen)')) button.disabled = true;
  }
}

for (const id of ['station-search', 'country-filter', 'status-filter']) $(id).addEventListener('input', updateList);
$('clear-filters').addEventListener('click', () => {
  $('station-search').value = '';
  $('country-filter').value = '';
  $('status-filter').value = '';
  updateList();
});
$('home-globe').addEventListener('click', () => globe?.home());
$('zoom-in').addEventListener('click', () => globe?.zoom(0.8));
$('zoom-out').addEventListener('click', () => globe?.zoom(1.25));
$('rotate-globe').addEventListener('click', () => {
  if (!globe) return;
  globe.destination = null;
  globe.controls.autoRotate = !globe.controls.autoRotate;
  $('rotate-globe').setAttribute('aria-pressed', String(globe.controls.autoRotate));
});
$('full-screen').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch { $('full-screen').title = 'Full screen is unavailable in this browser'; }
});
$('about').addEventListener('click', () => $('source-dialog').showModal());
document.querySelector('.close-dialog').addEventListener('click', () => $('source-dialog').close());
window.addEventListener('DOMContentLoaded', () => window.lucide?.createIcons());
start().catch(error => {
  console.error(error);
  $('station-name').textContent = 'Station data unavailable';
  $('feed-note').textContent = 'Could not load the saved portal snapshot. Open the portal for current records.';
  $('globe-error').hidden = false;
});

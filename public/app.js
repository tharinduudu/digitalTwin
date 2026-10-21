import { TelescopeScene } from './scene.js';
import { historyChart, sparkline } from './charts.js';
import { acceptanceProfile } from './acceptance.js';

const $ = id => document.getElementById(id);
let scene;
let latest;
let lastSequence = 0;
let connected = false;
let lastMessage = 0;
let lastBin;
let pause = false;
let presentation = false;
const formatTime = ms => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
const icons = () => window.lucide?.createIcons();

try { scene = new TelescopeScene($('scene')); }
catch (error) { $('render-error').hidden = false; console.error(error); }
icons();

function drawCharts() {
  if (!latest?.history?.length) return;
  sparkline($('spark-c01'), latest.history.map(d => d.c01), '#80ecc0');
  sparkline($('spark-c12'), latest.history.map(d => d.c12), '#f5a394');
  historyChart($('history'), latest.history);
}

function addEvents(events) {
  for (const event of events) {
    if (event.id <= lastSequence) continue;
    lastSequence = event.id;
    scene?.addTrack(event);
  }
}

function update(state) {
  // IDs restart if the local simulation server is restarted.
  if (latest && state.sequence < latest.sequence) { lastSequence = 0; scene?.clearTracks(); }
  latest = state;
  lastMessage = performance.now();
  connected = true;
  const live = state.source === 'detector';
  const fresh = state.status === 'live';
  $('connection-note').textContent = live
    ? `${fresh ? 'Measured minute totals' : 'Detector data ' + state.status} · tracks and LED timing illustrated`
    : pause ? 'Animation paused · simulated feed running' : 'Simulation running · no detector connected';
  $('connection-note').classList.toggle('disconnected', live && !fresh);
  $('feed-status').innerHTML = `<b></b>${live ? fresh ? 'Live counts' : 'Data ' + state.status : 'Simulation'}`;
  $('feed-status').classList.toggle('live', live && fresh);
  $('source-description').textContent = live ? `Detector · ${state.detector.name || state.detector.host}` : 'Sea-level muon model';
  $('source-detail').textContent = live ? 'SSH read-only · paths illustrated' : 'Open sky · ideal detection · no rate tuning';
  $('scene-source').textContent = live ? 'Measured counts · illustrated tracks' : 'Sea-level cosmic muons';
  if (state.last) {
    for (const pair of ['c01', 'c12', 'c02']) $(pair).textContent = state.last[pair].toLocaleString();
    $('minute-range').textContent = `${formatTime(state.last.start)} – ${formatTime(state.last.end)}`;
    if (lastBin !== state.last.start) { lastBin = state.last.start; drawCharts(); }
  } else $('minute-range').textContent = live ? 'Waiting for detector data' : 'Loading simulated counts';
  addEvents(state.events || []);
  updateClock();
}

function updateClock() {
  const time = Date.now();
  $('clock').textContent = formatTime(time);
  const seconds = latest?.source === 'detector' && latest.last
    ? Math.min(60, Math.max(0, (time - latest.last.end) / 1000)) : (time % 60000) / 1000;
  $('minute-progress').value = seconds;
  $('minute-elapsed').textContent = `${Math.floor(seconds)} / 60 s`;
  if (scene?.boxOpen) {
    const hardware = scene.hardware.state;
    $('hardware-caption').textContent = hardware.error ? `CAD unavailable: ${hardware.error}`
      : hardware.pcb && hardware.pi ? 'Readout PCB + Raspberry Pi 5 · CAD' : 'Loading readout PCB + Raspberry Pi 5 CAD';
  }
  if (scene) {
    $('scene').dataset.hardwareReady = String(scene.hardware.state.pcb && scene.hardware.state.pi);
    $('scene').dataset.mechanicsReady = String(!!scene.mechanicsReady);
    $('scene').dataset.roomTracks = String(scene.roomTracks.length);
    $('scene').dataset.drawCalls = String(scene.renderer.info.render.calls);
    $('scene').dataset.ledFlashes = scene.hardware.flashCounts.join(',');
    $('scene').dataset.portsAligned = String(!!scene.portsAligned);
    $('scene').dataset.headerErrorMm = String(scene.hardware.headerErrorMm ?? '');
    $('scene').dataset.mountingErrorMm = String(scene.hardware.mountingErrorMm ?? '');
    $('scene').dataset.acrylicFasteners = String(scene.acrylicFastenerCount || 0);
    $('scene').dataset.cornerBrackets = String(scene.cornerMounts?.brackets || 0);
    $('scene').dataset.u5GapMm = String(scene.hardware.state.u5GapMm ?? '');
    $('scene').dataset.u5OffsetMm = String(scene.hardware.state.u5OffsetMm ?? '');
    $('scene').dataset.sensorMounts = String(scene.sensorMounts?.length || 0);
    $('scene').dataset.sourceModel = latest?.model?.name || latest?.source || '';
  }
  if (lastMessage && performance.now() - lastMessage > 6000) {
    connected = false;
    $('feed-status').innerHTML = '<b></b>Feed offline';
    $('connection-note').textContent = 'Feed disconnected · last counts held';
    $('connection-note').classList.add('disconnected');
  }
}

const simulated = document.documentElement.dataset.feed === 'simulation'
  || new URLSearchParams(location.search).get('source') === 'simulation';
if (simulated) {
  // No server or detector credentials are needed for the public demonstration.
  const { Simulation } = await import('./simulation.js');
  const simulation = new Simulation();
  update(simulation.snapshot());
  let ticks = 0;
  setInterval(() => {
    addEvents(simulation.advance(Date.now()));
    if (++ticks % 7 === 0) update(simulation.snapshot());
  }, 150);
} else {
  const feed = new EventSource('./api/events');
  feed.addEventListener('snapshot', event => {
    try { update(JSON.parse(event.data)); }
    catch (error) { console.error('Invalid feed snapshot', error); }
  });
  feed.addEventListener('tracks', event => {
    try { addEvents(JSON.parse(event.data)); }
    catch (error) { console.error('Invalid track packet', error); }
  });
  feed.onerror = () => {
    connected = false;
    $('feed-status').innerHTML = '<b></b>Reconnecting';
    $('connection-note').textContent = 'Feed disconnected · last counts held';
    $('connection-note').classList.add('disconnected');
  };
}

document.querySelectorAll('[data-pair]').forEach(button => button.addEventListener('click', () => {
  const pair = button.dataset.pair;
  document.querySelectorAll('[data-pair]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  document.querySelectorAll('[data-count]').forEach(row => row.classList.toggle('dimmed', pair !== 'all' && row.dataset.count !== pair));
  scene?.setPair(pair);
  $('track-label').textContent = pair === 'all' ? 'Coincidences + room particle field' : `Tile ${pair.slice(1).split('').join('–')} highlighted`;
  $('acceptance-caption').textContent = acceptanceProfile(pair).label;
}));

$('acceptance').addEventListener('click', () => {
  const value = $('acceptance').getAttribute('aria-pressed') !== 'true';
  $('acceptance').setAttribute('aria-pressed', String(value));
  $('acceptance').setAttribute('aria-label', value ? 'Hide geometric acceptance' : 'Show geometric acceptance');
  $('acceptance-caption').hidden = !value;
  $('acceptance-caption').textContent = acceptanceProfile(scene?.selectedPair).label;
  scene?.setAcceptance(value);
});
$('open-box').addEventListener('click', () => {
  const value = $('open-box').getAttribute('aria-pressed') !== 'true';
  $('open-box').setAttribute('aria-pressed', String(value));
  $('open-box').setAttribute('aria-label', value ? 'Close readout box' : 'Open readout box');
  $('hardware-caption').hidden = !value;
  if (value) {
    $('rotate').setAttribute('aria-pressed', 'false');
    $('rotate').setAttribute('aria-label', 'Start automatic rotation');
  }
  scene?.setBoxOpen(value);
});

$('cutaway').addEventListener('click', () => {
  const value = $('cutaway').getAttribute('aria-pressed') !== 'true';
  $('cutaway').setAttribute('aria-pressed', String(value));
  $('cutaway').setAttribute('aria-label', value ? 'Show wrapped tiles' : 'Show transparent tiles');
  scene?.setCutaway(value);
});
$('rotate').addEventListener('click', () => {
  const value = $('rotate').getAttribute('aria-pressed') !== 'true';
  $('rotate').setAttribute('aria-pressed', String(value));
  $('rotate').setAttribute('aria-label', value ? 'Stop automatic rotation' : 'Start automatic rotation');
  if (scene) scene.controls.autoRotate = value;
});
$('pause').addEventListener('click', () => {
  pause = !pause;
  if (scene) scene.paused = pause;
  $('pause').setAttribute('aria-pressed', String(pause));
  $('pause').setAttribute('aria-label', pause ? 'Resume particle animation' : 'Pause particle animation');
  $('pause').innerHTML = `<i data-lucide="${pause ? 'play' : 'pause'}"></i>`;
  $('connection-note').textContent = !connected ? 'Feed disconnected · last counts held'
    : latest?.source === 'detector' ? 'Measured minute totals · tracks and LED timing illustrated'
    : pause ? 'Animation paused · simulated feed running' : 'Simulation running · no detector connected';
  icons();
});
$('reset-camera').addEventListener('click', () => scene?.resetCamera());
function setPresentation(value) {
  presentation = value;
  document.documentElement.classList.toggle('presentation-mode', value);
  $('fullscreen').innerHTML = `<i data-lucide="${value ? 'minimize' : 'maximize'}"></i>`;
  $('fullscreen').setAttribute('aria-label', value ? 'Exit presentation view' : 'Enter full screen');
  $('fullscreen').title = value ? 'Exit presentation view' : 'Full screen';
  icons();
}
$('fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (presentation) setPresentation(false);
    else await document.documentElement.requestFullscreen();
  } catch {
    // Embedded browsers can deny native fullscreen. Keep a usable in-window
    // presentation view instead, without trying to bypass browser permissions.
    setPresentation(true);
  }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && presentation) setPresentation(false);
});
document.addEventListener('fullscreenchange', () => {
  $('fullscreen').innerHTML = `<i data-lucide="${document.fullscreenElement ? 'minimize' : 'maximize'}"></i>`;
  $('fullscreen').setAttribute('aria-label', document.fullscreenElement ? 'Exit full screen' : 'Enter full screen');
  icons();
});
for (const [button, dialog] of [['photo', 'photo-dialog'], ['info', 'details']]) {
  $(button).addEventListener('click', () => $(dialog).showModal());
  $(dialog).querySelector('.close-dialog').addEventListener('click', () => $(dialog).close());
  $(dialog).addEventListener('click', event => { if (event.target === $(dialog)) $(dialog).close(); });
}

new ResizeObserver(drawCharts).observe($('history').parentElement);
setInterval(updateClock, 500);
// Deliberately small, read-only diagnostics for exhibition checks and tests.
window.exhibition = Object.freeze({
  snapshot: () => latest,
  status: () => ({ connected, paused: pause, tracks: scene?.tracks.length || 0, rendererReady: !!scene,
    roomTracks: scene?.roomTracks.length, acceptance: scene?.showAcceptance, boxOpen: scene?.boxOpen,
    hardware: scene?.hardware.state, ledPulses: scene?.hardware.pulses,
    camera: scene?.camera.position.toArray(), memory: scene?.renderer.info.memory,
    drawCalls: scene?.renderer.info.render.calls }),
});

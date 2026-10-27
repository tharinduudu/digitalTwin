import { ProbeBoard } from './probe-board.js';
import { ScopeDisplay, voltageLabel } from './probe-scope.js';
import { ProbeSchematic } from './probe-schematic.js';
import { DEFAULT_BENCH, identifyNet, createEvent, sampleSignal, triggerCrossing, measurements, traceCsv } from './probe-signals.js';

const $ = id => document.getElementById(id);
const state = { settings: { ...DEFAULT_BENCH }, probes: [null, null], active: 0, channel: 0,
  running: true, single: false, sequence: 0, frame: null, view: 'front' };
const scales = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20];
const scope = new ScopeDisplay($('scope-screen'));
let board, data, schematic;

function channelControls(index) {
  return { enabled: $(`enabled-${index}`).checked, scale: Number($(`scale-${index}`).value),
    offset: Number($(`offset-${index}`).value), coupling: $(`coupling-${index}`).value,
    attenuation: Number($(`attenuation-${index}`).value), bandwidth: $(`bandwidth-${index}`).value };
}

function controls() { return { timebase: Number($('timebase').value), channels: [channelControls(0), channelControls(1)],
  triggerSource: Number($('trigger-source').value), triggerLevel: Number($('trigger-level').value),
  slope: $('trigger-slope').value }; }

function draw() {
  scope.update(state.frame, controls());
  state.probes.forEach((pad, index) => {
    const result = measurements(state.frame?.traces[index]);
    $(`measurement-${index}`).textContent = result ? `Pk-pk ${voltageLabel(result.peakToPeak)}  |  Mean ${voltageLabel(result.mean)}` : 'No acquired trace';
  });
  const unknown = state.probes.filter((pad, index) => channelControls(index).enabled && identifyNet(pad?.net).type === 'unknown');
  $('scope-message').hidden = !unknown.length;
  $('scope-message').textContent = unknown.map(pad => `${pad?.net || 'Unassigned'}: no node model`).join(' / ');
  $('save-csv').disabled = !state.frame?.traces.some(Boolean);
}

function acquire(forceSingle = false) {
  if (!data || (!state.running && !forceSingle)) { draw(); return; }
  if (!$('input-error').hidden) { $('trigger-state').textContent = 'Invalid conditions / holding record'; draw(); return; }
  const config = controls();
  const event = createEvent(data.response, state.settings, state.sequence + 1);
  const start = Math.min(-200, -2 * config.timebase), end = Math.max(1800, 8 * config.timebase);
  const step = Math.max(0.5, (end - start) / 12000), count = Math.round((end - start) / step) + 1;
  const traces = state.probes.map((pad, index) => !pad || !config.channels[index].enabled ? null : sampleSignal(event, identifyNet(pad.net),
    { start, step, count, coupling: config.channels[index].coupling, bandwidth: config.channels[index].bandwidth }));
  const trigger = triggerCrossing(traces[config.triggerSource], config.triggerLevel, config.slope);
  if (trigger === null && ($('trigger-mode').value === 'normal' || forceSingle)) {
    $('trigger-state').textContent = state.frame ? 'Waiting / holding previous record' : 'Waiting for trigger';
    draw(); return;
  }
  state.sequence++;
  state.frame = { traces, trigger: trigger ?? 0, sequence: state.sequence,
    context: { settings: { ...state.settings }, probes: state.probes.map(pad => pad ? { id: pad.id, net: pad.net } : null),
      channels: config.channels, trigger: trigger ?? 'auto, no edge', boardSha256: data.sha256, model: 'ngspice-derived reduced-order response' } };
  if (forceSingle) { state.running = false; state.single = false; updateRun(); }
  $('trigger-state').textContent = forceSingle ? 'Single captured' : trigger === null ? 'Auto / no trigger edge' : 'Triggered';
  draw();
}

function updateRun() {
  $('run-stop').setAttribute('aria-pressed', String(state.running));
  $('run-stop').classList.toggle('active', state.running);
  $('run-stop').innerHTML = state.running ? '<i data-lucide="pause"></i><span>Stop</span>' : '<i data-lucide="play"></i><span>Run</span>';
  window.lucide?.createIcons();
}

function autoScale(index) {
  const pad = state.probes[index];
  if (!pad || !data) return;
  const event = createEvent(data.response, state.settings);
  const trace = sampleSignal(event, identifyNet(pad.net), { coupling: $(`coupling-${index}`).value, bandwidth: $(`bandwidth-${index}`).value });
  const result = measurements(trace);
  if (!result) return;
  const required = Math.max(0.001, result.peakToPeak / 5.5);
  $(`scale-${index}`).value = String(scales.find(value => value >= required) || 20);
  $(`offset-${index}`).value = Number(((result.min + result.max) / 2).toPrecision(6));
}

function setProbe(index, pad) {
  state.probes[index] = pad;
  const descriptor = identifyNet(pad.net);
  $(`node-name-${index}`).textContent = descriptor.title;
  $(`node-net-${index}`).textContent = `${pad.id}  /  ${pad.net}`;
  $('node-detail').textContent = descriptor.detail;
  $('node-warning').hidden = !descriptor.warning;
  $('node-warning').textContent = descriptor.warning || '';
  if (state.view !== 'schematic') {
    if (pad.front && !pad.back && board?.side === 'back') setView('front');
    if (pad.back && !pad.front && board?.side !== 'back') setView('back');
  }
  board?.setProbes(state.probes);
  state.frame = null; // Do not display the old net's acquisition under a new label.
  autoScale(index);
  if (!state.running) $('trigger-state').textContent = 'Stopped / new probe point';
  renderNets(); renderQuickPoints(); acquire();
}

function setView(view) {
  state.view = view;
  const isSchematic = view === 'schematic';
  $('probe-board').hidden = isSchematic;
  $('schematic-view').hidden = !isSchematic;
  $('schematic-tools').hidden = !isSchematic;
  document.querySelector('.board-stage').classList.toggle('schematic-active', isSchematic);
  if (isSchematic) {
    schematic.load().then(() => schematic.focusChannel(state.channel)).catch(error => {
      $('schematic-view').textContent = error.message;
    });
  } else board?.setView(view);
  document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
}

function renderQuickPoints() {
  const channel = state.channel, amp = channel + 6, cmp = channel + 12;
  const nodes = [[`Net-(J${channel + 3}-SIG)`, 'SiPM input'], [`Net-(U${amp}-+)`, 'Amp input'],
    [`CH${channel}`, 'Amp output'], [`Net-(U${cmp}-IN-)`, 'Threshold'], [`Ch${channel}_D`, 'Logic output']];
  $('quick-points').replaceChildren(...nodes.map(([net, label]) => {
    const button = document.createElement('button');
    button.textContent = label; button.title = net;
    button.classList.toggle('selected', state.probes[state.active]?.net === net);
    button.addEventListener('click', () => setProbe(state.active, data.pads.find(pad => pad.net === net && pad.front)));
    return button;
  }));
}

function renderNets() {
  if (!data) return;
  const search = $('node-search').value.toLowerCase().trim();
  const groups = new Map();
  data.pads.forEach(pad => {
    if (!groups.has(pad.net)) groups.set(pad.net, []);
    groups.get(pad.net).push(pad);
  });
  const rows = [...groups].filter(([net, pads]) => !search || [net, ...pads.map(pad => pad.id)].some(value => value.toLowerCase().includes(search)));
  rows.sort(([a], [b]) => {
    const rank = net => identifyNet(net).channel === state.channel ? 0 : identifyNet(net).type === 'unknown' ? 2 : 1;
    return rank(a) - rank(b) || a.localeCompare(b, undefined, { numeric: true });
  });
  $('net-list').replaceChildren(...rows.map(([net, pads]) => {
    const descriptor = identifyNet(net);
    const row = document.createElement('div'); row.className = 'net-row';
    row.dataset.net = net;
    if (state.probes.some(pad => pad?.net === net)) row.classList.add('active');
    const matchingPad = () => pads.find(pad => pad.id.toLowerCase().includes(search))
      || pads.find(pad => board?.side === 'back' ? pad.back : pad.front) || pads[0];
    const copy = document.createElement('button'); copy.className = 'net-copy';
    copy.type = 'button';
    copy.setAttribute('aria-label', `Select net ${net}`);
    copy.addEventListener('click', () => setProbe(state.active, matchingPad()));
    const title = document.createElement('strong'); title.textContent = net;
    const pins = document.createElement('span'); pins.textContent = pads.slice(0, 5).map(pad => pad.id).join('  ') + (pads.length > 5 ? `  +${pads.length - 5}` : '');
    copy.append(title, pins);
    const kind = document.createElement('span'); kind.className = `net-type ${descriptor.type}`;
    kind.textContent = descriptor.type === 'unknown' ? 'No model' : ['dc', 'low', 'threshold', 'hv'].includes(descriptor.type) ? 'DC' : descriptor.type === 'digital' || descriptor.type === 'clock' ? 'Logic' : 'Analog';
    row.append(copy, kind);
    [0, 1].forEach(index => {
      const button = document.createElement('button'); button.textContent = index ? 'B' : 'A';
      button.title = `Probe ${index ? 'B' : 'A'} at ${net}`;
      button.setAttribute('aria-label', button.title);
      button.addEventListener('click', () => {
        setProbe(index, matchingPad());
      }); row.append(button);
    });
    return row;
  }));
  if (!rows.length) { const empty = document.createElement('p'); empty.className = 'empty-nets'; empty.textContent = 'No matching nets'; $('net-list').append(empty); }
}

function readSettings() {
  const fields = ['avalanches', 'high-side', 'breakdown', 'bias-code', 'threshold-code'];
  const valid = fields.every(id => $(id).checkValidity() && $(id).value.trim() !== '');
  const biasCode = parseInt($('bias-code').value.replace(/^0x/i, ''), 16);
  const thresholdCode = parseInt($('threshold-code').value.replace(/^0x/i, ''), 16);
  if (!valid || !Number.isFinite(biasCode) || !Number.isFinite(thresholdCode) || biasCode > 1023 || thresholdCode > 1023) {
    $('input-error').hidden = false; $('input-error').textContent = 'DAC codes must be 000-3FF. Check the numeric field limits.';
    return false;
  }
  $('input-error').hidden = true;
  state.settings = { highSide: Number($('high-side').value), biasCode, thresholdCode,
    vbr: Number($('breakdown').value), avalanches: Number($('avalanches').value),
    source: $('event-source').value, noise: $('noise').checked, darkChannel: state.channel };
  $('avalanches').disabled = state.settings.source !== 'pulse';
  const event = createEvent(data.response, state.settings);
  $('bias-summary').replaceChildren(...[`Low side ${event.low.toFixed(4)} V`,
    `Effective bias ${(state.settings.highSide - event.low).toFixed(4)} V`, `Overvoltage ${event.overvoltage.toFixed(3)} V`,
    `Threshold ${event.threshold.toFixed(4)} V`].map(text => { const span = document.createElement('span'); span.textContent = text; return span; }));
  $('model-status').textContent = event.overvoltage <= 0 ? 'At/below assumed breakdown: no avalanche gain' : event.overvoltage > 5 ? 'High-overvoltage extrapolation / not validated' : 'Schematic-derived model / not a measurement';
  if (!state.running) $('trigger-state').textContent = 'Stopped / operating conditions changed';
  return true;
}

function download(content, type, name) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function start() {
  window.lucide?.createIcons();
  for (const index of [0, 1]) {
    $(`scale-${index}`).replaceChildren(...scales.map(value => new Option(voltageLabel(value), value)));
    $(`scale-${index}`).value = index ? '1' : '0.2';
  }
  const response = await fetch('./assets/probe-board.json');
  if (!response.ok) throw new Error(`PCB map request failed: ${response.status}`);
  data = await response.json();
  schematic = new ProbeSchematic($('schematic-view'), data,
    net => setProbe(state.active, data.pads.find(pad => pad.net === net)),
    ref => { $('node-search').value = `${ref}.`; renderNets(); $('node-search').focus({ preventScroll: true }); });
  $('source-hash').textContent = `PCB SHA-256: ${data.sha256}`;
  try {
    board = new ProbeBoard($('probe-board'), data, pad => setProbe(state.active, pad), pad => {
      $('hover-readout').textContent = pad ? `${pad.id}  /  ${pad.net}  /  ${identifyNet(pad.net).title}` : 'PCB pad and net';
    });
    board.load().then(() => { $('board-loading').hidden = true; board.setProbes(state.probes); }).catch(error => {
      $('board-loading').textContent = `PCB CAD unavailable: ${error.message}. Electrical nodes remain available.`;
    });
  } catch (error) { $('board-loading').textContent = `3D unavailable: ${error.message}. Electrical nodes remain available.`; }
  state.probes = [data.pads.find(pad => pad.net === 'CH0' && pad.ref === 'U6'), data.pads.find(pad => pad.net === 'Ch0_D')];
  state.probes.forEach((pad, index) => setProbe(index, pad));
  readSettings(); renderNets(); renderQuickPoints();
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  $('board-reset').addEventListener('click', () => setView(state.view === 'schematic' ? 'schematic' : 'front'));
  $('schematic-in').addEventListener('click', () => schematic.zoom(1 / 1.3));
  $('schematic-out').addEventListener('click', () => schematic.zoom(1.3));
  $('schematic-sheet').addEventListener('click', () => schematic.wholeSheet());
  [0, 1].forEach(index => $(`place-${index ? 'b' : 'a'}`).addEventListener('click', () => {
    state.active = index;
    $('place-a').setAttribute('aria-pressed', String(index === 0)); $('place-b').setAttribute('aria-pressed', String(index === 1));
    renderQuickPoints();
  }));
  $('pcb-channel').addEventListener('change', () => {
    state.channel = Number($('pcb-channel').value); board?.setFilter(state.channel, $('all-pads').checked);
    if (state.view === 'schematic') schematic.focusChannel(state.channel);
    $('event-source').querySelector('[value="dark"]').textContent = `One CH${state.channel} dark avalanche`;
    readSettings(); acquire();
    renderQuickPoints(); renderNets();
  });
  $('all-pads').addEventListener('change', () => board?.setFilter(state.channel, $('all-pads').checked));
  $('node-search').addEventListener('input', renderNets);
  $('run-stop').addEventListener('click', () => {
    state.running = !state.running; state.single = false; updateRun();
    if (!state.running) $('trigger-state').textContent = 'Stopped'; else acquire();
  });
  $('single').addEventListener('click', () => { state.running = false; state.single = true; updateRun(); acquire(true); });
  $('auto-scale').addEventListener('click', () => { autoScale(0); autoScale(1); acquire(); });
  document.querySelectorAll('.time-trigger input, .time-trigger select, .channel-controls input, .channel-controls select').forEach(input => {
    input.addEventListener('change', () => {
      if (!input.checkValidity() || input.value === '') return;
      if (input.id.startsWith('coupling')) autoScale(Number(input.id.slice(-1)));
      acquire();
    });
  });
  document.querySelectorAll('.condition-inputs input, .condition-inputs select').forEach(input => input.addEventListener('change', () => { if (readSettings()) acquire(); }));
  $('save-csv').addEventListener('click', () => { if (state.frame) download(traceCsv(state.frame.traces, state.frame.context), 'text/csv', 'glowcost-simulated-scope.csv'); });
  $('save-screen').addEventListener('click', () => $('scope-screen').toBlob(blob => {
    if (blob) download(blob, 'image/png', 'glowcost-simulated-scope.png');
  }));
  const showInfo = () => $('model-dialog').showModal();
  $('model-info').addEventListener('click', showInfo); $('conditions-info').addEventListener('click', showInfo);
  $('close-model').addEventListener('click', () => $('model-dialog').close());
  $('scope-fullscreen').addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.querySelector('.scope-panel').requestFullscreen(); }
    catch { $('trigger-state').textContent = 'Full screen unavailable in this browser'; }
  });
  setInterval(() => { if (!document.hidden && $('input-error').hidden) acquire(state.single); }, 350);
  acquire();
}

start().catch(error => {
  $('board-loading').textContent = `Readout bench unavailable: ${error.message}`;
  $('scope-message').hidden = false; $('scope-message').textContent = error.message;
  console.error(error);
});

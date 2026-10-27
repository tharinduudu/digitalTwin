import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DAC, DEFAULT_BENCH, dacVoltage, identifyNet, createEvent, sampleSignal,
  measurements, triggerCrossing, traceCsv } from '../public/probe-signals.js';
import { axisVoltageLabel } from '../public/probe-scope.js';

const data = JSON.parse(await readFile(new URL('../public/assets/probe-board.json', import.meta.url), 'utf8'));
const response = data.response;
const event = settings => createEvent(response, { ...DEFAULT_BENCH, ...settings });
const trace = (net, settings = {}, acquisition = {}) => sampleSignal(event(settings), identifyNet(net), acquisition);

test('pad locations use the exact PCB revision already rendered in the detector', async () => {
  const manifest = JSON.parse(await readFile(new URL('../cad/hardware-manifest.json', import.meta.url), 'utf8'));
  assert.equal(data.sha256, manifest.readout.sha256);
  assert.equal(data.pads.length, 560);
  assert.equal(data.schematic.matchedPads, data.pads.length);
  assert.ok(data.pads.every(pad => Number.isFinite(pad.x) && Number.isFinite(pad.z)));
  assert.equal(data.schematic.netAliases.Ch0_HV0, 'Ch0_DAC0');
  assert.equal(data.schematic.netAliases.Ch7_COMP3, 'Ch6_COMP3');
  const names = Object.values(data.schematic.netAliases);
  assert.equal(new Set(names).size, names.length);
});

test('all four actual analog chains and threshold/bias DAC nets are mapped', () => {
  for (let channel = 0; channel < 4; channel++) {
    for (const net of [`CH${channel}`, `Ch${channel}_D`, `Ch${channel}_DAC${channel}`,
      `Net-(J${channel + 3}-SIG)`, `Net-(U${channel + 6}-+)`, `Net-(U${channel + 6}--)`,
      `Net-(U${channel + 12}-IN+)`, `Net-(U${channel + 12}-IN-)`, `Net-(U${channel + 12}-OUT)`,
      `DAC${channel}`, `DAC${channel + 4}`]) {
      assert.ok(data.pads.some(pad => pad.net === net), net);
      assert.equal(identifyNet(net).channel, channel, net);
    }
  }
  assert.equal(identifyNet('Ch6_COMP3').channel, 3);
});

test('unsupported nets do not quietly produce a zero-volt waveform', () => {
  for (const net of ['SDA', 'LED-0', 'Net-(Q1-G)', 'unconnected-(U1-NC-Pad4)']) {
    assert.equal(identifyNet(net).type, 'unknown');
    assert.equal(trace(net), null);
  }
  assert.equal(identifyNet().type, 'unknown');
});

test('DAC hexadecimal values correspond to the stored 10-bit calibration, not accuracy claims', () => {
  assert.equal(dacVoltage(0), DAC.offset);
  assert.equal(dacVoltage(1023), DAC.offset + DAC.span);
  assert.ok(Math.abs(dacVoltage(129) - dacVoltage(128) - 2.9968 / 1023) < 1e-12);
  const e = event({ biasCode: 445 });
  assert.ok(Math.abs(e.overvoltage - (DEFAULT_BENCH.highSide - e.low - DEFAULT_BENCH.vbr)) < 1e-12);
});

test('millivolt divisions remain readable on a large DC pedestal', () => {
  assert.notEqual(axisVoltageLabel(55.134, 0.001), axisVoltageLabel(55.136, 0.001));
  assert.equal(axisVoltageLabel(1.65, 1), '1.65');
});

test('SPICE impulse has the resistor-defined gain, a positive pulse and a recovered baseline', () => {
  assert.ok(Math.abs(response.closedLoopGain - (1 + 4900 / 49.9)) < 1e-10);
  assert.equal(response.engine, 'ngspice');
  for (const [name, values] of Object.entries(response.series)) {
    assert.equal(values.length, 4001);
    assert.ok(values.every(Number.isFinite));
    assert.ok(Math.max(...values) > 0, name);
    assert.ok(Math.abs(values.at(-1)) < 2e-6, name);
  }
  assert.ok(Math.max(...response.series.amplifier) > 0.01);
  assert.ok(Math.max(...response.series.amplifier) < 0.1);
});

test('analog pulse scales with fired cells and overvoltage without altering DC rails', () => {
  const one = measurements(trace('CH0', { avalanches: 1 }));
  const ten = measurements(trace('CH0', { avalanches: 10 }));
  assert.ok(Math.abs(ten.max / one.max - 10) < 1e-9);
  const below = measurements(trace('CH0', { highSide: 50 }));
  assert.equal(below.peakToPeak, 0);
  const clipped = measurements(trace('CH0', { avalanches: 1000 }));
  assert.equal(clipped.max, 4.65);
  assert.equal(measurements(trace('+3V3')).mean.toFixed(3), '3.300');
});

test('SMA centre has the low-side pedestal, while the shield net is high voltage', () => {
  const e = event({});
  assert.ok(Math.abs(trace('Net-(J3-SIG)').voltage[0] - e.low) < 1e-9);
  assert.ok(identifyNet('Net-(J3-SIG)').warning.includes('shield'));
  assert.equal(trace('HV').voltage[0], DEFAULT_BENCH.highSide);
  assert.ok(identifyNet('HV').warning.includes('High voltage'));
});

test('raising the threshold suppresses comparator output but leaves analog pulse unchanged', () => {
  const low = trace('Ch0_D', { thresholdCode: 48 });
  const high = trace('Ch0_D', { thresholdCode: 1023 });
  assert.ok(measurements(low).max > 3.2);
  assert.equal(measurements(high).max, 0);
  assert.deepEqual(trace('CH0', { thresholdCode: 48 }).voltage, trace('CH0', { thresholdCode: 1023 }).voltage);
  assert.ok(triggerCrossing(low, 1.65) !== null);
  assert.equal(triggerCrossing(high, 1.65), null);
  assert.ok(triggerCrossing(low, 1.65, 'falling') > triggerCrossing(low, 1.65));
});

test('quiet and dark-event choices do not fabricate a particle coincidence', () => {
  assert.equal(measurements(trace('CH0', { source: 'quiet' })).peakToPeak, 0);
  assert.equal(measurements(trace('Ch0_D', { source: 'quiet' })).peakToPeak, 0);
  assert.ok(measurements(trace('CH0', { source: 'dark' })).max < 0.03);
  assert.equal(measurements(trace('Ch0_D', { source: 'dark' })).max, 0);
  assert.equal(measurements(trace('CH1', { source: 'dark', darkChannel: 0 })).max, 0);
  assert.ok(measurements(trace('CH1', { source: 'dark', darkChannel: 1 })).max > 0);
});

test('scope AC/GND coupling and bandwidth act on the acquired waveform', () => {
  const ac = trace('DAC0', {}, { coupling: 'AC', bandwidth: '20MHz' });
  assert.equal(measurements(ac).peakToPeak, 0);
  assert.equal(measurements(ac).mean, 0);
  assert.equal(measurements(trace('CH0', {}, { coupling: 'GND' })).max, 0);
  assert.ok(measurements(trace('CH0', {}, { bandwidth: '20MHz' })).max < measurements(trace('CH0')).max);
});

test('CSV marks simulated provenance and preserves probe-tip volts and node metadata', () => {
  const content = traceCsv([trace('CH0'), trace('Ch0_D')], { probes: ['CH0', 'Ch0_D'] });
  assert.match(content, /^# Simulated/);
  assert.match(content, /CH0/);
  assert.match(content, /time_ns,A_tip_V,B_tip_V/);
  assert.equal(content.split('\n').length, 4004);
});

test('the bench is static, local-library based, and linked from both existing views', async () => {
  const html = await readFile(new URL('../public/probe.html', import.meta.url), 'utf8');
  assert.match(html, /No hardware connection/);
  assert.doesNotMatch(html, /<script[^>]+src="https:/);
  for (const entry of ['index.html', 'assembly.html']) {
    const source = await readFile(new URL(`../public/${entry}`, import.meta.url), 'utf8');
    assert.match(source, /href="\.\/probe\.html"/);
  }
  const build = await readFile(new URL('../scripts/build-pages.mjs', import.meta.url), 'utf8');
  assert.match(build, /'probe\.html'/);
});

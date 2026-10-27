// Electrical identities come from KiCad. Only explicitly supported nets get traces.
export const DAC = Object.freeze({ offset: 0.0005, span: 2.9968, max: 1023 });
export const DEFAULT_BENCH = Object.freeze({ highSide: 55.13438, biasCode: 445,
  thresholdCode: 128, vbr: 50.83, avalanches: 30, source: 'pulse', noise: false, darkChannel: 0 });
export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const dacVoltage = code => DAC.offset + DAC.span * clamp(Math.round(code), 0, DAC.max) / DAC.max;

export function identifyNet(net = '') {
  if (net === 'GND') return { type: 'dc', value: 0, title: 'Signal ground', detail: 'Common ground reference.' };
  const rails = { '+5V': 5, '+5V-A': 5, '-5V': -5, '+3V3': 3.3, '+1V2': 1.2,
    '3v3_COMP': 3.3, '3v3_DAC': 3.3, '3v3_CLK': 3.3, 'Vref': 3, '/5V-BOOST': 5,
    'Net-(U5-+VOUT)': 5, 'Net-(U5--VOUT)': -5, 'Net-(U5-+VIN)': 5 };
  if (Object.hasOwn(rails, net)) return { type: 'dc', value: rails[net], title: `${net} supply`,
    detail: 'Ideal settled DC rail. Converter ripple, startup and load regulation are not modelled.' };
  if (['HV', 'HV_out'].includes(net)) return { type: 'hv', title: 'High-side bias',
    detail: 'Ideal settled high-side voltage. No switching waveform or ripple prediction.', warning: 'High voltage. A virtual ground clip is not permission to connect an earth-referenced scope here.' };
  if (['CLK', 'Pi_CLK', 'Net-(Y1-OUT)'].includes(net)) return { type: 'clock', title: 'Nominal 50 MHz clock',
    detail: 'Illustrative 0-3.3 V clock; jitter, routing and firmware timing are not reproduced.' };
  for (let channel = 0; channel < 4; channel++) {
    const amp = 6 + channel, cmp = 12 + channel, input = 3 + channel;
    const entries = [
      [`Net-(J${input}-SIG)`, 'raw', 'SiPM SMA centre', 'Low-side DC level plus the avalanche pulse. The SMA shield is the high-side bias, not ground.'],
      [`Net-(U${amp}-+)`, 'input', 'Amplifier non-inverting input', 'After the 1 uF coupling capacitor, into 49.9 ohm to ground.'],
      [`Net-(U${amp}--)`, 'feedback', 'Amplifier feedback', 'Feedback divider: 4.9 kohm / 49.9 ohm.'],
      [`CH${channel}`, 'amplifier', 'Amplifier output', 'OPA846 reduced-order response. Gain is set by the actual feedback resistor values.'],
      [`Net-(U${cmp}-IN+)`, 'comparatorInput', 'Comparator signal input', 'Amplified pulse after the 200 ohm series resistor.'],
      [`Net-(U${cmp}-IN-)`, 'threshold', 'Comparator threshold input', 'Settled threshold DAC voltage, after the RC filter.'],
      [`Net-(U${cmp}-OUT)`, 'digital', 'Comparator output', 'Comparator response with assumed 8 mV hysteresis, nominal 2.5 ns delay and finite edges.'],
      [`Ch${channel}_D`, 'digital', 'FPGA channel input', 'Comparator output after the 22 ohm resistor; transmission-line effects are not modelled.'],
      [`Ch${channel}_HV${channel}`, 'low', 'SiPM low-side bias', 'Settled bias DAC voltage. Effective reverse bias is high side minus low side.'],
      [`Ch${channel}_DAC${channel}`, 'low', 'SiPM low-side bias', 'Settled bias DAC voltage. Effective reverse bias is high side minus low side.'],
      [`DAC${channel}`, 'low', 'Bias DAC output', 'Settled calibrated DAC law; no update glitch or settling transient.'],
      [`DAC${channel + 4}`, 'threshold', 'Threshold DAC output', 'Settled threshold DAC voltage.'],
      [`Ch${channel + 4}_COMP${channel}`, 'threshold', 'Filtered threshold DAC', 'Settled threshold voltage before the comparator input RC filter.'],
    ];
    if (channel === 3) entries.push(['Ch6_COMP3', 'threshold', 'Filtered threshold DAC', 'Settled CH3 threshold. This net is named Ch6_COMP3 in the source PCB.']);
    const entry = entries.find(([name]) => name === net);
    if (entry) return { type: entry[1], channel, title: `CH${channel} ${entry[2]}`, detail: entry[3],
      warning: entry[1] === 'raw' ? 'SMA shield carries HV. Use PCB signal ground as the reference, never the shield.' : null };
  }
  return { type: 'unknown', title: 'No node model',
    detail: net.startsWith('unconnected-') ? 'This pad is unconnected in the PCB.'
      : 'The net is identified, but its waveform is not modelled. No trace is invented for this point.' };
}

export function templateValue(response, name, timeNs) {
  const data = response.series[name];
  const index = (timeNs - response.startNs) / response.stepNs;
  if (index < 0 || index >= data.length - 1) return 0;
  const lower = Math.floor(index), fraction = index - lower;
  return data[lower] * (1 - fraction) + data[lower + 1] * fraction;
}

// The same injected event is used by both probes. Channel offsets are illustrative,
// not a reconstruction of a measured muon track or measured channel variation.
export function createEvent(response, settings = DEFAULT_BENCH, sequence = 0) {
  const low = dacVoltage(settings.biasCode);
  const overvoltage = settings.highSide - low - settings.vbr;
  const count = settings.source === 'quiet' ? 0 : settings.source === 'dark' ? 1 : settings.avalanches;
  const scale = count * Math.max(0, overvoltage) / response.referenceOvervoltage;
  const phase = sequence * 0.731;
  const noiseAt = time => settings.noise ? 0.0015 * (Math.sin(time * 0.611 + phase)
    + 0.6 * Math.sin(time * 1.137 + phase * 2) + 0.3 * Math.sin(time * 0.167)) : 0;
  const analog = (name, time, channel = 0) => {
    const shifted = time - channel * 1.5;
    const channelScale = settings.source === 'dark' && channel !== (settings.darkChannel ?? 0) ? 0 : scale;
    const linear = templateValue(response, name, shifted) * channelScale;
    if (name === 'amplifier' || name === 'comparatorInput') return clamp(linear + noiseAt(shifted), -4.65, 4.65);
    if (name === 'feedback') return clamp(templateValue(response, 'amplifier', shifted) * channelScale + noiseAt(shifted), -4.65, 4.65) / response.closedLoopGain;
    return linear + noiseAt(shifted) / (name === 'feedback' ? response.closedLoopGain : 100);
  };
  // Cache a sampled Schmitt comparator, rather than deciding its output separately
  // at each queried time (hysteresis depends on the preceding state).
  const digital = [];
  const step = response.stepNs, start = response.startNs, length = response.series.input.length;
  const threshold = dacVoltage(settings.thresholdCode);
  for (let channel = 0; channel < 4; channel++) {
    const trace = new Float64Array(length);
    let high = false, voltage = 0;
    for (let index = 0; index < length; index++) {
      const time = start + index * step - 2.5;
      const input = analog('comparatorInput', time, channel);
      if (input > threshold + 0.004) high = true;
      else if (input < threshold - 0.004) high = false;
      voltage += ((high ? 3.3 : 0) - voltage) * (1 - Math.exp(-step / 0.55));
      trace[index] = voltage;
    }
    digital.push(trace);
  }
  return { settings: { ...settings }, overvoltage, low, threshold, scale, count,
    value(descriptor, timeNs) {
      if (descriptor.type === 'unknown') return null;
      if (descriptor.type === 'dc') return descriptor.value;
      if (descriptor.type === 'hv') return settings.highSide;
      if (descriptor.type === 'low') return low;
      if (descriptor.type === 'threshold') return threshold;
      if (descriptor.type === 'clock') return (timeNs % 20 + 20) % 20 < 10 ? 3.3 : 0;
      if (descriptor.type === 'digital') {
        const index = (timeNs - start) / step;
        if (index < 0 || index >= length - 1) return 0;
        const k = Math.floor(index), fraction = index - k;
        return digital[descriptor.channel][k] * (1 - fraction) + digital[descriptor.channel][k + 1] * fraction;
      }
      const pulse = analog(descriptor.type, timeNs, descriptor.channel);
      return descriptor.type === 'raw' ? low + pulse : pulse;
    } };
}

export function sampleSignal(event, descriptor, { start = -200, step = 0.5, count = 4001,
  coupling = 'DC', bandwidth = 'full' } = {}) {
  if (descriptor.type === 'unknown') return null;
  const time = new Float64Array(count), voltage = new Float64Array(count);
  let previous = event.value(descriptor, start), ac = 0;
  let filtered = coupling === 'DC' ? previous : 0;
  const acFactor = Math.exp(-step / 1e9 / (0.1 / (2 * Math.PI))); // 10 Hz input high-pass
  const bwFactor = 1 - Math.exp(-2 * Math.PI * 20e6 * step * 1e-9);
  for (let i = 0; i < count; i++) {
    time[i] = start + step * i;
    const input = coupling === 'GND' ? 0 : event.value(descriptor, time[i]);
    if (coupling === 'AC') { ac = acFactor * (ac + input - previous); previous = input; }
    const value = coupling === 'AC' ? ac : input;
    filtered = bandwidth === '20MHz' ? filtered + bwFactor * (value - filtered) : value;
    voltage[i] = filtered;
  }
  return { time, voltage };
}

export function triggerCrossing(trace, level = 0.1, slope = 'rising') {
  if (!trace) return null;
  for (let i = 1; i < trace.time.length; i++) {
    const a = trace.voltage[i - 1], b = trace.voltage[i];
    if (slope === 'rising' ? a < level && b >= level : a > level && b <= level) {
      return trace.time[i - 1] + (level - a) / (b - a) * (trace.time[i] - trace.time[i - 1]);
    }
  }
  return null;
}

export function measurements(trace) {
  if (!trace) return null;
  let min = Infinity, max = -Infinity, total = 0;
  for (const value of trace.voltage) { min = Math.min(min, value); max = Math.max(max, value); total += value; }
  return { min, max, peakToPeak: max - min, mean: total / trace.voltage.length };
}

export function traceCsv(channels, context) {
  const rows = ['# Simulated readout bench; not live scope data', `# ${JSON.stringify(context)}`,
    'time_ns,A_tip_V,B_tip_V'];
  const trace = channels.find(Boolean);
  if (!trace) return rows.join('\n');
  for (let i = 0; i < trace.time.length; i++) rows.push([trace.time[i],
    ...channels.map(channel => channel ? channel.voltage[i] : '')].join(','));
  return rows.join('\n');
}

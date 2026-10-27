export const CHANNEL_COLOURS = ['#f0bd43', '#64cff0'];

export function voltageLabel(value) {
  if (Math.abs(value) < 1e-8) return '0 V';
  if (Math.abs(value) < 1) return `${Number((value * 1000).toPrecision(3))} mV`;
  return `${Number(value.toPrecision(4))} V`;
}

function timeLabel(value) { return Math.abs(value) >= 1000 ? `${Number((value / 1000).toFixed(2))} us` : `${Number(value.toFixed(1))} ns`; }

export class ScopeDisplay {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.cursors = [];
    this.resizeObserver = new ResizeObserver(() => this.draw());
    this.resizeObserver.observe(canvas);
    canvas.addEventListener('pointerup', event => {
      if (!this.frame) return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      if (x < this.plot.left || x > this.plot.right) return;
      if (this.cursors.length === 2) this.cursors = [];
      this.cursors.push((x - this.plot.left) / (this.plot.right - this.plot.left));
      this.draw();
    });
  }

  update(frame, controls) { this.frame = frame; this.controls = controls; this.draw(); }

  draw() {
    const width = this.canvas.clientWidth, height = this.canvas.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(window.devicePixelRatio, 2);
    if (this.canvas.width !== Math.round(width * ratio) || this.canvas.height !== Math.round(height * ratio)) {
      this.canvas.width = Math.round(width * ratio); this.canvas.height = Math.round(height * ratio);
    }
    const ctx = this.context;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = '#101713'; ctx.fillRect(0, 0, width, height);
    this.plot = { left: 50, right: width - 49, top: 38, bottom: height - 65 };
    const p = this.plot, w = p.right - p.left, h = p.bottom - p.top;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = p.left + i * w / 10;
      ctx.strokeStyle = i % 5 === 0 ? '#405047' : '#28392e';
      ctx.beginPath(); ctx.moveTo(x, p.top); ctx.lineTo(x, p.bottom); ctx.stroke();
    }
    for (let i = 0; i <= 8; i++) {
      const y = p.top + i * h / 8;
      ctx.strokeStyle = i === 4 ? '#405047' : '#28392e';
      ctx.beginPath(); ctx.moveTo(p.left, y); ctx.lineTo(p.right, y); ctx.stroke();
    }
    ctx.font = '10px Arial'; ctx.fillStyle = '#7f9a87';
    ctx.fillText('SIMULATED  /  V at probe tip', p.left, 18);
    if (!this.controls) return;
    const { timebase, channels, triggerLevel, triggerSource } = this.controls;
    const origin = this.frame?.trigger ?? 0;
    const start = origin - timebase * 2, end = origin + timebase * 8;
    const xAt = time => p.left + (time - start) / (end - start) * w;
    const yAt = (value, index) => p.top + h / 2 - (value - channels[index].offset) / channels[index].scale * h / 8;
    ctx.font = '10px Consolas, monospace';
    ctx.fillStyle = '#8aab95'; ctx.textAlign = 'center';
    for (let i = 0; i <= 10; i += 2) ctx.fillText(timeLabel((i - 2) * timebase), p.left + i * w / 10, p.bottom + 18);
    ctx.textAlign = 'right'; ctx.fillText(`${timeLabel(timebase)} / div`, p.right, height - 10);
    ctx.textAlign = 'left'; ctx.fillText('t = 0 at trigger', p.left, height - 10);
    ctx.strokeStyle = '#91b09d'; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(xAt(origin), p.top); ctx.lineTo(xAt(origin), p.bottom); ctx.stroke(); ctx.setLineDash([]);
    channels.forEach((channel, index) => {
      if (!channel.enabled) return;
      ctx.fillStyle = CHANNEL_COLOURS[index];
      ctx.textAlign = index ? 'left' : 'right';
      for (let i = 0; i <= 8; i += 2) {
        const value = channel.offset + (4 - i) * channel.scale;
        ctx.fillText(Number(value.toPrecision(3)).toString(), index ? p.right + 7 : p.left - 7, p.top + i * h / 8 + 3);
      }
      const zero = yAt(0, index);
      if (zero >= p.top && zero <= p.bottom) { ctx.beginPath(); ctx.arc(index ? p.right : p.left, zero, 3, 0, Math.PI * 2); ctx.fill(); }
      ctx.textAlign = 'left';
      const prefix = index ? 'B' : 'A';
      ctx.fillText(`${prefix} ${voltageLabel(channel.scale)}/div`, p.left + index * Math.min(180, w / 2), p.bottom + 33);
    });
    const triggerY = yAt(triggerLevel, triggerSource);
    if (channels[triggerSource].enabled && triggerY >= p.top && triggerY <= p.bottom) {
      ctx.save(); ctx.beginPath(); ctx.rect(p.left, p.top, w, h); ctx.clip();
      ctx.strokeStyle = '#839788'; ctx.setLineDash([3, 8]); ctx.beginPath(); ctx.moveTo(p.left, triggerY); ctx.lineTo(p.right, triggerY); ctx.stroke(); ctx.restore();
    }
    if (this.frame) {
      ctx.save(); ctx.beginPath(); ctx.rect(p.left, p.top, w, h); ctx.clip();
      this.frame.traces.forEach((trace, channel) => {
        if (!trace || !channels[channel].enabled) return;
        ctx.strokeStyle = CHANNEL_COLOURS[channel]; ctx.lineWidth = 1.5;
        ctx.beginPath(); let pen = false;
        const lower = Math.max(0, Math.floor((start - trace.time[0]) / (trace.time[1] - trace.time[0])) - 1);
        for (let i = lower; i < trace.time.length && trace.time[i] <= end; i++) {
          const x = xAt(trace.time[i]), y = yAt(trace.voltage[i], channel);
          if (pen) ctx.lineTo(x, y); else { ctx.moveTo(x, y); pen = true; }
        }
        ctx.stroke();
      });
      ctx.restore();
      ctx.textAlign = 'right'; ctx.fillStyle = '#9db8a5'; ctx.fillText(`Record ${this.frame.sequence}`, p.right, 18);
    }
    this.cursors.forEach((fraction, index) => {
      const x = p.left + fraction * w;
      ctx.strokeStyle = '#ccd7c4'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x, p.top); ctx.lineTo(x, p.bottom); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#d9e6d8'; ctx.textAlign = 'left'; ctx.fillText(`${index + 1}`, x + 3, p.top + 11);
    });
    if (this.cursors.length === 2) {
      const dt = Math.abs(this.cursors[1] - this.cursors[0]) * (end - start);
      ctx.fillStyle = '#e6eddf'; ctx.textAlign = 'center'; ctx.fillText(`Delta t ${timeLabel(dt)}`, p.left + w / 2, 31);
    }
    ctx.textAlign = 'left';
  }
}

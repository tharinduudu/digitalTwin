function prepare(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio, 2);
  const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, w, h };
}

export function sparkline(canvas, values, color) {
  const { ctx, w, h } = prepare(canvas);
  const low = Math.min(...values) - 10, high = Math.max(...values) + 10;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = i / Math.max(1, values.length - 1) * (w - 2) + 1;
    const y = h - 3 - (v - low) / (high - low) * (h - 6);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
}

export function historyChart(canvas, history) {
  const { ctx, w, h } = prepare(canvas);
  const pad = { l: 27, r: 5, t: 18, b: 23 };
  const values = history.flatMap(d => [d.c01, d.c12]);
  const low = Math.floor((Math.min(...values) - 15) / 20) * 20;
  const high = Math.ceil((Math.max(...values) + 15) / 20) * 20;
  const y = v => h - pad.b - (v - low) / (high - low) * (h - pad.t - pad.b);
  const x = i => pad.l + i / Math.max(1, history.length - 1) * (w - pad.l - pad.r);
  ctx.font = '10px Arial';
  for (const value of [low, (low + high) / 2, high]) {
    const yy = y(value);
    ctx.strokeStyle = '#354139'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w - pad.r, yy); ctx.stroke();
    ctx.fillStyle = '#9faea3'; ctx.textAlign = 'left'; ctx.fillText(Math.round(value), 0, yy + 3);
  }
  for (const [key, color] of [['c01', '#80ecc0'], ['c12', '#f5a394']]) {
    ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.beginPath();
    history.forEach((row, index) => index ? ctx.lineTo(x(index), y(row[key])) : ctx.moveTo(x(index), y(row[key])));
    ctx.stroke();
    ctx.fillStyle = color;
    for (const index of [0, history.length - 1]) { ctx.beginPath(); ctx.arc(x(index), y(history[index][key]), 2, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.fillStyle = '#9faea3';
  for (const index of [0, history.length - 1]) {
    ctx.textAlign = index ? 'right' : 'left';
    ctx.fillText(new Date(history[index].start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }), x(index), h - 5);
  }
}

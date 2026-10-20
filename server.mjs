import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, extname, resolve, sep } from 'node:path';
import { Simulation } from './simulation.mjs';
import { DetectorSource } from './detector-source.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), 'public');
const port = Number(process.env.PORT || 8791);
const simulation = new Simulation();
const detector = process.env.DETECTOR_HOST ? new DetectorSource(process.env.DETECTOR_HOST) : null;
if (detector) detector.poll();
const snapshot = () => detector ? detector.snapshot(simulation.snapshot()) : simulation.snapshot();
const clients = new Set();
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json' };

// Track packets are illustrations; the optional SSH source supplies only minute totals.
const server = createServer(async (req, res) => {
  if (req.method !== 'GET') { res.writeHead(405).end(); return; }
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/snapshot') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(snapshot()));
    return;
  }
  if (url.pathname === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store',
      'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot())}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  try {
    const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = resolve(root, '.' + pathname);
    if (!file.startsWith(root + sep) || !(await stat(file)).isFile()) throw new Error('Not found');
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
    res.end(await readFile(file));
  } catch { res.writeHead(404).end('Not found'); }
});

let ticks = 0;
const timer = setInterval(() => {
  const now = Date.now();
  const events = simulation.advance(now);
  if (events.length) {
    const payload = `event: tracks\ndata: ${JSON.stringify(events)}\n\n`;
    for (const client of clients) if (!client.destroyed && client.writableLength < 100000) client.write(payload);
  }
  if (++ticks % 7 === 0) {
    const payload = `event: snapshot\ndata: ${JSON.stringify(snapshot())}\n\n`;
    for (const client of clients) if (!client.destroyed && client.writableLength < 100000) client.write(payload);
  }
}, 150);
const detectorTimer = detector ? setInterval(() => detector.poll(), 15000) : null;
server.listen(port, '127.0.0.1', () => console.log(`gLOWCOST exhibition: http://127.0.0.1:${port}`));
function stop() { clearInterval(timer); clearInterval(detectorTimer); for (const client of clients) client.end(); server.close(); }
process.on('SIGTERM', stop);
process.on('SIGINT', stop);

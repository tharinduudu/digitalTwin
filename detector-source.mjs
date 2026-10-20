import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function parseMinuteLog(text, offset = '-0400') {
  const rows = [];
  // Ignore a partially written final line.
  for (const line of text.split('\n').slice(0, -1)) {
    const fields = line.split(',').map(x => x.trim());
    if (fields.length !== 8 || fields.slice(0, 7).some(x => !/^\d+$/.test(x))) continue;
    const date = fields[7].match(/^\w{3}\s+(\w{3})\s+(\d+)\s+(\d{2}:\d{2}:\d{2})\s+(\d{4})$/);
    if (!date || !months.includes(date[1])) continue;
    const month = String(months.indexOf(date[1]) + 1).padStart(2, '0');
    const end = Date.parse(`${date[4]}-${month}-${date[2].padStart(2, '0')}T${date[3]}${offset.slice(0,3)}:${offset.slice(3)}`);
    if (!Number.isFinite(end)) continue;
    const [c01, c02, c12, triple, ...singles] = fields.slice(0, 7).map(Number);
    rows.push({ start: end - 60000, end, c01, c02, c12, triple, singles });
  }
  return [...new Map(rows.map(row => [row.end, row])).values()].sort((a,b) => a.end-b.end).slice(-15);
}

const remoteRead = `import json,pathlib,time,socket,sys
root=pathlib.Path(sys.argv[1])
files=list(root.glob('*.log'))
if not files: raise RuntimeError('No minute log files')
path=max(files,key=lambda p:p.stat().st_mtime)
with path.open('rb') as f:
    f.seek(max(0,path.stat().st_size-65536))
    data=f.read().decode('utf-8',errors='replace')
print(json.dumps(dict(host=socket.gethostname(),path=str(path),offset=time.strftime('%z'),now=time.time()*1000,text=data)))`;

export class DetectorSource {
  constructor(host) {
    this.host = host;
    this.user = process.env.DETECTOR_USER || 'cosmic';
    this.controlPath = process.env.DETECTOR_CONTROL_PATH || '/tmp/glowcost-display-%C';
    this.logDirectory = process.env.DETECTOR_LOG_DIR || `/home/${this.user}/mppcInterface/firmware/libraries/slowControl`;
    this.history = [];
    this.updated = 0;
    this.error = null;
    this.busy = false;
  }

  async poll() {
    if (this.busy) return;
    this.busy = true;
    try {
      const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
      const { stdout } = await run('ssh', ['-S', this.controlPath, '-o', 'BatchMode=yes',
        '-o', 'ConnectTimeout=5', `${this.user}@${this.host}`,
        `python3 -c ${quote(remoteRead)} ${quote(this.logDirectory)}`], { timeout: 8000, maxBuffer: 100000 });
      const result = JSON.parse(stdout);
      const history = parseMinuteLog(result.text, result.offset);
      if (!history.length) throw new Error('Latest file has no complete minute records');
      this.history = history;
      this.detectorName = result.host;
      this.path = result.path;
      this.updated = Date.now();
      this.error = null;
    } catch (error) {
      this.error = error.killed ? 'Detector read timed out' : 'Detector read unavailable';
    } finally { this.busy = false; }
  }

  snapshot(illustration, now = Date.now()) {
    const last = this.history.at(-1);
    const age = last ? now - last.end : Infinity;
    return { ...illustration, source: 'detector',
      status: this.error ? 'offline' : !last ? 'loading' : age > 150000 ? 'stale' : 'live',
      history: this.history, last, current: null,
      detector: { host: this.host, name: this.detectorName, path: this.path,
        updated: this.updated, ageSeconds: last ? Math.max(0, Math.round(age / 1000)) : null, error: this.error },
      animation: 'illustration',
    };
  }
}

const NS = 'http://www.w3.org/2000/svg';

export class ProbeSchematic {
  constructor(host, data, onNet, onComponent) {
    this.host = host; this.data = data; this.onNet = onNet; this.onComponent = onComponent;
  }

  async load() {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const response = await fetch('./assets/readout-schematic/RPi_Hat.svg');
      if (!response.ok) throw new Error(`Schematic request failed: ${response.status}`);
      const doc = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
      if (doc.querySelector('parsererror')) throw new Error('Invalid schematic SVG');
      this.svg = document.importNode(doc.documentElement, true);
      this.svg.setAttribute('width', '100%'); this.svg.setAttribute('height', '100%');
      this.host.replaceChildren(this.svg);
      const refs = new Set(this.data.components.map(part => part.ref));
      const aliases = this.data.schematic?.netAliases || {};
      const nets = new Set([...this.data.pads.map(pad => pad.net), ...Object.keys(aliases)]);
      const seen = new Set();
      this.svg.querySelectorAll('text').forEach(text => {
        const label = text.textContent.trim();
        if (!refs.has(label) && !nets.has(label)) return;
        const x = Number(text.getAttribute('x')), y = Number(text.getAttribute('y'));
        const key = `${label}:${x}:${y}`;
        if (seen.has(key)) return;
        seen.add(key);
        const target = document.createElementNS(NS, 'rect');
        target.setAttribute('x', x - 3); target.setAttribute('y', y - 2.5);
        target.setAttribute('width', Math.max(6, label.length * 1.2)); target.setAttribute('height', '3.5');
        target.setAttribute('class', 'schematic-target');
        target.setAttribute('tabindex', '0'); target.setAttribute('role', 'button');
        target.setAttribute('aria-label', refs.has(label) ? `Pins of ${label}` : `Probe ${label}`);
        const title = document.createElementNS(NS, 'title'); title.textContent = target.getAttribute('aria-label'); target.append(title);
        const action = () => refs.has(label) ? this.onComponent(label) : this.onNet(aliases[label] || label);
        target.addEventListener('click', action);
        target.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); } });
        this.svg.append(target);
      });
      this.host.addEventListener('wheel', event => { event.preventDefault(); this.zoom(event.deltaY > 0 ? 1.15 : 1 / 1.15); }, { passive: false });
      this.svg.addEventListener('pointerdown', event => {
        if (event.target.closest('.schematic-target')) return;
        this.drag = { x: event.clientX, y: event.clientY, box: [...this.box] };
        this.svg.setPointerCapture(event.pointerId);
      });
      this.svg.addEventListener('pointermove', event => {
        if (!this.drag) return;
        const factor = Math.max(this.box[2] / this.host.clientWidth, this.box[3] / this.host.clientHeight);
        this.setBox([this.drag.box[0] - (event.clientX - this.drag.x) * factor,
          this.drag.box[1] - (event.clientY - this.drag.y) * factor, this.box[2], this.box[3]]);
      });
      this.svg.addEventListener('pointerup', () => { this.drag = null; });
      this.focusChannel(0);
      this.host.dataset.ready = 'true';
    })();
    return this.loading;
  }

  setBox(box) { this.box = box; this.svg?.setAttribute('viewBox', box.join(' ')); }
  focusChannel(channel) { this.setBox([202, 7 + channel * 49, 205, 76]); }
  wholeSheet() { this.setBox([5, 5, 410, 280]); }
  zoom(factor) {
    if (!this.box) return;
    const width = Math.max(25, Math.min(600, this.box[2] * factor));
    const height = this.box[3] * width / this.box[2];
    this.setBox([this.box[0] + (this.box[2] - width) / 2, this.box[1] + (this.box[3] - height) / 2, width, height]);
  }
}

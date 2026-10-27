// Optional browser QA. npm test runs the dependency-free circuit checks separately.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const base = process.env.BENCH_URL || 'http://127.0.0.1:8791/probe.html';
const errors = [];
await mkdir('screenshots', { recursive: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  const remote = [];
  page.on('request', request => {
    if (!request.url().startsWith(new URL(base).origin) && !request.url().startsWith('data:')) remote.push(request.url());
  });
  await page.goto(base);
  await page.waitForSelector('#probe-board[data-ready="true"]', { timeout: 30000 });
  await page.waitForFunction(() => document.getElementById('trigger-state').textContent === 'Triggered');
  assert.equal(await page.locator('#input-error').isVisible(), false);
  assert.match(await page.locator('#bias-summary').textContent(), /Overvoltage 3\.000 V/);
  const pixels = await page.evaluate(() => {
    const canvas = document.querySelector('#probe-board canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const data = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    let board = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] > 65 && data[i + 1] > 70 && data[i + 2] > 60) board++;
    const scope = document.querySelector('#scope-screen');
    const waveform = scope.getContext('2d').getImageData(0, 0, scope.width, scope.height).data;
    let yellow = 0, cyan = 0;
    for (let i = 0; i < waveform.length; i += 4) {
      if (waveform[i] > 180 && waveform[i + 1] > 140 && waveform[i + 2] < 110) yellow++;
      if (waveform[i] < 150 && waveform[i + 1] > 150 && waveform[i + 2] > 150) cyan++;
    }
    return { board, yellow, cyan };
  });
  assert.ok(pixels.board > 10000, JSON.stringify(pixels));
  assert.ok(pixels.yellow > 100 && pixels.cyan > 100, JSON.stringify(pixels));
  async function checkProbeArrows() {
    const result = await page.evaluate(() => {
      const bounds = document.querySelector('.board-stage').getBoundingClientRect();
      const labels = [0, 1].map(index => document.getElementById(`board-probe-${index}`));
      const targets = [0, 1].map(index => {
        const ring = document.getElementById(`probe-target-${index}`);
        return { x: bounds.left + Number(ring.getAttribute('cx')), y: bounds.top + Number(ring.getAttribute('cy')) };
      });
      const visible = labels.filter(label => !label.hidden && getComputedStyle(label).display !== 'none');
      return visible.map(label => {
        const box = label.getBoundingClientRect();
        return { contained: box.left >= bounds.left && box.right <= bounds.right && box.top >= bounds.top && box.bottom <= bounds.bottom,
          clear: targets.every(target => target.x < box.left - 12 || target.x > box.right + 12 || target.y < box.top - 12 || target.y > box.bottom + 12) };
      });
    });
    assert.ok(result.length > 0);
    assert.ok(result.every(item => item.contained && item.clear), JSON.stringify(result));
    for (const index of [0, 1]) assert.match(await page.locator(`#probe-arrow-${index}`).getAttribute('d'), /^M .* L /);
  }
  await checkProbeArrows();
  await page.screenshot({ path: 'screenshots/probe-desktop.png', fullPage: true });
  const originalBoard = await page.locator('#probe-board canvas').evaluate(canvas => canvas.toDataURL());
  await page.getByRole('button', { name: '3D', exact: true }).click();
  const turnedBoard = await page.locator('#probe-board canvas').evaluate(canvas => canvas.toDataURL());
  assert.notEqual(originalBoard, turnedBoard);
  await checkProbeArrows();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Front', exact: true }).click();

  // Threshold changes affect the comparator, not the analog waveform.
  await page.locator('#threshold-code').fill('3FF'); await page.locator('#threshold-code').dispatchEvent('change');
  await page.waitForFunction(() => document.getElementById('measurement-1').textContent.includes('Pk-pk 0 V'));
  assert.match(await page.locator('#measurement-0').textContent(), /588 mV/);
  await page.locator('#trigger-mode').selectOption('normal');
  await page.waitForFunction(() => document.getElementById('trigger-state').textContent.includes('Waiting'));
  await page.locator('#threshold-code').fill('080'); await page.locator('#threshold-code').dispatchEvent('change');
  await page.waitForFunction(() => document.getElementById('trigger-state').textContent === 'Triggered');
  await page.locator('#single').click();
  await page.waitForFunction(() => document.getElementById('trigger-state').textContent === 'Single captured');
  assert.equal(await page.locator('#run-stop').getAttribute('aria-pressed'), 'false');
  const held = await page.locator('#scope-screen').evaluate(canvas => canvas.toDataURL());
  await page.waitForTimeout(800);
  assert.equal(await page.locator('#scope-screen').evaluate(canvas => canvas.toDataURL()), held);
  const csvDownload = page.waitForEvent('download'); await page.locator('#save-csv').click();
  assert.equal((await csvDownload).suggestedFilename(), 'glowcost-simulated-scope.csv');
  const pngDownload = page.waitForEvent('download'); await page.locator('#save-screen').click();
  assert.equal((await pngDownload).suggestedFilename(), 'glowcost-simulated-scope.png');
  await page.locator('#run-stop').click();

  // No invented waveform on a MAX1932 switching/control net.
  await page.locator('#node-search').fill('Q1.');
  const row = page.locator('.net-row').filter({ has: page.locator('.net-copy strong', { hasText: 'Net-(Q1-G)' }) });
  await row.getByRole('button', { name: 'Probe A at Net-(Q1-G)', exact: true }).click();
  assert.match(await page.locator('#scope-message').textContent(), /no node model/);
  await page.locator('#node-search').fill('');
  await page.getByRole('button', { name: 'Amp output', exact: true }).click();
  await page.locator('#trigger-mode').selectOption('auto');

  // The real schematic opens, can be zoomed, and its net labels select the PCB net.
  await page.getByRole('button', { name: 'Schematic', exact: true }).click();
  await page.waitForSelector('#schematic-view[data-ready="true"]');
  await page.screenshot({ path: 'screenshots/probe-schematic.png', fullPage: true });
  const oldBox = await page.locator('#schematic-view svg').getAttribute('viewBox');
  await page.locator('#schematic-in').click();
  assert.notEqual(await page.locator('#schematic-view svg').getAttribute('viewBox'), oldBox);
  await page.locator('#board-reset').click();
  await page.locator('#schematic-view [aria-label="Probe CH0"]').first().dispatchEvent('click');
  assert.match(await page.locator('#node-net-0').textContent(), /CH0/);
  await page.getByRole('button', { name: 'Front', exact: true }).click();
  await page.locator('#model-info').click();
  assert.equal(await page.locator('#model-dialog').isVisible(), true);
  await page.locator('#close-model').click();
  await page.locator('#bias-code').fill('FFF'); await page.locator('#bias-code').dispatchEvent('change');
  assert.equal(await page.locator('#input-error').isVisible(), true);
  await page.locator('#bias-code').fill('1BD'); await page.locator('#bias-code').dispatchEvent('change');
  await page.locator('#pcb-channel').selectOption('3');
  await page.getByRole('button', { name: 'Amp output', exact: true }).click();
  assert.match(await page.locator('#node-net-0').textContent(), /CH3/);
  await page.locator('#pcb-channel').selectOption('0');
  await page.getByRole('button', { name: 'Amp output', exact: true }).click();

  for (const width of [390, 360]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert.equal(overflow, false, `horizontal overflow at ${width}px`);
    await checkProbeArrows();
    await page.screenshot({ path: `screenshots/probe-mobile-${width}.png`, fullPage: true });
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(remote, [], 'the bench must not contact a cloud service');
  console.log('Browser checks passed:', pixels, '/ desktop, mobile, trigger, probing, schematic, exports, no cloud requests');
} finally { await browser.close(); }

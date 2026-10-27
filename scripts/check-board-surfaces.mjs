// Check the real CAD, including whether the hidden face changes any rendered pixels.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TWIN_URL || 'http://127.0.0.1:8791/';
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(new URL('probe.html', base).href);
  await page.waitForSelector('#probe-board[data-ready="true"]');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.locator('.board-stage').screenshot({ path: 'screenshots/probe-board-back.png' });
  const result = await page.evaluate(async () => {
    const THREE = await import(new URL('vendor/three.module.js', document.baseURI));
    const { loadBoard } = await import(new URL('hardware.js', document.baseURI));
    const { body } = await loadBoard(new URL('assets/readout-assembly.glb', document.baseURI).href, [0, 0, 0], [], 'J2');
    body.rotation.set(0, 0, 0); body.scale.setScalar(1000); body.position.set(0, 0, 0);
    body.updateMatrixWorld(true);
    const centre = new THREE.Box3().setFromObject(body).getCenter(new THREE.Vector3());
    centre.y = 0; body.position.sub(centre);
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#18211e');
    scene.add(body, new THREE.HemisphereLight('#ffffff', '#ffffff', 3));
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 500);
    camera.up.set(0, 0, -1);
    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(512, 512);
    const ink = [], surfaces = [];
    body.traverse(mesh => {
      if (!mesh.isMesh) return;
      const role = mesh.material.userData.boardSurface;
      if (role === 'substrate' || role === 'silkscreen') surfaces.push({ role,
        opacity: mesh.material.opacity, transparent: mesh.material.transparent, side: mesh.material.side });
      if (role !== 'silkscreen') return;
      const original = mesh.geometry;
      const face = sign => {
        const geometry = new THREE.BufferGeometry();
        for (const name of ['position', 'normal']) {
          const values = [], source = original.attributes[name];
          for (let vertex = 0; vertex < source.count; vertex += 3) {
            if (original.attributes.normal.getY(vertex) * sign < 0.5) continue;
            values.push(...source.array.slice(vertex * 3, (vertex + 3) * 3));
          }
          geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, 3));
        }
        return geometry;
      };
      ink.push({ mesh, original, front: face(1), back: face(-1) });
    });
    const pixels = () => {
      renderer.render(scene, camera);
      const values = new Uint8Array(512 * 512 * 4), gl = renderer.getContext();
      gl.readPixels(0, 0, 512, 512, gl.RGBA, gl.UNSIGNED_BYTE, values);
      return values;
    };
    const differences = (a, b) => {
      let count = 0;
      for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 3) count++;
      return count;
    };
    const views = {};
    for (const [name, sign] of [['front', 1], ['back', -1]]) {
      camera.position.set(0, sign * 145, 0); camera.lookAt(0, 0, 0);
      ink.forEach(item => { item.mesh.geometry = item.original; });
      const baseline = pixels();
      // Keeping only the camera-facing lettering must produce the same image.
      ink.forEach(item => { item.mesh.geometry = item[name]; });
      const hiddenFacePixelChanges = differences(baseline, pixels());
      // Removing that visible lettering must change pixels; it was not deleted globally.
      ink.forEach(item => { item.mesh.geometry = item[name === 'front' ? 'back' : 'front']; });
      const visibleFacePixelChanges = differences(baseline, pixels());
      views[name] = { hiddenFacePixelChanges, visibleFacePixelChanges };
    }
    ink.forEach(item => { item.mesh.geometry = item.original; item.front.dispose(); item.back.dispose(); });
    renderer.dispose();
    return { surfaces, views };
  });
  assert.ok(result.surfaces.some(surface => surface.role === 'substrate'));
  assert.ok(result.surfaces.some(surface => surface.role === 'silkscreen'));
  for (const surface of result.surfaces) {
    assert.equal(surface.opacity, 1); assert.equal(surface.transparent, false);
    if (surface.role === 'silkscreen') assert.equal(surface.side, 0);
  }
  for (const view of Object.values(result.views)) {
    assert.equal(view.hiddenFacePixelChanges, 0);
    assert.ok(view.visibleFacePixelChanges > 100);
  }
  await page.goto(new URL('index.html?source=simulation', base).href);
  await page.waitForSelector('#scene[data-hardware-ready="true"]', { timeout: 30000 });
  await page.locator('#open-box').click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/detector-opaque-pcb.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PCB face checks passed:', JSON.stringify(result.views), '/ probe and detector views loaded');
} finally { await browser.close(); }

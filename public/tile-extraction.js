import * as THREE from 'three';
import { TelescopeScene } from './scene.js';
import { ScintillationScene } from './scintillation-scene.js';
import { applyStudioAppearance } from './studio-appearance.js';
import { TILE_HEIGHTS } from './detector-geometry.js';

const section = document.querySelector('#tile-extraction');
const panel = document.querySelector('#tile-explorer');
const host = document.querySelector('#extraction-scene');
const caption = document.querySelector('#extraction-caption');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => value * value * (3 - 2 * value);

export function setupTileExtraction(onReady, onPhysicsScroll) {
  const observer = new IntersectionObserver(async ([entry]) => {
    if (!entry.isIntersecting) return;
    observer.disconnect();
    let view;
    try {
      view = new TelescopeScene(host);
      cancelAnimationFrame(view.animationId);
      view.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
      view.renderer.shadowMap.enabled = false;
      view.controls.enableDamping = false;
      view.controls.enableZoom = false;
      view.renderer.domElement.style.touchAction = 'pan-y';
      applyStudioAppearance(view);
      await view.ready;
      if (view.loadError) throw view.loadError;
      if (view.sourceCaseReady) view.lid.rotation.set(Math.PI, 0, 0);
      view.setCutaway(false);
    } catch (error) {
      view?.renderer.domElement.remove();
      console.error(error);
      caption.textContent = 'The 3D tile is unavailable. Use the physics animation to follow the interaction.';
      return;
    }

    const parts = view.mechanicalParts;
    const top = view.tiles[0];
    const light = view.fibreLights[0];
    light.glow.material.blending = THREE.NormalBlending;
    const glowRadius = light.glow.geometry.parameters.radius;
    light.glow.geometry.dispose();
    light.glow.geometry = new THREE.TubeGeometry(light.curve, 400, glowRadius * 1.8, 6, false);
    light.glow.renderOrder = 8;
    const tile = new THREE.Group();
    tile.position.y = TILE_HEIGHTS[0];
    view.model.add(tile);
    // Reparent the actual detector parts. Preserve their positions at the start
    // of the scroll, then lift this group together with its optical effects.
    for (const part of [top.cover, top.tile, parts.holders[0], parts.sensors[0], light.core, light.glow]) {
      tile.attach(part);
    }

    const effects = new THREE.Group();
    tile.add(effects);
    const fasteners = parts.upperSheetFasteners.slice(0, 4);
    const lid = [parts.upperAcrylic[0], view.topText];
    const liner = parts.upperLiner[0];
    const offsets = new Map([...fasteners, ...lid, liner].map(part => [part, part.position.clone()]));
    const rest = view.model.children.filter(part => part !== tile);
    const restGroup = new THREE.Group();
    view.model.add(restGroup);
    rest.forEach(part => restGroup.attach(part));

    let frame;
    let previousProgress;
    let previousWidth;
    let previousPhysicsProgress;
    const optical = new ScintillationScene(effects, light, view.camera, view.controls, redraw);
    onReady(optical);

    function move(part, up, side) {
      part.position.copy(offsets.get(part));
      part.position.y += up;
      part.position.x += side;
    }

    function redraw() {
      if (frame !== undefined) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        const bounds = section.getBoundingClientRect();
        const hostBounds = host.getBoundingClientRect();
        if (hostBounds.bottom <= 0 || hostBounds.top >= innerHeight) return;
        const travel = Math.max(1, bounds.height - panel.offsetHeight);
        const scrollProgress = clamp(-bounds.top / travel);
        const extractionEnd = .32;
        const progress = reduced.matches ? 1 : clamp(scrollProgress / extractionEnd);
        const width = host.clientWidth;
        if (progress !== previousProgress || width !== previousWidth) {
          previousProgress = progress;
          previousWidth = width;
          updateExtraction(progress);
        }
        if (!reduced.matches) {
          const physicsProgress = clamp((scrollProgress - extractionEnd) / (1 - extractionEnd));
          if (physicsProgress !== previousPhysicsProgress) {
            previousPhysicsProgress = physicsProgress;
            onPhysicsScroll(physicsProgress);
          }
        }
        if (effects.visible) optical.renderEffects();
        view.renderer.render(view.scene, view.camera);
      });
    }

    function updateExtraction(progress) {
      const undo = ease(clamp(progress * 3));
      const uncover = ease(clamp((progress - .13) * 2.6));
      const lift = ease(clamp((progress - .45) / .48));
      const focus = ease(clamp((progress - .12) / .88));
      fasteners.forEach(part => move(part, undo * 6 + uncover * 12, -uncover * 20));
      lid.forEach(part => move(part, uncover * 11, -uncover * 20));
      move(liner, uncover * 7, -uncover * 17);
      tile.position.set(lift * 4, TILE_HEIGHTS[0] + lift * 15, 0);
      restGroup.position.y = -32 * ease(clamp((progress - .7) / .3));
      restGroup.visible = progress < 1;
      view.sensorLeads[0].visible = lift === 0;

      const open = progress >= .43;
      const ready = progress >= 1;
      top.cover.visible = !open;
      top.tile.visible = open;
      light.core.visible = open;
      light.glow.visible = false;
      effects.visible = ready;
      view.controls.enabled = ready;
      panel.dataset.interacting = String(ready);

      const narrowFit = Math.max(1, .98 * host.clientHeight / Math.max(1, host.clientWidth));
      const distance = (.79 - .42 * focus) * narrowFit;
      view.controls.target.set(-2 + 6 * focus, -1 + (tile.position.y + 1) * focus, 0);
      view.camera.position.copy(view.controls.target);
      view.camera.position.x += 51 * distance;
      view.camera.position.y += (33 + 9 * focus) * distance;
      view.camera.position.z += 67 * distance;
      view.controls.update();

      caption.textContent = ready ? 'Keep scrolling to follow the particle interaction.'
        : progress < .13 ? 'Scroll to lift out the top scintillator.'
        : progress < .45 ? 'The fasteners, acrylic and liner lift away.'
        : 'The top tile lifts out with its fibre and sensor.';
    }

    host.dataset.ready = 'true';
    window.addEventListener('scroll', redraw, { passive: true });
    new ResizeObserver(redraw).observe(host);
    view.controls.addEventListener('change', redraw);
    reduced.addEventListener('change', redraw);
    redraw();
  });
  observer.observe(section);
}

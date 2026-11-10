import { TelescopeScene } from './scene.js';
import { applyStudioAppearance } from './studio-appearance.js';
import { guidedMuon } from './guided-muon.js';

const steps = [
  ['A visitor born above us.', 'Cosmic rays striking the atmosphere produce showers of particles. Some of those particles are muons. A muon can pass through the detector and leave energy in its plastic tiles.', 'Three tiles, each 20 × 20 × 1 cm, with a cut corner from the supplied tile CAD.', 'This is a selected simulated muon. It is not a reconstructed event from the real detector.'],
  ['A small flash in the plastic.', 'As the muon crosses a scintillator, it transfers energy to the material. Some of that energy becomes light. The transparent view lets you see the otherwise hidden tile and its fibre groove.', 'Adjacent tile centre planes are 13 cm apart; the outer pair is 26 cm apart.', 'Tile flashes are exaggerated for visibility. Their brightness is not a calculated light yield.'],
  ['Light finds a path.', 'A wavelength-shifting fibre collects some of the scintillation light, re-emits it at a longer wavelength, and guides a portion towards the sensor at the tile’s corner.', 'The fibre route follows a section through the groove in the supplied tile model.', 'The 1 mm fibre diameter is a display assumption. Green travelling light illustrates collection, not photon efficiency or travel time.'],
  ['Light becomes an electrical pulse.', 'The Hamamatsu silicon photomultiplier at the corner converts detected photons into avalanche pulses. Its carrier connects to coax, carrying the signal to the readout board.', 'The reference sensor is the Hamamatsu S13360-2050VE.', 'The sensor package uses its component model. The carrier and U.FL connector are illustrative geometry; the journey does not calculate photon detection efficiency.'],
  ['The electronics make a decision.', 'The readout amplifies each channel’s signal and compares it with a threshold. Coincidence logic looks for pulses in multiple channels within a time window.', 'Open the actual KiCad PCB and schematic in the electronics bench below.', 'The red indicators explain a tile crossing. They do not reproduce the FPGA firmware or measured LED timing. Thresholds and a coincidence window are not simulated in the main ideal count model.'],
  ['One muon. Several coincidences.', 'This example crosses all three tiles. It therefore contributes to the top–middle, middle–bottom and top–bottom pairs, and to the triple total. Adding pair counts would count the same muon more than once.', 'A triple contributes to all three pair counters. It is still one particle.', 'Real detector mode supplies completed minute totals, not individual event positions or timestamps. The full simulation uses ideal tile hits.'],
];
const $ = id => document.getElementById(id);
let scene;
let current = 0;
try {current=Math.max(0,Math.min(steps.length-1,Math.trunc(Number(sessionStorage.getItem('glowcost-guide-step')))||0));} catch {}
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
try {
  scene = new TelescopeScene($('guided-scene'));
  applyStudioAppearance(scene);
  scene.setCutaway(false);
  scene.paused = reduced;
  scene.ready.then(() => {
    if (scene.loadError || scene.hardware.state.error) throw scene.loadError || new Error(scene.hardware.state.error);
    $('guided-scene').dataset.ready = 'true';
    $('guide-loading').hidden=true;
    show(current);
  }).catch(error => {
    console.error(error);
    $('model-error').textContent = 'Some source CAD could not load. The visible model may be incomplete; the explanation remains available.';
    $('model-error').hidden = false;
    $('guide-loading').hidden=true;
  });
} catch (error) {
  console.error(error);
  $('model-error').hidden = false;
    $('guide-loading').hidden=true;
  $('replay').disabled = true;
  $('reset-view').disabled = true;
}
function replay() {
  if (!scene) return;
  scene.paused = false;
  scene.clearTracks();
  scene.addTrack(guidedMuon());
}
const dots = steps.map((step, index) => {
  const button = document.createElement('button');
  button.textContent = `${index+1} ${['Muon','Tile','Light','Sensor','Readout','Counts'][index]}`;
  button.setAttribute('aria-label', `Step ${index + 1}: ${step[0]}`);
  button.addEventListener('click', () => show(index));
  document.querySelector('.step-progress').append(button);
  return button;
});
function show(index) {
  current = index;
  try {sessionStorage.setItem('glowcost-guide-step',String(index));} catch {}
  const [title, body, fact, note] = steps[index];
  $('step-number').textContent = `STEP ${index + 1} OF ${steps.length}`;
  $('step-title').textContent = title;
  $('step-body').textContent = body;
  $('step-fact').textContent = fact;
  $('step-note').textContent = note;
  $('step-deeper').hidden = index < 1 || index > 3;
  $('step-announcement').textContent = `Step ${index + 1} of ${steps.length}`;
  $('previous').disabled = index === 0;
  $('next').textContent = index === steps.length - 1 ? 'Look inside a tile →' : 'Next step →';
  dots.forEach((dot, i) => { if (i === index) dot.setAttribute('aria-current', 'step'); else dot.removeAttribute('aria-current'); });
  if (scene) {
    scene.clearTracks();
    scene.setCutaway(index > 0);
    scene.setBoxOpen(index === 4);
    if (!reduced && index < 4) replay();
  }
}
$('previous').addEventListener('click', () => show(Math.max(0, current - 1)));
$('next').addEventListener('click', () => {if(current===steps.length-1)location.href='./scintillation.html';else show(current+1);});
$('replay').addEventListener('click', replay);
$('reset-view').addEventListener('click', () => scene?.resetCamera());
show(0);

// Start the example when a visitor reaches the model, rather than spending it
// while they are reading the introduction above it.
const visibility = new IntersectionObserver(entries => {
  if (entries.some(entry => entry.isIntersecting) && !reduced) replay();
}, { threshold: 0.5 });
visibility.observe($('guided-scene'));

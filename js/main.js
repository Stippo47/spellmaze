import { newGame, step, setWeapon } from './game.js';
import { makeInput } from './input.js';
import { makeRenderer } from './render.js';
import { WIDTHS, pathField, lineClear } from './maze.js';
import { WEAPONS, WEAPON_ORDER } from './weapons.js';
import { fmtTime } from './util.js';

const canvas = document.getElementById('game');
const DEFAULTS = { sight: 'remember', ticks: true, widths: 'mixed', nodes: 24, view: 22, weapon: 'pistol', fps: false };
let opts = { ...DEFAULTS };
try { Object.assign(opts, JSON.parse(localStorage.getItem('spellmaze-opts') || '{}')); } catch {}
const q = new URLSearchParams(location.search);
for (const k of Object.keys(DEFAULTS)) if (q.has(k)) { const v = q.get(k); opts[k] = typeof DEFAULTS[k] === 'number' ? +v : typeof DEFAULTS[k] === 'boolean' ? v === '1' : v; }
const save = () => { try { localStorage.setItem('spellmaze-opts', JSON.stringify(opts)); } catch {} };

const R = makeRenderer(canvas);
const inp = makeInput(canvas, () => R.playerScreen());
inp.showFingers = q.has('fingers');
let g = newGame({ ...opts, seed: q.has('seed') ? +q.get('seed') : undefined });
let paused = false, manual = false;

const $ = (id) => document.getElementById(id);
const DT = 1 / 60;
let acc = 0, last = performance.now(), fpsT = 0, frames = 0, sizeW = 0, sizeH = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  frames++; fpsT += dt; if (fpsT > 0.5) { R.fps = frames / fpsT; frames = 0; fpsT = 0; }
  // iOS home-screen apps don't always send a resize when the phone turns: check the size every frame.
  if (canvas.clientWidth !== sizeW || canvas.clientHeight !== sizeH) { sizeW = canvas.clientWidth; sizeH = canvas.clientHeight; R.resize(); inp.relayout(); }
  if (manual) { requestAnimationFrame(frame); return; }
  if (!paused && !g.over) {
    acc += dt; let n = 0;
    while (acc >= DT && n < 5) { step(g, DT, inp); inp.events.length = 0; acc -= DT; n++; }
    if (n === 5) acc = 0;
  } else inp.events.length = 0;
  R.draw(g, inp, opts);
  if (g.over && $('over').classList.contains('hidden')) showOver();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function showOver() {
  $('overStats').textContent = `You lasted ${fmtTime(g.t)} · ${g.kills} kills · level ${g.level}`;
  $('over').classList.remove('hidden');
}
function restart(keepSeed) {
  g = newGame({ ...opts, seed: keepSeed ? g.seed : undefined });
  $('over').classList.add('hidden');
}
$('again').onclick = () => restart(false);

// ---------- settings ----------
const CHOICES = {
  sight: [['remember', 'Remembered'], ['all', 'See all'], ['dark', 'Dark']],
  ticks: [[true, 'On'], [false, 'Off']],
  weapon: WEAPON_ORDER.map(id => [id, WEAPONS[id].name]),
  widths: Object.entries(WIDTHS).map(([k, v]) => [k, v.label]),
  nodes: [[16, 'Small'], [24, 'Medium'], [32, 'Large']],
  view: [[16, 'Close'], [22, 'Normal'], [28, 'Far'], [36, 'Farther']],
  fps: [[false, 'Off'], [true, 'On']],
};
const REBUILD = new Set(['widths', 'nodes']);
function buildSettings() {
  for (const [k, list] of Object.entries(CHOICES)) {
    const row = document.querySelector(`[data-opt="${k}"] .seg`); row.innerHTML = '';
    for (const [v, label] of list) {
      const b = document.createElement('button'); b.textContent = label; b.className = opts[k] === v ? 'on' : '';
      b.onclick = () => {
        opts[k] = v; save(); buildSettings();
        if (k === 'weapon') setWeapon(g, v);
        if (REBUILD.has(k)) restart(true);
      };
      row.appendChild(b);
    }
  }
}
buildSettings();
$('pause').onclick = () => { paused = true; $('menu').classList.remove('hidden'); };
$('resume').onclick = () => { paused = false; $('menu').classList.add('hidden'); last = performance.now(); };
$('newmaze').onclick = () => { restart(false); paused = false; $('menu').classList.add('hidden'); };

// Test hook (used to film clips): window.SM
// manual: the page stops running by itself; advance(n) runs n steps and draws (frame-exact films).
window.SM = { get g() { return g; }, inp, opts, restart, R, setPaused: (v) => { paused = v; },
  setManual: (v) => { manual = v; }, lib: { pathField, lineClear },
  advance: (n = 1) => { for (let i = 0; i < n && !g.over; i++) { step(g, DT, inp); inp.events.length = 0; } R.draw(g, inp, opts); if (g.over && $('over').classList.contains('hidden')) showOver(); },
  setOpt: (k, v) => { opts[k] = v; if (k === 'weapon') setWeapon(g, v); } };

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');

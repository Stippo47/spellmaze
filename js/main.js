import { newGame, step, setWeapon } from './game.js';
import { makeInput } from './input.js';
import { makeRenderer } from './render.js';
import { WIDTHS, pathField, lineClear } from './maze.js';
import { WEAPONS, WEAPON_ORDER } from './weapons.js';
import { fmtTime } from './util.js';
import { MODULES, MODULE_ORDER, CASTS, CAST_ORDER, MAX_LEVEL, allowed } from './modules.js';
import { RARITY, RARITY_ORDER, SLOTS, VITALS, placeResult, place, takeLevelCard, cardText, rebuild } from './run.js';

const canvas = document.getElementById('game');
const DEFAULTS = { sight: 'remember', ticks: false, widths: 'mixed', nodes: 24, view: 28, weapon: 'pistol', fps: false, practice: false };
const EMPTY_BUILD = () => ({ weapon: {}, spawn: {}, dash: {} });
let opts = { ...DEFAULTS };
try { const sv = JSON.parse(localStorage.getItem('spellmaze-opts') || '{}'); if (sv.v === 2) Object.assign(opts, sv); } catch {}
opts.v = 2; // new defaults (round 2): saved settings from before are dropped
if (!opts.build) opts.build = EMPTY_BUILD();
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
  if (g.run.offers.length && $('offer').classList.contains('hidden')) showOffer();
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
  practice: [[false, 'Off'], [true, 'On']],
};
const REBUILD = new Set(['widths', 'nodes', 'practice']);
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

// ---------- chest and level-up cards ----------
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const rar = (r) => `<span style="color:${RARITY[r].color}">${RARITY[r].name}</span>`;
function closeOffer() { g.run.offers.shift(); $('offer').classList.add('hidden'); last = performance.now(); }

function showOffer() {
  const o = g.run.offers[0], cards = $('offerCards'), foot = $('offerFoot');
  cards.innerHTML = ''; foot.innerHTML = '';
  $('offer').classList.remove('hidden');
  if (o.kind === 'level') {
    $('offerTitle').textContent = `Level ${g.level}: pick one`;
    for (const c of o.cards) {
      let b;
      if (c.type === 'mod') {
        const m = g.run.mods[c.cast].find(m => m.id === c.id), M = MODULES[c.id];
        b = el('button', 'ocard', `<div class="fam-${M.family} oname">${M.name} ${m.level} → ${m.level + 1}</div>
          <div class="osub">${CASTS[c.cast].name} · ${rar(m.rarity)} · cap ${RARITY[m.rarity].cap}</div>
          <div class="otext">${cardText(c.cast, c.id, m.level + 1)}</div>`);
        b.style.borderColor = RARITY[m.rarity].color;
      } else {
        const V = VITALS[c.id];
        b = el('button', 'ocard', `<div class="oname">${V.name}</div><div class="osub">You</div><div class="otext">${V.text(g.run.vitals[c.id])}</div>`);
      }
      b.onclick = () => { takeLevelCard(g, c); closeOffer(); };
      cards.appendChild(b);
    }
    return;
  }
  // a chest: one module, put it in a cast
  const M = MODULES[o.id];
  $('offerTitle').innerHTML = `Chest: <span class="fam-${M.family}">${M.name}</span> · ${rar(o.rarity)} <span class="osub">(levels up to ${RARITY[o.rarity].cap})</span>`;
  for (const c of CAST_ORDER) {
    const r = placeResult(g, c, o.id, o.rarity), have = g.run.mods[c].find(m => m.id === o.id);
    const what = { new: `New, level 1: ${allowed(c, o.id) ? cardText(c, o.id, 1) : ''}`,
      promote: `Already there: becomes ${RARITY[o.rarity].name}, keeps level ${have && have.level}, cap ${RARITY[o.rarity].cap}`,
      level: `Already there: level ${have && have.level} → ${have && have.level + 1}`,
      capped: `Already there at its cap`, full: `Full (${SLOTS[c]} slots): replace one`, no: `Doesn't fit this cast` }[r];
    const b = el('button', 'ocard', `<div class="oname">${CASTS[c].name}</div><div class="osub">${g.run.mods[c].length} of ${SLOTS[c]} slots</div><div class="otext">${what}</div>`);
    b.style.borderColor = RARITY[o.rarity].color;
    if (r === 'no' || r === 'capped') b.disabled = true;
    b.onclick = () => {
      if (r !== 'full') { place(g, c, o.id, o.rarity); closeOffer(); return; }
      cards.innerHTML = ''; $('offerTitle').textContent = `Replace which ${CASTS[c].name} module?`;
      g.run.mods[c].forEach((m, i) => {
        const x = el('button', 'ocard', `<div class="oname fam-${MODULES[m.id].family}">${MODULES[m.id].name} ${m.level}</div><div class="osub">${rar(m.rarity)}</div><div class="otext">Goes. ${M.name} takes its slot at level 1.</div>`);
        x.onclick = () => { place(g, c, o.id, o.rarity, i); closeOffer(); };
        cards.appendChild(x);
      });
      const back = el('button', 'big alt', 'Back'); back.onclick = () => { $('offer').classList.add('hidden'); };
      foot.innerHTML = ''; foot.appendChild(back);
    };
    cards.appendChild(b);
  }
  const xp = 3 * (RARITY_ORDER.indexOf(o.rarity) + 1);
  const scrap = el('button', 'big alt', `Scrap it: +${xp} XP`); scrap.onclick = () => { g.xp += xp; closeOffer(); };
  foot.appendChild(scrap);
}

// ---------- build screen ----------
// Practice on: every module free, any level. Practice off: the run's own build, and modules can be moved.
function buildBuild() {
  const grid = $('buildGrid'); grid.innerHTML = '';
  $('buildHead').textContent = opts.practice ? '· practice: free, any level (Settings → Practice)' : '· this run: found in chests, levelled by level-ups';
  $('buildClear').classList.toggle('hidden', !opts.practice);
  if (!opts.practice) {
    grid.appendChild(el('tr', null, CAST_ORDER.map(c => `<th>${CASTS[c].name} (${g.run.mods[c].length}/${SLOTS[c]})</th>`).join('')));
    const tr = el('tr');
    for (const c of CAST_ORDER) {
      const td = el('td', 'runcol');
      if (!g.run.mods[c].length) td.appendChild(el('div', 'note', 'empty'));
      g.run.mods[c].forEach((m, i) => {
        const M = MODULES[m.id], box = el('div', 'runmod', `<div><b class="fam-${M.family}">${M.name}</b> ${m.level}/${RARITY[m.rarity].cap} ${rar(m.rarity)}</div><div class="note">${cardText(c, m.id, m.level)}</div>`);
        box.style.borderColor = RARITY[m.rarity].color;
        for (const to of CAST_ORDER) {
          if (to === c || !allowed(to, m.id) || g.run.mods[to].length >= SLOTS[to] || g.run.mods[to].some(x => x.id === m.id)) continue;
          const mv = el('button', 'mini', `→ ${CASTS[to].name}`);
          mv.onclick = () => { g.run.mods[c].splice(i, 1); g.run.mods[to].push(m); rebuild(g); buildBuild(); };
          box.appendChild(mv);
        }
        td.appendChild(box);
      });
      tr.appendChild(td);
    }
    grid.appendChild(tr);
    const v = g.run.vitals;
    $('buildText').innerHTML = `You: health ${v.health}, speed ${v.speed}, cooldowns ${v.cooldown}, pickup ${v.pickup}. Moving a module keeps its level.`;
    return;
  }
  grid.appendChild(el('tr', null, '<th></th>' + CAST_ORDER.map(c => `<th>${CASTS[c].name}</th>`).join('')));
  for (const id of MODULE_ORDER) {
    const M = MODULES[id], tr = el('tr', null, `<td class="name fam-${M.family}">${M.name}</td>`);
    for (const c of CAST_ORDER) {
      const td = el('td');
      if (allowed(c, id)) {
        const lv = opts.build[c][id] || 0, st = el('span', 'step' + (lv ? ' on' : ''));
        const minus = el('button', null, '−'), plus = el('button', null, '+'), b = el('b', null, lv);
        minus.onclick = () => { opts.build[c][id] = Math.max(0, lv - 1); if (!opts.build[c][id]) delete opts.build[c][id]; save(); buildBuild(); };
        plus.onclick = () => { opts.build[c][id] = Math.min(MAX_LEVEL, lv + 1); save(); buildBuild(); };
        st.append(minus, b, plus); td.appendChild(st);
      } else td.textContent = '·';
      tr.appendChild(td);
    }
    grid.appendChild(tr);
  }
  const lines = [];
  for (const c of CAST_ORDER) for (const id of MODULE_ORDER) {
    const lv = opts.build[c][id]; if (!lv) continue;
    lines.push(`<b>${CASTS[c].name}</b> ${MODULES[id].name} ${lv}: ${cardText(c, id, lv)}`);
  }
  $('buildText').innerHTML = lines.length ? lines.join('<br>') : 'Nothing yet. Any module goes on any cast.';
  g.practice = opts.build; rebuild(g);
}
$('openbuild').onclick = () => { $('menu').classList.add('hidden'); $('build').classList.remove('hidden'); buildBuild(); };
$('buildDone').onclick = () => { $('build').classList.add('hidden'); $('menu').classList.remove('hidden'); };
$('buildClear').onclick = () => { opts.build = EMPTY_BUILD(); save(); buildBuild(); };

// Test hook (used to film clips): window.SM
// manual: the page stops running by itself; advance(n) runs n steps and draws (frame-exact films).
window.SM = { get g() { return g; }, inp, opts, restart, R, setPaused: (v) => { paused = v; },
  setManual: (v) => { manual = v; }, lib: { pathField, lineClear },
  advance: (n = 1) => { for (let i = 0; i < n && !g.over; i++) { step(g, DT, inp); inp.events.length = 0; } R.draw(g, inp, opts); if (g.over && $('over').classList.contains('hidden')) showOver(); },
  setOpt: (k, v) => { opts[k] = v; if (k === 'weapon') setWeapon(g, v); if (k === 'build') { g.practice = v; rebuild(g); } },
  showOffer: () => showOffer(),
  pickOffer: (i = 0) => { const o = g.run.offers[0]; if (!o) return; if (o.kind === 'level') takeLevelCard(g, o.cards[i] || o.cards[0]);
    else { const c = CAST_ORDER.find(c => ['new', 'promote', 'level'].includes(placeResult(g, c, o.id, o.rarity))); if (c) place(g, c, o.id, o.rarity); } closeOffer(); } };

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');

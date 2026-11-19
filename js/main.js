import { newGame, step, setWeapon, makeEnemy } from './game.js';
import { makeInput } from './input.js';
import { makeRenderer } from './render.js';
import { WIDTHS, pathField, lineClear } from './maze.js';
import { WEAPONS, WEAPON_ORDER } from './weapons.js';
import { fmtTime } from './util.js';
import { MODULES, MODULE_ORDER, CASTS, CAST_ORDER, MAX_LEVEL, allowed } from './modules.js';
import { RARITY, RARITY_ORDER, SLOTS, VITALS, placeResult, place, takeLevelCard, cardText, rebuild } from './run.js';
import { icon, pips, slots } from './ui.js';

const canvas = document.getElementById('game');
const DEFAULTS = { sight: 'remember', ticks: false, widths: 'mixed', nodes: 24, view: 28, weapon: 'pistol', fps: false, practice: false, playground: false };
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
  playground: [[false, 'Off'], [true, 'On']],
};
const REBUILD = new Set(['widths', 'nodes', 'practice', 'playground']);
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

// ---------- shard, start and level-up cards (round 4: new look) ----------
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const FAMC = { path: '#38e8ff', form: '#e8f0ff', payload: '#ff8a1f', spawn: '#ffd23f' };
const modColor = (id) => MODULES[id].color || FAMC[MODULES[id].family];
const rar = (r) => `<span style="color:${RARITY[r].color}">${RARITY[r].name}</span>`;
function closeOffer() { g.run.offers.shift(); $('offer').classList.add('hidden'); last = performance.now(); }

// One card: a coloured band on top, an icon and name, pips, then what it does.
function card({ color, band, ic, icColor, name, sub, pipsHtml = '', text, onClick, disabled }) {
  const b = el('button', 'card', `<div class="band" style="background:${color}">${band}</div>
    <div class="chead">${icon(ic, icColor, 32)}<div><div class="cname">${name}</div><div class="csub">${sub}</div></div></div>
    ${pipsHtml}<div class="ctext">${text}</div>`);
  b.style.setProperty('--rc', color);
  if (disabled) b.disabled = true; else b.onclick = onClick;
  return b;
}

function levelCard(c) {
  const take = () => { takeLevelCard(g, c); closeOffer(); };
  if (c.type === 'new') {
    const M = MODULES[c.id], Rr = RARITY[c.rarity];
    return card({ color: Rr.color, band: 'New module', ic: c.id, icColor: modColor(c.id), name: M.name,
      sub: `${Rr.name} · ${icon(c.cast, '#8b94bb', 14)} ${CASTS[c.cast].name}`, pipsHtml: pips(0, Rr.cap, true), text: cardText(c.cast, c.id, 1), onClick: take });
  }
  if (c.type === 'mod') {
    const m = g.run.mods[c.cast].find(m => m.id === c.id), M = MODULES[c.id], Rr = RARITY[m.rarity];
    return card({ color: Rr.color, band: 'Upgrade', ic: c.id, icColor: modColor(c.id), name: M.name,
      sub: `${Rr.name} · ${icon(c.cast, '#8b94bb', 14)} ${CASTS[c.cast].name}`, pipsHtml: pips(m.level, Rr.cap, true), text: cardText(c.cast, c.id, m.level + 1), onClick: take });
  }
  const V = VITALS[c.id], n = g.run.vitals[c.id];
  return card({ color: '#8b94bb', band: 'Stat', ic: V.icon || c.id, icColor: '#e8f0ff', name: V.name, sub: `${n} → ${n + 1}`, text: V.text(n), onClick: take });
}

function showOffer() {
  const o = g.run.offers[0], cards = $('offerCards'), foot = $('offerFoot');
  cards.innerHTML = ''; foot.innerHTML = '';
  $('offer').classList.remove('hidden');
  if (o.kind === 'start' || o.kind === 'level') {
    $('offerTitle').innerHTML = o.kind === 'start' ? 'Choose your first module' : o.modules ? `Level ${g.level} · a new module` : `Level ${g.level} · pick one`;
    for (const c of o.cards) cards.appendChild(levelCard(c));
    return;
  }
  // a shard: one module, put it in a cast
  const M = MODULES[o.id], Rr = RARITY[o.rarity];
  $('offerTitle').innerHTML = `${icon('shard', Rr.color, 26)} Shard: <span style="color:${modColor(o.id)}">${M.name}</span> · ${rar(o.rarity)} <span class="csub">levels up to ${Rr.cap}</span>`;
  for (const c of CAST_ORDER) {
    const r = placeResult(g, c, o.id, o.rarity), have = g.run.mods[c].find(m => m.id === o.id);
    const what = { new: allowed(c, o.id) ? cardText(c, o.id, 1) : '',
      promote: `Yours becomes ${Rr.name}: keeps level ${have && have.level}, can reach ${Rr.cap}`,
      level: `Yours goes up: level ${have && have.level} → ${have && have.level + 1}`,
      capped: `Yours is at its cap`, full: `Full: replace one`, no: `Doesn't fit here` }[r];
    const band = { new: 'New module', promote: 'Upgrade', level: 'Upgrade', capped: 'At cap', full: 'Replace', no: "Can't" }[r];
    cards.appendChild(card({ color: r === 'no' || r === 'capped' ? '#2a3360' : Rr.color, band, ic: c, icColor: '#e8f0ff', name: CASTS[c].name,
      sub: slots(g.run.mods[c].length, SLOTS[c]), pipsHtml: have ? pips(have.level, RARITY[have.rarity].cap, r === 'level') : '', text: what,
      disabled: r === 'no' || r === 'capped',
      onClick: () => {
        if (r !== 'full') { place(g, c, o.id, o.rarity); closeOffer(); return; }
        cards.innerHTML = ''; $('offerTitle').innerHTML = `Replace which ${CASTS[c].name} module with ${M.name}?`;
        g.run.mods[c].forEach((m, i) => cards.appendChild(card({ color: RARITY[m.rarity].color, band: 'Goes', ic: m.id, icColor: modColor(m.id),
          name: MODULES[m.id].name, sub: rar(m.rarity), pipsHtml: pips(m.level, RARITY[m.rarity].cap), text: `${M.name} takes its slot at level 1.`,
          onClick: () => { place(g, c, o.id, o.rarity, i); closeOffer(); } })));
        const back = el('button', 'big alt', 'Back'); back.onclick = () => { $('offer').classList.add('hidden'); };
        foot.innerHTML = ''; foot.appendChild(back);
      } }));
  }
  const xp = 3 * (RARITY_ORDER.indexOf(o.rarity) + 1);
  const scrap = el('button', 'big alt', `Scrap it: +${xp} XP`); scrap.onclick = () => { g.xp += xp; closeOffer(); };
  foot.appendChild(scrap);
}

// ---------- build screen ----------
// Practice on: every module free, any level. Practice off: the run's own build, and modules can be moved.
function buildBuild() {
  const grid = $('buildGrid'); grid.innerHTML = '';
  const free = opts.practice || opts.playground;
  $('buildHead').textContent = free ? 'practice: free, any level' : 'this run';
  $('buildClear').classList.toggle('hidden', !free);
  if (!free) {
    const row = el('div', 'casts');
    for (const c of CAST_ORDER) {
      const col = el('div', 'castcol', `<div class="casthead">${icon(c, '#e8f0ff', 20)}<b>${CASTS[c].name}</b>${slots(g.run.mods[c].length, SLOTS[c])}</div>`);
      g.run.mods[c].forEach((m, i) => {
        const M = MODULES[m.id], Rr = RARITY[m.rarity];
        const t = el('div', 'tile', `${icon(m.id, modColor(m.id), 28)}<div class="tbody"><div><b>${M.name}</b> ${rar(m.rarity)}</div>${pips(m.level, Rr.cap)}<div class="ttext">${cardText(c, m.id, m.level)}</div></div>`);
        t.style.setProperty('--rc', Rr.color);
        t.onpointerdown = (ev) => dragTile(ev, t, c, i, m);
        col.appendChild(t);
      });
      for (let k = g.run.mods[c].length; k < SLOTS[c]; k++) col.appendChild(el('div', 'tile empty', 'Empty slot'));
      row.appendChild(col);
    }
    grid.appendChild(row);
    const vit = el('div', 'vitals');
    for (const [k, V] of Object.entries(VITALS)) vit.appendChild(el('span', 'chip' + (g.run.vitals[k] ? ' on' : ''), `${icon(V.icon || k, '#e8f0ff', 14)} ${V.name} ${g.run.vitals[k]}`));
    grid.appendChild(vit);
    $('buildText').innerHTML = 'Drag a module onto another cast to move it. It keeps its level and rarity.';
    return;
  }
  const tbl = el('table', 'ptable'); grid.appendChild(tbl);
  tbl.appendChild(el('tr', null, '<th></th>' + CAST_ORDER.map(c => `<th>${CASTS[c].name}</th>`).join('')));
  for (const id of MODULE_ORDER) {
    const M = MODULES[id], tr = el('tr', null, `<td class="name" style="color:${modColor(id)}">${M.name}</td>`);
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
    tbl.appendChild(tr);
  }
  const lines = [];
  for (const c of CAST_ORDER) for (const id of MODULE_ORDER) {
    const lv = opts.build[c][id]; if (!lv) continue;
    lines.push(`<b>${CASTS[c].name}</b> ${MODULES[id].name} ${lv}: ${cardText(c, id, lv)}`);
  }
  $('buildText').innerHTML = lines.length ? lines.join('<br>') : 'Nothing yet. Any module goes on any cast.';
  g.practice = opts.build; rebuild(g);
}
// Drag a module onto another cast's column to move it (round 5: drag and drop, no "move to" buttons).
function dragTile(ev, tile, from, idx, m) {
  ev.preventDefault();
  const ok = (to) => to !== from && allowed(to, m.id) && g.run.mods[to].length < SLOTS[to] && !g.run.mods[to].some(x => x.id === m.id);
  const cols = [...document.querySelectorAll('.castcol')];
  cols.forEach((col, k) => col.classList.toggle('canDrop', ok(CAST_ORDER[k])));
  const r = tile.getBoundingClientRect(), ghost = tile.cloneNode(true), ox = ev.clientX - r.left, oy = ev.clientY - r.top;
  ghost.classList.add('ghost'); ghost.style.width = r.width + 'px'; document.body.appendChild(ghost);
  const place = (e) => { ghost.style.left = (e.clientX - ox) + 'px'; ghost.style.top = (e.clientY - oy) + 'px'; };
  const over = (e) => cols.findIndex(col => { const b = col.getBoundingClientRect(); return e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top - 20 && e.clientY <= b.bottom + 200; });
  place(ev); tile.classList.add('lifted');
  const move = (e) => { place(e); const k = over(e); cols.forEach((col, j) => col.classList.toggle('hover', j === k && ok(CAST_ORDER[j]))); };
  const up = (e) => {
    removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
    ghost.remove(); const k = over(e), to = CAST_ORDER[k];
    if (k >= 0 && ok(to)) { g.run.mods[from].splice(idx, 1); g.run.mods[to].push(m); rebuild(g); }
    buildBuild();
  };
  addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}
$('openbuild').onclick = () => { $('menu').classList.add('hidden'); $('build').classList.remove('hidden'); buildBuild(); };
$('buildDone').onclick = () => { $('build').classList.add('hidden'); $('menu').classList.remove('hidden'); };
$('buildClear').onclick = () => { opts.build = EMPTY_BUILD(); save(); buildBuild(); };

// Test hook (used to film clips): window.SM
// manual: the page stops running by itself; advance(n) runs n steps and draws (frame-exact films).
window.SM = { get g() { return g; }, inp, opts, restart, R, setPaused: (v) => { paused = v; },
  setManual: (v) => { manual = v; }, lib: { pathField, lineClear, makeEnemy },
  advance: (n = 1) => { for (let i = 0; i < n && !g.over; i++) { step(g, DT, inp); inp.events.length = 0; } R.draw(g, inp, opts); if (g.over && $('over').classList.contains('hidden')) showOver(); },
  setOpt: (k, v) => { opts[k] = v; if (k === 'weapon') setWeapon(g, v); if (k === 'build') { g.practice = v; rebuild(g); } },
  showOffer: () => showOffer(),
  pickOffer: (i = 0) => { const o = g.run.offers[0]; if (!o) return; if (o.kind !== 'chest') { if (o.cards.length) takeLevelCard(g, o.cards[i] || o.cards[0]); }
    else { const c = CAST_ORDER.find(c => ['new', 'promote', 'level'].includes(placeResult(g, c, o.id, o.rarity))); if (c) place(g, c, o.id, o.rarity); } closeOffer(); } };

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');

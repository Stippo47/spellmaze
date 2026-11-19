// A run's build: modules from shards and level-ups, levelled by level-ups, capped by rarity.
// The game reads g.build ({cast: {module: level}}), so everything here ends in rebuild(g).
import { MODULES, MODULE_ORDER, CASTS, CAST_ORDER, allowed } from './modules.js';

export const RARITY = {
  common:    { name: 'Common', cap: 3, color: '#e8f0ff', weight: 60 },
  uncommon:  { name: 'Uncommon', cap: 4, color: '#35f0a0', weight: 25 },
  rare:      { name: 'Rare', cap: 5, color: '#3d8bff', weight: 10 },
  epic:      { name: 'Epic', cap: 7, color: '#b45cff', weight: 4 },
  legendary: { name: 'Legendary', cap: 9, color: '#ffb300', weight: 1 },
};
export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const SLOTS = { weapon: 3, spawn: 2, dash: 2, burst: 2 };
// The casts you brought: your weapon and your 2 abilities (round 11).
export const castsOf = (g) => ['weapon', ...(g.abilities || ['spawn', 'dash'])];
export const MODULE_EVERY = 3;   // every 3rd level-up offers new modules (round 4: "every x upgrades can offer a module")

// You, not a module. Round 4: level-ups felt weak, so bigger steps, and damage + duration join.
export const VITALS = {
  damage:   { name: 'Power', text: () => `+15% damage` },
  health:   { name: 'Health', text: () => `+25 max health, and heal 25` },
  speed:    { name: 'Speed', text: () => `+8% move speed` },
  spawnCd:  { name: 'Spawn cooldown', icon: 'cooldown', text: () => `Spawn comes back 12% sooner`, needs: 'spawn' },
  dashCd:   { name: 'Dash recharge', icon: 'cooldown', text: () => `Dash charges come back 12% sooner`, needs: 'dash' },
  reload:   { name: 'Reload', icon: 'cooldown', text: () => `Rounds come back 12% faster` },
  burstCd:  { name: 'Burst cooldown', icon: 'cooldown', text: () => `Burst comes back 12% sooner`, needs: 'burst' },
  pickup:   { name: 'Pickup', text: () => `Pick up XP from 1.5 cells further` },
};

export function newRun() {
  const vitals = {}; for (const k of Object.keys(VITALS)) vitals[k] = 0;
  return { mods: { weapon: [], spawn: [], dash: [], burst: [] }, vitals, offers: [] };
}

export function rebuild(g) {
  if (g.practice) { g.build = g.practice; return; }
  const b = { weapon: {}, spawn: {}, dash: {}, burst: {} };
  for (const c of CAST_ORDER) for (const m of g.run.mods[c]) b[c][m.id] = m.level;
  g.build = b;
}

// Rarity of a shard: rarer as the run goes on (each minute shifts weight up the ladder).
export function rollRarity(R, minutes) {
  const w = RARITY_ORDER.map((r, i) => RARITY[r].weight * Math.pow(1 + 0.12 * minutes, i));
  let x = R() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) return RARITY_ORDER[i]; }
  return 'common';
}

export function chestOffer(g, rarity) {
  const id = MODULE_ORDER[(g.R() * MODULE_ORDER.length) | 0];
  return { kind: 'chest', id, rarity: rarity || rollRarity(g.R, g.t / 60) };
}

// What putting a found module into a cast would do: 'new', 'promote' (higher rarity: levels kept, cap raised),
// 'level' (same or lower rarity: +1 level up to the cap), 'capped', 'full' (needs a replace) or 'no' (not allowed).
export function placeResult(g, cast, id, rarity) {
  if (!allowed(cast, id)) return 'no';
  const have = g.run.mods[cast].find(m => m.id === id);
  if (have) {
    if (RARITY_ORDER.indexOf(rarity) > RARITY_ORDER.indexOf(have.rarity)) return 'promote';
    return have.level < RARITY[have.rarity].cap ? 'level' : 'capped';
  }
  return g.run.mods[cast].length < SLOTS[cast] ? 'new' : 'full';
}

export function place(g, cast, id, rarity, replaceIdx) {
  const list = g.run.mods[cast], r = placeResult(g, cast, id, rarity);
  const have = list.find(m => m.id === id);
  if (r === 'promote') have.rarity = rarity;
  else if (r === 'level') have.level++;
  else if (r === 'new') list.push({ id, rarity, level: 1 });
  else if (r === 'full' && replaceIdx != null) list[replaceIdx] = { id, rarity, level: 1 };
  else return false;
  rebuild(g);
  return true;
}

// New-module cards: different modules, each already on a cast with a free slot, so one tap takes it.
function newModCards(g, n, rarity) {
  const ids = MODULE_ORDER.slice(), out = [];
  for (let i = ids.length - 1; i > 0; i--) { const j = (g.R() * (i + 1)) | 0; [ids[i], ids[j]] = [ids[j], ids[i]]; }
  for (const id of ids) {
    if (out.length >= n) break;
    const casts = castsOf(g).filter(c => placeResult(g, c, id, 'common') === 'new');
    if (!casts.length) continue;
    out.push({ type: 'new', id, cast: casts[(g.R() * casts.length) | 0], rarity: rarity || rollRarity(g.R, g.t / 60) });
  }
  return out;
}

// The start of a run (round 4: pick 1 of 3 common modules).
export function startOffer(g) { return { kind: 'start', cards: newModCards(g, 3, 'common') }; }

// Level-up: 3 cards. The first level-up offers new modules. After that any card may be a new module (while there's
// room): a small chance, a bigger one every MODULE_EVERY levels (round 5). The rest level what you have, or you.
export function levelOffer(g) {
  if (g.level === 2) { const cards = newModCards(g, 3); if (cards.length >= 2) return { kind: 'level', modules: true, cards }; }
  const chance = (g.level - 2) % MODULE_EVERY === 0 ? 0.6 : 0.15, fresh = newModCards(g, 3);
  const pool = [];
  for (const c of castsOf(g)) for (const m of g.run.mods[c]) if (m.level < RARITY[m.rarity].cap) pool.push({ type: 'mod', cast: c, id: m.id, w: 3 });
  for (const v of Object.keys(VITALS)) if (!VITALS[v].needs || castsOf(g).includes(VITALS[v].needs)) pool.push({ type: 'vital', id: v, w: v.endsWith('Cd') || v === 'reload' ? 0.5 : 1.2 });
  const cards = [];
  while (cards.length < 3) {
    if (fresh.length && (g.R() < chance || !pool.length)) { cards.push(fresh.shift()); continue; }
    if (!pool.length) break;
    let x = g.R() * pool.reduce((a, p) => a + p.w, 0), i = 0;
    for (; i < pool.length - 1; i++) { x -= pool[i].w; if (x <= 0) break; }
    cards.push(pool.splice(i, 1)[0]);
  }
  return { kind: 'level', cards };
}

export function takeLevelCard(g, card) {
  if (card.type === 'new') { place(g, card.cast, card.id, card.rarity); return; }
  if (card.type === 'mod') { const m = g.run.mods[card.cast].find(m => m.id === card.id); if (m) m.level++; rebuild(g); return; }
  g.run.vitals[card.id]++;
  if (card.id === 'health') { g.p.maxHp += 25; g.p.hp = Math.min(g.p.maxHp, g.p.hp + 25); }
}

export function cardText(cast, id, level) { return MODULES[id].on[CASTS[cast].shape](level); }

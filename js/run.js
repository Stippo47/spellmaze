// A run's build: modules found in chests, levelled by level-ups, capped by rarity (stage 3).
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
export const SLOTS = { weapon: 3, spawn: 2, dash: 2 };

// You, not a module (decisions: player upgrades on level-up cards too). Small steps, no caps for now.
export const VITALS = {
  health: { name: 'Health', text: (n) => `+20 max health, and heal 20 (${n} → ${n + 1})` },
  speed: { name: 'Speed', text: (n) => `+7% move speed (${n} → ${n + 1})` },
  cooldown: { name: 'Cooldowns', text: (n) => `Spawn, Dash and reloads 8% faster (${n} → ${n + 1})` },
  pickup: { name: 'Pickup', text: (n) => `Pick up XP from 1 cell further (${n} → ${n + 1})` },
};

export function newRun() {
  return { mods: { weapon: [], spawn: [], dash: [] }, vitals: { health: 0, speed: 0, cooldown: 0, pickup: 0 }, offers: [] };
}

export function rebuild(g) {
  if (g.practice) { g.build = g.practice; return; }
  const b = { weapon: {}, spawn: {}, dash: {} };
  for (const c of CAST_ORDER) for (const m of g.run.mods[c]) b[c][m.id] = m.level;
  g.build = b;
}

// Rarity of a chest: rarer as the run goes on (each minute shifts weight up the ladder).
export function rollRarity(R, minutes) {
  const w = RARITY_ORDER.map((r, i) => RARITY[r].weight * Math.pow(1 + 0.12 * minutes, i));
  let x = R() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) return RARITY_ORDER[i]; }
  return 'common';
}

export function chestOffer(g) {
  const id = MODULE_ORDER[(g.R() * MODULE_ORDER.length) | 0];
  return { kind: 'chest', id, rarity: rollRarity(g.R, g.t / 60) };
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

// Level-up: 4 cards, weighted to modules you have that aren't capped, with vitals mixed in.
export function levelOffer(g) {
  const pool = [];
  for (const c of CAST_ORDER) for (const m of g.run.mods[c]) if (m.level < RARITY[m.rarity].cap) pool.push({ type: 'mod', cast: c, id: m.id, w: 3 });
  for (const v of Object.keys(VITALS)) pool.push({ type: 'vital', id: v, w: 1 });
  const cards = [];
  while (cards.length < 4 && pool.length) {
    let x = g.R() * pool.reduce((a, p) => a + p.w, 0), i = 0;
    for (; i < pool.length - 1; i++) { x -= pool[i].w; if (x <= 0) break; }
    cards.push(pool.splice(i, 1)[0]);
  }
  return { kind: 'level', cards };
}

export function takeLevelCard(g, card) {
  if (card.type === 'mod') { const m = g.run.mods[card.cast].find(m => m.id === card.id); if (m) m.level++; rebuild(g); }
  else {
    g.run.vitals[card.id]++;
    if (card.id === 'health') { g.p.maxHp += 20; g.p.hp = Math.min(g.p.maxHp, g.p.hp + 20); }
  }
}

export function cardText(cast, id, level) { return MODULES[id].on[CASTS[cast].shape](level); }

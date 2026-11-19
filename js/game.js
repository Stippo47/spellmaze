// The simulation: fixed steps, no drawing. Units are maze cells; the player is a 2x2 body (radius 1).
import { makeMaze, makeArena, rayStamp, rayDist, lineClear, pathField, breakTile } from './maze.js';
import { WEAPONS, DASH, SPAWN } from './weapons.js';
import { level, turn, hunt, lunge, burn, blastR, blastDmg, durOf, STATUSES, BUILD, knockOf, CASTS } from './modules.js';
import { newRun, rebuild, chestOffer, levelOffer, startOffer } from './run.js';
import { TAU, rng } from './util.js';

export const SIGHT = 70;          // how far you can see, in cells (round 13: the maze is 2.5x bigger)
const RAYS = 720;
const FIELD_STEPS = 160;

// Stage 4: the first three new enemies (design section 6). Each has its own colour and shape (render.js).
//   dart: when it sees you, stops and aims (a line shows where), then charges straight until a wall.
//   spitter: keeps its distance with you in sight and lobs slow orbs. A dash through an orb deletes it.
//   brute: big, slow, tanky; hard to knock back, and shoves smaller enemies along.
export const ENEMIES = {
  mite:    { r: 1, hp: 20, speed: 6.0, damage: 8, xp: 1, mass: 1 },
  dart:    { r: 1, hp: 26, speed: 5.0, damage: 8, xp: 2, mass: 1, sight: 13, dashDamage: 18, aim: 0.6, dash: {}, dashLength: 9 },   // its charge is the Dash; base 9 (round 7)
  spitter: { r: 1, hp: 30, speed: 4.6, damage: 6, xp: 3, mass: 1, reload: 2.4, orb: { speed: 11, r: 0.55, damage: 10, life: 3 } },
  brute:   { r: 1.7, hp: 170, speed: 3.4, damage: 20, xp: 8, mass: 5, breaks: 35 },
  // The first boss (design: Hulk at 5:00): as wide as a corridor, rolls through the maze shoving everything, armoured
  // in front (a quarter damage), so you route round and hit it from behind. Drops an epic shard.
  hulk:    { r: 3.4, hp: 2400, speed: 11, damage: 35, xp: 60, mass: 60, breaks: 120, armor: 0.25, boss: true },
};

// Camps (decisions: camps in rooms, guarding their shard; different tiers). Nearer rooms get the first tier.
const CAMPS = [{ mite: 5, dart: 2 }, { brute: 1, mite: 4, spitter: 2 }, { brute: 2, spitter: 3, dart: 3 }];

export function newGame(opts) {
  const seed = opts.seed ?? ((Math.random() * 1e9) | 0);
  const g = {
    opts, seed, R: rng(seed ^ 0x9e3779b9), t: 0, over: false, kills: 0, xp: 0, level: 1, depth: 0,
    p: { x: 0, y: 0, r: 1, hp: 100, maxHp: 100, vx: 0, vy: 0, fx: 1, fy: 0, hurtT: 0,
         dashT: 0, dx: 0, dy: 0, charges: DASH.charges, recharge: 0, safeT: 0 },
    weapon: null, ammo: 0, cool: 0, sinceShot: 9, nextId: 1, parts: [], pops: [], boss: null, nextBoss: BOSS_AT,
    run: newRun(), practice: opts.practice || opts.playground ? opts.build : null, build: null, spawnCool: 0, burstCool: 0, spawnAim: null,
    abilities: (opts.abilities || 'spawn,dash').split(','),
    vis: new Float32Array(RAYS * 2), spawnAcc: 0, wave: 0, aim: null, dashAim: null, shake: 0, hurtFlash: 0,
  };
  rebuild(g);
  buildFloor(g, seed);
  g.nextWave = FIRST_WAVE;
  if (!opts.quick) g.run.offers.push({ kind: 'loadout' });   // round 11: weapon + 2 abilities, then the start pick
  else if (!g.practice) g.run.offers.push(startOffer(g));   // pick 1 of 3 to start (round 4)
  setWeapon(g, opts.weapon || 'pistol');
  return g;
}

// A floor: a maze and everything in it. The run (build, level, health, time, boss timer) carries to the next floor.
function buildFloor(g, seed) {
  const m = g.m = g.opts.playground ? makeArena() : makeMaze({ nodes: g.opts.nodes, widths: g.opts.widths, seed });
  Object.assign(g, {
    enemies: [], bolts: [], balls: [], blasts: [], gems: [], shots: [], camps: [], ghosts: [], echoes: [], bombs: [], later: [], corpses: [], beams: [], tileFlash: new Map(), clouds: [], arcs: [],
    chests: [], keys: 0, keysOnFloor: [], clearT: 0, boss: null, rings: [], hearts: [],
    seen: new Float32Array(m.G * m.G), // when each cell was last in view (+1; 0 = never)
    visStamp: new Uint32Array(m.G * m.G), visNow: 0, field: new Uint16Array(m.G * m.G), fieldT: 0,
    waveWarn: null, incoming: null, ring: [],
  });
  g.p.x = m.start.x; g.p.y = m.start.y; g.p.vx = g.p.vy = 0; g.p.dashT = 0;
  if (!m.arena) { placeChests(g); placeCamps(g); placeKeys(g); }
  refreshField(g);
  updateSight(g);
}

// Keys (round 8: "no door, just collect 4 keys", and they needn't be the farthest). Four camps, picked at random, each
// have a keeper (their toughest, +50% health, ringed gold) who drops a key. Too few camps: the rest lie in dead ends.
// The fourth key clears the floor.
export const KEYS = 4;
function placeKeys(g) {
  const camps = g.camps.slice();
  for (let i = camps.length - 1; i > 0; i--) { const j = (g.R() * (i + 1)) | 0; [camps[i], camps[j]] = [camps[j], camps[i]]; }
  let placed = 0;
  for (const c of camps) {
    if (placed >= KEYS) break;
    let keeper = null;
    for (const e of g.enemies) if (e.camp === c && (!keeper || e.maxHp > keeper.maxHp)) keeper = e;
    if (keeper) { keeper.key = true; keeper.maxHp = keeper.hp = keeper.maxHp * 1.5; placed++; }
  }
  const ends = g.m.deadEnds.filter(d => Math.hypot(d.x - g.m.start.x, d.y - g.m.start.y) > 75);
  while (placed < KEYS && ends.length) { const d = ends.splice((g.R() * ends.length) | 0, 1)[0]; g.keysOnFloor.push({ x: d.x, y: d.y }); placed++; }
}

// The next floor: a new maze, harder, the wave timer starts again.
function nextFloor(g) {
  g.depth++;
  buildFloor(g, (g.seed + g.depth * 7919) | 0);
  g.nextWave = g.t + FIRST_WAVE; g.wave = 0;
  g.pops.push({ text: `Floor ${g.depth + 1}`, t: 0, big: true });
}

// Shards (round 3 answer, as chests): one in four dead ends, and one in each room. None in practice.
function placeChests(g) {
  if (g.practice) return;
  const m = g.m, s = m.start;
  for (const d of m.deadEnds) if (Math.hypot(d.x - s.x, d.y - s.y) > 40 && g.R() < 0.6) g.chests.push({ x: d.x, y: d.y });
  for (let j = 0; j < m.N; j++) for (let i = 0; i < m.N; i++) { // round 13: "more chests throughout": some at corridor crossings too
    const x = m.cxs[i], y = m.cys[j];
    if (g.R() < 0.07 && Math.hypot(x - s.x, y - s.y) > 40 && m.clear[Math.floor(y) * m.G + Math.floor(x)] && !g.chests.some(c => c.x === x && c.y === y)) g.chests.push({ x, y });
  }
  for (const h of m.halls) g.chests.push({ x: h.x, y: h.y, hall: true });
}

function placeCamps(g) {
  const m = g.m, s = m.start;
  const rooms = m.halls.map(r => ({ r, d: Math.hypot(r.x - s.x, r.y - s.y) })).filter(o => o.d > 24).sort((a, b) => a.d - b.d);
  rooms.forEach(({ r }, k) => {
    const tier = Math.min(2, Math.floor(k / rooms.length * 3)), camp = { tier, x: r.x, y: r.y, box: r.box };
    g.camps.push(camp);
    for (const [type, n] of Object.entries(CAMPS[tier])) for (let i = 0; i < n; i++) for (let t = 0; t < 40; t++) {
      const a = g.R() * TAU, rad = 6 + g.R() * 14, x = Math.floor(r.x + Math.cos(a) * rad) + 0.5, y = Math.floor(r.y + Math.sin(a) * rad) + 0.5;
      if (!m.clear[Math.floor(y) * m.G + Math.floor(x)] || x < r.box.x0 || x > r.box.x1 || y < r.box.y0 || y > r.box.y1) continue;
      makeEnemy(g, type, x, y, { camp, sleep: true, home: { x, y } });
      break;
    }
  });
}
function wakeCamp(g, camp) { for (const e of g.enemies) if (e.camp === camp) e.sleep = false; }

export function makeEnemy(g, type, x, y, extra) {
  const s = ENEMIES[type];
  const hp = s.hp * (1 + 0.25 * (g.depth || 0));   // each floor: +25% health
  const e = { id: g.nextId++, type, x, y, r: s.r, hp, maxHp: hp, speed: s.speed * (0.9 + g.R() * 0.2), vx: 0, vy: 0, flash: 0,
    fx: 1, fy: 0, cd: 0.5 + g.R() * 1.5, st: null, t: 0, ...extra };
  g.enemies.push(e);
  if (!extra || !extra.sleep) { e.born = 0.25; }   // round 12: arrives growing in from nothing
  return e;
}

function hurtPlayer(g, dmg) {
  const p = g.p;
  p.hp -= dmg; p.hurtT = 0.5; g.shake = Math.max(g.shake, 0.5); g.hurtFlash = 0.35; burst(g, p.x, p.y, 'hp', 6);
  if (p.hp <= 0) { p.hp = 0; g.over = true; burst(g, p.x, p.y, 'player', 30); }
}

// round 7: each stat card changes one trait. Cooldowns are three: spawn, dash recharge, reload.
const cdMul = (g, k) => Math.pow(0.88, g.run.vitals[k] || 0);
export const pickupRange = (g) => 3.5 + 1.5 * g.run.vitals.pickup;
const dmgMul = (g) => 1 + 0.15 * g.run.vitals.damage;
export const dashLen = (g, a = g.p) => (a === g.p || a.mine ? DASH.length : ENEMIES[a.type].dashLength || DASH.length) * durOf(dashMods(g, a).duration || 0) * (1 + 0.1 * (dashMods(g, a).haste || 0));

export function setWeapon(g, id) { g.weapon = WEAPONS[id]; g.weaponId = id; CASTS.weapon.shape = g.weapon.beam ? 'beam' : 'bolt'; g.ammo = g.weapon.rounds; g.cool = 0; g.reloadT = 0; }

// ---------- collision ----------
function pushOutOfWalls(m, b) {
  const G = m.G, r = b.r;
  const x0 = Math.floor(b.x - r), x1 = Math.floor(b.x + r), y0 = Math.floor(b.y - r), y1 = Math.floor(b.y + r);
  let hit = false;
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    if (cx >= 0 && cy >= 0 && cx < G && cy < G && !m.cells[cy * G + cx]) continue;
    const nx = Math.max(cx, Math.min(b.x, cx + 1)), ny = Math.max(cy, Math.min(b.y, cy + 1));
    let dx = b.x - nx, dy = b.y - ny; const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 1e-9) { const d = Math.sqrt(d2), k = (r - d) / d; b.x += dx * k; b.y += dy * k; }
    else { // centre inside the cell: out along the shallowest side
      const l = b.x - cx, rr = cx + 1 - b.x, t = b.y - cy, bb = cy + 1 - b.y, mn = Math.min(l, rr, t, bb);
      if (mn === l) b.x = cx - r; else if (mn === rr) b.x = cx + 1 + r; else if (mn === t) b.y = cy - r; else b.y = cy + 1 + r;
    }
  }
  return hit;
}

function moveBody(m, b, dx, dy) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 0.4));
  let hit = false;
  for (let i = 0; i < steps; i++) { b.x += dx / steps; b.y += dy / steps; hit = pushOutOfWalls(m, b) || hit; }
  return hit;
}

// Like moveBody, and says which way the walls pushed (the wall's normal, summed).
function moveBodyN(m, b, dx, dy) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 0.4));
  let hit = false, nx = 0, ny = 0;
  for (let i = 0; i < steps; i++) {
    b.x += dx / steps; b.y += dy / steps;
    const x = b.x, y = b.y;
    if (pushOutOfWalls(m, b)) { hit = true; nx += b.x - x; ny += b.y - y; }
  }
  return { hit, nx, ny };
}

// ---------- sight ----------
function updateSight(g) {
  const p = g.p, m = g.m, now = ++g.visNow;
  for (let i = 0; i < RAYS; i++) {
    const a = i / RAYS * TAU, dx = Math.cos(a), dy = Math.sin(a);
    const d = rayStamp(m, p.x, p.y, dx, dy, SIGHT, now, g.visStamp, g.seen, g.t + 1);
    g.vis[i * 2] = p.x + dx * d; g.vis[i * 2 + 1] = p.y + dy * d;
  }
}

export function canSee(g, x, y) {
  const p = g.p, d = Math.hypot(x - p.x, y - p.y);
  return d <= SIGHT && lineClear(g.m, p.x, p.y, x, y);
}

function nearestVisible(g, range) {
  let best = null, bd = range;
  for (const e of g.enemies) {
    const d = Math.hypot(e.x - g.p.x, e.y - g.p.y);
    if (d < bd && lineClear(g.m, g.p.x, g.p.y, e.x, e.y)) { bd = d; best = e; }
  }
  return best;
}

// ---------- modules ----------
const L = (g, cast, id) => level(g.build, cast, id);

// ---------- statuses (stage 4: design section 5; poison is purple) ----------
// Each hit adds build-up; at 100 something bigger happens. Payload modules carry them, on any cast.
// Mixes: Thaw (burn on a chilled or frozen enemy clears both for a burst), Ignite (fire in a gas cloud explodes it),
// Conduct (shock arcs prefer marked enemies and reach twice as far to them).
const payloadOf = (mods) => { let pay = null; for (const s of STATUSES) if (mods[s]) (pay = pay || {})[s] = BUILD[s](mods[s]); return pay; };
function payload(g, cast) { return payloadOf(g.build[cast] || {}); }
function applyPayload(g, e, pay, scale = 1) {
  if (!pay || e.hp <= 0) return;
  if (pay.mark) addMark(g, e, pay.mark * scale);
  if (pay.burn) addBurn(g, e, pay.burn * scale);
  if (pay.chill) addChill(g, e, pay.chill * scale);
  if (pay.poison) addPoison(g, e, pay.poison * scale);
  if (pay.shock) addShock(g, e, pay.shock * scale);
}

// After a burst (Flare, Freeze, Overload, Rot, Detonate) that status can't burst again for REST seconds.
const REST = 5;
const full = (e, k) => e.rest && e.rest[k] > 0;
const rested = (e, k) => { (e.rest = e.rest || {})[k] = REST; };
function addBurn(g, e, amt) {
  if (e.hp <= 0) return;
  if ((e.chill || 0) > 30 || e.frozen > 0) { // Thaw
    e.chill = 0; e.frozen = 0; hurt(g, e, 25, 0, 0); burst(g, e.x, e.y, 'chill', 8); return;
  }
  e.burn = (e.burn || 0) + amt; e.burnIdle = 0;
  for (const c of g.clouds) if (!c.boom && Math.hypot(e.x - c.x, e.y - c.y) < c.r) { // Ignite
    c.boom = true; blast(g, c.x, c.y, c.r + 1.5, 30, { burn: 25 });
  }
  if (full(e, 'burn')) e.burn = Math.min(e.burn, 95);
  else if (e.burn >= 100) { // Flare: a big hit and a small fire blast
    e.burn = 20; rested(e, 'burn'); hurt(g, e, 25, 0, 0);
    blast(g, e.x, e.y, 2.5, 6, { burn: 30 });
  }
}
function addChill(g, e, amt) {
  if (e.hp <= 0 || e.frozen > 0) return;
  e.chill = (e.chill || 0) + amt; e.chillIdle = 0;
  if (full(e, 'chill')) e.chill = Math.min(e.chill, 95);
  else if (e.chill >= 100) { e.frozen = 2; e.chill = 0; rested(e, 'chill'); e.dashT = 0; }   // Freeze
}
function addPoison(g, e, amt) {
  if (e.hp <= 0) return;
  e.poison = (e.poison || 0) + amt; e.poisonIdle = 0;
  if (full(e, 'poison')) e.poison = Math.min(e.poison, 95);
  else if (e.poison >= 100) { e.poison = 30; rested(e, 'poison'); hurt(g, e, e.maxHp * (ENEMIES[e.type].boss ? 0.03 : 0.15) / dmgMul(g), 0, 0); burst(g, e.x, e.y, 'poison', 8); }   // Rot
}
function addMark(g, e, amt) {
  if (e.hp <= 0) return;
  e.mark = (e.mark || 0) + amt; e.markIdle = 0;
  if (full(e, 'mark')) e.mark = Math.min(e.mark, 95);
  else if (e.mark >= 100) { e.mark = 0; rested(e, 'mark'); hurt(g, e, 45, 0, 0); g.blasts.push({ x: e.x, y: e.y, r: 2.2, t: 0, col: 'mark' }); }   // Detonate
}
function addShock(g, e, amt) {
  if (e.hp <= 0) return;
  e.shock = (e.shock || 0) + amt; e.shockIdle = 0;
  if (full(e, 'shock')) e.shock = Math.min(e.shock, 95);
  if (e.shock >= 100) { e.shock = 0; rested(e, 'shock'); e.stun = 0.6; arc(g, e, 3, 6, 6); }   // Overload
  else arc(g, e, 1, 5, 3);
}
// Shock jumps: to the n nearest others in sight (marked ones count as half as far: Conduct).
function arc(g, from, n, range, dmg) {
  const c = [];
  for (const o of g.enemies) {
    if (o === from || o.hp <= 0 || o.sleep) continue;
    let d = Math.hypot(o.x - from.x, o.y - from.y); if (o.mark > 0) d /= 2;
    if (d < range && lineClear(g.m, from.x, from.y, o.x, o.y)) c.push({ o, d });
  }
  c.sort((a, b) => a.d - b.d);
  for (const { o } of c.slice(0, n)) { g.arcs.push({ x0: from.x, y0: from.y, x1: o.x, y1: o.y, t: 0 }); hurt(g, o, dmg, 0, 0, 0); }
}
// Once a step: damage over time, fading build-up, freezes and stuns wearing off, gas clouds.
function stepStatuses(g, dt) {
  for (const e of g.enemies) {
    if (e.burn > 0) { // burning: damage over time, stronger with more build-up; fades when not fed
      hurt(g, e, (2 + e.burn * 0.08) * dt, 0, 0, 0, true);
      e.burnIdle += dt; if (e.burnIdle > 2) e.burn = Math.max(0, e.burn - 12 * dt);
    }
    if (e.poison > 0) { // slow damage over time
      hurt(g, e, (1 + e.poison * 0.05) * dt, 0, 0, 0, true);
      e.poisonIdle += dt; if (e.poisonIdle > 4) e.poison = Math.max(0, e.poison - 6 * dt);
    }
    if (e.chill > 0) { e.chillIdle += dt; if (e.chillIdle > 2) e.chill = Math.max(0, e.chill - 15 * dt); }
    if (e.shock > 0) { e.shockIdle += dt; if (e.shockIdle > 2) e.shock = Math.max(0, e.shock - 20 * dt); }
    if (e.mark > 0) { e.markIdle += dt; if (e.markIdle > 6) e.mark = 0; }
    if (e.frozen > 0) e.frozen -= dt;
    if (e.stun > 0) e.stun -= dt;
    if (e.rest) for (const k in e.rest) e.rest[k] -= dt;
    if (e.clang > 0) e.clang -= dt;
  }
  for (let i = g.clouds.length - 1; i >= 0; i--) {
    const c = g.clouds[i]; c.t += dt;
    if (c.boom || c.t > c.life) { g.clouds.splice(i, 1); continue; }
    for (const e of g.enemies) if (Math.hypot(e.x - c.x, e.y - c.y) < c.r) { e.poison = (e.poison || 0) + 15 * dt; e.poisonIdle = 0; }
    if (g.R() < dt * 12) { const a = g.R() * TAU, rr = Math.sqrt(g.R()) * c.r * 0.9; // lingering motes (round 11: softer: fewer, round, fade in and out)
      g.parts.push({ x: c.x + Math.cos(a) * rr, y: c.y + Math.sin(a) * rr, vx: (g.R() - 0.5) * 0.4, vy: -0.25 - g.R() * 0.3, life: 2.4, max: 2.4, col: 'mote', s: 0.32, drift: true }); }
  }
  for (let i = g.arcs.length - 1; i >= 0; i--) { g.arcs[i].t += dt; if (g.arcs[i].t > 0.15) g.arcs.splice(i, 1); }
}

// A blast: hits every enemy inside that the blast can see (walls block it). Yours never hurt you.
function blast(g, x, y, r, dmg, pay, o = {}) {
  g.blasts.push({ x, y, r, t: 0, col: pay ? STATUSES.find(k => pay[k]) : null });
  g.rings.push({ x, y, r0: r * 0.5, r1: r * 1.25, t: 0, life: 0.3, c: '#ffffff' }); g.shake = Math.max(g.shake, Math.min(0.45, r * 0.08)); burst(g, x, y, 'shot', 6);
  for (const i of tilesNear(g, x, y, r)) hitTile(g, i, dmg * 1.5);
  for (const e of g.enemies) {
    if (e.hp <= 0) continue;
    const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy);
    if (d > r + e.r || (!o.walls && !lineClear(g.m, x, y, e.x, e.y))) continue;
    hurt(g, e, dmg, dx, dy, o.knock ?? 0.6);
    applyPayload(g, e, pay);
  }
}

function nearestEnemy(g, x, y, range, dirx, diry, cone) {
  let best = null, bd = range;
  for (const e of g.enemies) {
    if (e.hp <= 0) continue;
    const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy);
    if (d >= bd) continue;
    if (cone != null && (dx * dirx + dy * diry) / (d || 1) < cone) continue;
    if (!lineClear(g.m, x, y, e.x, e.y)) continue;
    bd = d; best = e;
  }
  return best;
}

// ---------- the Weapon cast: bolts ----------
function fire(g, ax, ay) {
  const w = g.weapon;
  if (w.beam) return false;   // the Laser fires in stepBeam
  if (g.ammo < 1 || g.cool > 0) return false;
  g.reloadT = 0;
  g.ammo -= 1; g.cool = w.cooldown; g.sinceShot = 0; g.flashT = 0.06;
  const n = (w.pellets || 1) + L(g, 'weapon', 'extra'), base = Math.atan2(ay, ax) + (g.R() - 0.5) * 2 * w.spread;
  const pay = payload(g, 'weapon'), bounces = L(g, 'weapon', 'bounce'), home = L(g, 'weapon', 'home'), ex = L(g, 'weapon', 'explode');
  const grow = L(g, 'weapon', 'grow'), speed = w.speed * (1 + 0.15 * L(g, 'weapon', 'haste'));
  for (let i = 0; i < n; i++) {
    const a = base + (i - (n - 1) / 2) * (w.fan || 0.16), dx = Math.cos(a), dy = Math.sin(a);
    g.bolts.push({ x: g.p.x + dx * 0.9, y: g.p.y + dy * 0.9, vx: dx * speed, vy: dy * speed, r: w.radius * (1 + 0.3 * grow),
      dmg: w.damage * (1 + 0.1 * grow), left: w.range * durOf(L(g, 'weapon', 'duration')), bounces, home, pay, ex,
      pierce: (w.pierce || 0) + L(g, 'weapon', 'pierce'), budget: !!w.budget, split: L(g, 'weapon', 'split'), knock: L(g, 'weapon', 'knock'), hit: null });
  }
  g.p.fx = Math.cos(base); g.p.fy = Math.sin(base);
  return true;
}

function boltEnd(g, b, x, y, hitE) {
  if (b.ex) blast(g, x, y, blastR(b.ex), blastDmg(b.ex), b.pay);
  if (b.split && !b.child) { // Split: two weaker bolts fork off, 0.5 rad either side
    const sp = Math.hypot(b.vx, b.vy) || 1, a0 = Math.atan2(b.vy, b.vx), k = 0.3 + 0.1 * b.split;
    for (const s of [-0.5, 0.5]) { const a = a0 + s; g.bolts.push({ ...b, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: b.dmg * k, r: b.r * 0.8,
      left: 6, child: true, split: 0, ex: 0, bounces: 0, hit: hitE ? new Set([...(b.hit || []), hitE]) : b.hit ? new Set(b.hit) : null }); }
  }
}

function stepBolts(g, dt) {
  const m = g.m, G = m.G;
  for (let i = g.bolts.length - 1; i >= 0; i--) {
    const b = g.bolts[i];
    if (b.home) { // turn toward the nearest enemy ahead
      if (!b.tg || b.tg.hp <= 0 || (g.frame + i) % 6 === 0) {
        const sp = Math.hypot(b.vx, b.vy); b.tg = nearestEnemy(g, b.x, b.y, 12, b.vx / sp, b.vy / sp, 0.25);
      }
      if (b.tg) {
        const sp = Math.hypot(b.vx, b.vy), cur = Math.atan2(b.vy, b.vx);
        let want = Math.atan2(b.tg.y - b.y, b.tg.x - b.x) - cur; want = Math.atan2(Math.sin(want), Math.cos(want));
        const a = cur + Math.max(-turn(b.home) * dt, Math.min(turn(b.home) * dt, want));
        b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
      }
    }
    let dead = false;
    for (let s = 0; s < 3 && !dead; s++) {
      const ox = b.x, oy = b.y;
      b.x += b.vx * dt / 3; b.y += b.vy * dt / 3; b.left -= Math.hypot(b.vx, b.vy) * dt / 3;
      if (m.cells[Math.floor(b.y) * G + Math.floor(b.x)]) {
        const ti = Math.floor(b.y) * G + Math.floor(b.x);
        if (m.cells[ti] === 2) hitTile(g, ti, b.dmg);
        if (b.bounces > 0) { // reflect off the side it crossed
          b.bounces--;
          const hx = m.cells[Math.floor(oy) * G + Math.floor(b.x)], hy = m.cells[Math.floor(b.y) * G + Math.floor(ox)];
          if (hx || !hy) b.vx = -b.vx;
          if (hy || !hx) b.vy = -b.vy;
          b.x = ox; b.y = oy; burst(g, ox, oy, 'shot', 2);
        } else { dead = true; burst(g, ox, oy, 'shot', 3); boltEnd(g, b, ox, oy); break; }
      }
      for (const e of g.enemies) {
        if (e.hp <= 0) continue;
        const dx = e.x - b.x, dy = e.y - b.y;
        if (dx * dx + dy * dy < (e.r + b.r) ** 2) {
          if (b.hit && b.hit.has(e)) continue;
          if (b.budget) { // round 10: the Rail spends what it needs on each enemy, and goes on with the rest
            const mul = dmgMul(g) * (e.mark > 0 ? 1.25 : 1), deal = Math.min(b.dmg, e.hp / mul + 0.01);
            hurt(g, e, deal, b.vx, b.vy, b.knock ? knockOf(b.knock) : 0.25); applyPayload(g, e, b.pay);
            b.dmg -= deal; if (b.dmg > 0.5) { (b.hit = b.hit || new Set()).add(e); continue; }
            dead = true; boltEnd(g, b, b.x, b.y, e); break;
          }
          hurt(g, e, b.dmg, b.vx, b.vy, b.knock ? knockOf(b.knock) : 0.25); applyPayload(g, e, b.pay);
          if (b.pierce > 0) { b.pierce--; (b.hit = b.hit || new Set()).add(e); continue; }   // Pierce: on through
          dead = true; boltEnd(g, b, b.x, b.y, e); break;
        }
      }
      if (!dead && b.left <= 0) { dead = true; boltEnd(g, b, b.x, b.y); }
    }
    if (dead) g.bolts.splice(i, 1);
  }
}

// ---------- the Spawn cast: balls ----------
function throwBall(g, ax, ay) {
  if (g.spawnCool > 0) return;
  const haste = L(g, 'spawn', 'haste'), grow = L(g, 'spawn', 'grow');
  g.spawnCool = SPAWN.cooldown * cdMul(g, 'spawnCd') * Math.max(0.3, 1 - 0.08 * haste);
  const n = 1 + L(g, 'spawn', 'extra'), base = Math.atan2(ay, ax), speed = SPAWN.speed * (1 + 0.2 * haste) * (1 - 0.06 * grow);
  for (let i = 0; i < n; i++) {
    const a = base + (i - (n - 1) / 2) * 0.35, dx = Math.cos(a), dy = Math.sin(a), hp = SPAWN.hp * (1 + 0.25 * grow);
    g.balls.push({ x: g.p.x + dx * 1.2, y: g.p.y + dy * 1.2, vx: dx * speed, vy: dy * speed, r: SPAWN.r * (1 + 0.15 * grow),
      hp, maxHp: hp, decay: hp / (SPAWN.life * durOf(L(g, 'spawn', 'duration'))), hurtT: 0, cd: new Map(),
      bounces: L(g, 'spawn', 'bounce'), home: L(g, 'spawn', 'home'), pay: payload(g, 'spawn'), ex: L(g, 'spawn', 'explode'),
      pierce: L(g, 'spawn', 'pierce'), split: L(g, 'spawn', 'split'), knock: L(g, 'spawn', 'knock') });
  }
}

function stepBalls(g, dt) {
  const m = g.m;
  for (let i = g.balls.length - 1; i >= 0; i--) {
    const b = g.balls[i];
    b.hp -= b.decay * dt; b.hurtT -= dt;   // wears down over its life (round 4)
    let hunting = false;
    if (b.home) {
      if (!b.tg || b.tg.hp <= 0 || (g.frame + i) % 10 === 0) b.tg = nearestEnemy(g, b.x, b.y, 14);
      if (b.tg) {
        hunting = true;
        const dx = b.tg.x - b.x, dy = b.tg.y - b.y, d = Math.hypot(dx, dy) || 1, k = Math.min(1, dt * 4);
        b.vx += (dx / d * hunt(b.home) - b.vx) * k; b.vy += (dy / d * hunt(b.home) - b.vy) * k;
      }
    }
    const sp = Math.hypot(b.vx, b.vy);
    if (!hunting && !(b.bounces > 0 && sp > 6)) { const f = Math.exp(-SPAWN.drag * dt); b.vx *= f; b.vy *= f; }
    const r = moveBodyN(m, b, b.vx * dt, b.vy * dt);
    if (r.hit) {
      const nl = Math.hypot(r.nx, r.ny);
      if (nl > 1e-6) {
        const nx = r.nx / nl, ny = r.ny / nl, vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          if (b.bounces > 0 && sp > 3) { b.bounces--; b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny; burst(g, b.x, b.y, 'shot', 3); }
          else if (!hunting) { b.vx = (b.vx - vn * nx) * 0.3; b.vy = (b.vy - vn * ny) * 0.3; }
        }
      }
    }
    // contact: harder the faster it goes
    const speed = Math.hypot(b.vx, b.vy);
    for (const e of g.enemies) {
      if (e.hp <= 0) continue;
      const dx = e.x - b.x, dy = e.y - b.y, d = Math.hypot(dx, dy);
      if (d > b.r + e.r + 0.1) continue;
      if (g.t >= (b.cd.get(e) || 0)) {
        b.cd.set(e, g.t + 0.35);
        hurt(g, e, SPAWN.contact + 2 * (b.pierce || 0) + speed * SPAWN.speedDamage, dx, dy, b.knock ? knockOf(b.knock) : speed > 6 ? 1.2 : 0.3); applyPayload(g, e, b.pay);
      }
      if (b.hurtT <= 0 && !b.pierce) { b.hp -= ENEMIES[e.type].damage; b.hurtT = 0.4; }
    }
    if (b.hp <= 0) {
      burst(g, b.x, b.y, 'player', 10);
      if (b.ex) blast(g, b.x, b.y, blastR(b.ex) + 1, blastDmg(b.ex) * 2, b.pay);
      g.balls.splice(i, 1);
      if (b.split && !b.child) for (const s of [-1, 1]) { // Split: two small balls
        const hp = b.maxHp * (0.3 + 0.1 * b.split), a = g.R() * TAU;
        g.balls.push({ ...b, x: b.x + Math.cos(a) * s, y: b.y + Math.sin(a) * s, vx: Math.cos(a) * 8 * s, vy: Math.sin(a) * 8 * s, r: b.r * 0.7,
          hp, maxHp: hp, child: true, split: 0, ex: 0, cd: new Map(), tg: null });
      }
    }
  }
}

// ---------- breakable tiles (round 6: one cell each) ----------
function tilesNear(g, x, y, r) {
  const m = g.m, G = m.G, out = [];
  for (let cy = Math.floor(y - r); cy <= Math.floor(y + r); cy++) for (let cx = Math.floor(x - r); cx <= Math.floor(x + r); cx++) {
    if (cx < 0 || cy < 0 || cx >= G || cy >= G || m.cells[cy * G + cx] !== 2) continue;
    const nx = Math.max(cx, Math.min(x, cx + 1)), ny = Math.max(cy, Math.min(y, cy + 1));
    if (Math.hypot(x - nx, y - ny) <= r) out.push(cy * G + cx);
  }
  return out;
}
function hitTile(g, i, dmg, quiet) {
  const m = g.m; if (m.cells[i] !== 2) return;
  m.bhp[i] -= dmg; if (!quiet) g.tileFlash.set(i, 0.08);
  if (m.bhp[i] <= 0) {
    breakTile(m, i); g.fieldT = 0;   // enemies find the new way at once
    const x = (i % m.G) + 0.5, y = ((i / m.G) | 0) + 0.5;
    for (let k = 0; k < 4; k++) { const a = g.R() * TAU, s = 3 + g.R() * 6; g.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4, max: 0.4, col: 'tile', s: 0.4 }); }
  }
}

// ---------- enemy orbs ----------
// A dash through an orb deletes it (decisions: the base Dash deletes enemy bullets). Spawns block them.
function stepShots(g, dt) {
  const m = g.m, p = g.p;
  for (let i = g.shots.length - 1; i >= 0; i--) {
    const s = g.shots[i];
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    let dead = s.life <= 0 || m.cells[Math.floor(s.y) * m.G + Math.floor(s.x)];
    if (!dead && Math.hypot(p.x - s.x, p.y - s.y) < p.r + s.r + (p.dashT > 0 ? 0.7 : 0)) {
      dead = true;
      if (p.dashT > 0) burst(g, s.x, s.y, 'dash', 8);
      else if (p.safeT <= 0 && p.hurtT <= 0) hurtPlayer(g, s.dmg);
    }
    if (!dead) for (const b of g.balls) if (Math.hypot(b.x - s.x, b.y - s.y) < b.r + s.r) { b.hp -= s.dmg; dead = true; break; }
    if (dead) { if (!(p.dashT > 0)) burst(g, s.x, s.y, 'orb', 4); g.shots.splice(i, 1); }
  }
}

// ---------- Auto (round 13) ----------
// Every weapon fires at the nearest enemy you can see; Spawn and Burst throw themselves at it when ready; Dash dodges
// when something is about to touch you (where you're steering, or away from it). Touching the fire stick takes over.
function autoAct(g, inp) {
  const p = g.p, w = g.weapon, e = nearestVisible(g, w.range * (w.beam ? 1 : 0.95));
  if (e) {
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
    if (w.beam) g.aim = { x: dx / d, y: dy / d }; else fire(g, dx, dy);
  }
  for (const id of g.abilities) {
    if (id === 'spawn' && g.spawnCool <= 0) { const t = nearestVisible(g, 12); if (t) throwBall(g, t.x - p.x, t.y - p.y); }
    if (id === 'burst' && g.burstCool <= 0) { const t = nearestVisible(g, burstReach(g)); if (t) throwBomb(g, t.x - p.x, t.y - p.y, 1, Math.hypot(t.x - p.x, t.y - p.y)); }
    if (id === 'dash' && p.charges >= 1 && p.dashT <= 0 && p.safeT <= 0 && p.hurtT <= 0) {
      let near = null, nd = 1e9;
      for (const o of g.enemies) { if (o.sleep) continue; const d = Math.hypot(o.x - p.x, o.y - p.y) - o.r - p.r; if (d < nd) { nd = d; near = o; } }
      for (const s of g.shots) { const d = Math.hypot(s.x - p.x, s.y - p.y) - p.r; if (d < 1.5 && d < nd) { nd = d; near = s; } }
      if (near && nd < 1.2) {
        const mv = Math.hypot(inp.move.x, inp.move.y) > 0.3;
        startDash(g, p, mv ? inp.move.x : p.x - near.x, mv ? inp.move.y : p.y - near.y);
      }
    }
  }
}

// ---------- the Laser: a held beam (round 11: "Laser is a weapon") ----------
// While you hold the fire stick it drains its charge and burns everything on its line. Modules work on its shape
// (beam): Pierce burns through enemies, Bounce reflects off walls, Extra fans more beams, Split forks it partway, Home
// bends it onto a nearby enemy, payloads build slower (a beam's hits are many and small: decisions).
const BW = (g, id) => L(g, 'weapon', id);
function stepBeam(g, dt) {
  const w = g.weapon, p = g.p;
  g.beams.length = 0;
  if (!g.aim || g.ammo < 0.5) { g.beamHeld = 0; g.beamAng = null; return; }
  g.ammo = Math.max(0, g.ammo - w.drain * dt); g.sinceShot = 0; g.reloadT = 0;
  // round 12: "should take time to turn, adds drag; starts weak and builds up the longer it's held, to a peak"
  const want = Math.atan2(g.aim.y, g.aim.x);
  if (g.beamAng == null) g.beamAng = want;
  let df = want - g.beamAng; df = Math.atan2(Math.sin(df), Math.cos(df));
  if ((g.beamHeld || 0) < 0.12) g.beamAng = want;   // round 13: starting up again, it points straight at the aim
  else g.beamAng += Math.max(-w.turn * dt, Math.min(w.turn * dt, df));
  g.beamHeld = Math.min(w.rampTime, (g.beamHeld || 0) + dt);
  const power = 0.3 + 0.7 * (g.beamHeld / w.rampTime);   // 30% at first, full after rampTime
  g.beamPower = power;
  let a0 = g.beamAng;
  if (BW(g, 'home')) { const e = nearestEnemy(g, p.x, p.y, w.range, Math.cos(a0), Math.sin(a0), Math.cos(0.15 + 0.06 * BW(g, 'home'))); if (e) a0 = Math.atan2(e.y - p.y, e.x - p.x); }
  const n = 1 + BW(g, 'extra'), grow = BW(g, 'grow');
  const reach = w.range * durOf(BW(g, 'duration')) * (1 + 0.15 * BW(g, 'haste'));
  const b = { width: w.radius * 2 * (1 + 0.3 * grow) * (0.5 + 0.5 * power), dps: w.damage * (1 + 0.1 * grow) * power, pierce: BW(g, 'pierce'), bounces: BW(g, 'bounce'),
    split: BW(g, 'split'), knock: BW(g, 'knock'), pay: payload(g, 'weapon'), ex: BW(g, 'explode') };
  g.beamExT = (g.beamExT || 0) - dt;
  const exNow = b.ex && g.beamExT <= 0; if (exNow) g.beamExT = 0.5;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i - (n - 1) / 2) * 0.18;
    traceBeam(g, p.x + Math.cos(a) * 1.1, p.y + Math.sin(a) * 1.1, Math.cos(a), Math.sin(a), reach, b, 1, dt, exNow, !b.split);
  }
  p.fx = Math.cos(a0); p.fy = Math.sin(a0);
}
// One beam: straight lines, reflecting off walls while it has bounces, stopping at the enemy it can't burn through.
function traceBeam(g, x, y, dx, dy, reach, b, k, dt, exNow, noSplit) {
  const m = g.m, G = m.G;
  let left = reach, bounces = b.bounces, splitAt = noSplit ? -1 : reach * 0.55, gone = 0;
  for (let seg = 0; seg <= bounces && left > 0.1; seg++) {
    let d = rayDist(m, x, y, dx, dy, left), end = d, stop = false;
    // enemies on this stretch, nearest first
    const on = [];
    for (const e of g.enemies) {
      if (e.hp <= 0) continue;
      const ex = e.x - x, ey = e.y - y, t = ex * dx + ey * dy;
      if (t < 0 || t > d) continue;
      if (Math.abs(ex * dy - ey * dx) < e.r + b.width / 2) on.push({ e, t });
    }
    on.sort((u, v) => u.t - v.t);
    let passes = b.pierce;
    for (const { e, t } of on) {
      hurt(g, e, b.dps * k * dt, dx, dy, b.knock ? knockOf(b.knock) * dt * 4 : 0, true);
      applyPayload(g, e, b.pay, k * dt * 3);
      if (g.R() < dt * 14) g.parts.push({ x: e.x - dx * e.r, y: e.y - dy * e.r, vx: -dx * 6 + (g.R() - 0.5) * 8, vy: -dy * 6 + (g.R() - 0.5) * 8, life: 0.2, max: 0.2, col: e.type, s: 0.3 });
      if (passes-- <= 0) { end = t; stop = true; break; }
    }
    // Split: forks in two partway along
    if (splitAt >= 0 && gone + end > splitAt) {
      const s = splitAt - gone, sx = x + dx * s, sy = y + dy * s;
      g.beams.push({ x0: x, y0: y, x1: sx, y1: sy, w: b.width * k, pay: b.pay });
      for (const sg of [-0.4, 0.4]) { const c = Math.cos(sg), sn = Math.sin(sg); traceBeam(g, sx, sy, dx * c - dy * sn, dx * sn + dy * c, left - s, b, k * (0.3 + 0.1 * b.split), dt, exNow, true); }
      return;
    }
    const x1 = x + dx * end, y1 = y + dy * end;
    g.beams.push({ x0: x, y0: y, x1, y1, w: b.width * k, pay: b.pay });
    gone += end; left -= end;
    if (stop) { if (exNow) blast(g, x1, y1, blastR(b.ex), blastDmg(b.ex), b.pay); return; }
    // hit a wall: burn a breakable tile, then reflect if it can
    const hx = x1 + dx * 0.05, hy = y1 + dy * 0.05, ci = Math.floor(hy) * G + Math.floor(hx);
    if (m.cells[ci] === 2) hitTile(g, ci, b.dps * k * dt * 2, true);
    if (left <= 0.1 || seg === bounces) { if (exNow) blast(g, x1 - dx * 0.5, y1 - dy * 0.5, blastR(b.ex), blastDmg(b.ex), b.pay); return; }
    const sideX = m.cells[Math.floor(y1) * G + Math.floor(hx)], sideY = m.cells[Math.floor(hy) * G + Math.floor(x1)];
    if (sideX || !sideY) dx = -dx;
    if (sideY || !sideX) dy = -dy;
    x = x1 + dx * 0.05; y = y1 + dy * 0.05;
  }
}

// ---------- abilities and the Burst cast (round 11) ----------
// You bring a weapon and 2 abilities from Spawn, Dash and Burst (decisions: "3 actions in: weapon and 2 abilities;
// Burst is an ability"). Two controls: the stick (above-left of fire) and the button (left of fire). Dash, when you
// have it, is on the button; the other ability takes the stick.
export const ABILITIES = ['spawn', 'dash', 'burst'];
export function abilityControls(g) {
  const a = g.abilities, B = a.includes('dash') ? 'dash' : a[1], A = a.find(x => x !== B);
  return { A, B };
}
function useAbility(g, id, tap, ev, inp) {
  const p = g.p;
  if (id === 'dash') { if (tap) startDash(g, p, inp.move.x, inp.move.y); else startDash(g, p, ev.x, ev.y); }
  else if (id === 'spawn') {
    if (tap) { const e = nearestVisible(g, 9); if (e) throwBall(g, e.x - p.x, e.y - p.y); else throwBall(g, p.fx, p.fy); }
    else throwBall(g, ev.x, ev.y);
  } else if (id === 'burst') {
    if (tap) { const e = nearestVisible(g, burstReach(g)); if (e) throwBomb(g, e.x - p.x, e.y - p.y, 1, Math.hypot(e.x - p.x, e.y - p.y)); else throwBomb(g, p.fx, p.fy, 0.6); }
    else throwBomb(g, ev.x, ev.y, ev.mag ?? 1);
  }
}

// Burst: a thrown bomb that blasts where it lands. Drag to aim (how far you drag is how far it goes), let go to throw;
// a tap throws it at the nearest enemy you can see.
export const BURST = { cooldown: 5, range: 12, r: 3, damage: 30, flight: 0.5 };
const BL = (g, id) => L(g, 'burst', id);
export const burstReach = (g) => BURST.range * durOf(BL(g, 'duration'));
export const burstRadius = (g) => BURST.r * (1 + 0.25 * BL(g, 'grow'));
// Where a throw would land: as far as the drag says, stopping short of a wall.
export function burstTarget(g, ax, ay, mag) {
  const p = g.p, d = Math.hypot(ax, ay) || 1, dx = ax / d, dy = ay / d, reach = burstReach(g);
  const want = Math.min(reach, Math.max(2.5, mag * reach));
  const dist = Math.max(0, Math.min(want, rayDist(g.m, p.x, p.y, dx, dy, want + 1.2) - 1.2));
  return { x: p.x + dx * dist, y: p.y + dy * dist, dx, dy };
}
function throwBomb(g, ax, ay, mag = 1, exact) {
  if (g.burstCool > 0) return;
  const haste = BL(g, 'haste'), grow = BL(g, 'grow');
  g.burstCool = BURST.cooldown * cdMul(g, 'burstCd') * Math.max(0.3, 1 - 0.08 * haste);
  const T = exact != null ? burstTarget(g, ax, ay, exact / burstReach(g)) : burstTarget(g, ax, ay, mag), n = 1 + BL(g, 'extra');
  const o = { r: burstRadius(g), dmg: BURST.damage * (1 + 0.15 * grow), T: BURST.flight / (1 + 0.2 * haste), pay: payload(g, 'burst'),
    hops: BL(g, 'bounce'), home: BL(g, 'home'), split: BL(g, 'split'), ex: BL(g, 'explode'), pierce: BL(g, 'pierce'), knock: BL(g, 'knock'), dx: T.dx, dy: T.dy };
  for (let i = 0; i < n; i++) { // Extra: more bombs in a ring around the aim point
    let x = T.x, y = T.y;
    if (i) { const a = (i - 1) / Math.max(1, n - 1) * TAU, c = Math.floor(T.y + Math.sin(a) * 2.6) * g.m.G + Math.floor(T.x + Math.cos(a) * 2.6); if (g.m.clear[c]) { x = T.x + Math.cos(a) * 2.6; y = T.y + Math.sin(a) * 2.6; } }
    g.bombs.push({ ...o, sx: g.p.x, sy: g.p.y, x: g.p.x, y: g.p.y, tx: x, ty: y, t: 0 });
  }
}
function stepBombs(g, dt) {
  for (let i = g.bombs.length - 1; i >= 0; i--) {
    const b = g.bombs[i]; b.t += dt;
    if (b.home && !b.child) { // Home: steers in the air onto an enemy near the aim point
      const e = nearestEnemy(g, b.tx, b.ty, 3 + b.home);
      if (e) { const dx = e.x - b.tx, dy = e.y - b.ty, d = Math.hypot(dx, dy) || 1, s = Math.min(d, 14 * dt); b.tx += dx / d * s; b.ty += dy / d * s; }
    }
    const k = Math.min(1, b.t / b.T); b.x = b.sx + (b.tx - b.sx) * k; b.y = b.sy + (b.ty - b.sy) * k; b.z = Math.sin(Math.PI * k) * (b.child ? 1 : 2.2);
    if (k < 1) continue;
    g.bombs.splice(i, 1); landBomb(g, b);
  }
  for (let i = g.later.length - 1; i >= 0; i--) { const q = g.later[i]; q.t -= dt; if (q.t <= 0) { g.later.splice(i, 1); q.f(); } }
}
function landBomb(g, b) {
  const x = b.tx, y = b.ty;
  blast(g, x, y, b.r, b.dmg, b.pay, { walls: b.pierce > 0, knock: b.knock ? knockOf(b.knock) : 0.6 });   // Pierce: through walls; Knock: hurls out
  if (b.ex) g.later.push({ t: 0.35, f: () => blast(g, x, y, blastR(b.ex) + 1, blastDmg(b.ex), b.pay) });   // Explode: a second blast after a beat
  const hop = (dx, dy, dist, r, dmg, extra) => { // a smaller bomb from here
    const d = Math.max(0, Math.min(dist, rayDist(g.m, x, y, dx, dy, dist + 1.2) - 1.2));
    g.bombs.push({ ...b, ...extra, sx: x, sy: y, x, y, tx: x + dx * d, ty: y + dy * d, t: 0, T: 0.3, r, dmg, ex: 0 });
  };
  if (b.hops > 0) hop(b.dx, b.dy, 4, b.r * 0.75, b.dmg * 0.75, { hops: b.hops - 1, split: 0 });   // Bounce: hops on, smaller each time
  if (b.split && !b.child) for (const s of [-1, 1]) hop(-b.dy * s, b.dx * s, 4, b.r * 0.6, b.dmg * (0.3 + 0.1 * b.split), { child: true, hops: 0, split: 0 });   // Split
}

// ---------- the Dash cast ----------
// One Dash for everyone (round 6: "reuse, not reinvent"). A dasher is you, an echo of your dash (Split), or an enemy
// (the dart). Yours and your echoes hit enemies; an enemy's hits you. Modules come from your build, the echo's own
// copy, or the enemy's `dash` list in ENEMIES.
export const GHOST = 0.22;   // how long an afterimage lasts (round 6: afterimage trails, not lines)
const mine = (g, a) => a === g.p || a.mine;
function dashMods(g, a) { return a === g.p ? (g.build.dash || {}) : a.mine ? a.mods : (a.dash || ENEMIES[a.type].dash || {}); }

function startDash(g, a, dx, dy, chained) {
  const isP = a === g.p, mods = dashMods(g, a);
  if (isP && !chained && (a.charges < 1 || a.dashT > 0)) return;
  const d = Math.hypot(dx, dy); if (d < 1e-6) { dx = a.fx; dy = a.fy; } else { dx /= d; dy /= d; }
  if (mods.home) { // lunge: turn toward a foe ahead
    const lr = lunge(mods.home);
    if (mine(g, a)) { const e = nearestEnemy(g, a.x, a.y, lr, dx, dy, 0.5); if (e) { const ex = e.x - a.x, ey = e.y - a.y, ed = Math.hypot(ex, ey) || 1; dx = ex / ed; dy = ey / ed; } }
    else { const p = g.p, px = p.x - a.x, py = p.y - a.y, pd = Math.hypot(px, py) || 1; if (pd < lr && (px * dx + py * dy) / pd > 0.5) { dx = px / pd; dy = py / pd; } }
  }
  if (!chained) {
    if (isP) { a.charges -= 1; if (a.recharge <= 0) a.recharge = DASH.recharge * cdMul(g, 'dashCd') * (1 - 0.1 * (mods.haste || 0)); }
    a.chain = mods.extra || 0;
  }
  a.dashT = DASH.time; a.dashLen = dashLen(g, a); a.dx = dx; a.dy = dy; a.fx = dx; a.fy = dy;
  a.dashBounces = mods.bounce || 0; a.dashHit = new Set(); a.dashPay = payloadOf(mods);
  if (isP && !chained && mods.split) // Split: two echo dashes at +-35 degrees, carrying the dash's contact effects
    for (const s of [-1, 1]) {
      const c = Math.cos(0.61 * s), sn = Math.sin(0.61 * s);
      const echo = { x: a.x, y: a.y, r: a.r, fx: dx, fy: dy, mine: true, scale: 0.3 + 0.1 * mods.split, mods: { ...mods, split: 0, extra: 0, explode: 0 } };
      startDash(g, echo, dx * c - dy * sn, dx * sn + dy * c, true); g.echoes.push(echo);
    }
}

// steer: where the next dash in a row goes (the move stick for you; toward you for an enemy)
function stepDash(g, a, dt, steer) {
  const isP = a === g.p, m = g.m, sp = a.dashLen / DASH.time, p = g.p, mods = dashMods(g, a), sc = a.scale || 1;
  const r = moveBodyN(m, a, a.dx * sp * dt, a.dy * sp * dt);
  a.dashT -= dt;
  const reach = a.r + 0.5 + 0.4 * (mods.grow || 0);   // Grow: a wider dash
  for (const i of tilesNear(g, a.x, a.y, reach)) if (!a.dashHit.has(i)) { a.dashHit.add(i); hitTile(g, i, DASH.block * sc * (mine(g, a) ? dmgMul(g) : 1)); }
  if (r.hit) {
    const nl = Math.hypot(r.nx, r.ny);
    if (a.dashBounces > 0 && nl > 1e-6) {
      const nx = r.nx / nl, ny = r.ny / nl, vn = a.dx * nx + a.dy * ny;
      if (vn < 0) { a.dashBounces--; a.dx -= 2 * vn * nx; a.dy -= 2 * vn * ny; a.dashT = DASH.time; }
    } else a.dashT = Math.min(a.dashT, 0.02);
  }
  if (mine(g, a)) { // everyone passed: small damage (Pierce adds more) and the payloads; Knock makes it a shockwave
    const dmg = (3 + (mods.pierce ? 3 + 5 * mods.pierce : 0)) * sc, kb = mods.knock ? knockOf(mods.knock) : 0;
    for (const e of g.enemies) {
      if (e.hp <= 0 || a.dashHit.has(e)) continue;
      const ex = e.x - a.x, ey = e.y - a.y;
      if (Math.hypot(ex, ey) < reach + e.r + 0.1) { a.dashHit.add(e); hurt(g, e, dmg, kb ? ex : 0, kb ? ey : 0, kb); applyPayload(g, e, a.dashPay, sc); }
    }
  } else if (!a.dashHit.has(p) && !(p.dashT > 0) && p.safeT <= 0 && Math.hypot(p.x - a.x, p.y - a.y) < a.r + p.r + 0.3) {
    a.dashHit.add(p);
    if (p.hurtT <= 0) hurtPlayer(g, ENEMIES[a.type].dashDamage || ENEMIES[a.type].damage);
  }
  if ((g.frame & 1) === 0) g.ghosts.push({ x: a.x, y: a.y, r: a.r, fx: a.fx, fy: a.fy, type: mine(g, a) ? 'player' : a.type, t: 0 });
  if (a.dashT <= 0) {
    a.dashT = 0;
    if (isP) a.safeT = DASH.safe + 0.1 * (mods.grow || 0);
    if (isP && mods.explode) blast(g, a.x, a.y, blastR(mods.explode), blastDmg(mods.explode), a.dashPay);
    if (a.chain > 0) { // Extra on the Dash: the next dash in a row
      a.chain--;
      let sx = a.dx, sy = a.dy;
      if (steer && Math.hypot(steer.x, steer.y) > 0.2) { sx = steer.x; sy = steer.y; }
      else if (!mine(g, a)) { sx = p.x - a.x; sy = p.y - a.y; }
      startDash(g, a, sx, sy, true);
    }
  }
}

// ---------- spawning ----------
// The path field, and the cells 16-44 steps away along it (where enemies can appear).
function refreshField(g) {
  const n = pathField(g.m, g.p.x, g.p.y, FIELD_STEPS, g.field), q = pathField.q;
  g.ring.length = 0;
  for (let i = 0; i < n; i++) { const d = g.field[q[i]]; if (d >= 45 && d <= 120) g.ring.push(q[i]); }
}

function spawnEnemy(g, type, minD, maxD, angle) {
  const m = g.m, G = m.G;
  if (!g.ring.length) return false;
  for (let t = 0; t < 40; t++) {
    const c = g.ring[(g.R() * g.ring.length) | 0];
    const d = g.field[c]; if (d < minD || d > maxD) continue;
    const x = (c % G) + 0.5, y = ((c / G) | 0) + 0.5;
    if (angle != null) { let da = Math.atan2(y - g.p.y, x - g.p.x) - angle; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) > 0.6) continue; }
    if (canSee(g, x, y)) continue;
    makeEnemy(g, type, x, y);
    return true;
  }
  return false;
}

// Round 4: "way too many enemies from the get go ... not coming in waves you can prepare for". Between waves only a
// few wander in; waves are warned WARN seconds ahead, from 1 side at first, 2 later, sometimes 3, and arrive over a
// few seconds rather than all at once.
const FIRST_WAVE = 30, WAVE_EVERY = 45;
export const WARN = 10;
function targetAlive(t) { const mn = t / 60; return Math.min(24, Math.round(7 + 1.6 * mn)); }
const waveSize = (w) => Math.min(28, 6 + (w - 1) * 4);
// Bosses: the Hulk at 5:00, then every 5 minutes, half as tough again each time (until the Queen and Mirror exist).
const BOSS_AT = 300, BOSS_EVERY = 300;
// Playground: a small group walks in from the right every few seconds, never more than 10 at once.
const PLAY = ['mite', 'mite', 'mite', 'dart', 'spitter', 'mite', 'brute'];
function stepPlayground(g, dt) {
  g.playT = (g.playT || 0) - dt;
  if (g.playT > 0 || g.enemies.length >= 10) return;
  g.playT = 4;
  const side = g.p.x < 110 ? 1 : -1, x0 = Math.max(14, Math.min(156, g.p.x + side * 30));   // 30 cells off, on the roomier side
  for (let i = 0; i < 4; i++) { const x = x0 + g.R() * 4, y = Math.max(45, Math.min(125, g.p.y + (g.R() - 0.5) * 24));
    if (g.m.clear[Math.floor(y) * g.m.G + Math.floor(x)]) makeEnemy(g, PLAY[(g.R() * PLAY.length) | 0], x, y); }
}

function stepBoss(g) {
  if (g.boss || g.t < g.nextBoss) return;
  const n = Math.round((g.nextBoss - BOSS_AT) / BOSS_EVERY);
  // round 8: "boss fight is in rooms too small": it arrives in the biggest room you can't see, else nearby out of sight
  const rooms = g.m.halls.slice().sort((a, b) => (b.box.x1 - b.box.x0) * (b.box.y1 - b.box.y0) - (a.box.x1 - a.box.x0) * (a.box.y1 - a.box.y0));
  const room = rooms.find(r => !canSee(g, r.x, r.y) && Math.hypot(r.x - g.p.x, r.y - g.p.y) > 60);
  if (room) makeEnemy(g, 'hulk', room.x, room.y);
  else if (!spawnEnemy(g, 'hulk', 70, 120)) return;   // try again next step
  const e = g.enemies[g.enemies.length - 1]; e.maxHp = e.hp = ENEMIES.hulk.hp * (1 + 0.5 * n);
  g.boss = e; g.nextBoss += BOSS_EVERY; g.pops.push({ text: 'The Hulk', t: 0, big: true });
}
// Wave 1 mites; 2 adds darts; 3 spitters; from 4 a brute or two leads it.
function waveType(w, i) {
  if (w >= 4 && i % 12 === 0) return 'brute';
  if (w >= 2 && i % (w === 2 ? 3 : 5) === 1) return 'dart';
  if (w >= 3 && i % (w === 3 ? 3 : 6) === 2) return 'spitter';
  return 'mite';
}
function trickleType(g) {
  const r = g.R(), mn = g.t / 60;
  if (mn > 4 && r < 0.05) return 'brute';
  if (mn > 3 && r < 0.15) return 'spitter';
  if (mn > 1.5 && r < 0.3) return 'dart';
  return 'mite';
}

// ---------- step ----------
export function step(g, dt, inp) {
  if (g.over || g.run.offers.length) return;   // a chest or level-up card is up: the game waits
  g.stopCd = (g.stopCd || 0) - dt;
  if (g.hitStop > 0) { g.hitStop -= dt; return; }   // round 12: a few frames' freeze when something dies
  g.t += dt; g.frame = (g.frame || 0) + 1;
  const p = g.p, m = g.m, w = g.weapon;

  // input events
  for (const ev of inp.events) {
    if (ev.type === 'fireTap' && w.tapNearest) { const e = nearestVisible(g, w.range); if (e) fire(g, e.x - p.x, e.y - p.y); else fire(g, p.fx, p.fy); }
    if (ev.type === 'fireRelease' && w.trigger === 'release') fire(g, ev.x, ev.y);
    const ctl = abilityControls(g);   // the button is 'dash' input, the stick is 'spawn' input
    if (ev.type === 'dashTap' || ev.type === 'dashRelease') useAbility(g, ctl.B, ev.type === 'dashTap', ev, inp);
    if (ev.type === 'spawnTap' || ev.type === 'spawnRelease') useAbility(g, ctl.A, ev.type === 'spawnTap', ev, inp);
  }
  g.spawnAim = inp.spawn.engaged === true ? { x: inp.spawn.x, y: inp.spawn.y, mag: inp.spawn.mag } : null;
  g.spawnCool = Math.max(0, g.spawnCool - dt); g.burstCool = Math.max(0, g.burstCool - dt);
  g.aim = inp.fire.engaged === true ? { x: inp.fire.x, y: inp.fire.y } : null;
  g.dashAim = inp.dash.engaged === true ? { x: inp.dash.x, y: inp.dash.y, mag: inp.dash.mag } : null;
  if (g.opts.auto && !g.aim) autoAct(g, inp);
  else {
    if (g.aim && (w.trigger === 'hold' || w.trigger === 'auto') && !w.beam) fire(g, g.aim.x, g.aim.y);
    if (!g.aim && w.trigger === 'auto') { const e = nearestVisible(g, w.range); if (e) fire(g, e.x - p.x, e.y - p.y); }
  }

  // rounds come back
  g.cool = Math.max(0, g.cool - dt); g.sinceShot += dt;
  if (w.refill === 'full') {
    if (g.reloadT > 0) { g.reloadT -= dt / cdMul(g, 'reload') * (1 + 0.08 * L(g, 'weapon', 'haste')); if (g.reloadT <= 0) { g.reloadT = 0; g.ammo = w.rounds; } }
    else if (g.ammo < 1 || (g.ammo < w.rounds && g.sinceShot >= w.refillDelay)) g.reloadT = w.reloadTime;
  } else if (g.sinceShot >= w.refillDelay) g.ammo = Math.min(w.rounds, g.ammo + w.refillRate * dt / cdMul(g, 'reload') * (1 + 0.08 * L(g, 'weapon', 'haste')));

  // dash charges
  if (p.charges < DASH.charges) { p.recharge -= dt; if (p.recharge <= 0) { p.charges++; p.recharge = p.charges < DASH.charges ? DASH.recharge * cdMul(g, 'dashCd') : 0; } }

  // player movement
  const SPEED = 8.5 * (1 + 0.08 * g.run.vitals.speed);
  for (let i = g.echoes.length - 1; i >= 0; i--) { stepDash(g, g.echoes[i], dt, null); if (g.echoes[i].dashT <= 0) g.echoes.splice(i, 1); }
  if (p.dashT > 0) stepDash(g, p, dt, inp.move);
  else {
    const mx = inp.move.x, my = inp.move.y, mm = Math.min(1, Math.hypot(mx, my));
    const tvx = mm > 0.05 ? mx / Math.hypot(mx, my) * mm * SPEED : 0, tvy = mm > 0.05 ? my / Math.hypot(mx, my) * mm * SPEED : 0;
    const k = Math.min(1, dt * 18); p.vx += (tvx - p.vx) * k; p.vy += (tvy - p.vy) * k;
    moveBody(m, p, p.vx * dt, p.vy * dt);
    if (mm > 0.2 && !g.aim) { p.fx = mx / Math.hypot(mx, my); p.fy = my / Math.hypot(mx, my); }
  }
  if (p.kx || p.ky) { // shoved (by the Hulk): a push of speed that dies off, like enemy knockback
    if (p.dashT <= 0) moveBody(m, p, p.kx * dt, p.ky * dt);
    const f = Math.exp(-8 * dt); p.kx *= f; p.ky *= f; if (Math.abs(p.kx) + Math.abs(p.ky) < 0.05) p.kx = p.ky = 0;
  }
  if (g.aim) { const d = Math.hypot(g.aim.x, g.aim.y) || 1; p.fx = g.aim.x / d; p.fy = g.aim.y / d; }
  p.hurtT = Math.max(0, p.hurtT - dt); p.safeT = Math.max(0, p.safeT - dt);

  updateSight(g);
  g.fieldT -= dt;
  if (g.fieldT <= 0) { refreshField(g); g.fieldT = 0.2; }

  if (m.arena) { stepPlayground(g, dt); } else {
  // spawning: a few wanderers between waves; waves warned ahead, from a few sides
  const want = targetAlive(g.t);
  let roam = 0, close = 0; for (const e of g.enemies) { if (!e.camp) roam++; if (!e.sleep && Math.abs(e.x - p.x) + Math.abs(e.y - p.y) < 35) close++; }   // camps don't count
  g.spawnAcc += dt * (roam < want && close < 8 ? 0.9 + g.t / 300 : 0);   // a crowd on you: nothing new trickles in
  while (g.spawnAcc >= 1) { g.spawnAcc -= 1; spawnEnemy(g, trickleType(g), 55, 110); }
  if (!g.waveWarn && g.t >= g.nextWave - WARN) {
    const w = g.wave + 1, k = w === 1 ? 1 : w <= 3 ? 2 : 2 + (g.R() < 0.5 ? 1 : 0), a0 = g.R() * TAU, sides = [];
    for (let j = 0; j < k; j++) sides.push(a0 + j * TAU / k + (g.R() - 0.5) * 0.8);
    g.waveWarn = { at: g.nextWave, wave: w, sides, n: waveSize(w) };
  }
  if (g.t >= g.nextWave) {
    const w = g.waveWarn; g.wave++; g.nextWave += WAVE_EVERY; g.waveWarn = null;
    g.incoming = { left: w.n, sides: w.sides, rate: Math.max(4, w.n / 3), acc: 0, wave: g.wave };
    g.pops.push({ text: `Wave ${g.wave}`, t: 0, big: true });
  }
  if (g.incoming) { // the wave arrives over about 3 seconds
    const w = g.incoming; w.acc += dt * w.rate;
    while (w.acc >= 1 && w.left > 0) { w.acc -= 1; w.left--; spawnEnemy(g, waveType(w.wave, w.left), 50, 110, w.sides[w.left % w.sides.length] + (g.R() - 0.5) * 0.4); }
    if (w.left <= 0) g.incoming = null;
  }
  }

  stepStatuses(g, dt);
  if (!m.arena) stepBoss(g);

  // enemies
  const G = m.G, f = g.field;
  for (const e of g.enemies) {
    const S = ENEMIES[e.type];
    e.flash = Math.max(0, e.flash - dt); if (e.born > 0) e.born -= dt;
    if (e.frozen > 0 || e.stun > 0) { e.vx = e.vy = 0; continue; }   // frozen or stunned: still
    if (e.dashT > 0) { stepDash(g, e, dt, null); if (e.dashT <= 0) { e.st = 'rest'; e.t = 0.6; } continue; }
    if (e.sleep) { // a camp at rest: the whole camp wakes when one sees you close, or is hurt
      e.vx = e.vy = 0;
      if ((g.frame + e.id) % 6 === 0 && Math.hypot(p.x - e.x, p.y - e.y) < 28 && lineClear(m, e.x, e.y, p.x, p.y)) wakeCamp(g, e.camp);
      continue;
    }
    let dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy), toBall = false;
    let tx = 0, ty = 0, spd = e.speed * (1 - Math.min(0.6, (e.chill || 0) / 100 * 0.6));   // chill slows, up to 60%
    // a ball nearer than you, in sight: they go for it
    for (const b of g.balls) {
      const bx = b.x - e.x, by = b.y - e.y, bd = Math.hypot(bx, by);
      if (bd < 7 && bd < d && lineClear(m, e.x, e.y, b.x, b.y)) { dx = bx; dy = by; d = bd; toBall = true; }
    }
    const sees = toBall || (d < 30 && (e.type !== 'mite' || d < 16) && lineClear(m, e.x, e.y, p.x, p.y));
    if (sees && d < 12) { tx = dx / (d || 1); ty = dy / (d || 1); }
    else {
      const cx = Math.floor(e.x), cy = Math.floor(e.y), c = cy * G + cx;
      let best = f[c], bi = -1;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue; const n = c + oy * G + ox;
        if (f[n] < best) { best = f[n]; bi = n; }
      }
      if (bi >= 0) { const nx = (bi % G) + 0.5 - e.x, ny = ((bi / G) | 0) + 0.5 - e.y, nd = Math.hypot(nx, ny) || 1; tx = nx / nd; ty = ny / nd; }
      else if (f[c] === 65535) e.lost = (e.lost || 0) + dt;
    }
    e.cd = Math.max(0, e.cd - dt);
    if (e.type === 'dart') { // see you, stop and aim, then Dash at you (the same Dash as yours), rest
      if (e.st === 'aim') {
        spd = 0; e.t -= dt;
        if (e.t > 0.2 && d > 0.1) { e.ax = dx / d; e.ay = dy / d; }   // follows you, then locks for the last 0.2 s
        if (e.t <= 0) { e.st = 'dash'; startDash(g, e, e.ax, e.ay); }
      } else if (e.st === 'rest') { spd = 0; e.t -= dt; if (e.t <= 0) { e.st = null; e.cd = 2; } }
      else if (e.cd <= 0 && sees && d < S.sight) { e.st = 'aim'; e.t = S.aim; e.ax = dx / d; e.ay = dy / d; spd = 0; }
    } else if (e.type === 'spitter' && sees && d < 20) { // keep a distance, and lob orbs
      if (d < 9) { tx = -dx / d; ty = -dy / d; } else if (d < 15) spd = 0;
      if (e.cd <= 0) {
        e.cd = S.reload; e.fx = dx / d; e.fy = dy / d;
        const o = S.orb; g.shots.push({ x: e.x + e.fx * 1.2, y: e.y + e.fy * 1.2, vx: e.fx * o.speed, vy: e.fy * o.speed, r: o.r, dmg: o.damage, life: o.life });
      }
    }
    if (e.type === 'hulk') { // axis lines only (round 8); very fast, commits to a direction for a while (round 9)
      e.turnCd = (e.turnCd || 0) - dt;
      const want = Math.abs(tx) >= Math.abs(ty) ? [Math.sign(tx) || 1, 0] : [0, Math.sign(ty) || 1];
      const stuck = e.dir && Math.hypot(e.vx, e.vy) < spd * 0.2 && e.turnCd < 1.0;
      if (!e.dir || (e.turnCd <= 0 && (want[0] !== e.dir[0] || want[1] !== e.dir[1])) || stuck) {
        e.dir = stuck && want[0] === e.dir[0] && want[1] === e.dir[1] ? [e.dir[1], -e.dir[0]] : want;
        e.turnCd = 1.2 + g.R() * 1.3;
      }
      tx = e.dir[0]; ty = e.dir[1];
      const kk = Math.min(1, dt * 4);   // straight along its axis: the other speed dies off
      if (e.dir[0]) e.vy -= e.vy * kk; else e.vx -= e.vx * kk;
    }
    const k = Math.min(1, dt * 6);
    e.vx += (tx * spd - e.vx) * k; e.vy += (ty * spd - e.vy) * k;
    e.x += e.vx * dt; e.y += e.vy * dt;
    const v = Math.hypot(e.vx, e.vy);
    if (e.dir) {
      e.fx = e.dir[0]; e.fy = e.dir[1];
      const want = Math.atan2(e.dir[1], e.dir[0]); if (e.ang == null) e.ang = want;
      let df = want - e.ang; df = Math.atan2(Math.sin(df), Math.cos(df));
      e.angV = ((e.angV || 0) + df * 260 * dt) * Math.exp(-15 * dt); e.ang += e.angV * dt;   // snappier (round 10)
    }
    if (e.st === 'aim') { e.fx = e.ax; e.fy = e.ay; } else if (v > 0.5 && e.type !== 'spitter' && !e.dir) { e.fx = e.vx / v; e.fy = e.vy / v; }
  }
  for (const e of g.enemies) if (e.kx || e.ky) { // knockback: moves them, then dies off
    e.x += e.kx * dt; e.y += e.ky * dt; const f = Math.exp(-9 * dt); e.kx *= f; e.ky *= f;
    if (Math.abs(e.kx) + Math.abs(e.ky) < 0.05) e.kx = e.ky = 0;
  }
  // enemies don't overlap each other, or you
  separate(g);
  for (const e of g.enemies) if (pushOutOfWalls(m, e)) {
    if (ENEMIES[e.type].breaks) for (const i of tilesNear(g, e.x, e.y, e.r + 0.4)) hitTile(g, i, ENEMIES[e.type].breaks * dt, true);   // brutes and the Hulk break tiles
  }
  pushOutOfWalls(m, p);
  // far behind or lost: come back from somewhere nearer, out of sight
  for (let i = g.enemies.length - 1; i >= 0; i--) {
    const e = g.enemies[i], fd = g.field[Math.floor(e.y) * G + Math.floor(e.x)];
    if (ENEMIES[e.type].boss) continue;   // a boss never gives up
    if (e.camp) { // round 5: leave their room and a camp goes home (out of your sight) and heals
      if (e.sleep) continue;
      const bx = e.camp.box, out = p.x < bx.x0 - 20 || p.x > bx.x1 + 20 || p.y < bx.y0 - 20 || p.y > bx.y1 + 20;
      e.away = out ? (e.away || 0) + dt : 0;
      if ((e.away > 3 || (e.lost || 0) > 3) && !canSee(g, e.x, e.y) && !canSee(g, e.home.x, e.home.y)) {
        e.x = e.home.x; e.y = e.home.y; e.sleep = true; e.lost = 0; e.away = 0; e.st = null; e.hp = e.maxHp; e.burn = 0;
      }
      continue;
    }
    if ((fd > 150 && fd !== 65535) || (e.lost || 0) > 1.5) { g.enemies.splice(i, 1); spawnEnemy(g, e.type, 55, 110, Math.atan2(e.y - p.y, e.x - p.x)) || spawnEnemy(g, e.type, 55, 110); }
  }

  // touching you
  for (const e of g.enemies) {
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (d < p.r + e.r + 0.15 && !(e.dashT > 0) && p.dashT <= 0 && p.safeT <= 0 && p.hurtT <= 0) hurtPlayer(g, ENEMIES[e.type].damage);
  }

  if (w.beam) stepBeam(g, dt); else g.beams.length = 0;
  stepBolts(g, dt);
  stepBalls(g, dt);
  stepBombs(g, dt);
  stepShots(g, dt);
  for (const b of g.blasts) b.t += dt;
  g.blasts = g.blasts.filter(b => b.t < 0.35);
  for (let i = g.enemies.length - 1; i >= 0; i--) if (g.enemies[i].hp <= 0) g.enemies.splice(i, 1);

  // keys
  for (let i = g.keysOnFloor.length - 1; i >= 0; i--) {
    const k = g.keysOnFloor[i];
    if (Math.hypot(k.x - p.x, k.y - p.y) < p.r + 1.2) {
      g.keysOnFloor.splice(i, 1); g.keys++;
      if (g.keys >= KEYS) { g.clearT = 2; g.pops.push({ text: 'Floor clear', t: 0, big: true }); }
      else g.pops.push({ text: `Key ${g.keys} of ${KEYS}`, t: 0 });
    }
  }
  if (g.clearT > 0 && (g.clearT -= dt) <= 0) { nextFloor(g); return; }

  // chests: walk into one to open it
  for (const c of g.chests) if (!c.open && Math.hypot(c.x - p.x, c.y - p.y) < p.r + 1.1) { c.open = true; burst(g, c.x, c.y, 'gold', 18); g.rings.push({ x: c.x, y: c.y, r0: 1, r1: 5, t: 0, life: 0.4, c: '#ffc23a' }); g.run.offers.push(chestOffer(g, c.rarity)); }

  // health shards: pulled in like XP, heal 15 (+5 a Heal shards card)
  for (let i = g.hearts.length - 1; i >= 0; i--) {
    const q = g.hearts[i], dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy) || 1;
    if (d < pickupRange(g) || q.pull) { q.pull = true; const sp = 6 + (q.sp = (q.sp || 0) + dt * 40); q.x += dx / d * sp * dt; q.y += dy / d * sp * dt; }
    if (d < p.r + 0.4) {
      g.hearts.splice(i, 1); p.hp = Math.min(p.maxHp, p.hp + 15 + 5 * (g.run.vitals.healPower || 0));
      g.rings.push({ x: p.x, y: p.y, r0: 1, r1: 3.5, t: 0, life: 0.35, c: '#ff3355' }); burst(g, p.x, p.y, 'hp', 8);
    }
  }
  if (g.run.vitals.regen) p.hp = Math.min(p.maxHp, p.hp + 0.5 * g.run.vitals.regen * dt);   // Regeneration: 0.5 a second a level

  // XP
  for (let i = g.gems.length - 1; i >= 0; i--) {
    const q = g.gems[i], dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy);
    if (d < pickupRange(g) || q.pull) { q.pull = true; const sp = 6 + (q.sp = (q.sp || 0) + dt * 40); q.x += dx / d * sp * dt; q.y += dy / d * sp * dt; }
    if (d < p.r + 0.3) {
      g.gems.splice(i, 1); g.xp += q.v; g.parts.push({ x: p.x + (g.R() - 0.5), y: p.y + (g.R() - 0.5), vx: (g.R() - 0.5) * 6, vy: -3 - g.R() * 3, life: 0.3, max: 0.3, col: 'xp', s: 0.3 });
    }
  }
  for (let need = xpNeed(g.level); g.xp >= need; need = xpNeed(g.level)) { // XP from gems or a scrapped shard
    g.xp -= need; g.level++; g.pops.push({ text: `Level ${g.level}`, t: 0 }); g.rings.push({ x: p.x, y: p.y, r0: 1, r1: 7, t: 0, life: 0.5, c: '#35f0a0' });
    if (!g.practice) g.run.offers.push(levelOffer(g));
  }

  for (const [i, t] of g.tileFlash) { if (t - dt <= 0) g.tileFlash.delete(i); else g.tileFlash.set(i, t - dt); }
  for (let i = g.ghosts.length - 1; i >= 0; i--) { g.ghosts[i].t += dt; if (g.ghosts[i].t > GHOST) g.ghosts.splice(i, 1); }
  for (let i = g.parts.length - 1; i >= 0; i--) { const q = g.parts[i]; q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; if (!q.drift) { q.vx *= 0.9; q.vy *= 0.9; } if (q.life <= 0) g.parts.splice(i, 1); }
  for (let i = g.corpses.length - 1; i >= 0; i--) { const c = g.corpses[i]; c.t += dt; c.x += c.vx * dt; c.y += c.vy * dt; c.vx *= 0.93; c.vy *= 0.93;
    const a = c.spin * dt, cs = Math.cos(a), sn = Math.sin(a), fx = c.fx; c.fx = fx * cs - c.fy * sn; c.fy = fx * sn + c.fy * cs; if (c.t > (c.life || 0.3)) g.corpses.splice(i, 1); }
  for (let i = g.rings.length - 1; i >= 0; i--) { g.rings[i].t += dt; if (g.rings[i].t > g.rings[i].life) g.rings.splice(i, 1); }
  g.shake = Math.max(0, g.shake - dt * 2.5); g.hurtFlash = Math.max(0, g.hurtFlash - dt);
  for (let i = g.pops.length - 1; i >= 0; i--) { g.pops[i].t += dt; if (g.pops[i].t > 1.6) g.pops.splice(i, 1); }
}

// Round 4: "too few" level-ups, so the early ones come quicker.
export const xpNeed = (level) => 2 + level * 3;

function hurt(g, e, dmg, vx, vy, knock = 0.25, silent = false) {
  if (e.hp <= 0) return;
  const S = ENEMIES[e.type];
  if (e.frozen > 0 && dmg >= 12) { // Shatter: a hard hit on a frozen enemy, icicles chill those near
    e.frozen = 0; dmg += 20; burst(g, e.x, e.y, 'chill', 10); blast(g, e.x, e.y, 3, 4, { chill: 35 });
  }
  if (e.mark > 0) dmg *= 1.25;
  if (S.armor && (vx || vy)) { // the boss's front: hits coming at its face do a quarter
    const d0 = Math.hypot(vx, vy); if ((vx * e.fx + vy * e.fy) / d0 < -0.3) { dmg *= S.armor; if (!silent) e.clang = 0.1; }
  }
  e.hp -= dmg * dmgMul(g); if (!silent) e.flash = 0.08;
  if (e.sleep) wakeCamp(g, e.camp);
  // knockback is a push of speed that dies off (distance = speed / 9), not a jump in position (round 10)
  const d = Math.hypot(vx, vy) || 1, kb = knock / S.mass; e.kx = (e.kx || 0) + vx / d * kb * 9; e.ky = (e.ky || 0) + vy / d * kb * 9;
  if (!silent) { // hit effects: sparks in its colour, off the way the hit came
    for (let i = 0; i < 3; i++) { const a = Math.atan2(vy, vx) + (g.R() - 0.5) * 1.6, sp = 5 + g.R() * 8; g.parts.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.25, max: 0.25, col: e.type, s: 0.35 }); }
  }
  if (e.hp <= 0) {
    g.kills++;
    // round 12 ("not enough"): a white pop, the body flung hard and spinning, broken bits, more sparks, a tiny freeze
    const ka = (vx || vy) ? Math.atan2(vy, vx) : g.R() * TAU, kn = 20 + Math.round(e.r * 10);
    for (let i = 0; i < kn; i++) { const a = ka + (g.R() - 0.5) * 2.2, sp = 5 + g.R() * 18; g.parts.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4 + g.R() * 0.35, max: 0.75, col: g.R() < 0.25 ? 'player' : e.type, s: 0.3 + g.R() * 0.5 }); }
    const fling = 30 / Math.sqrt(S.mass);
    if (!S.boss) g.corpses.push({ type: e.type, x: e.x, y: e.y, r: e.r, fx: e.fx, fy: e.fy, vx: Math.cos(ka) * fling, vy: Math.sin(ka) * fling, spin: (g.R() < 0.5 ? -1 : 1) * (14 + g.R() * 14), t: 0, life: 0.5 });
    for (let i = 0; i < 3; i++) { const a = ka + (g.R() - 0.5) * 1.6, sp = fling * (0.5 + g.R() * 0.7); // broken bits: small copies of its shape
      g.corpses.push({ type: e.type, x: e.x, y: e.y, r: e.r * 0.38, fx: Math.cos(a), fy: Math.sin(a), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, spin: (g.R() - 0.5) * 40, t: 0, life: 0.45 }); }
    g.rings.push({ x: e.x, y: e.y, r0: e.r * 0.6, r1: e.r + 1.2, t: 0, life: 0.12, c: '#ffffff' });
    g.shake = Math.max(g.shake, 0.18);
    if (!g.stopCd || g.stopCd <= 0) { g.hitStop = S.mass > 4 ? 0.07 : 0.025; g.stopCd = 0.12; }
    g.rings.push({ x: e.x, y: e.y, r0: e.r, r1: e.r + 3, t: 0, life: 0.35, c: e.type });
    if (S.mass > 4) g.shake = Math.max(g.shake, S.boss ? 1 : 0.35);
    g.gems.push({ x: e.x, y: e.y, v: S.xp });
    if (g.R() < (S.boss ? 1 : S.mass > 4 ? 0.3 : 0.07)) g.hearts.push({ x: e.x + (g.R() - 0.5), y: e.y + (g.R() - 0.5) });
    if (e.poison > 0) g.clouds.push({ x: e.x, y: e.y, r: 3, t: 0, life: 4 });   // Rot's gas: poisons those inside
    if (e.key) { e.key = false; g.keysOnFloor.push({ x: e.x, y: e.y }); g.pops.push({ text: 'A key dropped', t: 0 }); }
    if (S.boss) { g.boss = null; g.chests.push({ x: e.x, y: e.y, rarity: 'epic' }); g.pops.push({ text: 'Hulk down', t: 0, big: true }); }
  }
}

function burst(g, x, y, col, n) {
  for (let i = 0; i < n; i++) { const a = g.R() * TAU, s = 3 + g.R() * 9; g.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.3 + g.R() * 0.25, max: 0.55, col, s: 0.3 + g.R() * 0.3 }); }
}

// Spatial hash push-apart. Enemies never sit inside each other; the player shoves them out (a dash shoves sideways).
const HASH = new Map();
function separate(g) {
  HASH.clear();
  const es = g.enemies, p = g.p;
  for (let i = 0; i < es.length; i++) { const e = es[i], k = (Math.floor(e.x / 2) << 12) | Math.floor(e.y / 2); let a = HASH.get(k); if (!a) HASH.set(k, a = []); a.push(i); }
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < es.length; i++) {
    const e = es[i], hx = Math.floor(e.x / 2), hy = Math.floor(e.y / 2);
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const a = HASH.get(((hx + ox) << 12) | (hy + oy)); if (!a) continue;
      for (const j of a) {
        if (j <= i) continue;
        const o = es[j], dx = o.x - e.x, dy = o.y - e.y, rr = e.r + o.r, d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 0.01, push = (rr - d) * 0.9, nx = d2 ? dx / d : 1, ny = d2 ? dy / d : 0;
        const me = ENEMIES[e.type].mass, mo = ENEMIES[o.type].mass, ke = e.sleep && !o.sleep ? 0.1 : mo / (me + mo), ko = 1 - ke;
        e.x -= nx * push * ke; e.y -= ny * push * ke; o.x += nx * push * ko; o.y += ny * push * ko;
      }
    }
  }
  const bs = g.balls;
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { // balls bump each other
    const a = bs[i], b = bs[j], dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d = Math.hypot(dx, dy);
    if (d >= rr) continue;
    const nx = d ? dx / d : 1, ny = d ? dy / d : 0, push = (rr - d) / 2;
    a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
    const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (rel < 0) { a.vx += rel * nx; a.vy += rel * ny; b.vx -= rel * nx; b.vy -= rel * ny; }
  }
  for (const b of g.balls) for (const e of es) { // balls are solid to enemies (not with Pierce)
    if (b.pierce) continue;
    const dx = e.x - b.x, dy = e.y - b.y, rr = e.r + b.r, d = Math.hypot(dx, dy);
    if (d < rr) { const k = (rr - d) / (d || 0.01); e.x += dx * k; e.y += dy * k; }
  }
  for (const e of es) {
    const dx = e.x - p.x, dy = e.y - p.y, rr = e.r + p.r, d = Math.hypot(dx, dy);
    if (d >= rr + (p.dashT > 0 ? DASH.shove : 0)) continue;
    if (p.dashT > 0) { // shove aside, perpendicular to the dash
      const side = Math.sign(dx * -p.dy + dy * p.dx) || 1;
      e.x += -p.dy * side * 0.6; e.y += p.dx * side * 0.6;
    } else { // the crowd pushes back: you take a third of the shove (more from a brute), so a packed corridor holds you
      const k = (rr - d) / (d || 0.01), yours = ENEMIES[e.type].mass > 1 ? 0.6 : 0.2;   // round 13: a crowd holds you less
      if (ENEMIES[e.type].boss && d > 0.01) { p.kx = (p.kx || 0) - dx / d * 4; p.ky = (p.ky || 0) - dy / d * 4; }   // the Hulk shoves you away
      e.x += dx * k * (1 - yours); e.y += dy * k * (1 - yours); p.x -= dx * k * yours; p.y -= dy * k * yours;
    }
  }
}

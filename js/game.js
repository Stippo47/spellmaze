// The simulation: fixed steps, no drawing. Units are maze cells; the player is a 2x2 body (radius 1).
import { makeMaze, rayStamp, lineClear, pathField } from './maze.js';
import { WEAPONS, DASH, SPAWN } from './weapons.js';
import { level, turn, hunt, lunge, burn, blastR, blastDmg } from './modules.js';
import { newRun, rebuild, chestOffer, levelOffer, startOffer } from './run.js';
import { TAU, rng } from './util.js';

export const SIGHT = 34;          // how far you can see, in cells
const RAYS = 540;
const FIELD_STEPS = 90;

// Stage 4: the first three new enemies (design section 6). Each has its own colour and shape (render.js).
//   dart: when it sees you, stops and aims (a line shows where), then charges straight until a wall.
//   spitter: keeps its distance with you in sight and lobs slow orbs. A dash through an orb deletes it.
//   brute: big, slow, tanky; hard to knock back, and shoves smaller enemies along.
export const ENEMIES = {
  mite:    { r: 1, hp: 20, speed: 6.0, damage: 8, xp: 1, mass: 1 },
  dart:    { r: 1, hp: 26, speed: 5.0, damage: 8, xp: 2, mass: 1, charge: 28, chargeDamage: 18, aim: 0.6 },
  spitter: { r: 1, hp: 30, speed: 4.6, damage: 6, xp: 3, mass: 1, reload: 2.4, orb: { speed: 11, r: 0.55, damage: 10, life: 3 } },
  brute:   { r: 1.7, hp: 170, speed: 3.4, damage: 20, xp: 8, mass: 5 },
};

// Camps (decisions: camps in rooms, guarding their shard; different tiers). Nearer rooms get the first tier.
const CAMPS = [{ mite: 5, dart: 2 }, { brute: 1, mite: 4, spitter: 2 }, { brute: 2, spitter: 3, dart: 3 }];

export function newGame(opts) {
  const seed = opts.seed ?? ((Math.random() * 1e9) | 0);
  const m = makeMaze({ nodes: opts.nodes, widths: opts.widths, seed });
  const g = {
    opts, seed, m, R: rng(seed ^ 0x9e3779b9), t: 0, over: false, kills: 0, xp: 0, level: 1,
    p: { x: m.start.x, y: m.start.y, r: 1, hp: 100, maxHp: 100, vx: 0, vy: 0, fx: 1, fy: 0, hurtT: 0,
         dashT: 0, dx: 0, dy: 0, charges: DASH.charges, recharge: 0, safeT: 0 },
    weapon: null, ammo: 0, cool: 0, sinceShot: 9,
    enemies: [], bolts: [], balls: [], blasts: [], gems: [], parts: [], pops: [], shots: [], camps: [], nextId: 1,
    run: newRun(), practice: opts.practice ? opts.build : null, build: null, chests: [], spawnCool: 0, spawnAim: null,
    seen: new Float32Array(m.G * m.G), // when each cell was last in view (+1; 0 = never)
    visStamp: new Uint32Array(m.G * m.G), visNow: 0,
    vis: new Float32Array(RAYS * 2), field: new Uint16Array(m.G * m.G), fieldT: 0,
    spawnAcc: 0, nextWave: FIRST_WAVE, wave: 0, waveWarn: null, incoming: null, aim: null, dashAim: null,
    ring: [],
  };
  rebuild(g);
  placeChests(g);
  placeCamps(g);
  if (!g.practice) g.run.offers.push(startOffer(g));   // pick 1 of 3 to start (round 4)
  setWeapon(g, opts.weapon || 'pistol');
  refreshField(g);
  updateSight(g);
  return g;
}

// Shards (round 3 answer, as chests): one in four dead ends, and one in each room. None in practice.
function placeChests(g) {
  if (g.practice) return;
  const m = g.m, s = m.start;
  for (const d of m.deadEnds) if (Math.hypot(d.x - s.x, d.y - s.y) > 16 && g.R() < 0.25) g.chests.push({ x: d.x, y: d.y });
  for (const h of m.halls) g.chests.push({ x: h.x, y: h.y, hall: true });
}

function placeCamps(g) {
  const m = g.m, s = m.start;
  const rooms = m.halls.map(r => ({ r, d: Math.hypot(r.x - s.x, r.y - s.y) })).filter(o => o.d > 24).sort((a, b) => a.d - b.d);
  rooms.forEach(({ r }, k) => {
    const tier = Math.min(2, Math.floor(k / rooms.length * 3)), camp = { tier, x: r.x, y: r.y };
    g.camps.push(camp);
    for (const [type, n] of Object.entries(CAMPS[tier])) for (let i = 0; i < n; i++) for (let t = 0; t < 40; t++) {
      const a = g.R() * TAU, rad = 2.5 + g.R() * 5.5, x = Math.floor(r.x + Math.cos(a) * rad) + 0.5, y = Math.floor(r.y + Math.sin(a) * rad) + 0.5;
      if (!m.clear[Math.floor(y) * m.G + Math.floor(x)] || x < r.box.x0 || x > r.box.x1 || y < r.box.y0 || y > r.box.y1) continue;
      makeEnemy(g, type, x, y, { camp, sleep: true, home: { x, y } });
      break;
    }
  });
}
function wakeCamp(g, camp) { for (const e of g.enemies) if (e.camp === camp) e.sleep = false; }

export function makeEnemy(g, type, x, y, extra) {
  const s = ENEMIES[type];
  const e = { id: g.nextId++, type, x, y, r: s.r, hp: s.hp, maxHp: s.hp, speed: s.speed * (0.9 + g.R() * 0.2), vx: 0, vy: 0, flash: 0,
    fx: 1, fy: 0, cd: 0.5 + g.R() * 1.5, st: null, t: 0, ...extra };
  g.enemies.push(e);
  return e;
}

function hurtPlayer(g, dmg) {
  const p = g.p;
  p.hp -= dmg; p.hurtT = 0.5;
  if (p.hp <= 0) { p.hp = 0; g.over = true; burst(g, p.x, p.y, 'player', 30); }
}

const cdMul = (g) => Math.pow(0.9, g.run.vitals.cooldown);
export const pickupRange = (g) => 3.5 + 1.5 * g.run.vitals.pickup;
const dmgMul = (g) => 1 + 0.15 * g.run.vitals.damage;
export const durMul = (g) => 1 + 0.15 * g.run.vitals.duration;

export function setWeapon(g, id) { g.weapon = WEAPONS[id]; g.weaponId = id; g.ammo = g.weapon.rounds; g.cool = 0; g.reloadT = 0; }

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
function payload(g, cast) { const b = L(g, cast, 'burn'); return b ? { burn: burn(b) } : null; }
function applyPayload(g, e, pay, scale = 1) { if (pay && pay.burn) addBurn(g, e, pay.burn * scale); }

function addBurn(g, e, amt) {
  if (e.hp <= 0) return;
  e.burn = (e.burn || 0) + amt; e.burnIdle = 0;
  if (e.burn >= 100) { // Flare: a big hit and a small fire blast
    e.burn = 20; hurt(g, e, 25, 0, 0);
    blast(g, e.x, e.y, 2.5, 6, { burn: 30 });
  }
}

// A blast: hits every enemy inside that the blast can see (walls block it). Yours never hurt you.
function blast(g, x, y, r, dmg, pay) {
  g.blasts.push({ x, y, r, t: 0, fire: !!(pay && pay.burn) });
  for (const e of g.enemies) {
    if (e.hp <= 0) continue;
    const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy);
    if (d > r + e.r || !lineClear(g.m, x, y, e.x, e.y)) continue;
    hurt(g, e, dmg, dx, dy, 0.6);
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
  if (g.ammo < 1 || g.cool > 0) return false;
  g.reloadT = 0;
  g.ammo -= 1; g.cool = w.cooldown; g.sinceShot = 0;
  const n = 1 + L(g, 'weapon', 'extra'), base = Math.atan2(ay, ax) + (g.R() - 0.5) * 2 * w.spread;
  const pay = payload(g, 'weapon'), bounces = L(g, 'weapon', 'bounce'), home = L(g, 'weapon', 'home'), ex = L(g, 'weapon', 'explode');
  for (let i = 0; i < n; i++) {
    const a = base + (i - (n - 1) / 2) * 0.16, dx = Math.cos(a), dy = Math.sin(a);
    g.bolts.push({ x: g.p.x + dx * 0.9, y: g.p.y + dy * 0.9, vx: dx * w.speed, vy: dy * w.speed, r: w.radius,
      dmg: w.damage, left: w.range * durMul(g), bounces, home, pay, ex });
  }
  g.p.fx = Math.cos(base); g.p.fy = Math.sin(base);
  return true;
}

function boltEnd(g, b, x, y) { if (b.ex) blast(g, x, y, blastR(b.ex), blastDmg(b.ex), b.pay); }

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
          hurt(g, e, b.dmg, b.vx, b.vy); applyPayload(g, e, b.pay);
          dead = true; boltEnd(g, b, b.x, b.y); break;
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
  g.spawnCool = SPAWN.cooldown * cdMul(g);
  const n = 1 + L(g, 'spawn', 'extra'), base = Math.atan2(ay, ax);
  for (let i = 0; i < n; i++) {
    const a = base + (i - (n - 1) / 2) * 0.35, dx = Math.cos(a), dy = Math.sin(a);
    g.balls.push({ x: g.p.x + dx * 1.2, y: g.p.y + dy * 1.2, vx: dx * SPAWN.speed, vy: dy * SPAWN.speed, r: SPAWN.r,
      hp: SPAWN.hp, maxHp: SPAWN.hp, decay: SPAWN.hp / (SPAWN.life * durMul(g)), hurtT: 0, cd: new Map(),
      bounces: L(g, 'spawn', 'bounce'), home: L(g, 'spawn', 'home'), pay: payload(g, 'spawn'), ex: L(g, 'spawn', 'explode') });
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
        hurt(g, e, SPAWN.contact + speed * SPAWN.speedDamage, dx, dy, speed > 6 ? 1.2 : 0.3); applyPayload(g, e, b.pay);
      }
      if (b.hurtT <= 0) { b.hp -= ENEMIES[e.type].damage; b.hurtT = 0.4; }
    }
    if (b.hp <= 0) {
      burst(g, b.x, b.y, 'player', 10);
      if (b.ex) blast(g, b.x, b.y, blastR(b.ex) + 1, blastDmg(b.ex) * 2, b.pay);
      g.balls.splice(i, 1);
    }
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

// ---------- the Dash cast ----------
function startDash(g, dx, dy, chained) {
  const p = g.p;
  if (!chained && (p.charges < 1 || p.dashT > 0)) return;
  const d = Math.hypot(dx, dy); if (d < 1e-6) { dx = p.fx; dy = p.fy; } else { dx /= d; dy /= d; }
  const home = L(g, 'dash', 'home');
  if (home) { // lunge: turn toward an enemy ahead
    const e = nearestEnemy(g, p.x, p.y, lunge(home), dx, dy, 0.5);
    if (e) { const ex = e.x - p.x, ey = e.y - p.y, ed = Math.hypot(ex, ey) || 1; dx = ex / ed; dy = ey / ed; }
  }
  if (!chained) {
    p.charges -= 1; if (p.recharge <= 0) p.recharge = DASH.recharge * cdMul(g);
    p.chain = L(g, 'dash', 'extra');
  }
  p.dashT = DASH.time; p.dx = dx; p.dy = dy; p.fx = dx; p.fy = dy;
  p.dashBounces = L(g, 'dash', 'bounce'); p.dashHit = new Set(); p.dashPay = payload(g, 'dash');
  for (let i = 0; i < 10; i++) g.parts.push({ x: p.x, y: p.y, vx: -dx * 6 + (g.R() - 0.5) * 6, vy: -dy * 6 + (g.R() - 0.5) * 6, life: 0.35, max: 0.35, col: 'dash', s: 0.35 });
}

function stepDash(g, dt, inp) {
  const p = g.p, m = g.m, sp = DASH.length * durMul(g) / DASH.time;
  const r = moveBodyN(m, p, p.dx * sp * dt, p.dy * sp * dt);
  p.dashT -= dt;
  if (r.hit) {
    const nl = Math.hypot(r.nx, r.ny);
    if (p.dashBounces > 0 && nl > 1e-6) {
      const nx = r.nx / nl, ny = r.ny / nl, vn = p.dx * nx + p.dy * ny;
      if (vn < 0) { p.dashBounces--; p.dx -= 2 * vn * nx; p.dy -= 2 * vn * ny; p.dashT = DASH.time; }
    } else p.dashT = Math.min(p.dashT, 0.02);
  }
  // everyone you pass: small damage and your payloads (decisions: payloads on the Dash, small damage)
  for (const e of g.enemies) {
    if (e.hp <= 0 || p.dashHit.has(e)) continue;
    if (Math.hypot(e.x - p.x, e.y - p.y) < p.r + e.r + 0.6) { p.dashHit.add(e); hurt(g, e, 3, 0, 0); applyPayload(g, e, p.dashPay); }
  }
  if (g.R() < 0.8) g.parts.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.25, max: 0.25, col: 'dash', s: 0.9 });
  if (p.dashT <= 0) {
    p.dashT = 0; p.safeT = DASH.safe;
    const ex = L(g, 'dash', 'explode');
    if (ex) blast(g, p.x, p.y, blastR(ex), blastDmg(ex), p.dashPay);
    if (p.chain > 0) { // Extra on the Dash: the next dash in a row, where you're steering now
      p.chain--;
      const mx = inp.move.x, my = inp.move.y, mv = Math.hypot(mx, my) > 0.2;
      startDash(g, mv ? mx : p.dx, mv ? my : p.dy, true);
    }
  }
}

// ---------- spawning ----------
// The path field, and the cells 16-44 steps away along it (where enemies can appear).
function refreshField(g) {
  const n = pathField(g.m, g.p.x, g.p.y, FIELD_STEPS, g.field), q = pathField.q;
  g.ring.length = 0;
  for (let i = 0; i < n; i++) { const d = g.field[q[i]]; if (d >= 16 && d <= 44) g.ring.push(q[i]); }
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
function targetAlive(t) { const mn = t / 60; return Math.min(80, Math.round(5 + 2.5 * mn + 0.3 * mn * mn)); }
const waveSize = (w) => 8 + (w - 1) * 6;
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
  g.t += dt; g.frame = (g.frame || 0) + 1;
  const p = g.p, m = g.m, w = g.weapon;

  // input events
  for (const ev of inp.events) {
    if (ev.type === 'fireTap' && w.tapNearest) { const e = nearestVisible(g, w.range); if (e) fire(g, e.x - p.x, e.y - p.y); else fire(g, p.fx, p.fy); }
    if (ev.type === 'fireRelease' && w.trigger === 'release') fire(g, ev.x, ev.y);
    if (ev.type === 'dashTap') startDash(g, inp.move.x, inp.move.y);
    if (ev.type === 'dashRelease') startDash(g, ev.x, ev.y);
    if (ev.type === 'spawnTap') { const e = nearestVisible(g, 9); if (e) throwBall(g, e.x - p.x, e.y - p.y); else throwBall(g, p.fx, p.fy); }
    if (ev.type === 'spawnRelease') throwBall(g, ev.x, ev.y);
  }
  g.spawnAim = inp.spawn.engaged === true ? { x: inp.spawn.x, y: inp.spawn.y } : null;
  g.spawnCool = Math.max(0, g.spawnCool - dt);
  g.aim = inp.fire.engaged === true ? { x: inp.fire.x, y: inp.fire.y } : null;
  g.dashAim = inp.dash.engaged === true ? { x: inp.dash.x, y: inp.dash.y } : null;
  if (g.aim && (w.trigger === 'hold' || w.trigger === 'auto')) fire(g, g.aim.x, g.aim.y);
  if (!g.aim && w.trigger === 'auto') { const e = nearestVisible(g, w.range); if (e) fire(g, e.x - p.x, e.y - p.y); }

  // rounds come back
  g.cool = Math.max(0, g.cool - dt); g.sinceShot += dt;
  if (w.refill === 'full') {
    if (g.reloadT > 0) { g.reloadT -= dt / cdMul(g); if (g.reloadT <= 0) { g.reloadT = 0; g.ammo = w.rounds; } }
    else if (g.ammo < 1 || (g.ammo < w.rounds && g.sinceShot >= w.refillDelay)) g.reloadT = w.reloadTime;
  } else if (g.sinceShot >= w.refillDelay) g.ammo = Math.min(w.rounds, g.ammo + w.refillRate * dt / cdMul(g));

  // dash charges
  if (p.charges < DASH.charges) { p.recharge -= dt; if (p.recharge <= 0) { p.charges++; p.recharge = p.charges < DASH.charges ? DASH.recharge * cdMul(g) : 0; } }

  // player movement
  const SPEED = 8.5 * (1 + 0.08 * g.run.vitals.speed);
  if (p.dashT > 0) stepDash(g, dt, inp);
  else {
    const mx = inp.move.x, my = inp.move.y, mm = Math.min(1, Math.hypot(mx, my));
    const tvx = mm > 0.05 ? mx / Math.hypot(mx, my) * mm * SPEED : 0, tvy = mm > 0.05 ? my / Math.hypot(mx, my) * mm * SPEED : 0;
    const k = Math.min(1, dt * 18); p.vx += (tvx - p.vx) * k; p.vy += (tvy - p.vy) * k;
    moveBody(m, p, p.vx * dt, p.vy * dt);
    if (mm > 0.2 && !g.aim) { p.fx = mx / Math.hypot(mx, my); p.fy = my / Math.hypot(mx, my); }
  }
  if (g.aim) { const d = Math.hypot(g.aim.x, g.aim.y) || 1; p.fx = g.aim.x / d; p.fy = g.aim.y / d; }
  p.hurtT = Math.max(0, p.hurtT - dt); p.safeT = Math.max(0, p.safeT - dt);

  updateSight(g);
  g.fieldT -= dt;
  if (g.fieldT <= 0) { refreshField(g); g.fieldT = 0.2; }

  // spawning: a few wanderers between waves; waves warned ahead, from a few sides
  const want = targetAlive(g.t);
  let roam = 0; for (const e of g.enemies) if (!e.camp) roam++;   // camps don't count
  g.spawnAcc += dt * (roam < want ? 0.8 + g.t / 200 : 0);
  while (g.spawnAcc >= 1) { g.spawnAcc -= 1; spawnEnemy(g, trickleType(g), 22, 40); }
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
    while (w.acc >= 1 && w.left > 0) { w.acc -= 1; w.left--; spawnEnemy(g, waveType(w.wave, w.left), 18, 40, w.sides[w.left % w.sides.length] + (g.R() - 0.5) * 0.4); }
    if (w.left <= 0) g.incoming = null;
  }

  // enemies
  const G = m.G, f = g.field;
  for (const e of g.enemies) {
    const S = ENEMIES[e.type];
    if (e.burn > 0) { // burning: damage over time, stronger with more build-up; fades when not fed
      hurt(g, e, (2 + e.burn * 0.08) * dt, 0, 0, 0, true);
      e.burnIdle += dt; if (e.burnIdle > 2) e.burn = Math.max(0, e.burn - 12 * dt);
    }
    e.flash = Math.max(0, e.flash - dt);
    if (e.sleep) { // a camp at rest: the whole camp wakes when one sees you close, or is hurt
      e.vx = e.vy = 0;
      if ((g.frame + e.id) % 6 === 0 && Math.hypot(p.x - e.x, p.y - e.y) < 16 && lineClear(m, e.x, e.y, p.x, p.y)) wakeCamp(g, e.camp);
      continue;
    }
    let dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy), toBall = false;
    let tx = 0, ty = 0, spd = e.speed;
    // a ball nearer than you, in sight: they go for it
    for (const b of g.balls) {
      const bx = b.x - e.x, by = b.y - e.y, bd = Math.hypot(bx, by);
      if (bd < 7 && bd < d && lineClear(m, e.x, e.y, b.x, b.y)) { dx = bx; dy = by; d = bd; toBall = true; }
    }
    const sees = toBall || (d < 20 && (e.type !== 'mite' || d < 12) && lineClear(m, e.x, e.y, p.x, p.y));
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
    if (e.type === 'dart') { // see you, stop and aim, charge straight to a wall, rest
      if (e.st === 'aim') {
        spd = 0; e.t -= dt;
        if (e.t > 0.2 && d > 0.1) { e.ax = dx / d; e.ay = dy / d; }   // follows you, then locks for the last 0.2 s
        if (e.t <= 0) { e.st = 'charge'; e.t = 1.1; }
      } else if (e.st === 'charge') {
        tx = e.ax; ty = e.ay; spd = S.charge; e.t -= dt;
        if (e.t <= 0) { e.st = 'rest'; e.t = 0.6; }
      } else if (e.st === 'rest') { spd = 0; e.t -= dt; if (e.t <= 0) { e.st = null; e.cd = 2; } }
      else if (e.cd <= 0 && sees && d < 16) { e.st = 'aim'; e.t = S.aim; e.ax = dx / d; e.ay = dy / d; spd = 0; }
    } else if (e.type === 'spitter' && sees && d < 20) { // keep a distance, and lob orbs
      if (d < 9) { tx = -dx / d; ty = -dy / d; } else if (d < 15) spd = 0;
      if (e.cd <= 0) {
        e.cd = S.reload; e.fx = dx / d; e.fy = dy / d;
        const o = S.orb; g.shots.push({ x: e.x + e.fx * 1.2, y: e.y + e.fy * 1.2, vx: e.fx * o.speed, vy: e.fy * o.speed, r: o.r, dmg: o.damage, life: o.life });
      }
    }
    const k = Math.min(1, dt * (e.st === 'charge' ? 20 : 6));
    e.vx += (tx * spd - e.vx) * k; e.vy += (ty * spd - e.vy) * k;
    e.x += e.vx * dt; e.y += e.vy * dt;
    const v = Math.hypot(e.vx, e.vy);
    if (e.st === 'aim') { e.fx = e.ax; e.fy = e.ay; } else if (v > 0.5 && e.type !== 'spitter') { e.fx = e.vx / v; e.fy = e.vy / v; }
  }
  // enemies don't overlap each other, or you
  separate(g);
  for (const e of g.enemies) if (pushOutOfWalls(m, e) && e.st === 'charge') { e.st = 'rest'; e.t = 0.7; burst(g, e.x + e.fx, e.y + e.fy, 'enemy', 5); }
  pushOutOfWalls(m, p);
  // far behind or lost: come back from somewhere nearer, out of sight
  for (let i = g.enemies.length - 1; i >= 0; i--) {
    const e = g.enemies[i], fd = g.field[Math.floor(e.y) * G + Math.floor(e.x)];
    if (e.camp) { // a camp that lost you goes home and rests
      if (!e.sleep && ((fd > 70 && fd !== 65535) || (e.lost || 0) > 3)) { e.x = e.home.x; e.y = e.home.y; e.sleep = true; e.lost = 0; e.st = null; }
      continue;
    }
    if ((fd > 60 && fd !== 65535) || (e.lost || 0) > 1.5) { g.enemies.splice(i, 1); spawnEnemy(g, e.type, 20, 36, Math.atan2(e.y - p.y, e.x - p.x)) || spawnEnemy(g, e.type, 20, 36); }
  }

  // touching you
  for (const e of g.enemies) {
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (d < p.r + e.r + 0.15 && p.dashT <= 0 && p.safeT <= 0 && p.hurtT <= 0) hurtPlayer(g, e.st === 'charge' ? ENEMIES[e.type].chargeDamage : ENEMIES[e.type].damage);
  }

  stepBolts(g, dt);
  stepBalls(g, dt);
  stepShots(g, dt);
  for (const b of g.blasts) b.t += dt;
  g.blasts = g.blasts.filter(b => b.t < 0.35);
  for (let i = g.enemies.length - 1; i >= 0; i--) if (g.enemies[i].hp <= 0) g.enemies.splice(i, 1);

  // chests: walk into one to open it
  for (const c of g.chests) if (!c.open && Math.hypot(c.x - p.x, c.y - p.y) < p.r + 1.1) { c.open = true; g.run.offers.push(chestOffer(g)); }

  // XP
  for (let i = g.gems.length - 1; i >= 0; i--) {
    const q = g.gems[i], dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy);
    if (d < pickupRange(g) || q.pull) { q.pull = true; const sp = 6 + (q.sp = (q.sp || 0) + dt * 40); q.x += dx / d * sp * dt; q.y += dy / d * sp * dt; }
    if (d < p.r + 0.3) {
      g.gems.splice(i, 1); g.xp += q.v;
    }
  }
  for (let need = xpNeed(g.level); g.xp >= need; need = xpNeed(g.level)) { // XP from gems or a scrapped shard
    g.xp -= need; g.level++; g.pops.push({ text: `Level ${g.level}`, t: 0 });
    if (!g.practice) g.run.offers.push(levelOffer(g));
  }

  for (let i = g.parts.length - 1; i >= 0; i--) { const q = g.parts[i]; q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.9; q.vy *= 0.9; if (q.life <= 0) g.parts.splice(i, 1); }
  for (let i = g.pops.length - 1; i >= 0; i--) { g.pops[i].t += dt; if (g.pops[i].t > 1.6) g.pops.splice(i, 1); }
}

// Round 4: "too few" level-ups, so the early ones come quicker.
export const xpNeed = (level) => 2 + level * 3;

function hurt(g, e, dmg, vx, vy, knock = 0.25, silent = false) {
  if (e.hp <= 0) return;
  e.hp -= dmg * dmgMul(g); if (!silent) e.flash = 0.08;
  if (e.sleep) wakeCamp(g, e.camp);
  const d = Math.hypot(vx, vy) || 1, kb = knock / ENEMIES[e.type].mass; e.x += vx / d * kb; e.y += vy / d * kb;
  if (e.hp <= 0) {
    g.kills++; burst(g, e.x, e.y, 'enemy', 8);
    g.gems.push({ x: e.x, y: e.y, v: ENEMIES[e.type].xp });
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
  for (const b of g.balls) for (const e of es) { // balls are solid to enemies
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
      const k = (rr - d) / (d || 0.01), yours = ENEMIES[e.type].mass > 1 ? 0.8 : 0.33;
      e.x += dx * k * (1 - yours); e.y += dy * k * (1 - yours); p.x -= dx * k * yours; p.y -= dy * k * yours;
    }
  }
}

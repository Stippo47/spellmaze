// The simulation: fixed steps, no drawing. Units are maze cells; the player is a 2x2 body (radius 1).
import { makeMaze, rayStamp, lineClear, pathField } from './maze.js';
import { WEAPONS, DASH, SPAWN } from './weapons.js';
import { level, turn, hunt, lunge, burn, blastR, blastDmg } from './modules.js';
import { TAU, rng } from './util.js';

export const SIGHT = 34;          // how far you can see, in cells
const RAYS = 540;
const FIELD_STEPS = 90;

export const ENEMIES = {
  mite: { r: 1, hp: 20, speed: 6.0, damage: 8, xp: 1 },
};

export function newGame(opts) {
  const seed = opts.seed ?? ((Math.random() * 1e9) | 0);
  const m = makeMaze({ nodes: opts.nodes, widths: opts.widths, seed });
  const g = {
    opts, seed, m, R: rng(seed ^ 0x9e3779b9), t: 0, over: false, kills: 0, xp: 0, level: 1,
    p: { x: m.start.x, y: m.start.y, r: 1, hp: 100, maxHp: 100, vx: 0, vy: 0, fx: 1, fy: 0, hurtT: 0,
         dashT: 0, dx: 0, dy: 0, charges: DASH.charges, recharge: 0 },
    weapon: null, ammo: 0, cool: 0, sinceShot: 9,
    enemies: [], bolts: [], balls: [], blasts: [], gems: [], parts: [], pops: [],
    build: opts.build || { weapon: {}, spawn: {}, dash: {} }, spawnCool: 0, spawnAim: null,
    seen: new Float32Array(m.G * m.G), // when each cell was last in view (+1; 0 = never)
    visStamp: new Uint32Array(m.G * m.G), visNow: 0,
    vis: new Float32Array(RAYS * 2), field: new Uint16Array(m.G * m.G), fieldT: 0,
    spawnAcc: 0, nextWave: 60, wave: 0, aim: null, dashAim: null,
    ring: [],
  };
  setWeapon(g, opts.weapon || 'pistol');
  refreshField(g);
  updateSight(g);
  return g;
}

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
      dmg: w.damage, left: w.range, bounces, home, pay, ex });
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
  g.spawnCool = SPAWN.cooldown;
  const n = 1 + L(g, 'spawn', 'extra'), base = Math.atan2(ay, ax);
  for (let i = 0; i < n; i++) {
    const a = base + (i - (n - 1) / 2) * 0.35, dx = Math.cos(a), dy = Math.sin(a);
    g.balls.push({ x: g.p.x + dx * 1.2, y: g.p.y + dy * 1.2, vx: dx * SPAWN.speed, vy: dy * SPAWN.speed, r: SPAWN.r,
      hp: SPAWN.hp, maxHp: SPAWN.hp, life: SPAWN.life, hurtT: 0, cd: new Map(),
      bounces: L(g, 'spawn', 'bounce'), home: L(g, 'spawn', 'home'), pay: payload(g, 'spawn'), ex: L(g, 'spawn', 'explode') });
  }
}

function stepBalls(g, dt) {
  const m = g.m;
  for (let i = g.balls.length - 1; i >= 0; i--) {
    const b = g.balls[i];
    b.life -= dt; b.hurtT -= dt;
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
    if (b.hp <= 0 || b.life <= 0) {
      burst(g, b.x, b.y, 'player', 10);
      if (b.ex) blast(g, b.x, b.y, blastR(b.ex) + 1, blastDmg(b.ex) * 2, b.pay);
      g.balls.splice(i, 1);
    }
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
    p.charges -= 1; if (p.recharge <= 0) p.recharge = DASH.recharge;
    p.chain = L(g, 'dash', 'extra');
  }
  p.dashT = DASH.time; p.dx = dx; p.dy = dy; p.fx = dx; p.fy = dy;
  p.dashBounces = L(g, 'dash', 'bounce'); p.dashHit = new Set(); p.dashPay = payload(g, 'dash');
  for (let i = 0; i < 10; i++) g.parts.push({ x: p.x, y: p.y, vx: -dx * 6 + (g.R() - 0.5) * 6, vy: -dy * 6 + (g.R() - 0.5) * 6, life: 0.35, max: 0.35, col: 'dash', s: 0.35 });
}

function stepDash(g, dt, inp) {
  const p = g.p, m = g.m, sp = DASH.length / DASH.time;
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
    p.dashT = 0;
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
    const s = ENEMIES[type];
    g.enemies.push({ type, x, y, r: s.r, hp: s.hp, maxHp: s.hp, speed: s.speed * (0.9 + g.R() * 0.2), vx: 0, vy: 0, flash: 0, seen: false });
    return true;
  }
  return false;
}

// Stage 1 has no upgrades yet, so the crowd grows gently.
function targetAlive(t) { const mn = t / 60; return Math.min(240, Math.round(6 + 6 * mn + 1.5 * mn * mn)); }

// ---------- step ----------
export function step(g, dt, inp) {
  if (g.over) return;
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
    if (g.reloadT > 0) { g.reloadT -= dt; if (g.reloadT <= 0) { g.reloadT = 0; g.ammo = w.rounds; } }
    else if (g.ammo < 1 || (g.ammo < w.rounds && g.sinceShot >= w.refillDelay)) g.reloadT = w.reloadTime;
  } else if (g.sinceShot >= w.refillDelay) g.ammo = Math.min(w.rounds, g.ammo + w.refillRate * dt);

  // dash charges
  if (p.charges < DASH.charges) { p.recharge -= dt; if (p.recharge <= 0) { p.charges++; p.recharge = p.charges < DASH.charges ? DASH.recharge : 0; } }

  // player movement
  const SPEED = 8.5;
  if (p.dashT > 0) stepDash(g, dt, inp);
  else {
    const mx = inp.move.x, my = inp.move.y, mm = Math.min(1, Math.hypot(mx, my));
    const tvx = mm > 0.05 ? mx / Math.hypot(mx, my) * mm * SPEED : 0, tvy = mm > 0.05 ? my / Math.hypot(mx, my) * mm * SPEED : 0;
    const k = Math.min(1, dt * 18); p.vx += (tvx - p.vx) * k; p.vy += (tvy - p.vy) * k;
    moveBody(m, p, p.vx * dt, p.vy * dt);
    if (mm > 0.2 && !g.aim) { p.fx = mx / Math.hypot(mx, my); p.fy = my / Math.hypot(mx, my); }
  }
  if (g.aim) { const d = Math.hypot(g.aim.x, g.aim.y) || 1; p.fx = g.aim.x / d; p.fy = g.aim.y / d; }
  p.hurtT = Math.max(0, p.hurtT - dt);

  updateSight(g);
  g.fieldT -= dt;
  if (g.fieldT <= 0) { refreshField(g); g.fieldT = 0.2; }

  // spawning: keep the count up, and every minute a wave from a few sides
  const want = targetAlive(g.t);
  g.spawnAcc += dt * (g.enemies.length < want ? 3 + g.t / 30 : 0);
  while (g.spawnAcc >= 1) { g.spawnAcc -= 1; spawnEnemy(g, 'mite', 20, 36); }
  if (g.t >= g.nextWave) {
    g.wave++; g.nextWave += 60;
    // from a few sides, not every side (round 2 answer): 2 or 3 directions
    const n = 8 + g.wave * 6, k = 2 + (g.R() < 0.5 ? 1 : 0), a0 = g.R() * TAU, sides = [];
    for (let j = 0; j < k; j++) sides.push(a0 + j * TAU / k + (g.R() - 0.5) * 0.8);
    for (let i = 0; i < n; i++) spawnEnemy(g, 'mite', 18, 40, sides[i % k] + (g.R() - 0.5) * 0.4);
    g.pops.push({ text: `Wave ${g.wave}`, t: 0, big: true });
  }

  // enemies
  const G = m.G, f = g.field;
  for (const e of g.enemies) {
    if (e.burn > 0) { // burning: damage over time, stronger with more build-up; fades when not fed
      hurt(g, e, (2 + e.burn * 0.08) * dt, 0, 0, 0, true);
      e.burnIdle += dt; if (e.burnIdle > 2) e.burn = Math.max(0, e.burn - 12 * dt);
    }
    let dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy), toBall = false;
    let tx = 0, ty = 0;
    // a ball nearer than you, in sight: they go for it
    for (const b of g.balls) {
      const bx = b.x - e.x, by = b.y - e.y, bd = Math.hypot(bx, by);
      if (bd < 7 && bd < d && lineClear(m, e.x, e.y, b.x, b.y)) { dx = bx; dy = by; d = bd; toBall = true; }
    }
    if (toBall || (d < 12 && lineClear(m, e.x, e.y, p.x, p.y))) { tx = dx / (d || 1); ty = dy / (d || 1); }
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
    const k = Math.min(1, dt * 6);
    e.vx += (tx * e.speed - e.vx) * k; e.vy += (ty * e.speed - e.vy) * k;
    e.x += e.vx * dt; e.y += e.vy * dt;
    e.flash = Math.max(0, e.flash - dt);
  }
  // enemies don't overlap each other, or you
  separate(g);
  for (const e of g.enemies) pushOutOfWalls(m, e);
  pushOutOfWalls(m, p);
  // far behind or lost: come back from somewhere nearer, out of sight
  for (let i = g.enemies.length - 1; i >= 0; i--) {
    const e = g.enemies[i], fd = g.field[Math.floor(e.y) * G + Math.floor(e.x)];
    if ((fd > 60 && fd !== 65535) || (e.lost || 0) > 1.5) { g.enemies.splice(i, 1); spawnEnemy(g, e.type, 20, 36); }
  }

  // touching you
  for (const e of g.enemies) {
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (d < p.r + e.r + 0.15 && p.dashT <= 0 && p.hurtT <= 0) {
      p.hp -= ENEMIES[e.type].damage; p.hurtT = 0.5;
      if (p.hp <= 0) { p.hp = 0; g.over = true; burst(g, p.x, p.y, 'player', 30); }
    }
  }

  stepBolts(g, dt);
  stepBalls(g, dt);
  for (const b of g.blasts) b.t += dt;
  g.blasts = g.blasts.filter(b => b.t < 0.35);
  for (let i = g.enemies.length - 1; i >= 0; i--) if (g.enemies[i].hp <= 0) g.enemies.splice(i, 1);

  // XP
  for (let i = g.gems.length - 1; i >= 0; i--) {
    const q = g.gems[i], dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy);
    if (d < 3.5 || q.pull) { q.pull = true; const sp = 6 + (q.sp = (q.sp || 0) + dt * 40); q.x += dx / d * sp * dt; q.y += dy / d * sp * dt; }
    if (d < p.r + 0.3) {
      g.gems.splice(i, 1); g.xp += q.v;
      const need = 5 + g.level * 4;
      if (g.xp >= need) { g.xp -= need; g.level++; g.pops.push({ text: `Level ${g.level}`, t: 0 }); }
    }
  }

  for (let i = g.parts.length - 1; i >= 0; i--) { const q = g.parts[i]; q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.9; q.vy *= 0.9; if (q.life <= 0) g.parts.splice(i, 1); }
  for (let i = g.pops.length - 1; i >= 0; i--) { g.pops[i].t += dt; if (g.pops[i].t > 1.6) g.pops.splice(i, 1); }
}

function hurt(g, e, dmg, vx, vy, knock = 0.25, silent = false) {
  if (e.hp <= 0) return;
  e.hp -= dmg; if (!silent) e.flash = 0.08;
  const d = Math.hypot(vx, vy) || 1; e.x += vx / d * knock; e.y += vy / d * knock;
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
        const d = Math.sqrt(d2) || 0.01, push = (rr - d) / 2 * 0.9, nx = d2 ? dx / d : 1, ny = d2 ? dy / d : 0;
        e.x -= nx * push; e.y -= ny * push; o.x += nx * push; o.y += ny * push;
      }
    }
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
    } else { // the crowd pushes back: you take a third of the shove, so a packed corridor holds you
      const k = (rr - d) / (d || 0.01); e.x += dx * k * 0.67; e.y += dy * k * 0.67; p.x -= dx * k * 0.33; p.y -= dy * k * 0.33;
    }
  }
}

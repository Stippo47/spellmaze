// Films the game frame by frame in headless Edge, with a simple bot playing through real touch events.
// Serve the repo on :8737 first (python -m http.server 8737), then:
//   node tools/film.mjs <scene> [out folder]      scenes: see SCENES below; "all" films every one
//   node tools/film.mjs perf                       times the step and the draw with a big crowd
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://127.0.0.1:8737/';
const OUT = process.argv[3] || 'films';
mkdirSync(OUT, { recursive: true });

// Each scene: url options, seconds to play unfilmed first, seconds to film, and what the bot does.
const SCENES = {
  pistol:   { q: 'weapon=pistol&sight=remember', warm: 50, film: 14, bot: { fire: 'release', dash: true } },
  smg:      { q: 'weapon=smg&sight=remember', warm: 70, film: 9, bot: { fire: 'hold', dash: true } },
  auto:     { q: 'weapon=auto&sight=remember', warm: 40, film: 9, bot: { fire: 'none', dash: true } },
  dash:     { q: 'weapon=pistol&sight=remember', warm: 75, film: 9, bot: { fire: 'release', dash: true } },
  seeall:   { q: 'weapon=pistol&sight=all', warm: 50, film: 8, bot: { fire: 'release', dash: true } },
  dark:     { q: 'weapon=pistol&sight=dark', warm: 50, film: 8, bot: { fire: 'release', dash: true } },
};

const BOT = () => {
  const SM = window.SM, cv = document.getElementById('game');
  const B = window.BOT = { goal: -1, gf: null, f: 0, fire: null, move: null, dash: null, cfg: {} };
  const ev = (type, id, x, y) => cv.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: id === 11 }));
  function pickGoal(g) {
    // goals: far node centres that aren't dead ends (dead ends get you cornered)
    const m = g.m, G = m.G, P = m.P, N = m.N; let d = null;
    for (let t = 0; t < 200 && !d; t++) {
      const i = (Math.random() * N) | 0, j = (Math.random() * N) | 0, x = 1 + i * P + P / 2, y = 1 + j * P + P / 2;
      if (Math.hypot(x - g.p.x, y - g.p.y) > 35 && !m.deadEnds.some(e => e.x === x && e.y === y)) d = { x, y };
    }
    d = d || m.deadEnds[0];
    B.gf = B.gf || new Uint16Array(G * G);
    SM.lib.pathField(m, d.x, d.y, 4000, B.gf); B.goal = d;
  }
  B.think = () => {
    const g = SM.g, p = g.p, m = g.m, G = m.G, L = SM.inp.layout; B.f++;
    // stuck for a second: new goal, and dash out
    if (B.f % 30 === 0) { const st = B.last && Math.hypot(p.x - B.last.x, p.y - B.last.y) < 2; B.last = { x: p.x, y: p.y }; if (st) { B.push = 45; B.gf = null; } }
    B.push = Math.max(0, (B.push || 0) - 1); B.stuck = B.push > 0;
    if (!B.gf || B.gf[Math.floor(p.y) * G + Math.floor(p.x)] < 4) pickGoal(g);
    // where to go: down the goal field, away from close enemies
    const c = Math.floor(p.y) * G + Math.floor(p.x); let best = 65535, here = 65535, bx = 0, by = 0;
    for (let oy = -3; oy <= 3; oy++) for (let ox = -3; ox <= 3; ox++) { const n = c + oy * G + ox; if (Math.abs(ox) <= 1 && Math.abs(oy) <= 1) here = Math.min(here, B.gf[n]); }
    for (let oy = -3; oy <= 3; oy++) for (let ox = -3; ox <= 3; ox++) { const n = c + oy * G + ox; if (B.gf[n] < best && B.gf[n] < here) { best = B.gf[n]; bx = ox; by = oy; } }
    let mx = bx, my = by; const md = Math.hypot(mx, my) || 1; mx /= md; my /= md;
    let ax = 0, ay = 0, near = null, nd = 1e9;
    for (const e of g.enemies) {
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
      if (d < 8 && d > 0.3) { ax += dx / (d * d); ay += dy / (d * d); }
      if (d < g.weapon.range - 1 && d < nd && SM.lib.lineClear(m, p.x, p.y, e.x, e.y)) { nd = d; near = e; }
    }
    if (!B.stuck) { mx += ax * 3; my += ay * 3; } const mm = Math.hypot(mx, my) || 1; mx /= mm; my /= mm;
    const base = { x: L.w * 0.17, y: L.h * 0.7 };
    if (!B.move) { ev('pointerdown', 11, base.x, base.y); B.move = base; }
    ev('pointermove', 11, base.x + mx * L.moveR * 0.95, base.y + my * L.moveR * 0.95);
    // firing
    const F = L.fire, mode = B.cfg.fire;
    if (mode === 'release') {
      if (!B.fire && near && g.ammo >= 1 && g.cool <= 0) { ev('pointerdown', 12, F.x, F.y); B.fire = { f: B.f, e: near }; }
      else if (B.fire) {
        const e = B.fire.e, dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1, k = Math.min(1, (B.f - B.fire.f) / 2) * 0.85;
        ev('pointermove', 12, F.x + dx / d * F.r * k, F.y + dy / d * F.r * k);
        if (B.f - B.fire.f >= 4) { ev('pointerup', 12, F.x + dx / d * F.r * k, F.y + dy / d * F.r * k); B.fire = null; }
      }
    } else if (mode === 'hold') {
      if (near && g.ammo >= 1) {
        if (!B.fire) { ev('pointerdown', 12, F.x, F.y); B.fire = { f: B.f }; }
        const dx = near.x - p.x, dy = near.y - p.y, d = Math.hypot(dx, dy) || 1;
        ev('pointermove', 12, F.x + dx / d * F.r * 0.85, F.y + dy / d * F.r * 0.85);
      } else if (B.fire) { ev('pointerup', 12, F.x, F.y); B.fire = null; }
    }
    // dash away through the crowd now and then
    if (B.cfg.dash) {
      const D = L.dash;
      if (!B.dash && p.charges >= 1 && (Math.hypot(ax, ay) > 0.25 || B.stuck) && B.f % 6 === 0) { ev('pointerdown', 13, D.x, D.y); B.dash = { f: B.f }; }
      else if (B.dash) {
        const k = Math.min(1, (B.f - B.dash.f) / 2) * 0.8;
        ev('pointermove', 13, D.x + mx * F.r * k, D.y + my * F.r * k);
        if (B.f - B.dash.f >= 3) { ev('pointerup', 13, D.x + mx * F.r * k, D.y + my * F.r * k); B.dash = null; }
      }
    }
  };
};

async function open(browser, q) {
  const page = await browser.newPage({ viewport: { width: 896, height: 414 }, deviceScaleFactor: 2, hasTouch: true });
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  await page.goto(`${BASE}?seed=7&fingers=1&${q}`);
  await page.waitForFunction(() => window.SM);
  await page.evaluate(() => { SM.setManual(true); });
  await page.evaluate(BOT);
  return page;
}

async function film(browser, name) {
  const sc = SCENES[name];
  const page = await open(browser, sc.q);
  await page.evaluate((cfg) => { BOT.cfg = cfg; }, sc.bot);
  // play unfilmed: 2 steps per bot thought, health kept up so the film has a crowd
  await page.evaluate((frames) => { for (let i = 0; i < frames; i++) { BOT.think(); SM.advance(2); SM.g.p.hp = Math.max(SM.g.p.hp, 60); } }, sc.warm * 30);
  const dir = join(OUT, '_' + name); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const n = sc.film * 30;
  for (let i = 0; i < n; i++) {
    const data = await page.evaluate(() => { BOT.think(); SM.advance(2); SM.g.p.hp = Math.max(SM.g.p.hp, 30); return document.getElementById('game').toDataURL('image/jpeg', 0.92); });
    writeFileSync(join(dir, `f${String(i).padStart(4, '0')}.jpg`), Buffer.from(data.split(',')[1], 'base64'));
  }
  const info = await page.evaluate(() => ({ t: SM.g.t, foes: SM.g.enemies.length, kills: SM.g.kills }));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', join(dir, 'f%04d.jpg'), '-vf', 'scale=1280:-2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', join(OUT, name + '.mp4')]);
  writeFileSync(join(OUT, name + '.jpg'), Buffer.from((await page.evaluate(() => document.getElementById('game').toDataURL('image/jpeg', 0.92))).split(',')[1], 'base64'));
  rmSync(dir, { recursive: true, force: true });
  console.log(name, info);
  await page.close();
}

async function perf(browser) {
  const page = await open(browser, 'weapon=smg&sight=remember');
  await page.evaluate(() => { BOT.cfg = { fire: 'hold' }; });
  const r = await page.evaluate(() => {
    const out = [];
    for (const until of [60, 180, 300, 420]) {
      while (SM.g.t < until) { BOT.think(); SM.advance(2); SM.g.p.hp = 100; }
      let t0 = performance.now(); for (let i = 0; i < 60; i++) { BOT.think(); SM.advance(1); SM.g.p.hp = 100; } const both = (performance.now() - t0) / 60;
      t0 = performance.now(); for (let i = 0; i < 60; i++) SM.R.draw(SM.g, SM.inp, SM.opts); const draw = (performance.now() - t0) / 60;
      out.push({ t: Math.round(SM.g.t), foes: SM.g.enemies.length, bolts: SM.g.bolts.length, stepPlusDrawMs: +both.toFixed(2), drawMs: +draw.toFixed(2) });
    }
    return out;
  });
  console.table(r);
  await page.close();
}

// Stills: the same moment under every sight setting, corridor set and camera.
async function stills(browser) {
  const page = await open(browser, 'weapon=pistol&sight=remember');
  await page.evaluate(() => { BOT.cfg = { fire: 'release' }; for (let i = 0; i < 40 * 30; i++) { BOT.think(); SM.advance(2); SM.g.p.hp = 100; } });
  const shot = async (file) => writeFileSync(join(OUT, file), Buffer.from((await page.evaluate(() => document.getElementById('game').toDataURL('image/png'))).split(',')[1], 'base64'));
  for (const s of ['remember', 'all', 'dark']) { await page.evaluate((s) => { SM.setOpt('sight', s); SM.advance(0); }, s); await shot(`sight-${s}.png`); }
  await page.evaluate(() => SM.setOpt('sight', 'remember'));
  for (const v of [16, 22, 28, 36]) { await page.evaluate((v) => { SM.setOpt('view', v); SM.advance(0); }, v); await shot(`view-${v}.png`); }
  await page.evaluate(() => SM.setOpt('view', 22));
  // corridor sets: a fresh run on each, played a little, with see-all so the maze shows
  for (const w of ['mixed', 'standard', 'narrow', 'wide']) {
    await page.evaluate((w) => { SM.setOpt('widths', w); SM.setOpt('sight', 'all'); SM.setOpt('view', 36); SM.restart(true); BOT.gf = null;
      for (let i = 0; i < 25 * 30; i++) { BOT.think(); SM.advance(2); SM.g.p.hp = 100; } }, w);
    await shot(`widths-${w}.png`);
  }
  await page.close();
}

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const what = process.argv[2] || 'all';
if (what === 'perf') await perf(browser);
else if (what === 'stills') await stills(browser);
else for (const s of what === 'all' ? Object.keys(SCENES) : what.split(',')) await film(browser, s);
await browser.close();

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
const MODS = ['extra', 'bounce', 'home', 'burn', 'explode'];
const SCENES = {
  pistol:   { q: 'weapon=pistol&sight=remember', warm: 50, film: 14, bot: { fire: 'release', dash: true } },
  smg:      { q: 'weapon=smg&sight=remember', warm: 70, film: 9, bot: { fire: 'hold', dash: true } },
  auto:     { q: 'weapon=auto&sight=remember', warm: 40, film: 9, bot: { fire: 'none', dash: true } },
  dash:     { q: 'weapon=pistol&sight=remember', warm: 75, film: 9, bot: { fire: 'release', dash: true } },
  seeall:   { q: 'weapon=pistol&sight=all', warm: 50, film: 8, bot: { fire: 'release', dash: true } },
  dark:     { q: 'weapon=pistol&sight=dark', warm: 50, film: 8, bot: { fire: 'release', dash: true } },
};
// Stage 2: every module on every cast at level 3, a few seconds each.
for (const cast of ['weapon', 'spawn', 'dash']) for (const mod of MODS) {
  SCENES[`m-${cast}-${mod}`] = { q: 'weapon=pistol&sight=remember', warm: 35, film: 6, small: true,
    build: { weapon: {}, spawn: {}, dash: {}, [cast]: { [mod]: 3 } },
    bot: { fire: cast === 'weapon' ? 'release' : 'none', spawn: cast === 'spawn', dash: cast === 'dash', dashAt: cast === 'dash', approach: cast === 'dash' } };
  if (cast === 'dash') SCENES[`m-${cast}-${mod}`].film = 8;
}
// Round 4: a normal run (no practice build), filmed through a wave's warning and arrival; spawns bumping and draining.
SCENES['wave'] = { q: 'weapon=pistol&sight=remember', warm: 66, film: 14, run: true, bot: { fire: 'release', dash: true, spawn: true } };
SCENES['spawns'] = { q: 'weapon=pistol&sight=remember', warm: 30, film: 10, small: true, build: { weapon: {}, spawn: { extra: 2 }, dash: {} },
  bot: { fire: 'none', spawn: true } };
// Stage 4: a camp woken in its room; the three new enemies at once; a dash through spitter orbs.
const NEAR_CAMP = `(() => { const g = SM.g, m = g.m, c = g.camps.find(c => c.tier === 1) || g.camps[0], f = new Uint16Array(m.G * m.G);
  const n = SM.lib.pathField(m, c.x, c.y, 60, f), q = SM.lib.pathField.q; let best = q[0];
  for (let i = 0; i < n; i++) if (f[q[i]] >= 22) { best = q[i]; break; }
  g.p.x = (best % m.G) + 0.5; g.p.y = ((best / m.G) | 0) + 0.5; g.enemies = g.enemies.filter(e => e.camp); g.nextWave = 1e9; g.waveWarn = null;
  BOT.gf = new Uint16Array(m.G * m.G); SM.lib.pathField(m, c.x, c.y, 4000, BOT.gf); })()`;
const TRIO = `(() => { const g = SM.g, m = g.m, p = g.p, rays = [];
  g.enemies = g.enemies.filter(e => e.camp && Math.hypot(e.x - p.x, e.y - p.y) > 45); g.nextWave = 1e9; g.waveWarn = null;
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; let r = 0; while (r < 16 && SM.lib.lineClear(m, p.x, p.y, p.x + Math.cos(a) * (r + 1.5), p.y + Math.sin(a) * (r + 1.5))) r++; rays.push({ a, r }); }
  rays.sort((x, y) => y.r - x.r); const used = [];
  for (const t of ['dart', 'spitter', 'brute', 'dart']) { const o = rays.find(o => used.every(u => Math.abs(Math.atan2(Math.sin(o.a - u), Math.cos(o.a - u))) > 0.9)) || rays[0]; used.push(o.a);
    const r = Math.min(13, o.r - 1); SM.lib.makeEnemy(g, t, p.x + Math.cos(o.a) * r, p.y + Math.sin(o.a) * r); } })()`;
// Round 5: breaking blocks. A scripted player walks to the nearest block it can see, shoots it with the SMG, and
// dashes into every other one.
const BLOCKS = `(() => { const g = SM.g, p = g.p, m0 = g.m, G = m0.G;
  // round 6: tiles are single cells. Find tiles in sight, shoot them with the SMG, dash into every other group;
  // the clip jumps to the next tiles when none are in reach.
  const near = (r) => { let best = null, bd = r; const px = Math.floor(p.x), py = Math.floor(p.y);
    for (let y = py - r; y <= py + r; y++) for (let x = px - r; x <= px + r; x++) { if (m0.cells[y * G + x] !== 2) continue;
      const tx = x + 0.5, ty = y + 0.5, d = Math.hypot(tx - p.x, ty - p.y); if (d >= bd || d < 0.5) continue;
      if (SM.lib.lineClear(m0, p.x, p.y, tx - (tx - p.x) / d * 0.9, ty - (ty - p.y) / d * 0.9)) { bd = d; best = { x: tx, y: ty, i: y * G + x }; } }
    return best; };
  const hop = () => { for (let r = 10; r < 200; r += 6) for (let k = 0; k < 40; k++) { const a = Math.random() * 6.283, x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r, c = Math.floor(y) * G + Math.floor(x);
      if (!m0.clear[c]) continue; const ox = p.x, oy = p.y; p.x = x; p.y = y; const t = near(9); if (t && t.d !== 0) return; p.x = ox; p.y = oy; } };
  g.enemies = g.enemies.filter(e => e.camp && Math.hypot(e.x - p.x, e.y - p.y) > 50); g.nextWave = 1e9; g.waveWarn = null; g.spawnAcc = -1e9;
  SM.setOpt('weapon', 'smg'); hop(); let n = 0, idle = 0, tg = null, dashT = 0;
  BOT.think = () => { const I = SM.inp;
    if (!tg || m0.cells[tg.i] !== 2) { tg = near(14); n++; }
    I.fire.engaged = false; I.fire.down = false; I.move.x = 0; I.move.y = 0;
    if (!tg) { if (++idle > 15) { hop(); idle = 0; } return; }
    idle = 0;
    const dx = tg.x - p.x, dy = tg.y - p.y, d = Math.hypot(dx, dy);
    if (n % 3 === 0 && d < 8) { if (dashT-- <= 0 && p.charges >= 1) { I.events.push({ type: 'dashRelease', x: dx / d, y: dy / d }); dashT = 14; } return; }
    if (d > 9) { I.move.x = dx / d; I.move.y = dy / d; return; }
    I.fire.engaged = true; I.fire.down = true; I.fire.x = dx / d; I.fire.y = dy / d; }; })()`;
SCENES['blocks'] = { q: 'weapon=smg&sight=remember', warm: 1, film: 12, small: true, setup: BLOCKS, bot: {} };
// Stage 4 part 2: the four new statuses, and the Hulk.
SCENES['chill'] = { q: 'weapon=smg&sight=remember', warm: 40, film: 9, small: true, build: { weapon: { chill: 4 }, spawn: {}, dash: {} }, bot: { fire: 'hold', dash: true } };
SCENES['shockmark'] = { q: 'weapon=smg&sight=remember', warm: 40, film: 9, small: true, build: { weapon: { shock: 4, mark: 3 }, spawn: {}, dash: {} }, bot: { fire: 'hold', dash: true } };
SCENES['poison'] = { q: 'weapon=smg&sight=remember', warm: 40, film: 9, small: true, build: { weapon: { poison: 5 }, spawn: {}, dash: {} }, bot: { fire: 'hold', dash: true } };
SCENES['hulk'] = { q: 'weapon=smg&sight=remember', warm: 2, film: 14, small: true, build: { weapon: { extra: 2 }, spawn: {}, dash: {} },
  setup: `(() => { const g = SM.g; g.p.maxHp = g.p.hp = 5000; g.nextBoss = g.t + 0.1; g.nextWave = 1e9; g.waveWarn = null; for (let i = 0; i < 400 && !g.boss; i++) SM.advance(1);
    const b = g.boss, m = g.m; if (b) { const c = g.ring.find(c => g.field[c] >= 22 && g.field[c] <= 26); if (c != null) { b.x = (c % m.G) + 0.5; b.y = ((c / m.G) | 0) + 0.5; } } SM.advance(0); })()`, bot: { fire: 'hold', dash: true } };
SCENES['camp'] = { q: 'weapon=pistol&sight=remember', warm: 3, film: 14, small: true, setup: NEAR_CAMP, bot: { fire: 'release', dash: true, approach: true } };
SCENES['enemies'] = { q: 'weapon=pistol&sight=remember', warm: 3, film: 10, small: true, setup: TRIO, bot: { fire: 'release', dash: true, approach: true } };
SCENES['combo-fire'] = { q: 'weapon=smg&sight=remember', warm: 60, film: 9, small: true,
  build: { weapon: { burn: 2, bounce: 2, extra: 1 }, spawn: { burn: 2, home: 2, explode: 2 }, dash: { burn: 2, extra: 1, explode: 1 } },
  bot: { fire: 'hold', spawn: true, dash: true, dashAt: true } };

async function open(browser, q, small) {
  const page = await browser.newPage({ viewport: { width: 896, height: 414 }, deviceScaleFactor: small ? 1.25 : 2, hasTouch: true });
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  await page.goto(`${BASE}?seed=7&fingers=1&${q}`);
  await page.waitForFunction(() => window.SM);
  await page.evaluate(() => { SM.setManual(true); });
  await page.addScriptTag({ path: 'tools/bot.js' });
  return page;
}

async function film(browser, name) {
  const sc = SCENES[name];
  const page = await open(browser, sc.q, sc.small);
  await page.evaluate((sc) => { BOT.cfg = sc.bot; SM.setOpt('build', sc.run ? null : sc.build || { weapon: {}, spawn: {}, dash: {} }); }, sc);
  // play unfilmed: 2 steps per bot thought, health kept up so the film has a crowd
  await page.evaluate((frames) => { for (let i = 0; i < frames; i++) { BOT.think(); SM.advance(2); SM.g.p.hp = Math.max(SM.g.p.hp, 60); } }, sc.warm * 30);
  if (sc.setup) await page.evaluate(sc.setup);
  const dir = join(OUT, '_' + name); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const n = sc.film * 30;
  for (let i = 0; i < n; i++) {
    const data = await page.evaluate(() => { BOT.think(); SM.advance(2); SM.g.p.hp = Math.max(SM.g.p.hp, 30); return document.getElementById('game').toDataURL('image/jpeg', 0.92); });
    writeFileSync(join(dir, `f${String(i).padStart(4, '0')}.jpg`), Buffer.from(data.split(',')[1], 'base64'));
  }
  const info = await page.evaluate(() => ({ t: SM.g.t, foes: SM.g.enemies.length, kills: SM.g.kills }));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', join(dir, 'f%04d.jpg'), '-vf', `scale=${sc.small ? 1120 : 1280}:-2`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', join(OUT, name + '.mp4')]);
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

// Cards (round 4): the start pick, level-ups, a shard, the build, and a wave warning, with the game drawn behind.
async function cards(browser) {
  const page = await open(browser, 'weapon=pistol&sight=remember');
  const snap = async (file) => { await page.evaluate(() => { SM.setManual(false); SM.setPaused(true); }); await page.waitForTimeout(250);
    await page.screenshot({ path: join(OUT, file) }); await page.evaluate(() => { SM.setPaused(false); SM.setManual(true); }); };
  const hide = () => page.evaluate(() => document.querySelectorAll('.screen').forEach(e => e.classList.add('hidden')));
  await page.evaluate(() => SM.showOffer());
  await snap('card-start.png');
  await page.evaluate(() => { BOT.cfg = { fire: 'release', dash: true, spawn: true }; SM.pickOffer(0);
    for (let i = 0; i < 150 * 30 && !(SM.g.run.offers[0] && SM.g.run.offers[0].modules); i++) { BOT.think(); SM.advance(2); SM.g.p.hp = 100;
      const o = SM.g.run.offers[0]; if (o && !o.modules) SM.pickOffer(0); } SM.showOffer(); });
  await snap('card-modules.png');
  await page.evaluate(() => { SM.pickOffer(1);
    for (let i = 0; i < 150 * 30 && !(SM.g.run.offers[0] && !SM.g.run.offers[0].modules && SM.g.run.offers[0].cards.some(c => c.type === 'mod')); i++) { BOT.think(); SM.advance(2); SM.g.p.hp = 100;
      const o = SM.g.run.offers[0]; if (o && (o.modules || !o.cards.some(c => c.type === 'mod'))) SM.pickOffer(0); } SM.showOffer(); });
  await snap('card-level.png');
  await page.evaluate(() => { SM.pickOffer(0); SM.g.run.offers.push({ kind: 'chest', id: SM.g.run.mods.spawn[0] ? SM.g.run.mods.spawn[0].id : 'home', rarity: 'rare' }); SM.showOffer(); });
  await snap('card-shard.png');
  await page.evaluate(() => { SM.pickOffer(0); });
  await hide();
  await page.evaluate(() => { document.getElementById('openbuild').click(); });
  await snap('build.png');
  await hide();
  // a wave warning, and a shard on screen
  await page.evaluate(() => { const g = SM.g; g.nextWave = g.t + 6; g.waveWarn = null; SM.advance(1);
    const c = g.chests.find(c => !c.open), m = g.m;
    if (c) for (const [dx, dy] of [[0, -6], [0, 6], [6, 0], [-6, 0], [4, -4], [-4, 4]]) { const x = g.p.x + dx, y = g.p.y + dy; if (m.clear[Math.floor(y) * m.G + Math.floor(x)] && SM.lib.lineClear(m, g.p.x, g.p.y, x, y)) { c.x = x; c.y = y; break; } }
    SM.advance(1); });
  await snap('wave-warn.png');
  await page.close();
}

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const what = process.argv[2] || 'all';
if (what === 'perf') await perf(browser);
else if (what === 'cards') await cards(browser);
else if (what === 'stills') await stills(browser);
else {
  const names = what === 'all' ? Object.keys(SCENES) : what === 'modules' ? Object.keys(SCENES).filter(k => k.startsWith('m-') || k.startsWith('combo')) : what.split(',');
  for (const s of names) await film(browser, s);
}
await browser.close();

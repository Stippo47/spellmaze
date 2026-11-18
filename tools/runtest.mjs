// A normal run played by the bot, headless: how the crowd, waves and levels go over time, and any page errors.
//   node tools/runtest.mjs [minutes] [seed]      (serve the repo on :8737 first)
import { chromium } from 'playwright-core';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const minutes = +(process.argv[2] || 5), seed = +(process.argv[3] || 7);
const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 896, height: 414 }, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://127.0.0.1:8737/?seed=${seed}&weapon=pistol&practice=0`);
await page.waitForFunction(() => window.SM);
await page.evaluate(() => { SM.setManual(true); SM.setOpt('build', null); });
await page.addScriptTag({ path: 'tools/bot.js' });
const rows = await page.evaluate((minutes) => {
  BOT.cfg = { fire: 'release', dash: true, spawn: true };
  const out = [], picks = [];
  const orig = SM.pickOffer;
  SM.pickOffer = (i) => { const o = SM.g.run.offers[0]; picks.push(`${Math.round(SM.g.t)}s ${o.kind}${o.modules ? '(modules)' : ''}: ${(o.cards || [{ id: o.id }]).map(c => c.id + (c.cast ? '@' + c.cast : '')).join(' ')}`); orig(i); };
  let hurt = 0, lastHp = SM.g.p.hp;
  for (let s = 10; s <= minutes * 60; s += 10) {
    while (SM.g.t < s && !SM.g.over) { BOT.think(); SM.advance(2); if (SM.g.p.hp < lastHp) hurt += lastHp - SM.g.p.hp; SM.g.p.hp = Math.max(SM.g.p.hp, 40); lastHp = SM.g.p.hp; }
    const g = SM.g;
    out.push({ t: s, foes: g.enemies.length, wave: g.wave, warn: g.waveWarn ? g.waveWarn.wave : '', kills: g.kills, level: g.level, hurt: Math.round(hurt),
      mods: ['weapon', 'spawn', 'dash'].map(c => g.run.mods[c].map(m => m.id[0] + m.level).join('')).join('|'), shards: g.chests.filter(c => c.open).length });
    hurt = 0;
  }
  return { out, picks };
}, minutes);
console.table(rows.out);
console.log(rows.picks.join('\n'));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();

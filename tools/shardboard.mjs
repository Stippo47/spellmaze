// Draws tools/shardboard.html's looks to films/shard-<id>.png, one picture each (serve the repo on :8737 first).
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:8737/tools/shardboard.html');
const looks = await page.evaluate(() => window.LOOKS);
for (const id of Object.keys(looks)) {
  const data = await page.evaluate((id) => document.getElementById(id).toDataURL('image/png'), id);
  writeFileSync(`films/shard-${id}.png`, Buffer.from(data.split(',')[1], 'base64'));
}
writeFileSync('films/shard-looks.json', JSON.stringify(looks, null, 1));
console.log(Object.keys(looks).join(' '));
await browser.close();

// A picture of a whole maze, for decks: node tools/overview.mjs [seed] [nodes] [out.png]
// Floor dark, walls lighter, rooms tinted, the start white. Written as a PPM, turned into a PNG by ffmpeg.
import { makeMaze } from '../js/maze.js';
import { writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const seed = +(process.argv[2] || 7), nodes = +(process.argv[3] || 24), out = process.argv[4] || 'films/maze-overview.png';
const m = makeMaze({ nodes, seed }), G = m.G, S = 3;
const img = Buffer.alloc(G * S * G * S * 3);
const put = (x, y, c) => { for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) { const i = ((y * S + dy) * G * S + x * S + dx) * 3; img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; } };
const inRoom = new Uint8Array(G * G);
for (const r of m.halls) for (let y = Math.floor(r.box.y0); y < r.box.y1; y++) for (let x = Math.floor(r.box.x0); x < r.box.x1; x++) inRoom[y * G + x] = 1;
for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
  const i = y * G + x;
  put(x, y, m.cells[i] ? [38, 44, 94] : inRoom[i] ? [24, 52, 60] : [13, 19, 38]);
}
for (const r of m.halls) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) put(Math.floor(r.x) + dx, Math.floor(r.y) + dy, [255, 194, 58]);
for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) put(Math.floor(m.start.x) + dx, Math.floor(m.start.y) + dy, [255, 255, 255]);
const ppm = out.replace(/\.png$/, '.ppm');
writeFileSync(ppm, Buffer.concat([Buffer.from(`P6 ${G * S} ${G * S} 255\n`), img]));
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', ppm, out]);
rmSync(ppm);
console.log(out, m.halls.map(r => `${r.kind} ${r.w}x${r.h} (${r.ways} ways in)`).join(', '));

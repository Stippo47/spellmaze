// The maze: a grid of cells (1 = wall), built from a square labyrinth of nodes.
// Sight (rays, line tests) and the path field enemies follow live here too.
import { rng } from './util.js';

// Corridor sets: widths in cells for main roads, normal corridors and side tunnels.
export const WIDTHS = {
  mixed:    { road: 8, normal: 6, tunnel: 4, label: 'Mixed' },
  standard: { road: 6, normal: 6, tunnel: 6, label: 'All 3 wide' },
  narrow:   { road: 4, normal: 4, tunnel: 4, label: 'All 2 wide' },
  wide:     { road: 8, normal: 8, tunnel: 8, label: 'All 4 wide' },
};

export function makeMaze({ nodes = 24, widths = 'mixed', seed = 1, loops = 0.15, halls = 5 } = {}) {
  const R = rng(seed);
  const W = WIDTHS[widths] || WIDTHS.mixed;
  const N = nodes;
  const P = Math.max(W.road, W.normal, W.tunnel) + 2;   // pitch: widest corridor + a 2-cell wall
  const G = N * P + 2;                                  // 1-cell border on each side
  const at = (i, j) => j * N + i;

  // 1. Perfect maze by depth-first carving: long corridors, lots of dead ends.
  const edges = new Map();                 // key "a-b" (a<b) -> width
  const key = (a, b) => a < b ? a + '-' + b : b + '-' + a;
  const seen = new Uint8Array(N * N);
  const stack = [at(N >> 1, N >> 1)];
  seen[stack[0]] = 1;
  while (stack.length) {
    const c = stack[stack.length - 1], ci = c % N, cj = (c / N) | 0;
    const nb = [];
    if (ci > 0 && !seen[c - 1]) nb.push(c - 1);
    if (ci < N - 1 && !seen[c + 1]) nb.push(c + 1);
    if (cj > 0 && !seen[c - N]) nb.push(c - N);
    if (cj < N - 1 && !seen[c + N]) nb.push(c + N);
    if (!nb.length) { stack.pop(); continue; }
    const n = nb[(R() * nb.length) | 0];
    edges.set(key(c, n), 0); seen[n] = 1; stack.push(n);
  }
  const treeEdges = [...edges.keys()];

  // 2. Knock out some walls for loops, so you can't be cornered forever.
  const all = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    if (i < N - 1) all.push(key(at(i, j), at(i + 1, j)));
    if (j < N - 1) all.push(key(at(i, j), at(i, j + 1)));
  }
  for (const k of all) if (!edges.has(k) && R() < loops) edges.set(k, 0);

  // 3. Halls: small blocks of nodes opened up into one room.
  const hallList = [];
  for (let t = 0; t < halls * 6 && hallList.length < halls; t++) {
    const s = R() < 0.5 ? 2 : 3;
    const i0 = 1 + ((R() * (N - s - 2)) | 0), j0 = 1 + ((R() * (N - s - 2)) | 0);
    const ok = hallList.every(h => i0 + s + 1 < h.i || h.i + h.s + 1 < i0 || j0 + s + 1 < h.j || h.j + h.s + 1 < j0);
    if (ok) hallList.push({ i: i0, j: j0, s });
  }
  for (const h of hallList) for (let j = h.j; j < h.j + h.s; j++) for (let i = h.i; i < h.i + h.s; i++) {
    if (i < h.i + h.s - 1) edges.set(key(at(i, j), at(i + 1, j)), 0);
    if (j < h.j + h.s - 1) edges.set(key(at(i, j), at(i, j + 1)), 0);
  }

  // 4. Widths. Roads: the tree paths from the centre to the far corners. Tunnels: the last stretch into a
  //    dead end. Everything else normal.
  const adj = Array.from({ length: N * N }, () => []);
  for (const k of edges.keys()) { const [a, b] = k.split('-').map(Number); adj[a].push(b); adj[b].push(a); }
  for (const k of edges.keys()) edges.set(k, W.normal);
  if (W.road !== W.normal) {
    const tAdj = Array.from({ length: N * N }, () => []);
    for (const k of treeEdges) { const [a, b] = k.split('-').map(Number); tAdj[a].push(b); tAdj[b].push(a); }
    const start = at(N >> 1, N >> 1), prev = new Int32Array(N * N).fill(-1); prev[start] = start;
    const q = [start];
    for (let h = 0; h < q.length; h++) for (const n of tAdj[q[h]]) if (prev[n] < 0) { prev[n] = q[h]; q.push(n); }
    for (const [ci, cj] of [[1, 1], [N - 2, 1], [1, N - 2], [N - 2, N - 2]]) {
      let c = at(ci, cj);
      while (c !== start) { edges.set(key(c, prev[c]), W.road); c = prev[c]; }
    }
  }
  const deadEnds = [];
  for (let c = 0; c < N * N; c++) if (adj[c].length === 1) {
    deadEnds.push(c);
    if (W.tunnel === W.normal) continue;
    const run = []; let p = -1, cur = c;
    while (adj[cur].length <= 2 && run.length < 6) {
      const nx = adj[cur].find(n => n !== p); if (nx == null) break;
      run.push(key(cur, nx)); p = cur; cur = nx;
    }
    if (run.length >= 3) for (const k of run) if (edges.get(k) !== W.road) edges.set(k, W.tunnel);
  }

  // 5. Carve cells.
  const cells = new Uint8Array(G * G).fill(1);
  const ctr = (i) => 1 + i * P + P / 2;
  const open = (x0, y0, x1, y1) => {
    for (let y = Math.max(1, y0); y < Math.min(G - 1, y1); y++) for (let x = Math.max(1, x0); x < Math.min(G - 1, x1); x++) cells[y * G + x] = 0;
  };
  const nodeW = new Uint8Array(N * N);
  for (const [k, w] of edges) { const [a, b] = k.split('-').map(Number); nodeW[a] = Math.max(nodeW[a], w); nodeW[b] = Math.max(nodeW[b], w); }
  for (let c = 0; c < N * N; c++) {
    const w = nodeW[c] || W.normal, x = ctr(c % N), y = ctr((c / N) | 0);
    open(x - w / 2, y - w / 2, x + w / 2, y + w / 2);
  }
  for (const [k, w] of edges) {
    const [a, b] = k.split('-').map(Number);
    const ax = ctr(a % N), ay = ctr((a / N) | 0), bx = ctr(b % N), by = ctr((b / N) | 0);
    open(Math.min(ax, bx) - w / 2, Math.min(ay, by) - w / 2, Math.max(ax, bx) + w / 2, Math.max(ay, by) + w / 2);
  }
  for (const h of hallList) {
    const w = W.road;
    open(ctr(h.i) - w / 2, ctr(h.j) - w / 2, ctr(h.i + h.s - 1) + w / 2, ctr(h.j + h.s - 1) + w / 2);
  }

  // "clear": a 2x2 body centred on this cell's centre fits (the cell and its 8 neighbours are open).
  const clear = new Uint8Array(G * G);
  for (let y = 1; y < G - 1; y++) for (let x = 1; x < G - 1; x++) {
    let ok = 1;
    for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) if (cells[(y + dy) * G + x + dx]) { ok = 0; break; }
    clear[y * G + x] = ok;
  }

  const startX = ctr(N >> 1), startY = ctr(N >> 1);
  return { G, N, P, cells, clear, deadEnds: deadEnds.map(c => ({ x: ctr(c % N), y: ctr((c / N) | 0) })),
    halls: hallList, start: { x: startX, y: startY }, widths };
}

export const solid = (m, x, y) => {
  const cx = Math.floor(x), cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= m.G || cy >= m.G) return true;
  return m.cells[cy * m.G + cx] === 1;
};

// Grid ray march (DDA). Returns the distance to the first wall, up to max.
export function rayDist(m, x, y, dx, dy, max) {
  let cx = Math.floor(x), cy = Math.floor(y);
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const tdx = dx === 0 ? 1e9 : Math.abs(1 / dx), tdy = dy === 0 ? 1e9 : Math.abs(1 / dy);
  let tx = dx === 0 ? 1e9 : (dx > 0 ? cx + 1 - x : x - cx) * tdx;
  let ty = dy === 0 ? 1e9 : (dy > 0 ? cy + 1 - y : y - cy) * tdy;
  const G = m.G, cells = m.cells;
  let t = 0;
  while (t < max) {
    if (tx < ty) { t = tx; tx += tdx; cx += sx; } else { t = ty; ty += tdy; cy += sy; }
    if (cx < 0 || cy < 0 || cx >= G || cy >= G || cells[cy * G + cx]) return Math.min(t, max);
  }
  return max;
}

// Same march, stamping every cell passed (and the wall it stops at) as in view now, and as seen.
// Returns the distance to the wall, up to max.
export function rayStamp(m, x, y, dx, dy, max, now, stamp, seen) {
  let cx = Math.floor(x), cy = Math.floor(y);
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const tdx = dx === 0 ? 1e9 : Math.abs(1 / dx), tdy = dy === 0 ? 1e9 : Math.abs(1 / dy);
  let tx = dx === 0 ? 1e9 : (dx > 0 ? cx + 1 - x : x - cx) * tdx;
  let ty = dy === 0 ? 1e9 : (dy > 0 ? cy + 1 - y : y - cy) * tdy;
  const G = m.G, cells = m.cells;
  let t = 0;
  stamp[cy * G + cx] = now; seen[cy * G + cx] = 1;
  while (t < max) {
    if (tx < ty) { t = tx; tx += tdx; cx += sx; } else { t = ty; ty += tdy; cy += sy; }
    if (cx < 0 || cy < 0 || cx >= G || cy >= G) return Math.min(t, max);
    const i = cy * G + cx;
    if (t < max) { stamp[i] = now; seen[i] = 1; }
    if (cells[i]) return Math.min(t, max);
  }
  return max;
}

export function lineClear(m, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy);
  if (d < 1e-6) return true;
  return rayDist(m, x0, y0, dx / d, dy / d, d) >= d - 1e-6;
}

// Path field: steps from every clear cell to the target cell, over clear cells (8 neighbours, no corner cuts).
export function pathField(m, tx, ty, maxSteps, out) {
  const G = m.G, clear = m.clear;
  out.fill(65535);
  let s = Math.floor(ty) * G + Math.floor(tx);
  if (!clear[s]) { // stand-in: the nearest clear cell
    let best = -1, bd = 1e9;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const i = s + dy * G + dx; if (clear[i] && dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; best = i; }
    }
    if (best < 0) return 0; s = best;
  }
  const q = pathField.q || (pathField.q = new Int32Array(G * G));
  let h = 0, t = 0; q[t++] = s; out[s] = 0;
  const nb = [1, -1, G, -G];
  while (h < t) {
    const c = q[h++], d = out[c];
    if (d >= maxSteps) continue;
    for (let k = 0; k < 4; k++) { const n = c + nb[k]; if (clear[n] && out[n] > d + 1) { out[n] = d + 1; q[t++] = n; } }
  }
  return t; // pathField.q[0..t) holds the reached cells, nearest first
}

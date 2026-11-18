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

export function makeMaze({ nodes = 24, widths = 'mixed', seed = 1, loops = 0.15, halls = Math.round(nodes * nodes / 72) } = {}) {   // 24x24: 8 rooms, bigger and of several shapes (round 4)
  const R = rng(seed);
  const W = WIDTHS[widths] || WIDTHS.mixed;
  const N = nodes;
  const P = Math.max(W.road, W.normal, W.tunnel) + 2;   // pitch: widest corridor + a 2-cell wall
  // Some rows and columns sit further apart, so some walls are as thick as a tunnel (round 2 answer).
  const gapX = [], gapY = [];
  for (let i = 0; i < N; i++) { gapX.push(R() < 0.3 ? 4 : 0); gapY.push(R() < 0.3 ? 4 : 0); }
  const cxs = [], cys = [];
  let ax = 1, ay = 1;
  for (let i = 0; i < N; i++) { cxs.push(ax + (P + gapX[i]) / 2); ax += P + gapX[i]; cys.push(ay + (P + gapY[i]) / 2); ay += P + gapY[i]; }
  const G = Math.max(ax, ay) + 1;                       // 1-cell border on each side
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

  // 2. Knock out some walls for loops, so you can't be cornered forever.
  const all = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    if (i < N - 1) all.push(key(at(i, j), at(i + 1, j)));
    if (j < N - 1) all.push(key(at(i, j), at(i, j + 1)));
  }
  for (const k of all) if (!edges.has(k) && R() < loops) edges.set(k, 0);

  // 3. Rooms (round 4: bigger, more shapes, fewer ways in). A room is a set of nodes opened into one space.
  //    Shapes: rect, round, L, cross, pillars (a rect with pillars between its nodes).
  const SHAPES = ['rect', 'rect', 'round', 'L', 'cross', 'pillars'];
  const ri = (n) => (R() * n) | 0;
  const rooms = [], roomOf = new Int16Array(N * N).fill(-1);
  for (let t = 0; t < halls * 10 && rooms.length < halls; t++) {
    const kind = SHAPES[ri(SHAPES.length)];
    let w, h;
    if (kind === 'round') w = h = 3 + ri(2);
    else if (kind === 'cross') w = h = 5;
    else if (kind === 'L') { w = 3 + ri(3); h = 3 + ri(3); }
    else if (kind === 'pillars') { w = 3 + ri(3); h = 3 + ri(2); }
    else { w = 2 + ri(4); h = 2 + ri(3); }
    if (R() < 0.5) [w, h] = [h, w];
    if (w > N - 4 || h > N - 4) continue;
    const i0 = 1 + ri(N - w - 2), j0 = 1 + ri(N - h - 2);
    if (!rooms.every(r => i0 + w + 1 < r.i || r.i + r.w + 1 < i0 || j0 + h + 1 < r.j || r.j + r.h + 1 < j0)) continue;
    const parts = []; // node rects [i0, j0, i1, j1] inclusive
    if (kind === 'L') {
      const bw = 1 + ri(2), bh = 1 + ri(2), fx = R() < 0.5, fy = R() < 0.5;
      parts.push(fy ? [i0, j0, i0 + w - 1, j0 + bh - 1] : [i0, j0 + h - bh, i0 + w - 1, j0 + h - 1]);
      parts.push(fx ? [i0 + w - bw, j0, i0 + w - 1, j0 + h - 1] : [i0, j0, i0 + bw - 1, j0 + h - 1]);
    } else if (kind === 'cross') {
      parts.push([i0 + 1, j0 + 1, i0 + 3, j0 + 3], [i0 + 2, j0, i0 + 2, j0 + 4], [i0, j0 + 2, i0 + 4, j0 + 2]);
    } else parts.push([i0, j0, i0 + w - 1, j0 + h - 1]);
    const nodes = new Set();
    for (const [a, b, c, d] of parts) for (let j = b; j <= d; j++) for (let i = a; i <= c; i++) nodes.add(at(i, j));
    const r = { kind, i: i0, j: j0, w, h, parts, nodes: [...nodes] };
    rooms.push(r);
    for (const n of r.nodes) roomOf[n] = rooms.length - 1;
  }
  // open the room inside: every pair of neighbouring room nodes
  for (let c = 0; c < N * N; c++) {
    if (roomOf[c] < 0) continue;
    if (c % N < N - 1 && roomOf[c + 1] === roomOf[c]) edges.set(key(c, c + 1), 0);
    if (c + N < N * N && roomOf[c + N] === roomOf[c]) edges.set(key(c, c + N), 0);
  }
  // fewer ways in: drop entrances down to 2 (3 for big rooms), never cutting any part of the maze off
  const reach = () => {
    const ad = Array.from({ length: N * N }, () => []);
    for (const k of edges.keys()) { const [a, b] = k.split('-').map(Number); ad[a].push(b); ad[b].push(a); }
    const v = new Uint8Array(N * N), q = [0]; v[0] = 1;
    for (let h = 0; h < q.length; h++) for (const n of ad[q[h]]) if (!v[n]) { v[n] = 1; q.push(n); }
    return q.length === N * N;
  };
  rooms.forEach((r, idx) => {
    const ways = [];
    for (const k of edges.keys()) { const [a, b] = k.split('-').map(Number); if ((roomOf[a] === idx) !== (roomOf[b] === idx)) ways.push(k); }
    for (let i = ways.length - 1; i > 0; i--) { const j = ri(i + 1); [ways[i], ways[j]] = [ways[j], ways[i]]; }
    let left = ways.length;
    const keep = r.nodes.length >= 12 ? 3 : 2;
    for (const k of ways) {
      if (left <= keep) break;
      edges.delete(k);
      if (reach()) left--; else edges.set(k, 0);
    }
    r.ways = left;
  });

  // 4. Widths. Roads: the tree paths from the centre to the far corners. Tunnels: the last stretch into a
  //    dead end. Everything else normal.
  const adj = Array.from({ length: N * N }, () => []);
  for (const k of edges.keys()) { const [a, b] = k.split('-').map(Number); adj[a].push(b); adj[b].push(a); }
  for (const k of edges.keys()) edges.set(k, W.normal);
  if (W.road !== W.normal) { // roads: shortest paths from the centre to the far corners, over the edges left
    const start = at(N >> 1, N >> 1), prev = new Int32Array(N * N).fill(-1); prev[start] = start;
    const q = [start];
    for (let h = 0; h < q.length; h++) for (const n of adj[q[h]]) if (prev[n] < 0) { prev[n] = q[h]; q.push(n); }
    for (const [ci, cj] of [[1, 1], [N - 2, 1], [1, N - 2], [N - 2, N - 2]]) {
      let c = at(ci, cj);
      while (c !== start && prev[c] >= 0) { edges.set(key(c, prev[c]), W.road); c = prev[c]; }
    }
  }
  const deadEnds = [];
  for (let c = 0; c < N * N; c++) if (adj[c].length === 1 && roomOf[c] < 0) {
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
  const cx = (i) => cxs[i], cy = (j) => cys[j];
  const open = (x0, y0, x1, y1, v = 0) => {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    for (let y = Math.max(1, y0); y < Math.min(G - 1, y1); y++) for (let x = Math.max(1, x0); x < Math.min(G - 1, x1); x++) cells[y * G + x] = v;
  };
  const round = (c) => roomOf[c] >= 0 && rooms[roomOf[c]].kind === 'round';
  const nodeW = new Uint8Array(N * N);
  for (const [k, w] of edges) { const [a, b] = k.split('-').map(Number); nodeW[a] = Math.max(nodeW[a], w); nodeW[b] = Math.max(nodeW[b], w); }
  for (let c = 0; c < N * N; c++) {
    if (round(c)) continue;   // a round room is carved as a disc, below
    const w = nodeW[c] || W.normal, x = cx(c % N), y = cy((c / N) | 0);
    open(x - w / 2, y - w / 2, x + w / 2, y + w / 2);
  }
  for (const [k, w] of edges) {
    const [a, b] = k.split('-').map(Number);
    if (round(a) && round(b)) continue;
    const ax = cx(a % N), ay = cy((a / N) | 0), bx = cx(b % N), by = cy((b / N) | 0);
    open(Math.min(ax, bx) - w / 2, Math.min(ay, by) - w / 2, Math.max(ax, bx) + w / 2, Math.max(ay, by) + w / 2);
  }
  for (const r of rooms) {
    const w = W.road;
    if (r.kind === 'round') {
      const x0 = cx(r.i), x1 = cx(r.i + r.w - 1), y0 = cy(r.j), y1 = cy(r.j + r.h - 1);
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, rad = Math.max(x1 - x0, y1 - y0) / 2 + w / 2 + 1.5;
      for (let y = Math.max(1, Math.floor(my - rad)); y < Math.min(G - 1, Math.ceil(my + rad)); y++)
        for (let x = Math.max(1, Math.floor(mx - rad)); x < Math.min(G - 1, Math.ceil(mx + rad)); x++)
          if ((x + 0.5 - mx) ** 2 + (y + 0.5 - my) ** 2 < rad * rad) cells[y * G + x] = 0;
    } else for (const [a, b, c, d] of r.parts) open(cx(a) - w / 2, cy(b) - w / 2, cx(c) + w / 2, cy(d) + w / 2);
    if (r.kind === 'pillars') // 3x3 pillars where four room nodes meet
      for (let j = r.j; j < r.j + r.h - 1; j++) for (let i = r.i; i < r.i + r.w - 1; i++) {
        const px = Math.floor((cx(i) + cx(i + 1)) / 2), py = Math.floor((cy(j) + cy(j + 1)) / 2);
        open(px - 1, py - 1, px + 2, py + 2, 1);
      }
    // where its shard goes: the room node nearest the middle
    const mx = (cx(r.i) + cx(r.i + r.w - 1)) / 2, my = (cy(r.j) + cy(r.j + r.h - 1)) / 2;
    let best = null, bd = 1e9;
    for (const n of r.nodes) { const x = cx(n % N), y = cy((n / N) | 0), d = (x - mx) ** 2 + (y - my) ** 2; if (d < bd) { bd = d; best = { x, y }; } }
    r.x = best.x; r.y = best.y;
    r.box = { x0: cx(r.i) - w / 2, y0: cy(r.j) - w / 2, x1: cx(r.i + r.w - 1) + w / 2, y1: cy(r.j + r.h - 1) + w / 2 };
  }

  // "clear": a 2x2 body centred on this cell's centre fits (the cell and its 8 neighbours are open).
  const clear = new Uint8Array(G * G);
  for (let y = 1; y < G - 1; y++) for (let x = 1; x < G - 1; x++) {
    let ok = 1;
    for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) if (cells[(y + dy) * G + x + dx]) { ok = 0; break; }
    clear[y * G + x] = ok;
  }

  const startX = cx(N >> 1), startY = cy(N >> 1);
  return { G, N, P, cells, clear, deadEnds: deadEnds.map(c => ({ x: cx(c % N), y: cy((c / N) | 0) })), cxs, cys,
    halls: rooms, start: { x: startX, y: startY }, widths };
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
export function rayStamp(m, x, y, dx, dy, max, now, stamp, seen, seenAt = 1) {
  let cx = Math.floor(x), cy = Math.floor(y);
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const tdx = dx === 0 ? 1e9 : Math.abs(1 / dx), tdy = dy === 0 ? 1e9 : Math.abs(1 / dy);
  let tx = dx === 0 ? 1e9 : (dx > 0 ? cx + 1 - x : x - cx) * tdx;
  let ty = dy === 0 ? 1e9 : (dy > 0 ? cy + 1 - y : y - cy) * tdy;
  const G = m.G, cells = m.cells;
  let t = 0;
  stamp[cy * G + cx] = now; seen[cy * G + cx] = seenAt;
  while (t < max) {
    if (tx < ty) { t = tx; tx += tdx; cx += sx; } else { t = ty; ty += tdy; cy += sy; }
    if (cx < 0 || cy < 0 || cx >= G || cy >= G) return Math.min(t, max);
    const i = cy * G + cx;
    if (t < max) { stamp[i] = now; seen[i] = seenAt; }
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

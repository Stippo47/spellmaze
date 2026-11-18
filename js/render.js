// Drawing. Flat, solid shapes, no glow (docs/DECISIONS.md: "solid and flat"). Canvas 2D.
import { COL, TAU, fmtTime } from './util.js';
import { canSee, SIGHT, dashLen, xpNeed, WARN, GHOST, ENEMIES } from './game.js';
import { rayDist } from './maze.js';
import { DASH, SPAWN } from './weapons.js';

export function makeRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  resize(); addEventListener('resize', resize);
  const R = { ctx, cam: { x: 0, y: 0, s: 20 }, resize };

  R.playerScreen = () => ({ x: W / 2, y: H / 2 });

  R.draw = (g, inp, opts, alpha = 1) => {
    const p = g.p, m = g.m, G = m.G;
    const s = H / opts.view;                     // pixels per cell
    const cx = p.x, cy = p.y;
    R.cam = { x: cx, y: cy, s };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, W, H);

    // world transform
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (W / 2 - cx * s), dpr * (H / 2 - cy * s));
    const x0 = Math.max(0, Math.floor(cx - W / 2 / s) - 1), x1 = Math.min(G, Math.ceil(cx + W / 2 / s) + 1);
    const y0 = Math.max(0, Math.floor(cy - H / 2 / s) - 1), y1 = Math.min(G, Math.ceil(cy + H / 2 / s) + 1);
    const mode = opts.sight;

    if (mode === 'remember') drawMemory(g, x0, y0, x1, y1);
    if (mode === 'all') drawCells(m, x0, y0, x1, y1, null, true, LIT);
    else {
      ctx.save();
      ctx.beginPath();
      const v = g.vis; ctx.moveTo(v[0], v[1]);
      for (let i = 2; i < v.length; i += 2) ctx.lineTo(v[i], v[i + 1]);
      ctx.closePath(); ctx.clip();
      drawCells(m, x0, y0, x1, y1, null, true, LIT, 'floor');
      ctx.restore();
      drawCells(m, x0, y0, x1, y1, null, true, LIT, 'walls', g.visStamp, g.visNow);
    }

    // breakable tiles (round 6): a wall cell, just darker; white for a moment when hit
    {
      const c = m.cells, now = g.visNow, st = g.visStamp;
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * G + x; if (c[i] === 2 && (mode === 'all' || st[i] === now || st[i - 1] === now || st[i + 1] === now || st[i - G] === now || st[i + G] === now)) ctx.fillRect(x, y, 1, 1); }
      ctx.fillStyle = '#ffffff';
      for (const i of g.tileFlash.keys()) ctx.fillRect(i % G, (i / G) | 0, 1, 1);
    }

    // shards (round 6: the crystal's depth was the problem; the spinning star was closest): a flat gold four-point
    // star turning slowly. Seen ones stay drawn (faint out of sight) in Remembered sight; a taken one leaves an outline.
    for (const c of g.chests) {
      const vis = mode === 'all' || canSee(g, c.x, c.y);
      if (!vis && !(mode === 'remember' && g.seen[Math.floor(c.y) * G + Math.floor(c.x)])) continue;
      ctx.globalAlpha = vis ? 1 : 0.35;
      const star = (rr0, rr1) => { ctx.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? rr1 : rr0; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); };
      if (!c.open) { // round 7: a second, darker star underneath, turning the other way
        ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(-g.t * 0.8 - c.x + Math.PI / 4);
        const pulse = 1 + 0.08 * Math.sin(g.t * 3 + c.y); star(1.75 * pulse, 0.5); ctx.fillStyle = '#c98a00'; ctx.fill(); ctx.restore();
      }
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.open ? 0.4 : g.t * 1.2 + c.x);
      ctx.beginPath();
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? 0.42 : 1.5; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath();
      if (c.open) { ctx.strokeStyle = COL.gold; ctx.lineWidth = 0.12; ctx.globalAlpha *= 0.5; ctx.stroke(); }
      else { ctx.fillStyle = COL.gold; ctx.fill(); }
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // XP
    ctx.fillStyle = COL.xp;
    for (const q of g.gems) {
      if (mode !== 'all' && !q.pull && !(q.vis = canSeeCached(g, q))) continue;
      ctx.beginPath(); ctx.moveTo(q.x, q.y - 0.45); ctx.lineTo(q.x + 0.35, q.y); ctx.lineTo(q.x, q.y + 0.45); ctx.lineTo(q.x - 0.35, q.y); ctx.closePath(); ctx.fill();
    }

    // aim lines
    if (g.aim) {
      const d = Math.hypot(g.aim.x, g.aim.y) || 1, ax = g.aim.x / d, ay = g.aim.y / d;
      const L = rayDist(m, p.x, p.y, ax, ay, g.weapon.range);
      strip(p.x + ax * 1.2, p.y + ay * 1.2, p.x + ax * L, p.y + ay * L, Math.max(0.5, g.weapon.radius * 2.4), 'rgba(255,255,255,0.22)');
    }
    if (g.dashAim) {
      const d = Math.hypot(g.dashAim.x, g.dashAim.y) || 1, ax = g.dashAim.x / d, ay = g.dashAim.y / d;
      const L = rayDist(m, p.x, p.y, ax, ay, dashLen(g) + 1) - 1;
      strip(p.x, p.y, p.x + ax * Math.max(0, L), p.y + ay * Math.max(0, L), 2, 'rgba(159,233,255,0.25)');
      circle(p.x + ax * Math.max(0, L), p.y + ay * Math.max(0, L), 1, 'rgba(159,233,255,0.35)');
    }

    // blasts
    for (const b of g.blasts) {
      const k = b.t / 0.35;
      ctx.globalAlpha = 0.55 * (1 - k);
      circle(b.x, b.y, b.r * (0.6 + 0.4 * Math.min(1, k * 3)), b.col ? COL[b.col] : '#ffffff');
    }
    ctx.globalAlpha = 1;
    if (g.spawnAim) {
      const d = Math.hypot(g.spawnAim.x, g.spawnAim.y) || 1, ax = g.spawnAim.x / d, ay = g.spawnAim.y / d;
      const L = rayDist(m, p.x, p.y, ax, ay, SPAWN.speed / SPAWN.drag);
      strip(p.x + ax * 1.3, p.y + ay * 1.3, p.x + ax * L, p.y + ay * L, 2.2, 'rgba(255,255,255,0.14)');
      circle(p.x + ax * Math.max(1.3, L - SPAWN.r), p.y + ay * Math.max(1.3, L - SPAWN.r), SPAWN.r, 'rgba(255,255,255,0.25)');
    }
    // balls (your spawns)
    for (const b of g.balls) {
      if (mode !== 'all' && !canSee(g, b.x, b.y)) continue;
      circle(b.x, b.y, b.r, payCol(b.pay) || COL.ball);
      circle(b.x, b.y, b.r * 0.62, '#1a2240');
      ctx.strokeStyle = COL.ball; ctx.lineWidth = 0.22;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.38, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, b.hp / b.maxHp)); ctx.stroke();
    }

    // gas clouds (Rot) and shock arcs
    for (const c of g.clouds) { if (mode !== 'all' && !canSee(g, c.x, c.y)) continue; ctx.globalAlpha = 0.22 * (1 - c.t / c.life) + 0.08; circle(c.x, c.y, c.r, COL.poison); }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = COL.shock; ctx.lineWidth = 0.18; ctx.lineCap = 'round';
    for (const a of g.arcs) { // a zigzag
      ctx.beginPath(); ctx.moveTo(a.x0, a.y0);
      const dx = a.x1 - a.x0, dy = a.y1 - a.y0, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
      for (let k = 1; k < 5; k++) { const o = (k % 2 ? 0.5 : -0.5); ctx.lineTo(a.x0 + dx * k / 5 + nx * o, a.y0 + dy * k / 5 + ny * o); }
      ctx.lineTo(a.x1, a.y1); ctx.stroke();
    }

    // enemy orbs
    for (const o of g.shots) {
      if (mode !== 'all' && !canSee(g, o.x, o.y)) continue;
      circle(o.x, o.y, o.r, ECOL.spitter[0]); circle(o.x, o.y, o.r * 0.45, ECOL.spitter[1]);
    }
    // enemies: each type its own colour and shape (stage 4). A camp at rest is drawn dim.
    const hidden = [];
    for (const e of g.enemies) {
      const vis = mode === 'all' || canSee(g, e.x, e.y);
      if (!vis) { hidden.push(e); continue; }
      const [lite, dark] = ECOL[e.type] || ECOL.mite;
      if (e.sleep) ctx.globalAlpha = 0.5;
      if (e.st === 'aim') { // a dart about to charge: where it will go
        const L = Math.min(rayDist(m, e.x, e.y, e.ax, e.ay, 40), dashLen(g, e) + 1);
        ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(g.t * 20));
        strip(e.x, e.y, e.x + e.ax * L, e.y + e.ay * L, 0.5, lite);
        ctx.globalAlpha = 1;
      }
      enemyShape(e, e.r, e.flash > 0 ? '#ffffff' : dark);
      if (e.flash <= 0) enemyShape(e, e.r * 0.7, lite);
      ctx.globalAlpha = 1;
      // statuses: a ring each in its colour (thicker with more build-up), outside the body
      let ring = e.r + 0.15;
      for (const k of ['burn', 'chill', 'shock', 'poison']) if (e[k] > 0) {
        ctx.strokeStyle = COL[k]; ctx.lineWidth = 0.1 + 0.22 * Math.min(1, e[k] / 100);
        ctx.beginPath(); ctx.arc(e.x, e.y, ring, 0, TAU); ctx.stroke(); ring += 0.3;
      }
      if (e.frozen > 0) { ctx.globalAlpha = 0.55; ctx.fillStyle = COL.chill; ctx.fillRect(e.x - e.r * 1.1, e.y - e.r * 1.1, e.r * 2.2, e.r * 2.2); ctx.globalAlpha = 1; }
      if (e.stun > 0) { ctx.strokeStyle = COL.shock; ctx.lineWidth = 0.15; ctx.beginPath(); ctx.moveTo(e.x - 0.6, e.y - e.r - 0.9); ctx.lineTo(e.x - 0.2, e.y - e.r - 0.6); ctx.lineTo(e.x + 0.2, e.y - e.r - 0.9); ctx.lineTo(e.x + 0.6, e.y - e.r - 0.6); ctx.stroke(); }
      if (e.mark > 0) { ctx.fillStyle = COL.mark; const n = Math.max(1, Math.floor(e.mark / 20)); for (let i = 0; i < n; i++) ctx.fillRect(e.x - 1 + i * 0.42, e.y + e.r + 0.35, 0.3, 0.3); }
      if (!ENEMIES[e.type].boss && e.hp < e.maxHp) { ctx.fillStyle = lite; ctx.fillRect(e.x - 0.9, e.y - e.r - 0.55, 1.8 * e.hp / e.maxHp, 0.22); }
    }

    // bolts
    for (const b of g.bolts) {
      if (mode !== 'all' && !canSee(g, b.x, b.y)) continue;
      const sp = Math.hypot(b.vx, b.vy) || 1, tx = b.vx / sp, ty = b.vy / sp;
      strip(b.x - tx * 0.9, b.y - ty * 0.9, b.x, b.y, b.r * 2, payCol(b.pay) || COL.shot, true);
    }

    // player
    if (!g.over) {
      const hurt = p.hurtT > 0 && Math.floor(p.hurtT * 20) % 2 === 0;
      const dashing = p.dashT > 0;
      if (p.safeT > 0) { ctx.strokeStyle = COL.dash; ctx.lineWidth = 0.18; ctx.globalAlpha = Math.min(1, p.safeT / DASH.safe + 0.3); ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 0.35, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
      circle(p.x, p.y, p.r, hurt ? COL.hp : dashing ? COL.dash : COL.player);
      circle(p.x, p.y, p.r * 0.5, '#1a2240');
      ctx.fillStyle = hurt ? COL.hp : COL.player;
      ctx.beginPath(); ctx.moveTo(p.x + p.fx * 1.55, p.y + p.fy * 1.55);
      ctx.lineTo(p.x + p.fx * 1.05 - p.fy * 0.45, p.y + p.fy * 1.05 + p.fx * 0.45);
      ctx.lineTo(p.x + p.fx * 1.05 + p.fy * 0.45, p.y + p.fy * 1.05 - p.fx * 0.45); ctx.closePath(); ctx.fill();
      // ticks for close enemies you can't see
      if (mode === 'remember' && opts.ticks) {
        ctx.fillStyle = COL.enemy;
        for (const e of hidden) {
          const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
          if (d > 14) continue;
          const ux = dx / d, uy = dy / d, rr = 2.2;
          ctx.globalAlpha = 0.35 + 0.6 * (1 - d / 14);
          ctx.beginPath(); ctx.moveTo(p.x + ux * (rr + 0.55), p.y + uy * (rr + 0.55));
          ctx.lineTo(p.x + ux * rr - uy * 0.32, p.y + uy * rr + ux * 0.32); ctx.lineTo(p.x + ux * rr + uy * 0.32, p.y + uy * rr - ux * 0.32);
          ctx.closePath(); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }

    // afterimages of a dash (round 6: afterimage trails, not lines): fading copies of the body
    for (const q of g.ghosts) {
      if (mode !== 'all' && !canSee(g, q.x, q.y)) continue;
      ctx.globalAlpha = 0.45 * (1 - q.t / GHOST);
      if (q.type === 'player') circle(q.x, q.y, q.r, COL.dash); else enemyShape(q, q.r, (ECOL[q.type] || ECOL.mite)[0]);
    }
    ctx.globalAlpha = 1;

    // bits
    for (const q of g.parts) {
      ctx.globalAlpha = Math.max(0, q.life / q.max) * (q.col === 'dash' ? 0.5 : 1);
      ctx.fillStyle = q.col === 'enemy' ? COL.enemy : q.col === 'dash' ? COL.dash : q.col === 'player' ? COL.player : q.col === 'orb' ? ECOL.spitter[0] : q.col === 'tile' ? COL.wallEdge : COL[q.col] || COL.shot;
      ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
    }
    ctx.globalAlpha = 1;

    // ---------- screen space ----------
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWaveWarn(g);
    drawBoss(g);
    drawHud(g, opts);
    drawControls(g, inp);
    for (const pop of g.pops) {
      const a = Math.min(1, 3 * (1.6 - pop.t)), y = H * 0.32 - pop.t * 12;
      ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = pop.big ? COL.enemy : COL.xp;
      ctx.font = `800 ${pop.big ? 30 : 22}px system-ui, -apple-system, sans-serif`; ctx.textAlign = 'center';
      ctx.fillText(pop.text, W / 2, y);
    }
    ctx.globalAlpha = 1;
    if (inp.showFingers) for (const t of inp.touches.values()) { circle(t.x, t.y, 22, 'rgba(255,230,120,0.35)'); }
  };

  // What you've seen, fading out over FADE seconds. One pass: each row is cut into runs of the same kind (floor or
  // wall) and the same fade step, so a whole run is one rectangle.
  const FADE = 120, STEPS = 5;
  function drawMemory(g, x0, y0, x1, y1) {
    const m = g.m, G = m.G, c = m.cells, seen = g.seen, now = g.t + 1;
    const key = (i) => { const t = seen[i]; if (!t) return 0; const k = Math.ceil((1 - (now - t) / FADE) * STEPS); return k <= 0 ? 0 : (c[i] ? 16 : 0) + k; };
    for (let y = y0; y < y1; y++) {
      let run = -1, rk = 0;
      for (let x = x0; x <= x1; x++) {
        const k = x < x1 ? key(y * G + x) : 0;
        if (k !== rk) {
          if (rk) { ctx.globalAlpha = (rk & 15) / STEPS; ctx.fillStyle = rk & 16 ? COL.memEdge : COL.memFloor; ctx.fillRect(run, y, x - run, 1.02); }
          run = x; rk = k;
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function canSeeCached(g, q) { return canSee(g, q.x, q.y); }

  // [light, dark] per enemy (decisions: more enemy colours than red and magenta; poison purple stays free)
  const payCol = (pay) => { if (!pay) return null; for (const k of ['burn', 'chill', 'shock', 'poison', 'mark']) if (pay[k]) return COL[k]; return null; };
  const ECOL = { hulk: ['#ff3d7f', '#6b1030'], mite: [COL.enemy, COL.enemyDark], dart: ['#ff4fd8', '#7d1c6c'], spitter: ['#c8ff3d', '#4d6b0c'], brute: ['#ffae3d', '#7a4a0c'] };
  // mite a circle, dart a triangle pointing where it's going, spitter a diamond, brute a square
  function enemyShape(e, r, col) {
    ctx.fillStyle = col; ctx.beginPath();
    if (e.type === 'dart') {
      const fx = e.fx, fy = e.fy;
      ctx.moveTo(e.x + fx * r * 1.35, e.y + fy * r * 1.35);
      ctx.lineTo(e.x - fx * r * 0.9 - fy * r * 0.85, e.y - fy * r * 0.9 + fx * r * 0.85);
      ctx.lineTo(e.x - fx * r * 0.9 + fy * r * 0.85, e.y - fy * r * 0.9 - fx * r * 0.85);
    } else if (e.type === 'spitter') {
      const k = r * 1.2; ctx.moveTo(e.x, e.y - k); ctx.lineTo(e.x + k, e.y); ctx.lineTo(e.x, e.y + k); ctx.lineTo(e.x - k, e.y);
    } else if (e.type === 'brute') { ctx.rect(e.x - r * 0.92, e.y - r * 0.92, r * 1.84, r * 1.84); }
    else if (e.type === 'hulk') { // a square turned to where it rolls, with its armoured front a lighter bar
      const fx = e.fx, fy = e.fy, k = r * 0.92;
      ctx.moveTo(e.x + (fx - fy) * k, e.y + (fy + fx) * k); ctx.lineTo(e.x + (fx + fy) * k, e.y + (fy - fx) * k);
      ctx.lineTo(e.x + (-fx + fy) * k, e.y + (-fy - fx) * k); ctx.lineTo(e.x + (-fx - fy) * k, e.y + (-fy + fx) * k);
      ctx.closePath(); ctx.fill();
      if (r === e.r) { ctx.strokeStyle = e.clang > 0 ? '#ffffff' : '#ffd0e0'; ctx.lineWidth = 0.55; ctx.beginPath();
        ctx.moveTo(e.x + (fx - fy) * k * 1.02, e.y + (fy + fx) * k * 1.02); ctx.lineTo(e.x + (fx + fy) * k * 1.02, e.y + (fy - fx) * k * 1.02); ctx.stroke(); }
      return;
    }
    else ctx.arc(e.x, e.y, r, 0, TAU);
    ctx.closePath(); ctx.fill();
  }

  function circle(x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
  function strip(x0, y0, x1, y1, w, col, round) {
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = round ? 'round' : 'butt';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }

  // Floors and walls in a box of cells. seen: a filter on cell index (the fading memory).
  const LIT = { floor: COL.floor, wall: COL.wallTop, edge: COL.wallEdge };
  const MEM = { floor: COL.memFloor, wall: COL.memWall, edge: COL.memEdge };
  // only: 'floor' or 'walls' to draw one layer. stamp/now: walls only where in view right now.
  function drawCells(m, x0, y0, x1, y1, seen, lit, pal, only, stamp, now) {
    const G = m.G, c = m.cells;
    // a wall cell in view now: stamped by a ray, or touching floor that's in view (round 7: walls seen at a shallow
    // angle had gaps where no ray landed)
    const show = (i) => (!seen || seen(i)) && (!stamp || stamp[i] === now ||
      (c[i] && ((!c[i - 1] && stamp[i - 1] === now) || (!c[i + 1] && stamp[i + 1] === now) || (!c[i - G] && stamp[i - G] === now) || (!c[i + G] && stamp[i + G] === now))));
    if (only !== 'walls') {
    ctx.fillStyle = pal.floor;
    for (let y = y0; y < y1; y++) {
      let run = -1;
      for (let x = x0; x <= x1; x++) {
        const ok = x < x1 && !c[y * G + x] && show(y * G + x);
        if (ok && run < 0) run = x; else if (!ok && run >= 0) { ctx.fillRect(run, y, x - run, 1.02); run = -1; }
      }
    }
    if (lit) { // a faint grid, two cells apart (one body width), so speed reads
      ctx.strokeStyle = COL.floorLine; ctx.lineWidth = 0.08; ctx.beginPath();
      for (let x = x0 - (x0 % 2); x <= x1; x += 2) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
      for (let y = y0 - (y0 % 2); y <= y1; y += 2) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
      ctx.stroke();
    }
    }
    if (only === 'floor') return;
    ctx.fillStyle = pal.wall;
    for (let y = y0; y < y1; y++) {
      let run = -1;
      for (let x = x0; x <= x1; x++) {
        const ok = x < x1 && c[y * G + x] && show(y * G + x);
        if (ok && run < 0) run = x; else if (!ok && run >= 0) { ctx.fillRect(run, y, x - run, 1.02); run = -1; }
      }
    }
    // wall faces: a lighter band on every wall side that meets floor
    ctx.fillStyle = pal.edge;
    const t = 0.28;
    for (let y = Math.max(1, y0); y < Math.min(G - 1, y1); y++) for (let x = Math.max(1, x0); x < Math.min(G - 1, x1); x++) {
      const i = y * G + x;
      if (!c[i] || !show(i)) continue;
      if (!c[i - 1]) ctx.fillRect(x, y, t, 1);
      if (!c[i + 1]) ctx.fillRect(x + 1 - t, y, t, 1);
      if (!c[i - G]) ctx.fillRect(x, y, 1, t);
      if (!c[i + G]) ctx.fillRect(x, y + 1 - t, 1, t);
    }
  }

  // A wave on its way (round 4: waves you can prepare for): a red bar on each screen edge it comes from, pulsing
  // faster as it nears, and a countdown under the pause button.
  function drawWaveWarn(g) {
    const w = g.waveWarn; if (!w) return;
    const left = w.at - g.t, k = 1 - left / WARN, pulse = 0.45 + 0.4 * Math.abs(Math.sin(g.t * (3 + 5 * k)));
    ctx.fillStyle = COL.enemy;
    for (const a of w.sides) {
      const dx = Math.cos(a), dy = Math.sin(a), t = Math.min((W / 2) / Math.abs(dx || 1e-6), (H / 2) / Math.abs(dy || 1e-6));
      const ex = W / 2 + dx * t, ey = H / 2 + dy * t, len = 0.32 * (Math.abs(dx) * t >= W / 2 - 1 ? H : W), th = 7;
      ctx.globalAlpha = pulse;
      if (Math.abs(dx) * t >= W / 2 - 1) ctx.fillRect(dx > 0 ? W - th : 0, Math.max(0, Math.min(H - len, ey - len / 2)), th, len);
      else ctx.fillRect(Math.max(0, Math.min(W - len, ex - len / 2)), dy > 0 ? H - th : 0, len, th);
    }
    ctx.globalAlpha = 1;
    const st = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--st')) || 0;
    ctx.font = '800 15px system-ui, -apple-system, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`Wave ${w.wave} in ${Math.ceil(left)}`, W / 2, st + 58);
  }

  function drawBoss(g) {
    const b = g.boss; if (!b) return;
    const st = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--st')) || 0, w = Math.min(360, W * 0.4), y = st + 78;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(W / 2 - w / 2, y, w, 12);
    ctx.fillStyle = '#ff3d7f'; ctx.fillRect(W / 2 - w / 2 + 2, y + 2, (w - 4) * Math.max(0, b.hp / b.maxHp), 8);
    ctx.fillStyle = COL.ui; ctx.font = '800 12px system-ui, -apple-system, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('THE HULK', W / 2, y - 2); ctx.textBaseline = 'middle';
  }

  function drawHud(g, opts) {
    const cs = getComputedStyle(document.documentElement);
    const sl = parseFloat(cs.getPropertyValue('--sl')) || 0, st = parseFloat(cs.getPropertyValue('--st')) || 0, sr = parseFloat(cs.getPropertyValue('--sr')) || 0;
    const p = g.p, x = 14 + sl, y = 12 + st;
    // health
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x, y, 160, 14);
    ctx.fillStyle = COL.hp; ctx.fillRect(x + 2, y + 2, 156 * p.hp / p.maxHp, 10);
    ctx.fillStyle = COL.ui; ctx.font = '700 11px system-ui, -apple-system, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.ceil(p.hp)}`, x + 6, y + 7.5);
    // level and XP
    const need = xpNeed(g.level);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x, y + 18, 160, 7);
    ctx.fillStyle = COL.xp; ctx.fillRect(x + 1.5, y + 19.5, 157 * Math.min(1, g.xp / need), 4);
    ctx.fillStyle = COL.ui; ctx.fillText(`Lv ${g.level}`, x + 166, y + 21);
    // time and kills, right of the pause button
    ctx.textAlign = 'right'; ctx.font = '800 16px system-ui, -apple-system, sans-serif';
    ctx.fillText(fmtTime(g.t), W - sr - 16, y + 8);
    ctx.font = '700 12px system-ui, -apple-system, sans-serif'; ctx.fillStyle = COL.uiDim;
    ctx.fillText(`${g.kills} kills · ${g.weapon.name}`, W - sr - 16, y + 26);
    if (opts.fps) { ctx.textAlign = 'left'; ctx.fillText(`${R.fps | 0} fps · ${g.enemies.length} foes`, x, y + 40); }
  }

  function drawControls(g, inp) {
    const L = inp.layout, f = L.fire, d = L.dash, w = g.weapon, p = g.p;
    // move stick
    if (inp.moveBase) {
      ringAt(inp.moveBase.x, inp.moveBase.y, L.moveR, 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0.25)');
      circle(inp.moveBase.x + inp.move.x * L.moveR, inp.moveBase.y + inp.move.y * L.moveR, L.moveR * 0.42, 'rgba(255,255,255,0.45)');
    }
    // fire stick and its ring of rounds
    ringAt(f.x, f.y, f.r, 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.18)');
    const kx = f.x + (inp.fire.down ? inp.fire.x * f.r : 0), ky = f.y + (inp.fire.down ? inp.fire.y * f.r : 0);
    circle(kx, ky, f.r * 0.45, inp.fire.engaged === true ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.45)');
    const rr = f.r + 9, n = w.rounds, a0 = -Math.PI / 2;
    ctx.lineWidth = 6; ctx.lineCap = 'butt';
    if (n <= 12) {
      const gap = 0.09, seg = TAU / n;
      for (let i = 0; i < n; i++) {
        const fill = Math.max(0, Math.min(1, g.ammo - i));
        const s0 = a0 + i * seg + gap / 2, s1 = a0 + (i + 1) * seg - gap / 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.arc(f.x, f.y, rr, s0, s1); ctx.stroke();
        if (fill > 0) { ctx.strokeStyle = fill >= 1 ? COL.gold : 'rgba(255,194,58,0.5)'; ctx.beginPath(); ctx.arc(f.x, f.y, rr, s0, s0 + (s1 - s0) * fill); ctx.stroke(); }
      }
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.arc(f.x, f.y, rr, 0, TAU); ctx.stroke();
      ctx.strokeStyle = COL.gold; ctx.beginPath(); ctx.arc(f.x, f.y, rr, a0, a0 + TAU * g.ammo / n); ctx.stroke();
    }
    if (g.reloadT > 0) { // a full reload: a thin white sweep inside the ring
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(f.x, f.y, rr - 7, a0, a0 + TAU * (1 - g.reloadT / w.reloadTime)); ctx.stroke();
    }
    ctx.fillStyle = COL.ui; ctx.font = '700 10px system-ui, -apple-system, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(w.trigger === 'release' ? 'drag · let go' : w.trigger === 'hold' ? 'hold to fire' : 'auto · drag to aim', f.x, f.y + f.r + 26);
    // dash button with its charges
    const ready = p.charges >= 1;
    const dx = d.x + (inp.dash.down ? inp.dash.x * d.r * 0.8 : 0), dy = d.y + (inp.dash.down ? inp.dash.y * d.r * 0.8 : 0);
    ringAt(d.x, d.y, d.r, ready ? 'rgba(159,233,255,0.22)' : 'rgba(255,255,255,0.06)', ready ? 'rgba(159,233,255,0.6)' : 'rgba(255,255,255,0.15)');
    if (inp.dash.down) circle(dx, dy, d.r * 0.5, 'rgba(159,233,255,0.6)');
    for (let i = 0; i < DASH.charges; i++) {
      const full = i < p.charges, part = i === p.charges ? 1 - p.recharge / DASH.recharge : 0;
      const bx = d.x - 9 + i * 18, by = d.y + d.r + 9;
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(bx - 7, by, 14, 4);
      ctx.fillStyle = COL.dash; ctx.fillRect(bx - 7, by, 14 * (full ? 1 : part), 4);
    }
    ctx.fillStyle = COL.ui; ctx.fillText('DASH', d.x, d.y + 4);
    // spawn stick: a cooldown sweep
    const S = L.spawn, sready = g.spawnCool <= 0;
    const sx = S.x + (inp.spawn.down ? inp.spawn.x * S.r * 0.8 : 0), sy = S.y + (inp.spawn.down ? inp.spawn.y * S.r * 0.8 : 0);
    ringAt(S.x, S.y, S.r, sready ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.06)', sready ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.15)');
    if (!sready) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(S.x, S.y, S.r + 5, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - g.spawnCool / SPAWN.cooldown)); ctx.stroke();
    }
    if (inp.spawn.down) circle(sx, sy, S.r * 0.5, 'rgba(255,255,255,0.6)');
    ctx.fillStyle = COL.ui; ctx.fillText('SPAWN', S.x, S.y + 4);
  }
  function ringAt(x, y, r, fill, stroke) {
    ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
  }
  return R;
}

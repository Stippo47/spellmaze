// The filming bot: plays through real touch events. Loaded into the page by tools/film.mjs (and tests).
// window.BOT.think() once per filmed frame; BOT.cfg says what it does.
(() => {
  const SM = window.SM, cv = document.getElementById('game');
  const B = window.BOT = { goal: -1, gf: null, f: 0, fire: null, move: null, dash: null, cfg: {} };
  const ev = (type, id, x, y) => cv.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: id === 11 }));
  function pickGoal(g) {
    // goals: far node centres that aren't dead ends (dead ends get you cornered)
    const m = g.m, G = m.G, P = m.P, N = m.N; let d = null;
    for (let t = 0; t < 200 && !d; t++) {
      const i = (Math.random() * N) | 0, j = (Math.random() * N) | 0, x = m.cxs[i], y = m.cys[j];
      if (Math.hypot(x - g.p.x, y - g.p.y) > 80 && !m.deadEnds.some(e => e.x === x && e.y === y)) d = { x, y };
    }
    if (!d && m.arena) for (let t = 0; t < 200 && !d; t++) { const x = 20 + Math.random() * 130, y = 45 + Math.random() * 80; if (m.clear[Math.floor(y) * G + Math.floor(x)]) d = { x, y }; }
    d = d || m.deadEnds[0];
    B.gf = B.gf || new Uint16Array(G * G);
    SM.lib.pathField(m, d.x, d.y, 4000, B.gf); B.goal = d;
  }
  B.think = () => {
    if (SM.g.run.offers.length) SM.pickOffer((Math.random() * 4) | 0);   // the bot takes a card without looking
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
    if (B.cfg.approach) { // close in on the nearest enemy you can see (dash films)
      let tg = null, td = 30;
      for (const e of g.enemies) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < td && SM.lib.lineClear(m, p.x, p.y, e.x, e.y)) { td = d; tg = e; } }
      if (tg && td > 4) { mx = (tg.x - p.x) / td; my = (tg.y - p.y) / td; }
      else if (tg) { mx = -(tg.x - p.x) / td; my = -(tg.y - p.y) / td; }
    } else if (!B.stuck) { mx += ax * 3; my += ay * 3; } const mm = Math.hypot(mx, my) || 1; mx /= mm; my /= mm;
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
    // dash: away through the crowd now and then, or (dashAt) into the nearest enemy
    if (B.cfg.dash) {
      const D = L.dash;
      const want = B.cfg.dashAt ? (near && nd < 10 && B.f - (B.lastDash || -99) > 18) : ((Math.hypot(ax, ay) > 0.25 || B.stuck) && B.f % 6 === 0);
      if (want && !B.dash && p.charges >= 1) B.lastDash = B.f;
      if (!B.dash && p.charges >= 1 && want) {
        let dx = mx, dy = my;
        if (B.cfg.dashAt && near) { const ex = near.x - p.x, ey = near.y - p.y, ed = Math.hypot(ex, ey) || 1; dx = ex / ed; dy = ey / ed; }
        ev('pointerdown', 13, D.x, D.y); B.dash = { f: B.f, dx, dy };
      } else if (B.dash) {
        const k = Math.min(1, (B.f - B.dash.f) / 2) * 0.8;
        ev('pointermove', 13, D.x + B.dash.dx * F.r * k, D.y + B.dash.dy * F.r * k);
        if (B.f - B.dash.f >= 3) { ev('pointerup', 13, D.x + B.dash.dx * F.r * k, D.y + B.dash.dy * F.r * k); B.dash = null; }
      }
    }
    // spawn: throw a ball at the nearest enemy when it's ready
    if (B.cfg.spawn) {
      const S = L.spawn;
      if (!B.spawn && g.spawnCool <= 0 && near && nd < 12) { const ex = near.x - p.x, ey = near.y - p.y, ed = Math.hypot(ex, ey) || 1; ev('pointerdown', 14, S.x, S.y); B.spawn = { f: B.f, dx: ex / ed, dy: ey / ed }; }
      else if (B.spawn) {
        const k = Math.min(1, (B.f - B.spawn.f) / 2) * 0.8;
        ev('pointermove', 14, S.x + B.spawn.dx * F.r * k, S.y + B.spawn.dy * F.r * k);
        if (B.f - B.spawn.f >= 3) { ev('pointerup', 14, S.x + B.spawn.dx * F.r * k, S.y + B.spawn.dy * F.r * k); B.spawn = null; }
      }
    }
  };
})();

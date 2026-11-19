// Touch controls (Brawl Stars style) plus keyboard and mouse for the desktop.
// Left half: a floating move stick. Bottom right: the fire stick, with the dash button to its left.
export const DEAD = 0.25;      // a stick counts as aimed past a quarter of its reach
const TAP_TIME = 0.25;

export function makeInput(canvas, getPlayerScreen) {
  const S = {
    move: { x: 0, y: 0 }, fire: { down: false, engaged: false, x: 0, y: 0, mag: 0 },
    dash: { down: false, engaged: false, x: 0, y: 0, mag: 0 },
    spawn: { down: false, engaged: false, x: 0, y: 0, mag: 0 },
    events: [], layout: null, touches: new Map(), keys: new Set(), mouse: null, moveBase: null, showFingers: false,
  };

  function layout() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const cs = getComputedStyle(document.documentElement);
    const sr = parseFloat(cs.getPropertyValue('--sr')) || 0, sb = parseFloat(cs.getPropertyValue('--sb')) || 0;
    const R = Math.min(60, h * 0.15);
    const fire = { x: w - sr - R * 1.9, y: h - sb - R * 1.65, r: R };
    const dash = { x: fire.x - R * 2.35, y: fire.y + R * 0.45, r: R * 0.58 };
    const spawn = { x: fire.x - R * 1.25, y: fire.y - R * 2.05, r: R * 0.5 };   // above-left of fire
    S.layout = { w, h, fire, dash, spawn, moveR: R };
    return S.layout;
  }
  layout();
  addEventListener('resize', layout);

  const now = () => performance.now() / 1000;
  function stick(st, base, x, y, R) {
    let dx = (x - base.x) / R, dy = (y - base.y) / R;
    const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
    st.x = dx; st.y = dy; st.mag = Math.min(1, m);
    if (st.mag > DEAD) st.engaged = true; else if (st.engaged && st.mag < DEAD * 0.6) st.engaged = 'cancel';
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (e.pointerType === 'mouse') { S.mouse = { x: e.clientX, y: e.clientY, t: now(), down: true }; mouseAim(); return; }
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    const L = S.layout, x = e.clientX, y = e.clientY;
    const inF = Math.hypot(x - L.fire.x, y - L.fire.y) < L.fire.r * 1.7;
    const inD = Math.hypot(x - L.dash.x, y - L.dash.y) < L.dash.r * 1.8;
    const inS = Math.hypot(x - L.spawn.x, y - L.spawn.y) < L.spawn.r * 1.9;
    let role = null;
    if (inS && !S.spawn.down) role = 'spawn';
    else if (inD && !S.dash.down) role = 'dash';
    else if (inF && !S.fire.down) role = 'fire';
    else if (x < L.w * 0.5 && !S.moveBase) role = 'move';
    if (!role) return;
    const t = { role, id: e.pointerId, x0: x, y0: y, x, y, t0: now() };
    S.touches.set(e.pointerId, t);
    if (role === 'move') { S.moveBase = { x, y }; S.move.x = S.move.y = 0; }
    if (role === 'fire') Object.assign(S.fire, { down: true, engaged: false, x: 0, y: 0, mag: 0 });
    if (role === 'dash') Object.assign(S.dash, { down: true, engaged: false, x: 0, y: 0, mag: 0 });
    if (role === 'spawn') Object.assign(S.spawn, { down: true, engaged: false, x: 0, y: 0, mag: 0 });
  }, { passive: false });

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') { if (S.mouse) { S.mouse.x = e.clientX; S.mouse.y = e.clientY; } else S.mouseHover = { x: e.clientX, y: e.clientY }; mouseAim(); return; }
    const t = S.touches.get(e.pointerId); if (!t) return;
    t.x = e.clientX; t.y = e.clientY;
    const L = S.layout;
    if (t.role === 'move') {
      let dx = t.x - S.moveBase.x, dy = t.y - S.moveBase.y; const d = Math.hypot(dx, dy), R = L.moveR;
      if (d > R) { S.moveBase.x = t.x - dx / d * R; S.moveBase.y = t.y - dy / d * R; dx = dx / d * R; dy = dy / d * R; } // base follows the thumb
      S.move.x = dx / R; S.move.y = dy / R;
    }
    if (t.role === 'fire') stick(S.fire, L.fire, t.x, t.y, L.fire.r);
    if (t.role === 'dash') stick(S.dash, { x: t.x0, y: t.y0 }, t.x, t.y, L.fire.r);
    if (t.role === 'spawn') stick(S.spawn, { x: t.x0, y: t.y0 }, t.x, t.y, L.fire.r);
  });

  function end(e) {
    if (e.pointerType === 'mouse') {
      if (S.mouse) { const m = S.mouse; S.mouse = null; mouseAim();
        const ps = getPlayerScreen(); S.events.push({ type: 'fireRelease', x: m.x - ps.x, y: m.y - ps.y });
        S.fire.down = false; S.fire.engaged = false; }
      return;
    }
    const t = S.touches.get(e.pointerId); if (!t) return;
    S.touches.delete(e.pointerId);
    const quick = now() - t.t0 < TAP_TIME;
    if (t.role === 'move') { S.moveBase = null; S.move.x = S.move.y = 0; }
    if (t.role === 'fire') {
      if (S.fire.engaged === true) S.events.push({ type: 'fireRelease', x: S.fire.x, y: S.fire.y });
      else if (!S.fire.engaged && quick) S.events.push({ type: 'fireTap' });
      Object.assign(S.fire, { down: false, engaged: false, mag: 0 });
    }
    if (t.role === 'dash') {
      if (S.dash.engaged === true) S.events.push({ type: 'dashRelease', x: S.dash.x, y: S.dash.y, mag: S.dash.mag });
      else if (!S.dash.engaged) S.events.push({ type: 'dashTap' });
      Object.assign(S.dash, { down: false, engaged: false, mag: 0 });
    }
    if (t.role === 'spawn') {
      if (S.spawn.engaged === true) S.events.push({ type: 'spawnRelease', x: S.spawn.x, y: S.spawn.y, mag: S.spawn.mag });
      else if (!S.spawn.engaged) S.events.push({ type: 'spawnTap' });
      Object.assign(S.spawn, { down: false, engaged: false, mag: 0 });
    }
  }
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  function mouseAim() {
    if (!S.mouse) { if (!S.keys.size) {} S.fire.down = false; S.fire.engaged = false; return; }
    const ps = getPlayerScreen(), dx = S.mouse.x - ps.x, dy = S.mouse.y - ps.y, d = Math.hypot(dx, dy) || 1;
    S.fire.down = true; S.fire.engaged = true; S.fire.x = dx / d; S.fire.y = dy / d; S.fire.mag = 1;
  }

  const KEYS = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
  function keyMove() {
    if (S.moveBase) return;
    let x = 0, y = 0; for (const k of S.keys) if (KEYS[k]) { x += KEYS[k][0]; y += KEYS[k][1]; }
    const d = Math.hypot(x, y) || 1; S.move.x = x / d; S.move.y = y / d;
  }
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Space') { S.events.push({ type: 'dashTap' }); e.preventDefault(); return; }
    if (e.code === 'KeyE') { S.events.push({ type: 'fireTap' }); return; }
    if (e.code === 'KeyQ') { S.events.push({ type: 'spawnTap' }); return; }
    if (KEYS[e.code]) { S.keys.add(e.code); keyMove(); }
  });
  addEventListener('keyup', (e) => { S.keys.delete(e.code); keyMove(); });
  S.mouseAim = mouseAim;
  S.relayout = layout;
  return S;
}

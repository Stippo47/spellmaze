// Spellmaze art kit: draws design pictures on a canvas. A page sets window.SCENE and window.W/H, then loads this.
"use strict";
const COL = {
  bg: '#05070f', floor: '#0a0e1c', grid: 'rgba(90,110,200,0.07)', wall: '#6a5cff', wallFill: '#0d0b26',
  player: '#38e8ff', shot: '#c8fbff', enemy: '#ff3355', enemy2: '#ff3bd0', eshot: '#ff2a4a',
  xp: '#3dffb0', gold: '#ffb300', burn: '#ff8a1f', chill: '#bfe6ff', shock: '#fff23a', poison: '#8cff2a',
  mark: '#ff6ad5', text: '#e8f0ff', dim: '#7c86b8',
  path: '#38e8ff', form: '#e8f0ff', spawn: '#ffd23f', rule: '#d06bff', rune: '#ffb300',
  common: '#e8f0ff', rare: '#3d8bff', epic: '#b45cff', legendary: '#ffb300',
};
let STYLE = 'C';
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
ctx.scale(2, 2);
const TAU = Math.PI * 2;
let SEED = 7;
function rnd() { SEED = (SEED * 16807) % 2147483647; return (SEED - 1) / 2147483646; }
function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

function glow(col, b) { ctx.shadowColor = col; ctx.shadowBlur = STYLE === 'D' ? 0 : b; }
function noGlow() { ctx.shadowBlur = 0; }
function lineW(w) { ctx.lineWidth = STYLE === 'D' ? w * 1.6 : STYLE === 'A' ? w * 0.6 : w; }

// ---------- primitives ----------
function poly(kind, x, y, r, rot) {
  ctx.beginPath();
  if (kind === 'circle' || kind === 'ring') { ctx.arc(x, y, r, 0, TAU); return; }
  if (kind === 'half') { ctx.arc(x, y, r, Math.PI + rot, TAU + rot); ctx.closePath(); return; }
  const sides = { tri: 3, square: 4, diamond: 4, hex: 6, star: 10, dart: 3 }[kind];
  let base = rot + ({ square: Math.PI / 4, diamond: 0, tri: 0, hex: 0, star: 0, dart: 0 }[kind]);
  for (let i = 0; i < sides; i++) {
    const a = base + i / sides * TAU;
    let rr = r;
    if (kind === 'star') rr = i % 2 ? r * 0.5 : r;
    if (kind === 'square') rr = r * 1.25;
    if (kind === 'dart') rr = i === 0 ? r * 1.4 : r * 0.8;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}
// A body in the current style.
function ent(kind, x, y, r, col, rot = 0, o = {}) {
  ctx.save();
  const a = o.alpha ?? 1;
  ctx.globalAlpha = a;
  poly(kind, x, y, r, rot);
  if (STYLE === 'A') { glow(col, 18); ctx.lineWidth = 1.3; ctx.strokeStyle = col; ctx.stroke(); ctx.stroke(); }
  else if (STYLE === 'B') { glow(col, 18); ctx.fillStyle = col; ctx.fill(); noGlow(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; poly(kind, x, y, r * 0.45, rot); ctx.fill(); }
  else if (STYLE === 'C') { ctx.fillStyle = rgba(col, 0.2); ctx.fill(); glow(col, 12); lineW(2.2); ctx.strokeStyle = col; ctx.stroke(); noGlow(); ctx.globalAlpha = a * 0.6; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.8; ctx.stroke(); }
  else { ctx.fillStyle = rgba(col, 0.55); ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = col; ctx.stroke(); }
  ctx.restore();
}
function line(pts, col, w = 2, o = {}) {
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  if (o.dash) ctx.setLineDash(o.dash);
  glow(col, o.blur ?? 10); lineW(w); ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
  ctx.restore();
}
function circ(x, y, r, col, o = {}) {
  ctx.save(); ctx.globalAlpha = o.alpha ?? 1; if (o.dash) ctx.setLineDash(o.dash);
  ctx.beginPath(); ctx.arc(x, y, r, o.a0 ?? 0, o.a1 ?? TAU);
  if (o.fill != null) { ctx.fillStyle = rgba(col, o.fill); ctx.fill(); }
  if (o.stroke !== false) { glow(col, o.blur ?? 10); lineW(o.w ?? 2); ctx.strokeStyle = col; ctx.stroke(); }
  ctx.restore();
}
function dot(x, y, r, col, a = 1) { ctx.save(); ctx.globalAlpha = a; glow(col, 8); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore(); }
function text(s, x, y, size, col = COL.text, align = 'left', weight = 700) {
  ctx.save(); noGlow(); ctx.fillStyle = col; ctx.font = `${weight} ${size}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); ctx.restore();
}
function wrap(s, x, y, maxW, size, col = COL.text, lh = 1.3, weight = 500) {
  ctx.save(); ctx.font = `${weight} ${size}px "Segoe UI", system-ui, sans-serif`;
  const words = s.split(' '); let ln = '', yy = y;
  for (const w of words) { const t = ln ? ln + ' ' + w : w; if (ctx.measureText(t).width > maxW && ln) { text(ln, x, yy, size, col, 'left', weight); ln = w; yy += size * lh; } else ln = t; }
  if (ln) text(ln, x, yy, size, col, 'left', weight); ctx.restore(); return yy + size * lh;
}
function arrow(x0, y0, x1, y1, col, w = 2, head = 7, o = {}) {
  line([[x0, y0], [x1, y1]], col, w, o);
  const a = Math.atan2(y1 - y0, x1 - x0);
  line([[x1 - Math.cos(a - 0.5) * head, y1 - Math.sin(a - 0.5) * head], [x1, y1], [x1 - Math.cos(a + 0.5) * head, y1 - Math.sin(a + 0.5) * head]], col, w, o);
}
function bez(p0, c, p1, n = 24) { const out = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; out.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]); } return out; }
function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
function ang(a, b) { return Math.atan2(b[1] - a[1], b[0] - a[0]); }

// ---------- things ----------
function player(x, y, r, aim = 0, o = {}) {
  ent('circle', x, y, r, COL.player, 0, o);
  circ(x, y, r * 0.45, COL.player, { w: 1.5, alpha: (o.alpha ?? 1) * 0.8, blur: 6 });
  if (aim != null && !o.noAim) { const ax = x + Math.cos(aim) * r * 1.35, ay = y + Math.sin(aim) * r * 1.35; dot(ax, ay, r * 0.22, COL.shot, o.alpha ?? 1); }
}
function ghostP(x, y, r, a) { player(x, y, r, null, { alpha: a, noAim: true }); }
function bolt(x, y, a, col = COL.shot, len = 14, w = 4.5, streak = 28) {
  line([[x - Math.cos(a) * streak, y - Math.sin(a) * streak], [x, y]], col, w * 0.5, { alpha: 0.35, blur: 4 });
  line([[x - Math.cos(a) * len * 0.5, y - Math.sin(a) * len * 0.5], [x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5]], col, w, { blur: 14 });
  line([[x - Math.cos(a) * len * 0.3, y - Math.sin(a) * len * 0.3], [x + Math.cos(a) * len * 0.3, y + Math.sin(a) * len * 0.3]], '#ffffff', w * 0.4, { blur: 0 });
}
function beam(pts, col = COL.shot, w = 6) {
  line(pts, col, w * 1.8, { alpha: 0.25, blur: 22 });
  line(pts, col, w, { blur: 16 });
  line(pts, '#ffffff', w * 0.35, { blur: 0 });
  const e = pts[pts.length - 1]; dot(e[0], e[1], w * 0.9, col);
}
function blast(x, y, r, col = COL.shot, a = 1) {
  circ(x, y, r, col, { fill: 0.1 * a, w: 2.5, alpha: a, blur: 22 });
  circ(x, y, r * 0.7, col, { fill: 0.08 * a, w: 1, alpha: 0.5 * a });
  for (let i = 0; i < 10; i++) { const t = i / 10 * TAU + 0.3; line([[x + Math.cos(t) * r * 0.75, y + Math.sin(t) * r * 0.75], [x + Math.cos(t) * r * 0.95, y + Math.sin(t) * r * 0.95]], col, 1.5, { alpha: 0.7 * a }); }
}
function lob(p0, p1, col = COL.shot, h = 40) { line(bez(p0, [(p0[0] + p1[0]) / 2, Math.min(p0[1], p1[1]) - h], p1), col, 1.5, { dash: [4, 6], alpha: 0.6, blur: 4 }); }
function bomb(x, y, r, col = COL.shot) { ent('circle', x, y, r, col); line([[x, y - r], [x + r * 0.6, y - r * 1.6]], COL.gold, 1.5); dot(x + r * 0.6, y - r * 1.6, 1.8, COL.gold); }
function ball(x, y, r, col = COL.player, hp = 0.8) {
  ent('circle', x, y, r, col);
  circ(x, y, r + 3.5, COL.xp, { a0: -Math.PI / 2, a1: -Math.PI / 2 + TAU * hp, w: 1.6, alpha: 0.8, blur: 4 });
  circ(x, y, r * 0.35, '#ffffff', { w: 1.2, alpha: 0.7, blur: 4 });
}
function mite(x, y, r = 9, col = COL.enemy, o = {}) { ent('circle', x, y, r, col, 0, o); dot(x + r * 0.25, y - r * 0.1, r * 0.18, '#ffffff', 0.9 * (o.alpha ?? 1)); }
function fx(kind, x, y, r) {
  if (kind === 'burn') {
    for (let i = 0; i < 4; i++) { const ox = (i - 1.5) * r * 0.45, h = r * (0.9 + (i % 2) * 0.5); line([[x + ox - 2.5, y - r * 0.6], [x + ox, y - r * 0.6 - h], [x + ox + 2.5, y - r * 0.6]], COL.burn, 1.6, { blur: 10 }); }
    circ(x, y, r + 2, COL.burn, { w: 1.4, alpha: 0.8 });
  } else if (kind === 'chill') {
    circ(x, y, r + 3, COL.chill, { w: 1.2, alpha: 0.9, dash: [3, 3] });
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; line([[x + Math.cos(a) * (r + 2), y + Math.sin(a) * (r + 2)], [x + Math.cos(a) * (r + 7), y + Math.sin(a) * (r + 7)]], COL.chill, 1.4); }
  } else if (kind === 'freeze') {
    ent('hex', x, y, r * 1.35, COL.chill, 0.3);
  } else if (kind === 'shock') {
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.5; const pts = [[x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6]]; let px = pts[0][0], py = pts[0][1]; for (let k = 0; k < 3; k++) { px += Math.cos(a + (k % 2 ? 0.8 : -0.8)) * 4; py += Math.sin(a + (k % 2 ? 0.8 : -0.8)) * 4; pts.push([px, py]); } line(pts, COL.shock, 1.4, { blur: 8 }); }
  } else if (kind === 'poison') {
    for (let i = 0; i < 4; i++) dot(x + (i - 1.5) * r * 0.5, y - r - 3 - (i % 2) * 5, 1.8 + (i % 2), COL.poison, 0.9);
    circ(x, y, r + 2, COL.poison, { w: 1.2, alpha: 0.7 });
  } else if (kind === 'mark') {
    circ(x, y, r + 6, COL.mark, { w: 1.4 });
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; line([[x + Math.cos(a) * (r + 3), y + Math.sin(a) * (r + 3)], [x + Math.cos(a) * (r + 10), y + Math.sin(a) * (r + 10)]], COL.mark, 1.4); }
  } else if (kind === 'leech') {
    for (let i = 0; i < 3; i++) { const yy = y - r - 4 - i * 6; line([[x - 3, yy], [x + 3, yy]], COL.xp, 1.6); line([[x, yy - 3], [x, yy + 3]], COL.xp, 1.6); }
  }
}
function arc(a, b, col = COL.shock, w = 1.6, jag = 6) {
  const pts = [a]; const n = 6;
  for (let i = 1; i < n; i++) { const p = lerp(a, b, i / n); const an = ang(a, b) + Math.PI / 2; const o = (rnd() - 0.5) * jag * 2; pts.push([p[0] + Math.cos(an) * o, p[1] + Math.sin(an) * o]); }
  pts.push(b); line(pts, col, w, { blur: 12 });
}
function gem(x, y, s = 4) { ent('diamond', x, y, s, COL.xp); }
function chest(x, y, s, col = COL.gold, a = 1) {
  ctx.save(); ctx.globalAlpha = a;
  ent('square', x, y, s, col, 0, { alpha: a });
  line([[x - s * 1.25, y - s * 0.2], [x + s * 1.25, y - s * 0.2]], col, 1.5, { alpha: a });
  dot(x, y + s * 0.2, s * 0.22, '#ffffff', a);
  ctx.restore();
}

// ---------- module icons ----------
const MODS = {
  home: ['Home', 'path'], bounce: ['Bounce', 'path'], pierce: ['Pierce', 'path'], orbit: ['Orbit', 'path'], return: ['Return', 'path'],
  extra: ['Extra', 'form'], grow: ['Grow', 'form'], haste: ['Haste', 'form'], split: ['Split', 'form'], swarm: ['Swarm', 'form'],
  burn: ['Burn', 'burn'], chill: ['Chill', 'chill'], shock: ['Shock', 'shock'], poison: ['Poison', 'poison'], mark: ['Mark', 'mark'],
  knock: ['Knock', 'form'], pull: ['Pull', 'form'], leech: ['Leech', 'xp'],
  explode: ['Explode', 'spawn'], shrapnel: ['Shrapnel', 'spawn'], gunner: ['Gunner', 'spawn'], trail: ['Trail', 'spawn'], echo: ['Echo', 'spawn'],
  link: ['Link', 'rule'], follow: ['Follow', 'rule'], charge: ['Charge', 'rule'], ghost: ['Ghost', 'rule'], rune: ['Rune', 'rune'],
};
function modCol(id) { return COL[MODS[id][1]]; }
function glyph(id, x, y, s, col) {
  const L = (pts, w = 2) => line(pts.map(p => [x + p[0] * s, y + p[1] * s]), col, w, { blur: 8 });
  const C = (cx, cy, r, o = {}) => circ(x + cx * s, y + cy * s, r * s, col, { w: 2, blur: 8, ...o });
  const D = (cx, cy, r) => dot(x + cx * s, y + cy * s, r * s, col);
  switch (id) {
    case 'home': L(bez([-0.8, 0.6], [-0.6, -0.8], [0.5, -0.3])); D(0.65, -0.25, 0.18); break;
    case 'bounce': L([[-0.8, -0.6], [0, 0.5], [0.8, -0.6]]); L([[-0.9, 0.7], [0.9, 0.7]], 1.5); break;
    case 'pierce': C(0, 0, 0.35); L([[-0.9, 0], [0.9, 0]]); L([[0.6, -0.25], [0.9, 0], [0.6, 0.25]]); break;
    case 'orbit': C(0, 0, 0.7, { dash: [3, 3] }); D(0, 0, 0.18); D(0.7, 0, 0.16); break;
    case 'return': L([[0.8, 0.5], [-0.3, 0.5]].concat(bez([-0.3, 0.5], [-0.95, 0], [-0.3, -0.5]).slice(1)).concat([[0.8, -0.5]])); L([[0.5, -0.75], [0.8, -0.5], [0.5, -0.25]]); break;
    case 'extra': L([[-0.8, 0], [0.8, -0.6]]); L([[-0.8, 0], [0.8, 0]]); L([[-0.8, 0], [0.8, 0.6]]); break;
    case 'grow': C(-0.4, 0.3, 0.25); C(0.25, -0.15, 0.55); break;
    case 'haste': L([[-0.7, -0.6], [-0.1, 0], [-0.7, 0.6]]); L([[0, -0.6], [0.6, 0], [0, 0.6]]); break;
    case 'split': L([[-0.8, 0], [0, 0]]); L([[0, 0], [0.8, -0.6]]); L([[0, 0], [0.8, 0.6]]); break;
    case 'swarm': for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; D(Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0.15); } break;
    case 'burn': L([[-0.45, 0.7], [-0.55, 0], [-0.15, -0.35], [0, -0.85], [0.2, -0.3], [0.5, 0], [0.45, 0.7], [-0.45, 0.7]]); break;
    case 'chill': for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI; L([[Math.cos(a) * 0.8, Math.sin(a) * 0.8], [-Math.cos(a) * 0.8, -Math.sin(a) * 0.8]]); } break;
    case 'shock': L([[0.2, -0.9], [-0.35, 0.05], [0.25, 0.05], [-0.2, 0.9]]); break;
    case 'poison': L(bez([0, -0.85], [-0.75, 0.3], [0, 0.7]).concat(bez([0, 0.7], [0.75, 0.3], [0, -0.85]).slice(1))); break;
    case 'mark': C(0, 0, 0.5); L([[-0.9, 0], [-0.55, 0]]); L([[0.55, 0], [0.9, 0]]); L([[0, -0.9], [0, -0.55]]); L([[0, 0.55], [0, 0.9]]); break;
    case 'knock': L([[-0.8, -0.7], [-0.8, 0.7]]); L([[-0.4, 0], [0.8, 0]]); L([[0.5, -0.3], [0.8, 0], [0.5, 0.3]]); break;
    case 'pull': L([[-0.85, 0], [-0.2, 0]]); L([[-0.45, -0.25], [-0.2, 0], [-0.45, 0.25]]); L([[0.85, 0], [0.2, 0]]); L([[0.45, -0.25], [0.2, 0], [0.45, 0.25]]); D(0, 0, 0.12); break;
    case 'leech': L([[-0.6, 0], [0.6, 0]], 2.6); L([[0, -0.6], [0, 0.6]], 2.6); break;
    case 'explode': for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; L([[Math.cos(a) * 0.3, Math.sin(a) * 0.3], [Math.cos(a) * (i % 2 ? 0.6 : 0.9), Math.sin(a) * (i % 2 ? 0.6 : 0.9)]]); } break;
    case 'shrapnel': C(0, 0, 0.22); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; L([[Math.cos(a) * 0.5, Math.sin(a) * 0.5], [Math.cos(a) * 0.85, Math.sin(a) * 0.85]]); } break;
    case 'gunner': C(-0.2, 0.2, 0.45); L([[0.05, -0.05], [0.8, -0.6]], 2.6); D(0.9, -0.75, 0.1); break;
    case 'trail': L([[-0.9, 0.5], [-0.5, 0.5]]); L([[-0.3, 0.2], [0.1, 0.2]]); L([[0.3, -0.1], [0.7, -0.1]]); D(0.85, -0.25, 0.15); break;
    case 'echo': C(0.25, 0, 0.45); C(-0.25, 0, 0.45, { alpha: 0.45 }); break;
    case 'link': D(-0.6, 0.4, 0.2); D(0.6, -0.4, 0.2); L([[-0.6, 0.4], [-0.2, 0.1], [0.05, 0.25], [0.6, -0.4]], 1.6); break;
    case 'follow': D(0.5, -0.4, 0.22); C(-0.4, 0.4, 0.3); L([[-0.15, 0.15], [0.3, -0.25]], 1.2); break;
    case 'charge': C(0, 0, 0.3); C(0, 0, 0.7, { a0: -2.4, a1: 0.6 }); break;
    case 'ghost': ctx.save(); ctx.setLineDash([3, 3]); L([[-0.6, -0.7], [0.6, -0.7], [0.6, 0.7], [-0.6, 0.7], [-0.6, -0.7]]); ctx.restore(); L([[-0.9, 0], [0.9, 0]]); break;
    case 'rune': L([[0, -0.9], [0.75, 0], [0, 0.9], [-0.75, 0], [0, -0.9]]); C(0, 0, 0.25, { dash: [2, 2] }); break;
  }
}
function chip(id, x, y, s, rarity = 'common', lvl = null) {
  const col = modCol(id);
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x - s / 2, y - s / 2, s, s, s * 0.22);
  ctx.fillStyle = rgba(col, 0.1); ctx.fill();
  glow(COL[rarity], 10); ctx.lineWidth = 2; ctx.strokeStyle = COL[rarity]; ctx.stroke();
  ctx.restore();
  glyph(id, x, y, s * 0.3, col);
  if (lvl != null) text(String(lvl), x + s * 0.32, y + s * 0.34, s * 0.24, COL.text, 'center', 800);
}

// ---------- module diagram panels ----------
// Panel world: 300x300. Walls top/bottom and right. Player left. Three mites.
const PW = 300;
const P0 = [42, 150];
const E = [[172, 112], [222, 196], [146, 222]];
function panelBase(title) {
  ctx.fillStyle = COL.floor; ctx.fillRect(0, 0, PW, PW);
  ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
  for (let i = 0; i <= PW; i += 15) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, PW); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(PW, i); ctx.stroke(); }
  wallRect(0, 0, PW, 26); wallRect(0, PW - 26, PW, 26); wallRect(PW - 26, 26, 26, PW - 52);
  text(title, 10, 13, 13, COL.dim, 'left', 800);
}
function wallRect(x, y, w, h) {
  ctx.save(); ctx.fillStyle = COL.wallFill; ctx.fillRect(x, y, w, h);
  glow(COL.wall, 10); ctx.strokeStyle = COL.wall; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2); ctx.restore();
}
function mites(hit = [], col = null, fxk = null, skip = []) {
  E.forEach((e, i) => { if (skip.includes(i)) return; mite(e[0], e[1], 11, (hit.includes(i) && col) ? col : COL.enemy); if (hit.includes(i) && fxk) fx(fxk, e[0], e[1], 11); });
}
// default delivery per shape; col tints it. Returns hit indexes.
function baseShape(shape, col = COL.shot, o = {}) {
  const P = P0;
  if (shape === 'bolt') { line([P, E[0]], col, 1, { alpha: 0.25, dash: [3, 5] }); player(...P, 15, ang(P, E[0])); bolt(E[0][0] - 16, E[0][1] + 3, ang(P, E[0]), col); return [0]; }
  if (shape === 'beam') { player(...P, 15, ang(P, E[0])); beam([[P[0] + 18, P[1] - 5], [E[0][0] - 10, E[0][1] + 3]], col); return [0]; }
  if (shape === 'burst') { player(...P, 15, ang(P, [190, 165])); lob([P[0] + 14, P[1] - 8], [190, 165], col, 60); blast(190, 165, 62, col); return [0, 1, 2]; }
  if (shape === 'ball') { player(...P, 15, ang(P, E[0])); line(bez([P[0] + 16, P[1]], [110, 150], [E[0][0] - 20, E[0][1] + 8]), COL.player, 2, { alpha: 0.35, dash: [2, 5] }); ball(E[0][0] - 20, E[0][1] + 10, 13, o.ballCol ?? COL.player); if (col !== COL.shot) circ(E[0][0] - 20, E[0][1] + 10, 17, col, { w: 1.6 }); return [0]; }
  if (shape === 'self') {
    const end = [205, 150];
    for (let i = 0; i < 5; i++) { const p = lerp(P, end, i / 5); ghostP(p[0], p[1], 15, 0.1 + i * 0.07); }
    if (col !== COL.shot) line([[P[0] + 10, P[1]], [end[0] - 12, end[1]]], col, 10, { alpha: 0.25, blur: 18 });
    player(...end, 15, 0);
    arrow(E[0][0], E[0][1] + 14, E[0][0] + 4, E[0][1] - 4, COL.dim, 1.4, 5, { alpha: 0.6 });
    return [0];
  }
}
const SHAPES = [['bolt', 'Bolt'], ['beam', 'Beam'], ['burst', 'Burst'], ['ball', 'Ball'], ['self', 'Dash']];
function payload(shape, col, fxk) {
  const hit = baseShape(shape, col);
  if (shape === 'self') { E[0] = [178, 128]; }
  mites(hit, col, fxk);
  return hit;
}
function modPanel(id, shape) {
  panelBase(SHAPES.find(s => s[0] === shape)[1].toUpperCase());
  const P = P0;
  const pc = { burn: COL.burn, chill: COL.chill, shock: COL.shock, poison: COL.poison, mark: COL.mark }[id];
  if (pc) {
    const hit = payload(shape, pc, id === 'chill' ? 'chill' : id);
    if (id === 'shock') hit.forEach(i => { const j = (i + 1) % 3; arc(E[i], E[j]); fx('shock', ...E[j], 11); });
    return;
  }
  const S = shape;
  switch (id) {
    case 'home': {
      if (S === 'bolt') { player(...P, 15, -0.2); const pts = bez([P[0] + 16, P[1]], [150, 175], [E[1][0] - 12, E[1][1] - 6]); line(pts, COL.shot, 1.5, { alpha: 0.4, dash: [3, 4] }); bolt(E[1][0] - 14, E[1][1] - 7, 0.7); mites([1]); arc([P[0] + 30, P[1] - 4], [P[0] + 30, P[1] - 4], COL.shot); }
      if (S === 'beam') { player(...P, 15, 0); beam(bez([P[0] + 18, P[1]], [170, 150], [E[1][0] - 10, E[1][1] - 6])); mites([1]); }
      if (S === 'burst') { player(...P, 15, 0); lob([P[0] + 14, P[1] - 8], [235, 150], COL.shot, 40); line(bez([235, 150], [250, 175], E[1]), COL.shot, 1.5, { dash: [3, 4], alpha: 0.6 }); circ(235, 150, 6, COL.dim, { w: 1, alpha: 0.7 }); text('aim', 235, 136, 10, COL.dim, 'center'); blast(...E[1], 48); mites([1, 0]); }
      if (S === 'ball') { player(...P, 15, 0); line(bez([P[0] + 16, P[1]], [120, 90], E[0]).concat(bez(E[0], [240, 120], E[1]).slice(1)).concat(bez(E[1], [180, 270], E[2]).slice(1)), COL.player, 1.6, { dash: [3, 4], alpha: 0.5 }); ball(E[2][0] + 14, E[2][1] - 6, 12); mites([0, 1, 2]); }
      if (S === 'self') { const pts = bez(P, [140, 150], [E[1][0] - 22, E[1][1] - 8]); for (let i = 0; i < 5; i++) { const p = pts[i * 4]; ghostP(p[0], p[1], 15, 0.1 + i * 0.07); } player(E[1][0] - 24, E[1][1] - 10, 15, 0.5); mites([1]); }
      break;
    }
    case 'bounce': {
      if (S === 'bolt') { player(...P, 15, -0.5); const pts = [[P[0] + 14, P[1] - 8], [120, 28], [200, 272], [262, 160]]; line(pts, COL.shot, 1.4, { alpha: 0.4, dash: [3, 4] }); bolt(255, 175, ang(pts[2], pts[3])); text('×3', 128, 44, 12, COL.path, 'center'); mites([]); }
      if (S === 'beam') { player(...P, 15, -0.5); beam([[P[0] + 14, P[1] - 8], [120, 28], [200, 272], [272, 165]]); mites([]); }
      if (S === 'burst') { player(...P, 15, 0); lob([P[0] + 14, P[1] - 8], [130, 160], COL.shot, 50); blast(130, 160, 30); line(bez([130, 160], [165, 120], [200, 160]), COL.shot, 1.2, { dash: [3, 4], alpha: 0.6 }); blast(200, 160, 24); line(bez([200, 160], [225, 130], [250, 160]), COL.shot, 1.2, { dash: [3, 4], alpha: 0.6 }); blast(250, 160, 18); bomb(250, 160, 5); mites([]); }
      if (S === 'ball') { player(...P, 15, -0.5); const pts = [[P[0] + 14, P[1] - 8], [110, 30], [190, 270], [270, 140], [215, 30]]; line(pts, COL.player, 1.6, { dash: [3, 4], alpha: 0.5 }); ball(225, 52, 12); mites([]); text('no speed lost', 150, 290 - 8, 10, COL.dim, 'center'); }
      if (S === 'self') { const pts = [P, [130, 32], [210, 160]]; for (let i = 0; i < 8; i++) { const seg = i < 4 ? 0 : 1; const t = (i % 4) / 4; const p = lerp(pts[seg], pts[seg + 1], t); ghostP(p[0], p[1], 15, 0.08 + i * 0.05); } player(210, 160, 15, 0.9); mites([]); }
      break;
    }
    case 'pierce': {
      E[0] = [130, 150]; E[1] = [190, 150]; E[2] = [240, 150];
      if (S === 'bolt') { player(...P, 15, 0); line([[P[0] + 18, 150], [265, 150]], COL.shot, 1.2, { alpha: 0.3, dash: [3, 4] }); bolt(262, 150, 0); mites([0, 1, 2]); }
      if (S === 'beam') { player(...P, 15, 0); beam([[P[0] + 18, 150], [272, 150]]); mites([0, 1, 2]); }
      if (S === 'burst') { E[0] = [150, 150]; E[1] = [245, 150]; E[2] = [245, 210]; player(...P, 15, 0); lob([P[0] + 14, 142], [160, 150], COL.shot, 50); wallRect(190, 90, 16, 120); ctx.save(); ctx.beginPath(); ctx.arc(160, 150, 100, 0, TAU); ctx.clip(); blast(160, 150, 100); ctx.restore(); mites([0, 1]); text('through 1 wall', 200, 238, 10, COL.dim, 'center'); }
      if (S === 'ball') { player(...P, 15, 0); line([[P[0] + 18, 150], [258, 150]], COL.player, 1.4, { dash: [3, 4], alpha: 0.5 }); ball(258, 150, 12); mites([0, 1, 2]); }
      if (S === 'self') { for (let i = 0; i < 6; i++) ghostP(P[0] + i * 38, 150, 15, 0.08 + i * 0.06); player(258, 150, 15, 0); mites([0, 1, 2], COL.shot); }
      break;
    }
    case 'orbit': {
      if (S === 'bolt') { player(...P, 15, 0); circ(...P, 42, COL.shot, { dash: [3, 5], w: 1.2, alpha: 0.5 }); for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; bolt(P[0] + Math.cos(a) * 42, P[1] + Math.sin(a) * 42, a + Math.PI / 2, COL.shot, 10, 4, 14); } line([[P[0] + 42, P[1]], E[0]], COL.shot, 1, { dash: [3, 4], alpha: 0.4 }); text('circles, then flies out', 150, 255, 10, COL.dim, 'center'); mites([]); }
      if (S === 'beam') { player(...P, 15, 0); circ(...P, 110, COL.shot, { a0: -1.2, a1: 0.5, w: 8, alpha: 0.12, blur: 24 }); beam([[P[0] + 16, P[1] + 6], [P[0] + Math.cos(0.5) * 110, P[1] + Math.sin(0.5) * 110]]); arrow(P[0] + 95, P[1] - 60, P[0] + 110, P[1] - 20, COL.shot, 1.4, 6); mites([2]); }
      if (S === 'burst') { player(...P + 0, 15, 0); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; blast(110 + Math.cos(a) * 62, 150 + Math.sin(a) * 62, 26); } player(110, 150, 15, 0); mites([]); }
      if (S === 'ball') { player(110, 150, 15, 0); circ(110, 150, 48, COL.player, { dash: [3, 5], w: 1.2, alpha: 0.5 }); ball(110 + 48, 150 - 2, 11); line([[255, 120], [168, 148]], COL.eshot, 2, { alpha: 0.6 }); dot(170, 148, 5, COL.eshot); text('blocks shots', 200, 110, 10, COL.dim, 'center'); mites([1]); }
      if (S === 'self') { E[0] = [170, 150]; const c = E[0]; for (let i = 0; i < 6; i++) { const a = Math.PI + i * 0.45; ghostP(c[0] + Math.cos(a) * 70, c[1] + Math.sin(a) * 70, 15, 0.08 + i * 0.06); } const a = Math.PI + 6 * 0.45; player(c[0] + Math.cos(a) * 70, c[1] + Math.sin(a) * 70, 15, a + Math.PI); mites([0]); }
      break;
    }
    case 'return': {
      if (S === 'bolt') { player(...P, 15, 0); const pts = bez([P[0] + 16, 145], [330, 60], [P[0] + 16, 160]); line(pts, COL.shot, 1.4, { dash: [3, 4], alpha: 0.4 }); bolt(pts[18][0], pts[18][1], ang(pts[17], pts[18])); mites([0]); }
      if (S === 'beam') { player(...P, 15, 0); circ(...P, 160, COL.shot, { a0: -0.6, a1: 0.5, w: 10, alpha: 0.1, blur: 24 }); beam([[P[0] + 16, P[1]], [P[0] + Math.cos(-0.45) * 155, P[1] + Math.sin(-0.45) * 155]]); arrow(P[0] + 150, P[1] - 30, P[0] + 150, P[1] + 40, COL.shot, 1.4, 6, { alpha: 0.6 }); arrow(P[0] + 136, P[1] + 50, P[0] + 136, P[1] - 30, COL.shot, 1.4, 6, { alpha: 0.6 }); mites([0]); }
      if (S === 'burst') { player(...P, 15, 0); lob([P[0] + 14, 142], [190, 160], COL.shot, 50); blast(190, 160, 62); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; arrow(190 + Math.cos(a) * 58, 160 + Math.sin(a) * 58, 190 + Math.cos(a) * 30, 160 + Math.sin(a) * 30, COL.shot, 1.2, 5, { alpha: 0.7 }); } mites([0, 1, 2]); text('out, then back in', 190, 245, 10, COL.dim, 'center'); }
      if (S === 'ball') { player(...P, 15, 0); const pts = bez([P[0] + 16, 145], [320, 40], [P[0] + 20, 165]); line(pts, COL.player, 1.6, { dash: [3, 4], alpha: 0.5 }); ball(pts[20][0], pts[20][1], 12); text('catch = half charge back', 150, 255, 10, COL.dim, 'center'); mites([0]); }
      if (S === 'self') { for (let i = 0; i < 4; i++) ghostP(P[0] + i * 40, 150, 15, 0.1 + i * 0.06); ghostP(205, 150, 15, 0.45); line(bez([205, 135], [125, 80], [P[0], 132]), COL.player, 1.6, { dash: [3, 4] }); arrow(P[0] + 20, 128, P[0] + 4, 134, COL.player, 1.6, 6); player(...P, 15, 0); text('snaps back after 1 s', 150, 255, 10, COL.dim, 'center'); mites([]); }
      break;
    }
    case 'extra': {
      if (S === 'bolt') { player(...P, 15, 0); [-0.25, 0, 0.25].forEach(a => bolt(P[0] + Math.cos(a) * 120, P[1] + Math.sin(a) * 120, a)); mites([]); }
      if (S === 'beam') { player(...P, 15, 0); [-0.22, 0.22].forEach(a => beam([[P[0] + 16, P[1]], [P[0] + Math.cos(a) * 220, P[1] + Math.sin(a) * 220]], COL.shot, 4.5)); mites([]); }
      if (S === 'burst') { player(...P, 15, 0); [[175, 120], [215, 185]].forEach(p => { lob([P[0] + 14, 142], p, COL.shot, 50); blast(...p, 42); }); mites([0, 1]); }
      if (S === 'ball') { player(...P, 15, 0); ball(140, 110, 12); ball(150, 195, 12); mites([]); }
      if (S === 'self') { player(...P, 15, 0); [0, 1, 2].forEach(i => circ(P[0] - 12 + i * 12, P[1] + 30, 4, COL.player, { fill: i < 3 ? 0.9 : 0, w: 1.4 })); text('3 dash charges', P[0] + 2, P[1] + 46, 10, COL.dim, 'center'); for (let i = 0; i < 3; i++) ghostP(110 + i * 40, 150, 15, 0.15 + i * 0.1); mites([]); }
      break;
    }
    case 'grow': {
      if (S === 'bolt') { player(...P, 15, 0); bolt(150, 150, 0, COL.shot, 30, 13, 50); mites([]); }
      if (S === 'beam') { player(...P, 15, 0); beam([[P[0] + 16, P[1]], [E[0][0], 150]], COL.shot, 14); mites([0]); }
      if (S === 'burst') { player(...P, 15, 0); lob([P[0] + 14, 142], [185, 160], COL.shot, 50); blast(185, 160, 95); mites([0, 1, 2]); }
      if (S === 'ball') { player(...P, 15, 0); ball(150, 150, 26); mites([]); }
      if (S === 'self') { for (let i = 0; i < 5; i++) ghostP(P[0] + i * 34, 150, 15, 0.08 + i * 0.05); line([[P[0], 150], [205, 150]], COL.player, 46, { alpha: 0.1, blur: 20 }); player(205, 150, 15, 0); arrow(E[0][0], E[0][1] + 6, E[0][0] + 10, E[0][1] - 18, COL.dim, 1.5, 6); arrow(E[2][0], E[2][1] - 6, E[2][0] + 10, E[2][1] + 18, COL.dim, 1.5, 6); mites([]); }
      break;
    }
    case 'haste': {
      if (S === 'bolt') { player(...P, 15, 0); [0, 1, 2].forEach(i => bolt(110 + i * 55, 150, 0, COL.shot, 14, 4.5, 50)); mites([]); text('faster shots, faster reload', 150, 255, 10, COL.dim, 'center'); }
      if (S === 'beam') { player(...P, 15, 0); beam([[P[0] + 16, P[1]], [255, 150]]); for (let i = 0; i < 8; i++) circ(80 + i * 22, 150, 6, COL.shot, { w: 1, alpha: 0.5 }); mites([]); text('faster ticks, longer reach', 150, 255, 10, COL.dim, 'center'); }
      if (S === 'burst') { player(...P, 15, 0); lob([P[0] + 14, 142], [160, 160], COL.shot, 25); blast(160, 160, 40); lob([P[0] + 14, 142], [230, 140], COL.shot, 25); bomb(230, 140, 6); mites([0]); text('flatter, faster, sooner again', 150, 255, 10, COL.dim, 'center'); }
      if (S === 'ball') { player(...P, 15, 0); line([[P[0] + 16, 150], [230, 150]], COL.player, 1.4, { dash: [8, 3], alpha: 0.5 }); ball(230, 150, 12); for (let i = 0; i < 3; i++) line([[200 - i * 12, 140 + i * 10], [180 - i * 12, 140 + i * 10]], COL.player, 1.2, { alpha: 0.6 }); mites([]); }
      if (S === 'self') { for (let i = 0; i < 7; i++) ghostP(P[0] + i * 34, 150, 15, 0.06 + i * 0.05); player(262 - 10, 150, 15, 0); mites([]); text('longer dash, faster recharge', 150, 255, 10, COL.dim, 'center'); }
      break;
    }
    case 'split': {
      if (S === 'bolt') { player(...P, 15, 0); line([[P[0] + 16, 150], [150, 150]], COL.shot, 1, { dash: [3, 4], alpha: 0.3 }); E[0] = [160, 150]; mites([0]); bolt(220, 120, -0.45, COL.shot, 10, 3.5); bolt(220, 180, 0.45, COL.shot, 10, 3.5); }
      if (S === 'beam') { player(...P, 15, 0); beam([[P[0] + 16, 150], [150, 150]]); beam([[150, 150], [262, 95]], COL.shot, 4); beam([[150, 150], [262, 205]], COL.shot, 4); mites([], null, null, [0]); }
      if (S === 'burst') { player(...P, 15, 0); lob([P[0] + 14, 142], [150, 160], COL.shot, 50); blast(150, 160, 48); lob([150, 160], [225, 105], COL.shot, 25); lob([150, 160], [225, 215], COL.shot, 25); blast(225, 105, 26); blast(225, 215, 26); mites([]); }
      if (S === 'ball') { player(...P, 15, 0); ent('circle', 160, 150, 13, COL.player, 0, { alpha: 0.25 }); text('dies', 160, 128, 10, COL.dim, 'center'); ball(205, 115, 8); ball(205, 185, 8); arrow(170, 142, 196, 120, COL.player, 1.2, 5); arrow(170, 158, 196, 180, COL.player, 1.2, 5); mites([], null, null, [0]); }
      if (S === 'self') { for (let i = 0; i < 4; i++) ghostP(P[0] + i * 40, 150, 15, 0.1 + i * 0.07); player(200, 150, 15, 0); [-0.6, 0.6].forEach(a => { for (let i = 1; i < 4; i++) ghostP(P[0] + Math.cos(a) * i * 50, 150 + Math.sin(a) * i * 50, 13, 0.12 + i * 0.06); }); mites([]); text('echo dashes at ±35°', 150, 262, 10, COL.dim, 'center'); }
      break;
    }
    case 'swarm': {
      const six = (pts) => pts.forEach(p => p());
      if (S === 'bolt') { player(...P, 15, 0); for (let i = 0; i < 6; i++) { const t = E[i % 3]; const c = [100 + i * 10, 70 + i * 32]; const pts = bez([P[0] + 16, 150], c, [t[0] - 8, t[1] + (i - 3) * 2]); line(pts, COL.shot, 1, { alpha: 0.35 }); const q = pts[18]; bolt(q[0], q[1], ang(pts[17], q), COL.shot, 7, 3, 10); } mites([0, 1, 2]); }
      if (S === 'beam') { player(...P, 15, 0); beam([[P[0] + 16, 150], [120, 150]]); for (let i = 0; i < 6; i++) { const t = E[i % 3]; line(bez([120, 150], [150, 100 + i * 20], t), COL.shot, 1.6, { blur: 12 }); } mites([0, 1, 2]); }
      if (S === 'burst') { player(...P, 15, 0); lob([P[0] + 14, 142], [130, 150], COL.shot, 40); for (let i = 0; i < 6; i++) { const t = E[i % 3]; const o = [(i - 3) * 6, (i % 2) * 10 - 5]; line(bez([130, 150], [150, 60 + i * 30], [t[0] + o[0], t[1] + o[1]]), COL.shot, 1, { dash: [2, 4], alpha: 0.5 }); bomb(t[0] + o[0], t[1] + o[1], 4); } mites([0, 1, 2]); }
      if (S === 'ball') { player(...P, 15, 0); for (let i = 0; i < 6; i++) { const t = E[i % 3]; const a = i * 1.1; ball(t[0] + Math.cos(a) * 18, t[1] + Math.sin(a) * 18, 6, COL.player, 1); } mites([0, 1, 2]); text('6 small homing balls', 150, 262, 10, COL.dim, 'center'); }
      if (S === 'self') { for (let i = 0; i < 4; i++) ghostP(P[0] + i * 40, 150, 15, 0.1 + i * 0.07); player(200, 150, 15, 0); for (let i = 0; i < 6; i++) { const s = [P[0] + 30 + i * 25, 150]; const t = E[i % 3]; const pts = bez(s, [s[0] + 10, 150 + (i % 2 ? 60 : -60)], t); line(pts, COL.shot, 1, { alpha: 0.35 }); dot(pts[16][0], pts[16][1], 2.6, COL.shot); } mites([0, 1, 2]); }
      break;
    }
    case 'knock': {
      const hit = baseShape(S); mites(hit);
      hit.forEach(i => { const a = ang(S === 'burst' ? [190, 165] : P, E[i]); arrow(E[i][0] + Math.cos(a) * 16, E[i][1] + Math.sin(a) * 16, E[i][0] + Math.cos(a) * 52, E[i][1] + Math.sin(a) * 52, COL.form, 2, 7); });
      if (S === 'ball') { arrow(E[0][0] + 30, E[0][1] + 20, E[1][0] - 14, E[1][1] - 10, COL.dim, 1.3, 5, { dash: [3, 3] }); text('bowling', 205, 150, 10, COL.dim, 'center'); }
      if (S === 'self') text('shoves become a shockwave', 150, 255, 10, COL.dim, 'center');
      break;
    }
    case 'pull': {
      if (S === 'bolt') { player(...P, 15, 0); line([[P[0] + 16, 150], [230, 150]], COL.shot, 1, { alpha: 0.3, dash: [3, 4] }); bolt(200, 150, 0); E.forEach(e => arrow(e[0], e[1], e[0] - 8, e[1] + (150 - e[1]) * 0.45, COL.form, 1.6, 6)); mites([]); }
      if (S === 'beam') { player(...P, 15, 0); beam([[P[0] + 16, 150], [E[0][0], E[0][1]]]); arrow(E[0][0] - 16, E[0][1] + 4, E[0][0] - 56, E[0][1] + 18, COL.form, 2, 7); mites([0]); text('drags toward you', 150, 255, 10, COL.dim, 'center'); }
      if (S === 'burst') { player(...P, 15, 0); lob([P[0] + 14, 142], [190, 165], COL.shot, 50); circ(190, 165, 70, COL.form, { dash: [3, 5], w: 1.2, alpha: 0.6 }); E.forEach(e => arrow(e[0], e[1], e[0] + (190 - e[0]) * 0.5, e[1] + (165 - e[1]) * 0.5, COL.form, 1.6, 6)); bomb(190, 165, 7); mites([]); text('sucks in, then blasts', 190, 255, 10, COL.dim, 'center'); }
      if (S === 'ball') { player(...P, 15, 0); ball(190, 165, 12); circ(190, 165, 72, COL.form, { dash: [3, 5], w: 1.2, alpha: 0.6 }); E.forEach(e => arrow(e[0], e[1], e[0] + (190 - e[0]) * 0.45, e[1] + (165 - e[1]) * 0.45, COL.form, 1.6, 6)); mites([]); text('magnet', 190, 255, 10, COL.dim, 'center'); }
      if (S === 'self') { for (let i = 0; i < 4; i++) ghostP(P[0] + i * 40, 150, 15, 0.1 + i * 0.07); player(205, 150, 15, 0); E.forEach(e => arrow(e[0], e[1], e[0] + (205 - e[0]) * 0.4, e[1] + (150 - e[1]) * 0.4, COL.form, 1.6, 6)); mites([]); }
      break;
    }
    case 'leech': {
      const hit = baseShape(S, COL.xp); mites(hit, null);
      hit.forEach(i => { line(bez(E[i], [(E[i][0] + P[0]) / 2, 60], [P[0] + 6, P[1] - 18]), COL.xp, 1.2, { dash: [2, 4], alpha: 0.7 }); fx('leech', ...E[i], 11); });
      fx('leech', P[0], P[1] + 4, 15);
      break;
    }
    case 'explode': {
      if (S === 'bolt') { baseShape('bolt'); blast(E[0][0] - 8, E[0][1], 50); mites([0, 2]); }
      if (S === 'beam') { baseShape('beam'); blast(E[0][0] - 6, E[0][1], 44); text('every 0.5 s at the far end', 150, 255, 10, COL.dim, 'center'); mites([0]); }
      if (S === 'burst') { baseShape('burst'); blast(190, 165, 88, COL.shot, 0.5); text('second blast after a beat', 190, 268, 10, COL.dim, 'center'); mites([0, 1, 2]); }
      if (S === 'ball') { player(...P, 15, 0); ent('circle', 175, 150, 13, COL.player, 0, { alpha: 0.3 }); blast(175, 150, 70); text('on death', 175, 150, 10, COL.text, 'center'); mites([0, 1, 2]); }
      if (S === 'self') { baseShape('self'); blast(205, 150, 58); mites([0, 1]); }
      break;
    }
    case 'shrapnel': {
      const at = { bolt: [E[0][0] - 10, E[0][1]], beam: [E[0][0] - 10, E[0][1]], burst: [190, 165], ball: [175, 150], self: [205, 150] }[S];
      if (S === 'ball') { player(...P, 15, 0); ent('circle', ...at, 13, COL.player, 0, { alpha: 0.3 }); } else baseShape(S);
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; bolt(at[0] + Math.cos(a) * 46, at[1] + Math.sin(a) * 46, a, COL.shot, 8, 3, 18); }
      mites([0]);
      break;
    }
    case 'gunner': {
      if (S === 'bolt') { player(...P, 15, 0); line([[P[0] + 16, 150], [200, 150]], COL.shot, 1, { alpha: 0.3, dash: [3, 4] }); bolt(200, 150, 0, COL.shot, 22, 9, 30); [[110, 150], [150, 150]].forEach((s, k) => { const t = E[k ? 0 : 2]; arrow(s[0], s[1], t[0] - (t[0] - s[0]) * 0.2, t[1] - (t[1] - s[1]) * 0.2, COL.shot, 1.3, 5); }); mites([0, 2]); text('side shots while flying', 150, 262, 10, COL.dim, 'center'); }
      if (S === 'beam') { player(...P, 15, 0); beam([[P[0] + 16, 150], [262, 150]]); [[150, 150, 0], [190, 150, 1], [120, 150, 2]].forEach(([x, y, i]) => arc([x, y], E[i], COL.shot)); mites([0, 1, 2]); }
      if (S === 'burst') { player(...P, 15, 0); circ(190, 165, 70, COL.shot, { fill: 0.06, w: 1.6, dash: [5, 4] }); [[175, 120], [215, 190], [150, 210]].forEach(p => { line([[p[0], p[1] - 50], [p[0], p[1]]], COL.shot, 2.5, { blur: 14 }); blast(p[0], p[1], 16); }); mites([0, 1, 2]); text('area stays, strikes fall', 190, 262, 10, COL.dim, 'center'); }
      if (S === 'ball') { player(...P, 15, 0); ball(120, 160, 12); E.forEach((e, i) => { if (i < 2) { line([[132, 156], e], COL.shot, 1, { alpha: 0.3, dash: [3, 4] }); const q = lerp([132, 156], e, 0.75); bolt(q[0], q[1], ang([132, 156], e), COL.shot, 8, 3, 12); } }); mites([0, 1]); text('turret pet', 150, 262, 10, COL.dim, 'center'); }
      if (S === 'self') { baseShape('self'); E.forEach(e => { const q = lerp([205, 150], e, 0.6); bolt(q[0], q[1], ang([205, 150], e), COL.shot, 8, 3, 12); }); mites([0, 1, 2]); text('2 s of auto-fire after', 150, 262, 10, COL.dim, 'center'); }
      break;
    }
    case 'trail': {
      const tc = COL.burn;
      if (S === 'bolt') { player(...P, 15, 0); line([[P[0] + 20, 150], [220, 150]], tc, 12, { alpha: 0.25, blur: 18 }); fx('burn', 120, 155, 6); fx('burn', 180, 155, 6); bolt(225, 150, 0, tc); mites([]); text('Bolt + Trail + Burn', 150, 262, 10, COL.dim, 'center'); }
      if (S === 'beam') { player(...P, 15, 0); circ(...P, 150, tc, { a0: -0.5, a1: 0.4, w: 12, alpha: 0.22, blur: 18 }); beam([[P[0] + 16, P[1]], [P[0] + Math.cos(0.4) * 160, P[1] + Math.sin(0.4) * 160]], tc); mites([]); text('scar where it swept', 150, 262, 10, COL.dim, 'center'); }
      if (S === 'burst') { baseShape('burst', tc); circ(190, 165, 55, tc, { fill: 0.15, w: 1, alpha: 0.6 }); fx('burn', 175, 180, 8); fx('burn', 210, 150, 8); mites([0, 1, 2], tc, 'burn'); text('leaves a pool', 190, 262, 10, COL.dim, 'center'); }
      if (S === 'ball') { player(...P, 15, 0); const pts = bez([P[0] + 16, 150], [140, 60], [220, 170]); line(pts, tc, 10, { alpha: 0.25, blur: 18 }); ball(220, 170, 12); mites([]); }
      if (S === 'self') { line([[P[0], 150], [205, 150]], tc, 14, { alpha: 0.28, blur: 18 }); fx('burn', 100, 156, 7); fx('burn', 160, 156, 7); player(205, 150, 15, 0); mites([]); }
      break;
    }
    case 'echo': {
      const off = (fn) => { ctx.save(); ctx.globalAlpha = 0.4; ctx.translate(0, 34); fn(); ctx.restore(); };
      if (S === 'ball') { player(...P, 15, 0); ball(170, 130, 12); ctx.save(); ctx.globalAlpha = 0.45; ball(130, 175, 10); ctx.restore(); text('ghost ball, half HP', 150, 262, 10, COL.dim, 'center'); mites([]); }
      else if (S === 'self') { for (let i = 0; i < 5; i++) ghostP(P[0] + i * 34, 150, 15, 0.08 + i * 0.05); player(205, 150, 15, 0); for (let i = 0; i < 4; i++) ghostP(P[0] + i * 30, 150, 15, 0.05 + i * 0.03); player(130, 150, 15, null, { alpha: 0.4, noAim: true }); text('a ghost runs it again', 150, 262, 10, COL.dim, 'center'); mites([]); }
      else { const hit = baseShape(S); ctx.save(); ctx.globalAlpha = 0.4; if (S === 'bolt') bolt(110, 150, ang(P, E[0])); if (S === 'beam') beam([[P[0] + 18, P[1] + 10], [E[2][0] - 10, E[2][1]]]); if (S === 'burst') blast(190, 165, 50); ctx.restore(); text('repeats 0.4 s later', 150, 262, 10, COL.dim, 'center'); mites(hit); }
      break;
    }
    case 'link': {
      if (S === 'bolt') { player(...P, 15, 0); const a = [175, 110], b = [175, 190]; line([a, b], COL.rule, 2.5, { blur: 14 }); bolt(...a, -0.3); bolt(...b, 0.3); E[0] = [178, 150]; mites([0], COL.rule); text('lone bolt: line to you (whip)', 150, 262, 10, COL.dim, 'center'); }
      if (S === 'beam') { player(...P, 15, 0); const a = [250, 95], b = [250, 205]; beam([[P[0] + 16, 145], a], COL.shot, 4.5); beam([[P[0] + 16, 155], b], COL.shot, 4.5); line([a, b], COL.rule, 2.5, { blur: 14 }); E[1] = [252, 150]; mites([1], COL.rule); }
      if (S === 'burst') { player(...P, 15, 0); const c = [180, 160], r = 72; const pts = []; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; pts.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]); } E[0] = [c[0] + Math.cos(0.5) * r, c[1] + Math.sin(0.5) * r]; const ring = [pts[0], E[0], pts[1], pts[2], pts[3], pts[4], pts[5], pts[0]]; for (let i = 0; i < ring.length - 1; i++) arc(ring[i], ring[i + 1], COL.shock, 1.6, 5); pts.forEach(p => ent('diamond', p[0], p[1], 6, COL.shock)); mites([0], COL.shock, 'shock', [1, 2]); text('edge ring; touchers join (Lightning arena)', 150, 268, 10, COL.dim, 'center'); }
      if (S === 'ball') { player(...P, 15, 0); line([[P[0] + 12, 150], [170, 150]], COL.rule, 2.5, { blur: 14 }); ball(175, 150, 12); text('lone ball: a flail on you', 150, 262, 10, COL.dim, 'center'); mites([]); }
      if (S === 'self') { line([[P[0], 150], [205, 150]], COL.rule, 3, { blur: 14 }); ghostP(...P, 15, 0.3); player(205, 150, 15, 0); E[0] = [130, 150]; mites([0], COL.rule); text('tripwire, 1 s', 150, 262, 10, COL.dim, 'center'); }
      break;
    }
    case 'follow': {
      if (S === 'bolt') { player(...P, 15, 0); [[-1.2, 34], [1.2, 34], [Math.PI, 34]].forEach(([a, r]) => { bolt(P[0] + Math.cos(a) * r, P[1] + Math.sin(a) * r, a, COL.shot, 9, 4, 4); }); line([[P[0] + Math.cos(-1.2) * 34, P[1] + Math.sin(-1.2) * 34], E[0]], COL.shot, 1, { dash: [3, 4], alpha: 0.4 }); mites([]); text('hover, then fire at what comes near', 150, 262, 10, COL.dim, 'center'); }
      if (S === 'beam') { player(80, 190, 15, -0.6); beam([[94, 182], E[0]]); ghostP(...P, 15, 0.25); line([P, [80, 190]], COL.dim, 1, { dash: [2, 3] }); mites([0]); text('locks on as you move', 150, 262, 10, COL.dim, 'center'); }
      if (S === 'burst') { player(130, 150, 15, 0); circ(130, 150, 62, COL.shot, { fill: 0.08, w: 2, blur: 16 }); arrow(130, 225, 170, 225, COL.dim, 1.4, 5); mites([0]); text('aura moves with you', 150, 262, 10, COL.dim, 'center'); }
      if (S === 'ball') { line([[50, 80], [50, 205], [215, 205]], COL.dim, 1, { dash: [2, 4], alpha: 0.5 }); wallRect(80, 26, 18, 155); player(215, 205, 15, 0); ball(70, 198, 11); arrow(95, 205, 150, 205, COL.player, 1.4, 6); mites([], null, null, [1, 2]); text('finds its way to you', 150, 262, 10, COL.dim, 'center'); }
      if (S === 'self') { ball(205, 115, 12); for (let i = 0; i < 4; i++) { const p = lerp(P, [190, 120], i / 4); ghostP(p[0], p[1], 15, 0.1 + i * 0.07); } player(185, 123, 15, -0.3); mites([], null, null, [0]); text('dash to your ball', 150, 262, 10, COL.dim, 'center'); }
      break;
    }
    case 'charge': {
      const cring = (x, y, r) => { circ(x, y, r, COL.rule, { a0: -Math.PI / 2, a1: Math.PI * 0.9, w: 2 }); };
      if (S === 'bolt') { player(...P, 15, 0); cring(...P, 24); bolt(170, 150, 0, COL.shot, 36, 16, 60); mites([]); }
      if (S === 'beam') { player(...P, 15, 0); cring(...P, 24); beam([[P[0] + 16, 150], [262, 150]], COL.shot, 18); mites([]); }
      if (S === 'burst') { player(...P, 15, 0); cring(...P, 24); lob([P[0] + 14, 142], [205, 160], COL.shot, 70); blast(205, 160, 80); mites([0, 1, 2]); }
      if (S === 'ball') { player(...P, 15, 0); cring(...P, 24); line([[P[0] + 18, 150], [210, 150]], COL.player, 1.4, { dash: [10, 3], alpha: 0.5 }); ball(210, 150, 20); mites([]); }
      if (S === 'self') { cring(...P, 24); for (let i = 0; i < 8; i++) ghostP(P[0] + i * 28, 150, 15, 0.06 + i * 0.04); player(262 - 6, 150, 15, 0); mites([]); }
      text('hold to charge, no cap', 150, 262, 10, COL.dim, 'center');
      break;
    }
    case 'ghost': {
      wallRect(140, 26, 18, 248);
      if (S === 'bolt') { player(...P, 15, 0); line([[P[0] + 16, 150], [220, 150]], COL.shot, 1, { alpha: 0.3, dash: [3, 4] }); bolt(220, 150, 0); }
      if (S === 'beam') { player(...P, 15, 0); beam([[P[0] + 16, 150], [262, 150]]); }
      if (S === 'burst') { player(...P, 15, 0); lob([P[0] + 14, 142], [150, 160], COL.shot, 60); blast(150, 160, 80); }
      if (S === 'ball') { player(...P, 15, 0); line([[P[0] + 16, 150], [215, 150]], COL.player, 1.4, { dash: [3, 4], alpha: 0.5 }); ball(215, 150, 12); }
      if (S === 'self') { for (let i = 0; i < 6; i++) ghostP(P[0] + i * 30, 150, 15, 0.08 + i * 0.06); player(222, 150, 15, 0); text('one wall, far side open', 150, 262, 10, COL.dim, 'center'); }
      mites([], null, null, [2]);
      break;
    }
    case 'rune': {
      // On wall -> Burst + Chill, shown on each shape.
      const at = { bolt: [236, 150], beam: [236, 150], burst: [170, 165], ball: [236, 150], self: [236, 150] }[S];
      if (S === 'bolt') { player(...P, 15, 0); line([[P[0] + 16, 150], at], COL.shot, 1, { alpha: 0.3, dash: [3, 4] }); }
      if (S === 'beam') { player(...P, 15, 0); beam([[P[0] + 16, 150], at]); }
      if (S === 'burst') { player(...P, 15, 0); lob([P[0] + 14, 142], at, COL.shot, 50); blast(...at, 40); text('On end', at[0], at[1] - 75, 11, COL.rune, 'center'); }
      if (S === 'ball') { player(...P, 15, 0); line([[P[0] + 16, 150], at], COL.player, 1.4, { dash: [3, 4], alpha: 0.5 }); ball(at[0] - 14, at[1], 11); }
      if (S === 'self') { for (let i = 0; i < 5; i++) ghostP(P[0] + i * 40, 150, 15, 0.08 + i * 0.06); player(at[0] - 16, 150, 15, 0); }
      const bc = S === 'burst' ? at : [at[0] - 8, at[1]];
      if (S === 'burst') { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; bolt(bc[0] + Math.cos(a) * 60, bc[1] + Math.sin(a) * 60, a, COL.chill, 8, 3, 14); } }
      else { blast(bc[0], bc[1], 48, COL.chill); text('On wall: Burst', 200, 60, 11, COL.rune, 'center'); }
      E[1] = [225, 185]; mites(S === 'burst' ? [] : [1], COL.chill, 'chill');
      text(S === 'burst' ? 'socket: Bolt + Extra' : 'socket: Burst + Chill', 130, 262, 10, COL.dim, 'center');
      break;
    }
  }
}
const MOD_TEXT = {
  home: 'Curves toward enemies. Levels: tighter turns, longer sight.',
  bounce: 'Bounces off walls. +1 bounce per level.',
  pierce: 'Passes through enemies (a blast: through a wall). +1 per level.',
  orbit: 'Circles you before it goes, or guards you.',
  return: 'Comes back to where it started.',
  extra: '+1 of it per level.',
  grow: 'Bigger. Levels: bigger again.',
  haste: 'Faster, and back sooner.',
  split: 'Becomes two at the end. Children never split again.',
  swarm: 'Becomes 6 tiny homing copies. Rare or better.',
  burn: 'Sets on fire. At 100: Flare.', chill: 'Slows. At 100: Freeze. Hit a frozen one: Shatter.',
  shock: 'Each hit arcs to a neighbour. At 100: Overload.', poison: 'Slow damage. At 100: Rot, then gas.',
  mark: '+25% damage taken. 5 marks: Detonate.',
  knock: 'Hits push enemies far.', pull: 'Drags enemies in.', leech: 'Hits heal you a little.',
  explode: 'A blast when it hits or ends.', shrapnel: 'A ring of small bolts at its end.',
  gunner: 'It fires small bolts at enemies near it.', trail: 'Leaves a strip carrying its effects.',
  echo: 'The cast repeats 0.4 s later.', link: 'A damaging line between copies, or to you.',
  follow: 'Stays with you, finds its way to you.', charge: 'Hold to charge: bigger, no cap.',
  ghost: 'Through walls. Legendary only.', rune: 'On a trigger, casts the shape in its socket (2 slots of its own).',
};
const FAM_NAME = { path: 'Path', form: 'Form', burn: 'Payload', chill: 'Payload', shock: 'Payload', poison: 'Payload', mark: 'Payload', xp: 'Payload', spawn: 'Spawner', rule: 'Rule', rune: 'Rune' };
function sceneMod(id) {
  ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, W, H);
  // info panel
  const fam = MODS[id][1];
  chip(id, 70, 80, 84, id === 'ghost' ? 'legendary' : id === 'rune' ? 'epic' : id === 'swarm' ? 'rare' : 'common');
  text(MODS[id][0], 128, 62, 30, COL.text, 'left', 800);
  text(FAM_NAME[fam] + ' module', 130, 94, 14, modCol(id), 'left', 700);
  wrap(MOD_TEXT[id], 26, 150, 250, 15, COL.text, 1.35, 500);
  wrap('Same module, five shapes →', 26, 270, 250, 12, COL.dim, 1.3, 600);
  const pos = [[310, 10], [620, 10], [0, 320], [310, 320], [620, 320]];
  SHAPES.forEach(([s], i) => {
    E[0] = [172, 112]; E[1] = [222, 196]; E[2] = [146, 222];
    ctx.save(); ctx.translate(pos[i][0] + 5, pos[i][1]); ctx.beginPath(); ctx.rect(0, 0, PW, PW); ctx.clip();
    SEED = 11 + i; modPanel(id, s); ctx.restore();
    ctx.save(); ctx.strokeStyle = '#1c2246'; ctx.lineWidth = 1; ctx.strokeRect(pos[i][0] + 5.5, pos[i][1] + 0.5, PW - 1, PW - 1); ctx.restore();
  });
}

// ---------- maze keyframe ----------
const GW = 48, GH = 22;
let grid = [];
function buildKeyMaze() {
  grid = Array.from({ length: GH }, () => Array(GW).fill(0));
  const bx = c => 4 + 8 * c, by = r => 3 + 8 * r; // boundary lines
  const openV = new Set(['0,1', '1,1', '2,1', '3,1', '4,1', '2,2', '3,2', '4,2', '1,0', '0,3', '3,3', '5,0']);
  const openH = new Set(['1,0', '3,1', '0,2', '5,0', '4,2', '6,1']);
  const fill = (x0, y0, x1, y1) => { for (let y = Math.max(0, y0); y < Math.min(GH, y1); y++) for (let x = Math.max(0, x0); x < Math.min(GW, x1); x++) grid[y][x] = 1; };
  for (let c = -1; c <= 6; c++) for (let r = -1; r <= 3; r++) {
    if (!openV.has(`${c},${r}`)) fill(bx(c) - 1, by(r - 1) - 1, bx(c) + 1, by(r) + 1);
    if (!openH.has(`${c},${r}`)) fill(bx(c - 1) - 1, by(r) - 1, bx(c) + 1, by(r) + 1);
  }
}
function drawGrid(cs) {
  ctx.fillStyle = STYLE === 'D' ? '#0d1226' : COL.floor; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = STYLE === 'D' ? 'rgba(90,110,200,0.14)' : COL.grid; ctx.lineWidth = 1;
  if (STYLE === 'C' || STYLE === 'D') for (let x = 0; x <= GW; x++) { ctx.beginPath(); ctx.moveTo(x * cs, 0); ctx.lineTo(x * cs, H); ctx.stroke(); }
  if (STYLE === 'C' || STYLE === 'D') for (let y = 0; y <= GH; y++) { ctx.beginPath(); ctx.moveTo(0, y * cs); ctx.lineTo(W, y * cs); ctx.stroke(); }
  ctx.fillStyle = { A: COL.floor, B: '#3a2fb8', C: COL.wallFill, D: '#2a2470' }[STYLE];
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (grid[y][x]) ctx.fillRect(x * cs, y * cs, cs + 0.5, cs + 0.5);
  ctx.save(); glow(COL.wall, STYLE === 'A' ? 16 : STYLE === 'B' ? 22 : 10); ctx.strokeStyle = STYLE === 'B' ? '#8c80ff' : COL.wall; ctx.lineWidth = STYLE === 'D' ? 3 : STYLE === 'A' ? 1.3 : 2; ctx.lineCap = 'square';
  const g = (x, y) => (x < 0 || y < 0 || x >= GW || y >= GH) ? 1 : grid[y][x];
  ctx.beginPath();
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (grid[y][x]) {
    if (!g(x, y - 1)) { ctx.moveTo(x * cs, y * cs); ctx.lineTo((x + 1) * cs, y * cs); }
    if (!g(x, y + 1)) { ctx.moveTo(x * cs, (y + 1) * cs); ctx.lineTo((x + 1) * cs, (y + 1) * cs); }
    if (!g(x - 1, y)) { ctx.moveTo(x * cs, y * cs); ctx.lineTo(x * cs, (y + 1) * cs); }
    if (!g(x + 1, y)) { ctx.moveTo((x + 1) * cs, y * cs); ctx.lineTo((x + 1) * cs, (y + 1) * cs); }
  }
  ctx.stroke();
  if (STYLE === 'C') { // inner second line
    ctx.globalAlpha = 0.35; ctx.lineWidth = 1; ctx.shadowBlur = 0;
    const o = cs * 0.3; ctx.beginPath();
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (grid[y][x]) {
      if (!g(x, y - 1)) { ctx.moveTo(x * cs, y * cs + o); ctx.lineTo((x + 1) * cs, y * cs + o); }
      if (!g(x, y + 1)) { ctx.moveTo(x * cs, (y + 1) * cs - o); ctx.lineTo((x + 1) * cs, (y + 1) * cs - o); }
      if (!g(x - 1, y)) { ctx.moveTo(x * cs + o, y * cs); ctx.lineTo(x * cs + o, (y + 1) * cs); }
      if (!g(x + 1, y)) { ctx.moveTo((x + 1) * cs - o, y * cs); ctx.lineTo((x + 1) * cs - o, (y + 1) * cs); }
    }
    ctx.stroke();
  }
  ctx.restore();
}
function solid(x, y) { const gx = Math.floor(x), gy = Math.floor(y); return gx < 0 || gy < 0 || gx >= GW || gy >= GH || grid[gy][gx] === 1; }
function visPoly(px, py) {
  const pts = [];
  for (let i = 0; i < 1080; i++) { const a = i / 1080 * TAU; let d = 0; const dx = Math.cos(a), dy = Math.sin(a); while (d < 60 && !solid(px + dx * d, py + dy * d)) d += 0.05; d += 0.35; pts.push([px + dx * d, py + dy * d]); }
  return pts;
}
function visible(px, py, x, y) { const d = Math.hypot(x - px, y - py); for (let t = 0; t < d; t += 0.1) { if (solid(px + (x - px) * t / d, py + (y - py) * t / d)) return false; } return true; }
function sceneKey(style, hud = true) {
  STYLE = style; SEED = 5;
  buildKeyMaze();
  const cs = W / GW;
  const C = (x, y) => [x * cs, y * cs];
  drawGrid(cs);
  const pp = [24, 7];
  const vis = (x, y) => visible(pp[0], pp[1], x, y);
  // fire trail from an earlier dash
  line([C(31, 7.3), C(26, 7.3)], COL.burn, cs * 0.9, { alpha: 0.22, blur: 18 });
  fx('burn', ...C(29.5, 7.4), cs * 0.25); fx('burn', ...C(27.4, 7.4), cs * 0.25);
  // gems
  for (let i = 0; i < 22; i++) { const x = 6 + rnd() * 30, y = 5 + rnd() * 4.5 + (i % 5 === 0 ? 8 : 0); if (!solid(x, y) && vis(x, y)) gem(...C(x, y), cs * 0.2); }
  // horde from the left
  const horde = [];
  for (let i = 0; i < 16; i++) { const x = 3 + rnd() * 10, y = 4.3 + rnd() * 5.4; if (!solid(x, y)) horde.push([x, y]); }
  horde.forEach(([x, y], i) => { if (!vis(x, y)) return; const burning = i % 3 === 0; mite(...C(x, y), cs * 0.5, burning ? COL.burn : COL.enemy); if (burning) fx('burn', ...C(x, y), cs * 0.5); });
  ent('square', ...C(8.5, 6.6), cs * 1.3, COL.enemy, 0.1); fx('mark', ...C(8.5, 6.6), cs * 1.3);
  // explosion from the summon ball
  blast(...C(11.5, 5.6), cs * 2.6, COL.burn, 0.8);
  // summon ball with bounce trail
  line([C(20.5, 8.6), C(17, 9.5), C(14.8, 4.3), C(13.2, 7.6)], COL.player, 1.6, { dash: [3, 5], alpha: 0.5 });
  ball(...C(13.2, 7.6), cs * 0.75); circ(...C(13.2, 7.6), cs * 0.95, COL.burn, { w: 1.4 });
  // player's bolts (Extra x3 + Burn)
  [-0.12, 0, 0.12].forEach((a, i) => { const d = 4.5 + i * 0.4; bolt(...C(pp[0] - Math.cos(a) * d, pp[1] + Math.sin(a) * d), Math.PI - a, COL.burn, cs * 0.8, cs * 0.28, cs * 1.6); });
  // frozen mite
  mite(...C(19.6, 8.7), cs * 0.5, COL.chill); fx('freeze', ...C(19.6, 8.7), cs * 0.5);
  // dart coming up the lower corridor with telegraph
  if (true) { line([C(24, 17.5), C(24, 8.4)], COL.eshot, 1.2, { dash: [4, 4], alpha: 0.7 }); ent('dart', ...C(24, 17.5), cs * 0.6, COL.enemy2, -Math.PI / 2); }
  // spitter + bomber on the right
  ent('diamond', ...C(36.5, 7), cs * 0.75, COL.enemy2); dot(...C(36.5, 7), cs * 0.15, '#fff');
  [[33.5, 7.2], [30.5, 6.6]].forEach(p => { dot(...C(...p), cs * 0.32, COL.eshot); circ(...C(...p), cs * 0.5, COL.eshot, { w: 1, alpha: 0.5 }); });
  ent('circle', ...C(33, 9.2), cs * 0.65, COL.enemy); circ(...C(33, 9.2), cs * 1.05, COL.gold, { w: 1.6, dash: [3, 3] });
  // damage numbers
  [['12', 6.6, 4.9], ['24', 10.2, 4.1], ['8', 4.7, 8.6]].forEach(([s, x, y]) => text(s, ...C(x, y), 11, '#ffffff', 'center', 800));
  // player
  player(...C(...pp), cs, Math.PI);
  [0, 1, 2].forEach(i => { ctx.save(); ctx.fillStyle = i < 2 ? COL.shot : rgba(COL.shot, 0.25); glow(COL.shot, 6); ctx.fillRect(C(pp[0] - 1.2 + i * 0.85, pp[1] + 1.45)[0], C(0, pp[1] + 1.45)[1], cs * 0.7, cs * 0.18); ctx.restore(); });
  // fog
  const vp = visPoly(pp[0], pp[1]);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); vp.forEach((p, i) => i ? ctx.lineTo(p[0] * cs, p[1] * cs) : ctx.moveTo(p[0] * cs, p[1] * cs)); ctx.closePath();
  ctx.fillStyle = 'rgba(2,3,9,0.8)'; ctx.fill('evenodd'); ctx.restore();
  // chest glow through fog at a dead end
  const ch = C(16, 15);
  ctx.save(); const g = ctx.createRadialGradient(ch[0], ch[1], 0, ch[0], ch[1], cs * 5); g.addColorStop(0, 'rgba(255,179,0,0.35)'); g.addColorStop(1, 'rgba(255,179,0,0)'); ctx.fillStyle = g; ctx.fillRect(ch[0] - cs * 5, ch[1] - cs * 5, cs * 10, cs * 10); ctx.restore();
  chest(...ch, cs * 0.7, COL.gold, 0.7);
  // edge tick for an unseen enemy behind the top-left corner
  ent('tri', ...C(0.7, 12.5), cs * 0.35, COL.enemy, Math.PI, { alpha: 0.7 });
  if (hud) drawHUD(cs);
}
function drawHUD(cs) {
  // XP bar
  ctx.save(); ctx.fillStyle = 'rgba(61,255,176,0.12)'; ctx.fillRect(160, 10, W - 320, 6); glow(COL.xp, 10); ctx.fillStyle = COL.xp; ctx.fillRect(160, 10, (W - 320) * 0.62, 6); ctx.restore();
  text('LV 14', 120, 14, 13, COL.xp, 'center', 800);
  text('07:42', W / 2, 34, 18, COL.text, 'center', 800);
  // pause
  ctx.save(); ctx.fillStyle = 'rgba(232,240,255,0.08)'; ctx.beginPath(); ctx.roundRect(40, 26, 34, 28, 8); ctx.fill(); ctx.restore(); text('II', 57, 41, 13, COL.text, 'center', 900);
  // minimap
  const mx = W - 150, my = 24, mw = 118, mh = 78;
  ctx.save(); ctx.fillStyle = 'rgba(5,7,15,0.8)'; ctx.fillRect(mx, my, mw, mh); ctx.strokeStyle = rgba(COL.wall, 0.6); ctx.strokeRect(mx + 0.5, my + 0.5, mw, mh);
  ctx.strokeStyle = rgba(COL.wall, 0.8); ctx.lineWidth = 3;
  const seg = [[[10, 20], [60, 20], [60, 50], [90, 50]], [[30, 20], [30, 60]], [[60, 35], [100, 35]], [[90, 50], [90, 70]], [[60, 50], [60, 70], [20, 70]]];
  seg.forEach(s => { ctx.beginPath(); s.forEach((p, i) => i ? ctx.lineTo(mx + p[0], my + p[1]) : ctx.moveTo(mx + p[0], my + p[1])); ctx.stroke(); });
  ctx.restore(); dot(mx + 60, my + 28, 3, COL.player); dot(mx + 90, my + 66, 2.5, COL.gold); dot(mx + 100, my + 35, 2.5, COL.gold, 0.6);
  text('exit opens 10:00', mx + mw / 2, my + mh + 10, 9, COL.dim, 'center', 600);
  // move stick
  circ(110, H - 92, 50, COL.text, { fill: 0.05, w: 1.4, alpha: 0.35, blur: 0 }); circ(128, H - 100, 22, COL.text, { fill: 0.12, w: 1.4, alpha: 0.5, blur: 0 });
  // fire stick with aim
  const fx0 = W - 95, fy0 = H - 85;
  circ(fx0, fy0, 52, COL.shot, { fill: 0.06, w: 1.6, alpha: 0.6 }); circ(fx0 - 26, fy0 - 4, 24, COL.shot, { fill: 0.25, w: 2 });
  text('FIRE', fx0, fy0 + 66, 9, COL.dim, 'center', 800);
  // summon (super) stick with charge ring
  const sx = W - 200, sy = H - 150;
  circ(sx, sy, 32, COL.player, { fill: 0.08, w: 1.2, alpha: 0.5 }); circ(sx, sy, 36, COL.gold, { a0: -Math.PI / 2, a1: -Math.PI / 2 + TAU * 0.78, w: 3 });
  ball(sx, sy, 10); text('SUMMON', sx, sy + 48, 9, COL.dim, 'center', 800);
  // dash
  const dx = W - 215, dy = H - 58;
  circ(dx, dy, 26, COL.player, { fill: 0.08, w: 1.4, alpha: 0.7 }); arrow(dx - 9, dy, dx + 9, dy, COL.player, 2, 6);
  [0, 1].forEach(i => dot(dx - 5 + i * 10, dy + 34, 3, COL.player, i === 0 ? 1 : 0.3));
  text('DASH', dx, dy + 46, 9, COL.dim, 'center', 800);
}

// ---------- enemies ----------
function stage(title, sub) {
  ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.strokeStyle = COL.grid; for (let i = 0; i < W; i += 20) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke(); } for (let i = 0; i < H; i += 20) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke(); } ctx.restore();
  text(title, 24, 28, 22, COL.text, 'left', 800);
  if (sub) text(sub, 24, 52, 13, COL.dim, 'left', 600);
}
function sceneEnemy(id) {
  SEED = 3;
  const cx = 300, cy = 215;
  const D = {
    mite: ['Mite', 'Swarms toward you. Fodder.'], dart: ['Dart', 'Sees you, flashes, charges until a wall.'], brute: ['Brute', 'Slow, tanky, shoves others along.'],
    spitter: ['Spitter', 'Keeps away, needs line of sight, lobs orbs.'], splitter: ['Splitter', 'Splits into 2, then 4.'], bomber: ['Bomber', 'Runs at you, swells, blows up. Hurts enemies too.'],
    crawler: ['Crawler', 'Slides along a wall, fires across the corridor.'], drifter: ['Drifter', 'Floats through walls. Hittable only while solid.'],
    shield: ['Shield', 'Front bar blocks shots. Turns slowly.'], nest: ['Nest', 'Sits in a dead end making Mites. Drops a chest.'],
    elite: ['Elite (Spitter + Burn)', 'Elites carry your modules. The ring shows which. Kill it to get it.'],
    hulk: ['Boss: Hulk (5:00)', 'As wide as a corridor. Rolls through the maze.'], queen: ['Boss: Queen (10:00)', 'Spawns waves behind a ring of shields that open in turn.'],
    mirror: ['Boss: Mirror (15:00)', 'Built from your own casts and modules.'],
  }[id];
  stage(...D);
  const pl = [80, cy];
  switch (id) {
    case 'mite': for (let i = 0; i < 9; i++) mite(cx + 60 + (i % 3) * 34 + rnd() * 10, cy - 40 + Math.floor(i / 3) * 34 + rnd() * 10, 11); mite(cx - 80, cy, 22); text('×1', cx - 80, cy + 40, 11, COL.dim, 'center'); player(...pl, 22, 0); [0, 1, 2].forEach(i => arrow(cx + 40, cy - 30 + i * 30, cx - 10, cy - 30 + i * 28, COL.enemy, 1.2, 5, { alpha: 0.4 })); break;
    case 'dart': player(...pl, 22, 0); line([[cx + 180, cy], [pl[0] + 30, cy]], COL.eshot, 1.5, { dash: [6, 5], alpha: 0.8 }); ent('dart', cx + 180, cy, 20, COL.enemy2, Math.PI); circ(cx + 180, cy, 30, COL.text, { w: 1.4, alpha: 0.6 }); text('flash, then go', cx + 180, cy - 44, 11, COL.dim, 'center'); for (let i = 1; i < 4; i++) ent('dart', cx + 180 - i * 60, cy, 20, COL.enemy2, Math.PI, { alpha: 0.12 + i * 0.05 }); break;
    case 'brute': player(...pl, 22, 0); ent('square', cx + 80, cy, 44, COL.enemy, 0); [-1, 0, 1].forEach(i => mite(cx + 10, cy + i * 34, 11)); arrow(cx + 20, cy + 70, cx - 50, cy + 70, COL.enemy, 2, 7, { alpha: 0.6 }); text('pushes the crowd', cx - 15, cy + 88, 11, COL.dim, 'center'); break;
    case 'spitter': player(...pl, 22, 0); ent('diamond', cx + 160, cy, 24, COL.enemy2); dot(cx + 160, cy, 4, '#fff'); [[cx + 70, cy - 20], [cx - 30, cy - 12]].forEach(p => { dot(...p, 7, COL.eshot); circ(...p, 11, COL.eshot, { w: 1, alpha: 0.5 }); }); line([[cx + 160, cy], [pl[0], cy]], COL.dim, 1, { dash: [2, 6], alpha: 0.4 }); text('needs line of sight', cx + 50, cy + 40, 11, COL.dim, 'center'); break;
    case 'splitter': ent('hex', cx - 100, cy, 30, COL.enemy2); arrow(cx - 55, cy, cx - 15, cy, COL.dim, 1.4, 6); ent('hex', cx + 20, cy - 30, 20, COL.enemy2); ent('hex', cx + 20, cy + 30, 20, COL.enemy2); arrow(cx + 55, cy, cx + 95, cy, COL.dim, 1.4, 6); [[-45, -20], [-45, 20], [-15, -50], [-15, 50]].forEach(([dx, dy], i) => ent('hex', cx + 160 + dx * (i < 2 ? 1 : -1) * 0.6, cy + dy, 12, COL.enemy2)); break;
    case 'bomber': player(...pl, 22, 0); ent('circle', cx + 40, cy, 20, COL.enemy); circ(cx + 40, cy, 30, COL.gold, { w: 2, dash: [4, 3] }); text('swelling', cx + 40, cy - 46, 11, COL.dim, 'center'); blast(cx + 190, cy, 70, COL.burn); mite(cx + 170, cy - 20, 11, COL.burn); mite(cx + 215, cy + 25, 11, COL.burn); text('its blast hits enemies too', cx + 190, cy + 92, 11, COL.dim, 'center'); break;
    case 'crawler': wallRect(40, 90, 520, 26); wallRect(40, 320, 520, 26); ent('half', cx + 40, 116 + 2, 22, COL.enemy2, 0); for (let i = 1; i < 4; i++) ent('half', cx + 40 - i * 40, 118, 22, COL.enemy2, 0, { alpha: 0.1 }); arrow(cx + 70, 104, cx + 140, 104, COL.dim, 1.4, 6); [150, 200, 250].forEach(y => { dot(cx + 40, y + 20, 5, COL.eshot); }); player(cx + 40, 290, 22, -Math.PI / 2); break;
    case 'drifter': wallRect(cx - 12, 70, 24, 320); ent('circle', cx - 6, cy, 24, COL.enemy2, 0, { alpha: 0.35 }); circ(cx - 6, cy, 24, COL.enemy2, { dash: [4, 4], w: 1.5 }); ent('circle', cx + 150, cy - 50, 24, COL.enemy2); text('solid', cx + 150, cy - 90, 11, COL.dim, 'center'); text('faded: can’t be hit', cx - 6, cy + 46, 11, COL.dim, 'center'); player(...pl, 22, 0); break;
    case 'shield': player(...pl, 22, 0); ent('square', cx + 80, cy, 26, COL.enemy, 0); line([[cx + 38, cy - 40], [cx + 38, cy + 40]], COL.text, 6, { blur: 14 }); bolt(cx - 10, cy, 0); text('blocked', cx + 10, cy - 30, 11, COL.dim, 'center'); line(bez([pl[0] + 30, cy + 20], [cx + 80, cy + 160], [cx + 120, cy + 10]), COL.shot, 1.4, { dash: [3, 4], alpha: 0.6 }); text('go around: Bounce, Home, Orbit, blasts', cx + 60, cy + 150, 11, COL.dim, 'center'); break;
    case 'nest': wallRect(40, 90, 520, 26); wallRect(40, 320, 520, 26); wallRect(534, 116, 26, 204); ent('star', 490, cy, 34, COL.enemy, 0); for (let i = 0; i < 5; i++) mite(420 - i * 40, cy - 30 + (i % 3) * 28, 9); chest(490, cy + 70, 10, COL.gold, 0.5); text('drops a chest', 480, cy + 95, 11, COL.dim, 'center'); player(...pl, 22, 0); break;
    case 'elite': player(...pl, 22, 0); ent('diamond', cx + 120, cy, 34, COL.enemy2); circ(cx + 120, cy, 46, COL.burn, { w: 3 }); chip('burn', cx + 120, cy + 90, 40, 'rare'); text('drops it', cx + 120, cy + 122, 11, COL.dim, 'center'); [[cx + 20, cy - 10], [cx - 70, cy - 4]].forEach(p => { dot(...p, 8, COL.burn); fx('burn', ...p, 7); }); break;
    case 'hulk': wallRect(40, 90, 520, 26); wallRect(40, 320, 520, 26); ent('square', cx + 90, cy, 78, COL.enemy, 0); arrow(cx + 10, cy + 0, cx - 60, cy, COL.text, 3, 10); player(...pl, 22, 0); text('no way past: go around through the maze', cx, 362, 12, COL.dim, 'center'); break;
    case 'queen': ent('hex', cx, cy, 44, COL.enemy2); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; const open = i % 4 === 0; if (!open) line([[cx + Math.cos(a - 0.3) * 90, cy + Math.sin(a - 0.3) * 90], [cx + Math.cos(a + 0.3) * 90, cy + Math.sin(a + 0.3) * 90]], COL.text, 5); } for (let i = 0; i < 6; i++) mite(cx + 160 + (i % 2) * 30, cy - 60 + i * 24, 9); player(70, cy, 22, 0); break;
    case 'mirror': player(110, cy, 26, 0); ent('circle', cx + 200, cy, 26, COL.enemy); circ(cx + 200, cy, 12, COL.enemy, { w: 1.5 }); [[cx + 110, cy - 20], [cx + 90, cy + 10]].forEach(p => bolt(...p, Math.PI, COL.eshot)); ball(cx + 160, cy + 70, 12, COL.enemy); ['bounce', 'burn', 'explode'].forEach((m, i) => chip(m, cx + 160 + i * 40, cy - 90, 32, 'rare')); text('your modules, turned on you', cx + 200, cy - 126, 11, COL.dim, 'center'); break;
  }
}

// ---------- statuses ----------
function sceneStatus(id) {
  SEED = 9;
  const T = { burn: ['Burn → Flare', 'Damage over time. At 100: a big hit and a small fire blast.'], chill: ['Chill → Freeze → Shatter', 'Slows up to 60%. At 100: frozen 2 s. Hit it hard: icicles.'], shock: ['Shock → Overload', 'Each hit arcs to a neighbour. At 100: stun and arcs to 3.'], poison: ['Poison → Rot', 'Slow damage. At 100: lose 15% max HP. Dies into gas.'], mark: ['Mark → Detonate', '+25% damage taken. At 5 marks it pops.'], mixes: ['Mixes', 'Thaw, Ignite, Conduct.'] }[id];
  stage(...T);
  const bar = (x, y, v, col) => { ctx.save(); ctx.fillStyle = rgba(col, 0.15); ctx.fillRect(x - 30, y, 60, 6); glow(col, 8); ctx.fillStyle = col; ctx.fillRect(x - 30, y, 60 * v, 6); ctx.restore(); };
  const L = [130, 220], R = [430, 220];
  if (id !== 'mixes') { text('building', L[0], 330, 12, COL.dim, 'center'); text('at 100', R[0], 330, 12, COL.dim, 'center'); arrow(220, 220, 320, 220, COL.dim, 1.5, 7); }
  if (id === 'burn') { mite(...L, 26, COL.burn); fx('burn', ...L, 26); bar(L[0], 270, 0.6, COL.burn); mite(...R, 26, COL.burn); blast(...R, 80, COL.burn); [[R[0] + 70, R[1] - 50], [R[0] - 70, R[1] + 50]].forEach(p => { mite(...p, 12, COL.burn); fx('burn', ...p, 12); }); text('-60', R[0], R[1] - 44, 16, '#fff', 'center', 900); }
  if (id === 'chill') { mite(...L, 26, COL.chill); fx('chill', ...L, 26); bar(L[0], 270, 0.7, COL.chill); mite(...R, 26, COL.chill); fx('freeze', ...R, 26); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; bolt(R[0] + Math.cos(a) * 85, R[1] + Math.sin(a) * 85, a, COL.chill, 10, 3, 16); } text('shatter', R[0], R[1] + 70, 11, COL.chill, 'center'); }
  if (id === 'shock') { mite(...L, 26, COL.shock); fx('shock', ...L, 26); const n = [L[0] + 40, L[1] + 70]; mite(...n, 12); arc(L, n); bar(L[0], 270, 0.5, COL.shock); mite(...R, 26, COL.shock); fx('shock', ...R, 26); [[R[0] + 90, R[1] - 60], [R[0] + 100, R[1] + 50], [R[0] - 80, R[1] + 70]].forEach(p => { mite(...p, 12, COL.shock); arc(R, p); }); text('stunned', R[0], R[1] - 44, 12, COL.shock, 'center'); }
  if (id === 'poison') { mite(...L, 26, COL.poison); fx('poison', ...L, 26); bar(L[0], 270, 0.8, COL.poison); mite(...R, 20, COL.poison); text('-15% max', R[0], R[1] - 40, 13, '#fff', 'center', 900); circ(R[0] + 20, R[1] + 30, 60, COL.poison, { fill: 0.12, w: 1.2, dash: [4, 4] }); text('gas', R[0] + 60, R[1] + 80, 11, COL.poison, 'center'); }
  if (id === 'mark') { mite(...L, 26); fx('mark', ...L, 26); text('+25%', L[0], L[1] - 50, 13, COL.mark, 'center', 800); [0, 1, 2, 3, 4].forEach(i => dot(L[0] - 24 + i * 12, 280, 4, COL.mark, i < 3 ? 1 : 0.25)); ent('square', ...R, 28, COL.enemy, 0); blast(...R, 60, COL.mark); text('5 marks: pop', R[0], R[1] + 80, 11, COL.mark, 'center'); }
  if (id === 'mixes') {
    const row = (y, a, b, c, ca, cb, cc) => { text(a, 80, y, 15, ca, 'center', 800); text('+', 150, y, 16, COL.dim, 'center'); text(b, 220, y, 15, cb, 'center', 800); text('=', 290, y, 16, COL.dim, 'center'); text(c, 360, y, 15, cc, 'center', 800); };
    row(110, 'Burn', 'Chill', 'Thaw', COL.burn, COL.chill, '#fff'); wrap('both clear for a burst of damage', 420, 110, 160, 11, COL.dim);
    row(200, 'Fire', 'Gas', 'Ignite', COL.burn, COL.poison, COL.burn); wrap('the gas cloud explodes', 420, 200, 160, 11, COL.dim);
    row(290, 'Shock', 'Mark', 'Conduct', COL.shock, COL.mark, COL.shock); wrap('arcs prefer marked, jump twice as far', 420, 290, 160, 11, COL.dim);
  }
}

// ---------- UI mockups ----------
function dimBG() { sceneKey('C', false); ctx.fillStyle = 'rgba(3,4,10,0.82)'; ctx.fillRect(0, 0, W, H); }
function card(x, y, w, h, col, a = 0.1) { ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fillStyle = rgba(col, a); ctx.fill(); glow(col, 12); ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke(); ctx.restore(); }
function pips(x, y, n, cap, col) { for (let i = 0; i < cap; i++) { ctx.save(); ctx.beginPath(); ctx.roundRect(x + i * 11, y, 8, 8, 2); ctx.fillStyle = i < n ? col : rgba(col, 0.15); glow(col, i < n ? 6 : 0); ctx.fill(); ctx.restore(); } }
function sceneLevelUp() {
  dimBG();
  text('LEVEL 15', W / 2, 40, 24, COL.xp, 'center', 900); text('Pick one', W / 2, 66, 13, COL.dim, 'center', 600);
  const cards = [
    ['bounce', 'rare', 'Weapon · Bolt', 'Bounce 2 → 3', 'Bolts bounce off walls 3 times.', 2, 5],
    ['explode', 'common', 'Summon · Ball', 'Explode 1 → 2', 'Death blast 3 → 4 cells.', 1, 3],
    ['trail', 'epic', 'Dash', 'Trail 4 → 5', 'Strip lasts 2 s → 2.5 s.', 4, 7],
    [null, 'common', 'Vitals', '+10 max HP', 'All your modules are at their cap? This shows up.', 0, 0],
  ];
  const w = 186, h = 280, gap = 16, x0 = (W - (w * 4 + gap * 3)) / 2;
  cards.forEach(([id, rar, where, head, body, lvl, cap], i) => {
    const x = x0 + i * (w + gap), y = 92;
    card(x, y, w, h, COL[rar], 0.07);
    text(rar.toUpperCase(), x + w / 2, y + 18, 10, COL[rar], 'center', 800);
    if (id) chip(id, x + w / 2, y + 74, 64, rar); else { circ(x + w / 2, y + 74, 28, COL.xp, { w: 2 }); text('+', x + w / 2, y + 74, 30, COL.xp, 'center', 900); }
    text(head, x + w / 2, y + 132, 16, COL.text, 'center', 800);
    text(where, x + w / 2, y + 154, 11, COL.dim, 'center', 700);
    if (cap) pips(x + (w - cap * 11) / 2, y + 172, lvl + 1, cap, COL[rar]);
    wrap(body, x + 14, y + 210, w - 28, 12, COL.text, 1.35, 500);
  });
}
function sceneChest() {
  dimBG();
  const w = 520, h = 320, x = (W - w) / 2, y = 46;
  card(x, y, w, h, COL.rare, 0.07);
  chest(x + 40, y + 36, 12, COL.gold);
  text('Chest · deep dead end', x + 66, y + 36, 14, COL.gold, 'left', 800);
  text('RARE', x + w - 24, y + 36, 12, COL.rare, 'right', 900);
  chip('split', x + 70, y + 112, 80, 'rare');
  text('Split', x + 128, y + 96, 26, COL.text, 'left', 800);
  text('Form · max level 5', x + 130, y + 124, 12, COL.dim, 'left', 700);
  const lines = [['Weapon · Bolt', 'splits in two on hit'], ['Summon · Ball', 'two small balls on death'], ['Dash', 'two echo dashes at ±35°']];
  lines.forEach(([a, b], i) => { text(a, x + 30, y + 176 + i * 24, 12, COL.dim, 'left', 700); text(b, x + 150, y + 176 + i * 24, 12, COL.text, 'left', 500); });
  const btn = (bx, label, sub, col) => { card(bx, y + h - 66, 108, 48, col, 0.1); text(label, bx + 54, y + h - 49, 12, COL.text, 'center', 800); text(sub, bx + 54, y + h - 31, 10, COL.dim, 'center', 600); };
  btn(x + 18, 'Weapon', '3 / 3 full', COL.path); btn(x + 140, 'Summon', '1 / 2', COL.path); btn(x + 262, 'Dash', '2 / 2 full', COL.path); btn(x + 384, 'Scrap', '+40 XP', COL.dim);
}
function sceneBuild() {
  ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, W, H);
  text('BUILD', 30, 30, 20, COL.text, 'left', 900); text('Drag a module to move it. Its level goes with it.', 110, 31, 12, COL.dim, 'left', 600);
  text('Resume ▸', W - 30, 30, 13, COL.player, 'right', 800);
  const col = (x, title, shape, shapeIcon, slots, cap) => {
    const w = 270, y = 60, h = 300;
    card(x, y, w, h, COL.player, 0.04);
    text(title, x + 16, y + 22, 16, COL.text, 'left', 800); text(shape, x + w - 16, y + 22, 12, COL.player, 'right', 800);
    shapeIcon(x + 40, y + 70);
    text(`${slots.filter(Boolean).length} / ${cap} slots`, x + 78, y + 70, 12, COL.dim, 'left', 700);
    slots.forEach((s, i) => {
      const sy = y + 110 + i * 58;
      if (!s) { ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = rgba(COL.dim, 0.6); ctx.beginPath(); ctx.roundRect(x + 16, sy, w - 32, 48, 10); ctx.stroke(); ctx.restore(); text('empty', x + w / 2, sy + 24, 11, COL.dim, 'center', 600); return; }
      const [id, rar, lvl, capL, note] = s;
      chip(id, x + 40, sy + 24, 42, rar, lvl);
      text(MODS[id][0], x + 70, sy + 16, 14, COL.text, 'left', 800); pips(x + 70, sy + 28, lvl, capL, COL[rar]);
      if (note) note(x, sy, w);
    });
  };
  const runeNote = (x, sy, w) => {
    text('On end ▸', x + 170, sy + 16, 11, COL.rune, 'left', 800);
    ctx.save(); ctx.beginPath(); ctx.roundRect(x + 168, sy + 24, 86, 22, 6); ctx.strokeStyle = rgba(COL.rune, 0.7); ctx.stroke(); ctx.restore();
    blast(x + 180, sy + 35, 7); chip('pull', x + 205, sy + 35, 18, 'common'); chip('chill', x + 228, sy + 35, 18, 'common');
  };
  col(24, 'Weapon', 'BOLT', (x, y) => bolt(x + 6, y, 0, COL.shot, 16, 6, 20), [['bounce', 'rare', 2, 5], ['burn', 'common', 3, 3], ['rune', 'epic', 1, 7, runeNote]], 3);
  col(313, 'Summon', 'BALL', (x, y) => ball(x, y, 12), [['follow', 'common', 2, 3], ['gunner', 'rare', 3, 5]], 2);
  col(602, 'Dash', 'SELF', (x, y) => { ghostP(x - 14, y, 10, 0.3); player(x + 4, y, 10, 0); }, [['trail', 'epic', 4, 7], ['explode', 'common', 1, 3]], 2);
  text('Shape cards: Burst (in the rune)', 30, H - 26, 11, COL.dim, 'left', 600);
}

// ---------- maze overview ----------
function sceneMaze() {
  ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, W, H);
  SEED = 42;
  const N = 24; const cell = 30, ox = 40, oy = 70;
  const vis = Array.from({ length: N }, () => Array(N).fill(false));
  const wallE = Array.from({ length: N }, () => Array(N).fill(true)); // wall to the east
  const wallS = Array.from({ length: N }, () => Array(N).fill(true));
  const st = [[12, 12]]; vis[12][12] = true;
  while (st.length) { const [x, y] = st[st.length - 1]; const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy, dx, dy]).filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N && !vis[b][a]); if (!nb.length) { st.pop(); continue; } const [a, b, dx, dy] = nb[Math.floor(rnd() * nb.length)]; if (dx === 1) wallE[y][x] = false; if (dx === -1) wallE[y][a] = false; if (dy === 1) wallS[y][x] = false; if (dy === -1) wallS[b][x] = false; vis[b][a] = true; st.push([a, b]); }
  for (let i = 0; i < 70; i++) { const x = Math.floor(rnd() * (N - 1)), y = Math.floor(rnd() * (N - 1)); if (rnd() < 0.5) wallE[y][x] = false; else wallS[y][x] = false; }
  const halls = [[4, 4, 3], [17, 5, 2], [6, 17, 2], [16, 16, 3], [11, 11, 2]];
  halls.forEach(([hx, hy, s]) => { for (let y = hy; y < hy + s; y++) for (let x = hx; x < hx + s; x++) { if (x < hx + s - 1) wallE[y][x] = false; if (y < hy + s - 1) wallS[y][x] = false; } });
  const open = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => { const a = x + dx, b = y + dy; if (a < 0 || b < 0 || a >= N || b >= N) return false; if (dx === 1) return !wallE[y][x]; if (dx === -1) return !wallE[y][a]; if (dy === 1) return !wallS[y][x]; return !wallS[b][x]; });
  // floor
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { ctx.fillStyle = COL.floor; ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell); }
  halls.forEach(([hx, hy, s]) => { ctx.fillStyle = 'rgba(106,92,255,0.12)'; ctx.fillRect(ox + hx * cell, oy + hy * cell, s * cell, s * cell); });
  ctx.save(); glow(COL.wall, 6); ctx.strokeStyle = COL.wall; ctx.lineWidth = 3; ctx.lineCap = 'square'; ctx.beginPath();
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const X = ox + x * cell, Y = oy + y * cell; if (wallE[y][x]) { ctx.moveTo(X + cell, Y); ctx.lineTo(X + cell, Y + cell); } if (wallS[y][x]) { ctx.moveTo(X, Y + cell); ctx.lineTo(X + cell, Y + cell); } if (x === 0) { ctx.moveTo(X, Y); ctx.lineTo(X, Y + cell); } if (y === 0) { ctx.moveTo(X, Y); ctx.lineTo(X + cell, Y); } }
  ctx.stroke(); ctx.restore();
  // dead ends with depth
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (open(x, y).length !== 1) continue;
    let px = x, py = y, prev = null, depth = 0;
    while (true) { const o = open(px, py).filter(([dx, dy]) => !prev || !(px + dx === prev[0] && py + dy === prev[1])); if (open(px, py).length > 2 || !o.length || depth > 20) break; prev = [px, py]; px += o[0][0]; py += o[0][1]; depth++; if (open(px, py).length > 2) break; }
    const rar = depth >= 6 ? 'legendary' : depth >= 4 ? 'epic' : depth >= 2 ? 'rare' : 'common';
    chest(ox + x * cell + cell / 2, oy + y * cell + cell / 2, 5, COL[rar]);
  }
  player(ox + 12.5 * cell, oy + 12.5 * cell, 8, null, { noAim: true });
  ent('star', ox + 1.5 * cell, oy + 22.5 * cell, 10, COL.xp, 0); text('exit', ox + 1.5 * cell, oy + 22.5 * cell + 18, 11, COL.xp, 'center', 800);
  text('One maze, 24×24 squares (each square = 8 cells)', 40, 26, 18, COL.text, 'left', 800);
  text('Chest colour = dead-end depth: white 1, blue 2-3, purple 4-5, gold 6+. Tinted squares = halls.', 40, 50, 12, COL.dim, 'left', 600);
}

// ---------- spell showcases ----------
function sceneSpell(id) {
  SEED = 21;
  if (id === 'arena') {
    stage('Lightning arena', 'Burst + Link + Shock + Gunner + Knock');
    const c = [300, 225], r = 140; const pts = [];
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.2; pts.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]); }
    const caught = [[c[0] + Math.cos(1.25) * r, c[1] + Math.sin(1.25) * r], [c[0] + Math.cos(3.6) * r, c[1] + Math.sin(3.6) * r]];
    const ring = [pts[0], pts[1], caught[0], pts[2], pts[3], caught[1], pts[4], pts[5], pts[0]];
    circ(...c, r, COL.shock, { fill: 0.04, w: 0.8, alpha: 0.3 });
    for (let i = 0; i < ring.length - 1; i++) arc(ring[i], ring[i + 1], COL.shock, 2, 8);
    pts.forEach(p => ent('diamond', ...p, 8, COL.shock));
    caught.forEach(p => { mite(...p, 12, COL.shock); fx('shock', ...p, 12); });
    [[c[0] + 170, c[1] - 90], [c[0] - 175, c[1] + 40]].forEach(p => { mite(...p, 12); const a = ang(c, p); arrow(p[0] - Math.cos(a) * 18, p[1] - Math.sin(a) * 18, p[0] + Math.cos(a) * 20, p[1] + Math.sin(a) * 20, COL.form, 1.6, 6); });
    [[c[0] - 40, c[1] - 50], [c[0] + 50, c[1] + 30], [c[0] - 20, c[1] + 70]].forEach(p => { line([[p[0], p[1] - 70], [p[0] + 6, p[1] - 30], [p[0] - 4, p[1] - 14], [p[0], p[1]]], COL.shock, 2.4, { blur: 16 }); blast(...p, 22, COL.shock); });
    player(c[0] + 10, c[1] - 10, 18, 0);
    text('touch the ring: you join it', 470, 410, 12, COL.dim, 'center');
  }
  if (id === 'pet') {
    stage('The summon, three ways', 'Ball + Explode · Ball + Follow + Gunner · Ball + Swarm');
    // three mini scenes in columns
    const cols = [60, 250, 440];
    // explode
    player(cols[0] + 10, 330, 16, -1.2); line(bez([cols[0] + 20, 320], [cols[0] + 30, 200], [cols[0] + 80, 170]), COL.player, 1.4, { dash: [3, 4], alpha: 0.5 }); blast(cols[0] + 85, 165, 60, COL.burn); mite(cols[0] + 60, 140, 10, COL.burn); mite(cols[0] + 110, 185, 10, COL.burn); text('on death: blast', cols[0] + 80, 380, 12, COL.text, 'center', 700);
    // pet
    player(cols[1] + 40, 300, 16, -1.4); ball(cols[1] + 85, 270, 11); line([[cols[1] + 85, 270], [cols[1] + 60, 300]], COL.dim, 1, { dash: [2, 3] }); [[cols[1] + 120, 150], [cols[1] + 40, 120]].forEach(e => { mite(...e, 10); const q = lerp([cols[1] + 85, 270], e, 0.6); bolt(...q, ang([cols[1] + 85, 270], e), COL.shot, 8, 3, 14); }); text('follows you, shoots', cols[1] + 75, 380, 12, COL.text, 'center', 700);
    // swarm
    player(cols[2] + 20, 330, 16, -1.0); [[cols[2] + 60, 140], [cols[2] + 130, 190], [cols[2] + 90, 230]].forEach((e, k) => { mite(...e, 11); for (let j = 0; j < 2; j++) { const s = [cols[2] + 30, 310]; const pts = bez(s, [s[0] + (k - 1) * 80 + j * 30, 250], e); line(pts, COL.player, 1, { alpha: 0.35 }); ball(...pts[18], 5, COL.player, 1); } }); text('6 small, homing', cols[2] + 80, 380, 12, COL.text, 'center', 700);
  }
}

// ---------- style board key ----------
const scene = window.SCENE || 'key:C';
const [kind, arg] = scene.split(':');
if (kind === 'key') sceneKey(arg, true);
if (kind === 'mod') sceneMod(arg);
if (kind === 'enemy') sceneEnemy(arg);
if (kind === 'status') sceneStatus(arg);
if (kind === 'ui') ({ levelup: sceneLevelUp, chest: sceneChest, build: sceneBuild })[arg]();
if (kind === 'maze') sceneMaze();
if (kind === 'spell') sceneSpell(arg);
if (kind === 'icons') { ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, W, H); Object.keys(MODS).forEach((id, i) => { const x = 60 + (i % 7) * 120, y = 70 + Math.floor(i / 7) * 120; chip(id, x, y, 64, 'common'); text(MODS[id][0], x, y + 46, 12, COL.text, 'center', 700); }); }
document.title = 'done';

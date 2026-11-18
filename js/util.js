export const TAU = Math.PI * 2;
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const len = (x, y) => Math.hypot(x, y);
export function norm(x, y) { const d = Math.hypot(x, y) || 1; return [x / d, y / d]; }
export function fmtTime(t) { const s = Math.floor(t); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

// Colours. One job each (docs/DECISIONS.md: player white, flat solid look).
export const COL = {
  bg: '#04060c', floor: '#0d1326', floorLine: '#161e3d', wallEdge: '#5a63c4', wallTop: '#262c5e',
  memFloor: '#080b17', memWall: '#141833', memEdge: '#2b3270',
  player: '#ffffff', playerCore: '#9fe9ff', shot: '#ffffff', enemy: '#ff3355', enemyDark: '#8a1027',
  xp: '#35f0a0', gold: '#ffc23a', ui: '#e8f0ff', uiDim: '#6b7499', hp: '#ff3355', aim: 'rgba(255,255,255,0.35)',
  dash: '#9fe9ff',
};

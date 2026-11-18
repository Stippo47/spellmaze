// Casts and modules (stage 2: the first five modules on all three casts).
// A cast is a shape plus modules. Each module says what it does on each shape it fits; a shape it has nothing to do on
// is simply missing from `on` and the module isn't allowed there (docs/DECISIONS.md: no fallbacks).
// Modules act through shared moments: contact (touching an enemy), wall, end. That's what lets one module work on
// a bolt, a thrown ball and a dash.

export const CASTS = {
  weapon: { name: 'Weapon', shape: 'bolt' },
  spawn: { name: 'Spawn', shape: 'ball' },
  dash: { name: 'Dash', shape: 'dash' },
};
export const CAST_ORDER = ['weapon', 'spawn', 'dash'];

export const MODULES = {
  extra: { name: 'Extra', family: 'form', on: {
    bolt: (l) => `+${l} bolt${l > 1 ? 's' : ''}, fanned`, ball: (l) => `+${l} ball${l > 1 ? 's' : ''}`,
    dash: (l) => `+${l} dash${l > 1 ? 'es' : ''} in a row` } },
  bounce: { name: 'Bounce', family: 'path', on: {
    bolt: (l) => `bounces off walls ${l}×`, ball: (l) => `rebounds off walls ${l}× at full speed`,
    dash: (l) => `rebounds off walls ${l}× and keeps going` } },
  home: { name: 'Home', family: 'path', on: {
    bolt: (l) => `curves to enemies ahead (turn ${turn(l).toFixed(0)})`, ball: (l) => `hunts enemies (speed ${hunt(l)})`,
    dash: (l) => `lunges at an enemy ahead (${lunge(l)} cells)` } },
  burn: { name: 'Burn', family: 'payload', on: {
    bolt: (l) => `+${burn(l)} burn a hit`, ball: (l) => `+${burn(l)} burn a hit`, dash: (l) => `+${burn(l)} burn to all you pass` } },
  explode: { name: 'Explode', family: 'spawn', on: {
    bolt: (l) => `blast where it hits or ends (${blastR(l).toFixed(1)} wide, ${blastDmg(l)})`,
    ball: (l) => `blast when it dies (${(blastR(l) + 1).toFixed(1)} wide, ${blastDmg(l) * 2})`,
    dash: (l) => `blast where the dash ends (${blastR(l).toFixed(1)} wide, ${blastDmg(l)})` } },
};
export const MODULE_ORDER = ['extra', 'bounce', 'home', 'burn', 'explode'];
export const MAX_LEVEL = 9;   // the practice build goes to legendary's cap

// Numbers by level, in one place.
export const turn = (l) => 3 + 2.5 * l;          // radians a second a homing bolt can turn
export const hunt = (l) => 9 + 2 * l;            // a hunting ball's speed
export const lunge = (l) => 6 + 2 * l;           // how far ahead a homing dash looks
export const burn = (l) => 18 + 8 * (l - 1);     // burn build-up a hit
export const blastR = (l) => 1.2 + 0.45 * l;     // blast radius in cells: starts small (round 3: 'very weak/small')
export const blastDmg = (l) => 3 + 5 * l;

export const level = (build, cast, id) => (build && build[cast] && build[cast][id]) || 0;
export const allowed = (cast, id) => !!MODULES[id].on[CASTS[cast].shape];

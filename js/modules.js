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
  burn: { name: 'Burn', family: 'payload', color: '#ff8a1f', on: {
    bolt: (l) => `+${burn(l)} burn a hit`, ball: (l) => `+${burn(l)} burn a hit`, dash: (l) => `+${burn(l)} burn to all you pass` } },
  chill: { name: 'Chill', family: 'payload', color: '#7fdcff', on: {
    bolt: (l) => `+${chill(l)} chill a hit`, ball: (l) => `+${chill(l)} chill a hit`, dash: (l) => `+${chill(l)} chill to all you pass` } },
  shock: { name: 'Shock', family: 'payload', color: '#ffe14d', on: {
    bolt: (l) => `+${shock(l)} shock a hit; each hit jumps to one more`, ball: (l) => `+${shock(l)} shock a hit; jumps on`,
    dash: (l) => `+${shock(l)} shock to all you pass` } },
  poison: { name: 'Poison', family: 'payload', color: '#c06bff', on: {
    bolt: (l) => `+${poison(l)} poison a hit`, ball: (l) => `+${poison(l)} poison a hit`, dash: (l) => `+${poison(l)} poison to all you pass` } },
  mark: { name: 'Mark', family: 'payload', color: '#ff7ab8', on: {
    bolt: (l) => `+${mark(l)} mark a hit; marked take +25%`, ball: (l) => `+${mark(l)} mark a hit; marked take +25%`,
    dash: (l) => `+${mark(l)} mark to all you pass` } },
  duration: { name: 'Duration', family: 'form', on: {
    bolt: (l) => `+${pct(l)}% range`, ball: (l) => `+${pct(l)}% life`, dash: (l) => `+${pct(l)}% length` } },
  explode: { name: 'Explode', family: 'spawn', on: {
    bolt: (l) => `blast where it hits or ends (${blastR(l).toFixed(1)} wide, ${blastDmg(l)})`,
    ball: (l) => `blast when it dies (${(blastR(l) + 1).toFixed(1)} wide, ${blastDmg(l) * 2})`,
    dash: (l) => `blast where the dash ends (${blastR(l).toFixed(1)} wide, ${blastDmg(l)})` } },
};
export const MODULE_ORDER = ['extra', 'bounce', 'home', 'burn', 'chill', 'shock', 'poison', 'mark', 'explode', 'duration'];
export const MAX_LEVEL = 9;   // the practice build goes to legendary's cap

// Numbers by level, in one place.
export const turn = (l) => 3 + 2.5 * l;          // radians a second a homing bolt can turn
export const hunt = (l) => 9 + 2 * l;            // a hunting ball's speed
export const lunge = (l) => 6 + 2 * l;           // how far ahead a homing dash looks
export const burn = (l) => 12 + 6 * (l - 1);     // build-up a hit (round 8: halved-ish, bursts were too easy)
export const chill = (l) => 12 + 6 * (l - 1);
export const shock = (l) => 12 + 6 * (l - 1);
export const poison = (l) => 10 + 5 * (l - 1);
export const mark = (l) => 12 + 4 * (l - 1);
export const STATUSES = ['burn', 'chill', 'shock', 'poison', 'mark'];
export const BUILD = { burn, chill, shock, poison, mark };
export const blastR = (l) => 1.2 + 0.45 * l;     // blast radius in cells: starts small (round 3: 'very weak/small')
export const blastDmg = (l) => 3 + 5 * l;
export const pct = (l) => 20 * l;                 // Duration: +20% a level
export const durOf = (l) => 1 + pct(l) / 100;

export const level = (build, cast, id) => (build && build[cast] && build[cast][id]) || 0;
export const allowed = (cast, id) => !!MODULES[id].on[CASTS[cast].shape];

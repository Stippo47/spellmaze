// Weapons are data. Each is the Bolt shape with its own trigger and rounds (docs/DECISIONS.md: firing is per weapon,
// ammo is rounds, shown as a ring round the fire stick).
//   trigger 'release': drag to aim, let go to fire one. A quick tap fires at the nearest enemy you can see.
//   trigger 'hold':    keeps firing while you drag. Taps do nothing.
//   trigger 'auto':    fires at the nearest enemy you can see by itself; drag to take over and aim.
// rounds: how many it holds. Each weapon picks how rounds come back (round 2 answer):
//   refill 'trickle': refillDelay seconds after a shot, rounds come back refillRate a second.
//   refill 'full': when empty, or refillDelay after a shot, a reload of reloadTime refills it all. Firing cancels it.
export const WEAPONS = {
  pistol: { name: 'Pistol', trigger: 'release', refill: 'trickle', rounds: 6, refillDelay: 0.45, refillRate: 3.2, cooldown: 0.16,
    damage: 10, speed: 38, range: 15, radius: 0.35, spread: 0, tapNearest: true },
  smg: { name: 'SMG', trigger: 'hold', refill: 'full', rounds: 40, refillDelay: 1.2, reloadTime: 1.4, cooldown: 0.07,
    damage: 4, speed: 44, range: 13, radius: 0.25, spread: 0.08, tapNearest: false },
  auto: { name: 'Auto', trigger: 'auto', refill: 'trickle', rounds: 8, refillDelay: 0.35, refillRate: 2.4, cooldown: 0.32,
    damage: 7, speed: 36, range: 13, radius: 0.3, spread: 0.02, tapNearest: false },
  // Stage 5: a short spray of pellets, and a slow, hard shot that goes through enemies.
  shotgun: { name: 'Shotgun', trigger: 'release', refill: 'full', rounds: 2, refillDelay: 0.8, reloadTime: 1.1, cooldown: 0.28,
    damage: 6, speed: 40, range: 9, radius: 0.3, spread: 0.02, tapNearest: true, pellets: 5, fan: 0.11 },
  rail: { name: 'Rail', trigger: 'release', refill: 'trickle', rounds: 1, refillDelay: 0.2, refillRate: 0.8, cooldown: 0.3,
    damage: 90, speed: 90, range: 32, radius: 0.32, spread: 0, tapNearest: true, budget: true },   // round 10: a damage budget, spent enemy by enemy
};
// Round 11: the Laser, a held beam. rounds = its charge (drains `drain` a second while firing); damage is per second.
WEAPONS.laser = { name: 'Laser', trigger: 'hold', refill: 'trickle', rounds: 100, drain: 30, refillDelay: 0.6, refillRate: 45, cooldown: 0,
  damage: 42, speed: 0, range: 18, radius: 0.35, spread: 0, tapNearest: false, beam: true };
export const WEAPON_ORDER = ['pistol', 'smg', 'auto', 'shotgun', 'rail', 'laser'];

export const DASH = { length: 5, time: 0.15, charges: 2, recharge: 2.4, shove: 1.6, safe: 0.35, block: 45 };   // block: damage to each breakable tile it hits   // safe: untouchable after a dash (round 4)

// The Spawn cast (decisions: on a cooldown, reads as "spawn" not "summon"). A thrown Ball: hits by contact, harder
// the faster it goes; slows to a stop, sits, and enemies near it go for it instead of you.
// Round 4: tougher but softer-hitting, and it wears down: health drains over its life, so hits shorten it.
// Round 5: thrown softly, rolls about 4 cells (speed / drag) in front of you.
export const SPAWN = { cooldown: 7, hp: 90, life: 16, speed: 8, r: 1.1, drag: 2, contact: 2, speedDamage: 0.4 };

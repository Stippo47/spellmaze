// Weapons are data. Each is the Bolt shape with its own trigger and rounds (docs/DECISIONS.md: firing is per weapon,
// ammo is rounds, shown as a ring round the fire stick).
//   trigger 'release': drag to aim, let go to fire one. A quick tap fires at the nearest enemy you can see.
//   trigger 'hold':    keeps firing while you drag. Taps do nothing.
//   trigger 'auto':    fires at the nearest enemy you can see by itself; drag to take over and aim.
// rounds: how many it holds. refillDelay: seconds after a shot before rounds come back. refillRate: rounds a second.
export const WEAPONS = {
  pistol: { name: 'Pistol', trigger: 'release', rounds: 6, refillDelay: 0.45, refillRate: 3.2, cooldown: 0.16,
    damage: 10, speed: 38, range: 15, radius: 0.35, spread: 0, tapNearest: true },
  smg: { name: 'SMG', trigger: 'hold', rounds: 40, refillDelay: 0.6, refillRate: 22, cooldown: 0.07,
    damage: 4, speed: 44, range: 13, radius: 0.25, spread: 0.08, tapNearest: false },
  auto: { name: 'Auto', trigger: 'auto', rounds: 8, refillDelay: 0.35, refillRate: 2.4, cooldown: 0.32,
    damage: 7, speed: 36, range: 13, radius: 0.3, spread: 0.02, tapNearest: false },
};
export const WEAPON_ORDER = ['pistol', 'smg', 'auto'];

export const DASH = { length: 6, time: 0.15, charges: 2, recharge: 2.4, shove: 1.6 };

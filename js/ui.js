// Pieces for the card screens (shards, level-ups, the build): line icons and level pips. Flat, one colour each.
const P = {
  // modules
  extra: 'M4 20 L11 5 M4 20 L19 9 M4 20 L20 17',
  bounce: 'M3 4 H21 M4 20 L12 5 L20 20',
  home: 'M4 21 C4 10 10 7 15 8 M18 8 m-3.2 0 a3.2 3.2 0 1 0 6.4 0 a3.2 3.2 0 1 0 -6.4 0',
  burn: 'M12 3 C16 8 19 11 19 15 A7 7 0 0 1 5 15 C5 11 8 9 9 6 C10 9 11 10 12 11 C12.5 8 12.5 5 12 3 Z',
  explode: 'M12 2 V7 M12 17 V22 M2 12 H7 M17 12 H22 M5 5 L8.5 8.5 M15.5 15.5 L19 19 M19 5 L15.5 8.5 M8.5 15.5 L5 19',
  // casts
  weapon: 'M4 20 L17 7 M12 6 H18 V12',
  spawn: 'M12 12 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 M12 12 m-2 0 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0',
  dash: 'M4 6 L10 12 L4 18 M12 6 L18 12 L12 18',
  // you
  damage: 'M12 3 V16 M7.5 14.5 H16.5 M12 16 V21',
  duration: 'M6 3 H18 M6 21 H18 M7 3 C7 10 17 14 17 21 M17 3 C17 10 7 14 7 21',
  health: 'M12 5 V19 M5 12 H19',
  speed: 'M3 6 L9 12 L3 18 M10 6 L16 12 L10 18 M17 6 L21 12 L17 18',
  cooldown: 'M12 12 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 M12 7 V12 L15.5 14',
  pickup: 'M6 4 V12 A6 6 0 0 0 18 12 V4 M6 7 H9.5 M14.5 7 H18',
  chill: 'M12 3 V21 M4.2 7.5 L19.8 16.5 M4.2 16.5 L19.8 7.5 M9.5 4.5 L12 7 L14.5 4.5 M9.5 19.5 L12 17 L14.5 19.5',
  shock: 'M13 2 L5 13 H11 L10 22 L19 10 H13 Z',
  poison: 'M12 3 C16 9 18 12 18 15 A6 6 0 0 1 6 15 C6 12 8 9 12 3 Z',
  mark: 'M12 12 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 M12 2 V7 M12 17 V22 M2 12 H7 M17 12 H22',
  pierce: 'M3 12 H21 M16 7 L21 12 L16 17 M9 7 V17',
  grow: 'M4 20 L10 14 M4 20 V15 M4 20 H9 M20 4 L14 10 M20 4 V9 M20 4 H15',
  haste: 'M13 3 L6 13 H11 L10 21 M15 8 H21 M14 12 H20 M15 16 H21',
  split: 'M3 12 H10 L17 5 M10 12 L17 19 M17 5 H21 M17 19 H21',
  knock: 'M3 12 H13 M9 8 L13 12 L9 16 M17 5 V19 M21 7 V17',
  shard: 'M12 2 L19 10 L12 22 L5 10 Z M5 10 H19 M9 10 L12 22 L15 10',
};

export function icon(name, color = 'currentColor', size = 26) {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${P[name] || ''}"/></svg>`;
}

// Level pips: filled up to `level`, the next one lit when `next`, outlined up to `cap`.
export function pips(level, cap, next = false) {
  let h = '<span class="pips">';
  for (let i = 1; i <= cap; i++) h += `<i class="${i <= level ? 'on' : next && i === level + 1 ? 'up' : ''}"></i>`;
  return h + '</span>';
}

// Slot squares for a cast: used and free.
export function slots(used, total) {
  let h = '<span class="slots">';
  for (let i = 0; i < total; i++) h += `<i class="${i < used ? 'on' : ''}"></i>`;
  return h + '</span>';
}

// Rabbit Survivors: every number that defines the game (weapons, passives, evolutions, heroes,
// monsters and the shop). Pure data, no Phaser, so tests can read it.

export const RUN_SECONDS = 15 * 60;
export const MAX_LEVEL = 5;
export const MAX_ENEMIES = 300;
export const WORLD = { W: 2560, H: 2560 };

// Each stat array is indexed by weapon level - 1 (levels 1..5).
export const WEAPONS = {
  dagger: {
    name: 'Thrown Dagger', icon: 'i_knife', desc: 'Throws daggers at the nearest monster.',
    cd: [1.0, 0.9, 0.8, 0.7, 0.6], dmg: [10, 12, 14, 17, 20], count: [1, 1, 2, 2, 3], pierce: [1, 1, 1, 2, 2], speed: 260,
  },
  shields: {
    name: 'Orbit Shields', icon: 'i_shield', desc: 'Shields circle you, bashing what they touch.',
    dmg: [8, 10, 12, 14, 16], count: [2, 2, 3, 3, 4], radius: [38, 40, 42, 44, 46], spin: [3, 3.2, 3.4, 3.6, 4],
  },
  aura: {
    name: 'Garlic Aura', icon: 'i_amulet', desc: 'A ring of stink hurts monsters near you.',
    dmg: [4, 5, 6, 8, 10], radius: [34, 38, 42, 48, 54], tick: 0.5,
  },
  lightning: {
    name: 'Chain Lightning', icon: 'i_staff', desc: 'Lightning strikes a monster and jumps on.',
    cd: [2.2, 2.0, 1.8, 1.6, 1.4], dmg: [14, 17, 20, 24, 28], chains: [2, 3, 3, 4, 5], range: 80,
  },
  boomerang: {
    name: 'Boomerang', icon: 'i_boomerang', desc: 'Flies out and back, hitting everything.',
    cd: [1.6, 1.5, 1.4, 1.25, 1.1], dmg: [12, 14, 17, 20, 24], count: [1, 1, 1, 2, 2], speed: 230,
  },
  bomb: {
    name: 'Fire Bomb', icon: 'i_bomb', desc: 'Lobs a bomb that bursts over an area.',
    cd: [2.8, 2.6, 2.4, 2.2, 2.0], dmg: [25, 30, 36, 43, 50], radius: [40, 44, 48, 52, 56], count: [1, 1, 1, 2, 2],
  },
};
export const WEAPON_IDS = Object.keys(WEAPONS);

export const PASSIVES = {
  boots: { name: 'Swift Boots', icon: 'i_boots', desc: '+8% move speed per level.', stat: 'speed', per: 0.08 },
  heart: { name: 'Big Heart', icon: 'i_heart', desc: '+15 max HP per level.', stat: 'maxHp', per: 15 },
  magnet: { name: 'Lucky Horseshoe', icon: 'i_horseshoe', desc: '+25% pickup range per level.', stat: 'magnet', per: 0.25 },
  ring: { name: 'Haste Ring', icon: 'i_ring', desc: '-6% weapon cooldowns per level.', stat: 'cd', per: 0.06 },
  tome: { name: 'Wide Tome', icon: 'i_book', desc: '+10% weapon area per level.', stat: 'area', per: 0.1 },
  might: { name: 'Might', icon: 'i_sword', desc: '+10% damage per level.', stat: 'might', per: 0.1 },
};
export const PASSIVE_IDS = Object.keys(PASSIVES);

// A maxed weapon plus (any level of) its passive evolves into a stronger version.
export const EVOLUTIONS = {
  fan: {
    from: 'dagger', needs: 'ring', name: 'Thousand Edges', icon: 'i_bigsword', desc: 'A storm of daggers that never stops.',
    cd: 0.22, dmg: 24, count: 1, pierce: 3, speed: 320,
  },
  bulwark: {
    from: 'shields', needs: 'tome', name: 'Holy Bulwark', icon: 'i_goldshield', desc: 'Six golden shields that knock monsters back.',
    dmg: 26, count: 6, radius: 56, spin: 4.4,
  },
  souleater: {
    from: 'aura', needs: 'heart', name: 'Soul Eater', icon: 'i_skull', desc: 'A huge aura that heals you as it hurts.',
    dmg: 14, radius: 70, tick: 0.4, heal: 0.4,
  },
  meteor: {
    from: 'bomb', needs: 'might', name: 'Meteor Storm', icon: 'i_potion', desc: 'Rains bombs on the biggest crowds.',
    cd: 1.6, dmg: 70, radius: 64, count: 3,
  },
};
export const EVOLUTION_IDS = Object.keys(EVOLUTIONS);

export const CHARACTERS = {
  wanderer: { name: 'Wanderer', weapon: 'dagger', cost: 0, hp: 100, speed: 1, desc: 'Balanced. Starts with daggers.', bonus: {} },
  ranger: { name: 'Ranger', weapon: 'boomerang', cost: 300, hp: 90, speed: 1.12, desc: 'Fast. Starts with a boomerang.', bonus: { magnet: 0.2 } },
  wizard: { name: 'Wizard', weapon: 'lightning', cost: 600, hp: 80, speed: 1, desc: 'Fragile. Lightning, +15% area.', bonus: { area: 0.15 } },
  brute: { name: 'Brute', weapon: 'aura', cost: 900, hp: 140, speed: 0.92, desc: 'Tough and slow. Garlic aura.', bonus: { armor: 1 } },
};
export const CHARACTER_IDS = Object.keys(CHARACTERS);

// Monster stats at minute 0 (hp grows with time, see waves.js). speed in px/s, r = hit radius.
export const ENEMIES = {
  bat: { hp: 6, speed: 52, dmg: 5, xp: 1, r: 6 },
  rat: { hp: 10, speed: 46, dmg: 6, xp: 1, r: 6 },
  slime: { hp: 18, speed: 32, dmg: 7, xp: 1, r: 7 },
  snake: { hp: 22, speed: 44, dmg: 8, xp: 2, r: 7 },
  skeleton: { hp: 30, speed: 40, dmg: 9, xp: 2, r: 7 },
  hound: { hp: 34, speed: 68, dmg: 9, xp: 2, r: 7 },
  zombie: { hp: 50, speed: 30, dmg: 10, xp: 3, r: 7 },
  orc: { hp: 70, speed: 38, dmg: 12, xp: 3, r: 7 },
  goblin: { hp: 66, speed: 58, dmg: 11, xp: 3, r: 7 },
  mummy: { hp: 110, speed: 32, dmg: 13, xp: 5, r: 7 },
  vampire: { hp: 90, speed: 50, dmg: 14, xp: 5, r: 7 },
  crab: { hp: 160, speed: 28, dmg: 14, xp: 6, r: 8 },
  brute: { hp: 240, speed: 34, dmg: 16, xp: 8, r: 8 },
  devil: { hp: 180, speed: 56, dmg: 16, xp: 8, r: 8 },
};

export const BOSSES = [
  { at: 300, type: 'orc', name: 'Orc Warlord', hp: 1600, speed: 40, dmg: 20, scale: 3 },
  { at: 600, type: 'vampire', name: 'Count Nocturne', hp: 5200, speed: 48, dmg: 26, scale: 3 },
  { at: 900, type: 'devil', name: 'The Horned King', hp: 10000, speed: 46, dmg: 34, scale: 3.5, final: true },
];

// Permanent upgrades bought with coins between runs. cost of the next level = base * (level + 1).
export const SHOP = {
  might: { name: 'Might', icon: 'i_sword', desc: '+5% damage', max: 5, base: 60 },
  vitality: { name: 'Vitality', icon: 'i_heart', desc: '+10 max HP', max: 5, base: 50 },
  armor: { name: 'Armor', icon: 'i_shield', desc: '-1 damage taken', max: 3, base: 120 },
  swift: { name: 'Swiftness', icon: 'i_boots', desc: '+5% move speed', max: 3, base: 80 },
  magnet: { name: 'Magnet', icon: 'i_horseshoe', desc: '+15% pickup range', max: 3, base: 50 },
  growth: { name: 'Growth', icon: 'i_book', desc: '+8% XP', max: 5, base: 70 },
  greed: { name: 'Greed', icon: 'i_coin', desc: '+15% coins', max: 5, base: 60 },
  revival: { name: 'Revival', icon: 'i_potion', desc: 'Get up once per run', max: 1, base: 600 },
};
export const SHOP_IDS = Object.keys(SHOP);

// Pixel Quest game data: heroes, skills, items, gear, monsters, encounter areas and shops.
// Pure data (no Phaser), shared by the game, the tests and the bot.

export const MAX_LEVEL = 30;
export const PARTY_ORDER = ['warrior', 'cleric', 'thief', 'mage'];

// ch: row in the RAS character sheet (side, front and back views are cut from it).
export const CLASSES = {
  warrior: {
    name: 'Ash', title: 'Warrior', ch: 2, color: '#d88038',
    base: { hp: 34, mp: 4, atk: 11, def: 9, mag: 2, spd: 5 },
    grow: { hp: 8.4, mp: 1.1, atk: 2.5, def: 2.0, mag: 0.5, spd: 1.0 },
    skills: [['slash', 1], ['provoke', 5], ['cleave', 9], ['warcry', 14], ['titan', 21]],
    gear: { w: 'sword', a: 'cloth' },
    blurb: 'Sturdy and strong. Protects the party with Provoke.',
  },
  cleric: {
    name: 'Sola', title: 'Cleric', ch: 9, color: '#f9f5ef',
    base: { hp: 24, mp: 10, atk: 7, def: 6, mag: 8, spd: 5 },
    grow: { hp: 6.2, mp: 2.5, atk: 1.5, def: 1.5, mag: 2.1, spd: 1.0 },
    skills: [['heal', 1], ['cure', 3], ['shield', 7], ['healall', 11], ['raise', 13], ['holy', 17], ['fullheal', 23]],
    gear: { w: 'staff', a: 'cloth' },
    blurb: 'Heals, cures and revives. Holy light burns the undead.',
  },
  thief: {
    name: 'Kit', title: 'Thief', ch: 5, color: '#8a8fc4',
    base: { hp: 24, mp: 6, atk: 9, def: 6, mag: 3, spd: 10 },
    grow: { hp: 6.4, mp: 1.5, atk: 2.1, def: 1.4, mag: 0.7, spd: 1.9 },
    skills: [['steal', 1], ['twin', 5], ['venom', 8], ['smoke', 10], ['mug', 15], ['rush', 21]],
    gear: { w: 'dagger', a: 'cloth' },
    blurb: 'Fast and lucky. Steals items and lands critical hits.',
  },
  mage: {
    name: 'Wren', title: 'Mage', ch: 7, color: '#5b74d0',
    base: { hp: 19, mp: 14, atk: 5, def: 4, mag: 11, spd: 7 },
    grow: { hp: 4.9, mp: 3.1, atk: 1.0, def: 1.1, mag: 2.6, spd: 1.3 },
    skills: [['fire', 1], ['sleep', 3], ['frost', 6], ['blaze', 10], ['hush', 12], ['thunder', 15], ['starfall', 22]],
    gear: { w: 'staff', a: 'cloth' },
    blurb: 'Fragile, but her spells hit every foe at once.',
  },
};

// kind: phys | magic | heal | buff | status | revive | cure | steal | flee | provoke
// target: foe | foes | ally | allies | self | dead
export const SKILLS = {
  slash: { name: 'Power Slash', mp: 3, kind: 'phys', target: 'foe', power: 1.7, desc: 'A heavy blow to one foe.' },
  provoke: { name: 'Provoke', mp: 2, kind: 'provoke', target: 'self', turns: 3, desc: 'Foes attack Ash for 3 turns. Ash guards a little.' },
  cleave: { name: 'Cleave', mp: 6, kind: 'phys', target: 'foes', power: 0.85, desc: 'Swing at every foe.' },
  warcry: { name: 'War Cry', mp: 8, kind: 'buff', target: 'allies', buff: 'atk', turns: 4, desc: 'Raises the whole party\'s attack.' },
  titan: { name: 'Titan Blow', mp: 10, kind: 'phys', target: 'foe', power: 2.8, pierce: 0.5, desc: 'Huge hit that ignores half of defence.' },

  heal: { name: 'Heal', mp: 3, kind: 'heal', target: 'ally', power: 20, scale: 1.1, field: true, desc: 'Restores HP to one ally.' },
  cure: { name: 'Cure', mp: 2, kind: 'cure', target: 'ally', field: true, desc: 'Cures poison, sleep and silence.' },
  shield: { name: 'Shield', mp: 4, kind: 'buff', target: 'allies', buff: 'def', turns: 4, desc: 'Raises the whole party\'s defence.' },
  healall: { name: 'Heal All', mp: 9, kind: 'heal', target: 'allies', power: 18, scale: 0.85, field: true, desc: 'Restores HP to the whole party.' },
  raise: { name: 'Raise', mp: 12, kind: 'revive', target: 'dead', frac: 0.5, field: true, desc: 'Revives a fallen ally with half HP.' },
  holy: { name: 'Holy', mp: 8, kind: 'magic', target: 'foe', power: 34, scale: 1.3, element: 'holy', desc: 'Holy light. Doubly strong on the undead.' },
  fullheal: { name: 'Full Heal', mp: 14, kind: 'heal', target: 'ally', power: 9999, scale: 0, field: true, desc: 'Restores all HP to one ally.' },

  steal: { name: 'Steal', mp: 0, kind: 'steal', target: 'foe', desc: 'Try to steal an item.' },
  twin: { name: 'Twin Strike', mp: 4, kind: 'phys', target: 'foe', power: 0.8, hits: 2, desc: 'Two quick hits.' },
  venom: { name: 'Venom Edge', mp: 3, kind: 'phys', target: 'foe', power: 1.0, status: 'poison', chance: 0.8, desc: 'A hit that usually poisons.' },
  smoke: { name: 'Smoke Bomb', mp: 3, kind: 'flee', target: 'self', desc: 'Escape for sure (not from bosses).' },
  mug: { name: 'Mug', mp: 5, kind: 'phys', target: 'foe', power: 1.3, steal: true, desc: 'Hit and steal at once.' },
  rush: { name: 'Shadow Rush', mp: 9, kind: 'phys', target: 'random', power: 0.75, hits: 4, desc: 'Four strikes at random foes.' },

  fire: { name: 'Fire', mp: 3, kind: 'magic', target: 'foe', power: 9, scale: 0.75, element: 'fire', desc: 'Fire on one foe.' },
  sleep: { name: 'Sleep', mp: 4, kind: 'status', target: 'foes', status: 'sleep', chance: 0.6, desc: 'May put every foe to sleep.' },
  frost: { name: 'Frost', mp: 5, kind: 'magic', target: 'foe', power: 22, scale: 1.05, element: 'ice', status: 'slow', chance: 0.4, desc: 'Ice on one foe. May slow it.' },
  blaze: { name: 'Blaze', mp: 8, kind: 'magic', target: 'foes', power: 16, scale: 0.8, element: 'fire', desc: 'Fire on every foe.' },
  hush: { name: 'Hush', mp: 4, kind: 'status', target: 'foes', status: 'silence', chance: 0.7, desc: 'May silence every foe\'s spells.' },
  thunder: { name: 'Thunder', mp: 11, kind: 'magic', target: 'foes', power: 30, scale: 0.95, element: 'bolt', desc: 'Lightning on every foe.' },
  starfall: { name: 'Starfall', mp: 18, kind: 'magic', target: 'foes', power: 60, scale: 1.3, desc: 'Falling stars on every foe.' },
};

export const STATUS = {
  poison: { name: 'Poison', short: 'PSN', color: '#9a407e' },
  sleep: { name: 'Sleep', short: 'SLP', color: '#8a8fc4' },
  silence: { name: 'Silence', short: 'SIL', color: '#e3d245' },
  slow: { name: 'Slow', short: 'SLW', color: '#6c8c50' },
};

// Consumables. icon: atlas frame 'i_<icon>'.
export const ITEMS = {
  herb: { name: 'Herb', price: 8, icon: 'leaf', use: 'heal', amount: 35, target: 'ally', desc: 'Restores 35 HP.' },
  tonic: { name: 'Tonic', price: 45, icon: 'potion', use: 'heal', amount: 120, target: 'ally', desc: 'Restores 120 HP.' },
  elixir: { name: 'Elixir', price: 400, icon: 'heart', use: 'full', target: 'ally', desc: 'Restores all HP and MP.' },
  ether: { name: 'Ether', price: 90, icon: 'gem', use: 'mp', amount: 25, target: 'ally', desc: 'Restores 25 MP.' },
  antidote: { name: 'Antidote', price: 6, icon: 'apple', use: 'cure', cures: ['poison'], target: 'ally', desc: 'Cures poison.' },
  salts: { name: 'Clear Salts', price: 20, icon: 'bone', use: 'cure', cures: ['poison', 'sleep', 'silence', 'slow'], target: 'ally', desc: 'Cures every status problem.' },
  lifeleaf: { name: 'Life Leaf', price: 150, icon: 'feather', use: 'revive', frac: 0.4, target: 'dead', desc: 'Revives a fallen ally.' },
  bomb: { name: 'Bomb', price: 60, icon: 'bomb', use: 'bomb', amount: 45, target: 'foes', battleOnly: true, desc: 'Deals 45 damage to every foe.' },
  incense: { name: 'Ward Incense', price: 40, icon: 'lantern', use: 'repel', amount: 150, target: 'none', fieldOnly: true, desc: 'No random battles for 150 steps.' },
  wing: { name: 'Home Wing', price: 30, icon: 'boomerang', use: 'warp', target: 'none', fieldOnly: true, desc: 'Flies you to the last inn you rested at.' },
};

// Key items (cannot be sold or used from the bag).
export const KEY_ITEMS = {
  cellkey: { name: 'Cell Key', icon: 'key', desc: 'Opens a cell door in the Mole Cave.' },
  chime1: { name: 'Earth Chime', icon: 'bellI', desc: 'The first chime of the Sun Bell.' },
  chime2: { name: 'Sky Chime', icon: 'bellI', desc: 'The second chime of the Sun Bell.' },
  chime3: { name: 'Fire Chime', icon: 'bellI', desc: 'The third chime of the Sun Bell.' },
  spirekey: { name: 'Spire Key', icon: 'key', desc: 'Opens the great door of Nightspire.' },
};

// Gear: slot w (weapon) | a (armour) | c (charm). who: which classes can use it (W C T M).
export const GEAR = {
  sword: { name: 'Wood Sword', slot: 'w', who: 'W', atk: 3, price: 10, icon: 'knife' },
  bronze: { name: 'Bronze Sword', slot: 'w', who: 'W', atk: 9, price: 70, icon: 'sword' },
  iron: { name: 'Iron Sword', slot: 'w', who: 'W', atk: 18, price: 260, icon: 'sword' },
  steel: { name: 'Steel Blade', slot: 'w', who: 'W', atk: 30, price: 760, icon: 'blade' },
  knight: { name: 'Knight Sword', slot: 'w', who: 'W', atk: 44, price: 1700, icon: 'blade' },
  sunblade: { name: 'Sun Blade', slot: 'w', who: 'W', atk: 60, price: 0, icon: 'blade', mag: 6 },
  axe: { name: 'War Axe', slot: 'w', who: 'W', atk: 24, price: 0, icon: 'axe', spd: -2 },

  staff: { name: 'Oak Staff', slot: 'w', who: 'CM', atk: 2, mag: 2, price: 10, icon: 'rod' },
  ashstaff: { name: 'Ash Staff', slot: 'w', who: 'CM', atk: 5, mag: 6, price: 160, icon: 'wand' },
  mace: { name: 'Mace', slot: 'w', who: 'WC', atk: 12, price: 150, icon: 'club' },
  holymace: { name: 'Holy Mace', slot: 'w', who: 'C', atk: 22, mag: 10, price: 950, icon: 'hammer' },
  crystal: { name: 'Crystal Rod', slot: 'w', who: 'M', atk: 8, mag: 15, price: 820, icon: 'staff' },
  starrod: { name: 'Star Rod', slot: 'w', who: 'M', atk: 10, mag: 26, price: 0, icon: 'staff' },
  saintstaff: { name: 'Saint Staff', slot: 'w', who: 'C', atk: 16, mag: 20, price: 0, icon: 'staff' },

  dagger: { name: 'Dagger', slot: 'w', who: 'TM', atk: 4, price: 10, icon: 'dagger' },
  kris: { name: 'Kris', slot: 'w', who: 'T', atk: 12, price: 130, icon: 'dagger' },
  kukri: { name: 'Kukri', slot: 'w', who: 'T', atk: 21, price: 480, icon: 'boomerang' },
  assassin: { name: 'Night Knife', slot: 'w', who: 'T', atk: 35, price: 1450, icon: 'dagger' },
  fang: { name: 'Shadow Fang', slot: 'w', who: 'T', atk: 48, spd: 6, price: 0, icon: 'dagger' },

  cloth: { name: 'Cloth', slot: 'a', who: 'WCTM', def: 2, price: 10, icon: 'cloak' },
  leather: { name: 'Leather', slot: 'a', who: 'WCTM', def: 6, price: 60, icon: 'armor' },
  chain: { name: 'Chain Mail', slot: 'a', who: 'WC', def: 13, price: 280, icon: 'armorW' },
  garb: { name: 'Thief Garb', slot: 'a', who: 'T', def: 11, spd: 4, price: 300, icon: 'cloakB' },
  robe: { name: 'Sage Robe', slot: 'a', who: 'CM', def: 9, mag: 4, price: 300, icon: 'cloakB' },
  plate: { name: 'Iron Plate', slot: 'a', who: 'W', def: 22, price: 720, icon: 'armorW' },
  silk: { name: 'Silk Robe', slot: 'a', who: 'CM', def: 16, mag: 8, price: 1100, icon: 'cloakG' },
  mithril: { name: 'Mithril Mail', slot: 'a', who: 'WCT', def: 28, price: 1600, icon: 'armorG' },
  dragon: { name: 'Dragon Mail', slot: 'a', who: 'W', def: 40, price: 0, icon: 'armorG' },

  speedring: { name: 'Speed Ring', slot: 'c', who: 'WCTM', spd: 6, price: 400, icon: 'ring' },
  powerband: { name: 'Power Band', slot: 'c', who: 'WCTM', atk: 7, price: 450, icon: 'beltG' },
  magiccharm: { name: 'Magic Charm', slot: 'c', who: 'WCTM', mag: 7, mp: 10, price: 500, icon: 'amuletB' },
  guard: { name: 'Guard Amulet', slot: 'c', who: 'WCTM', def: 9, price: 0, icon: 'amulet' },
  clover: { name: 'Lucky Clover', slot: 'c', who: 'WCTM', luck: true, spd: 2, price: 0, icon: 'leaf' },
  ribbon: { name: 'Ribbon', slot: 'c', who: 'WCTM', ward: true, def: 4, price: 0, icon: 'amuletG' },
};
export const CLASS_LETTER = { warrior: 'W', cleric: 'C', thief: 'T', mage: 'M' };

// Monster archetypes scale a level-based stat curve (see stats.js monsterStats).
export const ARCH = {
  blob: { hp: 0.9, atk: 0.85, def: 0.8, mag: 0.7, spd: 0.7 },
  beast: { hp: 1, atk: 1.08, def: 0.9, mag: 0.6, spd: 1.2 },
  flyer: { hp: 0.75, atk: 0.95, def: 0.75, mag: 0.8, spd: 1.5 },
  brute: { hp: 1.35, atk: 1.22, def: 1.05, mag: 0.5, spd: 0.7 },
  armor: { hp: 1.0, atk: 1.0, def: 1.6, mag: 0.6, spd: 0.6 },
  caster: { hp: 0.8, atk: 0.7, def: 0.8, mag: 1.3, spd: 1.0 },
  undead: { hp: 1.1, atk: 1.0, def: 1.0, mag: 0.9, spd: 0.8 },
  boss: { hp: 1, atk: 1.15, def: 1.1, mag: 1.15, spd: 1.0 },
};

// Monster skills (used by the enemy AI).
export const MSKILLS = {
  bite: { name: 'Venom Bite', kind: 'phys', target: 'foe', power: 1.0, status: 'poison', chance: 0.45 },
  spores: { name: 'Sleep Spores', kind: 'status', target: 'foe', status: 'sleep', chance: 0.5 },
  lullaby: { name: 'Lullaby', kind: 'status', target: 'foes', status: 'sleep', chance: 0.3 },
  ember: { name: 'Ember', kind: 'magic', target: 'foe', power: 6, scale: 0.8, element: 'fire' },
  flame: { name: 'Fire Breath', kind: 'magic', target: 'foes', power: 10, scale: 0.6, element: 'fire' },
  icebolt: { name: 'Ice Bolt', kind: 'magic', target: 'foe', power: 10, scale: 0.9, element: 'ice' },
  blizzard: { name: 'Blizzard', kind: 'magic', target: 'foes', power: 12, scale: 0.6, element: 'ice' },
  gust: { name: 'Gust', kind: 'magic', target: 'foes', power: 6, scale: 0.55 },
  zap: { name: 'Zap', kind: 'magic', target: 'foe', power: 10, scale: 0.9, element: 'bolt' },
  mend: { name: 'Mend', kind: 'heal', target: 'ally', power: 20, scale: 1.0 },
  hush: { name: 'Hush', kind: 'status', target: 'foe', status: 'silence', chance: 0.55 },
  drain: { name: 'Drain', kind: 'phys', target: 'foe', power: 1.0, drain: 0.5 },
  double: { name: 'Double Slash', kind: 'phys', target: 'foe', power: 0.75, hits: 2 },
  crush: { name: 'Crush', kind: 'phys', target: 'foe', power: 1.6 },
  quake: { name: 'Quake', kind: 'phys', target: 'foes', power: 0.75 },
  harden: { name: 'Harden', kind: 'buff', target: 'self', buff: 'def', turns: 3 },
  howl: { name: 'Howl', kind: 'buff', target: 'allies', buff: 'atk', turns: 3 },
  sting: { name: 'Tail Sting', kind: 'phys', target: 'foe', power: 1.3, status: 'poison', chance: 0.6 },
  dark: { name: 'Dark Wave', kind: 'magic', target: 'foes', power: 18, scale: 0.75 },
  doom: { name: 'Night Fall', kind: 'magic', target: 'foes', power: 28, scale: 0.9 },
  flee: { name: 'Flee', kind: 'flee', target: 'self' },
};

// spr: [col, row] on the Darkness Pack creature sheet, or a boss key. pal: recolour ramp.
// weak / resist: element lists. steal: item id. drop: [item, chance].
export const MONSTERS = {
  ooze: { name: 'Ooze', spr: [3, 1], pal: 'green', lv: 1, arch: 'blob', steal: 'herb', drop: ['herb', 0.15] },
  shroom: { name: 'Shroomlet', spr: [2, 0], pal: 'orange', lv: 1, arch: 'blob', skills: [['spores', 0.2]], steal: 'antidote', drop: ['antidote', 0.15] },
  bat: { name: 'Dusk Bat', spr: [0, 6], pal: 'shadow', lv: 2, arch: 'flyer', steal: 'herb' },
  grub: { name: 'Burrower', spr: [0, 0], pal: 'bone', lv: 2, arch: 'armor', steal: 'herb', drop: ['herb', 0.2] },

  cavebat: { name: 'Cave Bat', spr: [0, 6], pal: 'orig', lv: 3, arch: 'flyer', skills: [['drain', 0.2]], steal: 'herb' },
  spider: { name: 'Pit Spider', spr: [5, 0], pal: 'red', lv: 4, arch: 'beast', skills: [['bite', 0.3]], steal: 'antidote', drop: ['antidote', 0.2] },
  imp: { name: 'Gremlin', spr: [5, 2], pal: 'red', lv: 4, arch: 'caster', skills: [['ember', 0.35]], weak: ['ice'], steal: 'ether', drop: ['herb', 0.2] },
  kobold: { name: 'Kobold', spr: [1, 3], pal: 'orange', lv: 4, arch: 'beast', steal: 'herb', drop: ['tonic', 0.06] },
  mimic: { name: 'Mimic', spr: [3, 4], pal: 'gold', lv: 5, arch: 'brute', hp: 2.2, skills: [['crush', 0.3]], gold: 4, steal: 'tonic', drop: ['tonic', 1] },

  wolf: { name: 'Gray Wolf', spr: [3, 6], pal: 'bone', lv: 7, arch: 'beast', skills: [['howl', 0.15]], steal: 'herb' },
  hornet: { name: 'Stinger', spr: [7, 1], pal: 'gold', lv: 7, arch: 'flyer', skills: [['bite', 0.35]], steal: 'antidote' },
  goblin: { name: 'Goblin', spr: [4, 1], pal: 'green', lv: 8, arch: 'beast', skills: [['double', 0.2]], steal: 'tonic', drop: ['herb', 0.25] },
  toad: { name: 'Bog Toad', spr: [6, 2], pal: 'green', lv: 8, arch: 'blob', skills: [['lullaby', 0.2]], weak: ['bolt'], steal: 'salts' },
  crab: { name: 'Snapper', spr: [6, 0], pal: 'red', lv: 9, arch: 'armor', weak: ['bolt'], resist: ['fire'], steal: 'tonic' },

  owl: { name: 'Hoot Owl', spr: [2, 2], pal: 'blue', lv: 10, arch: 'flyer', skills: [['spores', 0.25]], steal: 'salts' },
  harpy: { name: 'Harpy', spr: [2, 7], pal: 'orig', lv: 11, arch: 'flyer', skills: [['gust', 0.3]], weak: ['bolt'], steal: 'tonic' },
  wisp: { name: 'Will-o-Wisp', spr: [8, 4], pal: 'blue', lv: 11, arch: 'caster', skills: [['zap', 0.4]], weak: ['holy'], resist: ['bolt'], steal: 'ether', drop: ['ether', 0.08] },
  cultist: { name: 'Wind Cultist', spr: [6, 1], pal: 'shadow', lv: 12, arch: 'caster', skills: [['mend', 0.3], ['hush', 0.15]], steal: 'ether', drop: ['tonic', 0.2] },
  gazer: { name: 'Gazer', spr: [1, 0], pal: 'red', lv: 12, arch: 'caster', skills: [['hush', 0.25], ['zap', 0.25]], steal: 'salts' },

  scorpion: { name: 'Dune Scorpion', spr: [4, 4], pal: 'orange', lv: 13, arch: 'armor', skills: [['sting', 0.3]], weak: ['ice'], steal: 'antidote' },
  sandworm: { name: 'Sand Wyrm', spr: [4, 7], pal: 'gold', lv: 14, arch: 'brute', skills: [['crush', 0.2]], weak: ['ice'], steal: 'tonic' },
  mantis: { name: 'Mantis', spr: [2, 1], pal: 'green', lv: 14, arch: 'beast', skills: [['double', 0.35]], weak: ['fire'], steal: 'tonic' },
  brute: { name: 'Ogre', spr: [4, 2], pal: 'orange', lv: 15, arch: 'brute', skills: [['crush', 0.25]], steal: 'tonic', drop: ['tonic', 0.2] },

  firewisp: { name: 'Fire Wisp', spr: [8, 4], pal: 'ember', lv: 16, arch: 'caster', skills: [['ember', 0.45]], weak: ['ice'], resist: ['fire'], steal: 'ether' },
  magma: { name: 'Magma Slug', spr: [3, 1], pal: 'ember', lv: 16, arch: 'blob', hp: 1.3, skills: [['flame', 0.2]], weak: ['ice'], resist: ['fire'], steal: 'tonic' },
  salamander: { name: 'Salamander', spr: [8, 5], pal: 'red', lv: 17, arch: 'beast', skills: [['flame', 0.2]], weak: ['ice'], resist: ['fire'], steal: 'salts' },
  hellimp: { name: 'Hell Imp', spr: [5, 3], pal: 'ember', lv: 17, arch: 'caster', skills: [['ember', 0.4], ['hush', 0.1]], weak: ['ice', 'holy'], steal: 'ether', drop: ['ether', 0.1] },
  mimic2: { name: 'Lava Mimic', spr: [3, 4], pal: 'ember', lv: 18, arch: 'brute', hp: 2.0, skills: [['crush', 0.3], ['flame', 0.2]], gold: 4, steal: 'elixir', drop: ['elixir', 1] },

  yeti: { name: 'Yeti', spr: [4, 3], pal: 'ice', lv: 19, arch: 'brute', skills: [['crush', 0.2], ['blizzard', 0.15]], weak: ['fire'], resist: ['ice'], steal: 'tonic' },
  frostwolf: { name: 'Frost Wolf', spr: [3, 6], pal: 'ice', lv: 19, arch: 'beast', skills: [['howl', 0.15], ['icebolt', 0.2]], weak: ['fire'], resist: ['ice'], steal: 'tonic' },
  ghost: { name: 'Ghost', spr: [0, 1], pal: 'bone', lv: 20, arch: 'undead', undead: true, skills: [['drain', 0.3], ['hush', 0.1]], weak: ['holy', 'fire'], steal: 'ether' },
  floe: { name: 'Floe Jelly', spr: [8, 0], pal: 'ice', lv: 20, arch: 'blob', hp: 1.2, skills: [['blizzard', 0.25]], weak: ['fire', 'bolt'], resist: ['ice'], steal: 'salts' },

  knight: { name: 'Dark Knight', spr: [5, 5], pal: 'shadow', lv: 22, arch: 'armor', skills: [['double', 0.25]], weak: ['holy'], steal: 'tonic', drop: ['tonic', 0.2] },
  skeleton: { name: 'Skeleton', spr: [1, 5], pal: 'bone', lv: 22, arch: 'undead', undead: true, skills: [['double', 0.2]], weak: ['holy', 'fire'], steal: 'lifeleaf' },
  shade: { name: 'Shade', spr: [6, 3], pal: 'shadow', lv: 23, arch: 'caster', skills: [['hush', 0.2], ['dark', 0.3]], weak: ['holy'], steal: 'ether', drop: ['ether', 0.1] },
  warlock: { name: 'Warlock', spr: [4, 5], pal: 'red', lv: 23, arch: 'caster', skills: [['flame', 0.3], ['mend', 0.15]], steal: 'ether' },
  chimera: { name: 'Chimera', spr: [7, 5], pal: 'orange', lv: 24, arch: 'brute', skills: [['flame', 0.2], ['crush', 0.2]], weak: ['ice'], steal: 'elixir' },
  reaper: { name: 'Reaper', spr: [3, 0], pal: 'shadow', lv: 24, arch: 'undead', undead: true, skills: [['drain', 0.3], ['dark', 0.2]], weak: ['holy'], steal: 'lifeleaf', drop: ['lifeleaf', 0.1] },

  goldooze: { name: 'Gold Ooze', spr: [3, 1], pal: 'gold', lv: 10, arch: 'blob', fixed: { hp: 18, atk: 10, def: 400, mag: 10, spd: 60 }, xp: 900, gold: 400, skills: [['flee', 0.45]], steal: 'elixir', rare: true },

  // Bosses. hp/xp/gold multipliers on top of the level curve.
  stonehide: { name: 'Stonehide', spr: 'golem', pal: 'orange', lv: 7, arch: 'boss', boss: true, hp: 7.5, xp: 6, gold: 8, skills: [['quake', 0.25], ['harden', 0.12], ['crush', 0.2]], steal: 'tonic' },
  galewing: { name: 'Galewing', spr: 'demon', pal: 'blue', lv: 13, arch: 'boss', boss: true, hp: 9, xp: 6, gold: 8, skills: [['gust', 0.3], ['hush', 0.12], ['double', 0.2]], weak: ['bolt'], steal: 'ether' },
  pyrescorp: { name: 'Pyrescorp', spr: 'scorpion', pal: 'ember', lv: 18, arch: 'boss', boss: true, hp: 9.5, xp: 6, gold: 8, skills: [['flame', 0.3], ['sting', 0.25], ['harden', 0.08]], weak: ['ice'], resist: ['fire'], steal: 'elixir' },
  wyvern: { name: 'Bone Wyvern', spr: 'wyvern', pal: 'bone', lv: 23, arch: 'boss', boss: true, undead: true, hp: 8, xp: 6, gold: 8, skills: [['blizzard', 0.25], ['drain', 0.2], ['crush', 0.2]], weak: ['holy', 'fire'], steal: 'elixir' },
  vesper: { name: 'Vesper', spr: [4, 5], big: true, pal: 'night', lv: 24, arch: 'boss', boss: true, hp: 5, xp: 0, gold: 0, skills: [['dark', 0.3], ['hush', 0.12], ['mend', 0.08], ['blizzard', 0.15]], weak: ['holy'], steal: 'elixir' },
  unbound: { name: 'Vesper Unbound', spr: 'tentacle', pal: 'night', lv: 25, arch: 'boss', boss: true, hp: 5.5, xp: 0, gold: 0, skills: [['doom', 0.25], ['drain', 0.2], ['lullaby', 0.12], ['double', 0.18]], weak: ['holy'], steal: 'elixir' },
  hive: { name: 'Hive Queen', spr: 'insect', pal: 'gold', lv: 26, arch: 'boss', boss: true, hp: 10, xp: 5, gold: 10, skills: [['sting', 0.3], ['lullaby', 0.15], ['quake', 0.2]], weak: ['fire'], steal: 'elixir' },
};

// Big sprites on the creature sheet: [x, y, w, h].
export const BIG_SPRITES = {
  tentacle: [0, 128, 48, 32], scorpion: [48, 128, 48, 32], demon: [96, 128, 32, 32],
  eye: [0, 160, 32, 32], insect: [32, 160, 32, 32], skulls: [64, 160, 32, 32], golem: [96, 160, 32, 32], wyvern: [0, 192, 32, 32],
};

// Recolour ramps for the creature sheet's five shades, light to dark.
export const PALS = {
  orig: null,
  green: ['#eef5c8', '#b4d070', '#6c8c50', '#3e5c34', '#1c2a1c'],
  orange: ['#fff0c8', '#f0b060', '#d88038', '#8a4a24', '#3a1c10'],
  red: ['#f9e0c8', '#e89070', '#c0503c', '#7a2a2e', '#3a1418'],
  blue: ['#eef2ff', '#a8bcec', '#6a78c0', '#3c3c80', '#1c1838'],
  gold: ['#fffbe0', '#f0d472', '#e3a838', '#a06020', '#4a2810'],
  ice: ['#ffffff', '#cdeaf3', '#8ab0d8', '#5068a0', '#202848'],
  shadow: ['#d8c8e8', '#9a80b8', '#6a4a88', '#3a2850', '#140c1c'],
  bone: ['#f9f5ef', '#ddd4bc', '#a89c80', '#6a6050', '#2a2420'],
  ember: ['#fff2a0', '#f4b040', '#d86020', '#8a2818', '#300c08'],
  night: ['#f0e0ff', '#c080d8', '#8a40a0', '#4a1a60', '#16061e'],
};

// Random-encounter areas. lv: the level a party should be around. max: biggest group.
export const AREAS = {
  plains: { lv: 2, max: 3, mons: [['ooze', 5], ['shroom', 3], ['bat', 3], ['grub', 2]] },
  molecave: { lv: 5, max: 3, mons: [['cavebat', 4], ['spider', 4], ['imp', 3], ['kobold', 3], ['ooze', 1]] },
  eastfield: { lv: 8, max: 4, mons: [['wolf', 4], ['hornet', 4], ['goblin', 3], ['toad', 3], ['crab', 2]] },
  tower: { lv: 11, max: 4, mons: [['owl', 4], ['harpy', 4], ['wisp', 3], ['cultist', 3], ['gazer', 2]] },
  desert: { lv: 14, max: 4, mons: [['scorpion', 4], ['sandworm', 3], ['mantis', 4], ['brute', 2]] },
  embercave: { lv: 17, max: 4, mons: [['firewisp', 4], ['magma', 3], ['salamander', 3], ['hellimp', 3]] },
  frost: { lv: 20, max: 4, mons: [['yeti', 3], ['frostwolf', 4], ['ghost', 3], ['floe', 3]] },
  castle: { lv: 23, max: 4, mons: [['knight', 4], ['skeleton', 4], ['shade', 3], ['warlock', 3], ['chimera', 2], ['reaper', 2]] },
};
// Gold Ooze: a rare visitor anywhere outside the first area.
export const RARE = { id: 'goldooze', chance: 0.012, minArea: 'eastfield' };

export const SHOPS = {
  bw_items: { name: 'Item Shop', items: ['herb', 'antidote', 'incense', 'wing'] },
  bw_gear: { name: 'Gear Shop', items: ['bronze', 'mace', 'kris', 'ashstaff', 'leather'] },
  fe_items: { name: 'Item Shop', items: ['herb', 'tonic', 'antidote', 'salts', 'ether', 'incense', 'wing'] },
  fe_gear: { name: 'Gear Shop', items: ['iron', 'mace', 'kris', 'kukri', 'ashstaff', 'leather', 'chain', 'garb', 'robe'] },
  em_items: { name: 'Item Shop', items: ['herb', 'tonic', 'salts', 'ether', 'lifeleaf', 'bomb', 'incense', 'wing'] },
  em_gear: { name: 'Gear Shop', items: ['steel', 'kukri', 'holymace', 'crystal', 'chain', 'plate', 'garb', 'robe', 'speedring', 'powerband'] },
  fr_items: { name: 'Item Shop', items: ['tonic', 'salts', 'ether', 'lifeleaf', 'bomb', 'elixir', 'incense', 'wing'] },
  fr_gear: { name: 'Gear Shop', items: ['knight', 'assassin', 'holymace', 'crystal', 'mithril', 'silk', 'plate', 'magiccharm', 'powerband', 'speedring'] },
};

export const INN_PRICE = { bw: 6, fe: 14, em: 24, fr: 36 };

export const itemName = (id) => (ITEMS[id] || GEAR[id] || KEY_ITEMS[id])?.name || id;
export const itemIcon = (id) => (ITEMS[id] || GEAR[id] || KEY_ITEMS[id])?.icon || 'chestI';
export const itemPrice = (id) => (ITEMS[id] || GEAR[id])?.price || 0;

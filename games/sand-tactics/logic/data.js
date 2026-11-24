// Units, terrain and the damage table. Pure data: no Phaser, safe to import from node tests.

export const SIDES = [
  { id: 0, key: 'blue', name: 'Blue', army: 'Azure Dunes Corps', color: '#5b8fd8' },
  { id: 1, key: 'red', name: 'Red', army: 'Crimson Scorpions', color: '#d0453f' },
];

// Movement types: foot (infantry), boot (lancers: climb mesas easily), tread, wheel, air.
// Terrain keys. Buildings are terrain too (hq, factory, city).
export const TERRAIN = {
  sand: { name: 'Sand', def: 1, cost: { foot: 1, boot: 1, tread: 1, wheel: 2, air: 1 } },
  dunes: { name: 'Dunes', def: 2, cost: { foot: 1, boot: 1, tread: 2, wheel: 3, air: 1 } },
  oasis: { name: 'Oasis', def: 2, cost: { foot: 1, boot: 1, tread: 2, wheel: 3, air: 1 } },
  road: { name: 'Road', def: 0, cost: { foot: 1, boot: 1, tread: 1, wheel: 1, air: 1 } },
  mesa: { name: 'Mesa', def: 4, cost: { foot: 2, boot: 1, tread: 0, wheel: 0, air: 1 } },
  water: { name: 'Water', def: 0, cost: { foot: 0, boot: 0, tread: 0, wheel: 0, air: 1 } },
  city: { name: 'City', def: 3, cost: { foot: 1, boot: 1, tread: 1, wheel: 1, air: 1 } },
  factory: { name: 'Factory', def: 3, cost: { foot: 1, boot: 1, tread: 1, wheel: 1, air: 1 } },
  hq: { name: 'HQ', def: 4, cost: { foot: 1, boot: 1, tread: 1, wheel: 1, air: 1 } },
};

// Map characters -> terrain. Building letters: upper case Blue, lower case Red, n/m/x neutral.
export const TERRAIN_CHARS = {
  '.': 'sand', ':': 'dunes', 'o': 'oasis', '=': 'road', '^': 'mesa', '~': 'water',
};
export const PROP_CHARS = {
  H: ['hq', 0], h: ['hq', 1],
  F: ['factory', 0], f: ['factory', 1], m: ['factory', -1],
  C: ['city', 0], c: ['city', 1], n: ['city', -1],
};

export const CAPTURE_POINTS = 20;
export const INCOME = 1000;

// Unit letters for map overlays: upper case Blue, lower case Red.
export const UNIT_CHARS = { I: 'inf', L: 'lancer', S: 'scout', R: 'recon', T: 'tank', K: 'heavy', A: 'arty', Q: 'flak', D: 'drone', U: 'truck', V: 'harv' };

/**
 * name, cost, move, moveType, range [min, max], capture?, air?, short help.
 * art: sheet kind + frame block (see frames.js).
 */
export const UNITS = {
  inf: { name: 'Infantry', cost: 1000, move: 3, moveType: 'foot', range: [1, 1], capture: true, art: 'inf', blurb: 'Cheap. Captures buildings.' },
  lancer: { name: 'Lancer', cost: 3000, move: 2, moveType: 'boot', range: [1, 1], capture: true, art: 'hinf', blurb: 'Rocket squad. Captures, hurts vehicles, climbs mesas.' },
  scout: { name: 'Scout', cost: 1500, move: 4, moveType: 'foot', range: [1, 1], capture: true, art: 'scout', blurb: 'Fast foot soldier. Captures. Weak in a fight.' },
  recon: { name: 'Recon', cost: 4000, move: 8, moveType: 'wheel', range: [1, 1], art: 'recon', blurb: 'Very fast buggy. Good against infantry.' },
  tank: { name: 'Tank', cost: 7000, move: 6, moveType: 'tread', range: [1, 1], art: 'tank', blurb: 'All-round fighter.' },
  heavy: { name: 'Heavy Tank', cost: 15000, move: 5, moveType: 'tread', range: [1, 1], art: 'heavy', blurb: 'Slow, tough, hits very hard.' },
  arty: { name: 'Artillery', cost: 6000, move: 5, moveType: 'tread', range: [2, 3], art: 'arty', blurb: 'Fires 2-3 tiles away. Can\'t move and fire in one turn. Fragile up close.' },
  flak: { name: 'Flak', cost: 8000, move: 6, moveType: 'tread', range: [1, 1], art: 'flak', blurb: 'Shreds drones and infantry. Weak against tanks.' },
  drone: { name: 'Drone', cost: 9000, move: 7, moveType: 'air', range: [1, 1], air: true, art: 'drone', blurb: 'Flies over anything. Hunts vehicles. Fears Flak.' },
  truck: { name: 'Supply Truck', cost: 4000, move: 6, moveType: 'wheel', range: [1, 1], unarmed: true, supply: true, art: 'truck', blurb: 'Unarmed. Repairs 1 health of each unit next to it at the start of your turn, free.' },
  harv: { name: 'Harvester', cost: 3000, move: 4, moveType: 'tread', range: [1, 1], unarmed: true, harvest: 500, art: 'harv', blurb: 'Unarmed. Earns 500 funds each turn it starts on dunes.' },
};
export const UNIT_ORDER = ['inf', 'scout', 'lancer', 'harv', 'recon', 'truck', 'tank', 'arty', 'flak', 'drone', 'heavy'];

// Base damage in percent (attacker row -> defender column). 0 = can't attack that unit.
const COLS = ['inf', 'lancer', 'scout', 'recon', 'tank', 'heavy', 'arty', 'flak', 'drone', 'truck', 'harv'];
const TABLE = {
  inf: [55, 45, 55, 12, 5, 1, 15, 5, 7, 14, 14],
  lancer: [65, 55, 65, 85, 55, 15, 70, 65, 9, 75, 75],
  scout: [50, 40, 55, 10, 4, 1, 12, 4, 6, 12, 12],
  recon: [70, 65, 70, 35, 6, 1, 45, 4, 10, 45, 45],
  tank: [75, 70, 75, 85, 55, 15, 70, 65, 10, 75, 75],
  heavy: [105, 95, 105, 105, 85, 55, 105, 105, 12, 105, 105],
  arty: [90, 85, 90, 80, 70, 45, 75, 75, 0, 80, 80],
  flak: [105, 105, 105, 60, 25, 10, 50, 45, 120, 50, 50],
  drone: [75, 65, 75, 55, 55, 25, 65, 25, 65, 60, 60],
  truck: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  harv: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};
export const DAMAGE = Object.fromEntries(Object.entries(TABLE).map(([a, row]) => [a, Object.fromEntries(COLS.map((d, i) => [d, row[i]]))]));

export const baseDamage = (att, def) => DAMAGE[att]?.[def] ?? 0;
export const isRanged = (type) => UNITS[type].range[1] > 1;
export const displayHp = (hp) => Math.max(0, Math.ceil(hp / 10));

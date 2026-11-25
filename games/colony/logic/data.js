// Everything Colony knows about the world: map size, time, terrain, items, buildings, creatures,
// traits and names. Plain data, no game state.

export const TILE = 8;
export const W = 48;
export const H = 64;
export const N = W * H;

// Time: one tick is a tenth of a second at 1x speed. An hour is 60 ticks, a day 1440 (2.4 min at 1x).
export const TPH = 60;
export const TPD = TPH * 24;
export const DAYS_PER_SEASON = 10;
export const DAYS_PER_YEAR = DAYS_PER_SEASON * 4;
export const WIN_DAYS = DAYS_PER_YEAR * 2; // survive two years
export const DAILY_DAYS = 15;
export const RESCUE_DAYS = 5; // after the radio call
export const RADIO_HOURS = 16; // settler-hours on the radio to reach help

export const SEASONS = [
  { id: 'sp', name: 'Spring', temp: 12, grow: true },
  { id: 'su', name: 'Summer', temp: 24, grow: true },
  { id: 'fa', name: 'Fall', temp: 8, grow: true },
  { id: 'wi', name: 'Winter', temp: -10, grow: false },
];

// Terrain
export const T = { GRASS: 0, DIRT: 1, WATER: 2, ROCK: 3, ORE: 4 };
// Plants
export const P = { NONE: 0, TREE: 1, PINE: 2, BUSH: 3, HERB: 4 };
export const PLANTS = {
  [P.TREE]: { name: 'Oak tree', item: 'wood', n: 9, work: 70, order: 'chop' },
  [P.PINE]: { name: 'Pine tree', item: 'wood', n: 8, work: 60, order: 'chop' },
  [P.BUSH]: { name: 'Berry bush', item: 'berries', n: 4, work: 20, order: 'harvest', regrow: 5 },
  [P.HERB]: { name: 'Wild herbs', item: 'herbs', n: 2, work: 20, order: 'harvest', regrow: 7 },
};
export const ROCKS = {
  [T.ROCK]: { name: 'Rock', item: 'stone', n: 5, work: 110 },
  [T.ORE]: { name: 'Iron ore', item: 'metal', n: 4, work: 140 },
};

// Zones
export const Z = { NONE: 0, STOCK: 1, FARM: 2 };
export const STACK_CAP = 40; // per stockpile tile

export const ITEMS = {
  wood: { name: 'Wood', value: 1, stack: 50 },
  stone: { name: 'Stone', value: 1, stack: 50 },
  metal: { name: 'Metal', value: 3, stack: 40 },
  berries: { name: 'Berries', value: 2, stack: 30, food: 'raw', nut: 0.5, rot: 6 },
  meat: { name: 'Meat', value: 2, stack: 30, food: 'raw', nut: 0.5, rot: 4 },
  crop: { name: 'Corn', value: 2, stack: 30, food: 'raw', nut: 0.5, rot: 14 },
  meal: { name: 'Meal', value: 4, stack: 20, food: 'meal', nut: 0.9, rot: 6 },
  herbs: { name: 'Herbs', value: 2, stack: 30 },
  medicine: { name: 'Medicine', value: 8, stack: 20 },
  leather: { name: 'Leather', value: 2, stack: 30 },
  tools: { name: 'Tools', value: 20, stack: 5, gear: 'tool' },
  spear: { name: 'Spear', value: 15, stack: 5, gear: 'weapon', dmg: 11, range: 1.5 },
  bow: { name: 'Bow', value: 15, stack: 5, gear: 'weapon', dmg: 8, range: 5 },
  club: { name: 'Club', value: 5, stack: 5, gear: 'weapon', dmg: 8, range: 1.5 },
  parka: { name: 'Parka', value: 15, stack: 5, gear: 'coat', warm: 22 },
};
export const FOODS = Object.keys(ITEMS).filter((k) => ITEMS[k].food);
export const RAW = FOODS.filter((k) => ITEMS[k].food === 'raw');

// Things made at the workbench.
export const RECIPES = {
  tools: { name: 'Tools', need: { wood: 3, metal: 3 }, work: 260, desc: 'Work 40% faster' },
  spear: { name: 'Spear', need: { wood: 4, metal: 2 }, work: 220, desc: 'Strong melee weapon' },
  bow: { name: 'Bow', need: { wood: 6 }, work: 220, desc: 'Shoots from 5 tiles' },
  parka: { name: 'Parka', need: { leather: 6 }, work: 220, desc: 'Keeps out the cold' },
  medicine: { name: 'Medicine', need: { herbs: 3 }, work: 140, desc: 'Better healing' },
};

export const BUILDS = {
  wall: { name: 'Wood wall', cost: { wood: 3 }, work: 50, hp: 150, block: true, flam: true, line: true, desc: 'Blocks raiders and animals. Burns.' },
  swall: { name: 'Stone wall', cost: { stone: 3 }, work: 90, hp: 320, block: true, line: true, desc: 'Tough, fireproof wall.' },
  door: { name: 'Door', cost: { wood: 4 }, work: 70, hp: 120, door: true, flam: true, desc: 'Settlers pass, raiders must break it.' },
  bed: { name: 'Bed', cost: { wood: 6 }, work: 110, hp: 80, flam: true, desc: 'Sleep well. One per settler.' },
  campfire: { name: 'Campfire', cost: { wood: 5 }, work: 40, hp: 60, cook: 45, heat: 3, fuel: 5, desc: 'Cook meals and keep warm. Burns wood.' },
  stove: { name: 'Stove', cost: { stone: 8, metal: 4 }, work: 180, hp: 150, cook: 22, heat: 3, fuel: 10, req: 'campfire', desc: 'Cooks twice as fast, uses less wood.' },
  workbench: { name: 'Workbench', cost: { wood: 12 }, work: 180, hp: 100, flam: true, desc: 'Craft tools, weapons, parkas, medicine.' },
  storage: { name: 'Storage', cost: { wood: 10 }, work: 110, hp: 100, flam: true, desc: 'Holds 80 items. Food never rots here.' },
  radio: { name: 'Radio', cost: { metal: 30, stone: 15, wood: 10 }, work: 500, hp: 120, req: 'workbench', desc: 'Call for rescue and win.' },
};
export const FUEL_MAX = 10;

export const SKILLS = ['build', 'farm', 'cook', 'craft', 'fight', 'heal'];
export const SKILL_NAMES = { build: 'Build', farm: 'Farm', cook: 'Cook', craft: 'Craft', fight: 'Fight', heal: 'Heal' };

// Kinds of work, in the order settlers consider them. Settlers can be told to skip any of them.
export const WORK = [
  { id: 'heal', name: 'Doctor', skill: 'heal' },
  { id: 'fire', name: 'Firefight', skill: null },
  { id: 'cook', name: 'Cook', skill: 'cook' },
  { id: 'hunt', name: 'Hunt', skill: 'fight' },
  { id: 'build', name: 'Build', skill: 'build' },
  { id: 'farm', name: 'Farm', skill: 'farm' },
  { id: 'chop', name: 'Chop and harvest', skill: null },
  { id: 'mine', name: 'Mine', skill: null },
  { id: 'craft', name: 'Craft', skill: 'craft' },
  { id: 'haul', name: 'Haul', skill: null },
];

export const TRAITS = {
  hardworker: { name: 'Hard worker', desc: 'Works 20% faster.' },
  lazy: { name: 'Lazy', desc: 'Works 20% slower but is easier to please.' },
  optimist: { name: 'Optimist', desc: 'Always in a better mood.' },
  pessimist: { name: 'Pessimist', desc: 'Always in a worse mood.' },
  tough: { name: 'Tough', desc: 'Takes less damage.' },
  wimp: { name: 'Wimp', desc: 'Will not fight unless cornered.' },
  brave: { name: 'Brave', desc: 'Fights even without a weapon. Hits more often.' },
  glutton: { name: 'Glutton', desc: 'Gets hungry faster. Loves a hot meal.' },
  fast: { name: 'Quick', desc: 'Walks 20% faster.' },
  slow: { name: 'Slow', desc: 'Walks 15% slower.' },
  ironstomach: { name: 'Iron stomach', desc: 'Raw food is fine, never gets food poisoning.' },
  coldproof: { name: 'Hardy', desc: 'Copes with 10 degrees more cold.' },
  kind: { name: 'Kind', desc: 'Makes friends easily.' },
  abrasive: { name: 'Abrasive', desc: 'Rubs people the wrong way.' },
  greenthumb: { name: 'Green thumb', desc: 'Farms 40% faster.' },
  nightowl: { name: 'Night owl', desc: 'Needs less sleep.' },
};
export const CLASH = [['hardworker', 'lazy'], ['optimist', 'pessimist'], ['tough', 'wimp'], ['wimp', 'brave'], ['fast', 'slow'], ['kind', 'abrasive']];

export const NAMES = [
  'Ada', 'Bram', 'Cora', 'Dag', 'Elin', 'Finn', 'Greta', 'Hal', 'Ida', 'Jory', 'Kit', 'Lena', 'Milo', 'Nell', 'Otto', 'Pip',
  'Quill', 'Rosa', 'Sven', 'Tess', 'Ulla', 'Vik', 'Wren', 'Yara', 'Zed', 'Anya', 'Boris', 'Clem', 'Dina', 'Emil', 'Fern', 'Gus',
  'Hazel', 'Ivo', 'June', 'Karl', 'Lilo', 'Mara', 'Nico', 'Olga', 'Pell', 'Rhea', 'Saul', 'Tilda', 'Uri', 'Vera', 'Wil', 'Xan',
  'Yuri', 'Zora', 'Arlo', 'Bea', 'Cass', 'Dex', 'Edda', 'Flint', 'Gwen', 'Hugo', 'Iris', 'Jonas', 'Kara', 'Lars', 'Moss', 'Nora',
];
export const LOOKS = 15; // settler sprite rows c1..c15
export const RAIDER_LOOKS = [6, 9, 13, 14];

export const ANIMALS = {
  hen: { name: 'Wild hen', hp: 20, meat: 3, leather: 0, speed: 0.07, fierce: 0, sprite: 'a:hen' },
  duck: { name: 'Duck', hp: 20, meat: 3, leather: 0, speed: 0.07, fierce: 0, sprite: 'a:duck' },
  goose: { name: 'Goose', hp: 30, meat: 4, leather: 1, speed: 0.07, fierce: 0.1, dmg: 3, sprite: 'a:goose' },
  sheep: { name: 'Wild sheep', hp: 45, meat: 7, leather: 5, speed: 0.07, fierce: 0, sprite: 'a:sheep' },
  boar: { name: 'Boar', hp: 65, meat: 9, leather: 4, speed: 0.1, fierce: 0.6, dmg: 7, sprite: 'a:boar' },
  fox: { name: 'Fox', hp: 30, meat: 3, leather: 3, speed: 0.12, fierce: 0.25, dmg: 5, sprite: 'a:fox' },
  wolf: { name: 'Wolf', hp: 45, meat: 5, leather: 4, speed: 0.17, fierce: 1, dmg: 7, sprite: 'e12' },
};
export const GAME_ANIMALS = ['hen', 'duck', 'goose', 'sheep', 'sheep', 'boar', 'fox'];

export const MODES = {
  standard: { name: 'Standard', desc: 'Raids, wild animals, sickness and fire.' },
  peaceful: { name: 'Peaceful', desc: 'No raids or wolf packs. Gentler sickness and fires.' },
  daily: { name: 'Daily', desc: 'Same map and start for everyone today.' },
};

// Value of everything the colony owns (the daily score).
export function buildValue(k) {
  const c = BUILDS[k]?.cost || {};
  return Object.entries(c).reduce((a, [i, n]) => a + ITEMS[i].value * n, 0);
}

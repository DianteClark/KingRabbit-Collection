// Hearth Valley data: items, crops, fish, villagers, recipes, shops and the community board.
// Pure data, no Phaser, so the node tests and bots can use it.

export const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'];
export const SEASON_SHORT = ['Spr', 'Sum', 'Fall', 'Win'];
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const SEASON_DAYS = 28;
export const DAY_START = 6 * 60; // 6:00
export const MIDNIGHT = 24 * 60;
export const DAY_END = 26 * 60; // 2:00 the next morning: you pass out
export const MAX_ENERGY = 140;
export const MAX_HP = 60;

// Tools: level 0 basic, 1 copper, 2 iron.
export const TOOLS = ['hoe', 'can', 'axe', 'pick', 'sword', 'rod'];
export const TOOL_INFO = {
  hoe: { name: 'Hoe', energy: 2, icon: 't_hoe', tip: 'Till grass into soil' },
  can: { name: 'Watering Can', energy: 1, icon: 't_can', tip: 'Water soil. Refill at water' },
  axe: { name: 'Axe', energy: 2, icon: 't_axe', tip: 'Chop twigs, stumps and trees' },
  pick: { name: 'Pickaxe', energy: 2, icon: 't_pick', tip: 'Break rocks and ore' },
  sword: { name: 'Scythe-Sword', energy: 0, icon: 'i_sword', tip: 'Cut weeds and grass, fight slimes' },
  rod: { name: 'Fishing Rod', energy: 4, icon: 't_rod', tip: 'Cast into water to fish' },
};
export const TOOL_LEVELS = ['', 'Copper ', 'Iron '];
export const CAN_SIZE = [30, 50, 80];
export const UPGRADE_COST = [null, { gold: 800, bar: 'copperbar', n: 3 }, { gold: 2000, bar: 'ironbar', n: 3 }];

// ---------------------------------------------------------------- crops
// days to grow, regrow (days to fruit again after a harvest), seasons, seed price, yield
export const CROPS = {
  radish: { name: 'Radish', seasons: [0], days: 4, seed: 20, yield: 1 },
  potato: { name: 'Potato', seasons: [0], days: 6, seed: 40, yield: 1 },
  cabbage: { name: 'Cabbage', seasons: [0], days: 9, seed: 70, yield: 1 },
  strawberry: { name: 'Strawberry', seasons: [0], days: 8, regrow: 4, seed: 90, yield: 1 },
  tomato: { name: 'Tomato', seasons: [1], days: 8, regrow: 4, seed: 50, yield: 1 },
  blueberry: { name: 'Blueberry', seasons: [1], days: 10, regrow: 4, seed: 80, yield: 3 },
  melon: { name: 'Melon', seasons: [1], days: 11, seed: 80, yield: 1 },
  corn: { name: 'Corn', seasons: [1, 2], days: 11, regrow: 4, seed: 120, yield: 1, tall: true },
  wheat: { name: 'Wheat', seasons: [1, 2], days: 4, seed: 10, yield: 1 },
  pumpkin: { name: 'Pumpkin', seasons: [2], days: 11, seed: 100, yield: 1 },
  yam: { name: 'Yam', seasons: [2], days: 7, seed: 60, yield: 1 },
  cranberry: { name: 'Cranberry', seasons: [2], days: 7, regrow: 5, seed: 200, yield: 2 },
};

// ---------------------------------------------------------------- items
// kind: crop forage fish animal artisan mineral gem resource food seed tool-ish placeable
// price: what the shipping bin pays. energy: eating restores this much (hp half of it).
const I = {};
const add = (id, o) => { I[id] = { id, icon: `i_${id}`, price: 0, ...o }; };

add('radish', { name: 'Radish', kind: 'crop', price: 35, energy: 20 });
add('potato', { name: 'Potato', kind: 'crop', price: 80, energy: 25 });
add('cabbage', { name: 'Cabbage', kind: 'crop', price: 175, energy: 40 });
add('strawberry', { name: 'Strawberry', kind: 'crop', price: 120, energy: 30 });
add('tomato', { name: 'Tomato', kind: 'crop', price: 60, energy: 20 });
add('blueberry', { name: 'Blueberry', kind: 'crop', price: 50, energy: 15 });
add('melon', { name: 'Melon', kind: 'crop', price: 250, energy: 50 });
add('corn', { name: 'Corn', kind: 'crop', price: 50, energy: 20 });
add('wheat', { name: 'Wheat', kind: 'crop', price: 25 });
add('pumpkin', { name: 'Pumpkin', kind: 'crop', price: 320 });
add('yam', { name: 'Yam', kind: 'crop', price: 160, energy: 35 });
add('cranberry', { name: 'Cranberry', kind: 'crop', price: 75, energy: 15 });

add('leek', { name: 'Wild Leek', kind: 'forage', price: 60, energy: 20 });
add('daffodil', { name: 'Daffodil', kind: 'forage', price: 30 });
add('morel', { name: 'Morel', kind: 'forage', price: 90, energy: 20 });
add('salmonberry', { name: 'Salmonberry', kind: 'forage', price: 20, energy: 15 });
add('sunbloom', { name: 'Sunbloom', kind: 'forage', price: 80 });
add('apple', { name: 'Wild Apple', kind: 'forage', price: 70, energy: 25 });
add('clover', { name: 'Lucky Clover', kind: 'forage', price: 150 });
add('hazelnut', { name: 'Hazelnut', kind: 'forage', price: 90, energy: 20 });
add('blackberry', { name: 'Blackberry', kind: 'forage', price: 25, energy: 15 });
add('snowroot', { name: 'Snow Root', kind: 'forage', price: 70, energy: 20 });
add('holly', { name: 'Holly', kind: 'forage', price: 80 });
add('snowdrop', { name: 'Snowdrop', kind: 'forage', price: 60 });
add('feather', { name: 'Feather', kind: 'forage', price: 40 });

add('perch', { name: 'Pond Perch', kind: 'fish', price: 40, energy: 15 });
add('carp', { name: 'Mud Carp', kind: 'fish', price: 30, energy: 10 });
add('sunfish', { name: 'Sunfish', kind: 'fish', price: 45, energy: 15 });
add('trout', { name: 'Rainbow Trout', kind: 'fish', price: 75, energy: 20 });
add('dace', { name: 'Silver Dace', kind: 'fish', price: 50, energy: 15 });
add('pike', { name: 'Pike', kind: 'fish', price: 110, energy: 25 });
add('bass', { name: 'Lake Bass', kind: 'fish', price: 80, energy: 20 });
add('eel', { name: 'Moon Eel', kind: 'fish', price: 140, energy: 25 });
add('koi', { name: 'Golden Koi', kind: 'fish', price: 220 });
add('icepip', { name: 'Ice Pip', kind: 'fish', price: 90, energy: 20 });
add('whiskers', { name: 'Old Whiskers', kind: 'fish', price: 1000 });

add('egg', { name: 'Egg', kind: 'animal', price: 50, energy: 20 });
add('milk', { name: 'Milk', kind: 'animal', price: 125, energy: 30 });
add('mayo', { name: 'Mayonnaise', kind: 'artisan', price: 190 });
add('cheese', { name: 'Cheese', kind: 'artisan', price: 230, energy: 50 });

add('wood', { name: 'Wood', kind: 'resource', price: 2 });
add('stone', { name: 'Stone', kind: 'resource', price: 2 });
add('fiber', { name: 'Fiber', kind: 'resource', price: 1 });
add('hay', { name: 'Hay', kind: 'resource', price: 5 });
add('slime', { name: 'Slime', kind: 'resource', price: 5 });
add('copperore', { name: 'Copper Ore', kind: 'mineral', price: 5 });
add('ironore', { name: 'Iron Ore', kind: 'mineral', price: 10 });
add('goldore', { name: 'Gold Ore', kind: 'mineral', price: 25 });
add('copperbar', { name: 'Copper Bar', kind: 'mineral', price: 60 });
add('ironbar', { name: 'Iron Bar', kind: 'mineral', price: 120 });
add('goldbar', { name: 'Gold Bar', kind: 'mineral', price: 250 });
add('jade', { name: 'Jade', kind: 'gem', price: 100 });
add('aquamarine', { name: 'Aquamarine', kind: 'gem', price: 180 });
add('ruby', { name: 'Ruby', kind: 'gem', price: 250 });
add('diamond', { name: 'Diamond', kind: 'gem', price: 750 });

add('snack', { name: 'Field Snack', kind: 'food', price: 40, energy: 60 });
add('salad', { name: 'Garden Salad', kind: 'food', price: 50, energy: 50, icon: 'i_cabbage' });
add('bait', { name: 'Bait', kind: 'tackle', price: 1 });
add('compost', { name: 'Compost', kind: 'fertilizer', price: 5 });
add('sprinkler', { name: 'Sprinkler', kind: 'place', price: 50, icon: 'o_sprinkler' });
add('qsprinkler', { name: 'Quality Sprinkler', kind: 'place', price: 150, icon: 'o_qsprinkler' });
add('furnace', { name: 'Furnace', kind: 'place', price: 0, icon: 'o_furnace' });
add('mayojar', { name: 'Mayo Jar', kind: 'place', price: 0, icon: 'o_mayojar' });
add('press', { name: 'Cheese Press', kind: 'place', price: 0, icon: 'o_press' });
add('staircase', { name: 'Staircase', kind: 'stair', price: 0, icon: 'o_stair' });

for (const [id, c] of Object.entries(CROPS)) {
  add(`seed_${id}`, { name: `${c.name} Seeds`, kind: 'seed', crop: id, price: Math.floor(c.seed / 2), icon: `s_${id}` });
}
export const ITEMS = I;
export const itemName = (id, n = 1) => (n > 1 ? `${ITEMS[id]?.name || id} x${n}` : ITEMS[id]?.name || id);

// ---------------------------------------------------------------- forage by map and season
export const FORAGE = {
  woods: [['leek', 'daffodil', 'morel', 'salmonberry'], ['sunbloom', 'apple', 'salmonberry', 'clover'], ['hazelnut', 'blackberry', 'morel', 'apple'], ['snowroot', 'holly', 'snowdrop', 'feather']],
  farm: [['leek', 'daffodil'], ['sunbloom', 'apple'], ['hazelnut', 'blackberry'], ['snowroot', 'holly']],
  town: [['daffodil'], ['sunbloom'], ['blackberry'], ['holly']],
};

// ---------------------------------------------------------------- fish
// where: pond (farm), river (town), lake (woods). hours [from, to) in minutes. diff 1-10.
export const FISH = {
  perch: { where: ['pond', 'lake'], seasons: [0, 1, 2, 3], diff: 2 },
  carp: { where: ['pond'], seasons: [0, 1, 2], diff: 1 },
  sunfish: { where: ['pond', 'river'], seasons: [0, 1], hours: [360, 1140], weather: 'sun', diff: 3 },
  trout: { where: ['river'], seasons: [1, 2], diff: 4 },
  dace: { where: ['river'], seasons: [0, 1, 2, 3], diff: 3 },
  pike: { where: ['river', 'lake'], seasons: [2, 3], diff: 6 },
  bass: { where: ['lake'], seasons: [0, 1, 2, 3], diff: 4 },
  eel: { where: ['river', 'lake'], seasons: [0, 2], hours: [960, 1560], diff: 7 },
  koi: { where: ['lake'], seasons: [1], diff: 8, rare: true },
  icepip: { where: ['lake', 'river', 'pond'], seasons: [3], diff: 5 },
  whiskers: { where: ['lake'], seasons: [0, 1, 2, 3], weather: 'rain', diff: 9, legendary: true },
};
export const FISH_ORDER = Object.keys(FISH);

// ---------------------------------------------------------------- animals
export const ANIMALS = {
  chicken: { name: 'Chicken', price: 400, product: 'egg', home: 'coop', cap: 4, frames: ['chicken0', 'chicken1'] },
  cow: { name: 'Cow', price: 1200, product: 'milk', home: 'barn', cap: 3, frames: ['cow0', 'cow1'] },
};
export const ANIMAL_NAMES = ['Clucky', 'Pebble', 'Maple', 'Biscuit', 'Daisy', 'Butter', 'Nutmeg', 'Clover', 'Waffles', 'Poppy', 'Hazel', 'Mocha'];

// ---------------------------------------------------------------- machines and recipes
export const MACHINES = {
  furnace: { name: 'Furnace', icon: 'o_furnaceOff', busyIcon: 'o_furnace', jobs: [
    { in: 'copperore', n: 5, out: 'copperbar', mins: 60 },
    { in: 'ironore', n: 5, out: 'ironbar', mins: 90 },
    { in: 'goldore', n: 5, out: 'goldbar', mins: 120 },
  ] },
  mayojar: { name: 'Mayo Jar', icon: 'o_mayojar', busyIcon: 'o_mayojar', jobs: [{ in: 'egg', n: 1, out: 'mayo', mins: 180 }] },
  press: { name: 'Cheese Press', icon: 'o_press', busyIcon: 'o_press', jobs: [{ in: 'milk', n: 1, out: 'cheese', mins: 200 }] },
};

export const RECIPES = {
  compost: { name: 'Compost', needs: { fiber: 3, wood: 1 }, makes: 2, tip: 'Spread on soil before planting: crops grow faster' },
  bait: { name: 'Bait', needs: { fiber: 2, slime: 1 }, makes: 5, tip: 'Fish bite much sooner' },
  snack: { name: 'Field Snack', needs: { fiber: 2, hazelnut: 1 }, alt: { fiber: 2, salmonberry: 2 }, makes: 1, tip: 'Restores 60 energy' },
  furnace: { name: 'Furnace', needs: { stone: 20, copperore: 5 }, makes: 1, tip: 'Smelts 5 ore into a bar' },
  staircase: { name: 'Staircase', needs: { stone: 25 }, makes: 1, tip: 'Use in the mine to go straight down a floor' },
  sprinkler: { name: 'Sprinkler', needs: { copperbar: 1, ironbar: 1 }, makes: 1, tip: 'Waters the 4 tiles beside it every morning' },
  qsprinkler: { name: 'Quality Sprinkler', needs: { ironbar: 1, goldbar: 1 }, makes: 1, tip: 'Waters all 8 tiles around it every morning' },
  mayojar: { name: 'Mayo Jar', needs: { wood: 15, stone: 15, copperbar: 1 }, makes: 1, tip: 'Turns an egg into mayonnaise' },
  press: { name: 'Cheese Press', needs: { wood: 25, stone: 25, copperbar: 2 }, makes: 1, tip: 'Turns milk into cheese' },
};
export const RECIPE_ORDER = Object.keys(RECIPES);
export const START_RECIPES = ['compost', 'bait', 'snack', 'staircase'];

// ---------------------------------------------------------------- shops
export const SHOPS = {
  market: {
    name: "Tess's Market", owner: 'tess', open: [540, 1080], closed: 2, // closed Wednesdays
    stock: (s) => [
      ...Object.entries(CROPS).filter(([, c]) => c.seasons.includes(s.season)).map(([id, c]) => ({ id: `seed_${id}`, price: c.seed })),
      { id: 'compost', price: 30 }, { id: 'salad', price: 120 }, { id: 'bait', price: 5 },
    ],
  },
  forge: {
    name: "Bram's Forge", owner: 'bram', open: [540, 960], closed: 6,
    stock: () => [{ id: 'copperore', price: 75 }, { id: 'ironore', price: 150 }, { id: 'stone', price: 10 }, { id: 'wood', price: 10 }],
    upgrades: true,
  },
  ranch: {
    name: "Wren's Ranch", owner: 'wren', open: [480, 960], closed: 1,
    stock: () => [{ id: 'hay', price: 50 }],
    animals: true,
  },
};

// ---------------------------------------------------------------- villagers
// spot: [map, x, y] by time of day (from minute). The first entry whose time has passed is used.
export const VILLAGERS = {
  bram: {
    name: 'Bram', row: 0, job: 'the blacksmith', birthday: [1, 6],
    loves: ['goldbar', 'ruby', 'cheese'], likes: ['copperbar', 'ironbar', 'ironore', 'goldore', 'corn', 'pumpkin'], hates: ['daffodil', 'holly', 'snowdrop'],
    spots: [[480, 'town', 19, 7], [1020, 'town', 14, 10], [1260, null]],
  },
  tess: {
    name: 'Tess', row: 1, job: 'who runs the market', birthday: [0, 20],
    loves: ['strawberry', 'melon', 'sunbloom'], likes: ['daffodil', 'egg', 'mayo', 'blueberry', 'apple'], hates: ['slime', 'stone', 'hay'],
    spots: [[540, 'town', 5, 7], [1080, 'town', 10, 9], [1260, null]],
  },
  alder: {
    name: 'Mayor Alder', row: 2, job: 'the mayor', birthday: [2, 9],
    loves: ['pumpkin', 'cheese', 'koi'], likes: ['mayo', 'potato', 'cabbage', 'yam', 'snowroot'], hates: ['slime', 'fiber', 'hay'],
    spots: [[480, 'town', 11, 6], [720, 'town', 13, 9], [960, 'town', 11, 6], [1200, null]],
  },
  wren: {
    name: 'Granny Wren', row: 3, job: 'who keeps the ranch', birthday: [3, 14],
    loves: ['cranberry', 'holly', 'blackberry'], likes: ['egg', 'milk', 'wheat', 'apple', 'hazelnut'], hates: ['eel', 'slime', 'copperore'],
    spots: [[420, 'town', 7, 14], [840, 'town', 8, 11], [1140, 'town', 7, 14], [1200, null]],
  },
  pip: {
    name: 'Pip', row: 4, job: 'the busiest kid in town', birthday: [1, 22],
    loves: ['slime', 'blueberry', 'feather'], likes: ['salmonberry', 'apple', 'sunbloom', 'egg', 'jade'], hates: ['cabbage', 'radish', 'leek'],
    spots: [[540, 'town', 16, 15], [780, 'woods', 7, 12], [1020, 'town', 12, 11], [1200, null]],
  },
  mira: {
    name: 'Mira', row: 5, job: 'the best angler in the valley', birthday: [0, 9],
    loves: ['trout', 'diamond', 'aquamarine'], likes: ['perch', 'bass', 'pike', 'dace', 'jade', 'bait'], hates: ['hay', 'potato', 'stone'],
    spots: [[360, 'town', 8, 18], [720, 'woods', 13, 14], [1080, 'town', 15, 18], [1320, null]],
  },
};
export const VILLAGER_ORDER = Object.keys(VILLAGERS);
export const HEART_PTS = 100;
export const MAX_HEARTS = 8;

// ---------------------------------------------------------------- community board
export const BUNDLES = [
  { id: 'spring', name: 'Spring Crops', needs: { radish: 1, potato: 1, cabbage: 1, strawberry: 1 }, reward: { sprinkler: 3 }, rewardText: '3 Sprinklers' },
  { id: 'summer', name: 'Summer Crops', needs: { tomato: 1, blueberry: 1, melon: 1, corn: 1 }, reward: { qsprinkler: 2 }, rewardText: '2 Quality Sprinklers' },
  { id: 'fall', name: 'Fall Crops', needs: { pumpkin: 1, yam: 1, cranberry: 1, wheat: 5 }, reward: { gold: 1000 }, rewardText: '1,000g' },
  { id: 'forage', name: "Forager's", needs: { daffodil: 1, sunbloom: 1, hazelnut: 1, holly: 1 }, reward: { snack: 5 }, rewardText: '5 Field Snacks' },
  { id: 'angler', name: "Angler's", needs: { perch: 1, dace: 1, bass: 1, pike: 1 }, reward: { bait: 30 }, rewardText: '30 Bait' },
  { id: 'miner', name: "Miner's", needs: { copperbar: 2, ironbar: 2, goldbar: 1, jade: 1 }, reward: { gold: 1500 }, rewardText: '1,500g' },
  { id: 'rancher', name: "Rancher's", needs: { egg: 5, milk: 3, cheese: 1 }, reward: { hay: 30 }, rewardText: '30 Hay' },
  { id: 'vault', name: 'Town Vault', needs: { gold: 2500 }, reward: { compost: 20 }, rewardText: '20 Compost' },
];

// ---------------------------------------------------------------- festivals
export const FESTIVALS = [
  { season: 0, day: 13, id: 'egghunt', name: 'Egg Hunt', blurb: 'Find the painted eggs hidden around town before the bell rings!' },
  { season: 1, day: 11, id: 'derby', name: 'River Derby', blurb: 'Catch as many fish as you can from the river in 90 seconds.' },
  { season: 2, day: 16, id: 'fair', name: 'Harvest Fair', blurb: 'Show off your finest goods. The mayor judges the best display.' },
  { season: 3, day: 25, id: 'star', name: 'Winter Star', blurb: 'Swap gifts with a secret friend under the lanterns.' },
];
export const FESTIVAL_HOURS = [540, 840];

// ---------------------------------------------------------------- trophies
export const TROPHIES = [
  { id: 'first-harvest', name: 'First Harvest', desc: 'Harvest your first crop', tier: 'bronze' },
  { id: 'first-fish', name: 'Nibble', desc: 'Catch your first fish', tier: 'bronze' },
  { id: 'rancher', name: 'Fresh Eggs', desc: 'Collect a product from your animals', tier: 'bronze' },
  { id: 'friend', name: 'Neighbourly', desc: 'Reach 2 hearts with a villager', tier: 'bronze' },
  { id: 'bundle', name: 'Helping Hand', desc: 'Complete a community bundle', tier: 'bronze' },
  { id: 'festival', name: 'Blue Ribbon', desc: 'Win a festival prize', tier: 'bronze' },
  { id: 'best-friend', name: 'Kindred Spirit', desc: 'Reach 6 hearts with a villager', tier: 'silver' },
  { id: 'miner', name: 'Deep Digger', desc: 'Reach floor 10 of the mine', tier: 'silver' },
  { id: 'angler', name: 'Angler', desc: 'Catch 8 different kinds of fish', tier: 'silver' },
  { id: 'rich', name: 'Prosperous', desc: 'Earn 10,000g from the shipping bin', tier: 'silver' },
  { id: 'deep', name: 'Mine Floor 20', desc: 'Reach the bottom of the mine', tier: 'gold' },
  { id: 'hall', name: 'Hearth Restored', desc: 'Restore the old town hall', tier: 'gold' },
  { id: 'hall-y1', name: 'In One Year', desc: 'Restore the town hall within year one', tier: 'gold' },
  { id: 'whiskers', name: 'Old Whiskers', desc: 'Land the legendary lake fish', tier: 'gold', secret: true },
  { id: 'night-owl', name: 'Night Owl', desc: 'Stay out until 2am', tier: 'bronze', secret: true },
];

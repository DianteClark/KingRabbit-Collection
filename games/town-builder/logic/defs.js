// Tiny Town Builder: every number the simulation uses, in one place. Pure data, no Phaser.

export const TILE = 16; // pixels per map tile (the Tiny Tile Town grid)
export const MAP_W = 48;
export const MAP_H = 48;
export const WEEKS_PER_MONTH = 4;

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Terrain codes stored in the map string.
export const T = { GRASS: 'g', WATER: 'w', TREE: 't', RUBBLE: 'x' };

export const ZONE_INFO = {
  R: { name: 'Residential', short: 'Homes', color: 0x6ec05a, css: '#6ec05a', cost: 5 },
  C: { name: 'Commercial', short: 'Shops', color: 0x5aa0e6, css: '#5aa0e6', cost: 6 },
  I: { name: 'Industrial', short: 'Industry', color: 0xe3c045, css: '#e3c045', cost: 6 },
  F: { name: 'Farm', short: 'Farms', color: 0xc08848, css: '#c08848', cost: 3 },
};

// Population milestones. Each one unlocks tools (see unlock below) and bigger zone buildings.
export const MILESTONES = [
  { id: 0, name: 'Hamlet', pop: 0 },
  { id: 1, name: 'Village', pop: 250 },
  { id: 2, name: 'Town', pop: 1200 },
  { id: 3, name: 'City', pop: 3500 },
  { id: 4, name: 'Metropolis', pop: 7500 },
];
// Biggest zone building tier allowed at each milestone.
export const MAX_TIER = [2, 2, 3, 4, 4];

/**
 * Buildings that grow on zones, by zone and tier. Each entry: [frame, pop or jobs].
 * Footprint comes from the frame (16 px per tile). Tier 1 is always a single tile.
 */
export const GROW = {
  R: {
    1: ['res:0', 'res:1', 'res:2', 'res:11', 'res:12', 'res:13', 'res:22', 'res:23', 'res:24', 'res:28', 'res:29', 'res:30', 'res:38', 'res:39', 'res:40', 'res:43', 'res:44', 'res:45', 'res:53', 'res:54', 'res:55'].map((f) => [f, 8]),
    2: [...['res:41', 'res:42', 'res:51', 'res:52', 'res:70', 'res:71', 'res:72'].map((f) => [f, 30]),
      ...['res:46', 'res:47', 'res:48', 'res:49', 'res:50', 'res:56', 'res:57', 'res:58', 'res:59', 'res:60', 'res:61', 'res:62', 'res:63', 'res:64'].map((f) => [f, 44])],
    3: ['res:6', 'res:7', 'res:8', 'res:9', 'res:10', 'res:17', 'res:18', 'res:19', 'res:20', 'res:21', 'res:65', 'res:66', 'res:67', 'res:68', 'res:69', 'res:73'].map((f) => [f, 100]),
    4: [['res:36', 200], ['res:34', 300], ['res:35', 300], ['res:37', 300]],
  },
  C: {
    1: ['com:0', 'com:1', 'com:2', 'com:3', 'com:4', 'com:5', 'com:6', 'com:7', 'com:8', 'com:9', 'com:10', 'com:11', 'com:41', 'com:42', 'com:43', 'com:44'].map((f) => [f, 4]),
    2: [...['com:12', 'com:13', 'com:14', 'com:15', 'com:16', 'com:17', 'com:18', 'com:33', 'com:37', 'com:38', 'com:39', 'com:50', 'com:52', 'com:53', 'com:54', 'com:55', 'com:56', 'com:57', 'com:58'].map((f) => [f, 20]),
      ...['com:27', 'com:28', 'com:29', 'com:30', 'com:31', 'com:49'].map((f) => [f, 10])],
    3: [...['com:19', 'com:32', 'com:36', 'com:40', 'com:51', 'com:59', 'com:20', 'com:21', 'com:26', 'com:48'].map((f) => [f, 60]),
      ...['com:22', 'com:23', 'com:24', 'com:25', 'com:46', 'com:47'].map((f) => [f, 110])],
    4: [],
  },
  I: {
    1: ['ind:0', 'ind:1', 'ind:2', 'ind:3', 'ind:4', 'ind:5', 'ind:6', 'ind:7', 'ind:8', 'ind:9', 'ind:10', 'ind:11', 'ind:12'].map((f) => [f, 5]),
    2: [...['ind:13', 'ind:15', 'ind:16', 'ind:17', 'ind:19', 'ind:20', 'ind:21', 'ind:23', 'ind:24', 'ind:25', 'ind:26', 'ind:28', 'ind:29', 'ind:30', 'ind:38', 'ind:39', 'ind:41', 'ind:49', 'ind:55'].map((f) => [f, 22]),
      ...['ind:18', 'ind:22', 'ind:31', 'ind:36'].map((f) => [f, 10])],
    3: [...['ind:27', 'ind:46', 'ind:47'].map((f) => [f, 55]), ...['ind:45', 'ind:48', 'ind:50', 'ind:51', 'ind:53', 'ind:60'].map((f) => [f, 75]), ['ind:52', 55],
      ...['ind:56', 'ind:57', 'ind:58', 'ind:61'].map((f) => [f, 100])],
    4: [],
  },
  // Farms: fields and farmsteads, on 2x2 or 3x3 lots. Jobs are farm jobs (count as industry, no smoke).
  F: {
    1: [],
    2: [...['farm:1', 'farm:2', 'farm:3', 'farm:4', 'farm:5', 'farm:6', 'farm:9', 'farm:10', 'farm:11', 'farm:12', 'farm:13'].map((f) => [f, 2]), ['farm:0', 4], ['farm:7', 4], ['farm:8', 4]],
    3: [...['farm:20', 'farm:21', 'farm:22', 'farm:23', 'farm:24', 'farm:25', 'farm:27', 'farm:28', 'farm:29', 'farm:30', 'farm:31', 'farm:33', 'farm:34', 'farm:35', 'farm:36', 'farm:37', 'farm:38', 'farm:39', 'farm:40', 'farm:41', 'farm:42', 'farm:43'].map((f) => [f, 5]),
      ...['farm:14', 'farm:15', 'farm:16', 'farm:17', 'farm:18', 'farm:19', 'farm:26', 'farm:32'].map((f) => [f, 9])],
    4: [],
  },
};

// Empty residential lots (a little path and mailbox) shown on zoned land before a house grows.
export const EMPTY_LOT = ['res:3', 'res:4', 'res:5', 'res:14', 'res:15', 'res:16', 'res:25', 'res:26', 'res:27', 'res:31', 'res:32', 'res:33'];
export const TREES = 5; // tree variants drawn on forest tiles

/**
 * Buildings you place yourself. cat = toolbar tray. unlock = milestone index.
 * power: supply (+). svc: coverage kind with radius r. upkeep is monthly at 100% funding.
 */
export const PLACE = {
  // Utilities
  wind: { name: 'Wind Turbine', cat: 'util', frames: ['ind:32', 'ind:33', 'ind:34', 'ind:35'], cost: 400, upkeep: 6, power: 50, fund: 'power', unlock: 0, desc: 'Clean power for about 200 people.' },
  coal: { name: 'Coal Plant', cat: 'util', frames: ['ind:44'], cost: 3000, upkeep: 45, power: 450, smoke: 70, smokeR: 8, fund: 'power', unlock: 0, dirty: true, desc: 'Power for 2,000 people. Smoky!' },
  solar: { name: 'Solar Farm', cat: 'util', frames: ['ind:40'], cost: 1800, upkeep: 15, power: 140, fund: 'power', unlock: 1, desc: 'Clean power for about 600 people.' },
  nuclear: { name: 'Nuclear Plant', cat: 'util', frames: ['ind:43'], cost: 12000, upkeep: 160, power: 2000, fund: 'power', unlock: 3, dirty: true, desc: 'Huge power, no smoke.' },
  wtower: { name: 'Water Tower', cat: 'util', frames: ['ind:14'], cost: 350, upkeep: 5, svc: 'water', r: 7, fund: 'power', unlock: 0, desc: 'Waters land nearby. Needs power.' },
  pump: { name: 'Water Works', cat: 'util', frames: ['ind:42'], cost: 1600, upkeep: 30, svc: 'water', r: 14, fund: 'power', unlock: 2, desc: 'Waters a whole district.' },
  // Services
  police: { name: 'Police Station', cat: 'svc', frames: ['police:1'], cost: 900, upkeep: 20, svc: 'police', r: 10, fund: 'police', unlock: 0, desc: 'Cuts crime. Chases off UFOs.' },
  fire: { name: 'Firehouse', cat: 'svc', frames: ['fire:0'], cost: 700, upkeep: 16, svc: 'fire', r: 9, fund: 'fire', unlock: 0, desc: 'Puts out fires nearby.' },
  clinic: { name: 'Clinic', cat: 'svc', frames: ['med:0'], cost: 900, upkeep: 20, svc: 'health', r: 10, fund: 'health', unlock: 1, desc: 'Keeps people healthy and happy.' },
  school: { name: 'School', cat: 'svc', frames: ['edu:3'], cost: 1000, upkeep: 24, svc: 'edu', r: 10, fund: 'edu', unlock: 1, desc: 'Raises land value, happiness.' },
  policehq: { name: 'Police HQ', cat: 'svc', frames: ['police:2'], cost: 2600, upkeep: 65, svc: 'police', r: 16, fund: 'police', unlock: 2, desc: 'Big station, wide patrol area.' },
  firest: { name: 'Fire Station', cat: 'svc', frames: ['fire:1'], cost: 2200, upkeep: 55, svc: 'fire', r: 15, fund: 'fire', unlock: 2, desc: 'Big fire station, wide reach.' },
  hospital: { name: 'Hospital', cat: 'svc', frames: ['med:2'], cost: 3000, upkeep: 75, svc: 'health', r: 17, fund: 'health', unlock: 2, desc: 'Health care for a large area.' },
  highschool: { name: 'High School', cat: 'svc', frames: ['edu:2'], cost: 3000, upkeep: 75, svc: 'edu', r: 16, fund: 'edu', unlock: 2, desc: 'Schooling for a large area.' },
  university: { name: 'University', cat: 'svc', frames: ['edu:1'], cost: 8000, upkeep: 140, svc: 'edu', r: 24, fund: 'edu', unlock: 3, desc: 'Raises land value city-wide.', landmark: true, happy: 3 },
  // Transit (in the road tray)
  busstop: { name: 'Bus Stop', cat: 'road', frames: ['mt:4', 'mt:5', 'mt:9', 'mt:10'], cost: 150, upkeep: 4, svc: 'transit', r: 5, fund: 'transit', unlock: 0, roadside: true, desc: 'Fewer cars. Must touch a road.' },
  busdepot: { name: 'Bus Depot', cat: 'road', frames: ['mt:0', 'mt:1'], cost: 1500, upkeep: 35, svc: 'transit', r: 12, fund: 'transit', unlock: 1, roadside: true, desc: 'Buses for a whole district.' },
  train: { name: 'Train Station', cat: 'road', frames: ['mt:3'], cost: 4000, upkeep: 70, svc: 'transit', r: 17, fund: 'transit', unlock: 2, roadside: true, desc: 'Takes lots of cars off roads.' },
  airport: { name: 'Airport', cat: 'road', frames: ['airport:0'], cost: 25000, upkeep: 250, fund: 'transit', unlock: 4, landmark: true, roadside: true, income: 600, demandC: 0.25, happy: 3, desc: 'Visitors and trade: shops boom.' },
  // Parks and landmarks
  park: { name: 'Small Park', cat: 'park', frames: ['res:93', 'res:94', 'res:103', 'res:104'], cost: 80, upkeep: 1, svc: 'park', r: 4, fund: 'parks', unlock: 0, desc: 'Raises land value nearby.' },
  plaza: { name: 'Plaza', cat: 'park', frames: ['res:95', 'res:96', 'res:98'], cost: 300, upkeep: 4, svc: 'park', r: 6, fund: 'parks', unlock: 0, desc: 'Raises land value, cleans air.' },
  bigpark: { name: 'Big Park', cat: 'park', frames: ['res:77', 'res:78', 'res:100'], cost: 900, upkeep: 10, svc: 'park', r: 9, fund: 'parks', unlock: 1, desc: 'A big green space for everyone.' },
  court: { name: 'Sports Court', cat: 'park', frames: ['res:99'], cost: 1200, upkeep: 14, svc: 'park', r: 10, fund: 'parks', unlock: 2, desc: 'Fun for the whole town.', happy: 1 },
  mansion: { name: "Mayor's Mansion", cat: 'park', frames: ['res:74'], cost: 2000, upkeep: 20, svc: 'park', r: 8, fund: 'parks', unlock: 1, landmark: true, happy: 5, desc: 'Your home. Makes people happy.' },
  lighthouse: { name: 'Lighthouse', cat: 'park', frames: ['res:102'], cost: 1500, upkeep: 8, svc: 'park', r: 6, fund: 'parks', unlock: 2, landmark: true, happy: 2, income: 60, nearWater: true, desc: 'Landmark by water. Visitors!' },
  bank: { name: 'Bank Tower', cat: 'park', frames: ['com:34'], cost: 5000, upkeep: 20, unlock: 2, landmark: true, fund: 'parks', income: 160, demandC: 0.1, happy: 2, desc: 'Landmark. Brings money, shops.' },
  hotel: { name: 'Grand Hotel', cat: 'park', frames: ['com:35'], cost: 9000, upkeep: 40, unlock: 3, landmark: true, fund: 'parks', income: 320, demandC: 0.1, happy: 3, desc: 'Tourists bring money monthly.' },
  arena: { name: 'Arena', cat: 'park', frames: ['com:45'], cost: 10000, upkeep: 60, svc: 'park', r: 14, unlock: 3, landmark: true, fund: 'parks', happy: 6, income: 150, desc: 'Big games, very happy people.' },
};

/** Line tools (drag a path) and area tools (drag a rectangle). */
export const LINE_COST = { road: 10, bridge: 60, line: 4 };
export const CLEAR_COST = { tree: 5, rubble: 5, building: 10 };

// The toolbar: category -> tools (in order). 'menu' opens panels instead of tools.
export const TRAYS = {
  road: ['road', 'line', 'busstop', 'busdepot', 'train', 'airport'],
  zone: ['zone:R', 'zone:C', 'zone:I', 'zone:F', 'dezone'],
  util: ['wind', 'coal', 'solar', 'nuclear', 'wtower', 'pump'],
  svc: ['police', 'fire', 'clinic', 'school', 'policehq', 'firest', 'hospital', 'highschool', 'university'],
  park: ['park', 'plaza', 'bigpark', 'court', 'mansion', 'lighthouse', 'bank', 'hotel', 'arena'],
};

export const TOOL_INFO = {
  road: { name: 'Road', cost: LINE_COST.road, unlock: 0, desc: 'Bridges over water cost $60.' },
  line: { name: 'Power Line', cost: LINE_COST.line, unlock: 0, desc: 'Carries power over empty land.' },
  'zone:R': { name: 'Residential', cost: ZONE_INFO.R.cost, unlock: 0, desc: 'Homes grow here, near a road.' },
  'zone:C': { name: 'Commercial', cost: ZONE_INFO.C.cost, unlock: 0, desc: 'Shops and offices: jobs.' },
  'zone:I': { name: 'Industrial', cost: ZONE_INFO.I.cost, unlock: 0, desc: 'Factories: jobs, but smoky.' },
  'zone:F': { name: 'Farm', cost: ZONE_INFO.F.cost, unlock: 0, desc: 'No power needed. Zone 3x3+.' },
  dezone: { name: 'Dezone', cost: 0, unlock: 0, desc: 'Removes zones and what grew.' },
  bulldoze: { name: 'Bulldoze', cost: CLEAR_COST.building, unlock: 0, desc: 'Clears buildings, roads, trees.' },
};

// Monthly budget categories (funding 0-150%).
export const FUNDS = [
  ['power', 'Power & water'], ['police', 'Police'], ['fire', 'Fire'], ['health', 'Health'],
  ['edu', 'Schools'], ['transit', 'Transit'], ['parks', 'Parks'], ['roads', 'Roads'],
];

export const ECON = {
  taxPerResident: 5, // dollars per resident per month per 100% tax
  taxPerJob: 4,
  roadUpkeep: 0.2, // per road tile per month
  lineUpkeep: 0.05,
  loanAmount: 5000,
  loanMonths: 60,
  loanRate: 0.25, // total interest over the life of the loan
  maxLoans: 3,
  defaultTax: 9,
  workerRatio: 0.35, // share of residents who work
};

export const DISASTERS = {
  fire: { name: 'Fire', icon: 16 },
  quake: { name: 'Earthquake', icon: 27 },
  meteor: { name: 'Meteor', icon: 57 },
  tornado: { name: 'Tornado', icon: 27 },
  ufo: { name: 'UFO', icon: 22 },
};

export const SCENARIOS = {
  first: {
    id: 'first', name: 'First Steps', seed: 101, money: 15000, years: 4, pop: 1200,
    blurb: 'Grow a hamlet into a Town of 1,200 people within 4 years.',
    goal: 'Reach 1,200 people by the end of year 4.',
  },
  debtfree: {
    id: 'debtfree', name: 'Debt-Free City', seed: 202, money: 12000, years: 10, pop: 5000, noDebt: true,
    blurb: 'Reach 5,000 people in 10 years with no loans and no debt.',
    goal: 'Reach 5,000 people by the end of year 10 with no loans and money of $0 or more.',
  },
  clean: {
    id: 'clean', name: 'Clean Air', seed: 303, money: 20000, years: 8, pop: 3000, happy: 65, noDirty: true,
    blurb: 'No coal or nuclear. Reach 3,000 happy people (65%+) in 8 years.',
    goal: 'Reach 3,000 people and 65% happiness by the end of year 8. Coal and nuclear plants are banned.',
  },
};
export const SANDBOX = { id: 'sandbox', name: 'Sandbox', seed: 7, money: 20000 };

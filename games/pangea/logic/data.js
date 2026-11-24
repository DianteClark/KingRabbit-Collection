// Pangea rules data: terrain, resources, units, buildings, wonders, technologies and civilizations.
// Pure data (no Phaser), shared by the game logic, the AI, the scenes and the tests.

// ---------------------------------------------------------------- terrain
// Yields are [food, production, gold]. A feature (forest, hills, mountain) replaces the base yields.
export const TERRAIN = {
  grass: { name: 'Grassland', y: [2, 0, 0], land: true },
  plains: { name: 'Plains', y: [1, 1, 0], land: true },
  desert: { name: 'Desert', y: [0, 1, 0], land: true },
  tundra: { name: 'Tundra', y: [1, 0, 0], land: true },
  snow: { name: 'Snow', y: [0, 0, 0], land: true },
  coast: { name: 'Coast', y: [1, 0, 1], land: false },
  ocean: { name: 'Ocean', y: [1, 0, 0], land: false },
};

export const FEATURES = {
  forest: { name: 'Forest', y: [1, 2, 0], move: 2, def: 25 },
  hills: { name: 'Hills', y: [0, 2, 0], move: 2, def: 50 },
  mountain: { name: 'Mountains', y: [0, 1, 0], move: 99, def: 0, blocked: true },
};

// Bonus yields added on top of the tile. Luxuries inside your borders make your people happier.
export const RESOURCES = {
  fish: { name: 'Fish', y: [2, 0, 0], on: ['coast', 'ocean'], art: 'Fish' },
  seals: { name: 'Seals', y: [1, 0, 2], on: ['coast'], art: 'Seals' },
  horses: { name: 'Horses', y: [1, 1, 0], on: ['plains', 'grass'], art: 'Horses' },
  iron: { name: 'Iron', y: [0, 2, 0], on: ['hills', 'plains'], art: 'Iron' },
  coal: { name: 'Coal', y: [0, 2, 0], on: ['hills'], art: 'Coal' },
  oil: { name: 'Oil', y: [0, 3, 0], on: ['desert', 'tundra'], art: 'Oil' },
  oasis: { name: 'Oasis', y: [3, 0, 1], on: ['desert'], art: 'Oasis' },
  gem: { name: 'Gems', y: [0, 0, 3], on: ['grass', 'forest', 'hills'], art: 'Gem', lux: true },
  gold: { name: 'Gold', y: [0, 0, 3], on: ['hills', 'desert'], art: 'Gold', lux: true },
  fur: { name: 'Furs', y: [0, 0, 2], on: ['forest', 'tundra'], art: 'Fur', lux: true },
};
export const LUXURY_JOY = 3;

// Worker jobs: what they need, how long they take and what they add.
export const JOBS = {
  farm: { name: 'Farm', turns: 4, y: [1, 0, 0], ok: (t, f) => !f && ['grass', 'plains', 'desert', 'tundra'].includes(t) },
  mine: { name: 'Mine', turns: 5, y: [0, 2, 0], ok: (t, f) => f === 'hills' },
  chop: { name: 'Chop forest', turns: 3, ok: (t, f) => f === 'forest', chop: 20 },
};

// ---------------------------------------------------------------- eras and techs
export const ERAS = ['Ancient', 'Medieval', 'Industrial', 'Modern'];
const ERA_COST = [30, 85, 190, 330];

const T = (id, name, era, req, icon, blurb) => ({ id, name, era, req, icon, blurb, cost: ERA_COST[era] + req.length * 4 * (era + 1) });
export const TECH_LIST = [
  T('pottery', 'Pottery', 0, [], 'Pottery', 'Granary'),
  T('bronze', 'Bronze Working', 0, [], 'Bronze-Working', 'Spearman, Colossus'),
  T('burial', 'Ceremonies', 0, [], 'Ceremonial-Burial', 'Temple, Oracle'),
  T('masonry', 'Masonry', 0, [], 'Masonry', 'Walls, Pyramids'),
  T('writing', 'Writing', 0, ['pottery'], 'Writing', 'Library'),
  T('wheel', 'The Wheel', 0, ['bronze'], 'Wheel', 'Chariot'),
  T('iron', 'Iron Working', 0, ['bronze'], 'Iron-Working', 'Swordsman, Barracks'),
  T('mapmaking', 'Map Making', 1, ['writing'], 'Map-Making', 'Units can cross water, Lighthouse'),
  T('mathematics', 'Mathematics', 1, ['masonry', 'writing'], 'Mathematics', 'Catapult'),
  T('currency', 'Currency', 1, ['bronze'], 'Currency', 'Marketplace'),
  T('philosophy', 'Philosophy', 1, ['writing', 'burial'], 'Philosophy', 'Great Library'),
  T('chivalry', 'Chivalry', 1, ['wheel', 'iron'], 'Chivalry', 'Knight'),
  T('construction', 'Construction', 1, ['masonry', 'currency'], 'Construction', 'Colosseum, Gardens'),
  T('religion', 'Religion', 1, ['philosophy'], 'Religion', 'Cathedral, Great Cathedral'),
  T('gunpowder', 'Gunpowder', 2, ['iron', 'mathematics'], 'Gunpowder', 'Musketeer'),
  T('astronomy', 'Astronomy', 2, ['mathematics', 'philosophy'], 'Astronomy', 'University, Observatory'),
  T('banking', 'Banking', 2, ['currency', 'construction'], 'Banking', 'Bank'),
  T('medicine', 'Medicine', 2, ['religion'], 'Medicine', 'Aqueduct'),
  T('metallurgy', 'Metallurgy', 2, ['gunpowder'], 'Metallurgy', 'Cannon'),
  T('steam', 'Steam Engine', 2, ['astronomy', 'banking'], 'Steam-Engine', 'Cavalry'),
  T('conscription', 'Conscription', 2, ['metallurgy'], 'Conscription', 'Riflemen'),
  T('industry', 'Industry', 3, ['steam', 'banking'], 'Industrialization', 'Factory'),
  T('electricity', 'Electricity', 3, ['industry', 'astronomy'], 'Electricity', 'Power Plant, Great Dam'),
  T('automobile', 'Automobile', 3, ['industry', 'conscription'], 'Automobile', 'Tank, Artillery'),
  T('computers', 'Computers', 3, ['electricity'], 'Computers', 'Research Lab'),
  T('rocketry', 'Rocketry', 3, ['computers', 'automobile'], 'Rocketry', 'Mech Infantry'),
  T('spaceflight', 'Spaceflight', 3, ['rocketry'], 'Space-Flight', 'Space Ark (wins the game)'),
];
export const TECHS = Object.fromEntries(TECH_LIST.map((t) => [t.id, t]));

// ---------------------------------------------------------------- units
// str: combat strength. line: newer units of the same line replace older ones in the build list.
// vsMounted / vsCity: attack or defence bonus in percent.
const U = (id, name, art, str, move, cost, tech, line, extra = {}) => ({ id, name, art, str, move, cost, tech, line, ...extra });
export const UNITS = {
  settler: U('settler', 'Settler', 'Settlers', 0, 2, 30, null, 'settler', { civ: true, pop: 1, blurb: 'Founds a new city. Costs 1 citizen.' }),
  worker: U('worker', 'Worker', 'Caravan', 0, 2, 20, null, 'worker', { civ: true, blurb: 'Builds farms and mines, chops forests.' }),
  warrior: U('warrior', 'Warrior', 'Militia', 6, 1, 12, null, 'foot', { blurb: 'Cheap early guard.' }),
  spearman: U('spearman', 'Spearman', 'Phalanx', 9, 1, 18, 'bronze', 'foot', { vsMounted: 100, blurb: 'Double strength against mounted units.' }),
  swordsman: U('swordsman', 'Swordsman', 'Legion', 12, 1, 24, 'iron', 'sword', { blurb: 'Strong ancient attacker.' }),
  chariot: U('chariot', 'Chariot', 'Chariot', 10, 2, 24, 'wheel', 'mounted', { mounted: true, blurb: 'Fast. Moves 2.' }),
  catapult: U('catapult', 'Catapult', 'Catapult', 8, 1, 26, 'mathematics', 'siege', { vsCity: 150, blurb: '+150% attacking cities.' }),
  knight: U('knight', 'Knight', 'Knight', 16, 2, 36, 'chivalry', 'mounted', { mounted: true, blurb: 'Fast medieval attacker.' }),
  musketeer: U('musketeer', 'Musketeer', 'Musketeer', 20, 1, 40, 'gunpowder', 'foot', { blurb: 'Solid defender.' }),
  cannon: U('cannon', 'Cannon', 'Cannon', 16, 1, 44, 'metallurgy', 'siege', { vsCity: 150, blurb: '+150% attacking cities.' }),
  cavalry: U('cavalry', 'Cavalry', 'Cavalry', 26, 3, 56, 'steam', 'mounted', { mounted: true, blurb: 'Fast. Moves 3.' }),
  riflemen: U('riflemen', 'Riflemen', 'Riflemen', 28, 1, 56, 'conscription', 'foot', { blurb: 'Industrial defender.' }),
  artillery: U('artillery', 'Artillery', 'Artillery', 28, 1, 64, 'automobile', 'siege', { vsCity: 150, blurb: '+150% attacking cities.' }),
  armor: U('armor', 'Tank', 'Armor', 50, 3, 100, 'automobile', 'mounted', { blurb: 'Modern armour. Moves 3.' }),
  mech: U('mech', 'Mech Infantry', 'Mech', 48, 2, 100, 'rocketry', 'foot', { blurb: 'Modern defender. Moves 2.' }),
};
// Lines: when a unit becomes available, earlier units of the same line can no longer be built.
// Swordsmen join the foot line once Musketeers arrive.
export const OBSOLETE = { warrior: 'spearman', spearman: 'musketeer', swordsman: 'musketeer', musketeer: 'riflemen', riflemen: 'mech', chariot: 'knight', knight: 'cavalry', cavalry: 'armor', catapult: 'cannon', cannon: 'artillery' };
export const UNIT_ORDER = ['settler', 'worker', 'warrior', 'spearman', 'swordsman', 'chariot', 'catapult', 'knight', 'musketeer', 'cannon', 'cavalry', 'riflemen', 'artillery', 'armor', 'mech'];

// ---------------------------------------------------------------- buildings
// pct: percent bonuses { food, prod, gold, sci }. add: flat bonuses. joy: happiness. culture per turn.
const B = (id, name, cost, upkeep, tech, icon, fx, blurb) => ({ id, name, cost, upkeep, tech, icon, ...fx, blurb });
export const BUILDINGS = {
  granary: B('granary', 'Granary', 30, 1, 'pottery', 'IconGranary', { add: { food: 2 } }, '+2 food'),
  temple: B('temple', 'Temple', 30, 1, 'burial', 'IconTemple', { joy: 2, culture: 1 }, '+2 happiness, +1 culture'),
  walls: B('walls', 'Walls', 30, 1, 'masonry', 'FortressIcon', { walls: 75 }, '+75% defence for units here'),
  barracks: B('barracks', 'Barracks', 30, 1, 'iron', 'IconBarracks', { veteran: true }, 'New units start as veterans (+25%)'),
  library: B('library', 'Library', 45, 1, 'writing', 'IconLibrary', { pct: { sci: 50 }, add: { sci: 1 } }, '+1 science, +50% science'),
  marketplace: B('marketplace', 'Market', 50, 0, 'currency', 'IconMarketplace', { pct: { gold: 50 }, add: { gold: 1 } }, '+1 gold, +50% gold'),
  colosseum: B('colosseum', 'Colosseum', 55, 2, 'construction', 'IconColosseum', { joy: 3 }, '+3 happiness'),
  cathedral: B('cathedral', 'Cathedral', 80, 2, 'religion', 'IconCathedral', { joy: 3, culture: 2 }, '+3 happiness, +2 culture'),
  university: B('university', 'University', 90, 2, 'astronomy', 'IconUniversity', { pct: { sci: 50 } }, '+50% science'),
  bank: B('bank', 'Bank', 90, 1, 'banking', 'IconBank', { pct: { gold: 50 } }, '+50% gold'),
  aqueduct: B('aqueduct', 'Aqueduct', 80, 1, 'medicine', 'IconAqueduct', { add: { food: 2 }, aqueduct: true }, '+2 food, cities can grow past size 8'),
  factory: B('factory', 'Factory', 130, 2, 'industry', 'IconFactory', { pct: { prod: 50 } }, '+50% production'),
  power: B('power', 'Power Plant', 120, 2, 'electricity', 'IconPowerPlant', { pct: { prod: 25 } }, '+25% production'),
  lab: B('lab', 'Research Lab', 140, 2, 'computers', 'IconNuclearPlant', { pct: { sci: 50 } }, '+50% science'),
};
export const BUILDING_ORDER = Object.keys(BUILDINGS);
export const MAX_SIZE_NO_AQUEDUCT = 8;

// One of each in the whole world. Every wonder also gives +2 culture and 10 score.
const W = (id, name, cost, tech, art, fx, blurb) => ({ id, name, cost, tech, art, ...fx, blurb, wonder: true });
export const WONDERS = {
  colossus: W('colossus', 'Colossus', 90, 'bronze', 'Colossus', { add: { gold: 4 } }, '+4 gold here'),
  pyramids: W('pyramids', 'Pyramids', 100, 'masonry', 'Pyramids', { pct: { prod: 25 } }, '+25% production here'),
  oracle: W('oracle', 'Oracle', 100, 'burial', 'Oracle', { empireJoy: 3 }, '+3 happiness in your empire'),
  lighthouse: W('lighthouse', 'Lighthouse', 110, 'mapmaking', 'BigLIghthouse', { waterFood: 1 }, '+1 food on water tiles here'),
  library: W('library', 'Great Library', 150, 'philosophy', 'BigLibrary', { add: { sci: 5 } }, '+5 science here'),
  gardens: W('gardens', 'Gardens', 160, 'construction', 'WonderfulGardens', { empireFood: 1 }, '+1 food in every city'),
  cathedral: W('cathedral', 'Great Cathedral', 180, 'religion', 'GreatCathedral', { empireJoy: 3, culture: 3 }, '+3 happiness, +3 culture'),
  observatory: W('observatory', 'Observatory', 220, 'astronomy', 'Observatory', { pct: { sci: 50 } }, '+50% science here'),
  dam: W('dam', 'Great Dam', 340, 'electricity', 'BigDam', { empireProd: 25 }, '+25% production in every city'),
  ark: W('ark', 'Space Ark', 400, 'spaceflight', 'SpaceProgram', { victory: true }, 'Launch to the stars: science victory'),
};
export const WONDER_ORDER = Object.keys(WONDERS);
// Round icons for the city screen (Big Dam has no icon of its own, so it uses its map art).
export const WONDER_ICON = {
  colossus: 'ColossusIcon', pyramids: 'PyramidsIcon', oracle: 'OracleIcon', lighthouse: 'BigLighthouseIcon', library: 'BigLibraryIcon',
  gardens: 'WonderfulGardenIcon', cathedral: 'GreatCathedralIcon', observatory: 'GreatObservatoryIcon', dam: 'BigDam', ark: 'SpaceProgramIcon',
};

// ---------------------------------------------------------------- civilizations (original names)
// avatar: index in Leaders/Avatars.png (0 is the "?" portrait).
// Personality 0..1: war (likes fighting), grow (likes new cities), sci (likes science and wonders).
export const CIVS = [
  { id: 'verdan', name: 'Verdani', leader: 'Aurel Vane', avatar: 1, war: 0.5, grow: 0.6, sci: 0.5, cities: ['Verdana', 'Laurium', 'Calvo', 'Ostrea', 'Pella', 'Marvo', 'Tibur', 'Sena'] },
  { id: 'kharun', name: 'Kharun', leader: 'Tamuk the Swift', avatar: 2, war: 0.9, grow: 0.5, sci: 0.2, cities: ['Kharak', 'Ulaan', 'Tsog', 'Barun', 'Ordu', 'Khem', 'Sarai', 'Torgut'] },
  { id: 'thess', name: 'Thessmark', leader: 'Elder Brannoc', avatar: 3, war: 0.3, grow: 0.5, sci: 0.8, cities: ['Thessa', 'Brannow', 'Elmgate', 'Corrow', 'Fenwick', 'Ashby', 'Marrow', 'Dunlee'] },
  { id: 'sunreach', name: 'Sunreach', leader: 'Sethar the Gilded', avatar: 4, war: 0.4, grow: 0.8, sci: 0.5, cities: ['Ankhet', 'Sepra', 'Meroa', 'Tazir', 'Hapet', 'Nubra', 'Khefu', 'Saqar'] },
  { id: 'ironvale', name: 'Ironvale', leader: 'Grim Okko', avatar: 5, war: 0.8, grow: 0.6, sci: 0.3, cities: ['Okkor', 'Grimby', 'Forgeholt', 'Anvila', 'Rustwater', 'Brask', 'Cinder', 'Hollen'] },
  { id: 'lumen', name: 'Lumen', leader: 'Sora Kei', avatar: 6, war: 0.2, grow: 0.5, sci: 0.9, cities: ['Lumeria', 'Kaito', 'Hanami', 'Seiro', 'Mirai', 'Tsuki', 'Aoba', 'Renza'] },
  { id: 'dunmoor', name: 'Dunmoor', leader: 'Old Tavish', avatar: 7, war: 0.5, grow: 0.4, sci: 0.6, cities: ['Dunmoor', 'Tavik', 'Glenrow', 'Kelda', 'Bramble', 'Stoat', 'Morrow', 'Ferrin'] },
  { id: 'frost', name: 'Frostholm', leader: 'Hilda Brightmane', avatar: 8, war: 0.6, grow: 0.7, sci: 0.4, cities: ['Frosta', 'Hildby', 'Skarn', 'Ulvik', 'Norra', 'Isvik', 'Kald', 'Vinter'] },
  { id: 'zanbar', name: 'Zanbar', leader: 'Mbeka the Bold', avatar: 9, war: 0.6, grow: 0.7, sci: 0.4, cities: ['Zanbar', 'Mbeko', 'Kilo', 'Tamu', 'Ruvo', 'Sangai', 'Nyota', 'Baraka'] },
  { id: 'rosewood', name: 'Rosewood', leader: 'Lady Ilsa', avatar: 10, war: 0.15, grow: 0.6, sci: 0.8, cities: ['Rosewood', 'Ilsabel', 'Thornby', 'Petalia', 'Briar', 'Cressa', 'Lilith', 'Wren'] },
  { id: 'quetza', name: 'Quetzara', leader: 'Itza Plume', avatar: 11, war: 0.7, grow: 0.8, sci: 0.3, cities: ['Quetza', 'Itzal', 'Teoca', 'Xolo', 'Mazat', 'Copal', 'Tlaxa', 'Ocelo'] },
  { id: 'orr', name: 'Orr', leader: 'Orrin Khal', avatar: 12, war: 0.85, grow: 0.6, sci: 0.3, cities: ['Orrin', 'Khalat', 'Dashur', 'Bakhan', 'Tamar', 'Yurt', 'Ogen', 'Zhul'] },
  { id: 'avalune', name: 'Avalune', leader: 'Queen Merel', avatar: 13, war: 0.3, grow: 0.7, sci: 0.7, cities: ['Avalune', 'Merelle', 'Silvane', 'Orlay', 'Bellac', 'Cerise', 'Vauda', 'Lisse'] },
  { id: 'grimhold', name: 'Grimhold', leader: 'Baron Kord', avatar: 14, war: 0.7, grow: 0.5, sci: 0.4, cities: ['Grimhold', 'Kordova', 'Halvar', 'Stenna', 'Druva', 'Moska', 'Belgor', 'Tverin'] },
];
export const CIV_BY_ID = Object.fromEntries(CIVS.map((c) => [c.id, c]));

// Flag colours (FlagsAndBorder.png rows 1..7). Players get blue first.
export const COLORS = [
  { id: 'blue', hex: '#2f8fe0', dark: '#1a4f80', flag: 6 },
  { id: 'red', hex: '#d8402e', dark: '#7a2018', flag: 1 },
  { id: 'yellow', hex: '#f0d43a', dark: '#8a7414', flag: 3 },
  { id: 'purple', hex: '#a04aa8', dark: '#5a2260', flag: 7 },
  { id: 'orange', hex: '#f08a24', dark: '#8a4a10', flag: 2 },
];

export const MAP_SIZES = {
  small: { name: 'Small', w: 26, h: 22 },
  medium: { name: 'Medium', w: 34, h: 28 },
};

export const SCORE = { pop: 3, city: 5, tech: 4, wonder: 10, land: 0.25 };

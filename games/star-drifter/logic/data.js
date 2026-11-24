// Star Drifter game data: systems, weapons, drones, crew species, ship layouts and enemy classes.
// Pure data (no Phaser), shared by the simulation, the bot and the scenes.

// ------------------------------------------------------------------ systems

/**
 * Systems. `power: true` systems draw reactor power (1 per bar). Piloting and sensors are
 * subsystems: they never use reactor power, their level is what counts.
 * up[L] = scrap to go from level L to L+1.
 */
export const SYSTEMS = {
  shields: {
    name: 'Shields', power: true, max: 8,
    up: [0, 0, 25, 35, 45, 55, 70, 85],
    desc: 'Every 2 power makes 1 shield layer. A layer stops one laser or ion shot, then recharges.',
  },
  engines: {
    name: 'Engines', power: true, max: 8,
    up: [0, 10, 15, 25, 35, 45, 55, 65],
    desc: 'Each power adds 5% dodge and charges the jump drive faster. Needs a pilot.',
  },
  weapons: {
    name: 'Weapons', power: true, max: 8,
    up: [0, 20, 25, 35, 45, 55, 65, 75],
    desc: 'Powers your weapons. Each weapon needs its own power to charge.',
  },
  oxygen: {
    name: 'Oxygen', power: true, max: 3,
    up: [0, 25, 45],
    desc: 'Refills the air in every room. Without it the air slowly runs out and crew suffocate.',
  },
  medbay: {
    name: 'Medbay', power: true, max: 3,
    up: [0, 20, 40],
    desc: 'Heals crew standing in the medbay. More power heals faster.',
  },
  drones: {
    name: 'Drone Bay', power: true, max: 8,
    up: [0, 15, 25, 35, 45, 55, 65, 75],
    desc: 'Powers drones. Each drone uses one drone part when it launches.',
  },
  piloting: {
    name: 'Piloting', power: false, max: 3,
    up: [0, 20, 35],
    desc: 'Must be crewed to dodge and to jump away. Level 2+ keeps half the dodge with nobody at the helm.',
  },
  sensors: {
    name: 'Sensors', power: false, max: 3,
    up: [0, 20, 35],
    desc: 'Level 1 shows the enemy crew. Level 2 also shows enemy weapons charging. Level 3 adds 10% hit chance.',
  },
  teleporter: {
    name: 'Teleporter', power: true, max: 3, enemyOnly: true,
    up: [0, 0, 0],
    desc: 'Beams boarders onto your ship. Hit it to stop the boarding parties.',
  },
};

export const POWER_ORDER = ['shields', 'engines', 'weapons', 'oxygen', 'medbay', 'drones', 'teleporter'];
export const SYSTEM_ORDER = ['shields', 'engines', 'weapons', 'oxygen', 'medbay', 'drones', 'piloting', 'sensors'];

/** Reactor upgrade cost when the reactor has `r` power now. */
export const reactorCost = (r) => 12 + 3 * Math.max(0, r - 8);
export const REACTOR_MAX = 25;

// ------------------------------------------------------------------ weapons

/**
 * type: laser (stopped by shields, pops a layer), ion (pops a layer, ion-locks systems),
 * missile (needs 1 missile per shot, ignores shields), flak (several shots scattered around
 * the target), beam (never misses, hits the target room and its neighbours, minus shield layers).
 * cd = seconds to charge. sys = damage to the system in the room. fire/breach = chance per hit.
 */
export const WEAPONS = {
  pulse1: { name: 'Pulse Laser', short: 'Pulse', type: 'laser', shots: 2, dmg: 1, cd: 10, power: 1, cost: 35, fire: 0, breach: 0.05 },
  pulse2: { name: 'Pulse Laser II', short: 'Pulse II', type: 'laser', shots: 3, dmg: 1, cd: 12, power: 2, cost: 60, fire: 0, breach: 0.05 },
  swarm: { name: 'Swarm Laser', short: 'Swarm', type: 'laser', shots: 4, dmg: 1, cd: 15, power: 3, cost: 80, fire: 0, breach: 0.05 },
  heavy1: { name: 'Heavy Laser', short: 'Heavy', type: 'laser', shots: 1, dmg: 2, cd: 9, power: 1, cost: 45, fire: 0.1, breach: 0.15 },
  heavy2: { name: 'Heavy Laser II', short: 'Heavy II', type: 'laser', shots: 2, dmg: 2, cd: 13, power: 3, cost: 75, fire: 0.15, breach: 0.15 },
  ion1: { name: 'Ion Lancer', short: 'Ion', type: 'ion', shots: 1, dmg: 1, cd: 8, power: 1, cost: 40, fire: 0, breach: 0 },
  ion2: { name: 'Twin Ion', short: 'Twin Ion', type: 'ion', shots: 2, dmg: 1, cd: 12, power: 2, cost: 65, fire: 0, breach: 0 },
  arrow: { name: 'Arrow Missile', short: 'Arrow', type: 'missile', shots: 1, dmg: 3, cd: 11, power: 1, cost: 40, fire: 0.1, breach: 0.2 },
  breacher: { name: 'Breacher Missile', short: 'Breacher', type: 'missile', shots: 1, dmg: 4, cd: 15, power: 2, cost: 60, fire: 0.3, breach: 0.6 },
  flak: { name: 'Scatter Flak', short: 'Flak', type: 'flak', shots: 3, dmg: 1, cd: 13, power: 2, cost: 55, fire: 0, breach: 0.1 },
  cutter: { name: 'Cutter Beam', short: 'Cutter', type: 'beam', shots: 1, dmg: 2, rooms: 2, cd: 12, power: 1, cost: 40, fire: 0, breach: 0 },
  searing: { name: 'Searing Beam', short: 'Searing', type: 'beam', shots: 1, dmg: 1, rooms: 3, cd: 14, power: 2, cost: 50, fire: 0.6, breach: 0 },
};

export const WEAPON_TYPE_TEXT = {
  laser: 'Laser: each shot is stopped by one shield layer.',
  ion: 'Ion: knocks out a shield layer or locks a system for a few seconds. No hull damage.',
  missile: 'Missile: flies through shields. Uses 1 missile per shot.',
  flak: 'Flak: a spray of shots around the target that strips shields.',
  beam: 'Beam: never misses. Cuts through the target room and its neighbours, losing 1 damage per shield layer.',
};

export function weaponText(id) {
  const w = WEAPONS[id];
  const shots = w.type === 'beam' ? `${w.dmg} damage to ${w.rooms} rooms` : `${w.shots} shot${w.shots > 1 ? 's' : ''} x ${w.dmg} damage`;
  const extra = [];
  if (w.fire >= 0.3) extra.push('often starts fires');
  if (w.breach >= 0.3) extra.push('often breaches hull');
  return `${shots}, charges in ${w.cd}s, ${w.power} power.${extra.length ? ` ${extra.join(', ')}.` : ''}\n${WEAPON_TYPE_TEXT[w.type]}`;
}

// ------------------------------------------------------------------ drones

export const DRONES = {
  combat: { name: 'Combat Drone', short: 'Attack', power: 2, cd: 6, cost: 50, desc: 'Fires a 1-damage laser at a random enemy room every 6 seconds.' },
  defense: { name: 'Defense Drone', short: 'Defense', power: 2, cd: 3, cost: 50, desc: 'Shoots down incoming missiles and flak (one every 3 seconds).' },
  hull: { name: 'Hull Drone', short: 'Hull', power: 1, cd: 8, cost: 45, desc: 'Patches 1 hull every 8 seconds, up to 4 per fight.' },
};

// ------------------------------------------------------------------ crew

/**
 * Species. speed: rooms per second multiplier. repair/combat: multipliers.
 * sprite: row (y) on the 8px characters sheet.
 */
export const SPECIES = {
  terran: { name: 'Terran', hp: 100, speed: 1, repair: 1, combat: 1, fireproof: false, noAir: false, sprites: [152, 160, 168], blurb: 'Balanced and quick to learn: gains skills 50% faster.' },
  rokkan: { name: 'Rokkan', hp: 150, speed: 0.6, repair: 0.8, combat: 1.2, fireproof: true, noAir: false, sprites: [80], blurb: 'Stone-skinned. 150 health, cannot burn, but slow.' },
  zephi: { name: 'Zephi', hp: 75, speed: 1.5, repair: 2, combat: 0.7, fireproof: false, noAir: false, sprites: [144], blurb: 'Fast hands: repairs twice as fast and runs quickly. Fragile.' },
  synth: { name: 'Synth', hp: 90, speed: 0.9, repair: 1, combat: 0.9, fireproof: false, noAir: true, sprites: [176, 184], blurb: 'A robot. Needs no air at all.' },
  kesh: { name: 'Kesh', hp: 110, speed: 1, repair: 0.5, combat: 1.35, fireproof: false, noAir: false, sprites: [96], blurb: 'Born fighters: hit hard in melee, repair slowly.' },
};

export const CREW_NAMES = [
  'Ada', 'Bram', 'Cass', 'Dex', 'Edda', 'Finn', 'Gus', 'Hana', 'Ivo', 'Juno', 'Kai', 'Lux', 'Mira', 'Nox', 'Odo',
  'Pip', 'Quin', 'Rhea', 'Sol', 'Tam', 'Uma', 'Vex', 'Wren', 'Yara', 'Zed', 'Bo', 'Cyra', 'Dima', 'Elo', 'Faye',
  'Gil', 'Hux', 'Iris', 'Jax', 'Kit', 'Lena', 'Milo', 'Nia', 'Orin', 'Rook',
];

/** Skills crew learn by doing. Levels 0-2. */
export const SKILLS = ['pilot', 'engines', 'shields', 'weapons', 'repair', 'combat'];
export const SKILL_NAMES = { pilot: 'Pilot', engines: 'Engines', shields: 'Shields', weapons: 'Weapons', repair: 'Repair', combat: 'Combat' };
export const SKILL_XP = [0, 15, 40]; // xp needed for level 1 and 2 (xp ~ seconds of work)
/** The skill used when manning a system. */
export const MAN_SKILL = { piloting: 'pilot', engines: 'engines', shields: 'shields', weapons: 'weapons' };

// ------------------------------------------------------------------ ship layouts

/** Rooms in cell units (x, y, w, h). sys: system installed or slot for one (null = corridor). */
export const LAYOUTS = {
  wayfarer: [
    { sys: 'engines', x: 0, y: 1, w: 2, h: 2 },
    { sys: 'oxygen', x: 2, y: 0, w: 2, h: 2 },
    { sys: 'shields', x: 4, y: 0, w: 2, h: 2 },
    { sys: 'medbay', x: 6, y: 0, w: 2, h: 2 },
    { sys: 'weapons', x: 8, y: 0, w: 2, h: 2 },
    { sys: 'piloting', x: 10, y: 1, w: 2, h: 1 },
    { sys: 'sensors', x: 10, y: 2, w: 2, h: 1 },
    { sys: null, x: 2, y: 2, w: 2, h: 1 },
    { sys: null, x: 4, y: 2, w: 2, h: 1 },
    { sys: 'drones', x: 6, y: 2, w: 2, h: 1 },
    { sys: null, x: 8, y: 2, w: 2, h: 1 },
  ],
  corvid: [
    { sys: 'engines', x: 0, y: 1, w: 1, h: 2 },
    { sys: 'oxygen', x: 1, y: 0, w: 2, h: 1 },
    { sys: null, x: 3, y: 0, w: 2, h: 1 },
    { sys: 'medbay', x: 5, y: 0, w: 2, h: 1 },
    { sys: 'drones', x: 1, y: 1, w: 2, h: 2 },
    { sys: 'shields', x: 3, y: 1, w: 2, h: 2 },
    { sys: 'weapons', x: 5, y: 1, w: 2, h: 2 },
    { sys: 'piloting', x: 7, y: 1, w: 2, h: 1 },
    { sys: 'sensors', x: 7, y: 2, w: 2, h: 1 },
  ],
  skiff: [
    { sys: 'piloting', x: 0, y: 1, w: 1, h: 1 },
    { sys: 'weapons', x: 1, y: 0, w: 2, h: 2 },
    { sys: 'shields', x: 1, y: 2, w: 2, h: 1 },
    { sys: 'oxygen', x: 3, y: 0, w: 2, h: 1 },
    { sys: 'engines', x: 3, y: 1, w: 2, h: 2 },
    { sys: 'sensors', x: 5, y: 1, w: 1, h: 1 },
  ],
  cutter: [
    { sys: 'piloting', x: 0, y: 1, w: 1, h: 1 },
    { sys: 'weapons', x: 1, y: 0, w: 2, h: 2 },
    { sys: 'sensors', x: 1, y: 2, w: 2, h: 1 },
    { sys: 'shields', x: 3, y: 0, w: 2, h: 2 },
    { sys: 'medbay', x: 3, y: 2, w: 2, h: 1 },
    { sys: 'oxygen', x: 5, y: 0, w: 2, h: 1 },
    { sys: 'engines', x: 5, y: 1, w: 2, h: 2 },
    { sys: 'drones', x: 7, y: 1, w: 1, h: 2 },
  ],
  cruiser: [
    { sys: 'piloting', x: 0, y: 1, w: 1, h: 1 },
    { sys: 'weapons', x: 1, y: 0, w: 2, h: 2 },
    { sys: null, x: 1, y: 2, w: 2, h: 1 },
    { sys: 'shields', x: 3, y: 0, w: 2, h: 2 },
    { sys: 'medbay', x: 3, y: 2, w: 2, h: 1 },
    { sys: 'drones', x: 5, y: 0, w: 2, h: 2 },
    { sys: 'oxygen', x: 5, y: 2, w: 2, h: 1 },
    { sys: 'engines', x: 7, y: 0, w: 2, h: 2 },
    { sys: 'sensors', x: 7, y: 2, w: 2, h: 1 },
    { sys: 'teleporter', x: 9, y: 1, w: 1, h: 1 },
  ],
  automaton: [
    { sys: 'weapons', x: 0, y: 0, w: 2, h: 2 },
    { sys: 'drones', x: 0, y: 2, w: 2, h: 1 },
    { sys: 'shields', x: 2, y: 0, w: 2, h: 2 },
    { sys: 'engines', x: 2, y: 2, w: 2, h: 1 },
    { sys: 'piloting', x: 4, y: 1, w: 1, h: 1 },
  ],
  flagship: [
    { sys: 'piloting', x: 0, y: 1, w: 1, h: 2 },
    { sys: 'weapons', x: 1, y: 0, w: 2, h: 2 },
    { sys: 'sensors', x: 1, y: 2, w: 2, h: 1 },
    { sys: null, x: 1, y: 3, w: 2, h: 1 },
    { sys: 'shields', x: 3, y: 0, w: 2, h: 2 },
    { sys: 'medbay', x: 3, y: 2, w: 2, h: 2 },
    { sys: 'drones', x: 5, y: 0, w: 2, h: 2 },
    { sys: 'oxygen', x: 5, y: 2, w: 2, h: 1 },
    { sys: 'teleporter', x: 5, y: 3, w: 2, h: 1 },
    { sys: null, x: 7, y: 0, w: 2, h: 1 },
    { sys: 'engines', x: 7, y: 1, w: 2, h: 2 },
    { sys: null, x: 7, y: 3, w: 2, h: 1 },
  ],
};

// ------------------------------------------------------------------ player ships

export const SHIPS = {
  wayfarer: {
    name: 'Wayfarer', layout: 'wayfarer', hull: 30, reactor: 8,
    blurb: 'A sturdy hauler: two lasers, a medbay and four crew.',
    systems: { shields: 2, engines: 2, weapons: 3, oxygen: 1, medbay: 1, piloting: 1, sensors: 1 },
    weapons: ['pulse1', 'heavy1'], drones: [], weaponSlots: 4, droneSlots: 2,
    crew: [['terran', 'piloting'], ['terran', 'engines'], ['rokkan', 'weapons'], ['zephi', 'shields']],
    missiles: 8, droneParts: 2,
  },
  corvid: {
    name: 'Corvid', layout: 'corvid', hull: 28, reactor: 10,
    blurb: 'A nimble raider: ion lance, two lasers, an attack drone and a mixed crew.',
    systems: { shields: 2, engines: 3, weapons: 4, oxygen: 1, medbay: 1, drones: 2, piloting: 1, sensors: 1 },
    weapons: ['ion1', 'heavy1', 'pulse1'], drones: ['combat'], weaponSlots: 3, droneSlots: 2,
    crew: [['synth', 'piloting'], ['zephi', 'engines'], ['kesh', 'weapons'], ['terran', 'shields']],
    missiles: 6, droneParts: 4,
  },
};

// ------------------------------------------------------------------ enemies

/**
 * Enemy classes. Loadouts scale with the sector in enemies.js.
 * crewless ships (automata) cannot be beaten by killing the crew, but need no air.
 */
export const ENEMY_CLASSES = {
  raider: { faction: 'Reaver', layout: 'skiff', names: ['Rust Fang', 'Scrap Gull', 'Lean Jackal', 'Bent Nail', 'Grey Mote'], species: ['terran', 'kesh'], crew: 3 },
  hunter: { faction: 'Reaver', layout: 'cutter', names: ['Red Wake', 'Hollow Pike', 'Night Heron', 'Gutter Wasp'], species: ['terran', 'zephi', 'kesh'], crew: 4 },
  automaton: { faction: 'Automata', layout: 'automaton', names: ['Watcher Unit', 'Sentry Drone', 'Hive Node', 'Silent Probe'], crewless: true, crew: 0 },
  boarder: { faction: 'Kesh Clan', layout: 'cruiser', names: ['Kesh Warband', 'Kesh Claw', 'Kesh Raidship'], species: ['kesh'], crew: 5, boards: true },
  patrol: { faction: 'Hegemony', layout: 'cruiser', names: ['Hegemony Cutter', 'Hegemony Lancer', 'Hegemony Warden'], species: ['terran', 'synth'], crew: 5 },
  flagship: { faction: 'Hegemony', layout: 'flagship', names: ['The Iron Verdict'], species: ['terran', 'synth', 'kesh'], crew: 7, boards: true },
};

// ------------------------------------------------------------------ sectors

export const SECTOR_COUNT = 8; // sector 8 is the last stand, with the flagship at its exit

export const SECTOR_NAMES = [
  'Ember Drift', 'Calder Reach', 'The Shoals', 'Veil Nebula', 'Kesh Frontier', 'Glass Belt', 'Hegemony Marches', 'The Throne Gate',
];

// ------------------------------------------------------------------ art (frames on the 8px sheets)

/** System icons: [sheet, frame]. Sheets are cut in Boot.js. */
export const SYS_ART = {
  shields: 'f2:0,2', engines: 'it:5,4', weapons: 'ts:3,5', oxygen: 'it:4,3', medbay: 'it:1,4',
  drones: 'f2:0,4', piloting: 'ts:0,2', sensors: 'ts:1,1', teleporter: 'ts:4,1',
};

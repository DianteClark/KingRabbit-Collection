// Sand Siege numbers: towers, enemies and support powers. Pure data, no Phaser, so tests can use it.
// Distances are in map cells (one cell = 32px on screen), times in seconds, speeds in cells per second.

/**
 * Towers. levels[0] is what you build; levels[1] and levels[2] are upgrades; branches are the two
 * specialties offered as the third and last upgrade. Each level lists its full stats.
 *   range, dmg (per hit), rate (seconds between shots), splash (radius), ground/air (what it can hit)
 *   slow (0-1 speed taken away), income (funds paid at the start of each wave)
 */
export const TOWERS = {
  mg: {
    name: 'Machine Gun', short: 'Gun', cost: 50, ground: true, air: true,
    blurb: 'Cheap and quick. Hits ground and air.',
    levels: [
      { range: 2.4, dmg: 5, rate: 0.35 },
      { cost: 45, range: 2.6, dmg: 8, rate: 0.32 },
      { cost: 75, range: 2.8, dmg: 12, rate: 0.28 },
    ],
    branches: [
      { id: 'minigun', name: 'Minigun', cost: 160, desc: 'Fires more than twice as fast.', range: 2.9, dmg: 12, rate: 0.11 },
      { id: 'ap', name: 'AP Rounds', cost: 160, desc: 'Big rounds that ignore armour and shred shields.', range: 3.1, dmg: 30, rate: 0.3, pierce: true, shieldMul: 2 },
    ],
  },
  cannon: {
    name: 'Cannon', short: 'Cannon', cost: 80, ground: true, air: false, shell: 0.25,
    blurb: 'Shells burst on groups. Ground only.',
    levels: [
      { range: 2.2, dmg: 22, rate: 1.2, splash: 0.8 },
      { cost: 60, range: 2.3, dmg: 34, rate: 1.15, splash: 0.9 },
      { cost: 100, range: 2.5, dmg: 52, rate: 1.1, splash: 1.0 },
    ],
    branches: [
      { id: 'bigbore', name: 'Big Bore', cost: 230, desc: 'Huge shells with a wide blast.', range: 2.6, dmg: 120, rate: 1.4, splash: 1.4 },
      { id: 'rapid', name: 'Autoloader', cost: 220, desc: 'Fires twice as often.', range: 2.6, dmg: 55, rate: 0.5, splash: 1.0 },
    ],
  },
  aa: {
    name: 'Anti-Air', short: 'AA', cost: 70, ground: false, air: true,
    blurb: 'Shreds drones and gunships. Air only.',
    levels: [
      { range: 3.2, dmg: 18, rate: 0.5 },
      { cost: 60, range: 3.4, dmg: 30, rate: 0.5 },
      { cost: 100, range: 3.6, dmg: 46, rate: 0.45 },
    ],
    branches: [
      { id: 'flak', name: 'Flak Burst', cost: 200, desc: 'Bursts hit every flyer nearby.', range: 3.8, dmg: 50, rate: 0.4, splash: 1.1 },
      { id: 'missile', name: 'Missile Lock', cost: 220, desc: 'Long range, huge single hits.', range: 5, dmg: 170, rate: 1.0 },
    ],
  },
  slow: {
    name: 'Tar Sprayer', short: 'Slow', cost: 60, ground: true, air: true, pulse: true,
    blurb: 'Slows everything near it.',
    levels: [
      { range: 1.8, dmg: 1, rate: 0.5, slow: 0.35 },
      { cost: 50, range: 2.0, dmg: 2, rate: 0.5, slow: 0.45 },
      { cost: 80, range: 2.2, dmg: 3, rate: 0.5, slow: 0.5 },
    ],
    branches: [
      { id: 'snare', name: 'Quicksand', cost: 160, desc: 'Slows much harder.', range: 2.3, dmg: 4, rate: 0.5, slow: 0.68 },
      { id: 'jammer', name: 'Jammer', cost: 180, desc: 'Stops healing and shields, adds damage.', range: 2.4, dmg: 8, rate: 0.5, slow: 0.45, jam: true },
    ],
  },
  sniper: {
    name: 'Sniper', short: 'Sniper', cost: 100, ground: true, air: true, prio: 'strong',
    blurb: 'Very long range, big single shots.',
    levels: [
      { range: 4.5, dmg: 45, rate: 1.6 },
      { cost: 80, range: 4.8, dmg: 75, rate: 1.5 },
      { cost: 120, range: 5.0, dmg: 110, rate: 1.4 },
    ],
    branches: [
      { id: 'marksman', name: 'Marksman', cost: 250, desc: 'Armour-piercing shots for huge damage.', range: 5.5, dmg: 280, rate: 1.5, pierce: true },
      { id: 'spotter', name: 'Spotter', cost: 220, desc: 'Towers within 2 cells get +20% range.', range: 5.2, dmg: 120, rate: 1.3, aura: 2 },
    ],
  },
  arty: {
    name: 'Artillery', short: 'Arty', cost: 130, ground: true, air: false, shell: 1.0, minRange: 1.5,
    blurb: 'Huge range and blast, but slow. Ground only.',
    levels: [
      { range: 5.5, dmg: 40, rate: 3.0, splash: 1.2 },
      { cost: 90, range: 5.8, dmg: 62, rate: 2.9, splash: 1.25 },
      { cost: 140, range: 6.2, dmg: 92, rate: 2.8, splash: 1.3 },
    ],
    branches: [
      { id: 'bertha', name: 'Big Bertha', cost: 280, desc: 'One enormous shell.', range: 6.8, dmg: 240, rate: 3.4, splash: 1.7 },
      { id: 'barrage', name: 'Barrage', cost: 260, desc: 'Three shells at once.', range: 6.5, dmg: 80, rate: 2.8, splash: 1.2, shots: 3 },
    ],
  },
  bank: {
    name: 'Supply Depot', short: 'Depot', cost: 90, ground: false, air: false, money: true,
    blurb: 'Pays funds at the start of every wave.',
    levels: [
      { range: 0, income: 20 },
      { cost: 70, range: 0, income: 35 },
      { cost: 110, range: 0, income: 55 },
    ],
    branches: [
      { id: 'vault', name: 'Vault', cost: 200, desc: 'Pays 95 funds a wave.', range: 0, income: 95 },
      { id: 'salvage', name: 'Salvage Yard', cost: 180, desc: 'Pays 60 a wave; kills within 2.5 cells pay double.', range: 2.5, income: 60, salvage: true },
    ],
  },
};
export const TOWER_ORDER = ['mg', 'cannon', 'aa', 'slow', 'sniper', 'arty', 'bank'];

/** Stats of a tower at its current level (level 0-2, or 3 with a branch 0/1). */
export function towerStats(type, level, branch = null) {
  const d = TOWERS[type];
  const base = { ground: d.ground, air: d.air, minRange: d.minRange || 0, shell: d.shell || 0, pulse: !!d.pulse };
  if (level >= 3 && branch != null) return { ...base, ...d.branches[branch], name: d.branches[branch].name };
  return { ...base, ...d.levels[Math.min(level, 2)], name: d.name };
}

/** Cost of the next upgrade (branch 0/1 picks the specialty at the top), or null when maxed. */
export function upgradeCost(type, level, branch = 0) {
  const d = TOWERS[type];
  if (level < 2) return d.levels[level + 1].cost;
  if (level === 2) return d.branches[branch].cost;
  return null;
}

/**
 * Enemies. hp is the base for wave 1 on map 1 (waves scale it). armor is taken off every hit
 * (a hit always does at least a quarter of its damage). shield soaks damage first and comes back
 * when the unit hasn't been hit for a while. lives: how many lives it costs when it reaches the base.
 */
export const ENEMIES = {
  rifle: { name: 'Rifleman', hp: 30, speed: 0.85, reward: 4, lives: 1, art: 'inf', blurb: 'Basic foot soldier.' },
  raider: { name: 'Raider', hp: 22, speed: 1.9, reward: 4, lives: 1, art: 'recon', blurb: 'Fast buggy. Hard to catch.' },
  tank: { name: 'Tank', hp: 120, armor: 4, speed: 0.55, reward: 9, lives: 2, art: 'tank', blurb: 'Armoured: small bullets barely scratch it.' },
  drone: { name: 'Drone', hp: 45, speed: 1.0, reward: 6, lives: 1, art: 'drone', air: true, blurb: 'Flies straight at your base, over everything.' },
  shield: { name: 'Shield Trooper', hp: 45, shield: 45, speed: 0.8, reward: 7, lives: 1, art: 'hinf', blurb: 'Blue shield soaks damage and recharges.' },
  medic: { name: 'Medic Truck', hp: 80, speed: 0.7, reward: 9, lives: 1, art: 'truck', heal: 8, healRange: 1.5, blurb: 'Repairs the units around it.' },
  heavy: { name: 'Heavy Tank', hp: 300, armor: 8, speed: 0.45, reward: 18, lives: 3, art: 'heavy', blurb: 'Thick armour. Use cannons and snipers.' },
  behemoth: { name: 'Behemoth', hp: 2400, armor: 10, speed: 0.32, reward: 150, lives: 10, art: 'heavy', boss: true, scale: 3, blurb: 'Boss. A rolling fortress.' },
  gunship: { name: 'Gunship', hp: 1700, armor: 4, speed: 0.45, reward: 150, lives: 10, art: 'drone', air: true, boss: true, scale: 3, blurb: 'Boss. Flies, so only some towers can hit it.' },
};
export const ENEMY_ORDER = ['rifle', 'raider', 'tank', 'drone', 'shield', 'medic', 'heavy', 'behemoth', 'gunship'];

/** Damage after armour and shields. Returns { shield, hp } taken. */
export function damageSplit(e, dmg, { pierce = false, shieldMul = 1 } = {}) {
  let shieldTaken = 0;
  let rest = dmg;
  if (e.shield > 0) {
    const s = dmg * shieldMul;
    shieldTaken = Math.min(e.shield, s);
    rest = (s - shieldTaken) / shieldMul;
  }
  let hp = 0;
  if (rest > 0) hp = pierce ? rest : Math.max(rest * 0.25, rest - (e.armor || 0));
  return { shield: shieldTaken, hp };
}

/** Support powers, unlocked by clearing campaign maps. */
export const POWERS = {
  airstrike: { name: 'Airstrike', cd: 40, unlock: 2, desc: 'Tap the map: bombs hit everything in a wide circle a moment later.' },
  sandstorm: { name: 'Sandstorm', cd: 60, unlock: 5, desc: 'Every enemy crawls at a third of its speed for 5 seconds.' },
  repair: { name: 'Repair', cd: 90, unlock: 8, desc: 'Patch up the base: +3 lives (up to your starting lives).' },
};
export const POWER_ORDER = ['airstrike', 'sandstorm', 'repair'];
export const airstrikeDamage = (wave) => 90 + 14 * wave;
export const AIRSTRIKE_RADIUS = 1.6;

export const TARGETS = ['first', 'last', 'strong', 'close'];
export const TARGET_NAMES = { first: 'First', last: 'Last', strong: 'Strong', close: 'Close' };

export const START_LIVES = 20;
export const HARD = { hp: 1.25, lives: 10, funds: 0.9 };
export const WAVE_BREAK = 20; // seconds between the end of one wave's spawning and the next wave
export const EARLY_RATE = 2; // funds per second of countdown skipped when you call a wave early
export const SELL_BACK = 0.7;

/** Stars for a win: 3 for losing at most 10% of lives, 2 for at most half. */
export function starsFor(lives, maxLives) {
  if (lives <= 0) return 0;
  if (lives >= Math.ceil(maxLives * 0.9)) return 3;
  if (lives >= Math.ceil(maxLives * 0.5)) return 2;
  return 1;
}

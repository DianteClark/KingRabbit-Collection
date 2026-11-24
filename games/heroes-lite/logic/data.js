// Heroes Lite game data: creatures, factions, town buildings, spells, artifacts, skills.
// Pure data (no Phaser) so the rules can be tested in node.

export const RES = ['gold', 'wood', 'ore', 'gems'];
export const RES_NAME = { gold: 'Gold', wood: 'Wood', ore: 'Ore', gems: 'Gems' };

// Creature stats. speed is in battle-grid squares (the grid is 7 wide).
// abilities: fly, shots (ranged), noRetal (target can't strike back), drain (heals by damage dealt),
// regen (top creature heals each turn), twoRetal, joust (+5% damage per square charged),
// deathBlow (20% chance of double damage), splash (ranged hit also hurts neighbours), resist (20% spell resist),
// undead (not affected by Cure/Bless... morale-less; necromancy raises them).
export const CREATURES = {
  // Castle
  pikeman: { name: 'Pikemen', one: 'Pikeman', faction: 'castle', tier: 1, atk: 4, def: 5, min: 1, max: 3, hp: 10, speed: 3, growth: 12, cost: { gold: 60 }, sprite: ['humans', 0] },
  archer: { name: 'Archers', one: 'Archer', faction: 'castle', tier: 2, atk: 6, def: 3, min: 2, max: 3, hp: 10, speed: 3, shots: 12, growth: 9, cost: { gold: 100 }, sprite: ['humans', 1] },
  griffin: { name: 'Griffins', one: 'Griffin', faction: 'castle', tier: 3, atk: 8, def: 8, min: 3, max: 6, hp: 25, speed: 5, fly: true, twoRetal: true, growth: 7, cost: { gold: 200 }, vmul: 0.92, sprite: ['humans', 2] },
  swordsman: { name: 'Swordsmen', one: 'Swordsman', faction: 'castle', tier: 4, atk: 10, def: 12, min: 6, max: 9, hp: 35, speed: 3, growth: 4, cost: { gold: 300 }, vmul: 1.12, sprite: ['humans', 3] },
  monk: { name: 'Monks', one: 'Monk', faction: 'castle', tier: 5, atk: 12, def: 7, min: 10, max: 12, hp: 30, speed: 3, shots: 12, growth: 3, cost: { gold: 400 }, vmul: 0.9, sprite: ['humans', 4] },
  cavalier: { name: 'Cavaliers', one: 'Cavalier', faction: 'castle', tier: 6, atk: 15, def: 15, min: 15, max: 25, hp: 100, speed: 5, joust: true, growth: 2, cost: { gold: 1000, gems: 1 }, vmul: 1.45, sprite: ['humans', 5] },
  // Necropolis
  skeleton: { name: 'Skeletons', one: 'Skeleton', faction: 'necro', tier: 1, atk: 5, def: 4, min: 1, max: 3, hp: 6, speed: 3, undead: true, growth: 12, cost: { gold: 60 }, sprite: ['undead', 0] },
  zombie: { name: 'Zombies', one: 'Zombie', faction: 'necro', tier: 2, atk: 5, def: 5, min: 2, max: 3, hp: 20, speed: 2, undead: true, growth: 8, cost: { gold: 100 }, vmul: 1.1, sprite: ['undead', 1] },
  wight: { name: 'Wights', one: 'Wight', faction: 'necro', tier: 3, atk: 7, def: 7, min: 3, max: 5, hp: 18, speed: 4, fly: true, regen: true, undead: true, growth: 7, cost: { gold: 200 }, vmul: 1.12, sprite: ['undead', 3] },
  vampire: { name: 'Vampires', one: 'Vampire', faction: 'necro', tier: 4, atk: 10, def: 9, min: 5, max: 8, hp: 30, speed: 4, fly: true, noRetal: true, drain: true, undead: true, growth: 4, cost: { gold: 360 }, vmul: 1.5, sprite: ['undead', 4] },
  lich: { name: 'Liches', one: 'Lich', faction: 'necro', tier: 5, atk: 13, def: 10, min: 11, max: 13, hp: 30, speed: 3, shots: 12, splash: true, undead: true, growth: 3, cost: { gold: 550 }, vmul: 0.85, sprite: ['undead', 5] },
  deathknight: { name: 'Death Knights', one: 'Death Knight', faction: 'necro', tier: 6, atk: 16, def: 16, min: 15, max: 30, hp: 120, speed: 4, deathBlow: true, undead: true, growth: 2, cost: { gold: 1300, gems: 1 }, vmul: 1.8, sprite: ['undead', 6] },
  // Neutrals (wandering monsters and map dwellings)
  goblin: { name: 'Goblins', one: 'Goblin', faction: 'neutral', tier: 1, atk: 4, def: 2, min: 1, max: 2, hp: 5, speed: 4, growth: 15, cost: { gold: 40 }, sprite: ['barb', 0] },
  pixie: { name: 'Pixies', one: 'Pixie', faction: 'neutral', tier: 1, atk: 3, def: 3, min: 1, max: 2, hp: 4, speed: 5, fly: true, growth: 15, cost: { gold: 35 }, vmul: 0.8, sprite: ['elves', 0] },
  dwarf: { name: 'Dwarves', one: 'Dwarf', faction: 'neutral', tier: 2, atk: 6, def: 7, min: 2, max: 4, hp: 20, speed: 2, resist: true, growth: 8, cost: { gold: 120 }, sprite: ['elves', 1] },
  wolfrider: { name: 'Wolf Riders', one: 'Wolf Rider', faction: 'neutral', tier: 2, atk: 7, def: 5, min: 2, max: 4, hp: 10, speed: 5, growth: 9, cost: { gold: 100 }, sprite: ['barb', 2] },
  centaur: { name: 'Centaurs', one: 'Centaur', faction: 'neutral', tier: 3, atk: 8, def: 4, min: 3, max: 5, hp: 14, speed: 4, shots: 8, growth: 6, cost: { gold: 180 }, sprite: ['barb', 3] },
  hunter: { name: 'Hunters', one: 'Hunter', faction: 'neutral', tier: 3, atk: 9, def: 5, min: 3, max: 5, hp: 15, speed: 3, shots: 12, growth: 6, cost: { gold: 200 }, sprite: ['elves', 3] },
  troll: { name: 'Trolls', one: 'Troll', faction: 'neutral', tier: 4, atk: 12, def: 10, min: 8, max: 12, hp: 45, speed: 3, regen: true, growth: 3, cost: { gold: 450 }, vmul: 2, sprite: ['barb', 5] },
  treant: { name: 'Treants', one: 'Treant', faction: 'neutral', tier: 5, atk: 12, def: 16, min: 10, max: 14, hp: 70, speed: 2, growth: 2, cost: { gold: 600 }, vmul: 1.3, sprite: ['elves', 6] },
  cyclops: { name: 'Cyclopes', one: 'Cyclops', faction: 'neutral', tier: 6, atk: 17, def: 13, min: 16, max: 20, hp: 80, speed: 3, shots: 10, growth: 1, cost: { gold: 1100, gems: 1 }, vmul: 0.82, sprite: ['barb', 6] },
};

export const NEUTRALS_BY_TIER = {
  1: ['goblin', 'pixie'], 2: ['dwarf', 'wolfrider'], 3: ['centaur', 'hunter'], 4: ['troll'], 5: ['treant'], 6: ['cyclops'],
};

/** Rough fighting value of one creature (used by the AI and to describe stack sizes). */
export function creatureValue(type) {
  const c = CREATURES[type];
  const dmg = (c.min + c.max) / 2;
  let v = Math.sqrt(c.hp * dmg) * (1 + (c.atk + c.def) / 20) * (0.8 + c.speed * 0.08);
  if (c.shots) v *= 1.35;
  if (c.fly) v *= 1.1;
  return v * (c.vmul || 1);  // vmul: calibrated against simulated battles (see tests)
}

export function armyValue(army, hero) {
  let v = 0;
  for (const s of army) if (s && s.count > 0) v += creatureValue(s.type) * s.count;
  if (hero) v *= 1 + 0.05 * (hero.atk + hero.def) + 0.04 * (hero.pow) * Math.min(1, (hero.spells?.length || 0));
  return v;
}

/** HoMM-style words for how many creatures are in a stack. */
export function sizeWord(n) {
  if (n < 5) return 'A few';
  if (n < 10) return 'Several';
  if (n < 20) return 'A pack of';
  if (n < 50) return 'Lots of';
  if (n < 100) return 'A horde of';
  return 'A legion of';
}

export const FACTIONS = {
  castle: {
    name: 'Castle', townName: 'Castle', creatures: ['pikeman', 'archer', 'griffin', 'swordsman', 'monk', 'cavalier'],
    dwellings: ['Guardhouse', 'Archery Range', 'Griffin Tower', 'Barracks', 'Monastery', 'Training Grounds'],
    heroSheet: 'heroC', iconRow: 112, townRow: 176, dwellRow: 112,
    classes: [{ id: 'knight', name: 'Knight', might: true, start: { atk: 2, def: 2, pow: 1, know: 1 } },
      { id: 'cleric', name: 'Cleric', might: false, start: { atk: 1, def: 0, pow: 2, know: 2 } }],
    heroNames: ['Aldric', 'Bryn', 'Cedric', 'Elowen', 'Gareth', 'Isolde', 'Lorne', 'Mira', 'Osric', 'Rowena'],
    startSkill: ['offense', 'wisdom'],
  },
  necro: {
    name: 'Necropolis', townName: 'Necropolis', creatures: ['skeleton', 'zombie', 'wight', 'vampire', 'lich', 'deathknight'],
    dwellings: ['Cursed Temple', 'Graveyard', 'Tomb of Souls', 'Estate', 'Mausoleum', 'Hall of Darkness'],
    heroSheet: 'heroN', iconRow: 256, townRow: 416, dwellRow: 256,
    classes: [{ id: 'deathknight', name: 'Death Knight', might: true, start: { atk: 2, def: 2, pow: 1, know: 1 } },
      { id: 'necromancer', name: 'Necromancer', might: false, start: { atk: 1, def: 0, pow: 2, know: 2 } }],
    heroNames: ['Mordek', 'Vesna', 'Grimwald', 'Sabine', 'Drusk', 'Ilsa', 'Corvin', 'Nyx', 'Malgor', 'Thessaly'],
    startSkill: ['necromancy', 'necromancy'],
  },
};

// Town buildings. req = buildings needed first. dwelling = creature tier index (0-5).
export const BUILDINGS = {
  hall1: { name: 'Village Hall', desc: '+500 gold a day', cost: {}, pre: true },
  hall2: { name: 'Town Hall', desc: '+1000 gold a day', cost: { gold: 2500 }, req: ['hall1', 'tavern'] },
  hall3: { name: 'City Hall', desc: '+2000 gold a day', cost: { gold: 5000, gems: 4 }, req: ['hall2', 'market', 'guild1'] },
  fort: { name: 'Citadel', desc: '+50% growth, town defenders +5 Defense', cost: { gold: 2500, ore: 10 }, req: ['dw1'] },
  tavern: { name: 'Tavern', desc: 'Hire heroes here', cost: { gold: 500, wood: 5 } },
  market: { name: 'Marketplace', desc: 'Trade resources', cost: { gold: 500, wood: 5 } },
  guild1: { name: 'Mage Guild 1', desc: 'Teaches level 1 spells', cost: { gold: 1500, wood: 5, ore: 5 } },
  guild2: { name: 'Mage Guild 2', desc: 'Teaches level 2 spells', cost: { gold: 1500, wood: 5, ore: 5, gems: 4 }, req: ['guild1'] },
  guild3: { name: 'Mage Guild 3', desc: 'Teaches level 3 spells', cost: { gold: 2000, wood: 5, ore: 5, gems: 6 }, req: ['guild2'] },
  dw0: { dwelling: 0, cost: {}, pre: true },
  dw1: { dwelling: 1, cost: { gold: 1000, wood: 5 }, req: ['dw0'] },
  dw2: { dwelling: 2, cost: { gold: 1000, ore: 5 }, req: ['dw0'] },
  dw3: { dwelling: 3, cost: { gold: 2000, ore: 5, wood: 5 }, req: ['dw1'] },
  dw4: { dwelling: 4, cost: { gold: 3000, wood: 5, ore: 5, gems: 3 }, req: ['dw3', 'guild1'] },
  dw5: { dwelling: 5, cost: { gold: 5000, wood: 10, ore: 10, gems: 8 }, req: ['dw3', 'dw2'] },
};
export const BUILD_ORDER = ['hall1', 'hall2', 'hall3', 'tavern', 'market', 'fort', 'guild1', 'guild2', 'guild3', 'dw0', 'dw1', 'dw2', 'dw3', 'dw4', 'dw5'];

export function buildingName(id, faction) {
  const b = BUILDINGS[id];
  if (b.dwelling !== undefined) return FACTIONS[faction].dwellings[b.dwelling];
  return b.name;
}
export function buildingDesc(id, faction) {
  const b = BUILDINGS[id];
  if (b.dwelling !== undefined) {
    const t = FACTIONS[faction].creatures[b.dwelling];
    return `Recruit ${CREATURES[t].name} (+${CREATURES[t].growth}/week)`;
  }
  return b.desc;
}

// Spells. power scales with the hero's Spell Power (p). target: enemy | ally | any | area
export const SPELLS = {
  arrow: { name: 'Magic Arrow', level: 1, cost: 5, target: 'enemy', icon: [48, 0], desc: 'Deals 10 + 10 x Power damage' },
  cure: { name: 'Cure', level: 1, cost: 6, target: 'ally', icon: [0, 16], desc: 'Heals 20 + 10 x Power HP (can revive)' },
  stoneskin: { name: 'Stoneskin', level: 1, cost: 5, target: 'ally', icon: [32, 48], desc: '+5 Defense for the battle' },
  haste: { name: 'Haste', level: 2, cost: 6, target: 'ally', icon: [0, 80], desc: '+2 Speed for the battle' },
  slow: { name: 'Slow', level: 2, cost: 6, target: 'enemy', icon: [80, 80], desc: '-2 Speed for the battle' },
  bless: { name: 'Bless', level: 2, cost: 5, target: 'ally', icon: [32, 80], desc: 'Always deals maximum damage' },
  ice: { name: 'Ice Bolt', level: 2, cost: 8, target: 'enemy', icon: [80, 48], desc: 'Deals 20 + 20 x Power damage' },
  lightning: { name: 'Lightning', level: 3, cost: 10, target: 'enemy', icon: [80, 64], desc: 'Deals 25 + 25 x Power damage' },
  fireball: { name: 'Fireball', level: 3, cost: 12, target: 'area', icon: [64, 64], desc: '15 + 15 x Power to a 3x3 area' },
};
export const SPELL_IDS = Object.keys(SPELLS);
export const spellsOfLevel = (lv) => SPELL_IDS.filter((s) => SPELLS[s].level === lv);

// Artifacts: icon = [x, y] on art/artifacts.png (16x16), cut from HAS Items/AllItems.png
// so the game doesn't download the whole 600KB sheet for 10 icons.
export const ARTIFACTS = {
  sword: { name: 'Broadsword', desc: '+2 Attack', icon: [0, 0], atk: 2 },
  shield: { name: 'Lion Shield', desc: '+2 Defense', icon: [16, 0], def: 2 },
  helm: { name: 'Great Helm', desc: '+1 Attack, +1 Defense', icon: [32, 0], atk: 1, def: 1 },
  hat: { name: 'Wizard Hat', desc: '+2 Knowledge', icon: [48, 0], know: 2 },
  scepter: { name: 'Sun Scepter', desc: '+2 Spell Power', icon: [64, 0], pow: 2 },
  boots: { name: 'Winged Boots', desc: '+25 movement a day', icon: [80, 0], move: 25 },
  coin: { name: 'Endless Coin', desc: '+250 gold a day', icon: [96, 0], gold: 250 },
  medal: { name: 'Hero Medal', desc: '+1 to all skills', icon: [112, 0], atk: 1, def: 1, pow: 1, know: 1 },
  compass: { name: 'Spyglass', desc: '+2 sight range', icon: [128, 0], sight: 2 },
  lamp: { name: 'Genie Lamp', desc: '+1 Power, +1 Knowledge', icon: [144, 0], pow: 1, know: 1 },
};
export const ARTIFACT_IDS = Object.keys(ARTIFACTS);

// Secondary skills, 3 levels (Basic, Advanced, Expert).
export const SKILLS = {
  offense: { name: 'Offense', desc: ['+10% melee damage', '+20% melee damage', '+30% melee damage'] },
  archery: { name: 'Archery', desc: ['+10% ranged damage', '+25% ranged damage', '+50% ranged damage'] },
  armorer: { name: 'Armorer', desc: ['-5% damage taken', '-10% damage taken', '-15% damage taken'] },
  logistics: { name: 'Logistics', desc: ['+10% movement', '+20% movement', '+30% movement'] },
  wisdom: { name: 'Wisdom', desc: ['Spells cost 1 less', 'Spells cost 2 less', 'Spells cost 3 less'] },
  sorcery: { name: 'Sorcery', desc: ['+10% spell damage', '+20% spell damage', '+30% spell damage'] },
  estates: { name: 'Estates', desc: ['+100 gold a day', '+200 gold a day', '+300 gold a day'] },
  scouting: { name: 'Scouting', desc: ['+1 sight range', '+2 sight range', '+3 sight range'] },
  mysticism: { name: 'Mysticism', desc: ['+2 mana a day', '+4 mana a day', '+6 mana a day'] },
  necromancy: { name: 'Necromancy', desc: ['Raise 10% of foes as skeletons', 'Raise 20% of foes as skeletons', 'Raise 30% of foes as skeletons'], necroOnly: true },
};
export const SKILL_IDS = Object.keys(SKILLS);
export const LEVEL_WORD = ['', 'Basic', 'Advanced', 'Expert'];
export const MAX_SKILLS = 5;

export const skillLv = (hero, id) => hero.skills?.[id] || 0;
export const SKILL_EFFECT = {
  offense: [0, 0.1, 0.2, 0.3],
  archery: [0, 0.1, 0.25, 0.5],
  armorer: [0, 0.05, 0.1, 0.15],
  logistics: [0, 0.1, 0.2, 0.3],
  sorcery: [0, 0.1, 0.2, 0.3],
  necromancy: [0, 0.1, 0.2, 0.3],
};

/** Experience needed for each level (index = level). */
export function expForLevel(lv) {
  if (lv <= 1) return 0;
  let t = 0;
  for (let l = 2; l <= lv; l++) t += 800 + (l - 2) * 400 + Math.max(0, l - 6) * 600;
  return t;
}

// Adventure map objects. sprite = [sheet, x, y, w, h] on a loaded sheet.
export const MINES = {
  gold: { name: 'Gold Mine', amount: 1000, sprite: ['b22', 128, 64, 32, 32] },
  wood: { name: 'Sawmill', amount: 2, sprite: ['b22', 96, 160, 32, 32] },
  ore: { name: 'Ore Pit', amount: 2, sprite: ['b22', 0, 160, 32, 32] },
  gems: { name: 'Crystal Cave', amount: 1, sprite: ['b22', 64, 128, 32, 32] },
};
export const PILES = {
  gold: { sprite: ['b11', 112, 32, 16, 16], amount: [500, 1000] },
  wood: { sprite: ['b11', 96, 32, 16, 16], amount: [5, 10] },
  ore: { sprite: ['b11', 128, 32, 16, 16], amount: [5, 10] },
  gems: { sprite: ['b11', 176, 32, 16, 16], amount: [3, 5] },
};
export const BOOSTS = {
  ruby: { name: 'Ruby of Offence', desc: '+1 Attack', atk: 1, sprite: ['b11', 48, 0, 16, 16] },
  sapphire: { name: 'Sapphire of Defense', desc: '+1 Defense', def: 1, sprite: ['b11', 32, 0, 16, 16] },
  opal: { name: 'Opal of Magic', desc: '+1 Spell Power', pow: 1, sprite: ['b11', 0, 0, 16, 16] },
  library: { name: 'Arcane Library', desc: '+1 Knowledge', know: 1, sprite: ['b22', 32, 0, 32, 32], big: true },
  arena: { name: 'Arena', desc: '+1 Attack, +1 Defense', atk: 1, def: 1, sprite: ['b22', 32, 64, 32, 32], big: true },
  stone: { name: 'Learning Stone', desc: '+1000 experience', exp: 1000, sprite: ['b11', 64, 32, 16, 16] },
  tree: { name: 'Tree of Knowledge', desc: 'Gain a level', level: 1, sprite: ['b22', 0, 0, 32, 32], big: true },
  fountain: { name: 'Magic Fountain', desc: 'Refills spell points (daily)', mana: true, daily: true, sprite: ['b11', 32, 32, 16, 16] },
  stables: { name: 'Stables', desc: '+30 movement today (daily)', move: 30, daily: true, sprite: ['b22', 128, 192, 32, 32], big: true },
  shrine: { name: 'Shrine of Magic', desc: 'Learn a spell', spell: true, sprite: ['b22', 0, 192, 32, 32], big: true },
};
// Neutral creature dwellings on the map: recruit weekly.
export const MAP_DWELLINGS = {
  goblin: { name: 'Goblin Barracks', sprite: ['dwell', 0, 16, 32, 32] },
  wolfrider: { name: 'Wolf Pen', sprite: ['dwell', 64, 16, 32, 32] },
  dwarf: { name: 'Dwarven Mine', sprite: ['dwell', 32, 304, 32, 32] },
  hunter: { name: 'Hunter Cabin', sprite: ['dwell', 96, 304, 32, 32] },
  pixie: { name: 'Magic Garden', sprite: ['dwell', 0, 304, 32, 32] },
};

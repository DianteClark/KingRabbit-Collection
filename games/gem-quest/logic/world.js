// The campaign: four regions, each with 8 battles (the last is a boss), 2 side quests, a puzzle
// and a town shop. Monsters scale with p, the battle's place in the campaign (1-32).

export const ENEMIES = {
  goblin: { name: 'Goblin', sprite: 'strong:16', hp: 28, skull: 1, skills: ['bite'] },
  rat: { name: 'Giant Rat', sprite: 'necro:48', hp: 30, skull: 1, skills: ['bite', 'venom'] },
  bandit: { name: 'Bandit', sprite: 'castle:16', hp: 34, skull: 2, skills: ['slash', 'guard'] },
  wolfRider: { name: 'Wolf Rider', sprite: 'strong:48', hp: 36, skull: 2, skills: ['bite', 'howl'] },
  orc: { name: 'Orc Grunt', sprite: 'strong:112', hp: 40, skull: 2, skills: ['slash', 'stomp'] },
  treant: { name: 'Old Treant', sprite: 'rampart:112', hp: 44, skull: 2, skills: ['mend', 'quake'] },
  ogre: { name: 'Ogre Brute', sprite: 'strong:96', hp: 48, skull: 2, skills: ['stomp', 'howl'], elite: true },
  hydra: { name: 'Swamp Hydra', sprite: 'boss1:48', hp: 64, skull: 2, skills: ['venom', 'bite', 'mend'], boss: true },
  crossbow: { name: 'Crossbowman', sprite: 'castle:32', hp: 34, skull: 2, skills: ['arrow', 'guard'] },
  bogMaw: { name: 'Bog Maw', sprite: 'boss1:0', hp: 50, skull: 2, skills: ['bite', 'boneCall'], elite: true },

  skeleton: { name: 'Skeleton', sprite: 'necro:16', hp: 36, skull: 2, skills: ['slash', 'boneCall'] },
  zombie: { name: 'Zombie', sprite: 'necro:32', hp: 40, skull: 2, skills: ['bite', 'venom'] },
  wraith: { name: 'Wraith', sprite: 'necro:192', hp: 34, skull: 2, skills: ['manaBurn', 'curse'] },
  acolyte: { name: 'Acolyte', sprite: 'necro:96', hp: 38, skull: 2, skills: ['drainLife', 'boneCall'] },
  vampire: { name: 'Vampire', sprite: 'necro:80', hp: 40, skull: 2, skills: ['drainLife', 'bite'] },
  graveKnight: { name: 'Grave Knight', sprite: 'necro:64', hp: 44, skull: 2, skills: ['slash', 'guard', 'stomp'] },
  lich: { name: 'Lich', sprite: 'necro:208', hp: 46, skull: 2, skills: ['iceShard', 'boneCall', 'manaBurn'], elite: true },
  beholder: { name: 'Beholder', sprite: 'boss2:72', hp: 60, skull: 2, skills: ['gaze', 'firebolt', 'curse'], boss: true },
  stalker: { name: 'Shadow Stalker', sprite: 'boss2:120', hp: 44, skull: 2, skills: ['curse', 'drainLife'], elite: true },
  kraken: { name: 'Kraken', sprite: 'boss1:24', hp: 50, skull: 2, skills: ['iceShard', 'guard', 'bite'], elite: true },

  gargoyle: { name: 'Gargoyle', sprite: 'tower:32', hp: 38, skull: 2, skills: ['guard', 'slash'] },
  naga: { name: 'Naga', sprite: 'tower:64', hp: 38, skull: 2, skills: ['venom', 'iceShard'] },
  golem: { name: 'Stone Golem', sprite: 'tower:48', hp: 46, skull: 2, skills: ['guard', 'quake'] },
  darkMage: { name: 'Dark Mage', sprite: 'castle:80', hp: 36, skull: 2, skills: ['firebolt', 'manaBurn', 'hex'] },
  ironGolem: { name: 'Iron Golem', sprite: 'tower:160', hp: 48, skull: 2, skills: ['guard', 'stomp'] },
  cyclops: { name: 'Cyclops', sprite: 'tower:224', hp: 48, skull: 3, skills: ['stomp', 'quake'] },
  drake: { name: 'Green Drake', sprite: 'boss2:24', hp: 52, skull: 2, skills: ['breath', 'howl'], elite: true },
  titan: { name: 'Frost Titan', sprite: 'boss2:96', hp: 64, skull: 3, skills: ['blizzard', 'iceShard', 'guard'], boss: true },
  minotaur: { name: 'Minotaur', sprite: 'inferno:192', hp: 50, skull: 3, skills: ['stomp', 'howl'], elite: true },
  stormGiant: { name: 'Storm Giant', sprite: 'tower:112', hp: 52, skull: 2, skills: ['blizzard', 'quake'], elite: true },

  imp: { name: 'Imp', sprite: 'inferno:16', hp: 36, skull: 2, skills: ['firebolt', 'hex'] },
  hellhound: { name: 'Hellhound', sprite: 'inferno:48', hp: 40, skull: 2, skills: ['bite', 'firebolt'] },
  demon: { name: 'Demon', sprite: 'inferno:32', hp: 44, skull: 2, skills: ['slash', 'curse'] },
  efreet: { name: 'Efreet', sprite: 'inferno:96', hp: 44, skull: 2, skills: ['firebolt', 'guard', 'breath'] },
  pitFiend: { name: 'Pit Fiend', sprite: 'inferno:112', hp: 48, skull: 3, skills: ['stomp', 'drainLife'] },
  devil: { name: 'Devil', sprite: 'inferno:240', hp: 46, skull: 2, skills: ['hex', 'manaBurn', 'curse'] },
  blackKnight: { name: 'Black Knight', sprite: 'necro:112', hp: 54, skull: 3, skills: ['slash', 'guard', 'stomp'], elite: true },
  dragon: { name: 'Red Dragon', sprite: 'boss2:0', hp: 72, skull: 3, skills: ['breath', 'howl', 'firebolt', 'guard'], boss: true },
  fireGiant: { name: 'Fire Giant', sprite: 'inferno:224', hp: 54, skull: 3, skills: ['breath', 'stomp'], elite: true },
  deathKnight: { name: 'Death Knight', sprite: 'necro:240', hp: 54, skull: 3, skills: ['drainLife', 'curse', 'slash'], elite: true },
};

/** A monster at campaign position p (1-32; the tower goes higher). */
export function enemyStats(id, p) {
  const e = ENEMIES[id];
  const mult = e.boss ? 1.2 : e.elite ? 1.15 : 1;
  return {
    id,
    name: e.name,
    sprite: e.sprite,
    maxHp: Math.round(e.hp * (1 + 0.11 * (p - 1)) * mult),
    skull: e.skull + Math.floor((p - 1) / 6) + (e.boss ? 1 : 0),
    level: p,
    skills: e.skills,
    boss: !!e.boss,
    elite: !!e.elite,
  };
}

export const REGIONS = [
  {
    id: 'greenwood', name: 'Greenwood', bg: '#2c3a24', ground: '#3d5230', tint: 0x6c8c50,
    battles: ['goblin', 'rat', 'bandit', 'wolfRider', 'orc', 'treant', 'ogre', 'hydra'],
    quests: [
      { id: 'q1a', enemy: 'crossbow', after: 3, name: 'Ambush on the Road', text: 'Crossbowmen hold the bridge. Beat them within 14 turns.', rules: { turnLimit: 14 }, reward: 'luckyCoin' },
      { id: 'q1b', enemy: 'bogMaw', after: 6, name: 'The Bog Maw', text: 'Something huge lurks in the marsh. You start the fight wounded.', rules: { startHp: 0.7 }, reward: 'emberCharm' },
    ],
    puzzle: { id: 'p1', after: 2 },
  },
  {
    id: 'crypt', name: 'Haunted Crypt', bg: '#231c2c', ground: '#342a40', tint: 0x8a8fc4,
    battles: ['skeleton', 'zombie', 'wraith', 'acolyte', 'vampire', 'graveKnight', 'lich', 'beholder'],
    quests: [
      { id: 'q2a', enemy: 'stalker', after: 3, name: 'Shadows in the Nave', text: 'A stalker hunts the crypt keepers. Win within 16 turns.', rules: { turnLimit: 16 }, reward: 'ghostShroud' },
      { id: 'q2b', enemy: 'kraken', after: 6, name: 'The Flooded Vault', text: 'The lower vault is flooded, and something stirs. You start wounded.', rules: { startHp: 0.7 }, reward: 'boneCharm' },
    ],
    puzzle: { id: 'p2', after: 2 },
  },
  {
    id: 'peaks', name: 'Frost Peaks', bg: '#1f2c3a', ground: '#34485c', tint: 0x8fc3ff,
    battles: ['gargoyle', 'naga', 'golem', 'darkMage', 'ironGolem', 'cyclops', 'drake', 'titan'],
    quests: [
      { id: 'q3a', enemy: 'minotaur', after: 3, name: 'The Ice Maze', text: 'A minotaur guards the frozen maze. Win within 18 turns.', rules: { turnLimit: 18 }, reward: 'frostBrand' },
      { id: 'q3b', enemy: 'stormGiant', after: 6, name: 'Storm on the Summit', text: 'A giant calls the storm down. You start wounded.', rules: { startHp: 0.7 }, reward: 'stormAmulet' },
    ],
    puzzle: { id: 'p3', after: 2 },
  },
  {
    id: 'rift', name: 'Infernal Rift', bg: '#3a1c1c', ground: '#4e282e', tint: 0xd88038,
    battles: ['imp', 'hellhound', 'demon', 'efreet', 'pitFiend', 'devil', 'blackKnight', 'dragon'],
    quests: [
      { id: 'q4a', enemy: 'fireGiant', after: 3, name: 'The Burning Forge', text: 'The fire giant forges blades for the dragon. Win within 16 turns.', rules: { turnLimit: 16 }, reward: 'dragonFang' },
      { id: 'q4b', enemy: 'deathKnight', after: 6, name: 'The Last Oath', text: 'A fallen knight bars the way to the lair. You start wounded.', rules: { startHp: 0.7 }, reward: 'phoenixFeather' },
    ],
    puzzle: { id: 'p4', after: 2 },
  },
];

/** Shop stock per region (items from earlier regions stay on sale). */
export const SHOP = [
  ['leatherVest', 'ironSword', 'rubyRing', 'sapphireRing'],
  ['emeraldRing', 'topazRing', 'chainMail', 'magicWand', 'warAxe', 'spellTome'],
  ['plateArmor', 'runeBlade', 'manaCrystal'],
  ['dragonScale', 'sageAmulet'],
];

/** Heroes who join at the start of a region. */
export const JOINS = { 0: ['knight', 'mage'], 1: ['ranger'], 2: ['berserker'] };

export const BATTLES_PER_REGION = 8;
export const TOTAL_BATTLES = REGIONS.length * BATTLES_PER_REGION;

/** Node id for a main battle: 'b<region>-<k>' (k 1-8). */
export const battleId = (r, k) => `b${r}-${k}`;
export const globalP = (r, k) => r * BATTLES_PER_REGION + k;

/** Every node of a region in display order: { id, kind, k?, quest?, puzzle? } */
export function regionNodes(r) {
  const reg = REGIONS[r];
  const out = reg.battles.map((enemy, i) => ({ id: battleId(r, i + 1), kind: i === 7 ? 'boss' : 'battle', k: i + 1, enemy, p: globalP(r, i + 1) }));
  for (const q of reg.quests) out.push({ id: q.id, kind: 'quest', after: q.after, enemy: q.enemy, p: globalP(r, q.after) + 1, quest: q });
  out.push({ id: reg.puzzle.id, kind: 'puzzle', after: reg.puzzle.after, puzzle: reg.puzzle.id });
  return out;
}

export function findNode(id) {
  for (let r = 0; r < REGIONS.length; r++) {
    const n = regionNodes(r).find((x) => x.id === id);
    if (n) return { ...n, region: r };
  }
  return null;
}

/** XP and gold for winning a battle at position p. */
export function battleReward(p, { boss = false, elite = false, quest = false } = {}) {
  const mult = boss ? 2 : elite || quest ? 1.5 : 1;
  return { xp: Math.round((20 + 8 * p) * mult), gold: Math.round((12 + 3 * p) * mult) };
}

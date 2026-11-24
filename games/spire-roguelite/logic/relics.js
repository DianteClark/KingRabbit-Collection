// Relics: permanent passive effects for the rest of the run.
// Hooks (all optional): pickup(run, rng), combatStart(c), turnStart(c, turn), cardPlayed(c, card, def),
// turnEnd(c), combatEnd(run, c). c.counter(id) / c.setCounter(id, n) keep per-run counters.
// Flags read by the run/combat code: energy, noRest, noPotions, fewerCards, goldMult, keepHand, keepEnergy,
// eliteRelics, tungsten, phoenix.

export const RELICS = {
  // Starting relics
  herb: {
    name: 'Healing Herb', rarity: 'starter', art: 'ar:5,6',
    text: 'At the end of each fight, heal 8 HP.',
    combatEnd: (run) => { run.hp = Math.min(run.maxHp, run.hp + 8); },
  },
  tome: {
    name: 'Spell Tome', rarity: 'starter', art: 'ar:2,9',
    text: 'On the first turn of each fight, draw 2 extra cards and gain 1 Energy.',
    combatStart: (c) => c.addBonusDraw(2),
    turnStart: (c, turn) => { if (turn === 1) c.gainEnergy(1); },
  },
  fang: {
    name: 'Snake Fang', rarity: 'starter', art: 'ar:1,0',
    text: 'At the start of each fight, apply 3 Poison to ALL enemies.',
    combatStart: (c) => c.applyAll('poison', 3),
  },

  // Common
  anchor: { name: 'Anchor Stone', rarity: 'common', art: 'ar:4,0', text: 'Start each fight with 10 Block.', combatStart: (c) => c.gainRawBlock(10) },
  lantern: { name: 'Lantern', rarity: 'common', art: 'ar:3,7', text: 'Gain 1 extra Energy on the first turn of each fight.', turnStart: (c, turn) => { if (turn === 1) c.gainEnergy(1); } },
  medal: { name: "Warrior's Medal", rarity: 'common', art: 'ar:6,0', text: 'Start each fight with 1 Strength.', combatStart: (c) => c.applySelf('str', 1) },
  marbles: { name: 'Bag of Marbles', rarity: 'common', art: 'ar:6,4', text: 'Start each fight by applying 1 Vulnerable to ALL enemies.', combatStart: (c) => c.applyAll('vuln', 1) },
  bloodVial: { name: 'Blood Vial', rarity: 'common', art: 'ar:3,8', text: 'At the start of each fight, heal 2 HP.', combatStart: (c) => c.heal(2) },
  smoothStone: { name: 'Smooth Stone', rarity: 'common', art: 'ar:4,3', text: 'Start each fight with 1 Dexterity.', combatStart: (c) => c.applySelf('dex', 1) },
  honey: {
    name: 'Honey Pot', rarity: 'common', art: 'ar:4,6', text: 'Raise your Max HP by 7.',
    pickup: (run) => { run.maxHp += 7; run.hp += 7; },
  },
  sunflower: {
    name: 'Sunflower', rarity: 'common', art: 'ar:2,1', text: 'Every 3rd turn, gain 1 Energy.',
    turnStart: (c, turn) => { if (turn % 3 === 0) c.gainEnergy(1); },
  },
  orichalcum: {
    name: 'Orichalcum', rarity: 'common', art: 'ar:7,3', text: 'If you end your turn with no Block, gain 6 Block.',
    turnEnd: (c) => { if (c.playerBlock() === 0) c.gainRawBlock(6); },
  },
  drum: {
    name: 'War Drum', rarity: 'common', art: 'ar:2,6', text: 'Every 10th Attack you play deals double damage.',
    cardPlayed: (c, card, d) => {
      if (d.type !== 'attack') return;
      const n = c.counter('drum') + 1;
      c.setCounter('drum', n % 10);
      if (n % 10 === 9) c.setDoubleNext();
    },
  },

  // Uncommon
  ribbon: {
    name: "Dancer's Ribbon", rarity: 'uncommon', art: 'ar:9,5', text: 'Every 3 Attacks in one turn, gain 1 Dexterity.',
    cardPlayed: (c, card, d) => { if (d.type === 'attack' && c.attacksThisTurn() % 3 === 0) c.applySelf('dex', 1); },
  },
  fan: {
    name: 'Ornate Fan', rarity: 'uncommon', art: 'ar:1,7', text: 'Every 3 Attacks in one turn, gain 4 Block.',
    cardPlayed: (c, card, d) => { if (d.type === 'attack' && c.attacksThisTurn() % 3 === 0) c.gainRawBlock(4); },
  },
  letter: {
    name: 'Letter Opener', rarity: 'uncommon', art: 'ar:7,0', text: 'Every 3 Skills in one turn, deal 5 damage to ALL enemies.',
    cardPlayed: (c, card, d) => { if (d.type === 'skill' && c.skillsThisTurn() % 3 === 0) c.damageAll(5); },
  },
  meat: {
    name: 'Meat on the Bone', rarity: 'uncommon', art: 'ar:9,6', text: 'If you end a fight at or below half HP, heal 12 HP.',
    combatEnd: (run) => { if (run.hp <= run.maxHp / 2) run.hp = Math.min(run.maxHp, run.hp + 12); },
  },
  scales: { name: 'Bronze Scales', rarity: 'uncommon', art: 'ar:3,2', text: 'Start each fight with 3 Thorns.', combatStart: (c) => c.applySelf('thorns', 3) },
  cleat: { name: 'Horn Cleat', rarity: 'uncommon', art: 'ar:5,0', text: 'At the start of your 2nd turn, gain 14 Block.', turnStart: (c, turn) => { if (turn === 2) c.gainRawBlock(14); } },
  idol: { name: 'Golden Idol', rarity: 'uncommon', art: 'ar:4,8', text: 'Fights give 25% more gold.', goldMult: 1.25 },
  hourglass: { name: 'Hourglass', rarity: 'uncommon', art: 'ar:4,2', text: 'At the start of your turn, deal 3 damage to ALL enemies.', turnStart: (c) => c.damageAll(3) },

  // Rare
  stars: {
    name: 'Throwing Stars', rarity: 'rare', art: 'ar:9,0', text: 'Every 3 Attacks in one turn, gain 1 Strength.',
    cardPlayed: (c, card, d) => { if (d.type === 'attack' && c.attacksThisTurn() % 3 === 0) c.applySelf('str', 1); },
  },
  tungsten: { name: 'Tungsten Rod', rarity: 'rare', art: 'ar:5,2', text: 'Whenever you would lose HP, lose 1 less.', tungsten: true },
  urn: {
    name: 'Bird Urn', rarity: 'rare', art: 'ar:5,4', text: 'Whenever you play a Power, heal 2 HP.',
    cardPlayed: (c, card, d) => { if (d.type === 'power') c.heal(2); },
  },
  frostJar: { name: 'Frost Jar', rarity: 'rare', art: 'ar:6,9', text: 'Unspent Energy carries over to your next turn.', keepEnergy: true },
  phoenix: { name: 'Phoenix Feather', rarity: 'rare', art: 'ar:0,1', text: 'Once per run, when you would die, heal to half HP instead.', phoenix: true },

  // Boss relics
  philStone: { name: "Philosopher's Stone", rarity: 'boss', art: 'ar:5,3', text: '+1 Energy every turn. Enemies start fights with 1 Strength.', energy: 1, combatStart: (c) => { for (const e of c.livingEnemies()) c.apply(e, 'str', 1, true); } },
  lamp: { name: 'Sleepless Lamp', rarity: 'boss', art: 'ar:0,6', text: '+1 Energy every turn. You can no longer Rest at campfires.', energy: 1, noRest: true },
  chalice: { name: 'Cracked Chalice', rarity: 'boss', art: 'ar:9,7', text: '+1 Energy every turn. You can no longer get potions.', energy: 1, noPotions: true },
  crown: { name: 'Busted Crown', rarity: 'boss', art: 'sk:18,1', text: '+1 Energy every turn. Card rewards offer 2 fewer cards.', energy: 1, fewerCards: 2 },
  cube: { name: 'Runic Cube', rarity: 'boss', art: 'ar:3,9', text: 'You keep your hand at the end of each turn.', keepHand: true },
  blackStar: { name: 'Black Star', rarity: 'boss', art: 'ar:0,4', text: 'Elites drop 2 relics.', eliteRelics: 2 },
  tinyHouse: {
    name: 'Tiny House', rarity: 'boss', art: 'ar:5,7', text: 'Gain 50 gold, 5 Max HP, a potion, and upgrade a random card.',
    pickup: (run, rng, api) => { run.gold += 50; run.maxHp += 5; run.hp += 5; api.givePotion(run); api.upgradeRandom(run, 1); },
  },
};

export const relicPool = (rarity) => Object.entries(RELICS).filter(([, r]) => r.rarity === rarity).map(([id]) => id);

export const STARTER_RELIC = { knight: 'herb', mage: 'tome', ranger: 'fang' };

// Every card in the game. Pure data plus a play() function that talks to the combat engine.
//
//   cost     energy to play ('X' spends all your energy; v.X is how much was spent)
//   target   'enemy' (pick one) or 'none'
//   v / up   numbers used by play() and the text; `up` overrides them when the card is upgraded
//   text     {key} is replaced with the number. {dmg} and {block} show the real amount in a fight
//            (Strength, Weak, Vulnerable, Dexterity and Frail included).
//   art      'sheet:col,row' 16x16 icon (see frames.js)
//   flags    exhaust, ethereal, unplayable, innate; upFlags replaces them when upgraded

export const CLASSES = ['knight', 'mage', 'ranger'];

const C = {};
function card(id, def) {
  C[id] = { id, flags: {}, v: {}, target: 'none', ...def };
}

// ---------- Basic cards (every hero) ----------
card('strike', {
  name: 'Strike', cls: 'basic', type: 'attack', rarity: 'starter', cost: 1, target: 'enemy', art: 'sp:6,5',
  text: 'Deal {dmg} damage.', v: { dmg: 6 }, up: { dmg: 9 },
  play: (c, v, t) => c.attack(t, v.dmg),
});
card('defend', {
  name: 'Defend', cls: 'basic', type: 'skill', rarity: 'starter', cost: 1, art: 'sp:1,2',
  text: 'Gain {block} Block.', v: { block: 5 }, up: { block: 8 },
  play: (c, v) => c.block(v.block),
});

// ---------- Knight: Strength, Block and big hits ----------
card('bash', {
  name: 'Bash', cls: 'knight', type: 'attack', rarity: 'starter', cost: 2, target: 'enemy', art: 'sk:16,1',
  text: 'Deal {dmg} damage. Apply {n} Vulnerable.', v: { dmg: 8, n: 2 }, up: { dmg: 10, n: 3 },
  play: (c, v, t) => { c.attack(t, v.dmg); c.apply(t, 'vuln', v.n); },
});
card('cleave', {
  name: 'Cleave', cls: 'knight', type: 'attack', rarity: 'common', cost: 1, art: 'sk:0,1',
  text: 'Deal {dmg} damage to ALL enemies.', v: { dmg: 8 }, up: { dmg: 11 },
  play: (c, v) => c.attackAll(v.dmg),
});
card('ironWave', {
  name: 'Iron Wave', cls: 'knight', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', art: 'sk:17,1',
  text: 'Gain {block} Block. Deal {dmg} damage.', v: { dmg: 6, block: 6 }, up: { dmg: 8, block: 8 },
  play: (c, v, t) => { c.block(v.block); c.attack(t, v.dmg); },
});
card('twinStrike', {
  hits: 2,
  name: 'Twin Strike', cls: 'knight', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', art: 'sk:14,1',
  text: 'Deal {dmg} damage twice.', v: { dmg: 6 }, up: { dmg: 8 },
  play: (c, v, t) => c.attack(t, v.dmg, 2),
});
card('shieldBash', {
  name: 'Shield Bash', cls: 'knight', type: 'attack', rarity: 'common', cost: 1, upCost: 0, target: 'enemy', art: 'sk:1,1',
  text: 'Deal damage equal to your Block.', v: {},
  play: (c, v, t) => c.attack(t, c.playerBlock()),
});
card('pommel', {
  name: 'Pommel Strike', cls: 'knight', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', art: 'sk:10,1',
  text: 'Deal {dmg} damage. Draw {n} card(s).', v: { dmg: 9, n: 1 }, up: { dmg: 10, n: 2 },
  play: (c, v, t) => { c.attack(t, v.dmg); c.draw(v.n); },
});
card('shrugOff', {
  name: 'Shrug It Off', cls: 'knight', type: 'skill', rarity: 'common', cost: 1, art: 'sk:6,4',
  text: 'Gain {block} Block. Draw 1 card.', v: { block: 8 }, up: { block: 11 },
  play: (c, v) => { c.block(v.block); c.draw(1); },
});
card('rally', {
  name: 'Rally', cls: 'knight', type: 'skill', rarity: 'common', cost: 0, art: 'sk:11,1',
  text: 'Gain {n} Strength. Lose it at the end of this turn.', v: { n: 2 }, up: { n: 4 },
  play: (c, v) => { c.applySelf('str', v.n); c.applySelf('strDown', v.n); },
});
card('hamstring', {
  name: 'Hobble', cls: 'knight', type: 'attack', rarity: 'common', cost: 2, target: 'enemy', art: 'sk:3,7',
  text: 'Deal {dmg} damage. Apply {n} Weak.', v: { dmg: 12, n: 2 }, up: { dmg: 14, n: 3 },
  play: (c, v, t) => { c.attack(t, v.dmg); c.apply(t, 'weak', v.n); },
});
card('heavyBlow', {
  name: 'Heavy Blow', cls: 'knight', type: 'attack', rarity: 'common', cost: 2, target: 'enemy', art: 'sp:2,3',
  text: 'Deal {dmg} damage. Strength counts {m} times.', v: { dmg: 14, m: 3, strMult: 3 }, up: { dmg: 14, m: 5, strMult: 5 },
  play: (c, v, t) => c.attack(t, v.dmg, 1, { strMult: v.strMult }),
});
card('entrench', {
  name: 'Entrench', cls: 'knight', type: 'skill', rarity: 'uncommon', cost: 2, upCost: 1, art: 'ar:1,4',
  text: 'Double your Block.', v: {},
  play: (c) => c.gainRawBlock(c.playerBlock()),
});
card('might', {
  name: 'Might', cls: 'knight', type: 'power', rarity: 'uncommon', cost: 1, art: 'sp:7,3',
  text: 'Gain {n} Strength.', v: { n: 2 }, up: { n: 3 },
  play: (c, v) => c.applySelf('str', v.n),
});
card('uppercut', {
  name: 'Uppercut', cls: 'knight', type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy', art: 'ar:0,5',
  text: 'Deal {dmg} damage. Apply {n} Weak and {n} Vulnerable.', v: { dmg: 13, n: 1 }, up: { dmg: 13, n: 2 },
  play: (c, v, t) => { c.attack(t, v.dmg); c.apply(t, 'weak', v.n); c.apply(t, 'vuln', v.n); },
});
card('spikedArmor', {
  name: 'Spiked Armor', cls: 'knight', type: 'power', rarity: 'uncommon', cost: 1, art: 'sp:5,2',
  text: 'Gain {n} Thorns (attackers take {n} damage).', v: { n: 3 }, up: { n: 5 },
  play: (c, v) => c.applySelf('thorns', v.n),
});
card('ironSkin', {
  name: 'Iron Skin', cls: 'knight', type: 'power', rarity: 'uncommon', cost: 1, art: 'ar:1,5',
  text: 'At the end of each turn, gain {n} Block.', v: { n: 3 }, up: { n: 4 },
  play: (c, v) => c.applySelf('plate', v.n),
});
card('whirlwind', {
  hits: 'X',
  name: 'Cyclone', cls: 'knight', type: 'attack', rarity: 'uncommon', cost: 'X', art: 'sp:0,3',
  text: 'Deal {dmg} damage to ALL enemies X times.', v: { dmg: 5 }, up: { dmg: 8 },
  play: (c, v) => { for (let i = 0; i < v.X; i++) c.attackAll(v.dmg); },
});
card('reckless', {
  name: 'Reckless Swing', cls: 'knight', type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy', art: 'sk:9,6',
  text: 'Ethereal. Deal {dmg} damage.', v: { dmg: 20 }, up: { dmg: 28 }, flags: { ethereal: true },
  play: (c, v, t) => c.attack(t, v.dmg),
});
card('disarm', {
  name: 'Disarm', cls: 'knight', type: 'skill', rarity: 'uncommon', cost: 1, target: 'enemy', art: 'sk:0,6',
  text: 'Enemy loses {n} Strength. Exhaust.', v: { n: 2 }, up: { n: 3 }, flags: { exhaust: true },
  play: (c, v, t) => c.apply(t, 'str', -v.n),
});
card('secondWind', {
  name: 'Battle Trance', cls: 'knight', type: 'skill', rarity: 'uncommon', cost: 1, upCost: 0, art: 'sk:18,1',
  text: 'Gain 2 Energy. Exhaust.', v: {}, flags: { exhaust: true },
  play: (c) => c.gainEnergy(2),
});
card('warlord', {
  name: 'Warlord', cls: 'knight', type: 'power', rarity: 'rare', cost: 3, art: 'sk:11,1',
  text: 'At the start of each turn, gain {n} Strength.', v: { n: 2 }, up: { n: 3 },
  play: (c, v) => c.applySelf('warlord', v.n),
});
card('bulwark', {
  name: 'Bulwark', cls: 'knight', type: 'power', rarity: 'rare', cost: 3, upCost: 2, art: 'sk:1,1',
  text: 'Block is no longer removed at the start of your turn.', v: {},
  play: (c) => c.applySelf('bulwark', 1),
});
card('aegis', {
  name: 'Aegis', cls: 'knight', type: 'skill', rarity: 'rare', cost: 2, art: 'ar:5,9',
  text: 'Gain {block} Block. Exhaust.', v: { block: 30 }, up: { block: 40 }, flags: { exhaust: true },
  play: (c, v) => c.block(v.block),
});
card('sunder', {
  name: 'Sunder', cls: 'knight', type: 'attack', rarity: 'rare', cost: 3, target: 'enemy', art: 'sk:3,7',
  text: 'Deal {dmg} damage.', v: { dmg: 32 }, up: { dmg: 42 },
  play: (c, v, t) => c.attack(t, v.dmg),
});
card('limitBreak', {
  name: 'Limit Break', cls: 'knight', type: 'skill', rarity: 'rare', cost: 1, art: 'sp:7,1',
  text: 'Double your Strength. Exhaust.', upText: 'Double your Strength.', v: {}, flags: { exhaust: true }, upFlags: {},
  play: (c) => c.applySelf('str', Math.max(0, c.playerStatus('str'))),
});

// ---------- Mage: fire, frost, lightning and arcane tricks ----------
card('spark', {
  name: 'Spark', cls: 'mage', type: 'attack', rarity: 'starter', cost: 1, art: 'sp:6,1',
  text: 'Deal {dmg} damage to ALL enemies.', v: { dmg: 6 }, up: { dmg: 9 },
  play: (c, v) => c.attackAll(v.dmg),
});
card('insight', {
  name: 'Insight', cls: 'mage', type: 'skill', rarity: 'starter', cost: 1, art: 'sp:3,4',
  text: 'Gain {block} Block. Draw 2 cards.', v: { block: 4 }, up: { block: 7 },
  play: (c, v) => { c.block(v.block); c.draw(2); },
});
card('firebolt', {
  name: 'Firebolt', cls: 'mage', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', art: 'sp:0,0',
  text: 'Deal {dmg} damage.', v: { dmg: 9 }, up: { dmg: 13 },
  play: (c, v, t) => c.attack(t, v.dmg),
});
card('frostShard', {
  name: 'Frost Shard', cls: 'mage', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', art: 'sp:2,6',
  text: 'Deal {dmg} damage. Apply {n} Weak.', v: { dmg: 6, n: 1 }, up: { dmg: 8, n: 2 },
  play: (c, v, t) => { c.attack(t, v.dmg); c.apply(t, 'weak', v.n); },
});
card('chainLightning', {
  hits: 'm',
  name: 'Chain Bolt', cls: 'mage', type: 'attack', rarity: 'common', cost: 1, art: 'sp:5,4',
  text: 'Deal {dmg} damage to a random enemy {m} times.', v: { dmg: 3, m: 3 }, up: { dmg: 3, m: 4 },
  play: (c, v) => { for (let i = 0; i < v.m; i++) c.attackRandom(v.dmg); },
});
card('iceBarrier', {
  name: 'Ice Barrier', cls: 'mage', type: 'skill', rarity: 'common', cost: 1, art: 'sp:3,2',
  text: 'Gain {block} Block. Apply 1 Weak to ALL enemies.', v: { block: 7 }, up: { block: 10 },
  play: (c, v) => { c.block(v.block); c.applyAll('weak', 1); },
});
card('channel', {
  name: 'Channel', cls: 'mage', type: 'skill', rarity: 'common', cost: 0, art: 'sp:6,4',
  text: 'Gain 1 Energy. Draw {n} card(s). Exhaust.', v: { n: 1 }, up: { n: 2 }, flags: { exhaust: true },
  play: (c, v) => { c.gainEnergy(1); c.draw(v.n); },
});
card('flameWave', {
  name: 'Flame Wave', cls: 'mage', type: 'attack', rarity: 'common', cost: 2, art: 'sp:2,4',
  text: 'Deal {dmg} damage to ALL enemies.', v: { dmg: 11 }, up: { dmg: 15 },
  play: (c, v) => c.attackAll(v.dmg),
});
card('arcaneMissile', {
  name: 'Magic Missile', cls: 'mage', type: 'attack', rarity: 'common', cost: 0, target: 'enemy', art: 'sp:7,5',
  text: 'Deal {dmg} damage.', v: { dmg: 4 }, up: { dmg: 7 },
  play: (c, v, t) => c.attack(t, v.dmg),
});
card('blink', {
  name: 'Blink', cls: 'mage', type: 'skill', rarity: 'common', cost: 1, art: 'sp:1,6',
  text: 'Gain {block} Block. Draw 1 card.', v: { block: 7 }, up: { block: 10 },
  play: (c, v) => { c.block(v.block); c.draw(1); },
});
card('meteor', {
  name: 'Meteor', cls: 'mage', type: 'attack', rarity: 'uncommon', cost: 3, art: 'sp:4,4',
  text: 'Deal {dmg} damage to ALL enemies.', v: { dmg: 20 }, up: { dmg: 27 },
  play: (c, v) => c.attackAll(v.dmg),
});
card('manaShield', {
  name: 'Mana Shield', cls: 'mage', type: 'skill', rarity: 'uncommon', cost: 2, art: 'sp:1,1',
  text: 'Gain {block} Block. Draw 1 card.', v: { block: 14 }, up: { block: 18 },
  play: (c, v) => { c.block(v.block); c.draw(1); },
});
card('overload', {
  name: 'Overload', cls: 'mage', type: 'skill', rarity: 'uncommon', cost: 0, art: 'sp:7,2',
  text: 'Gain {n} Energy. Shuffle a Dazed into your draw pile.', v: { n: 2 }, up: { n: 3 },
  play: (c, v) => { c.gainEnergy(v.n); c.addCard('dazed', 'draw', 1); },
});
card('pyromania', {
  name: 'Fire Soul', cls: 'mage', type: 'power', rarity: 'uncommon', cost: 1, art: 'sp:5,5',
  text: 'Whenever you play an Attack, deal {n} damage to ALL enemies.', v: { n: 2 }, up: { n: 3 },
  play: (c, v) => c.applySelf('pyro', v.n),
});
card('thunderclap', {
  name: 'Thunder Clap', cls: 'mage', type: 'attack', rarity: 'uncommon', cost: 1, art: 'sp:6,2',
  text: 'Deal {dmg} damage and apply 1 Vulnerable to ALL enemies.', v: { dmg: 6 }, up: { dmg: 9 },
  play: (c, v) => { c.attackAll(v.dmg); c.applyAll('vuln', 1); },
});
card('freeze', {
  name: 'Deep Freeze', cls: 'mage', type: 'skill', rarity: 'uncommon', cost: 1, target: 'enemy', art: 'sp:4,2',
  text: 'Enemy loses {n} Strength this turn. Exhaust.', v: { n: 6 }, up: { n: 9 }, flags: { exhaust: true },
  play: (c, v, t) => { c.apply(t, 'str', -v.n); c.apply(t, 'strUp', v.n); },
});
card('study', {
  name: 'Study', cls: 'mage', type: 'skill', rarity: 'uncommon', cost: 1, art: 'ar:2,9',
  text: 'Draw {n} cards.', v: { n: 3 }, up: { n: 4 },
  play: (c, v) => c.draw(v.n),
});
card('hex', {
  name: 'Hex', cls: 'mage', type: 'skill', rarity: 'uncommon', cost: 1, target: 'enemy', art: 'sp:6,0',
  text: 'Apply {n} Weak and {n} Vulnerable.', v: { n: 2 }, up: { n: 3 },
  play: (c, v, t) => { c.apply(t, 'weak', v.n); c.apply(t, 'vuln', v.n); },
});
card('firestorm', {
  hits: 'm',
  name: 'Fire Storm', cls: 'mage', type: 'attack', rarity: 'rare', cost: 3, art: 'sp:7,0',
  text: 'Deal {dmg} damage to ALL enemies {m} times.', v: { dmg: 7, m: 3 }, up: { dmg: 7, m: 4 },
  play: (c, v) => { for (let i = 0; i < v.m; i++) c.attackAll(v.dmg); },
});
card('archmage', {
  name: 'Archmage', cls: 'mage', type: 'power', rarity: 'rare', cost: 3, upCost: 2, art: 'sk:12,5',
  text: 'At the start of each turn, gain 1 Energy.', v: {},
  play: (c) => c.applySelf('archmage', 1),
});
card('glacier', {
  name: 'Glacier', cls: 'mage', type: 'skill', rarity: 'rare', cost: 2, art: 'sp:5,3',
  text: 'Gain {block} Block now and {block} Block next turn.', v: { block: 12 }, up: { block: 16 },
  play: (c, v) => { const b = c.block(v.block); c.applySelf('nextBlock', b); },
});
card('wildfire', {
  name: 'Wildfire', cls: 'mage', type: 'power', rarity: 'rare', cost: 2, art: 'sp:1,0',
  text: 'At the end of your turn, deal {n} damage to ALL enemies.', v: { n: 5 }, up: { n: 7 },
  play: (c, v) => c.applySelf('wildfire', v.n),
});

// ---------- Ranger: poison, quick hits and Dexterity ----------
card('venomArrow', {
  name: 'Venom Arrow', cls: 'ranger', type: 'attack', rarity: 'starter', cost: 1, target: 'enemy', art: 'sk:8,1',
  text: 'Deal {dmg} damage. Apply {n} Poison.', v: { dmg: 5, n: 3 }, up: { dmg: 7, n: 4 },
  play: (c, v, t) => { c.attack(t, v.dmg); c.apply(t, 'poison', v.n); },
});
card('sidestep', {
  name: 'Sidestep', cls: 'ranger', type: 'skill', rarity: 'starter', cost: 1, art: 'sp:0,5',
  text: 'Gain {block} Block. Draw 1 card.', v: { block: 7 }, up: { block: 10 },
  play: (c, v) => { c.block(v.block); c.draw(1); },
});
card('quickShot', {
  name: 'Quick Shot', cls: 'ranger', type: 'attack', rarity: 'common', cost: 0, target: 'enemy', art: 'sk:5,4',
  text: 'Deal {dmg} damage. Draw 1 card.', v: { dmg: 3 }, up: { dmg: 6 },
  play: (c, v, t) => { c.attack(t, v.dmg); c.draw(1); },
});
card('twinArrows', {
  hits: 2,
  name: 'Arrow Spray', cls: 'ranger', type: 'attack', rarity: 'common', cost: 1, art: 'sk:4,4',
  text: 'Deal {dmg} damage to ALL enemies twice.', v: { dmg: 4 }, up: { dmg: 6 },
  play: (c, v) => { c.attackAll(v.dmg); c.attackAll(v.dmg); },
});
card('poisonDart', {
  name: 'Poison Dart', cls: 'ranger', type: 'skill', rarity: 'common', cost: 1, target: 'enemy', art: 'sp:3,0',
  text: 'Apply {n} Poison.', v: { n: 6 }, up: { n: 8 },
  play: (c, v, t) => c.apply(t, 'poison', v.n),
});
card('backflip', {
  name: 'Backflip', cls: 'ranger', type: 'skill', rarity: 'common', cost: 1, art: 'sp:0,4',
  text: 'Gain {block} Block. Draw 2 cards.', v: { block: 5 }, up: { block: 8 },
  play: (c, v) => { c.block(v.block); c.draw(2); },
});
card('huntersMark', {
  name: "Hunter's Mark", cls: 'ranger', type: 'skill', rarity: 'common', cost: 1, target: 'enemy', art: 'sp:3,1',
  text: 'Apply {n} Vulnerable. Draw 1 card.', v: { n: 2 }, up: { n: 3 },
  play: (c, v, t) => { c.apply(t, 'vuln', v.n); c.draw(1); },
});
card('flurry', {
  hits: 'm',
  name: 'Flurry', cls: 'ranger', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', art: 'sk:11,6',
  text: 'Deal {dmg} damage {m} times.', v: { dmg: 2, m: 5 }, up: { dmg: 2, m: 7 },
  play: (c, v, t) => c.attack(t, v.dmg, v.m),
});
card('piercingShot', {
  name: 'Piercing Shot', cls: 'ranger', type: 'attack', rarity: 'common', cost: 2, target: 'enemy', art: 'ar:9,4',
  text: 'Deal {dmg} damage. Ignores Block.', v: { dmg: 14 }, up: { dmg: 19 },
  play: (c, v, t) => c.attack(t, v.dmg, 1, { pierce: true }),
});
card('toxicCloud', {
  name: 'Toxic Cloud', cls: 'ranger', type: 'skill', rarity: 'common', cost: 2, art: 'sp:2,1',
  text: 'Apply {n} Poison and 1 Weak to ALL enemies.', v: { n: 4 }, up: { n: 6 },
  play: (c, v) => { c.applyAll('poison', v.n); c.applyAll('weak', 1); },
});
card('noxious', {
  name: 'Noxious Fumes', cls: 'ranger', type: 'power', rarity: 'uncommon', cost: 1, art: 'sp:4,0',
  text: 'At the start of your turn, apply {n} Poison to ALL enemies.', v: { n: 2 }, up: { n: 3 },
  play: (c, v) => c.applySelf('noxious', v.n),
});
card('footwork', {
  name: 'Footwork', cls: 'ranger', type: 'power', rarity: 'uncommon', cost: 1, art: 'sp:0,5',
  text: 'Gain {n} Dexterity.', v: { n: 2 }, up: { n: 3 },
  play: (c, v) => c.applySelf('dex', v.n),
});
card('catalyst', {
  name: 'Catalyst', cls: 'ranger', type: 'skill', rarity: 'uncommon', cost: 1, target: 'enemy', art: 'ar:3,8',
  text: 'Double the enemy\'s Poison. Exhaust.', upText: 'Triple the enemy\'s Poison. Exhaust.', v: { m: 1 }, up: { m: 2 }, flags: { exhaust: true },
  play: (c, v, t) => c.apply(t, 'poison', c.enemyStatus(t, 'poison') * v.m),
});
card('bouncingFlask', {
  name: 'Bouncing Flask', cls: 'ranger', type: 'skill', rarity: 'uncommon', cost: 2, art: 'ar:9,3',
  text: 'Apply 3 Poison to a random enemy {m} times.', v: { m: 3 }, up: { m: 4 },
  play: (c, v) => { for (let i = 0; i < v.m; i++) c.applyRandom('poison', 3); },
});
card('rainOfArrows', {
  hits: 'm',
  name: 'Rain of Arrows', cls: 'ranger', type: 'attack', rarity: 'uncommon', cost: 2, art: 'sk:3,4',
  text: 'Deal {dmg} damage to a random enemy {m} times.', v: { dmg: 4, m: 5 }, up: { dmg: 4, m: 7 },
  play: (c, v) => { for (let i = 0; i < v.m; i++) c.attackRandom(v.dmg); },
});
card('legSweep', {
  name: 'Leg Sweep', cls: 'ranger', type: 'skill', rarity: 'uncommon', cost: 2, target: 'enemy', art: 'sk:8,4',
  text: 'Apply {n} Weak. Gain {block} Block.', v: { n: 2, block: 11 }, up: { n: 3, block: 14 },
  play: (c, v, t) => { c.apply(t, 'weak', v.n); c.block(v.block); },
});
card('predator', {
  name: 'Predator', cls: 'ranger', type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy', art: 'sk:15,1',
  text: 'Deal {dmg} damage. Draw 2 cards.', v: { dmg: 15 }, up: { dmg: 20 },
  play: (c, v, t) => { c.attack(t, v.dmg); c.draw(2); },
});
card('envenom', {
  name: 'Envenom', cls: 'ranger', type: 'power', rarity: 'rare', cost: 2, upCost: 1, art: 'sp:5,6',
  text: 'Whenever an Attack deals unblocked damage, apply 1 Poison.', v: {},
  play: (c) => c.applySelf('envenom', 1),
});
card('adrenaline', {
  name: 'Rush', cls: 'ranger', type: 'skill', rarity: 'rare', cost: 0, art: 'sk:4,1',
  text: 'Gain {n} Energy. Draw 2 cards. Exhaust.', v: { n: 1 }, up: { n: 2 }, flags: { exhaust: true },
  play: (c, v) => { c.gainEnergy(v.n); c.draw(2); },
});
card('eagleEye', {
  name: 'Eagle Eye', cls: 'ranger', type: 'power', rarity: 'rare', cost: 1, upCost: 0, art: 'sk:9,1',
  text: 'At the start of your turn, draw 1 more card.', v: {},
  play: (c) => c.applySelf('eagle', 1),
});
card('deathMark', {
  name: 'Death Mark', cls: 'ranger', type: 'skill', rarity: 'rare', cost: 2, upCost: 1, art: 'ar:0,0',
  text: 'Each enemy gains {n} Poison plus as much again as it already has.', v: { n: 5 }, up: { n: 8 },
  play: (c, v) => { for (const e of c.livingEnemies()) c.apply(e, 'poison', c.enemyStatus(e, 'poison') + v.n); },
});

// ---------- Neutral cards (shops and events) ----------
card('bandage', {
  name: 'Bandage Up', cls: 'neutral', type: 'skill', rarity: 'uncommon', cost: 0, art: 'sp:0,1',
  text: 'Heal {n} HP. Exhaust.', v: { n: 4 }, up: { n: 6 }, flags: { exhaust: true },
  play: (c, v) => c.heal(v.n),
});
card('flashSteel', {
  name: 'Flash of Steel', cls: 'neutral', type: 'attack', rarity: 'uncommon', cost: 0, target: 'enemy', art: 'sk:10,6',
  text: 'Deal {dmg} damage. Draw 1 card.', v: { dmg: 3 }, up: { dmg: 6 },
  play: (c, v, t) => { c.attack(t, v.dmg); c.draw(1); },
});
card('swiftStrike', {
  name: 'Swift Strike', cls: 'neutral', type: 'attack', rarity: 'uncommon', cost: 0, target: 'enemy', art: 'sk:9,6',
  text: 'Deal {dmg} damage.', v: { dmg: 7 }, up: { dmg: 10 },
  play: (c, v, t) => c.attack(t, v.dmg),
});
card('goodInstincts', {
  name: 'Quick Guard', cls: 'neutral', type: 'skill', rarity: 'uncommon', cost: 0, art: 'sk:12,1',
  text: 'Gain {block} Block.', v: { block: 6 }, up: { block: 9 },
  play: (c, v) => c.block(v.block),
});
card('finesse', {
  name: 'Finesse', cls: 'neutral', type: 'skill', rarity: 'uncommon', cost: 0, art: 'sk:20,1',
  text: 'Gain {block} Block. Draw 1 card.', v: { block: 2 }, up: { block: 4 },
  play: (c, v) => { c.block(v.block); c.draw(1); },
});
card('trip', {
  name: 'Trip', cls: 'neutral', type: 'skill', rarity: 'uncommon', cost: 0, target: 'enemy', art: 'sp:5,1',
  text: 'Apply 2 Vulnerable.', upText: 'Apply 2 Vulnerable to ALL enemies.', v: {},
  play: (c, v, t, up) => (up ? c.applyAll('vuln', 2) : c.apply(t, 'vuln', 2)),
});
card('shackles', {
  name: 'Dark Shackles', cls: 'neutral', type: 'skill', rarity: 'uncommon', cost: 0, target: 'enemy', art: 'sk:16,6',
  text: 'Enemy loses {n} Strength this turn. Exhaust.', v: { n: 9 }, up: { n: 15 }, flags: { exhaust: true },
  play: (c, v, t) => { c.apply(t, 'str', -v.n); c.apply(t, 'strUp', v.n); },
});
card('masterPlan', {
  name: 'Master Plan', cls: 'neutral', type: 'skill', rarity: 'rare', cost: 0, art: 'sk:19,1',
  text: 'Draw {n} cards. Exhaust.', v: { n: 3 }, up: { n: 4 }, flags: { exhaust: true },
  play: (c, v) => c.draw(v.n),
});
card('apotheosis', {
  name: 'Ascend', cls: 'neutral', type: 'skill', rarity: 'rare', cost: 2, upCost: 1, art: 'sp:7,4',
  text: 'Upgrade ALL your cards for the rest of this fight. Exhaust.', v: {}, flags: { exhaust: true },
  play: (c) => c.upgradeAllInCombat(),
});
card('panacea', {
  name: 'Panacea', cls: 'neutral', type: 'skill', rarity: 'uncommon', cost: 0, art: 'sp:4,5',
  text: 'Remove Weak, Vulnerable and Frail from yourself. Exhaust.', upText: 'Remove Weak, Vulnerable and Frail from yourself.', v: {}, flags: { exhaust: true }, upFlags: {},
  play: (c) => c.cleanse(),
});

// ---------- Status cards (added by enemies during a fight) ----------
card('dazed', {
  name: 'Dazed', cls: 'status', type: 'status', rarity: 'special', cost: 0, art: 'sp:0,6',
  text: 'Unplayable. Ethereal.', v: {}, flags: { unplayable: true, ethereal: true },
});
card('wound', {
  name: 'Wound', cls: 'status', type: 'status', rarity: 'special', cost: 0, art: 'sp:1,4',
  text: 'Unplayable.', v: {}, flags: { unplayable: true },
});
card('burn', {
  name: 'Burn', cls: 'status', type: 'status', rarity: 'special', cost: 0, art: 'sp:1,0',
  text: 'Unplayable. At the end of your turn, take 2 damage.', v: {}, flags: { unplayable: true },
});
card('slimed', {
  name: 'Slimed', cls: 'status', type: 'status', rarity: 'special', cost: 1, art: 'sp:3,3',
  text: 'Exhaust. (Does nothing.)', v: {}, flags: { exhaust: true },
  play: () => {},
});

// ---------- Curses (from events) ----------
card('doubt', {
  name: 'Doubt', cls: 'curse', type: 'curse', rarity: 'special', cost: 0, art: 'sp:2,2',
  text: 'Unplayable. At the end of your turn, gain 1 Weak.', v: {}, flags: { unplayable: true },
});
card('decay', {
  name: 'Decay', cls: 'curse', type: 'curse', rarity: 'special', cost: 0, art: 'sp:2,1',
  text: 'Unplayable. At the end of your turn, take 2 damage.', v: {}, flags: { unplayable: true },
});
card('clumsy', {
  name: 'Clumsy', cls: 'curse', type: 'curse', rarity: 'special', cost: 0, art: 'sk:0,6',
  text: 'Unplayable. Ethereal.', v: {}, flags: { unplayable: true, ethereal: true },
});

export const CARDS = C;

export const STARTER_DECKS = {
  knight: ['strike', 'strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'defend', 'bash'],
  mage: ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'defend', 'spark', 'insight'],
  ranger: ['strike', 'strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'defend', 'defend', 'venomArrow', 'sidestep'],
};

/** The definition for a card instance ({ id, up }). */
export const def = (id) => C[id];

/** Card values after upgrade. */
export function values(cardOrId, up) {
  const d = typeof cardOrId === 'string' ? C[cardOrId] : C[cardOrId.id];
  const isUp = typeof cardOrId === 'string' ? up : cardOrId.up;
  return isUp && d.up ? { ...d.v, ...d.up } : { ...d.v };
}

export function costOf(card) {
  const d = C[card.id];
  if (card.costTmp !== undefined) return card.costTmp;
  return card.up && d.upCost !== undefined ? d.upCost : d.cost;
}

export function flagsOf(card) {
  const d = C[card.id];
  return card.up && d.upFlags ? d.upFlags : d.flags;
}

export const canUpgrade = (card) => !card.up && ['attack', 'skill', 'power'].includes(C[card.id].type);

export function cardName(card) {
  return C[card.id].name + (card.up ? '+' : '');
}

/**
 * Card text with the numbers filled in. fmt(key, base) can change {dmg}/{block} for a fight.
 */
export function describe(card, fmt) {
  const d = C[card.id];
  const v = values(card);
  const src = card.up && d.upText ? d.upText : d.text;
  return src.replace(/\{(\w+)\}/g, (_, k) => {
    if (fmt) { const r = fmt(k, v[k], v); if (r !== undefined) return String(r); }
    return v[k] === undefined ? '?' : String(v[k]);
  }).replace(/\b1 (card|turn)\(s\)/g, '1 $1').replace(/\((s)\)/g, '$1');
}

/** Pool of cards that can show up as rewards for a class. */
export function rewardPool(cls, rarity) {
  return Object.values(C).filter((d) => d.cls === cls && d.rarity === rarity).map((d) => d.id);
}

export const NEUTRAL_POOL = Object.values(C).filter((d) => d.cls === 'neutral').map((d) => d.id);

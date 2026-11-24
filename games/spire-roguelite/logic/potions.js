// Potions: one-shot effects. You can carry 3. Most work only in a fight;
// `anytime` potions can also be drunk on the map.
// tint: colour for the flask sprite.

export const POTIONS = {
  fire: { name: 'Fire Potion', tint: 0xe25822, target: 'enemy', text: 'Deal 20 damage to an enemy.', use: (c, t) => c.damage(t, 20) },
  explosive: { name: 'Explosive Potion', tint: 0xd88038, text: 'Deal 10 damage to ALL enemies.', use: (c) => c.damageAll(10) },
  block: { name: 'Block Potion', tint: 0x6fa8dc, text: 'Gain 12 Block.', use: (c) => c.gainRawBlock(12) },
  strength: { name: 'Strength Potion', tint: 0xa13d3b, text: 'Gain 2 Strength.', use: (c) => c.applySelf('str', 2) },
  dex: { name: 'Speed Potion', tint: 0x6c8c50, text: 'Gain 2 Dexterity.', use: (c) => c.applySelf('dex', 2) },
  swift: { name: 'Swift Potion', tint: 0x8fd3ff, text: 'Draw 3 cards.', use: (c) => c.draw(3) },
  energy: { name: 'Energy Potion', tint: 0xe3d245, text: 'Gain 2 Energy.', use: (c) => c.gainEnergy(2) },
  weak: { name: 'Weak Potion', tint: 0x8a8fc4, target: 'enemy', text: 'Apply 3 Weak to an enemy.', use: (c, t) => c.apply(t, 'weak', 3) },
  fear: { name: 'Fear Potion', tint: 0x9a407e, target: 'enemy', text: 'Apply 3 Vulnerable to an enemy.', use: (c, t) => c.apply(t, 'vuln', 3) },
  poison: { name: 'Poison Potion', tint: 0x55c25a, target: 'enemy', text: 'Apply 7 Poison to an enemy.', use: (c, t) => c.apply(t, 'poison', 7) },
  heal: { name: 'Healing Potion', tint: 0xff7b9c, anytime: true, text: 'Heal 25% of your Max HP. Works on the map too.', use: (c) => c.healPct(0.25) },
};

export const POTION_IDS = Object.keys(POTIONS);

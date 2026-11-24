// Buffs and debuffs. `turns` statuses count down by 1 at the end of their owner's turn.
// art: 'sheet:col,row' icon (see frames.js); kind: buff | debuff (debuffs can be blocked by Artifact).

const pl = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const STATUSES = {
  str: { name: 'Strength', kind: 'buff', art: 'sp:7,3', desc: (n) => (n >= 0 ? `Attacks deal ${n} more damage.` : `Attacks deal ${-n} less damage.`) },
  dex: { name: 'Dexterity', kind: 'buff', art: 'sp:0,5', desc: (n) => `Gain ${n} more Block from cards.` },
  weak: { name: 'Weak', kind: 'debuff', turns: true, art: 'sp:2,2', desc: (n) => `Attacks deal 25% less damage. ${pl(n, 'turn')}.` },
  vuln: { name: 'Vulnerable', kind: 'debuff', turns: true, art: 'sp:5,1', desc: (n) => `Takes 50% more damage from attacks. ${pl(n, 'turn')}.` },
  frail: { name: 'Frail', kind: 'debuff', turns: true, art: 'sp:4,1', desc: (n) => `Gains 25% less Block from cards. ${pl(n, 'turn')}.` },
  poison: { name: 'Poison', kind: 'debuff', art: 'sp:3,0', desc: (n) => `Loses ${n} HP at the start of its turn, then Poison drops by 1.` },
  thorns: { name: 'Thorns', kind: 'buff', art: 'sp:5,2', desc: (n) => `Attackers take ${n} damage per hit.` },
  plate: { name: 'Iron Skin', kind: 'buff', art: 'ar:1,5', desc: (n) => `Gains ${n} Block at the end of each turn.` },
  plated: { name: 'Plated', kind: 'buff', art: 'ar:1,5', desc: (n) => `Gains ${n} Block at the end of its turn. Each unblocked hit removes 1.` },
  ritual: { name: 'Ritual', kind: 'buff', art: 'sp:5,6', desc: (n) => `Gains ${n} Strength at the end of each turn.` },
  regen: { name: 'Regrowth', kind: 'buff', art: 'sp:0,1', desc: (n) => `Heals ${n} HP at the end of each turn.` },
  enrage: { name: 'Enrage', kind: 'buff', art: 'sp:7,3', desc: (n) => `Gains ${n} Strength whenever you play a Skill.` },
  artifact: { name: 'Artifact', kind: 'buff', art: 'ar:2,1', desc: (n) => `Blocks the next ${pl(n, 'debuff')}.` },
  angry: { name: 'Fury', kind: 'buff', art: 'sp:7,3', desc: (n) => `Gains ${n} Strength whenever it takes attack damage.` },
  strDown: { name: 'Fading Strength', kind: 'debuff', art: 'sp:7,3', desc: (n) => `Lose ${n} Strength at the end of this turn.` },
  strUp: { name: 'Shackled', kind: 'debuff', art: 'sk:16,6', desc: (n) => `Gets ${n} Strength back at the end of its turn.` },
  // Player powers
  warlord: { name: 'Warlord', kind: 'buff', art: 'sk:11,1', desc: (n) => `Gain ${n} Strength at the start of each turn.` },
  bulwark: { name: 'Bulwark', kind: 'buff', art: 'sk:1,1', desc: () => 'Block is not removed at the start of your turn.' },
  pyro: { name: 'Fire Soul', kind: 'buff', art: 'sp:5,5', desc: (n) => `Playing an Attack deals ${n} damage to ALL enemies.` },
  wildfire: { name: 'Wildfire', kind: 'buff', art: 'sp:1,0', desc: (n) => `End of turn: deal ${n} damage to ALL enemies.` },
  noxious: { name: 'Noxious Fumes', kind: 'buff', art: 'sp:4,0', desc: (n) => `Start of turn: apply ${n} Poison to ALL enemies.` },
  archmage: { name: 'Archmage', kind: 'buff', art: 'sk:12,5', desc: (n) => `Gain ${n} extra Energy each turn.` },
  eagle: { name: 'Eagle Eye', kind: 'buff', art: 'sk:9,1', desc: (n) => `Draw ${pl(n, 'extra card')} each turn.` },
  envenom: { name: 'Envenom', kind: 'buff', art: 'sp:5,6', desc: (n) => `Unblocked attack damage applies ${n} Poison.` },
  nextBlock: { name: 'Glacier', kind: 'buff', art: 'sp:5,3', desc: (n) => `Gain ${n} Block next turn.` },
  heads: { name: 'Heads', kind: 'buff', art: 'sp:2,0', desc: (n) => `Bites once per head (${n}).` },
};

export const statusName = (id) => STATUSES[id]?.name ?? id;

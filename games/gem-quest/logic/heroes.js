// Heroes, levels and gear.

export const MAX_LEVEL = 30;

export const HEROES = {
  knight: {
    name: 'Knight', sprite: 'castle:64', hp: [72, 8], skull: 2, colors: [0, 3],
    skills: ['cleave', 'shieldWall', 'rally', 'judgement'],
    blurb: 'Tough and steady. Big shields and heals.',
  },
  mage: {
    name: 'Mage', sprite: 'tower:80', hp: [60, 6], skull: 2, colors: [0, 1],
    skills: ['fireball', 'frostBolt', 'transmute', 'meteor'],
    blurb: 'Fragile, but her spells hit hard and bend the board.',
  },
  ranger: {
    name: 'Ranger', sprite: 'rampart:64', hp: [66, 7], skull: 2, colors: [2, 3],
    skills: ['aimedShot', 'poisonArrow', 'volley', 'entangle'],
    blurb: 'Cheap shots, poison and long stuns.',
  },
  berserker: {
    name: 'Berserker', sprite: 'strong:224', hp: [78, 8], skull: 3, colors: [0, 2],
    skills: ['rage', 'bloodlust', 'skullStorm', 'earthquake'],
    blurb: 'Skulls hit harder. Lives on rage and stolen blood.',
  },
};
export const HERO_IDS = Object.keys(HEROES);

/** Level each skill slot opens at. */
export const SKILL_LEVELS = [1, 3, 6, 10];

/** XP needed to go from level L to L+1. */
export const xpToNext = (L) => 60 + 50 * (L - 1);

// slot: weapon / armor / charm. Stats: hp, skull, power (skill damage, heal and shield),
// start [r,b,g,y] (starting mana), cap (extra max mana), shield (start with a shield), gold (% more coins).
export const GEAR = {
  ironSword: { name: 'Iron Sword', slot: 'weapon', icon: 'sw:4,0', price: 120, stats: { skull: 1 } },
  warAxe: { name: 'War Blade', slot: 'weapon', icon: 'sw:5,1', price: 340, stats: { skull: 1, hp: 15 } },
  runeBlade: { name: 'Rune Blade', slot: 'weapon', icon: 'sw:2,2', price: 700, stats: { skull: 2, power: 2 } },
  frostBrand: { name: 'Frost Brand', slot: 'weapon', icon: 'sw:5,5', quest: true, stats: { skull: 2, hp: 20 } },
  dragonFang: { name: 'Dragon Fang', slot: 'weapon', icon: 'sw:9,4', quest: true, stats: { skull: 3, power: 3 } },
  magicWand: { name: 'Magic Wand', slot: 'weapon', icon: 'st:3,0', price: 260, stats: { power: 3 } },

  leatherVest: { name: 'Leather Vest', slot: 'armor', icon: 'to:0,3', price: 80, stats: { hp: 15 } },
  chainMail: { name: 'Chain Mail', slot: 'armor', icon: 'to:4,0', price: 300, stats: { hp: 30 } },
  plateArmor: { name: 'Plate Armour', slot: 'armor', icon: 'to:6,0', price: 620, stats: { hp: 50 } },
  ghostShroud: { name: 'Ghost Shroud', slot: 'armor', icon: 'to:1,1', quest: true, stats: { hp: 25, shield: 8 } },
  dragonScale: { name: 'Dragon Scale', slot: 'armor', icon: 'to:9,3', price: 1100, stats: { hp: 70, shield: 10 } },

  rubyRing: { name: 'Ruby Ring', slot: 'charm', icon: 'ri:4,0', price: 100, stats: { start: [4, 0, 0, 0] } },
  sapphireRing: { name: 'Sapphire Ring', slot: 'charm', icon: 'ri:5,3', price: 100, stats: { start: [0, 4, 0, 0] } },
  emeraldRing: { name: 'Emerald Ring', slot: 'charm', icon: 'ri:8,0', price: 160, stats: { start: [0, 0, 4, 0] } },
  topazRing: { name: 'Amber Ring', slot: 'charm', icon: 'ri:5,1', price: 160, stats: { start: [0, 0, 0, 4] } },
  luckyCoin: { name: 'Lucky Clover', slot: 'charm', icon: 'ar:3,0', quest: true, stats: { gold: 50, start: [2, 2, 2, 2] } },
  emberCharm: { name: 'Ember Charm', slot: 'charm', icon: 'ne:3,1', quest: true, stats: { start: [6, 0, 0, 0], power: 1 } },
  spellTome: { name: 'Seer Amulet', slot: 'charm', icon: 'ne:2,2', price: 420, stats: { power: 4 } },
  boneCharm: { name: 'Bone Charm', slot: 'charm', icon: 'ne:0,3', quest: true, stats: { skull: 1, hp: 10 } },
  manaCrystal: { name: 'Mana Crystal', slot: 'charm', icon: 'ar:0,3', price: 750, stats: { cap: 5, start: [3, 3, 3, 3] } },
  stormAmulet: { name: 'Storm Amulet', slot: 'charm', icon: 'ne:1,0', quest: true, stats: { start: [0, 5, 0, 5], power: 2 } },
  phoenixFeather: { name: 'Phoenix Plume', slot: 'charm', icon: 'ar:1,7', quest: true, stats: { hp: 40, power: 5 } },
  sageAmulet: { name: 'Sage Amulet', slot: 'charm', icon: 'ne:9,1', price: 1200, stats: { power: 6, cap: 3 } },
};

/** One line of stats: "+1 skull, +15 HP". */
export function gearText(id) {
  const s = GEAR[id].stats;
  const out = [];
  if (s.skull) out.push(`+${s.skull} skull dmg`);
  if (s.hp) out.push(`+${s.hp} HP`);
  if (s.power) out.push(`+${s.power} skill power`);
  if (s.shield) out.push(`start with ${s.shield} shield`);
  if (s.cap) out.push(`+${s.cap} max mana`);
  if (s.start) {
    const st = s.start;
    if (st.every((n) => n === st[0]) && st[0]) out.push(`start +${st[0]} all mana`);
    else st.forEach((n, c) => { if (n) out.push(`start +${n} ${['red', 'blue', 'green', 'yellow'][c]}`); });
  }
  if (s.gold) out.push(`+${s.gold}% gold`);
  return out.join(', ');
}

/** Everything a hero brings to a fight at this level with this gear. */
export function heroStats(id, level, gearIds = []) {
  const h = HEROES[id];
  const st = { maxHp: h.hp[0] + h.hp[1] * (level - 1), skull: h.skull + Math.floor(level / 6), power: 0, cap: 0, start: [0, 0, 0, 0], shield: 0, gold: 0 };
  for (const g of gearIds) {
    const s = GEAR[g]?.stats;
    if (!s) continue;
    st.maxHp += s.hp || 0;
    st.skull += s.skull || 0;
    st.power += s.power || 0;
    st.cap += s.cap || 0;
    st.shield += s.shield || 0;
    st.gold += s.gold || 0;
    (s.start || []).forEach((n, c) => { st.start[c] += n; });
  }
  return st;
}

/** Skills this hero can use at this level. */
export const heroSkills = (id, level) => HEROES[id].skills.filter((_, k) => level >= SKILL_LEVELS[k]);

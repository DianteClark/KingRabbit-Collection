// Everything Darkhold is made of: classes, monsters, items, perks. Pure data, no Phaser.
// Sprite refs: monsters/heroes are [col, row] on MonsterPack/Creatures.png (16px cells),
// items are [col, row] on Items/Items.png (16px cells).

export const LAST_DEPTH = 10;      // ten generated floors...
export const BOSS_DEPTH = 11;      // ...then the Hollow King's hall
export const SHOP_DEPTHS = [3, 6, 9];
export const BAG_SIZE = 12;
export const MAX_FUEL = 400;
export const MAX_FOOD = 1000;

export const CLASSES = {
  knight: {
    name: 'Knight', spr: [3, 0], hp: 30, hpPerLvl: 6,
    melee: 'longsword', armor: 'leather', arrows: 0, gold: 10,
    blurb: 'Tough and well armoured. His shield sometimes blocks a blow outright.',
  },
  rogue: {
    name: 'Rogue', spr: [2, 5], hp: 24, hpPerLvl: 5,
    melee: 'dagger', ranged: 'shortbow', armor: 'leather', arrows: 20, gold: 30,
    blurb: 'Triple damage sneak attacks, finds weak spots, and spots traps and secret doors.',
  },
  mage: {
    name: 'Mage', spr: [8, 1], hp: 20, hpPerLvl: 4,
    melee: 'staff', arrows: 0, gold: 10, mana: 6,
    blurb: 'Casts Firebolt with mana that refills as she walks. Her torch lasts longer.',
  },
};

// tags: sleeper (starts asleep), wander, erratic (moves at random a lot), archer, phase (walks
// through walls), fearLight (shuns bright light), thief, glow (gives off light), chill (hits drain
// your torch), poison, split, watcher (never moves, shrieks), mimic (looks like a chest), slow, fast
export const MONSTERS = {
  rat: { name: 'Giant Rat', spr: [8, 5], hp: 4, dmg: [1, 2], acc: 0.7, armor: 0, dodge: 0.05, xp: 1, tags: ['wander'], depth: [1, 3], w: 10, desc: 'Scurries about looking for scraps.' },
  bat: { name: 'Cave Bat', spr: [0, 6], hp: 5, dmg: [1, 3], acc: 0.7, armor: 0, dodge: 0.2, xp: 2, tags: ['wander', 'erratic', 'fast'], depth: [1, 4], w: 8, desc: 'Fast and flighty. Hard to hit.' },
  slime: { name: 'Slime', spr: [3, 1], hp: 10, dmg: [1, 3], acc: 0.7, armor: 0, dodge: 0, xp: 2, tags: ['wander', 'split'], depth: [1, 5], w: 8, desc: 'Splits in two when struck.' },
  skeleton: { name: 'Skeleton', spr: [1, 5], hp: 12, dmg: [2, 4], acc: 0.75, armor: 1, dodge: 0, xp: 4, tags: ['sleeper'], depth: [2, 6], w: 9, desc: 'Rests until something disturbs it.' },
  wisp: { name: 'Wisp', spr: [8, 4], hp: 6, dmg: [2, 4], acc: 0.75, armor: 0, dodge: 0.15, xp: 3, tags: ['wander', 'erratic', 'glow'], depth: [2, 9], w: 5, desc: 'A living flame. You can see it coming. Slay it to steal its fire.' },
  archer: { name: 'Goblin Archer', spr: [2, 6], hp: 8, dmg: [1, 2], shot: [2, 4], range: 5, acc: 0.75, armor: 0, dodge: 0.05, xp: 4, tags: ['wander', 'archer'], depth: [2, 7], w: 7, desc: 'Keeps its distance and shoots.' },
  spider: { name: 'Cave Spider', spr: [7, 1], hp: 9, dmg: [2, 3], acc: 0.8, armor: 0, dodge: 0.05, xp: 4, tags: ['sleeper', 'poison'], depth: [3, 7], w: 7, desc: 'Lurks in the dark. Its bite is poisonous.' },
  imp: { name: 'Imp', spr: [0, 4], hp: 8, dmg: [1, 3], acc: 0.8, armor: 0, dodge: 0.15, xp: 4, tags: ['wander', 'fast', 'thief'], depth: [3, 8], w: 5, desc: 'Snatches gold and vanishes. Kill it to get the gold back.' },
  shade: { name: 'Shade', spr: [6, 3], hp: 10, dmg: [3, 5], acc: 0.8, armor: 0, dodge: 0.1, xp: 5, tags: ['wander', 'fearLight'], depth: [3, 11], w: 8, desc: 'Fears bright light. Keeps your torch burning and it stays away.' },
  mimic: { name: 'Mimic', spr: [3, 4], hp: 20, dmg: [4, 7], acc: 0.8, armor: 1, dodge: 0, xp: 10, tags: ['mimic'], depth: [3, 11], w: 3, desc: 'A hungry chest.' },
  watcher: { name: 'Watcher', spr: [1, 0], hp: 8, dmg: [1, 2], acc: 0.6, armor: 0, dodge: 0, xp: 4, tags: ['watcher'], depth: [4, 11], w: 4, desc: 'Never moves, but shrieks and wakes the floor when it sees light.' },
  ghost: { name: 'Ghost', spr: [0, 1], hp: 10, dmg: [2, 4], acc: 0.75, armor: 0, dodge: 0.1, xp: 5, tags: ['wander', 'phase', 'chill'], depth: [4, 11], w: 6, desc: 'Drifts through walls. Its touch chills your torch.' },
  zombie: { name: 'Zombie', spr: [6, 5], hp: 22, dmg: [3, 6], acc: 0.7, armor: 0, dodge: 0, xp: 6, tags: ['wander', 'slow'], depth: [4, 11], w: 7, desc: 'Slow, but hits hard and takes a beating.' },
  bonearcher: { name: 'Bone Archer', spr: [6, 6], hp: 14, dmg: [2, 4], shot: [3, 6], range: 6, acc: 0.8, armor: 1, dodge: 0, xp: 7, tags: ['sleeper', 'archer'], depth: [6, 11], w: 6, desc: 'A skeleton with a bow and good aim.' },
  wraith: { name: 'Wraith', spr: [3, 5], hp: 20, dmg: [5, 8], acc: 0.8, armor: 0, dodge: 0.1, xp: 9, tags: ['wander', 'fearLight', 'chill'], depth: [6, 11], w: 6, desc: 'Hates light. Its touch drains your torch.' },
  ooze: { name: 'Gloom Ooze', spr: [8, 0], hp: 26, dmg: [3, 6], acc: 0.75, armor: 0, dodge: 0, xp: 8, tags: ['wander', 'split', 'slow'], depth: [6, 11], w: 5, desc: 'A big slime. Splits when struck.' },
  ogre: { name: 'Cave Ogre', spr: [4, 3], hp: 32, dmg: [6, 10], acc: 0.7, armor: 1, dodge: 0, xp: 12, tags: ['sleeper'], depth: [7, 11], w: 6, desc: 'Sleeps a lot. Do not wake it lightly.' },
  demon: { name: 'Demon', spr: [7, 7], hp: 30, dmg: [6, 10], acc: 0.8, armor: 2, dodge: 0.05, xp: 14, tags: ['wander'], depth: [8, 11], w: 5, desc: 'Restless and hungry for a fight.' },
  knight: { name: 'Dread Knight', spr: [1, 3], hp: 34, dmg: [5, 9], acc: 0.8, armor: 3, dodge: 0, xp: 15, tags: ['sleeper'], depth: [9, 11], w: 5, desc: 'Heavily armoured guardian of the deep.' },
  king: { name: 'The Hollow King', big: true, hp: 200, dmg: [6, 10], acc: 0.8, armor: 2, dodge: 0, xp: 50, tags: ['boss'], depth: [99, 99], w: 0, desc: 'Lord of the Darkhold. Weak in bright light.' },
};

export const MELEE = {
  dagger: { name: 'Dagger', spr: [0, 0], dmg: [2, 5], acc: 0.05, sneak: true, depth: 1, price: 20, tint: 0xb9c0d8 },
  staff: { name: 'Oak Staff', spr: [1, 2], dmg: [2, 4], acc: 0, depth: 1, price: 15 },
  shortsword: { name: 'Short Sword', spr: [0, 0], dmg: [2, 5], acc: 0.05, depth: 1, price: 30 },
  mace: { name: 'Mace', spr: [0, 1], dmg: [3, 6], acc: 0, depth: 2, price: 45 },
  longsword: { name: 'Longsword', spr: [0, 0], dmg: [3, 7], acc: 0, depth: 1, price: 60 },
  axe: { name: 'Battle Axe', spr: [2, 2], dmg: [4, 8], acc: -0.05, depth: 4, price: 80 },
  warhammer: { name: 'War Hammer', spr: [0, 1], dmg: [5, 10], acc: -0.1, depth: 6, price: 110, tint: 0xf9c0a0 },
  runeblade: { name: 'Runeblade', spr: [0, 0], dmg: [6, 11], acc: 0.05, depth: 8, price: 160, tint: 0xa0d0ff },
};

export const RANGED = {
  shortbow: { name: 'Short Bow', spr: [3, 0], dmg: [2, 4], range: 5, depth: 1, price: 35 },
  longbow: { name: 'Long Bow', spr: [3, 0], dmg: [3, 6], range: 7, depth: 3, price: 70, tint: 0xf9e0a0 },
  crossbow: { name: 'Crossbow', spr: [3, 0], dmg: [4, 8], range: 6, depth: 6, price: 110, tint: 0xc0a0f0 },
};

export const ARMORS = {
  leather: { name: 'Leather Armour', spr: [1, 0], armor: 1, depth: 1, price: 25 },
  studded: { name: 'Studded Leather', spr: [1, 0], armor: 2, depth: 2, price: 50, tint: 0xf0d0b0 },
  chain: { name: 'Chain Mail', spr: [1, 0], armor: 3, depth: 4, price: 85, tint: 0xc8d0f0 },
  scale: { name: 'Scale Mail', spr: [1, 0], armor: 4, depth: 6, price: 120, tint: 0xa0e0c0 },
  plate: { name: 'Plate Armour', spr: [1, 0], armor: 5, depth: 8, price: 170, tint: 0xffffff },
};

export const RINGS = {
  light: { name: 'Ring of Light', text: 'Your torch shines 1 tile further.', tint: 0xffe070, price: 90 },
  might: { name: 'Ring of Might', text: '+2 melee damage.', tint: 0xff8060, price: 90 },
  guard: { name: 'Ring of Guarding', text: '+1 armour.', tint: 0x90b0ff, price: 80 },
  vigor: { name: 'Ring of Vigour', text: '+8 max HP while worn.', tint: 0x80ff90, price: 80 },
  regen: { name: 'Ring of Mending', text: 'You heal much faster.', tint: 0xff90d0, price: 100 },
  stealth: { name: 'Ring of Shadows', text: 'Monsters notice you less.', tint: 0x9070c0, price: 80 },
};

// Potions and scrolls look different every run and are unknown until used (or bought).
export const POTIONS = {
  healing: { name: 'Potion of Healing', text: 'Heals most of your wounds.', good: true, price: 40 },
  restore: { name: 'Potion of Vigour', text: 'Heals fully and raises max HP by 4.', good: true, price: 90 },
  strength: { name: 'Potion of Strength', text: '+1 melee damage, for good.', good: true, price: 80 },
  sight: { name: 'Potion of Sight', text: 'You sense every monster on the floor for a while.', good: true, price: 40 },
  flame: { name: 'Liquid Flame', text: 'Refills your torch and makes it blaze brightly.', good: true, price: 45 },
  haste: { name: 'Potion of Speed', text: 'You move twice as fast for a while.', good: true, price: 50 },
  poison: { name: 'Potion of Poison', text: 'Poisons you. Yuck.', good: false, price: 5 },
  shadow: { name: 'Potion of Shadow', text: 'Smothers your torch.', good: false, price: 5 },
};
export const POTION_LOOKS = [
  ['Crimson', 0xff5050], ['Azure', 0x60a0ff], ['Emerald', 0x60e080], ['Amber', 0xffb040],
  ['Violet', 0xc070ff], ['Rose', 0xff90c0], ['Ivory', 0xfff0d0], ['Murky', 0x808060],
];

export const SCROLLS = {
  mapping: { name: 'Scroll of Mapping', text: 'Reveals the floor, its secret doors and traps.', good: true, price: 50 },
  teleport: { name: 'Scroll of Teleport', text: 'Moves you to a random spot on the floor.', good: true, price: 35 },
  identify: { name: 'Scroll of Identify', text: 'Identifies an unknown potion or scroll you carry.', good: true, price: 30 },
  enchant: { name: 'Scroll of Enchanting', text: 'Your weapon gets +1 (or your armour, if unarmed).', good: true, price: 70 },
  light: { name: 'Scroll of Dawn', text: 'Fills the area around you with lasting light.', good: true, price: 40 },
  fear: { name: 'Scroll of Terror', text: 'Nearby monsters flee from you.', good: true, price: 40 },
  summon: { name: 'Scroll of Summoning', text: 'Calls monsters to your side. Bad luck!', good: false, price: 5 },
  noise: { name: 'Scroll of Thunder', text: 'A loud boom wakes the whole floor.', good: false, price: 5 },
};
const SYLLABLES = ['ZOK', 'MAR', 'FEN', 'ULTH', 'KRA', 'VEL', 'OOM', 'NAX', 'TIR', 'GOL', 'SHA', 'BRE', 'XUN', 'PELL', 'ARK', 'YOR'];
export const scrollLabel = (a, b) => `${SYLLABLES[a % SYLLABLES.length]} ${SYLLABLES[b % SYLLABLES.length]}`;

export const SUPPLIES = {
  ration: { name: 'Ration', spr: [7, 1], text: 'Filling food. Eat when hungry.', food: 650, price: 15 },
  apple: { name: 'Apple', spr: [4, 0], text: 'A small snack.', food: 250, price: 6 },
  oil: { name: 'Flask of Oil', spr: [8, 0], text: 'Adds fuel to your torch.', fuel: 180, price: 20 },
  torch: { name: 'Fresh Torch', spr: [3, 1], text: 'Fills your torch to the brim.', fuel: MAX_FUEL, price: 35 },
};

export const PERKS = {
  tough: { name: 'Tough', text: '+8 max HP', max: 3 },
  brawler: { name: 'Brawler', text: '+1 melee damage', max: 3 },
  stalwart: { name: 'Stalwart', text: '+1 armour', max: 2 },
  nightsight: { name: 'Night Eyes', text: 'Torch shines 1 tile further', max: 1 },
  frugal: { name: 'Thrifty Flame', text: 'Torch burns 30% slower', max: 1 },
  marksman: { name: 'Marksman', text: '+2 ranged damage, +1 range', max: 2 },
  vampire: { name: 'Bloodthirst', text: 'Heal 2 HP for every kill', max: 1 },
  scavenger: { name: 'Scavenger', text: '+50% gold found', max: 1 },
  lightfoot: { name: 'Light Feet', text: 'Fewer traps go off, find secrets easily', max: 1 },
  nimble: { name: 'Nimble', text: '+10% chance to dodge', max: 2 },
  secondwind: { name: 'Second Wind', text: 'Once per floor, heal 40% when nearly dead', max: 1 },
  alchemist: { name: 'Alchemist', text: 'Healing potions heal 50% more', max: 1 },
  hunter: { name: 'Keen Eye', text: '+10% to hit with every attack', max: 1 },
};

// Total XP needed to reach each level (index = level).
export const XP_FOR = [0, 0, 15, 40, 75, 120, 180, 255, 345, 450, 575, 720, 890, 1080];
export const MAX_LEVEL = XP_FOR.length - 1;

export const TRAPS = {
  spike: { name: 'Spike trap', text: 'Spikes shoot up!' },
  alarm: { name: 'Alarm trap', text: 'A bell clangs! Monsters are coming.' },
  smoke: { name: 'Smoke trap', text: 'Foul smoke chokes your torch!' },
  teleport: { name: 'Teleport trap', text: 'The floor glows... you are somewhere else!' },
  dart: { name: 'Poison dart trap', text: 'A poison dart hits you!' },
};

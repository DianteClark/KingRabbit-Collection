// What people say, which changes as the adventure goes on, plus item names and shop stock.

export const ITEM_TEXT = {
  sword: ['You got the Sword and Shield!', 'Tap SWORD to swing. Face a thrown rock to block it with your shield.'],
  boomerang: ['You got the Boomerang!', 'Tap ITEM to throw it. It stuns enemies, grabs loot and hits crystals out of reach.'],
  bombs: ['You got Bombs!', 'Tap ITEM to drop one. Blast cracked walls and rocks - and stand back!'],
  key: ['You found a Small Key.', 'Walk into a locked door to open it.'],
  bigkey: ['You found the Boss Key!', 'It opens the big door to this dungeon\'s master.'],
  heart: ['Heart Container!', 'Your life grew by one heart.'],
  gems20: ['You found 20 gems.'],
  gems50: ['You found 50 gems!'],
  potion: ['You got a Red Potion.', 'Select it with the swap button and tap ITEM to drink. It also saves you if you fall.'],
};

export const ITEM_NAMES = { boomerang: 'Boomerang', bombs: 'Bombs', potion: 'Potion' };

/** Shop stock: price, what it does and whether you can buy it now. */
export function shopStock(s) {
  return [
    {
      id: 'potion', name: 'Red Potion', price: 30, desc: 'Refills all hearts',
      why: s.potions >= 3 ? 'Bottles full (3)' : null,
    },
    {
      id: 'bombs', name: '5 Bombs', price: 20, desc: 'For your bomb bag',
      why: !s.items.bombs ? 'Need a bomb bag' : s.bombs >= 10 ? 'Bag is full' : null,
    },
    {
      id: 'heart', name: 'Heart Charm', price: 100, desc: '+1 heart, one only',
      why: s.flags['bought:heart'] ? 'Sold out' : null,
    },
  ];
}

const has = (s, f) => !!s.flags[f];

/** Lines for an NPC, and an optional action to run when the talk ends. */
export function talk(who, s) {
  switch (who) {
    case 'elder':
      if (!s.items.sword) {
        return {
          lines: [
            'Elder Bram: Ah, you are awake. Listen well.',
            'Last night the Gremlin King stole the Hollow Crown and fled to his keep in the Grey Peaks.',
            'Without the Crown, Fernwick Vale will wither. You are the only one quick enough to go.',
            'Take my old sword and shield. Then go out the door, head north through Mosswood and find the Mossy Hollow. Old tools are hidden there.',
          ],
          then: 'giveSword',
        };
      }
      if (!has(s, 'boss:d1')) return { lines: ['Elder Bram: Seek the Mossy Hollow, north of the village through Mosswood.', 'Old tools are hidden in the dungeons. You will need them.'] };
      if (!has(s, 'boss:d2')) return { lines: ['Elder Bram: The boomerang! Good.', 'The Ember Lab lies across the river, east of the fields. Its bridge crystal is on the far bank.'] };
      if (!has(s, 'boss:d3')) return { lines: ['Elder Bram: Bombs, eh? Then the rock sealing Hollow Keep can be broken.', 'Climb the Grey Peaks, north-east. Be brave.'] };
      return { lines: ['Elder Bram: You brought the Crown home. Fernwick will remember you.'] };
    case 'mira':
      if (!has(s, 'boss:d1')) return { lines: ['Mira: Slimes hop around at random, but the blue ones lunge if you line up with them!', 'Hit them with your sword before they hit you.'] };
      return { lines: ['Mira: Gremlins throw rocks. Stand still facing them and your shield blocks the rocks.'] };
    case 'pip':
      if (!s.items.bombs) return { lines: ['Pip: Cut bushes and break pots - sometimes there are gems inside!', "Odo's shop is right here. Gems buy potions."] };
      return { lines: ['Pip: Golems are too tough for swords. Make them charge into a wall, then hit them while they are dizzy!'] };
    case 'wen':
      if (!s.items.bombs) return { lines: ['Granny Wen: In my day there was a secret cave by the lake.', 'Somebody sealed it with rock. Shame.'] };
      if (!has(s, 'chest:in:cave:5,5')) return { lines: ['Granny Wen: Bombs! Try the cracked rock by Lake Sorrel, dear.'] };
      return { lines: ['Granny Wen: You found the old cave? Clever thing.'] };
    case 'odo':
      return { lines: ["Odo: Welcome! Have a look - gems only, no IOUs."], then: 'shop' };
    default:
      return { lines: ['...'] };
  }
}

/** Where to go next, in a line (pause menu and hints). */
export function objective(s) {
  const f = (k) => !!s.flags[k];
  if (!s.items.sword) return 'Talk to Elder Bram.';
  if (!f('boss:d1')) {
    if (!f('seen:d1:1,2')) return 'Find the Mossy Hollow: go north from Fernwick through Mosswood.';
    return 'Explore the Mossy Hollow and beat its master.';
  }
  if (!f('boss:d2')) {
    if (!f('trig:ow:2,1:crystal')) return 'Go east of the fields to the river. Hit its crystal with the boomerang.';
    return 'Explore the Ember Lab across the river and beat its master.';
  }
  if (!f('boss:d3')) {
    if (!f('cell:ow:2,0:5,4')) return 'Bomb the rock sealing Hollow Keep in the Grey Peaks (north-east).';
    return 'Storm Hollow Keep and take back the Crown.';
  }
  return 'The Crown is home. Look for secrets, or rest easy.';
}

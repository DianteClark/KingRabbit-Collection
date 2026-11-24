// Alchemist's Shop: all the static game data (ingredients, potions, areas, upgrades, story).
// Pure data, no Phaser, so the logic can be tested in node.

export const ELEMENTS = ['fire', 'water', 'earth', 'air', 'life'];
export const EL_INFO = {
  fire: { name: 'Fire', color: '#d88038' },
  water: { name: 'Water', color: '#4f86d0' },
  earth: { name: 'Earth', color: '#9b7140' },
  air: { name: 'Air', color: '#9fc6d8' },
  life: { name: 'Life', color: '#6c9c48' },
};

// icon: frame index in Item/Ingredients.png (16x16 cells, 8 per row).
// el: element amounts. area: where it grows ('market' = only bought).
export const INGREDIENTS = {
  rose: { name: 'Rose Petal', icon: 5, el: { life: 2 }, area: 'garden' },
  mint: { name: 'Mint Leaf', icon: 4, el: { air: 2 }, area: 'garden' },
  bluebell: { name: 'Bluebell', icon: 29, el: { water: 2 }, area: 'garden' },
  wheat: { name: 'Wheat Ear', icon: 23, el: { earth: 2 }, area: 'garden' },
  marigold: { name: 'Marigold', icon: 41, el: { fire: 1, life: 1 }, area: 'garden' },
  clover: { name: 'Clover', icon: 33, el: { earth: 1, air: 1 }, area: 'garden' },

  toadstool: { name: 'Toadstool', icon: 8, el: { earth: 2, water: 1 }, area: 'forest' },
  holly: { name: 'Hollyberry', icon: 12, el: { life: 2, fire: 1 }, area: 'forest' },
  dew: { name: 'Dew Crystal', icon: 20, el: { water: 3 }, area: 'forest' },
  feather: { name: 'Owl Feather', icon: 39, el: { air: 3 }, area: 'forest' },
  moonberry: { name: 'Moonberries', icon: 35, el: { water: 1, air: 2 }, area: 'forest' },
  plume: { name: 'Phoenix Plume', icon: 28, el: { fire: 3, air: 2 }, area: 'forest', rare: true },

  ember: { name: 'Ember Stone', icon: 25, el: { fire: 2, earth: 1 }, area: 'cave' },
  cinnabar: { name: 'Cinnabar', icon: 21, el: { fire: 3 }, area: 'cave' },
  frost: { name: 'Frost Diamond', icon: 17, el: { water: 2, earth: 1 }, area: 'cave' },
  moonsilver: { name: 'Moonsilver', icon: 45, el: { earth: 3 }, area: 'cave', rare: true },
  heart: { name: 'Dragon Heart', icon: 16, el: { fire: 3, life: 3 }, area: 'cave', rare: true },

  salt: { name: 'Rock Salt', icon: 2, el: { earth: 1 }, area: 'market' },
  honey: { name: 'Honeycomb', icon: 14, el: { life: 1, air: 1 }, area: 'market' },
  sunwater: { name: 'Sunwater', icon: 34, el: { fire: 1, water: 1 }, area: 'market' },
  pepper: { name: 'Fire Pepper', icon: 36, el: { fire: 2 }, area: 'market' },
};
export const ING_ORDER = Object.keys(INGREDIENTS);

// Potions. Pure potions come from one strong element, pair potions from the two strongest.
// Legendary potions need a special set of rare ingredients.
export const POTIONS = {
  fire: { name: 'Fire Tonic', els: ['fire'], value: 14, color: '#e0582c', use: 'Warms you through: cold hands, cold ovens, cold nights.' },
  water: { name: 'Cooling Draught', els: ['water'], value: 10, color: '#4f86d0', use: 'Cools fevers and sunburn.' },
  earth: { name: 'Iron Skin', els: ['earth'], value: 12, color: '#9b7140', use: 'Toughens the skin against knocks and bumps.' },
  air: { name: 'Featherstep', els: ['air'], value: 10, color: '#bfe3ef', use: 'Light, quick feet for running and racing.' },
  life: { name: 'Healing Salve', els: ['life'], value: 10, color: '#d84868', use: 'Closes cuts and heals scrapes.' },
  steam: { name: 'Steam Elixir', els: ['fire', 'water'], value: 16, color: '#c8c8d8', use: 'Clears a cough or a stuffy nose.' },
  forge: { name: 'Forge Brew', els: ['fire', 'earth'], value: 18, color: '#b84a24', use: 'Strength for heavy work and hauling.' },
  spark: { name: 'Spark Draught', els: ['fire', 'air'], value: 18, color: '#f0d050', use: 'Wakes you up and chases tiredness away.' },
  vigor: { name: 'Vigor Potion', els: ['fire', 'life'], value: 16, color: '#f08040', use: 'Stamina and courage for a long day.' },
  mud: { name: 'Mud Mask', els: ['water', 'earth'], value: 12, color: '#7a6a48', use: 'Smooth, glowing skin. Good for spots.' },
  mist: { name: 'Mist Potion', els: ['water', 'air'], value: 16, color: '#a8b8e8', use: 'Wraps you in fog so nobody notices you.' },
  calm: { name: 'Calm Draught', els: ['water', 'life'], value: 12, color: '#7ab8b0', use: 'Soothes nerves and brings sleep.' },
  luck: { name: 'Lucky Charm', els: ['earth', 'air'], value: 14, color: '#78c050', use: 'A little luck for games, weddings and exams.' },
  growth: { name: 'Growth Tonic', els: ['earth', 'life'], value: 12, color: '#4c9a3c', use: 'Makes crops, gardens and hair grow.' },
  mind: { name: 'Clear Mind', els: ['air', 'life'], value: 14, color: '#c890e0', use: 'Sharpens memory and focus.' },
  phoenix: { name: 'Phoenix Elixir', els: ['fire', 'life'], value: 50, color: '#ff7020', legendary: ['plume', 'heart'], use: 'Legendary: brings back the spark of youth.' },
  philosopher: { name: "Sage's Gold", els: ['earth', 'life'], value: 75, color: '#f0c830', legendary: ['plume', 'heart', 'moonsilver'], use: 'Legendary: the masterwork of an alchemist.' },
  sludge: { name: 'Murky Sludge', els: [], value: 2, color: '#5a5040', use: 'A failed brew. Nobody really wants this.' },
};
export const RECIPE_ORDER = ['life', 'air', 'water', 'earth', 'fire', 'calm', 'growth', 'mind', 'luck', 'mud', 'mist', 'vigor', 'steam', 'forge', 'spark', 'phoenix', 'philosopher'];

/** Pair potion for two elements (order does not matter). */
export function pairPotion(a, b) {
  for (const [id, p] of Object.entries(POTIONS)) {
    if (p.legendary || p.els.length !== 2) continue;
    if ((p.els[0] === a && p.els[1] === b) || (p.els[0] === b && p.els[1] === a)) return id;
  }
  return null;
}

// Requests: what a customer says for each potion.
export const NEEDS = {
  fire: ['My hands are freezing. Something warming?', 'The oven keeps going cold on me.', 'Long winter ahead. I need warming up.'],
  water: ['I have a terrible fever.', 'I got so sunburnt at the lake!', 'My little one is burning up with fever.'],
  earth: ['I keep walking into doors. Something to toughen me up?', 'I start at the quarry tomorrow. Bumps everywhere.', 'Something to make my skin tough as bark.'],
  air: ['I need to run faster!', 'The mail route is long. Quick feet, please.', 'My feet feel like lead.'],
  life: ['I cut my hand on a sickle.', 'Scraped my knee falling off the fence.', 'A little something for these cuts?'],
  steam: ['This cough will not go away.', 'My nose is all stuffed up.', 'I caught a cold in the rain.'],
  forge: ['I have to haul stones all week.', 'I need strength for the harvest cart.', 'Something to make me strong for heavy work.'],
  spark: ['I can barely keep my eyes open.', 'Night shift again. Something to wake me up?', 'I am so tired all the time.'],
  vigor: ['I need courage for a long journey.', 'Two jobs today. I need stamina.', 'Something to keep me going all day.'],
  mud: ['My skin is so dry and spotty.', 'I have a date tonight. Make me glow?', 'Something for my complexion?'],
  mist: ['I need to sneak past my landlord.', 'Something so nobody notices me?', 'Surprise party! I need to hide.'],
  calm: ['I have not slept in three nights.', 'My nerves are in tatters.', 'I worry all the time. Something calming?'],
  luck: ['I have a card game tonight. Any luck to spare?', 'My wedding is tomorrow. A little luck?', 'Exams soon. I could use some luck.'],
  growth: ['My turnips just will not grow.', 'Something for my thinning hair?', 'My garden is looking sad.'],
  mind: ['I keep forgetting things.', 'I need to focus for my studies.', 'Where did I put my keys... my mind is foggy.'],
  phoenix: ['I hear you can brew a Phoenix Elixir. I will pay well.'],
  philosopher: ["They say only a master can brew Sage's Gold. Can you?"],
};
export const EL_NEEDS = {
  fire: 'Anything with Fire in it.',
  water: 'Something with Water in it.',
  earth: 'Anything with Earth in it.',
  air: 'Something airy. Any Air potion.',
  life: 'Any potion with Life in it.',
};

// Which requests appear as the shop grows (a gentle start).
export const REQUEST_TIERS = [
  { day: 1, rep: 0, potions: ['life', 'air', 'water', 'earth', 'calm', 'growth'] },
  { day: 4, rep: 10, potions: ['fire', 'steam', 'mind', 'luck', 'mud', 'vigor'] },
  { day: 9, rep: 25, potions: ['forge', 'spark', 'mist'] },
];

// Gather areas. Spots: ing, picks per day, position in the 360-wide field (y from the field top), guard.
export const AREAS = {
  garden: {
    name: 'Garden',
    spots: [
      { id: 'g1', ing: 'rose', picks: 3, x: 70, y: 110, art: 'bushPink' },
      { id: 'g2', ing: 'mint', picks: 3, x: 180, y: 100, art: 'herbGreen' },
      { id: 'g3', ing: 'bluebell', picks: 3, x: 290, y: 120, art: 'herbBlue' },
      { id: 'g4', ing: 'wheat', picks: 2, x: 90, y: 300, art: 'herbYellow' },
      { id: 'g5', ing: 'marigold', picks: 2, x: 200, y: 290, art: 'herbOrange' },
      { id: 'g6', ing: 'clover', picks: 2, x: 290, y: 310, art: 'herbSprout' },
    ],
  },
  forest: {
    name: 'Forest',
    cost: 25,
    minDay: 2,
    spots: [
      { id: 'f1', ing: 'toadstool', picks: 2, x: 70, y: 110, art: 'mushrooms' },
      { id: 'f2', ing: 'holly', picks: 2, x: 190, y: 100, art: 'bushRed' },
      { id: 'f3', ing: 'dew', picks: 2, x: 300, y: 130, art: 'pond' },
      { id: 'f4', ing: 'feather', picks: 2, x: 80, y: 300, art: 'stump' },
      { id: 'f5', ing: 'moonberry', picks: 2, x: 170, y: 280, art: 'bushOrange' },
      { id: 'f6', ing: 'plume', picks: 1, x: 290, y: 310, art: 'nest', guard: 'gremlin', hp: 2 },
    ],
  },
  cave: {
    name: 'Cave',
    cost: 60,
    minRep: 20,
    spots: [
      { id: 'c1', ing: 'ember', picks: 2, x: 70, y: 110, art: 'rocks' },
      { id: 'c2', ing: 'cinnabar', picks: 2, x: 200, y: 100, art: 'crystal' },
      { id: 'c3', ing: 'frost', picks: 2, x: 300, y: 130, art: 'crystalBlue' },
      { id: 'c4', ing: 'moonsilver', picks: 1, x: 90, y: 300, art: 'ore', guard: 'gremlin', hp: 2 },
      { id: 'c5', ing: 'heart', picks: 1, x: 280, y: 300, art: 'chest', guard: 'golem', hp: 3 },
    ],
  },
};
export const AREA_ORDER = ['garden', 'forest', 'cave'];

// The market stall: price per item and how many it has each morning.
export const MARKET = [
  { ing: 'salt', price: 2, stock: 6 },
  { ing: 'honey', price: 4, stock: 4 },
  { ing: 'sunwater', price: 5, stock: 4 },
  { ing: 'pepper', price: 6, stock: 4 },
];
// One special each day from the wild areas you have unlocked (or the garden at first).
export const SPECIAL_PRICE = { garden: 4, forest: 9, cave: 14 };

// Upgrades: levels[0] is what you start with.
export const UPGRADES = {
  cauldron: {
    name: 'Cauldron',
    levels: [
      { label: 'Copper Cauldron', batch: 2, zone: 1, speed: 1 },
      { label: 'Iron Cauldron', cost: 45, batch: 3, zone: 1.3, speed: 0.85, desc: 'Makes 3 potions a brew; easier stirring.' },
      { label: 'Silver Cauldron', cost: 120, batch: 3, zone: 1.65, speed: 0.7, desc: 'Much easier stirring for 3-star brews.' },
    ],
  },
  basket: {
    name: 'Basket',
    levels: [
      { label: 'Small Basket', picks: 6 },
      { label: 'Big Basket', cost: 30, picks: 8, desc: '8 picks each morning.' },
      { label: 'Gatherer\'s Pack', cost: 80, picks: 10, desc: '10 picks each morning.' },
    ],
  },
  sign: {
    name: 'Shop Sign',
    levels: [
      { label: 'Chalk Sign', extra: 0 },
      { label: 'Painted Sign', cost: 35, extra: 1, desc: '+1 customer every day.' },
      { label: 'Golden Sign', cost: 90, extra: 2, desc: '+2 customers every day.' },
    ],
  },
  shelf: {
    name: 'Shelves',
    levels: [
      { label: 'One Shelf', cap: 12 },
      { label: 'Two Shelves', cost: 20, cap: 20, desc: 'Hold 20 potions.' },
      { label: 'Potion Wall', cost: 60, cap: 32, desc: 'Hold 32 potions.' },
    ],
  },
  apprentice: {
    name: 'Apprentice',
    levels: [
      { label: 'No apprentice', brews: 0, wage: 0 },
      { label: 'Apprentice Nell', cost: 50, brews: 2, wage: 4, minDay: 5, desc: 'Brews 2 simple potions you know each morning. Wage 4 a day.' },
      { label: 'Trained Nell', cost: 90, brews: 4, wage: 6, desc: 'Brews 4 potions each morning, any recipe you know. Wage 6 a day.' },
    ],
  },
};
export const UPGRADE_ORDER = ['cauldron', 'basket', 'sign', 'shelf', 'apprentice'];

export const START = { coins: 30, rep: 5, inv: { rose: 2, mint: 2 } };
export const STORY_DAYS = 30;
export const MAX_REP = 100;

// Customers. look: NPC sheet row (0-5) and an optional tint for everyday customers.
export const NAMED = {
  mira: { name: 'Mira', title: 'the adventurer', row: 5 },
  pip: { name: 'Pip', title: 'the errand boy', row: 4 },
  tamsin: { name: 'Tamsin', title: 'the baker', row: 1 },
  bram: { name: 'Bram', title: 'the farmer', row: 0 },
  rowan: { name: 'Elder Rowan', title: 'the festival judge', row: 2 },
  vex: { name: 'Madame Vex', title: 'the rival alchemist', row: 3 },
};
export const FOLK = [
  { name: 'A farmhand', row: 0, tint: 0xd8c8a8 },
  { name: 'A traveller', row: 0, tint: 0xb8c8f0 },
  { name: 'A seamstress', row: 1, tint: 0xc8d8ff },
  { name: 'A fisherwoman', row: 1, tint: 0xb8f0c8 },
  { name: 'A schoolboy', row: 4, tint: 0xf0d8a8 },
  { name: 'A stable lad', row: 4, tint: 0xc8b8f0 },
  { name: 'A guard', row: 5, tint: 0xb8c8e0 },
  { name: 'A shepherdess', row: 5, tint: 0xf0e0b0 },
  { name: 'An old sailor', row: 2, tint: 0xa8b8d8 },
  { name: 'A noble', row: 3, tint: 0xf0d090 },
];

// Story visits. The named customer is the first through the door that day.
// req: { potion } or { el }, optional stars (minimum). gift: { coins } or { ing, n }.
// talk: a visit with no request (just news).
export const STORY = [
  { day: 1, who: 'mira', req: { potion: 'life' }, hello: 'You must be Hazel\'s niece! I\'m off on the road again. A Healing Salve for the journey?', thanks: 'Perfect. Hazel would be proud. I\'ll tell everyone about you!', sorry: 'No salve? Well... I\'ll manage. Good luck with the shop.', gift: { coins: 5 } },
  { day: 2, who: 'pip', req: { potion: 'air' }, hello: 'There\'s a race at the fair tomorrow! Can you make my feet fast?', thanks: 'Whoa, my toes are tingling! I\'ll win for sure!', sorry: 'Aw. I\'ll just have to run extra hard.' },
  { day: 3, who: 'tamsin', req: { potion: 'steam' }, hello: 'Hello dear. All that flour has given me a dreadful cough.', thanks: 'Oh, I can breathe again! Here, take a honeycomb from my stall.', sorry: 'Ah well. Perhaps the market has Sunwater... and Hazel always used Bluebells, I think.', gift: { ing: 'honey', n: 2 }, tip: 'Steam Elixir needs Fire and Water. Sunwater from the market has both.' },
  { day: 5, who: 'bram', req: { potion: 'growth' }, hello: 'Morning. My turnips are tiny this year. Got anything for the field?', thanks: 'If this works, you\'ll get the first turnip. And my thanks.', sorry: 'Hm. Maybe next year then.' },
  { day: 6, who: 'pip', talk: true, hello: 'I came second in the race! Mum says to bring you this.', helloFail: 'I came last in the race. Next time I\'m buying a potion first!', gift: { coins: 8 }, needs: 2 },
  { day: 8, who: 'rowan', req: { potion: 'mind' }, hello: 'Good day. My memory is not what it was. A Clear Mind, if you please.', thanks: 'Splendid! Now I remember: the Festival of Flasks is on day 30. You should enter.', sorry: 'Pity. Oh, before I forget: the Festival of Flasks is on day 30. You should enter.' },
  { day: 10, who: 'vex', talk: true, hello: 'So this is Hazel\'s little shop. Cute. My potions win every festival, darling. Don\'t embarrass yourself.' },
  { day: 12, who: 'mira', req: { potion: 'earth', stars: 2 }, hello: 'I\'m going into the cave. I need an Iron Skin, a strong one!', thanks: 'This will stop a golem\'s punch. Thank you, friend.', sorry: 'Guess I\'ll be careful in there. Very careful.', gift: { coins: 12 } },
  { day: 14, who: 'tamsin', req: { potion: 'fire' }, hello: 'My oven keeps going cold, and the festival cakes won\'t bake themselves!', thanks: 'Lovely and toasty. You\'re a treasure.', sorry: 'Oh dear. Cold cakes it is.' },
  { day: 16, who: 'bram', req: { potion: 'forge' }, hello: 'Your tonic worked! Turnips the size of my head. Now my back can\'t haul them all.', thanks: 'Strong as an ox! Here, a little extra for you.', sorry: 'Guess I\'ll carry them one at a time.', gift: { coins: 15 } },
  { day: 18, who: 'pip', req: { potion: 'calm' }, hello: 'I have school exams and I can\'t sleep at all.', thanks: 'Yawn... thanks... I feel sleepy already.', sorry: 'I\'ll count sheep, I guess.' },
  { day: 20, who: 'rowan', talk: true, hello: 'The Festival themes are set! Round one: Fire. Round two: a Healing Salve. Round three: your finest potion. Strong brews win.' },
  { day: 22, who: 'mira', req: { potion: 'vigor', stars: 2 }, hello: 'Back from the deep cave! I found this Dragon Heart. Yours, if you sell me a strong Vigor Potion.', thanks: 'Here, the heart is yours. Treat it well.', sorry: 'Keep it anyway. You\'ll do something wonderful with it.', gift: { ing: 'heart', n: 1 }, giftAlways: true },
  { day: 24, who: 'tamsin', req: { potion: 'luck' }, hello: 'My daughter is getting married! A Lucky Charm for the happy couple?', thanks: 'Oh, it\'s beautiful! Come to the wedding, you hear?', sorry: 'They\'ll just have to make their own luck.' },
  { day: 25, who: 'vex', talk: true, hello: 'Still open? How brave. I\'ve brewed a Fire Tonic so strong it melts spoons. See you at the festival.' },
  { day: 26, who: 'bram', req: { potion: 'mist' }, hello: 'Crows are eating every seed I plant. Something to hide the field?', thanks: 'Ha! Let them peck at fog.', sorry: 'Scarecrow duty for me, then.' },
  { day: 28, who: 'pip', req: { potion: 'spark' }, hello: 'I\'m carrying the lantern in the festival parade! I need to stay awake all night!', thanks: 'Zing! I could run to the moon!', sorry: 'I\'ll drink lots of tea.' },
];

// The Festival of Flasks on day 30: three rounds. Each asks for a potion (or element), scored on match + stars + value.
export const FESTIVAL = [
  { label: 'Round 1: Fire', el: 'fire', text: 'Show us a potion with Fire in it!' },
  { label: 'Round 2: Healing Salve', potion: 'life', text: 'Show us your best Healing Salve!' },
  { label: 'Round 3: Your finest', finest: true, text: 'Show us the finest potion you can make!' },
];

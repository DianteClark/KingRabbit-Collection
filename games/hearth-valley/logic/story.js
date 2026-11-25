// Words for Hearth Valley: letters, villager chat, heart events and the year's milestones.

export const LETTERS = {
  welcome: {
    from: 'Mayor Alder', title: 'Welcome to Hearth Farm',
    body: [
      'Welcome! Your grandmother\'s farm has waited a long time for someone to love it again.',
      'I left 15 Radish seeds in your bag. Till a little soil with the Hoe, plant them, and water them every day.',
      'Emberbrook is east of the farm. Our old town hall is falling apart, and the notice board in front of it lists what we need to fix it. Anything you can spare helps.',
      'Sell your harvest in the shipping bin by the house. I collect it every night.',
    ],
  },
  tess: {
    from: 'Tess', title: 'Seeds in stock',
    body: ['Hi neighbour! The market is open 9am to 6pm (not Wednesdays). I have seeds for every season.', 'Potatoes grow fast, Cabbage sells for a lot. Strawberries keep fruiting!'],
  },
  mine: {
    from: 'Bram', title: 'The mine is open',
    body: ['The rockslide in Whisperwood is cleared. The old mine north of your farm is open again.', 'Mind the slimes. Hit them with your sword, eat something if you get hurt, and climb the ladder up if it gets bad.', 'Bring me ore. I\'ll show you how to build a furnace. Recipe enclosed!'],
    recipe: 'furnace',
  },
  sprinkler: {
    from: 'Bram', title: 'Sprinklers!',
    body: ['You found iron. Good work.', 'Here\'s how to build a Sprinkler: it waters the soil around it every morning, so you can spend the day elsewhere.'],
    recipe: 'sprinkler',
  },
  qsprinkler: {
    from: 'Bram', title: 'Gold!',
    body: ['Gold bars, eh? Now you can build a Quality Sprinkler. Waters all eight tiles around it.'],
    recipe: 'qsprinkler',
  },
  mayojar: {
    from: 'Granny Wren', title: 'For your hens',
    body: ['Your first chicken! Feed them hay in the trough every day and give them a pat, and they\'ll lay every morning.', 'Here is my old recipe for a Mayo Jar. Mayonnaise sells for far more than eggs.'],
    recipe: 'mayojar',
  },
  press: {
    from: 'Granny Wren', title: 'A cow of your own',
    body: ['Cows need hay and kindness, same as hens. Milk every morning if they\'re happy.', 'Here is how to build a Cheese Press. The mayor is very fond of cheese, you know.'],
    recipe: 'press',
  },
  summer: { from: 'Mayor Alder', title: 'Summer is here', body: ['Spring crops have gone over, so plant summer seeds now: Tomato, Blueberry, Melon, Corn and Wheat.', 'Corn and Wheat keep growing into the fall.'] },
  fall: { from: 'Mayor Alder', title: 'Fall is here', body: ['Pumpkins, Yams and Cranberries love the cool fall air.', 'The Harvest Fair is on the 16th.'] },
  winter: { from: 'Mayor Alder', title: 'Winter is here', body: ['Nothing grows outside in winter, but the mine, the lake and your animals still need you.', 'Stock up on hay for the animals. Holly and Snow Roots grow in Whisperwood.'] },
  hall: { from: 'Mayor Alder', title: 'The hall is restored!', body: ['Thanks to you, Emberbrook has its heart back. The whole valley is grateful.', 'The farm is yours to grow as you like. We hope you stay a long, long time.'] },
};

export const FESTIVAL_LETTER = (f) => ({
  from: 'Mayor Alder', title: `${f.name} tomorrow`,
  body: [`Tomorrow is the ${f.name} in the town square, 9am to 2pm.`, f.blurb, 'The day ends after the festival, so do your chores early!'],
});

export const BIRTHDAY_LETTER = (v) => ({
  from: 'Pip', title: `${v.name}'s birthday`,
  body: [`Psst! Tomorrow is ${v.name}'s birthday. A gift they like counts three times as much!`],
});

// Everyday chat. {name} = the farmer. Lines picked by hearts and season.
export const CHAT = {
  bram: {
    low: ['Hmph. New farmer, eh? Tools break, iron doesn\'t.', 'Forge is open 9 to 4. Closed Sundays.', 'Copper ore makes copper bars. Five ore, one bar.'],
    mid: ['Good to see you. Need anything sharpened?', 'Iron starts around floor five of the mine. Gold below twelve.', 'A copper hoe tills three rows in one swing. Worth it.'],
    high: ['You\'re all right, farmer. Truly.', 'I made something for the hall door hinges. Felt good to be useful.'],
  },
  tess: {
    low: ['Welcome to Emberbrook! The market is right behind me.', 'Seeds change with the season, so check back each month.'],
    mid: ['Your radishes were the talk of the square!', 'Compost makes crops grow faster. Fiber and wood is all it takes.', 'Melons sell for a fortune in summer.'],
    high: ['I saved the best seeds for you. Don\'t tell anyone.', 'This town feels alive again. You did that.'],
  },
  alder: {
    low: ['Ah, the new farmer! Have you seen the notice board by the hall?', 'Each bundle on the board fixes part of the town hall.'],
    mid: ['The board is filling up. I can almost hear music in the hall again.', 'A good farmer ships something every day.'],
    high: ['Your grandmother would be very proud of you.', 'When the hall is done, we\'ll throw the biggest party in the valley.'],
  },
  wren: {
    low: ['Animals need hay in the trough every day, rain or shine.', 'A pat a day keeps your hens laying.'],
    mid: ['Tall grass on your farm makes good hay. Cut it with your sword.', 'Happy cows give milk every morning.'],
    high: ['You remind me of myself at your age. Stubborn and kind.', 'Come by for tea any time, dear.'],
  },
  pip: {
    low: ['Are you the farmer? Do you have any slime? I collect it!', 'I found a frog in the river. Then it found me.'],
    mid: ['Mira says Old Whiskers only comes out in the rain.', 'Slimes are squishy. Bram says not to touch them. I touch them.'],
    high: ['You\'re my best friend. Don\'t tell Mira.', 'I drew you a picture of your farm. It has a dragon now.'],
  },
  mira: {
    low: ['The river has trout in summer and fall. The lake has bass all year.', 'Fishing is about patience. And bait.'],
    mid: ['Hold to reel when the fish is inside your bar. Let go to drop.', 'Pike come out in the fall and winter. They fight hard.'],
    high: ['They say Old Whiskers lives in the lake. Rainy days only.', 'I\'ve never had a fishing buddy before. It\'s nice.'],
  },
};

export const SEASON_CHAT = [
  ['Spring rain is good for the crops.', 'The Egg Hunt is on the 13th!'],
  ['It\'s hot! Don\'t forget to water.', 'The River Derby is on the 11th.'],
  ['The leaves are turning. Lovely, isn\'t it?', 'The Harvest Fair is on the 16th.'],
  ['Brr! Stay warm out there.', 'The Winter Star is on the 25th.'],
];

// Heart events at 2, 4 and 6 hearts. Each: lines, then a reward.
export const HEART_EVENTS = {
  bram: [
    { lines: ['Bram: I was a soldier, once. Swords. Now I make hoes and kettles.', 'Bram: Better work, this. Here, take some copper. On the house.'], reward: { copperbar: 2 } },
    { lines: ['Bram: My father built that town hall\'s bell. It cracked in the big storm.', 'Bram: If the hall comes back... I\'ll recast it. Promise.'], reward: { ironbar: 2 } },
    { lines: ['Bram: You know, nobody stops by just to talk. Except you.', 'Bram: Take this. Found it in the mine years ago. Never had anyone to give it to.'], reward: { diamond: 1 } },
  ],
  tess: [
    { lines: ['Tess: Can I tell you a secret? I\'ve never grown a single plant. They all die!', 'Tess: Maybe you can teach me. Here, some seeds for your trouble.'], reward: { compost: 5 } },
    { lines: ['Tess: The market was my mother\'s. I keep it open because she loved this town.', 'Tess: Thank you for helping it come back to life.'], reward: { salad: 3 } },
    { lines: ['Tess: I planted a strawberry on my windowsill. It\'s ALIVE!', 'Tess: I owe you. Take these, my very best.'], reward: { cheese: 2 } },
  ],
  alder: [
    { lines: ['Alder: I was mayor when the hall fell. I\'ve felt guilty ever since.', 'Alder: Seeing you work gives me hope.'], reward: { gold: 300 } },
    { lines: ['Alder: Your grandmother and I planted the old oak by the square. Seventy years ago!', 'Alder: Here, her old watering can is in your shed... and some gold, for repairs.'], reward: { gold: 500 } },
    { lines: ['Alder: I\'ve decided. When the hall opens, there will be a plaque with your name.', 'Alder: Don\'t argue with the mayor.'], reward: { goldbar: 1 } },
  ],
  wren: [
    { lines: ['Wren: My first cow was called Butterbean. Ate my hat once.', 'Wren: Here, some hay for your critters.'], reward: { hay: 20 } },
    { lines: ['Wren: When my husband passed, the animals kept me going.', 'Wren: They need us, and we need them. Take this.'], reward: { mayo: 2 } },
    { lines: ['Wren: You\'re like family now, dear. I mean that.', 'Wren: Grandma\'s secret: a lucky clover in the barn keeps cows happy.'], reward: { clover: 1 } },
  ],
  pip: [
    { lines: ['Pip: Want to see my secret slime collection? ...It escaped.', 'Pip: Here, you can have this feather. It\'s a good one.'], reward: { feather: 2 } },
    { lines: ['Pip: When I grow up I\'m going to be a farmer like you. Or a dragon.', 'Pip: Here! I found it by the river.'], reward: { aquamarine: 1 } },
    { lines: ['Pip: I made you a friendship bracelet. It\'s made of grass. And a worm.', 'Pip: The worm can be bait if you want.'], reward: { bait: 20 } },
  ],
  mira: [
    { lines: ['Mira: Want a tip? Fish bite faster with bait. Here.', 'Mira: Craft more with fiber and slime.'], reward: { bait: 15 } },
    { lines: ['Mira: My dad taught me to fish on this river. He\'s out at sea now.', 'Mira: I hope he comes home when the hall bell rings again.'], reward: { trout: 2 } },
    { lines: ['Mira: I saw Old Whiskers once. A shadow as big as a boat!', 'Mira: Take my lucky lure... well, a ruby. Same thing.'], reward: { ruby: 1 } },
  ],
};

export const GIFT_REPLY = {
  love: ['Oh! I love this! Thank you so much!', 'This is my favourite! How did you know?'],
  like: ['Thank you, I like this.', 'How thoughtful of you!'],
  neutral: ['Oh, thanks.', 'Thank you.'],
  hate: ['...Why would you give me this?', 'Ugh. No thank you.'],
};

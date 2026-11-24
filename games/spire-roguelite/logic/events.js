// "?" rooms. Each event has a picture, some text and choices. A choice returns an outcome:
//   { text }                       just show the result
//   { text, pick: { mode, filter } } choose a card from your deck (remove/upgrade/transform/duplicate)
//   { text, offer: [cardIds] }     choose one of these cards (or skip)
//   { text, fight: [enemyIds] }    start a fight
// `need(run)` hides a choice's button behind a reason when it can't be taken.

export const EVENTS = {
  shrine: {
    title: 'Old Shrine', art: 'bld:0,6', acts: [1, 2, 3],
    text: 'A moss-covered shrine hums softly. Coins glitter in its offering bowl.',
    choices: [
      { label: 'Pray', desc: 'Upgrade a card.', go: () => ({ text: 'A warm light fills you.', pick: { mode: 'upgrade' } }) },
      { label: 'Desecrate', desc: 'Gain 80 gold. Become cursed (Doubt).', go: (run, api) => { api.gainGold(80); api.addCard('doubt'); return { text: 'You pocket the coins. A cold whisper follows you.' }; } },
      { label: 'Leave', desc: 'Nothing happens.', go: () => ({ text: 'You walk on.' }) },
    ],
  },
  spring: {
    title: 'Healing Spring', art: 'bld:5,0', acts: [1, 2, 3],
    text: 'Clear water bubbles up between white stones. It smells of mint.',
    choices: [
      { label: 'Drink', desc: 'Heal 33% of your Max HP.', go: (run, api) => { api.healPct(0.33); return { text: 'You feel refreshed.' }; } },
      { label: 'Bathe', desc: 'Remove a card from your deck.', go: () => ({ text: 'The water washes something away.', pick: { mode: 'remove' } }) },
      { label: 'Leave', desc: 'Nothing happens.', go: () => ({ text: 'You walk on.' }) },
    ],
  },
  library: {
    title: 'Forgotten Library', art: 'bld:1,1', acts: [1, 2, 3],
    text: 'Dusty shelves lean over a reading desk. One book is still open.',
    choices: [
      { label: 'Read', desc: 'Choose 1 of 3 cards for your deck.', go: (run, api) => ({ text: 'The pages teach you a new trick.', offer: api.cardChoices(3) }) },
      { label: 'Nap', desc: 'Heal 20% of your Max HP.', go: (run, api) => { api.healPct(0.2); return { text: 'You wake up rested.' }; } },
    ],
  },
  altar: {
    title: 'Blood Altar', art: 'bld:6,6', acts: [1, 2, 3],
    text: 'A stone altar, stained dark. Something glints on top of it.',
    choices: [
      { label: 'Offer blood', desc: (run) => `Lose ${Math.ceil(run.maxHp * 0.15)} HP. Gain a relic.`, go: (run, api) => { api.loseHp(Math.ceil(run.maxHp * 0.15)); const r = api.giveRelic('uncommon'); return { text: `You take the ${r}.` }; } },
      { label: 'Leave', desc: 'Nothing happens.', go: () => ({ text: 'You leave it alone.' }) },
    ],
  },
  gambler: {
    title: 'Goblin Gambler', art: 'cr:strong:16', acts: [1, 2, 3],
    text: '"Double or nothing, friend! Shells are honest, I promise!"',
    choices: [
      {
        label: 'Bet 40 gold', desc: 'Even odds: win 60 gold or lose 40.', need: (run) => (run.gold >= 40 ? '' : 'Needs 40 gold'),
        go: (run, api) => {
          if (api.chance(0.5)) { api.gainGold(60); return { text: 'You win! The goblin pays up, grumbling.' }; }
          api.gainGold(-40);
          return { text: 'The shell is empty. The goblin grins.' };
        },
      },
      { label: 'Leave', desc: 'Nothing happens.', go: () => ({ text: 'You keep your money.' }) },
    ],
  },
  chest: {
    title: 'Trapped Chest', art: 'img:chest', acts: [1, 2, 3],
    text: 'A heavy iron chest. Thin wires run from the lock into the walls.',
    choices: [
      { label: 'Smash it', desc: (run) => `Lose ${4 + 4 * run.act} HP. Gain 75 gold.`, go: (run, api) => { api.loseHp(4 + 4 * run.act); api.gainGold(75); return { text: 'Darts fly, but the gold is yours.' }; } },
      {
        label: 'Pick the lock', desc: '60%: gain a relic. 40%: lose 6 HP.',
        go: (run, api) => {
          if (api.chance(0.6)) { const r = api.giveRelic('common'); return { text: `Click! Inside you find the ${r}.` }; }
          api.loseHp(6);
          return { text: 'Snap! A needle jabs your finger. The lock holds.' };
        },
      },
      { label: 'Leave', desc: 'Nothing happens.', go: () => ({ text: 'You walk on.' }) },
    ],
  },
  hermit: {
    title: 'Wise Hermit', art: 'cr:rampart:96', acts: [1, 2, 3],
    text: 'An old hermit looks up from his fire. "Every lesson has a price."',
    choices: [
      { label: 'Learn', desc: 'Lose 5 Max HP. Upgrade 2 random cards.', go: (run, api) => { api.gainMaxHp(-5); const n = api.upgradeRandom(2); return { text: n ? `${n} card(s) upgraded.` : 'You already know it all.' }; } },
      { label: 'Pay 50 gold', desc: 'Remove a card from your deck.', need: (run) => (run.gold >= 50 ? '' : 'Needs 50 gold'), go: (run, api) => { api.gainGold(-50); return { text: 'He helps you forget a bad habit.', pick: { mode: 'remove' } }; } },
      { label: 'Leave', desc: 'Nothing happens.', go: () => ({ text: 'You nod and move on.' }) },
    ],
  },
  bandits: {
    title: 'Ambush!', art: 'cr:castle:16', acts: [1, 2],
    text: 'Bandits step out of the trees. "Your gold, or your life."',
    choices: [
      { label: 'Fight', desc: 'Fight the bandits for a normal reward.', go: (run) => ({ text: 'Steel rings out!', fight: run.act === 1 ? ['pikeman', 'archer'] : ['pikeman', 'archer', 'darkMage'] }) },
      { label: 'Pay them', desc: (run) => `Lose ${Math.min(run.gold, 60)} gold.`, go: (run, api) => { api.gainGold(-Math.min(run.gold, 60)); return { text: 'They count the coins and vanish.' }; } },
    ],
  },
  mirror: {
    title: 'Strange Mirror', art: 'ar:0,7', acts: [1, 2, 3],
    text: 'Your reflection winks at you. You did not wink.',
    choices: [
      { label: 'Reflect', desc: 'Duplicate a card in your deck.', go: () => ({ text: 'Two of a kind.', pick: { mode: 'duplicate' } }) },
      { label: 'Reach in', desc: 'Transform a card into a random one.', go: () => ({ text: 'Something changes.', pick: { mode: 'transform' } }) },
      { label: 'Leave', desc: 'Nothing happens.', go: () => ({ text: 'You look away.' }) },
    ],
  },
  fountain: {
    title: 'Wishing Fountain', art: 'bld:7,5', acts: [1, 2, 3],
    text: 'Coins shimmer at the bottom of a carved stone fountain.',
    choices: [
      { label: 'Toss 25 gold', desc: 'Gain a random potion.', need: (run, api) => (run.gold < 25 ? 'Needs 25 gold' : api.canGetPotion() ? '' : 'No potion space'), go: (run, api) => { api.gainGold(-25); const p = api.givePotion(); return { text: `A ${p} floats up.` }; } },
      { label: 'Drink deeply', desc: 'Gain 5 Max HP.', go: (run, api) => { api.gainMaxHp(5); return { text: 'You feel tougher.' }; } },
    ],
  },
  mushrooms: {
    title: 'Glowing Mushrooms', art: 'ar:1,3', acts: [1, 2],
    text: 'A ring of glowing mushrooms. Something rustles in the dark beyond.',
    choices: [
      { label: 'Eat them', desc: 'Heal 30% of Max HP. Become cursed (Decay).', go: (run, api) => { api.healPct(0.3); api.addCard('decay'); return { text: 'Delicious... but your stomach turns.' }; } },
      { label: 'Stomp them', desc: 'Something attacks! Fight for a reward.', go: () => ({ text: 'Rats pour out of the ring!', fight: ['rat', 'rat', 'rat'] }) },
      { label: 'Leave', desc: 'Nothing happens.', go: () => ({ text: 'You step around them.' }) },
    ],
  },
  bargain: {
    title: 'Dark Bargain', art: 'cr:necro:208', acts: [2, 3],
    text: 'A hooded figure offers a gleaming relic. "Only a little of your life..."',
    choices: [
      { label: 'Accept', desc: 'Lose 8 Max HP. Gain a rare relic.', go: (run, api) => { api.gainMaxHp(-8); const r = api.giveRelic('rare'); return { text: `You take the ${r}. You feel a little emptier.` }; } },
      { label: 'Refuse', desc: 'Nothing happens.', go: () => ({ text: 'The figure fades into the dark.' }) },
    ],
  },
  forge: {
    title: 'Abandoned Forge', art: 'bld:2,8', acts: [2, 3],
    text: 'The anvil is still warm. Tools hang neatly on the wall.',
    choices: [
      { label: 'Forge', desc: 'Upgrade a card.', go: () => ({ text: 'Clang, clang, clang!', pick: { mode: 'upgrade' } }) },
      { label: 'Scavenge', desc: 'Gain 45 gold.', go: (run, api) => { api.gainGold(45); return { text: 'You find some coins in a drawer.' }; } },
    ],
  },
};

export const EVENT_IDS = Object.keys(EVENTS);

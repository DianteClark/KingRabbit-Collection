// How to Play text, shown by the gold "?" button on every screen.
export const RULES = {
  title: 'Pixel Quest',
  sections: [
    { heading: 'Goal', text: 'Vesper, the Night Warden, stole the three Chimes of the Sun Bell, and the sun stopped rising. Find the Chimes in the Mole Cave, the Wind Tower and the Ember Cave, then storm Vesper\'s castle, Nightspire, and bring back the dawn.' },
    {
      heading: 'Getting around',
      items: [
        'Hold the arrow pad to walk. Slide your thumb to change direction.',
        'Or tap any spot on the map to walk there.',
        'Tap a person, chest, sign or switch (or face it and press A) to use it.',
        'Shopkeepers stand behind counters: talk to them across the counter.',
        'The Menu shows your goal, party, items, gear and spells, and lets you save.',
      ],
    },
    {
      heading: 'Battles',
      items: [
        'Monsters attack at random outside towns. Pick a command for each hero, then watch the round play out. Faster heroes and monsters act first.',
        'Fight: a normal attack. Skill: spells and abilities that cost MP. Item: use something from the bag. Guard: take half damage this round. Run: try to escape (never from bosses).',
        'Tap a monster to pick it as the target.',
        'Auto lets the heroes choose for themselves. The >> button speeds battles up.',
        'Some monsters are weak to Fire, Ice, Bolt or Holy. "Very effective!" means you found a weakness.',
        'A gold mark in a hero\'s corner means their attack is raised; a blue mark means their defence is raised.',
        'Every hero gets the full experience from a won battle, even a fallen one.',
      ],
    },
    {
      heading: 'The heroes',
      items: [
        'Ash, Warrior: strong and tough. Provoke makes monsters attack him instead of the others.',
        'Sola, Cleric: heals, cures, revives (Raise) and burns the undead with Holy.',
        'Kit, Thief: fast, lands critical hits, and can Steal an item from each monster.',
        'Wren, Mage: frail, but Blaze and Thunder hit every monster at once.',
      ],
    },
    {
      heading: 'Status',
      items: [
        'Poison: loses HP every round. It lasts after battle until cured (Antidote, Clear Salts, Cure or an inn).',
        'Sleep: skips turns. A hit may wake them up.',
        'Silence: can\'t cast spells for a few rounds.',
        'Slow: acts later in the round.',
      ],
    },
    {
      heading: 'Towns',
      items: [
        'Inns heal everyone (and revive fallen heroes) for a few gold.',
        'Item shops sell Herbs, Tonics, Ethers (MP) and more. Ward Incense stops random battles for 150 steps. A Home Wing flies you back to the last inn.',
        'Gear shops sell weapons, armour and charms. Each hero can only use some gear: the shop shows who and how much better it is.',
        'Talk to everyone: people give hints about where to go next.',
      ],
    },
    {
      heading: 'Dungeons',
      items: [
        'Chests hold treasure. A few of them bite!',
        'Crystal switches raise and lower the red and blue walls.',
        'Levers, locked doors and old braziers hide the way forward. Read the signs.',
        'A boss guards each Chime. Rest and stock up before you face one.',
        'Some walls are not what they seem...',
      ],
    },
    {
      heading: 'If everyone falls',
      text: 'You wake up at the last inn you rested at. On Normal you lose half your gold; on Story you keep it.',
    },
    {
      heading: 'Options',
      items: [
        'Story: weaker monsters, smaller groups and more gold. Normal: the full challenge. Change it any time in Options.',
        'Monster groups also grow when you out-level an area, and shrink while your party is small.',
        'The battle rate (Low, Normal, High) changes how often monsters appear.',
      ],
    },
    { heading: 'Saving', text: 'The game saves itself whenever you change area and after battles. You can also Save from the Menu at any time. Continue picks up the newest save.' },
    { heading: 'Daily Arena', text: 'A new seeded challenge every day: a ready-made party fights five waves, ending with a boss. Your score counts waves cleared, HP left and speed.' },
    { heading: 'Credits', text: 'Art: RAS Overworld, MAS Roguelike and MAS Darkness Pack by Aleksandr Makarov (iknowkingrabbit). Font: BoldPixels by YukiPixels. Music, story and code: original for the KingRabbit Collection.' },
  ],
};

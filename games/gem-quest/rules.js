// "How to play" text, shown by the gold ? button on every screen.

export const RULES = {
  title: 'Gem Quest',
  sections: [
    { heading: 'Goal', text: 'Lead your heroes across four regions and defeat the Red Dragon in the Infernal Rift. Every battle is a gem-matching duel: you and the monster take turns on the same board.' },
    {
      heading: 'Moving gems',
      items: [
        'Swipe a gem toward a neighbour to swap them, or tap one gem and then a neighbour.',
        'A swap only counts if it lines up 3 or more gems of one kind (across or down). Otherwise the gems slide back.',
        'Matched gems vanish, the gems above fall, and new ones drop in. Falling gems can match again: a cascade.',
        'If the board runs out of moves it is shuffled for you.',
      ],
    },
    {
      heading: 'What gems do',
      items: [
        'Red, blue, green and yellow gems fill your mana of that colour.',
        'Skulls hit the other side straight away: each skull deals your skull damage.',
        'Coins are gold for the shop (monsters get nothing from them).',
        'Whoever makes the match gets the gems, so on the monster\'s turn its matches charge the monster.',
      ],
    },
    {
      heading: 'Special gems',
      items: [
        'Match 4 in a row: a line gem (striped). When it is cleared it wipes its whole row or column.',
        'Match in an L or T shape: a bomb gem. It blasts the 3x3 square around it.',
        'Match 5 in a row: a star gem. Swap it with any gem to clear every gem of that kind.',
        'A match of 4 or more also gives you an extra turn.',
      ],
    },
    {
      heading: 'Skills',
      items: [
        'Each hero has 4 skills (opened at levels 1, 3, 6 and 10). A skill lights up when you have the mana it costs.',
        'Tap a skill to read it, then tap Cast. Using a skill ends your turn unless it says Free.',
        'Mana is capped at 20 of each colour (more with some gear).',
      ],
    },
    {
      heading: 'The monster',
      items: [
        'The box under the monster\'s HP shows its intent: the skill it is charging and how much mana it still needs. It casts the moment it can afford it.',
        'Deny it: matching gems of the colour it needs takes them away from the board before it can.',
        'Status icons: shield (soaks damage), poison (damage at the start of each turn), stun (skips turns), rage (skulls hit harder), weak (skulls hit softer).',
        'Monsters get smarter or gentler depending on how your battles go.',
      ],
    },
    {
      heading: 'The world map',
      items: [
        'Each region has 8 battles; the last is a boss. Beat it to open the next region.',
        'Side quests (chest) have a twist, like a turn limit or starting wounded, and reward unique gear.',
        'Riddle stones are puzzles: a fixed board with no new gems. Clear every gem within the move limit. Undo is free.',
        'The town sells gear. Win or lose, heroes earn XP; heroes who sit out get half.',
        'You can replay any battle you have won for more XP and gold.',
      ],
    },
    {
      heading: 'Heroes and gear',
      items: [
        'Knight and Mage start. The Ranger joins in the Haunted Crypt, the Berserker in the Frost Peaks.',
        'Pick your active hero and their gear on the Heroes screen. Gear is shared: any hero can wear what you own.',
        'Weapon, armour and charm slots. Gear adds HP, skull damage, skill power (more damage, healing and shields) or starting mana.',
      ],
    },
    {
      heading: 'Endless Tower and Daily Duel',
      items: [
        'Endless Tower: climb floor by floor with one hero. HP carries over (you heal 35% between floors) and every 5th floor is a boss. Each floor pays gold for the campaign.',
        'Daily Duel: the same hero, monster and board for everyone today. Win fast with lots of HP left for the best score.',
      ],
    },
    { heading: 'Saving', text: 'Everything is saved as you play, even in the middle of a battle. Close the game any time and tap Continue.' },
    { heading: 'Credits', text: 'Pixel art: HAS Heroic Fantasy and MAS Mini Retro by Aleksandr Makarov (iknowkingrabbit). Font: BoldPixels.' },
  ],
};

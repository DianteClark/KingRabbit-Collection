// "How to play" text, shown by the gold ? button on every screen.

export const RULES = {
  title: 'Spire Roguelite',
  sections: [
    { heading: 'Goal', text: 'Pick a hero and climb three acts. Each act ends with a boss. Beat the third boss to win. If your HP reaches 0 the run is over and you start again with a new deck.' },
    {
      heading: 'The map',
      items: [
        'Start at the bottom and tap a glowing room to walk there. Paths only go upward, so plan your route.',
        'Swords: a fight. Skull cave: an elite (hard, but drops a relic). Crystal ball: an unknown event.',
        'Campfire: rest or upgrade. Stall: the merchant. Chest: treasure. The boss waits at the top.',
      ],
    },
    {
      heading: 'Fights',
      items: [
        'Each turn you get 3 Energy and draw 5 cards. The number in a card\'s corner is its Energy cost.',
        'Tap a card to see what it does. Tap it again to play it, or tap an enemy to aim it. You can also drag a card up onto an enemy.',
        'Block stops damage until the start of your next turn.',
        'Tap End Turn when you are done. Cards left in your hand are discarded. When your draw pile runs out, your discard pile is shuffled back in.',
        'Exhaust: the card is removed until the fight ends. Ethereal: exhausted if still in your hand at the end of your turn.',
      ],
    },
    {
      heading: 'Enemy intents',
      items: [
        'The icon above each enemy shows what it will do next turn.',
        'Sword: it attacks for the number shown ("6x2" means 6 damage twice). Shield: it will Block. Green arrow: it buffs itself. Purple arrow: it weakens you or adds junk cards to your deck.',
        'Tap an enemy to read its intent and statuses in plain words.',
      ],
    },
    {
      heading: 'Statuses',
      items: [
        'Strength: +1 damage per hit for each point. Dexterity: +1 Block from cards per point.',
        'Weak: deals 25% less attack damage. Vulnerable: takes 50% more attack damage. Frail: gains 25% less Block. These count down each turn.',
        'Poison: loses that much HP at the start of its turn, then Poison goes down by 1.',
        'Thorns: whoever attacks it takes that much damage. Plated: gains Block every turn, losing 1 each time an attack gets through.',
        'Ritual: gains Strength every turn. Artifact: blocks the next debuff.',
      ],
    },
    {
      heading: 'Rewards',
      items: [
        'After a fight, take the gold, any potion, and choose 1 of 3 new cards (or skip: a small deck draws its best cards more often).',
        'Relics are permanent bonuses for the rest of the run. Elites, chests and bosses give them.',
        'Potions are one-shot helpers. Tap a potion at the top of the screen to drink it. You can carry 3.',
        'After each boss, choose a powerful boss relic. Most give +1 Energy with a drawback.',
      ],
    },
    {
      heading: 'Camps, shops and events',
      items: [
        'Campfire: Rest to heal 30% of your Max HP, or Smith to upgrade one card for good (upgraded cards show a +).',
        'Merchant: buy cards, relics and potions, or pay to remove a card from your deck (removing weak Strikes and Defends makes your deck stronger).',
        'Events: read and choose. Some choices cost HP or gold for a reward.',
      ],
    },
    {
      heading: 'Heroes',
      items: [
        'Knight (80 HP): Strength, heavy hits and lots of Block. Heals 6 HP after each fight.',
        'Mage (72 HP): spells that hit ALL enemies, card draw and extra Energy. Draws 2 extra cards and gains 1 Energy on the first turn.',
        'Ranger (72 HP): Poison, Dexterity and cheap quick cards. Poisons all enemies at the start of each fight.',
      ],
    },
    {
      heading: 'Endless mode',
      text: 'A slightly easier start (+10 Max HP, a healing potion, gentler enemies), but the acts keep looping. Every loop enemies get tougher. How high can you climb? Your best floor and score are saved.',
    },
    { heading: 'Saving', text: 'Your run is saved after every step. Close the page any time and tap Continue to carry on.' },
    { heading: 'Art', text: 'Pixel art: HAS Heroic Fantasy by Aleksandr Makarov (iknowkingrabbit). Font: BoldPixels.' },
  ],
};

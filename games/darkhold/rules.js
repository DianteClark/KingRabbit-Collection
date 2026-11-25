// "How to play" text, shown by the gold ? button on every screen.

export const RULES = {
  title: 'Darkhold',
  sections: [
    { heading: 'Goal', text: 'Climb down through ten dark floors and defeat the Hollow King in his hall at the bottom. You have one life: if you fall, the run is over and you start a new one. Your run is saved after every turn.' },
    {
      heading: 'Moving and fighting',
      items: [
        'Use the arrow pad, or tap a spot you have seen to walk there. Walking stops by itself when a monster shows up.',
        'Walk into a monster to attack it. Attacking a sleeping or unaware monster is a sneak attack and hits much harder.',
        'Tap a monster that is further away to see what it is (and to shoot it).',
        'Everything takes turns: monsters only move when you do. The Wait button in the middle of the pad lets one turn pass. Rest waits until you are healed (it stops if a monster shows up).',
        'Find the stairs on each floor, step on them and tap Descend.',
        'Controller: the d-pad steps (hold it to keep walking; it stops when something shows up). A picks up or descends where you stand, otherwise waits a turn. B searches, X fires, Y opens the bag, L rests, R shows your hero, Select the map and Start the pause menu. In menus the d-pad moves a gold frame, A picks and B goes back. The arrow pad hides while you use the controller.',
      ],
    },
    {
      heading: 'Your torch',
      items: [
        'Your torch burns down as you walk. The less fuel, the smaller your circle of light (the orange bar at the top).',
        'Refuel with Flasks of Oil, Fresh Torches, or by walking into a brazier to light it. A lit brazier also lights up its room for good.',
        'Monsters hide in the dark until they are close. Shades and Wraiths fear bright light and only dare to attack when your torch is low.',
      ],
    },
    {
      heading: 'Items',
      items: [
        'You pick things up by walking over them. Open your Bag to use, equip or drop them.',
        'Potions and scrolls look different every run and are unknown until you try one (or buy one). Most help, a few hurt.',
        'Weapons, bows, armour and rings: tap one in your Bag to equip it. Bows need arrows. The Fire button shoots the nearest monster (tap one to pick another).',
        'Eat when you are Hungry. Food is fairly common.',
        'Gold buys things from the merchant, who sets up shop on floors 3, 6 and 9.',
      ],
    },
    {
      heading: 'Secrets and traps',
      items: [
        'Some walls hide secret doors, often with treasure behind. Tap Search to look around you (searching again helps).',
        'Hidden traps go off when stepped on. Found traps are marked, and tapping to walk goes around them.',
      ],
    },
    {
      heading: 'Levels and perks',
      text: 'Defeating monsters gives experience. Each new level gives more HP and a choice of one perk out of three, such as Tough, Brawler or Thrifty Flame.',
    },
    {
      heading: 'Heroes',
      items: [
        'Knight: lots of HP, sword and armour. Sometimes blocks a blow with his shield.',
        'Rogue: dagger and bow. Triple damage sneak attacks, often finds weak spots, and is good at finding traps and secret doors.',
        'Mage: casts Firebolt with mana that refills as you walk. Her torch lasts longer and she knows some scrolls.',
      ],
    },
    {
      heading: 'Modes',
      items: [
        'Normal: the full challenge.',
        'Lantern: an easier way to play. A brighter light that lasts longer, more healing, slower hunger and two healing potions to start.',
        'Daily Run: the same dungeon for everyone today. Pick a hero and try for your best score.',
        'Monsters get a little more or less alert depending on how your recent runs went. The map and the loot are never changed.',
      ],
    },
    { heading: 'The Hollow King', text: 'He is only really hurt while he stands in brazier light, and he keeps blowing the braziers out. Light them again and fight him near one.' },
    { heading: 'Art', text: 'Pixel art: MAS Darkness Pack by Aleksandr Makarov (iknowkingrabbit). Font: BoldPixels. Music and sounds made for this game.' },
  ],
};

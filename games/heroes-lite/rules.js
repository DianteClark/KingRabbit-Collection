// How to Play text, shown by the gold "?" button on every screen.

export const RULES = {
  title: 'Heroes Lite',
  sections: [
    { heading: 'Goal', text: 'Lead your heroes, grow your towns and capture every enemy town. You lose if you have no towns and no heroes left, or go 7 days without a town. In Last Stand there are no enemy towns: survive the weekly waves as long as you can.' },
    {
      heading: 'The adventure map',
      items: [
        'Drag to look around. Tap a hero (or its portrait at the bottom) to select it.',
        'Tap a tile to plan a route: white dots are reachable today, orange ones need more days. Tap the same tile again to go.',
        'Each step uses movement points (diagonals cost more). Movement refills every morning. Tap End Day when you are done.',
        'Walk onto resources, chests, campfires and artifacts to pick them up. Visit mines to flag them for daily income.',
        'Shrines and buildings raise your hero\'s skills once per hero. Fountains and stables can be used every day.',
        'Monsters attack any hero who steps next to them. Tap a monster to see how many there are before you fight.',
      ],
    },
    {
      heading: 'Days and weeks',
      items: [
        'Every morning your towns and mines pay out: gold, wood, ore and gems.',
        'Each new week (day 1, 8, 15...) every dwelling grows new creatures to recruit, and wandering monsters grow too.',
      ],
    },
    {
      heading: 'Towns',
      items: [
        'Tap your town on the map (or the Town button) to open it. You can build one structure per day if you have the resources.',
        'Dwellings let you recruit creatures. Recruits join the hero standing in the town gate, or else the garrison.',
        'The Hall raises your daily gold. The Citadel adds 50% growth and stronger walls. The Mage Guild teaches spells to heroes who visit, and refills their mana.',
        'At the Tavern you can hire up to 4 heroes. The Marketplace trades resources for gold.',
        'In the Army tab tap a stack to move it between the hero and the garrison. Town defenders get +2 Defense (+5 with a Citadel).',
      ],
    },
    {
      heading: 'Heroes',
      items: [
        'Attack and Defense boost every creature in the army. Spell Power makes spells stronger; Knowledge gives 10 mana per point.',
        'Win battles to gain experience. Each level gives +1 to a skill and a choice of two abilities, like Offense, Archery, Logistics or Necromancy.',
        'An army holds up to 5 stacks. Tap one of your heroes standing next to the selected hero to swap troops.',
        'Artifacts give lasting bonuses. A beaten hero is gone, and the winner takes its artifacts.',
      ],
    },
    {
      heading: 'Battles',
      items: [
        'Stacks act in order of speed (shown along the bottom). The glowing stack is yours to command.',
        'Tap a lit square to move, or tap an enemy to attack it. Shooters fire from anywhere unless an enemy stands next to them.',
        'Every stack strikes back once per round when attacked (Griffins twice). Vampires can\'t be struck back.',
        'Wait to act later this round. Defend for +30% Defense until your next turn.',
        'Your hero may cast one spell per round: tap Spell, pick one, then tap the target.',
        'Auto lets the computer fight for you. Weak monster packs can be beaten instantly with Quick battle.',
        'Flee (top left): Retreat saves your hero but loses the whole army. Against an enemy hero you can instead Surrender: pay half the price of your remaining troops and keep them. Either way the hero waits at your Taverns to be hired again.',
        'The computer flees too when a fight is hopeless, so expect to meet its heroes again.',
      ],
    },
    { heading: 'Saving and settings', text: 'The game saves itself after every move. Close the tab whenever you like and tap Continue to pick up where you left off. The < button on the map opens a menu where you can turn sound off or skip watching enemy moves.' },
    { heading: 'Credits', text: 'Art: HAS Heroic Fantasy by Aleksandr Makarov (iknowkingrabbit). Font: BoldPixels.' },
  ],
};

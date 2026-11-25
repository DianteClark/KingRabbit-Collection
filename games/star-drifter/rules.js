// "How to play" text, shown by the gold ? button on every screen.

export const RULES = {
  title: 'Star Drifter',
  sections: [
    { heading: 'Goal', text: 'Fly your ship through 7 sectors to the Throne Gate and destroy the Hegemony flagship, The Iron Verdict. If your hull reaches 0 or your whole crew dies, the run is over and you start again.' },
    {
      heading: 'The sector map',
      items: [
        'Tap a glowing beacon linked to yours, then Jump. Each jump uses 1 fuel.',
        'Beacons hold fights, events, stores or quiet space. Stores are marked. The exit beacon leads to the next sector.',
        'The red zone is the Hegemony fleet. It moves up a little with every jump. Landing inside it means a hard fight with a fleet warship, so keep moving.',
        'Out of fuel? Tap Drift to scrape up 1 fuel. The fleet gets closer while you wait.',
      ],
    },
    {
      heading: 'Combat basics',
      items: [
        'Fights happen in real time. Pause any time with the pause button, and use 2x to speed up. You can give orders while paused.',
        'Tap a weapon card to pick it, then tap an enemy room to aim. It fires whenever it is charged and keeps firing at that room (turn off Auto to fire once).',
        'Shields: every shield layer blocks one laser or ion shot, then recharges. Fire several weapons together to break through.',
        'Missiles fly through shields but use a missile each. Ion shots knock out a shield layer or lock a system. Beams never miss and cut through a row of rooms.',
        'Dodge chance comes from engines, and needs someone at the helm (piloting).',
        'Win by destroying the enemy hull or by killing its whole crew. Once your jump drive is charged you can JUMP away instead (not from the flagship).',
      ],
    },
    {
      heading: 'Power',
      items: [
        'Your reactor has a fixed amount of power. Tap a system at the bottom of the fight screen, then + or - to move power around.',
        'Weapons and drones take their own power: tap a weapon card to switch it on. A system that gets hit loses power, which comes back once it is repaired.',
        'Piloting and sensors need no power, only crew and upgrades.',
      ],
    },
    {
      heading: 'Crew',
      items: [
        'Tap a crew member (on the ship or in the crew bar), then tap a room to send them there. That room becomes their station.',
        'Crew standing in a system room man it for a bonus: pilots and engineers add dodge, gunners charge weapons faster, shield crew recharge shields faster. They get better with practice.',
        'Crew automatically repair damage, fight fires, seal hull breaches and fight boarders, then go back to their stations. You can turn this off in the pause menu.',
        'Rooms with no air hurt crew. Keep the oxygen system powered and seal breaches. The medbay heals anyone standing in it.',
        'Species: Terran (learns fast), Rokkan (150 health, fireproof, slow), Zephi (repairs fast, fragile), Synth (needs no air), Kesh (strong fighter).',
      ],
    },
    {
      heading: 'Between fights',
      items: [
        'Scrap is money. Spend it at stores (fuel, missiles, drone parts, hull repair, weapons, drones, crew, systems) or on upgrades.',
        'Tap Ship on the map to upgrade systems and the reactor, change crew stations, and swap weapons with the cargo hold.',
        'Systems are repaired and crew healed after every fight. Hull is not: repair it at stores.',
        'Events: read and choose. Blue options need a certain crew member or system and are usually safer.',
      ],
    },
    {
      heading: 'Modes and ships',
      items: [
        'Normal: the full challenge. Cruise: more hull, scrap and fuel, gentler enemies, a slower fleet and cheaper stores.',
        'Enemy captains adapt to you: if you win easily they aim and time their shots better; if fights go badly they ease off. Their ships and weapons never change.',
        'Win once to unlock a second ship, the Corvid.',
        'Daily Run: the same galaxy for everyone today, flying the Wayfarer in Normal mode with enemy captains at a fixed level.',
      ],
    },
    { heading: 'Saving', text: 'Your run is saved after every action, even in the middle of a fight. Close the game any time and tap Continue.' },
    { heading: 'Art', text: 'Pixel art: MAS Space Roguelike by Aleksandr Makarov (iknowkingrabbit). Font: BoldPixels.' },
  ],
};

// How to Play for MegaBoy Run (the gold ? button).
export const RULES = {
  title: 'MegaBoy Run',
  sections: [
    { heading: 'Your mission', text: 'Doctor Null has rewired six worker robots and hidden in his fortress. Pick any of the six stages, beat its robot boss and take its weapon. When all six are down, the fortress opens: two more stages and Doctor Null himself.' },
    {
      heading: 'Controls',
      items: [
        'Hold your phone sideways. Left thumb: the d-pad. Push left or right to run, up or down on ladders.',
        'Right thumb: JUMP (big button) and SHOOT. Hold JUMP for a higher jump, tap it for a hop.',
        'Hold SHOOT for a moment and let go: a charged shot that hits three times as hard.',
        'WPN (above JUMP) switches to your next weapon. The pause menu (<) lets you pick one directly.',
        'You can run, jump and shoot at the same time with two thumbs.',
        'Keyboard: arrows or WASD to move, Z, K or Space to jump, X or J to shoot, Q or E to change weapon, Esc to pause.',
      ],
    },
    {
      heading: 'Health and pickups',
      items: [
        'Your health bar is top left. Enemies, their shots and spikes take a bite; afterwards you blink and nothing can hurt you for a moment.',
        'Falling into a bottomless pit costs a life. Lose every life and you can continue from the last checkpoint.',
        'Red capsules refill health, blue ones refill the weapon in your hand (or your emptiest one).',
        'A little MegaBoy head is an extra life. An E is an Energy Tank: you keep it, and using it from the pause menu refills your health.',
        'Every stage has a checkpoint flag halfway. Lose a life after it and you restart there.',
      ],
    },
    {
      heading: 'Bosses and weapons',
      items: [
        'Walk into the shutter at the end of a stage to face its boss. Watch for the flash or pose before each attack, then dodge.',
        'Beat a boss to take its weapon. Special weapons use energy (the second bar).',
        'Ember Bomb: a lobbed fire bomb that bursts. Ice Lance: a fast spear that pierces. Thorn Ring: leaves circle you and block shots, press again to throw them.',
        'Volt Fan: three sparks in a spread. Drill Seeker: a slow drill that homes in, and breaks cracked blocks. Gale Rang: a boomerang that comes back and grabs pickups.',
        'Every boss is weak to one other boss\'s weapon. A weak hit shows WEAK! and does four times the damage. Try your new weapon on the next boss.',
      ],
    },
    { heading: 'Saving', text: 'Beaten bosses, weapons, Energy Tanks and lives are saved when you leave a stage. Continue from the title screen to go back to stage select.' },
    { heading: 'Art', text: 'Hero, tiles and robots from the MAS MegaBoy, Robbox, Roguelike, Space Roguelike and Darkness packs by Aleksandr Makarov (iknowkingrabbit).' },
  ],
};

// How to Play text, shown by the gold "?" button on every screen.

export const RULES = {
  title: 'Pocket Pets',
  sections: [
    { heading: 'Goal', text: 'Collect pets, win the four badges from the Hall leaders, then beat Champion Aria at the top of the Summit. Catch as many kinds of pet as you can to fill your PetDex.' },
    {
      heading: 'Getting around',
      items: [
        'Use the arrow pad, or tap any spot on the map to walk there.',
        'Controller: d-pad or stick to walk, A to talk, read, open doors and move messages on, X for the Bag, Start for your Pets, Select for the PetDex. In menus and battles the d-pad moves a gold frame (or highlight), A picks and B goes back. The arrow pad hides while you use the controller.',
        'Tap a person, a sign or a door (or face it and press A) to talk, read or go inside.',
        'Wild pets hide in tall grass and on the gravel in caves.',
        'Tamers challenge you when you walk into their line of sight: they walk up to you (tap to hurry them).',
        'Pet Clinics (red roof) and your home heal every pet for free. If all your pets faint, you lose some coins and wake up at the last place you rested.',
        'Pet Shops (blue roof) sell Capsules and medicine. Better goods appear as you earn badges.',
      ],
    },
    {
      heading: 'The type wheel',
      items: [
        'Flame > Leaf > Stone > Spark > Tide > Flame.',
        'Each type hits the next one on the wheel twice as hard, and the one before it only half as hard.',
        'Flame burns Leaf, Leaf cracks Stone, Stone grounds Spark, Spark shocks Tide, Tide douses Flame.',
        'Plain pets have no strengths and no weaknesses.',
        'A pet using a move of its own type hits a quarter harder.',
      ],
    },
    {
      heading: 'Battles',
      items: [
        'Fight: pick one of up to four moves. Moves marked STRONG hit the foe twice as hard; weak ones only half.',
        'Each move has PP (uses). Rest at a clinic or use a PP Tonic to refill them.',
        'Pets: switch to another pet (this uses your turn). Bag: use a potion or throw a Capsule. Run: escape from wild pets.',
        'The faster pet moves first. Quick Jab always goes first.',
        'Every pet that fought gets the XP; the rest of the team gets half.',
      ],
    },
    {
      heading: 'Status',
      items: [
        'Burned: loses a little HP each turn and hits softer. Flame pets never burn.',
        'Poisoned: loses HP each turn. Leaf pets are never poisoned.',
        'Paralysed: slower, and sometimes can\'t move. Spark pets are never paralysed.',
        'Asleep: can\'t move for 1 to 3 turns.',
        'Status stays after battle. Cure Drops or a clinic fix it.',
      ],
    },
    {
      heading: 'Catching',
      items: [
        'Weaken a wild pet first: the lower its HP, the better your chances.',
        'Sleeping or paralysed pets are much easier to catch; burned or poisoned ones a little easier.',
        'Bigger, evolved pets are harder to catch. Super and Ultra Capsules help.',
        'You can carry 6 pets. Extra catches go to the Pet Box: swap them in at any clinic.',
        'You can give a new pet a nickname, or rename it later from its page in the Pets menu.',
      ],
    },
    {
      heading: 'Growing up',
      items: [
        'Pets learn new moves as they level up. With four moves already, you choose one to forget (or skip the new one).',
        'Many pets evolve into a bigger form at a certain level.',
        'Tap a pet in the Pets menu to see its stats and moves, or make it lead your team.',
      ],
    },
    { heading: 'After the Champion', text: 'Once you are Champion, every Hall leader (and Aria) will battle you again with a much stronger team. Keep training and fill your PetDex!' },
    { heading: 'Saving', text: 'Your journey saves itself as you play. Close the tab whenever you like and tap Continue.' },
    { heading: 'Credits', text: 'Pet, case and icon art: Pocket Pets by Aleksandr Makarov (iknowkingrabbit). Tamer sprites: RAS Overworld by Aleksandr Makarov. Font: BoldPixels by YukiPixels.' },
  ],
};

// How to Play text for Pocket Soccer, shown by the gold ? button.

export const RULES = {
  title: 'Pocket Soccer',
  sections: [
    { heading: 'Goal', text: 'Five-a-side football: score more goals than the other team before the final whistle. You play in blue and always attack up the screen.' },
    {
      heading: 'Controls',
      items: [
        'Left half of the screen: put your thumb down anywhere and drag to run. The stick appears where you touch.',
        'PASS: passes to the best teammate in the direction you are pushing (or facing).',
        'SHOOT: hold to build power (the bar above your player), let go to shoot. Push left or right while shooting to aim for a corner. Full power can fly over the bar from far out.',
        'Without the ball, PASS becomes TACKLE: a slide toward the ball. Mistime it and you are on the floor for a moment.',
        'Without the ball, SHOOT switches to the teammate nearest the ball.',
        'You always control the player marked with the gold arrow. It switches to the player nearest the ball by itself.',
        'Press PASS or SHOOT while a pass is coming to you to play it first time.',
        'Keyboard: arrows or WASD to run, X or J to pass/tackle, Space or K to shoot.',
      ],
    },
    {
      heading: 'Rules',
      items: [
        'Two halves. The clock shows 90 minutes but a match lasts a few real minutes (set Short, Normal or Long on the menu).',
        'Ball over a touchline: throw-in to the other team. Over a goal line: a corner if a defender touched it last, otherwise a goal kick.',
        'Restarts are quick: the taker plays it with PASS (to a teammate) or SHOOT (a cross from a corner, a long throw). Kick-offs: just start running.',
        'Keepers dive and catch. They can only use their hands in their own penalty box. Your keeper is run by the computer.',
        'No offside and no fouls: tackle as much as you like.',
      ],
    },
    {
      heading: 'Modes',
      items: [
        'Quick Match: pick any opponent. Harder teams have more stars.',
        'Cup: eight teams, knockout. Quarter-final, semi-final, final. A draw goes to a penalty shoot-out; lose once and the run is over. Your progress is saved between rounds.',
        'Endless: a slightly easier ladder of matches against gradually stronger teams. Your score is your wins in a row; a draw goes to penalties, a defeat ends the run.',
      ],
    },
    {
      heading: 'Penalties',
      items: [
        'Five kicks each, then sudden death.',
        'Shooting: the marker sweeps across the goal; tap SHOOT to strike where it is. Outside the posts is a miss.',
        'Saving: tap LEFT, STAY or RIGHT before the kick to choose which way your keeper dives.',
      ],
    },
    { heading: 'Art', text: 'Players, pitch and goals from the SportSeries Soccer pack by Aleksandr Makarov (iknowkingrabbit).' },
  ],
};

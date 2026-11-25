// How to Play text, shown by the gold "?" button on every screen.
export const RULES = {
  title: 'Mini Golf',
  sections: [
    {
      heading: 'Goal',
      text: 'Get the ball into the cup (the hole with the red flag) in as few putts as you can. Each hole has a par: the number of putts a good round takes.',
    },
    {
      heading: 'Putting',
      items: [
        'Put your finger on the ball and pull back, like a slingshot. The ball goes the other way.',
        'Pull further for a harder putt. The dotted line shows where the ball starts to roll, and the bar at the bottom shows the power.',
        'Let go to putt. Changed your mind? Slide your finger back onto the ball and let go there.',
        'A quick tap never putts, so you can\'t hit the ball by accident.',
      ],
    },
    {
      heading: 'Looking around',
      items: [
        'Drag anywhere away from the ball to look around the hole.',
        'Pinch with two fingers to zoom, or tap View to see the whole hole at once (on holes too big for the screen).',
        'After looking around, tap Ball to go back to your ball.',
      ],
    },
    {
      heading: 'On the course',
      items: [
        'Walls bounce the ball. Sand (and snow) slows it down a lot. Ice hardly slows it at all.',
        'Arrows on the grass are slopes: the ball rolls the way they point. Gold boost pads speed the ball up.',
        'Water and lava cost one extra stroke, and the ball goes back to where you hit it from.',
        'Red bumpers kick the ball away faster. Windmills, sliding blocks and gates move, so time your putt.',
        'Roll into a purple portal and the ball pops out of its twin. Hit an orange ramp fast to jump over a moat.',
        'If the ball ever gets stuck somewhere it shouldn\'t, it goes back to where you hit it from.',
      ],
    },
    {
      heading: 'Scoring',
      items: [
        'Par or better: 3 stars. One over par: 2 stars. Any finish: 1 star.',
        'After par + 5 putts the ball is picked up and you score par + 5.',
        'Birdie is one under par, eagle two under. Hole in one: in with the first putt!',
      ],
    },
    {
      heading: 'Courses',
      items: [
        'Three courses of nine holes: Meadow Greens, Frost Peak and Castle Keep. Hole every hole of a course to open the next one.',
        'Play a full round with a scorecard, or practise any open hole on its own.',
        'Your round is saved after every putt. Leave any time and continue from the menu.',
      ],
    },
    {
      heading: 'Pass and play',
      text: '2 to 4 players share one phone. Everyone plays each hole in turn, then the scorecard shows who is ahead. Lowest total wins.',
    },
    {
      heading: 'Daily hole',
      text: 'One hole a day, the same for everyone. Play it as often as you like: your best score of the day counts toward your daily streak.',
    },
    {
      heading: 'Credits',
      text: 'Trees and decorations: Tiny Tile Town by Aleksandr Makarov (iknowkingrabbit). Game by the KingRabbit Collection.',
    },
  ],
};

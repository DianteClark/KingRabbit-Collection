// How to Play text, shown by the gold "?" button on every screen.
export const RULES = {
  title: 'Robbox',
  sections: [
    {
      heading: 'Goal',
      text: 'Program the robot to light every lamp and put a crate on every red X pad. You don\'t steer it: you write the program first, then press Run and watch.',
    },
    {
      heading: 'Building a program',
      items: [
        'Tap a command at the bottom to add it to the end of the selected slot (MAIN, F1 or F2). Tap a slot\'s name to select it.',
        'Or drag a command straight into place. Drag a command in your program to move it.',
        'Tap a command in your program to remove it, or drag it away. Undo brings back your last change.',
        'Each slot only holds so many commands, so use functions to save room.',
      ],
    },
    {
      heading: 'Commands',
      items: [
        'Move: one tile forward, on the same level only.',
        'Turn left / Turn right: turn on the spot.',
        'Jump: hop forward up one level, or down any number of levels. On flat ground it hops in place.',
        'Action (lightning bolt): light or switch off the lamp you stand on. Otherwise pick up the crate in front of you, or put down the crate you carry on the tile in front.',
        'F1 / F2: run everything in that function, then carry on where you were.',
      ],
    },
    {
      heading: 'Running',
      items: [
        'Run plays the program. Pause stops it, Step runs one command at a time, Reset puts everything back. The glowing box shows the command being run.',
        'The speed button switches between 1x, 2x and 4x.',
        'The run stops if the robot falls off, bumps into something, runs out of commands, or loops too long. The message says what went wrong.',
      ],
    },
    {
      heading: 'The lab',
      items: [
        'Grey blocks are walls. Taller tiles are higher levels: use Jump to change level.',
        'Walking over a gear picks it up. A gear opens one red gate.',
        'Conveyor belts carry the robot to their end. Warp pads send it to their twin.',
        'From World 5 a function may call itself, which makes a loop. It runs until the job is done or the robot hits trouble.',
        'Colour checks (World 5): pick a brush and tap a command to paint it. A painted command only runs while the robot stands on a tile of that colour.',
      ],
    },
    {
      heading: 'Stars',
      items: [
        '3 stars: solve it with no more commands than the target (shown under the level name).',
        '2 stars: a few over. 1 star: any solution.',
        'Stuck? The Hint button has a tip, and can show an answer.',
        'Your programs and best scores are saved on this phone.',
      ],
    },
    {
      heading: 'Credits',
      text: 'Art: MAS Robbox by Aleksandr Makarov (iknowkingrabbit). Font: BoldPixels by YukiPixels.',
    },
  ],
};

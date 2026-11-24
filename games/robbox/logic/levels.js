// The 40 hand-made Robbox levels, in 5 worlds of 8. Each world adds one idea.
// Every level carries a known solution (sol); its length is the 3-star target. tests/robbox.test.mjs
// runs every solution, and proves the short ones can't be beaten.
//
//   ops:   commands in the palette ('F' move, 'L'/'R' turn, 'J' jump, 'A' action, '1'/'2' call F1/F2)
//   paint: colour brushes the level offers ('b' blue, 'o' orange)
//   slots: how many commands MAIN / F1 / F2 can hold (0 = slot not offered)
//   intro: shown the first time the level opens (new idea), hint: on the Hint button

import { programFrom, programLength } from './engine.js';

export const WORLDS = [
  { id: 1, name: 'Boot Up', blurb: 'Move, turn and light the lamps' },
  { id: 2, name: 'Functions', blurb: 'Pack repeats into F1 and F2' },
  { id: 3, name: 'Hop Lab', blurb: 'Jump up and down the levels' },
  { id: 4, name: 'Cargo Bay', blurb: 'Crates, gears, belts and warps' },
  { id: 5, name: 'Loop Core', blurb: 'Loops and colour checks' },
];

const W1 = { ops: 'FLRA', slots: { main: 12, f1: 0, f2: 0 } };

const DEFS = [
  // ------------------------------------------------------------------ World 1: Boot Up
  {
    id: '1-1', name: 'Hello Robbox', map: ['oooL'], start: [0, 0, 'E'], ops: 'FA', slots: { main: 8, f1: 0, f2: 0 },
    sol: { main: 'F F F A' },
    hint: 'Move three times to reach the lamp, then use Action to light it.',
  },
  {
    id: '1-2', name: 'Turn Right', map: ['ooo', '..o', '..L'], start: [0, 0, 'E'], ops: 'FRA', slots: { main: 8, f1: 0, f2: 0 },
    sol: { main: 'F F R F F A' },
    intro: 'New command: Turn Right. The robot turns on the spot to face a new way. It doesn\'t move.',
    hint: 'Walk to the corner, turn right, then walk down to the lamp.',
  },
  {
    id: '1-3', name: 'Turn Left', map: ['..L', '..o', 'ooo'], start: [0, 2, 'E'], ...W1,
    sol: { main: 'F F L F F A' },
    intro: 'Turn Left joins the team. Watch which way the robot\'s face points.',
    hint: 'Same as before, but this time the corner turns left.',
  },
  {
    id: '1-4', name: 'Two Lamps', map: ['oLo.', '..o.', '..oL'], start: [0, 0, 'E'], ...W1,
    sol: { main: 'F A F R F F L F A' },
    hint: 'Light the first lamp on the way past: Move, Action, then keep going.',
  },
  {
    id: '1-5', name: 'Detour', map: ['o#oL', 'ooo.'], start: [0, 0, 'E'], ...W1,
    sol: { main: 'R F L F F L F R F A' },
    intro: 'Grey blocks are walls. Walk into one and the robot bumps and stops.',
    hint: 'Go down a row to get round the wall, then come back up.',
  },
  {
    id: '1-6', name: 'U-Turn', map: ['oooo', '...o', 'Looo'], start: [0, 0, 'E'], ...W1,
    sol: { main: 'F F F R F F R F F F A' },
    hint: 'Two right turns send the robot back the way it came, one row lower.',
  },
  {
    id: '1-7', name: 'Lamp Row', map: ['LoLoL'], start: [0, 0, 'E'], ...W1,
    sol: { main: 'A F F A F F A' },
    hint: 'The robot starts on a lamp. Light it first!',
  },
  {
    id: '1-8', name: 'Four Corners', map: ['LoL', 'o.o', 'LoL'], start: [0, 0, 'E'], ...W1,
    sol: { main: 'A F F A R F F A R F F A' },
    hint: 'Light, walk two, turn right. Do that round the square. MAIN only just fits it!',
  },

  // ------------------------------------------------------------------ World 2: Functions
  {
    id: '2-1', name: 'Repeat Me', map: ['ooLoLoLoL'], start: [0, 0, 'E'], ops: 'FLRA1', slots: { main: 4, f1: 4, f2: 0 },
    sol: { main: '1 1 1 1', f1: 'F F A' },
    intro: 'Functions! F1 is a mini program. Fill it, then put the F1 command in MAIN: each one runs all of F1. Tap a slot\'s name to pick where new commands go.',
    hint: 'Every lamp is two steps further on. Put Move, Move, Action in F1 and call it four times.',
  },
  {
    id: '2-2', name: 'Box Round', map: ['LooL', 'o..o', 'o..o', 'LooL'], start: [0, 0, 'E'], ops: 'FLRA1', slots: { main: 4, f1: 6, f2: 0 },
    sol: { main: '1 1 1 1', f1: 'A F F F R' },
    hint: 'Each side is the same: light, walk three, turn right.',
  },
  {
    id: '2-3', name: 'Zig Zag', map: ['oL...', '.oL..', '..oL.', '...oL'], start: [0, 0, 'E'], ops: 'FLRA1', slots: { main: 4, f1: 6, f2: 0 },
    sol: { main: '1 1 1 1', f1: 'F A R F L' },
    hint: 'One stair is: step on, light, turn right, step down, turn back left.',
  },
  {
    id: '2-4', name: 'Comb', map: ['ooooooo', 'L.L.L.L'], start: [0, 0, 'S'], ops: 'FLRA12', slots: { main: 5, f1: 6, f2: 6 },
    sol: { main: '1 1 1 2', f1: '2 R F F R', f2: 'F A L L F' },
    intro: 'Now there\'s F2 too, and a function can call the other one.',
    hint: 'Make F2 visit one tooth and come back (Move, Action, turn around, Move). F1 can call F2 and then walk to the next tooth.',
  },
  {
    id: '2-5', name: 'Snake', map: ['oooL', 'Looo', 'oooL'], start: [0, 0, 'E'], ops: 'FLRA1', slots: { main: 9, f1: 6, f2: 0 },
    sol: { main: '1 R F R 1 L F L 1', f1: 'F F F A' },
    hint: 'Every row is "walk three, light". Only the turns between rows change.',
  },
  {
    id: '2-6', name: 'Ring of Light', map: ['LLLL', 'L..L', 'L..L', 'LLLL'], start: [0, 0, 'E'], ops: 'FLRA12', slots: { main: 4, f1: 4, f2: 3 },
    sol: { main: '1 1 1 1', f1: '2 2 2 R', f2: 'A F' },
    hint: 'F2 can be just Action, Move. One side of the ring is F2 three times and a turn.',
  },
  {
    id: '2-7', name: 'Crossroads', map: ['..L..', '..o..', 'LoooL', '..o..', '..L..'], start: [2, 2, 'N'], ops: 'FLRA12', slots: { main: 4, f1: 6, f2: 3 },
    sol: { main: '1 1 1 1', f1: '2 A L L 2 L', f2: 'F F' },
    hint: 'Out to the end, light, turn around, back to the middle, then turn to face the next arm.',
  },
  {
    id: '2-8', name: 'Windmill', map: ['..L..', '..L..', 'LLLLL', '..L..', '..L..'], start: [2, 2, 'N'], ops: 'FLRA12', slots: { main: 5, f1: 6, f2: 4 },
    sol: { main: 'A 1 1 1 1', f1: '2 L L F F L', f2: 'F A F A' },
    hint: 'The middle lamp needs lighting once. Each arm is two lamps in a row.',
  },

  // ------------------------------------------------------------------ World 3: Hop Lab
  {
    id: '3-1', name: 'First Hop', map: ['oooL'], height: ['0012'], start: [0, 0, 'E'], ops: 'FJA', slots: { main: 8, f1: 0, f2: 0 },
    sol: { main: 'F J J A' },
    intro: 'Taller tiles are higher levels. Move only walks on the same level. Jump hops up one level (or down any number).',
    hint: 'Move once, then jump up each step.',
  },
  {
    id: '3-2', name: 'Up and Down', map: ['ooLoL'], height: ['01201'], start: [0, 0, 'E'], ops: 'FLRJA', slots: { main: 8, f1: 0, f2: 0 },
    sol: { main: 'J J A J J A' },
    hint: 'Jump can drop down a big ledge in one go.',
  },
  {
    id: '3-3', name: 'Stairs', map: ['ooLoLoL'], height: ['0011223'], start: [0, 0, 'E'], ops: 'FLRJA1', slots: { main: 4, f1: 4, f2: 0 },
    sol: { main: '1 1 1', f1: 'F J A' },
    hint: 'Each stair is a walk, a jump and a lamp.',
  },
  {
    id: '3-4', name: 'Mountain Path', map: ['ooo', '..L', 'Loo'], height: ['012', '..3', '212'], start: [0, 0, 'E'], ops: 'FLRJA1', slots: { main: 12, f1: 6, f2: 0 },
    sol: { main: '1 1 1', f1: 'J A J R A' },
    hint: 'Every step here is a Jump. Action does nothing where there is no lamp, so a pattern can light lamps it only sometimes meets.',
  },
  {
    id: '3-5', name: 'Ledges', map: ['LoL', 'o.o', 'LoL'], height: ['101', '0.0', '101'], start: [0, 0, 'E'], ops: 'FLRJA1', slots: { main: 4, f1: 5, f2: 0 },
    sol: { main: '1 1 1 1', f1: 'A J J R' },
    hint: 'Down and up again: two jumps per side.',
  },
  {
    id: '3-6', name: 'Terraces', map: ['oL..', '.oL.', '..oL'], height: ['01..', '.12.', '..23'], start: [0, 0, 'E'], ops: 'FLRJA1', slots: { main: 4, f1: 6, f2: 0 },
    sol: { main: '1 1 1', f1: 'J A R F L' },
    hint: 'Like Zig Zag, but each lamp is one level up.',
  },
  {
    id: '3-7', name: 'Twin Peaks', map: ['oooLoooL'], height: ['01230123'], start: [0, 0, 'E'], ops: 'FLRJA1', slots: { main: 4, f1: 5, f2: 0 },
    sol: { main: '1 J 1', f1: 'J J J A' },
    hint: 'Climb a peak with F1, jump off the top, then climb the next one.',
  },
  {
    id: '3-8', name: 'Ziggurat', map: ['ooooo', 'oLoLo', 'ooLoo', 'oLoLo', 'ooooo'],
    height: ['00000', '01110', '01210', '01110', '00000'], start: [0, 0, 'E'], ops: 'FLRJA12', slots: { main: 12, f1: 6, f2: 6 },
    sol: { main: 'F R J L 1 1 1 A F R J A', f1: 'A F F R' },
    hint: 'Climb onto the middle ring and go round it lighting the corners. The top lamp is last.',
  },

  // ------------------------------------------------------------------ World 4: Cargo Bay
  {
    id: '4-1', name: 'Pick Up', map: ['oCoX'], start: [0, 0, 'E'], ops: 'FLRA', slots: { main: 8, f1: 0, f2: 0 },
    sol: { main: 'A F F A' },
    intro: 'Crates! Face a crate and use Action to pick it up. Face an empty tile and use Action again to put it down. Every red X pad needs a crate.',
    hint: 'Pick up the crate in front, walk two, then drop it on the pad ahead.',
  },
  {
    id: '4-2', name: 'Delivery Route', map: ['oCo', '..o', '..X'], start: [0, 0, 'E'], ops: 'FLRA', slots: { main: 8, f1: 0, f2: 0 },
    sol: { main: 'A F F R F A' },
    hint: 'You drop the crate on the tile in front, so stop one tile before the pad.',
  },
  {
    id: '4-3', name: 'Both Ways', map: ['XoCoCoX'], start: [3, 0, 'W'], ops: 'FLRA1', slots: { main: 6, f1: 4, f2: 0 },
    sol: { main: 'A 1 L L 1 1', f1: 'F F A' },
    hint: 'Walk two and use Action: that picks up a crate or puts one down, depending on what you carry.',
  },
  {
    id: '4-4', name: 'Gear and Gate', map: ['oKo', '..D', '..L'], start: [0, 0, 'E'], ops: 'FLRA', slots: { main: 8, f1: 0, f2: 0 },
    sol: { main: 'F F R F F A' },
    intro: 'Red gates are locked. Walk over a gear to pick it up: it opens one gate.',
    hint: 'Walking over the gear collects it. Then walk into the gate.',
  },
  {
    id: '4-5', name: 'Moving Floor', map: ['o>>>o', '#...o', 'L<<<o'], start: [0, 0, 'E'], ops: 'FLRA', slots: { main: 8, f1: 0, f2: 0 },
    sol: { main: 'F R F F R F A' },
    intro: 'Conveyor belts carry the robot along until it reaches the end. One Move is enough to ride the whole belt.',
    hint: 'Step onto each belt once and let it do the walking.',
  },
  {
    id: '4-6', name: 'Warp Pads', map: ['oCA.AoX'], start: [0, 0, 'E'], ops: 'FLRA', slots: { main: 8, f1: 0, f2: 0 },
    sol: { main: 'A F F F A' },
    intro: 'Step onto a warp pad and the robot pops out of its twin, still facing the same way.',
    hint: 'Take the crate with you through the warp.',
  },
  {
    id: '4-7', name: 'Locked Lab', map: ['o>>>K', '#LDoo'], start: [0, 0, 'E'], ops: 'FLRA', slots: { main: 8, f1: 0, f2: 0 },
    sol: { main: 'F R F R F F F A' },
    hint: 'The belt takes you straight to the gear.',
  },
  {
    id: '4-8', name: 'Shuttle', map: ['CoX', 'CoX', 'CoX'], start: [1, 0, 'W'], ops: 'FLRA1', slots: { main: 4, f1: 7, f2: 0 },
    sol: { main: '1 1 1', f1: 'A L L A R F R' },
    hint: 'You don\'t have to walk with a crate: pick it up, turn around and drop it.',
  },

  // ------------------------------------------------------------------ World 5: Loop Core
  {
    id: '5-1', name: 'Forever', map: ['oLLLLLLLL'], start: [0, 0, 'E'], ops: 'FLRA1', slots: { main: 2, f1: 3, f2: 0 },
    sol: { main: '1', f1: 'F A 1' },
    intro: 'Loops: a function can call itself! Put F1 at the end of F1 and it repeats until the job is done (or the robot hits trouble).',
    hint: 'F1 = Move, Action, F1. Then MAIN just calls F1.',
  },
  {
    id: '5-2', name: 'Loop Around', map: ['LLLLL', 'L...L', 'L...L', 'L...L', 'LLLLL'], start: [0, 0, 'E'], ops: 'FLRA12', slots: { main: 2, f1: 6, f2: 2 },
    sol: { main: '1', f1: '2 2 2 2 R 1', f2: 'A F' },
    hint: 'One side of the ring and a turn, then loop.',
  },
  {
    id: '5-3', name: 'Blue Means Turn', map: ['oLLLo', 'L...L', 'L...L', 'oLLLo'], paint: ['....b', '.....', '.....', 'b...b'],
    start: [0, 0, 'E'], ops: 'FLRA1', brushes: 'b', slots: { main: 2, f1: 5, f2: 0 },
    sol: { main: '1', f1: 'F b:R A 1' },
    intro: 'Colour checks! Pick the blue brush, then tap a command in your program to paint it. A blue command only runs while the robot stands on a blue tile. Otherwise it is skipped.',
    hint: 'F1 = Move, blue Turn Right, Action, F1.',
  },
  {
    id: '5-4', name: 'Two Colours', map: ['oLo...', '..L...', '..oLo.', '....L.', '....oL'], paint: ['..b...', '......', '..o.b.', '......', '....o.'],
    start: [0, 0, 'E'], ops: 'FLRA1', brushes: 'bo', slots: { main: 2, f1: 5, f2: 0 },
    sol: { main: '1', f1: 'F b:R o:L A 1' },
    intro: 'Orange commands only run on orange tiles. Tap a painted command with the same brush to clear its colour.',
    hint: 'Blue tiles turn right, orange tiles turn left.',
  },
  {
    id: '5-5', name: 'Warp Loop', map: ['oLLLA', 'ALLLL'], start: [0, 0, 'E'], ops: 'FLRA1', slots: { main: 2, f1: 3, f2: 0 },
    sol: { main: '1', f1: 'F A 1' },
    hint: 'Warps don\'t stop a loop. Keep going!',
  },
  {
    id: '5-6', name: 'Comb Loop', map: ['ooooooo', 'L.L.L.L'], start: [0, 0, 'E'], ops: 'FLRA12', slots: { main: 2, f1: 6, f2: 5 },
    sol: { main: '1', f1: 'R 2 R F F 1', f2: 'F A L L F' },
    hint: 'F2 visits one tooth. F1 turns to it, calls F2, walks on and loops.',
  },
  {
    id: '5-7', name: 'Paint Jump', map: ['ooooLoooL'], height: ['001222333'], paint: ['obbooboo.'], start: [0, 0, 'E'], ops: 'FLRJA1', brushes: 'bo',
    slots: { main: 2, f1: 4, f2: 0 },
    sol: { main: '1', f1: 'b:J o:F A 1' },
    hint: 'Blue tiles sit just before a step up. Jump from blue, walk from orange.',
  },
  {
    id: '5-8', name: 'Grand Spiral', map: ['oLLLLo', 'oKDLoL', 'L...LL', 'LLLLoL', 'oLLLLo'],
    paint: ['.....b', 'b...b.', '......', '....b.', 'b....b'], start: [0, 0, 'E'], ops: 'FLRA12', brushes: 'bo', slots: { main: 3, f1: 5, f2: 5 },
    sol: { main: '1', f1: 'F b:R A 1' },
    hint: 'Spiral inwards: turn right on every blue corner. The gear opens the gate on the way.',
  },
];

/** Final level list: definitions plus the parsed solution and its target length. */
export const LEVELS = DEFS.map((d, i) => {
  const sol = programFrom(d.sol);
  return {
    ...d,
    index: i,
    world: Number(d.id.split('-')[0]),
    brushes: d.brushes || '',
    loops: Number(d.id.split('-')[0]) >= 5, // a function may call itself only from World 5 on
    solution: sol,
    target: programLength(sol),
  };
});

export const levelById = (id) => LEVELS.find((l) => l.id === id);

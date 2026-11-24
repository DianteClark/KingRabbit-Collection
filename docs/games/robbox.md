# Robbox

**Status:** Playable (v1.0): 40 levels in 5 worlds, stars and records, hints with answers, first-time coaching
**Art:** MAS Robbox v1.2 by Aleksandr Makarov (`shared/assets/mas-mini-retro/MASRobbox-v.1.2/`, 16x16 set)
**Rules text:** `games/robbox/rules.js` (shown by the gold ? button on every screen)

A robot-programming puzzle in the spirit of Lightbot, in portrait. You don't steer the robot: you build a
program from command tiles, press Run and watch it play out. Light every lamp and deliver every crate to win.

## Screens

| Scene | What it does |
|---|---|
| Menu | Lab diorama, Start / Continue (first unsolved level), Levels, solved and star totals, sound, All Games |
| Levels | World tabs W1-W5 (locked worlds show a padlock), 8 cards per world with stars, best and target |
| Play | Grid on top, program slots (MAIN / F1 / F2), palette, Step / Run / Reset / speed, Hint / Undo / Clear |

Play layout (360x640): header with level name and the 3-star target; the grid fills whatever room the slots
leave (tiles drawn at 3x, 2x or 1.5x, whichever fits); the status line (lamps, crates, gears, commands used and
best); program slots anchored just above the palette so they never move between levels of a world.

## Building programs

- Tap a palette command to append it to the selected slot (gold tab). Tap a slot tab or its empty space to select it.
- Drag a palette command into a slot to insert it at a spot (a gold bar shows where). Drag a program command to move
  it, or off the program to delete it. The dragged tile floats above the finger so it stays visible.
- Tap a program command to remove it. Undo (60 steps) brings back any edit; Clear empties the selected slot.
- Colour brushes (World 5): tap a brush, then tap program commands to paint / unpaint them; palette commands added
  while a brush is on come painted.
- Slots have per-level capacities (MAIN up to 14 in two rows of 7, F1/F2 up to 7), so functions are needed.
- Loops (a function reaching itself, directly or F1 -> F2 -> F1) are refused with a toast before World 5.
- Programs are saved per level on every edit, so leaving and coming back keeps your work.

## Rules (`logic/engine.js`)

- **Move**: one tile forward on the same level. Up a ledge = "Bumped a ledge", down = "Move can't go down a ledge".
- **Turn left / right**: on the spot.
- **Jump**: forward one level up or any number down; on flat ground it hops in place; 2+ up = "Too high".
- **Action**: on a lamp, toggle it. Otherwise pick up the crate in front, or put the carried crate on the free
  floor / pad in front (within one level). Nothing to do = harmless "?".
- **F1 / F2**: call. A call that is the last command of its function is a tail call, so loops run forever without
  growing the stack. Non-tail recursion stops at 64 deep ("Too many calls inside calls"), any run at 500 steps.
- **Painted commands** only run while the robot stands on a tile of that colour (otherwise skipped, still a step).
- **Tiles**: floor, void (fall off), wall (hazard-striped block), lamp, red X pad, crate, gear (picked up by walking
  over it), gate (a gear opens it, consumed), conveyors (carry the robot to their end; stop at walls, drop off edges,
  rings of belts stop), warp pads in pairs (keep facing). Heights 0-3.
- **Win** the moment every lamp is lit and every pad has a crate (and none is carried). **Fail** reasons: fell off,
  bumped a wall / crate / ledge, too high, gate locked, out of moves (program ended), too many steps, too deep.
- **Stars**: 3 at or under the target length (total commands in all slots), 2 within max(2, 30%) over, 1 otherwise.

## Levels (`logic/levels.js`)

| World | Name | Teaches |
|---|---|---|
| 1 | Boot Up | Move, Action, Turn Right, Turn Left, walls, U-turns, MAIN-only (targets proven shortest by BFS) |
| 2 | Functions | F1 repeats, F2, a function calling the other, small MAIN slots |
| 3 | Hop Lab | Jump up and down, stairs, height patterns with F1 |
| 4 | Cargo Bay | Crates and pads, gears and gates, conveyors, warp pads |
| 5 | Loop Core | Self-calling loops, blue and orange colour checks, loops through warps, a grand spiral |

Each level has a known solution whose length is the 3-star target, a hint, and (when it adds an idea) an intro
card shown the first time. The Hint button can load the solution after a confirm, so nobody gets stuck.
Levels unlock in order. First-time coaching (gold banner + bouncing arrow) walks through 1-1 step by step, how to
fill F1 in 2-1, and the paint brush in 5-3.

## Tests (`tests/robbox.test.mjs`)

- Interpreter: moves, turns, falls, bumps, heights, jumps, crates, gears and gates, conveyors (edges, walls,
  loops), warps, calls, tail-call loops, step and depth limits, colour checks, loop detection, step reporting.
- Every level parses, fits the screen and slot layout, starts on floor, has a goal and a hint.
- Every known solution wins, fits its slots, uses only offered commands and colours, and has no loop before World 5.
- `logic/solver.js`: BFS proves the target is the shortest possible program on every MAIN-only level; exhaustive
  program search (all slot splits, calls and colours) proves no shorter program exists for 15 more levels (targets
  up to 9), and that World 5 loop levels can't be solved without a loop.

## Not done / ideas

- A sandbox level editor (stretch goal) is not included.
- Targets on the longest function levels (2-4, 2-5, 2-7, 2-8, 3-8, 5-6: 12-16 commands) are good solutions but not
  proven shortest; a shorter find simply earns 3 stars.

# MegaBoy Run

**Status:** Playable (v1.0, landscape): 6 robot stages, 2 fortress stages, 8 bosses, weapons, E-tanks, saves, intro, ending, music, onboarding
**Game id:** `megaboy` (`games/megaboy/`)
**Art:** MAS MegaBoy (hero, tiles, pickups), MAS Robbox (walker and guard robots), MAS Roguelike and MAS Space Roguelike (small enemies), MAS Darkness Pack (two creatures recoloured as fortress machines), all by Aleksandr Makarov (`shared/assets/mas-mini-retro/`)
**Rules text:** `games/megaboy/rules.js` (gold ? button)

An original side-scrolling action platformer in the classic robot-boss mould. Doctor Null rewired six worker robots; pick their stages in any order, beat each boss and take its weapon, then storm a two-stage fortress. A full run is roughly 40-60 minutes.

## Screen and controls
- `startGame({ orientation: 'landscape' })`, 640x360. The world uses 8 px tiles (the hero is ~14 px tall) drawn at 3x, so the screen shows 26.7 x 15 tiles. Every stage is exactly 15 rows tall (one screen); the camera scrolls sideways only.
- Stage maps are drawn with the floor at row 12 and lifted two rows (`lift()` in `logic/stages.js`), so the floor sits at screen y 240. Everything standing on the floor is above the touch buttons, which sit over the floor in the bottom corners.
- Left thumb: a d-pad cross; any touch in the lower-left zone steers by its angle from the centre (dead spot, diagonals for ladders). Right thumb: JUMP (big) and SHOOT; a thumb sliding between them moves the press. WPN (bottom middle) cycles weapons. Multi-touch: each pointer is tracked by id.
- Top-left: pause `<`, health bar, weapon energy bar, lives and E-tanks. Top-right: `?` and the boss bar.
- All positions live in `layout.js` (tested: on screen, at least 40 px, no hit-area overlaps, below the floor line). Text is 16/32 px only.
- Keyboard: arrows/WASD, Z/K/Space jump, X/J shoot, Q/E weapon, Esc/P pause.
- Leaving the app opens the pause menu, so you come back paused.

## Movement (logic/player.js)
Run 46 px/s, jump 175 px/s with gravity 560 (peak 27 px = 3.4 tiles, ~29 px of flat distance), release early for a short hop, 0.08 s coyote time and a 0.12 s jump buffer for touch. Ladders are two tiles wide; up to climb, down on a ladder top to go down, jump to let go. Conveyors push 24 px/s. Spikes are solid and take 8 health (not instant death); bottomless pits cost a life. Hits knock you back and give 1.3 s of blinking.

## Stages
| Stage | Boss | Theme | What's new |
|---|---|---|---|
| Foundry | Ember | orange | conveyors, spike pits, hard hats, turret ledges, ladder to an E-tank |
| Cryo Lab | Glacia | blue | appearing blocks over pits, bats, platforms over a spike floor |
| Jungle | Thorn | green (sky) | horizontal and vertical moving platforms, vine ladders over thorns |
| Power Plant | Volt | dark | two-phase appearing blocks over spikes, opposing conveyors, flyers |
| Deep Mine | Drill | red | cracked blocks hiding an extra life and an E-tank, two lifts over spikes |
| Sky Port | Gale | grey (sky) | three moving platforms, floating thin platforms, guards |
| Fortress Gate | Gatekeeper | fortress | everything mixed; boss is a shuttered eye that drops rocks |
| Fortress Core | Null Engine | fortress | movers over spikes, ladders; flying final boss with two phases |

Each stage is seven 30-column screens with a mid-stage checkpoint flag, then a shutter door and a 27-column arena. First-time tips are placed automatically where each hazard first appears (`addHints`).

## Weapons and the weakness loop
Buster: up to 3 pellets; hold to charge (0.45 s medium, 1.1 s full, 3x damage, pierces). Special weapons use 28-point energy bars:
Ember Bomb (lob, bursts), Ice Lance (fast, pierces), Thorn Ring (orbiting leaves eat bullets, press again to throw), Volt Fan (3-way spread), Drill Seeker (homing, breaks cracked blocks), Gale Rang (boomerang, grabs pickups).
Weakness cycle (4 damage, "WEAK!"): Ember weapon beats Thorn, Thorn's beats Drill, Drill's beats Volt, Volt's beats Gale, Gale's beats Glacia, Glacia's beats Ember. Gatekeeper is weak to Gale Rang, the Null Engine to Volt Fan. A boss is immune to its own weapon. Discovered weaknesses show on the stage select cards.

## Bosses (logic/bosses.js)
All have 28 HP (never changes) and a tell before each move (yellow flash, pose, or a floor marker): Ember jumps at you and lobs three bombs that leave flames; Glacia fires low/high lances and skates wall to wall; Thorn raises a leaf shield, hops, throws the leaves; Volt fires a 3-spark fan and calls lightning on a marked spot; Drill burrows and erupts under a dust marker, fires homing drills; Gale throws boomerangs and blows wind. Gatekeeper opens its eye to shoot (only hittable then); Null Engine sweeps and fires spreads, dives low, and speeds up at half health.

## Adaptive difficulty (adaptive.js + logic/tune.js)
One skill number 0..1 blended between easy/normal/hard presets: enemy fire intervals (x1.45 to x0.75), chase speed (x0.78 to x1.22), drop chance (x1.6 to x0.7) and boss rests (x1.3 to x0.82). Losing a life -0.05, game over -0.06, clean clear +0.06, beating a boss nudges by health left. Layouts, damage and boss HP never change. The pause menu and How to Play show the current pace.

## Saving (save.js, logic/progress.js)
`kingrabbit:megaboy`: progress (beaten bosses, weapons, E-tanks, found E-tank ids, lives, fortress step, weaknesses seen, time), skill, tips seen, music. Progress is written on stage clear, game over, quitting from the pause menu, and whenever an E-tank is picked up or the app is hidden. Play resumes at stage select. Game over continues from the last checkpoint with 3 lives.

## Tests
- `tests/megaboy.test.mjs`: jump arc, pits, ladders, conveyors, spikes, movers and appearing blocks; stage well-formedness; door/boss/checkpoint/game-over flow; E-tanks; every weapon's behaviour; shields; adaptive presets; the single weakness cycle; progression and save repair; touch layout and d-pad.
- `tests/megaboy-proof.test.mjs`: `logic/reach.js` replays the real player physics (walks, jumps of several heights and timings, running jumps at edges, ladders, waiting for movers and appearing blocks) to prove every stage's boss door is reachable from the start and from every checkpoint, and every pickup is reachable; a sanity check proves it rejects over-wide gaps and walls. `logic/bot.js` (a short look-ahead planner on the real simulation) beats every boss with the buster alone at the default pace, with two E-tanks at the hardest pace, and with the weakness weapon at any pace (faster than the buster).

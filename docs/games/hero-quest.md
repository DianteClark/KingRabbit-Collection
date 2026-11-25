# Hollow Crown

**Status:** Playable (v2.0, landscape, wide rooms): overworld, 3 dungeons, bosses, shop, saves (with migration), trophies, ending, music, onboarding
**Game id:** `hero-quest` (`games/hero-quest/`)
**Art:** LAS Adventure Pack 1.0 and LAS Alchemist Lab 1.02 by Aleksandr Makarov (`shared/assets/las-zelda-adventure/`)
**Rules text:** `games/hero-quest/rules.js` (gold ? button)

A short top-down sword-and-dungeon adventure for a phone held in one hand. The Gremlin King stole the Hollow Crown; you get a sword from Elder Bram, clear the Mossy Hollow (boomerang), the Ember Lab (bombs) and Hollow Keep, and carry the Crown home. A full run is roughly 30-45 minutes.

## Screen and controls (wide rooms since v2.0)
- `startGame({ orientation: 'landscape' })`: 640x360 logical canvas; held upright the shared overlay asks you to turn the phone.
- Rooms are wide, 17 x 11 tiles of 16 px (like a classic screen), drawn at a crisp 2x: 544 x 352 on screen, centred, the whole room visible (no vertical camera follow any more). That is about 50 % more room on screen than v1's 11 x 13 room, and fills 85 % of the width.
- Slim 48 px side margins. Left: pause `<`, hearts (two columns), gems, dungeon keys. Right: `?`.
- Touch controls reach just over the room's outer wall/tree column and never over the part you play in (tested): the floating stick (thumb down anywhere on the left half), and stacked on the right SWAP, ITEM and a big SWORD (TALK / READ / OPEN next to people, signs and chests). Buttons are drawn slightly see-through.
- Dialogs sit inside the room at its bottom, or its top when the bottom box would cover you; toasts at its bottom edge; the area name at its top.
- Pause and shop are two-column panels; title and ending use left/right columns.
- All positions live in `layout.js` (plain numbers, tested). Text is 16/32 px only.
- A tap that advances or closes a dialog never also fires a HUD button (pause, help) on release. Touch hit areas (`layout.js` `hitSword/hitItem/hitSwap`) are slightly larger than drawn and never overlap.
- Shop prices you can't afford grey out and say how many more gems you need.
- The shield is always up: rocks coming at the way you face bounce off unless you're mid-swing.
- Keyboard: arrows/WASD, Space/J sword, K/X item, Q swap, Esc pause.

## World
| Area | Rooms | What's there |
|---|---|---|
| Fernwick Vale (overworld, 17 x 11 rooms) | 3x3 | Village (elder, shop, villagers with hints), fields, Mosswood, Northwood, Ember River, Lake Sorrel, Grey Peaks |
| Interiors | 3 | Elder's house (start), Odo's shop, hidden cave by the lake (heart container, needs bombs) |
| Mossy Hollow | 7 | Key from a cleared room, push-block switch opens a shutter, boomerang, crystal across water lowers a bridge to the Boss Key. Boss: Slime King |
| Ember Lab | 7 | Two-block switch puzzle, clear-shutter room with the bombs, bombable wall, island chest via crystal, Stone Brute mini-boss. Boss: Golem King |
| Hollow Keep | 7 | Three-block puzzle (13 pushes, with a trick: the left switch can only be reached through a gap in a pillar line), bomb wall, crystal bridge, twin golem mini-boss, optional bomb pocket. Boss: Hollow King |

Progression gates: the boomerang lowers the Ember River bridge (crystal on the far bank); bombs break the rock sealing Hollow Keep and the lake cave.

## First minutes (v1.1)
- A new game opens with Elder Bram already talking (after the How to Play sheet the very first time); his speech gives the sword and says where to go.
- Right after the sword, two gold tags point at the stick ("Drag here to walk") and the SWORD button ("Tap to swing"), once.
- A "Next: ..." toast appears whenever the goal changes (`objective()` in `logic/story.js`); the pause menu repeats it above a 3x3 area map with dungeon entrances numbered 1-3.
- Fernwick's north exit sits at the end of a visible path, and a path runs through Mosswood to the Mossy Hollow.

## Music and jingles
`music.js`: a tiny Web Audio sequencer with four original loops (village, field, dungeon, boss), quiet (gain 0.045) and silent under the shared mute; "Music on/off" in the pause menu (saved). Local jingles: `unlock` (keys and boss doors), `door` (shutters opening), `secret` (switch/crystal/bomb reveals), `fanfare` (new items); they duck the music. Other sounds use the shared `sfx`.

## Rules
- Hearts are half-heart HP (start 3 hearts). Contact and rocks hurt half a heart; golems, the Golem King and the Hollow King a whole heart. 1 s of blinking invulnerability and a knockback after each hit.
- Drops (bushes, pots, enemies): gems, 5-gems, hearts (more likely when you're low), bombs (much more likely when you have none).
- Potions (max 3) refill all hearts; one is drunk automatically when you'd fall.
- Shop: potion 30, 5 bombs 20 (needs the bag), Heart Charm 100 (once).
- Falling: back to the last entrance you used (dungeon door or overworld doorway), full hearts, everything kept. Enemies respawn when you re-enter a room; in a dungeon, rooms you cleared stay clear until you leave it.
- Small keys belong to their dungeon. Locked doors and bomb walls on a room edge are shared by both rooms. Switches, crystals and opened doors stay done for good; blocks reset when you leave the room, so a stuck block can't soft-lock you.
- Boss rooms seal until the boss falls; then a Heart Container, then a warp orb (or the Crown) appears.
- Tells: a yellow "!" over anything in a wind-up (blue slime lunge, gremlin throw, golem charge, boss charge/volley). The Slime King squats before each jump, arcs through the air, and only hurts on the way down; while it rests it just shoves you. The Hollow King blinks away when his stun ends instead of drifting into you. The Golem King winds up for 0.8 s.
- Pause > Reset blocks (push-block rooms only) puts the blocks and you back at the doorway you came in; latched switches stay done.
- Bosses: the Slime King (10 HP, half-heart landings) sheds slimes every 3 damage; the Golem King's armour shrugs off the sword unless it's dazed (by a bomb, or by charging into a wall) and the room keeps supplying bombs; the Hollow King's shield only drops to a boomerang hit, he throws rock volleys, teleports, and calls two blue slimes at half health.

## Enemies
Green slime (hops at random), blue slime (lunges when you line up), red slime (follows you, splits in two), gremlin (keeps its distance, throws rocks), golem (charges when lined up, dazed after hitting a wall, double damage while dazed). The boomerang stuns most enemies.

## Trophies
`trophies.js` registers 13 trophies with `shared/core/trophies.js` (5 bronze, 4 silver, 4 gold; 2 secret) and calls `recordPlay` once per launch. Earned at the moment they happen: the sword, each of the first two bosses, a switch puzzle solved, the Heart Charm bought, the lake cave found (secret), a boss beaten without a hit, every chest opened, the Crown brought home, home without falling once, home in under 30 minutes (secret), 10 rocks blocked and 100 slimes beaten (lifetime). Lifetime counters (`bumpStat`): enemies, slimes, rocks blocked, gems. `awardsFor()` is plain logic and tested.

## Adaptive difficulty
`adaptive.js` keeps one skill number (0-1, start 0.35). A fall: -0.07. A boss: -0.02 + 0.08 x hearts left. A dungeon room cleared without being hit: +0.008. `logic/tune.js` blends easy / normal / hard presets of enemy speed, aggression, attack cooldowns, wind-up time, projectile speed and heart drop rate. Damage, hit points and puzzles never change.

## Saving
Save version 2 (wide rooms). `logic/migrate.js` brings older saves over: v1 (tall 11 x 13 rooms) keeps items, hearts, gems, potions, bombs, keys, Boss Keys, beaten bosses, opened doors, switches and crystals (the room grid and room ids are the same); opened chests and bombed rocks are found again by what they held; you restart at the start of the area you were in (a dungeon's entrance, otherwise Fernwick outside the elder's house) with a one-line note. A current save with a broken respawn point restarts at its area's start. Anything unreadable becomes a fresh adventure; nothing in storage can crash the game (tested with junk).

`createSave('hero-quest')` stores the whole state (`game`), the skill, finishes and best time. It saves on every room change, pickup and purchase (throttled) and on `pagehide`. Continue resumes at the last entrance used.

## Code layout
| File | What |
|---|---|
| `logic/data.js` | Every room as 13 strings of 11 characters plus chests, signs, warps, NPCs, enemies and triggers |
| `logic/tiles.js`, `logic/world.js` | Map legend, neighbours, shared door flags, which cells are open |
| `logic/game.js` | The simulation: movement and collision, sword, boomerang, bombs, blocks, switches, crystals, doors, pickups, damage, dialogs, shop, room transitions, death and respawn. Emits events for the scene |
| `logic/enemies.js` | Enemy and boss behaviours and hit rules |
| `logic/story.js` | NPC lines by progress, item messages, shop stock |
| `logic/solver.js` | Completability solver (all key orders) and the push-block Sokoban search |
| `scenes/painter.js` | Paints a room into a canvas (LAS tiles outdoors; dungeon floors/walls drawn in the same pixel style so any wall shape joins up) |
| `scenes/Play.js` | World camera (2x), sprites, animations, effects, scroll/fade transitions |
| `layout.js` | Landscape screen layout: room view, slim margins, stick/button positions and hit areas |
| `logic/migrate.js` | Older saves to the current layout |
| `trophies.js` | Trophy definitions, lifetime counters, which events earn what |
| `scenes/Hud.js` | Side-margin HUD, stick and buttons, dialog box, shop, pause (with area map), death screen |
| `scenes/Title.js`, `scenes/Ending.js`, `scenes/Boot.js` | Menus, ending, loading and baked textures/animations |

## Boss tuning
Tuned by playing each boss through the real scene with a scripted "human" (decisions at ~8 Hz, reacting to tells: dodge squats/charges, sidestep rocks, attack only in safe windows, boomerang the Hollow King, bomb the Golem King) at the starting pace 4/10 with the hearts you'd have at that point. After tuning it wins every fight, taking 0-5 half hearts (Slime King 17-23 s, Golem King 12-15 s at 12 HP, where the extra hits came from the bot hugging him to drop bombs, Hollow King 13-21 s); every hit it took came from a told attack.

## Tests
- `tests/hero-quest.test.mjs`: map validity (sizes, legend, chest/sign/warp/house alignment, matching room edges, no openings to nowhere), the whole-game solver in every key order (every chest, every boss), item gating, every switch puzzle from every doorway, bomb refills near cracked walls, and rules (sword, contact damage and i-frames, shield, keys, block pushing, boomerang, bombs, death/respawn, potions, shop, bosses' immunities, splitting, clear-shutters, enemies stay in bounds, adaptive presets, save round-trip, the hidden cave), SWORD's TALK/READ/OPEN label for every NPC, sign and chest from every side (and not when facing away), one action per press, and `allTexts()` (every NPC line in every story state, signs, items, objectives, shop text).
- `tests/hero-quest-layout.test.mjs`: the landscape layout fits 640x360, button hit areas cover what's drawn without overlapping, controls stay in the margins without overlapping, the stick zone avoids the buttons, and the room is wide, centred, whole and at least 40 % bigger on screen than v1, and controls never cover the playable inside of the room.
- `tests/hero-quest-migrate.test.mjs`: v1 saves keep their progress and restart at their area's start, a migrated save can still go on, junk in storage never crashes, and trophies fire on the right events.
- `tests/hero-quest-playthrough.test.mjs`: (finds chests, doors, crystals and cracked walls from the room data, so it follows any layout) a bot plays from the first line to the ending through the real simulation (walking, pushing, unlocking, boomerang, bombs, chests), opening every chest.

## Next ideas
- A fourth dungeon item (bow) and more optional secrets; music.

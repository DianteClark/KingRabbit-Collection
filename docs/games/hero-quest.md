# Hollow Crown

**Status:** Playable (v1.2, landscape): overworld, 3 dungeons, bosses, shop, saves, ending, music, onboarding
**Game id:** `hero-quest` (`games/hero-quest/`)
**Art:** LAS Adventure Pack 1.0 and LAS Alchemist Lab 1.02 by Aleksandr Makarov (`shared/assets/las-zelda-adventure/`)
**Rules text:** `games/hero-quest/rules.js` (gold ? button)

A short top-down sword-and-dungeon adventure for a phone held in one hand. The Gremlin King stole the Hollow Crown; you get a sword from Elder Bram, clear the Mossy Hollow (boomerang), the Ember Lab (bombs) and Hollow Keep, and carry the Crown home. A full run is roughly 30-45 minutes.

## Screen and controls (landscape since v1.2)
- `startGame({ orientation: 'landscape' })`: 640x360 logical canvas; held upright the shared overlay asks you to turn the phone.
- The room (11 x 13 tiles of 16 px) is drawn at a crisp 2x in the middle (x 144-496) using the full screen height. At 2x it is 416 px tall, so the camera follows you up and down by up to 28 px and never shows past the room's edges (`layout.js` `camY`). Room slides start from the current camera position and end on the new room's clamped view.
- Left margin: pause `<`, hearts (two rows of five), gems, dungeon keys, and the floating stick (thumb down anywhere on the left half of the screen, margin or room).
- Right margin: `?`, then SWAP, ITEM and a big SWORD button stacked for the right thumb. SWORD turns into TALK / READ / OPEN next to people, signs and chests.
- Dialogs sit over the lower part of the room; toasts at its bottom edge; the area name at its top.
- Pause and shop are two-column panels; title and ending use left/right columns.
- All positions live in `layout.js` (plain numbers, tested). Text is 16/32 px only.
- The shield is always up: rocks coming at the way you face bounce off unless you're mid-swing.
- Keyboard: arrows/WASD, Space/J sword, K/X item, Q swap, Esc pause.

## World
| Area | Rooms | What's there |
|---|---|---|
| Fernwick Vale (overworld) | 3x3 | Village (elder, shop, villagers with hints), fields, Mosswood, Northwood, Ember River, Lake Sorrel, Grey Peaks |
| Interiors | 3 | Elder's house (start), Odo's shop, hidden cave by the lake (heart container, needs bombs) |
| Mossy Hollow | 7 | Key from a cleared room, push-block switch opens a shutter, boomerang, crystal across water lowers a bridge to the Boss Key. Boss: Slime King |
| Ember Lab | 7 | Two-block switch puzzle, clear-shutter room with the bombs, bombable wall, island chest via crystal, Stone Brute mini-boss. Boss: Golem King |
| Hollow Keep | 7 | Three-block puzzle, bomb wall, crystal bridge, twin golem mini-boss, optional bomb pocket. Boss: Hollow King |

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

## Adaptive difficulty
`adaptive.js` keeps one skill number (0-1, start 0.35). A fall: -0.07. A boss: -0.02 + 0.08 x hearts left. A dungeon room cleared without being hit: +0.008. `logic/tune.js` blends easy / normal / hard presets of enemy speed, aggression, attack cooldowns, wind-up time, projectile speed and heart drop rate. Damage, hit points and puzzles never change.

## Saving
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
| `layout.js` | Landscape screen layout: room view, margins, stick/button positions, camera clamp |
| `scenes/Hud.js` | Side-margin HUD, stick and buttons, dialog box, shop, pause (with area map), death screen |
| `scenes/Title.js`, `scenes/Ending.js`, `scenes/Boot.js` | Menus, ending, loading and baked textures/animations |

## Boss tuning
Tuned by playing each boss through the real scene with a scripted "human" (decisions at ~8 Hz, reacting to tells: dodge squats/charges, sidestep rocks, attack only in safe windows, boomerang the Hollow King, bomb the Golem King) at the starting pace 4/10 with the hearts you'd have at that point. After tuning it wins every fight, taking 0-5 half hearts (Slime King 17-23 s, Golem King 12-15 s at 12 HP, where the extra hits came from the bot hugging him to drop bombs, Hollow King 13-21 s); every hit it took came from a told attack.

## Tests
- `tests/hero-quest.test.mjs`: map validity (sizes, legend, chest/sign/warp/house alignment, matching room edges, no openings to nowhere), the whole-game solver in every key order (every chest, every boss), item gating, every switch puzzle from every doorway, bomb refills near cracked walls, and rules (sword, contact damage and i-frames, shield, keys, block pushing, boomerang, bombs, death/respawn, potions, shop, bosses' immunities, splitting, clear-shutters, enemies stay in bounds, adaptive presets, save round-trip, the hidden cave).
- `tests/hero-quest-layout.test.mjs`: the landscape layout fits 640x360, controls stay in the margins without overlapping, the stick zone avoids the buttons, and the camera keeps the player and only the room in view.
- `tests/hero-quest-playthrough.test.mjs`: a bot plays from the first line to the ending through the real simulation (walking, pushing, unlocking, boomerang, bombs, chests), opening every chest.

## Next ideas
- A fourth dungeon item (bow) and more optional secrets; music.

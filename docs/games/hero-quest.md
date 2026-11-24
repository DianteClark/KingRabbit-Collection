# Hollow Crown

**Status:** Playable (v1.0): overworld, 3 dungeons, bosses, shop, saves, ending
**Game id:** `hero-quest` (`games/hero-quest/`)
**Art:** LAS Adventure Pack 1.0 and LAS Alchemist Lab 1.02 by Aleksandr Makarov (`shared/assets/las-zelda-adventure/`)
**Rules text:** `games/hero-quest/rules.js` (gold ? button)

A short top-down sword-and-dungeon adventure for a phone held in one hand. The Gremlin King stole the Hollow Crown; you get a sword from Elder Bram, clear the Mossy Hollow (boomerang), the Ember Lab (bombs) and Hollow Keep, and carry the Crown home. A full run is roughly 30-45 minutes.

## Screen and controls
- 360x640 portrait. Top bar (44 px): back/pause, hearts, gems, dungeon keys, ?. The room (11 x 13 tiles of 16 px) is drawn at 2x in the middle (y 48-464); the touch controls live underneath it so they never cover the action.
- Floating stick: thumb down anywhere on the left side (room or pad). SWORD button (right) turns into TALK / READ / OPEN next to people, signs and chests. ITEM uses the selected item; SWAP (shown once you own two items) cycles boomerang / bombs / potion.
- The shield is always up: rocks coming at the way you face bounce off unless you're mid-swing.
- Keyboard: arrows/WASD, Space/J sword, K/X item, Q swap, Esc pause.
- Rooms change screen by screen (a 0.4 s slide); doors and cave mouths fade.

## World
| Area | Rooms | What's there |
|---|---|---|
| Fernwick Vale (overworld) | 3x3 | Village (elder, shop, villagers with hints), fields, Mosswood, Northwood, Ember River, Lake Sorrel, Grey Peaks |
| Interiors | 3 | Elder's house (start), Odo's shop, hidden cave by the lake (heart container, needs bombs) |
| Mossy Hollow | 7 | Key from a cleared room, push-block switch opens a shutter, boomerang, crystal across water lowers a bridge to the Boss Key. Boss: Slime King |
| Ember Lab | 7 | Two-block switch puzzle, clear-shutter room with the bombs, bombable wall, island chest via crystal, Stone Brute mini-boss. Boss: Golem King |
| Hollow Keep | 7 | Three-block puzzle, bomb wall, crystal bridge, twin golem mini-boss, optional bomb pocket. Boss: Hollow King |

Progression gates: the boomerang lowers the Ember River bridge (crystal on the far bank); bombs break the rock sealing Hollow Keep and the lake cave.

## Rules
- Hearts are half-heart HP (start 3 hearts). Contact and rocks hurt half a heart, golems and bosses a whole one. 1 s of blinking invulnerability and a knockback after each hit.
- Drops (bushes, pots, enemies): gems, 5-gems, hearts (more likely when you're low), bombs (much more likely when you have none).
- Potions (max 3) refill all hearts; one is drunk automatically when you'd fall.
- Shop: potion 30, 5 bombs 20 (needs the bag), Heart Charm 120 (once).
- Falling: back to the last entrance you used (dungeon door or overworld doorway), full hearts, everything kept. Enemies respawn when you re-enter a room; in a dungeon, rooms you cleared stay clear until you leave it.
- Small keys belong to their dungeon. Locked doors and bomb walls on a room edge are shared by both rooms. Switches, crystals and opened doors stay done for good; blocks reset when you leave the room, so a stuck block can't soft-lock you.
- Boss rooms seal until the boss falls; then a Heart Container, then a warp orb (or the Crown) appears.
- Bosses: the Slime King sheds slimes every 3 damage; the Golem King's armour shrugs off the sword unless it's dazed (by a bomb, or by charging into a wall) and the room keeps supplying bombs; the Hollow King's shield only drops to a boomerang hit, he throws rock volleys, teleports, and calls two blue slimes at half health.

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
| `scenes/Hud.js` | Top bar, stick and buttons, dialog box, shop, pause (with area map), death screen |
| `scenes/Title.js`, `scenes/Ending.js`, `scenes/Boot.js` | Menus, ending, loading and baked textures/animations |

## Tests
- `tests/hero-quest.test.mjs`: map validity (sizes, legend, chest/sign/warp/house alignment, matching room edges, no openings to nowhere), the whole-game solver in every key order (every chest, every boss), item gating, every switch puzzle from every doorway, bomb refills near cracked walls, and rules (sword, contact damage and i-frames, shield, keys, block pushing, boomerang, bombs, death/respawn, potions, shop, bosses' immunities, splitting, clear-shutters, enemies stay in bounds, adaptive presets, save round-trip, the hidden cave).
- `tests/hero-quest-playthrough.test.mjs`: a bot plays from the first line to the ending through the real simulation (walking, pushing, unlocking, boomerang, bombs, chests), opening every chest.

## Next ideas
- A fourth dungeon item (bow) and more optional secrets; music.

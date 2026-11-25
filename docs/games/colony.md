# Colony

**Status:** Playable (v1.0), portrait
**Art:** MAS Overworld (terrain, trees, animals; all four seasons) and MAS Roguelike (settlers, goblins, wolves, fire) by Aleksandr Makarov, packed into `games/colony/atlas/colony.png` (10 KB) by `atlas/pack.py`. Buildings, items and order markers are drawn by the packer in the same Dawnbringer-16 colours.
**Rules text:** `games/colony/rules.js`

A RimWorld-lite colony sim. Three settlers land in a generated wilderness. You mark work and place blueprints; they decide what to do by themselves. Survive two years (80 days), or build a radio, call for help and hold out 5 days until the ship lands. Everyone dead = colony lost.

## How it's built
- `logic/data.js` - map size (48x64 tiles of 8 px), time (60 ticks an hour, 1440 a day, 10-day seasons), items, buildings, recipes, work types, traits, names, animals.
- `logic/map.js` - seeded wilderness: a mountain on one side with iron ore, lakes, forests, berry bushes and herbs; any cut-off pocket is filled with rock so every walkable tile is reachable from the landing spot.
- `logic/path.js` - A* (8 directions, no corner cutting, typed-array heap) and a BFS distance map used to pick the nearest job.
- `logic/world.js` - tiles and passability, items and stockpiles, reservations, buildings, rooms and warmth (fires heat their room, or 3 tiles around them outdoors), temperature, wealth, the log, and notes for the screen.
- `logic/life.js` - settlers as people: traits, skills and XP, thoughts and mood, damage, downed/bleeding, death.
- `logic/ai.js` - settler brains: needs (food, rest, warmth, sickness), mental breaks, chats and relationships, and jobs as small saved step machines: eat, sleep, equip, doctor (tend, feed and carry the downed to bed), firefight, cook, hunt, build, take down, sow, reap, chop/pick/mine, craft, radio, refuel and haul. Work types follow a priority list; each settler can skip any type or focus one.
- `logic/mobs.js` - walking, combat (melee and bows), wild animals (some fight back), wolf packs, goblin raiders (bash walls and doors in the way, flee when half are down).
- `logic/story.js` - the storyteller: raids, wolves, lightning fires, sickness, blight, rats, cold snaps, heat waves, wanderers, refugees (with chasers), injured strangers, traders, cargo pods, herds. Big ones set `s.pending` and stop the clock for a decision.
- `logic/sim.js` - new game (modes and daily scenarios), the tick, hourly upkeep (crops, frost, rot, fuel), fire spread, the player's orders, win/lose, save/load.
- `logic/bot.js` - a hands-off player used by tests and the browser debug hook.
- `scenes/Play.js` - map rendering (one RenderTexture redrawn per dirty tile), creatures, night and fire glow, pan/pinch, tools (one finger draws, two fingers move the map), HUD, toolbar and trays, toasts, the first-minutes guide, trophies, music and saving.
- `scenes/panels.js` - HTML panels: settler sheet (status/skills/work/people), tile and creature info, crafting queue, colony menu, settlers list, log, stock, event popups, trader, end screen, new-game picker.
- `progress.js` - 15 trophies, the daily challenge and the adaptive storyteller setting.
- `music.js` - three original tunes (calm, winter, danger) on the shared audio context.

## Modes
- **Standard:** everything. The storyteller's strength adapts (deaths and losses ease it, beaten raids, winters and wins push it up).
- **Peaceful:** no raids or wolf packs, gentler sickness and fire, more starting supplies.
- **Daily:** today's seed picks the map and one of five scenarios (Late Arrival, Lone Survivor, Lean Land, Bandit Country, Rich Hills). Survive 15 days; the score is colony wealth (10 points a day if everyone dies). Fixed storyteller strength.

## Tests
- `tests/colony.test.mjs` - map determinism and connectivity, pathfinding (detours, corners, doors, unreachable), chopping and hauling, building from a blueprint, cooking, farming, hunger/sleep/eating, raids in Standard and none in Peaceful, refugees and trading, save round trip, daily determinism and score, order rules.
- `tests/colony-bot.test.mjs` - a hands-off bot survives a full year in Peaceful on three seeds while a watcher checks every tick that no settler stands on a blocked tile or stalls on a path; Standard is survivable for 12 days; building a radio and calling wins.

## Debug
`window.__colony` exposes `S` (sim), `Wd` (world), `PN` (panels), `scene`, `store` and `botStep`.

## Next ideas
- Roofs and room quality
- More recipes (stone tools, better armour)
- Animal taming

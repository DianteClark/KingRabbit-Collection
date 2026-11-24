# Heroes Lite

**Status:** Playable (v1.0): 3 scenarios + endless mode, Castle and Necropolis, adaptive computer opponent
**Art:** HAS Heroic Fantasy by Aleksandr Makarov (`shared/assets/has-heroic-fantasy/`, mostly the HAS2020 compilation and the Battlegrounds sheet)
**Rules text:** `games/heroes-lite/rules.js` (shown by the gold ? button on every screen)

A pocket Heroes of Might & Magic for a portrait phone: explore a small adventure map with heroes, grow towns,
and win tactical battles on a 7x8 grid.

## Screens

| Scene | What it does |
|---|---|
| Menu | Continue the saved game, pick Castle or Necropolis, choose a scenario, see records and the enemy level |
| Adventure | Draggable map (32px tiles), tap to plan a route, tap again to march; hero portraits, End Day, Hero / Town / Next |
| Town | Build (one structure a day), Recruit (weekly stock), Army (garrison <-> hero, hire heroes, guild spells), Trade |
| Battle | 7x8 grid, speed order strip, Spell / Wait / Defend / Auto, damage numbers and unit animations |

The hero sheet and level-up choice are overlays (`scenes/heroPanel.js`).

## Rules in brief

- **Map:** 8-way movement, straight step 10 MP, diagonal 14, 100 MP a day (+Logistics, Winged Boots). Pickups, mines,
  shrines and towns are visited by stepping on their gate. Monsters ambush heroes who step next to them.
  Fog of war for the human; the computer sees the whole map.
- **Economy:** gold, wood, ore, gems. Halls pay 500 / 1000 / 2000 gold a day, mines 1000 gold or 2 wood/ore or 1 gem.
  Day 1 of each week (1, 8, 15...) refills dwellings; wandering monsters grow 10% a week.
- **Towns:** 15 buildings with prerequisites: 3 halls, Citadel (+50% growth, defenders +5 Defense instead of +2),
  Tavern (hire up to 4 heroes for 2500), Marketplace, Mage Guild 1-3 (each town rolls 2/3/2 spells), 6 dwellings.
- **Heroes:** Attack / Defense / Power / Knowledge, level-ups give a weighted stat plus a choice of two of 10 skills
  (3 levels each; Necromancy for Necropolis only). Up to 5 stacks, 10 artifacts, beaten heroes drop their artifacts.
- **Battles:** HoMM3-style damage (+5% per Attack point over Defense, -2.5% per point under), one retaliation per
  round (Griffins two, Vampires ignore it), shooters blocked when an enemy is adjacent and halved in melee, wait,
  defend (+30% Defense), 9 spells (one hero cast per round), abilities: fly, regen, drain, joust, death blow, splash,
  resist. Auto-combat for any battle; Quick battle when you're 2.5x stronger than a monster pack.
- **Win / lose:** capture every enemy town; lose with no towns and no heroes, or after 7 days without a town.
  Towns are attacked hero-first, then the garrison.

## Scenarios (`logic/scenarios.js`, ASCII maps)

| Id | Name | Size | Notes |
|---|---|---|---|
| valley | Green Valley | 24x30 grass | 1 enemy town across a river with two guarded fords |
| desert | Desert Crossing | 26x34 sand | 2 enemy towns behind a dune ridge, a neutral town by the oasis |
| frontier | Frozen Frontier | 28x32 ice | enemy starts with 2 heroes, a Citadel and a bigger garrison; neutral fort |
| endless | Last Stand | 26x26 dirt | no enemy towns; a wave hero spawns at the edges every 7 days, its army grows ~wave^1.55; score = days survived |

## Computer player

`logic/ai.js` is a generator (`aiTurn`) so the adventure scene can animate moves and hand battles against the human to
the Battle scene. Each day it builds (a smart order or a random one), hires heroes, recruits into the garrison, lets the
visiting hero take most of it (keeping 20-35% at home), and moves every hero to the best-scoring target
(value / distance): piles, chests, mines, shrines, dwellings, beatable monsters, enemy heroes and towns, home to collect
troops, and back to defend a threatened town.

### Adaptive skill (`adaptive.js`)
Same pattern as Game Night: one skill number 0..1 (shown as level 1-10). A finished scenario moves it by the full step,
each battle against an enemy hero or town by a quarter step. `aiParams(skill)` blends easy / normal / hard presets:
attack ratio, monster caution, greed, noise, build quality, number of heroes, town defence, plus the tactical presets
(noise, fear of retaliation, focus fire on shooters, spell use, holding back to protect shooters). The computer never
gets extra resources.

## Tests

- `tests/heroes-lite.test.mjs`: maps (shape, footprints, reachability), path finding, economy, towns, visiting,
  levels, combat rules and spells, battle consequences, game over, endless waves, adaptive steps.
- `tests/heroes-lite-ai.test.mjs`: AI-vs-AI simulations: progress in two weeks, games finish, hard beats easy,
  every scenario winnable by a strong player, endless can be held for weeks, determinism after save/load.

## Next ideas
- Hero-to-hero army trading on the map
- More factions from the pack (Rampart, Stronghold, Inferno...)
- Siege walls / towers in town battles

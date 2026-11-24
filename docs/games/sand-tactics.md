# Sand Tactics

**Status:** Playable (v1.0): 8-mission campaign, 4 skirmish maps vs an adaptive CPU, 2 players on one phone
**Art:** Battle of the Sands v1.2 by Aleksandr Makarov (`shared/assets/battle-of-the-sands/Battle-of-the-Sands-v.1.2/`)
**Rules text:** `games/sand-tactics/rules.js` (shown by the gold ? button on every screen)

A turn-based desert war game in the spirit of the classic handheld tactics games, with original names, maps and
rules numbers. Blue (Azure Dunes Corps) against Red (Crimson Scorpions) on small portrait grid maps.

## Screens

| Scene | What it does |
|---|---|
| Menu | Continue the saved battle, Campaign list + briefings, Skirmish / 2 Players map cards with mini-maps, CPU level, sound |
| Battle | Draggable 11-wide map (32px cells: 16px art at 2x), header with day / turn / funds, bottom action panel |

Battle input: tap a unit (blue = move, red = can hit, white frame = targets in reach) -> tap a blue tile (the move is
only a preview) -> Fire / Capture / Wait / Undo. Tapping an enemy in the red zone walks next to it and opens the
forecast; nothing happens until **Fire!**. Tap an empty own factory to build. Tap an enemy to see its threat zone.
End Turn asks first if units can still act. Tapping during animations skips them; "Fast" speeds up CPU turns.

## Rules in brief (`logic/game.js`, `logic/data.js`)

- **Units (9):** Infantry, Scout, Lancer (bazooka squad) capture; Recon, Tank, Heavy Tank, Flak, Drone are direct;
  Artillery fires at range 2-3, can't move and fire, never counters. Drones fly over water/mesas, get no terrain cover.
- **Damage:** `base[att][def] * attackerHP/10 * (100 - stars * defenderHP) / 100`, floored, HP shown 1-10, no luck,
  so the forecast is exact. Surviving defenders hit back if adjacent and direct.
- **Terrain:** sand (1 star), dunes and oasis (2, slow tanks and wheels), mesa (4, foot and drones only), water
  (drones only), city/factory 3, HQ 4. Movement types foot / boot / tread / wheel / air.
- **Buildings:** 1000 funds each per turn; capture = 20 points minus the squad's HP per turn, reset when it leaves or
  dies; units on own buildings repair 2 HP (10% of cost per HP). Factories build any unit; new units wait a turn.
- **Win:** capture the enemy HQ, or destroy all enemy units (only once a side has had units). Survival missions
  (`survive: { side, days }`) are won on reaching that day.

## Campaign (`logic/maps.js`)

| # | Mission | Size | Teaches |
|---|---|---|---|
| 1 | First Contact | 11x11 | moving and attacking, no factories |
| 2 | The Oasis Road | 11x14 | capturing cities, building |
| 3 | Dune Sea | 11x16 | tanks, Lancers, dunes |
| 4 | Big Guns | 11x14 | artillery behind a mesa wall |
| 5 | Hold the Line | 11x14 | survive 7 days at mesa passes |
| 6 | Hornets | 11x14 | drones vs flak, lakes |
| 7 | Twin Lakes | 11x20 | economy race |
| 8 | Scorpion's Nest | 11x20 | fortress with heavy tanks and two factories |

Each mission has a briefing, a tip and an outro line. Skirmish maps are built from their top half by `mirror()`
(180-degree turn, sides swapped), so they are fair apart from Blue moving first.

## Computer player (`logic/ai.js`)

`aiStep(state, side, params)` returns one action at a time (the screen animates it), `null` to end the turn. Each
step scores every (unit, destination, action) and takes the best:

- attack value = damage dealt in funds + kill bonus - counter damage, bonus for hitting artillery and for stopping
  captures of its own buildings (HQ above all); attacks where the counter would kill the attacker for nothing are
  never taken (no suicide);
- position value = terrain cover, minus expected damage next turn from an enemy threat map (top two attackers in
  full), a large penalty for likely death, progress along a distance field to the unit's goal (assigned building for
  capturers, firing line for artillery, enemies / HQ for the rest, a hunter role against raiders near its HQ),
  bonus for standing next to threatened own artillery, sitting on its HQ when enemy infantry is near, healing;
- building: infantry while buildings are open and money is short, otherwise the unit with the best lifetime damage
  per fund against the enemy army (plus a generic mix), with variety and terrain-mobility factors.

Risk aversion relaxes as days pass so careful sides don't stall. Distance fields from buildings are cached for good,
the threat map per turn.

### Adaptive skill (`adaptive.js`)
Same pattern as Game Night / Heroes Lite: one skill 0..1 (shown as CPU Lv 1-10) moved after every battle against
the CPU. `aiParams(skill)` blends easy / normal / hard presets: noise, risk, suicide guard, kill bonus, guarding
artillery, terrain, goal drive, build quality, capture drive, hunting artillery, HQ defence. Funds and units are never
changed.

## Saves (`save.js`, key `kingrabbit:sand-tactics`)
The battle in progress (after every action and turn), campaign unlocks and best days, skirmish records, skill, fast.

## Tests
- `tests/sand-tactics.test.mjs`: maps parse and fit, skirmish symmetry, movement costs / blocking / paths, damage
  formula, counters and ranged rules, kills and rout, capturing (incl. reset and HQ win), income / building / repairs,
  survival, illegal commands, JSON round trip.
- `tests/sand-tactics-ai.test.mjs`: captures, focus fire, no hopeless attacks, artillery fires first and is guarded,
  hunts HQ raiders, builds and spends, decisions don't mutate state, AI-vs-AI battles finish on every skirmish map,
  determinism, a strong AI beats a weak one, every campaign mission is won by a strong AI against the normal CPU.

## Next ideas
- Transport (APC) and supply using the pack's other vehicles (harvest bot, box truck)
- Fog of war option
- A close-up battle cut-in like the handheld games (the units' attack frames are there)

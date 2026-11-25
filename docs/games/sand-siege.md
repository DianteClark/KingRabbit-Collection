# Sand Siege

**Status:** Playable (v1.0): 15-map campaign with stars, Hard and Endless per map, a daily challenge, 15 trophies
**Art:** Battle of the Sands v1.2 by Aleksandr Makarov (`shared/assets/battle-of-the-sands/Battle-of-the-Sands-v.1.2/`),
packed into one 30 KB atlas by `games/sand-siege/tools/pack_atlas.py` (`art/atlas.png` + `art/atlas.js`)
**Rules text:** `games/sand-siege/rules.js` (shown by the gold ? button on every screen)

A portrait desert tower defense game. Red columns march down an 11x15 map toward your HQ at the bottom; you build and
upgrade towers to stop them. Path maps have a fixed road; maze maps are open sand where your towers form the walls
and the enemy takes the shortest way around them.

## Screens

| Scene | What it does |
|---|---|
| Menu | Continue the saved game, Campaign grid (15 tiles, stars, Hard marker) + briefing with mini-map (Play / Hard / Endless), Daily Siege card, Trophies (2-column grid, tap for details), enemy-health level, sound |
| Play | Top bar (pause, lives, funds, wave counter: tap for the next wave's line-up, ?), 11x15 map (32px cells), bottom panel |

Play input: tap a tower in the palette -> tap a sand tile (ghost + range circle, green/red, reason shown) -> tap
**Build** or the same tile again. Tap a built tower for Upgrade / Aim (First, Last, Strong, Close) / Sell; the third
upgrade opens a two-specialty choice. Bottom row: Send Wave / "Next 12s +24" (call early for 2 funds a second),
1x/2x, and the three support powers (Air = tap the map to aim). Taps are read where the finger went down and must
not move more than 16px; nothing on the map reacts while a popup or How to Play is open.

## Rules in brief (`logic/sim.js`, `logic/data.js`)

- Fixed step of 1/30 s (two steps per tick at 2x). The whole state is plain JSON and saved every 2.5 s, after
  every action and when the page is hidden, so a game resumes mid-wave exactly (tested).
- **Towers (7):** Machine Gun, Cannon (splash), Anti-Air (air only), Tar Sprayer (slow pulse), Sniper, Artillery
  (long range, splash, blind spot), Supply Depot (pays every wave). Each has 2 upgrades and then a choice of 2
  specialties (Minigun / AP Rounds, Big Bore / Autoloader, Flak Burst / Missile Lock, Quicksand / Jammer,
  Marksman / Spotter (+20% range aura), Big Bertha / Barrage, Vault / Salvage Yard). Sell for 70% (100% before wave 1).
- **Enemies (9):** Rifleman, Raider (fast), Tank and Heavy Tank (armour: flat reduction, min 25% damage), Drone
  (flies straight to the base), Shield Trooper (recharging shield), Medic Truck (heals nearby), and two bosses,
  Behemoth and Gunship (cost 10 lives). Armour piercing ignores armour; Jammers stop healing and shields.
- **Waves (`logic/maps.js` `waveGroups`)**: each map has a roster (when each enemy first appears) and boss waves;
  budget and health grow with the wave and the map's tier. Every wave after the first pays 15 + 3 per wave, kills pay
  more in later waves and maps. 20 s break (25 after wave 1) between waves.
- **Support powers:** Airstrike (after map 2, 40 s), Sandstorm (after map 5, 60 s, everything at a third of its
  speed for 5 s), Repair (after map 8, 90 s, +3 lives).
- **Path-finding:** a breadth-first distance field from the base; ground units step to the neighbour one closer.
  On maze maps a tower is refused if any gate, or any enemy's next cell, would lose its route ("That would block the
  path"), and you can't build on an enemy. The dotted line shows the current route.
- **Stars:** 3 for at least 90% of lives left, 2 for at least half, 1 for a win. Winning unlocks the next map, plus
  Hard (enemy health x1.25, 10 lives, 90% funds) and Endless (waves forever, a boss every 10) for that map.

## Campaign

| # | Map | Kind | Waves | Introduces |
|---|---|---|---|---|
| 1 | Outpost Road | path | 10 | building, the coach strip |
| 2 | Dry Creek | path | 12 | tanks / armour |
| 3 | Twin Dunes | path, 2 gates | 12 | drones |
| 4 | Open Flats | maze | 12 | maze building |
| 5 | Shield Wall | path | 14 | shield troopers |
| 6 | Field Hospital | path | 14 | medics |
| 7 | Behemoth Pass | path | 15 | first boss |
| 8 | The Labyrinth | maze | 15 | rock walls |
| 9 | Hairpins | path | 15 | big waves, long road |
| 10 | Sky Raid | path | 15 | air-heavy, Gunship |
| 11 | Split Canyon | path, 2 gates | 16 | split defence |
| 12 | Sandstorm Maze | maze, 2 gates | 16 | Gunship |
| 13 | Iron Column | path | 18 | armour-heavy |
| 14 | Long March | path | 20 | both bosses |
| 15 | Scorpion's Den | maze, 3 gates | 20 | three bosses |

New enemy types get a one-time card (with a counter tip) the first time they appear. Map 1 has a coach strip that
walks through picking a tower, placing, building, sending the wave, upgrading and calling early; it can be turned
off from the pause menu.

## Adaptive difficulty (`adaptive.js`)

Only enemy health on Normal campaign maps changes: 88% to 112% (starts at 100%), nudged after each win or loss with
the shared Game Night formula. Hard, Endless and the daily are the same for everyone. Shown on the menu ("HP 100%")
and in How to Play; can be reset.

## Daily Siege

`dailyMap(dailySeed('sand-siege'))`: 40% a maze with seeded rocks (rocks that would cut a gate off are dropped),
otherwise a seeded winding road; two modifiers from Haste, Plated, Air Raid, War Chest, Lean Times, Tariffs, Horde,
Glass Base. 15 waves, boss at the end. Score = 100 per wave held + 25 per life left on a win, sent with
`reportDaily` (best of the day and streak shown on the result).

## Trophies (`logic/awards.js`)

Bronze: First Stand, Untouched (3 stars), Specialist, Eager (5 early calls in a game), Giant Slayer, Danger Close
(5 kills with one airstrike), Daily Duty. Silver: Halfway There (map 8), Iron Will (win on Hard), Endless Sands
(30 waves), War Chest (1,500 funds), Maze Master (secret: a 60-cell route). Gold: Siege Breaker (all 15), Perfect
General (all 3 stars), Flawless (secret: Hard without losing a life). `recordPlay` on start, `bumpStat` kills /
towers / waves.

## Tests

- `tests/sand-siege.test.mjs`: map shapes, roads that never touch themselves, path-finding, maze blocking (every
  cell tried in random order on every maze map; the gates always keep a route), trapping, combat (armour, shields,
  piercing), ground/air, target priorities, slow / heal / jam / splash, economy and selling, early-call bonus,
  powers, mid-wave save/resume determinism, wave curves and bosses, daily maps (200 seeds), trophies, adaptive range.
- `tests/sand-siege-bot.test.mjs`: `logic/bot.js` (coverage-scored placement, serpentine walls on maze maps,
  upgrades, Anti-Air when flyers are coming) wins all 15 maps at 100% and at 112% enemy health, and survives daily maps.

Balance measured with the bot (lives left, X = lost) across enemy health 88% / 100% / 112% / 125% / 140% / 160%:
maps 1-7 are won at every level; maps 8-15 are lost by the bot somewhere between 125% and 160%, Sandstorm Maze and
Scorpion's Den (where the bot's simple maze is weakest) at 112-125%.

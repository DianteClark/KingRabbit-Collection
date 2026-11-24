# Star Drifter

**Status:** Playable (v1): 2 ships (one unlockable), Normal + Cruise, 7 sectors + the flagship, full run saving (mid-fight too), first-fight tutorial
**Art:** MAS Space Roguelike by Aleksandr Makarov (`shared/assets/mas-mini-retro/MAS-Space-Roguelike-v.1.0/`): characters sheet for crew and boarders, item / 2-frame / tileset sheets for system, weapon, resource and beacon icons. Ship hulls and room grids are drawn in code in the MAS palette.
**Rules text:** `games/star-drifter/rules.js` (the gold ? button on every screen)

An FTL-style space roguelite for portrait phones. Jump from beacon to beacon across seven sectors with the Hegemony fleet on your tail, fight real-time ship battles (pause any time), manage reactor power and crew, and destroy the flagship *The Iron Verdict* at the Throne Gate.

## Code layout

| Path | What |
|---|---|
| `logic/data.js` | Systems (levels, upgrade costs), weapons, drones, crew species, room layouts for every ship, player ships, enemy classes, sector names, art refs |
| `logic/ship.js` | Ship model: rooms + door graph, reactor power (with "power memory" so repaired systems come back on), weapons/drones power, crew pathing, room capacity, after-fight restore |
| `logic/combat.js` | Real-time sim in 0.1 s ticks: shields, dodge, weapon charge, projectiles (laser/ion/missile/flak/beam), drones, hull/system damage, fire, breaches, oxygen, crew jobs and melee, medbay, boarding, jump drives, win/lose. Plain JSON state |
| `logic/ai.js` | Enemy brain: power, volley timing, target choice, crew jobs (also used for the player's "crew auto-tasks"), boarder AI |
| `logic/adaptive.js` | Adaptive enemy skill (the Game Night pattern, as pure functions). Tunes targeting (`smart`) and timing (`sync`, `delay`, `hold`) only |
| `logic/enemies.js` | Enemy ship generation by class and level (sector), Cruise softening, bounties |
| `logic/sector.js` | Sector map generation (rows of beacons, links, store/exit/flagship), fleet constants, distances |
| `logic/events.js` | 24 text events with requirement-gated ("blue") choices and costs |
| `logic/run.js` | Whole run: jumps, fuel, drift, arrival, fights, rewards, events, store, upgrades, cargo, sector exits, summary, save JSON |
| `logic/bot.js` | Bot captain used by the balance tests (volley-synced fire, sensible shopping and upgrades) |
| `scenes/` | Phaser scenes: Boot, Menu, Map (sector map + HTML sheets on top), Combat, RunEnd; `panels.js` HTML sheets (event, store, reward, ship screen, new run, records); `shipview.js` hull drawing; Gallery (dev only, `?gallery=art\|ts\|ch\|it\|f2`) |
| `save.js` | Run in progress (saved after every action and every 2 s of fighting), records, adaptive skill per mode, unlocks, tips |
| `debug.js` | `window.__sd` test hooks only in dev builds or with `?debug` |

## Game rules

- **Run:** 7 sectors of 6 rows of beacons, then the Throne Gate (4 rows) with the flagship at the top. Each jump costs 1 fuel; leaving a sector gives +2 fuel. Out of fuel you can Drift (+1 fuel, the fleet advances) so a run can never soft-lock.
- **Fleet:** starts below row 0 and advances 0.7 rows per jump (0.55 in Cruise). Arriving at an overrun beacon starts a fight with a Hegemony warship (sector + 1).
- **Beacons:** ~44% fights, ~42% events, the rest quiet (50% chance of a fuel canister); 1-2 stores per sector, shown on the map. The very first jump is a gentle tutorial fight.
- **Ship:** rooms on a grid; systems shields (2 power per layer), engines (5% dodge per power, needs a pilot), weapons, oxygen, medbay, drone bay (buyable), piloting and sensors (subsystems, no power). Reactor 8 (Wayfarer) up to 25.
- **Combat:** real time with pause and 1x/2x. Weapons charge, then fire at their aimed room (auto-fire keeps the aim). Lasers pop one shield layer per shot; ion pops a layer or locks a system; missiles ignore shields and use ammo; flak scatters; beams never miss and lose 1 damage per layer. Hits damage hull, the room's system and crew; can start fires and breaches. Defense drones shoot down missiles and flak.
- **Crew:** 5 species (Terran, Rokkan, Zephi, Synth, Kesh) with health, speed, repair and combat traits. Skills (pilot, engines, shields, weapons, repair, combat) level with use. Crew man the room they stand in; with crew auto-tasks on (default, toggle in the pause menu) idle crew repair, fight fires, seal breaches and repel boarders, then return to their stations. Manual orders set a new station.
- **Enemies:** Reaver raiders/hunters, Automata (crewless), Kesh boarding ships (teleporter), Hegemony patrols, and the flagship (34 hull, 2 layers, 4 weapons, 2 drones, 3 boarding parties). Some enemies try to jump away when badly hurt.
- **Between fights:** stores (fuel, missiles, drone parts, hull repair, 2 weapons, a drone or a system, a crew member; sell for half), upgrades on the Ship screen, cargo hold (4) for spare weapons/drones. Systems repair and crew heal after every fight; hull does not.
- **Adaptive AI:** after each fight the per-mode skill moves up after a clean win (< 8% hull lost) and down after a bruising one (> 22%); losing a run eases it by 0.15. It only changes enemy targeting and fire timing.
- **Modes:** Normal; Cruise (+6 hull, +20 scrap, +4 fuel, +2 missiles, enemies one level gentler and 15% less hull, slower fleet, 15% cheaper stores; score x0.6).
- **Unlock:** winning any run unlocks the Corvid (ion lance, two lasers, attack drone, mixed crew).
- **Score:** (sector - 1) x 100 + ships beaten x 15 + scrap / 2 (+1000 for a win).

## Balance

`tests/star-drifter-balance.test.mjs` plays whole runs with the bot (fixed seeds):
- Wayfarer, Normal: wins about a third of runs and reaches sector 5+ on average.
- Cruise clearly easier than Normal (bot wins well over half).
- Corvid, Normal: wins some runs too.
- A won run visits every sector: 10+ fights and 30+ jumps.

## Testing

- `npm test`: `tests/star-drifter.test.mjs` (ships and power, crew jobs, combat rules, boarding, drones, save/resume mid-fight, enemies, AI targeting and volley timing, adaptive skill, sector maps, fleet, fuel and drift, events, store, upgrades, cargo, run flow) and the balance file.
- Browser checks (Playwright, touch taps, 390x844): menu, new run, map tip, tutorial fight, power and crew orders, help overlay, pause menu, save & quit and resume mid-fight, events, store buy/sell, ship screen tabs, flagship and victory, plus a tap-only player that plays through sectors.

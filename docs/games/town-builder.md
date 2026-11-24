# Tiny Town Builder

**Status:** Playable (v1.0): sandbox, three scenarios, first-minutes guide, disasters (off by default)
**Art:** Tiny Tile Town by Aleksandr Makarov (`shared/assets/modern-city/TinyTileTown-v.1.0/`), plus BAS Town icons and people
**Rules text:** `games/town-builder/rules.js`

A calm SimCity-style builder for a phone held upright. Lay roads off the highway, zone land, keep the
power and water on, and the town grows itself building by building.

## How it plays
- **Map:** 48x48 tiles of 16 px (the pack's grid): grass, a river or lakes, forests, and a highway in from the west edge. Drag to pan, pinch to zoom.
- **Tools** (bottom bar): Look, Road (road, power line, bus stop, bus depot, train station, airport), Zone (R, C, I, Farm, dezone), Power (wind, coal, solar, nuclear, water tower, water works), Civic (police, fire, clinic, school and their big versions, university), Park (parks, plaza, sports court, landmarks), Doze, More (money, maps, tips, city, disasters, sound; plus Goal in scenarios).
- **Gestures:** drag tools (roads, lines, zones, bulldoze) draw with one finger; a second finger cancels the stroke and pans/zooms. Building tools place on tap (a ghost shows while the finger is down); a drag pans instead. Every build goes on an undo stack (30 deep) with a full refund.
- **Growth:** each week empty lots grow a small building when there's demand, power (not farms), a road within 3 tiles and decent appeal; buildings merge upward (1x1 houses -> 2x2 houses -> 2x2 apartments -> towers) when they also have water and enough land value. Bigger tiers unlock at Town and City.
- **Demand (RCI):** residents follow jobs (35% of people work), shops follow workers, industry fills the rest; taxes, happiness, landmarks and the highway link push it around.
- **Utilities:** power flows along roads, zones, buildings and power lines; each grid shares its plants, and the farthest buildings go dark when supply runs out. Water towers water a radius (and need power).
- **Coverage:** police, fire, health, schools, parks and transit stamp a radius scaled by funding (30% if unpowered).
- **Traffic:** every home sends commuters along the roads to the nearest jobs (multi-source BFS); road load drives the traffic map, car pollution, noise and the cars you see.
- **Land value, pollution, crime** feed appeal; **happiness** adds services, smoke, crime, taxes, jobs, outages, traffic and landmarks (the City panel shows the breakdown).
- **Money:** monthly taxes by zone (0-20%), upkeep by service with funding 0-150%, road upkeep, $5,000 loans (up to 3, repaid over 5 years, early payoff).
- **Milestones:** Village 250, Town 1,200, City 3,500, Metropolis 7,500. Each unlocks tools and the landmarks: Mayor's Mansion, Lighthouse, Bank Tower, Grand Hotel, Arena, University, Airport.
- **Advisors:** five advisors (planner, treasurer, safety, health and schools, transport) post the most urgent tip in the strip above the toolbar; tap it for the full list.
- **Disasters:** fire, earthquake, meteor, tornado and UFO, off by default. Fire coverage puts fires out; police coverage shoots down UFOs; rubble clears itself after a few months. Sandbox can start any disaster from More > Risks.
- **Life:** cars drive real routes between homes, jobs and the highway, buses now and then, people on the pavements, fire trucks and police cars respond, day/night with window lights and headlights. Speed: pause, 1x (8 s a month), 3x.

## Modes
- **Sandbox:** $20,000, no goal, no way to lose.
- **First Steps:** 1,200 people within 4 years ($15,000).
- **Debt-Free City:** 5,000 people within 10 years with no loans and money of $0 or more ($12,000).
- **Clean Air:** 3,000 people and 65% happiness within 8 years, coal and nuclear banned ($20,000).
- Scenarios are lost when time runs out, or after 12 months in debt. After a win you can keep building the same city.

## How it's built
- `logic/defs.js` - every number: footprints by tier, building catalog, costs, milestones, scenarios.
- `logic/sprites.js` - frame rectangles for every building sheet, generated from the PNGs and snapped to the 16 px grid.
- `logic/map.js` - seeded terrain (river, lakes, forest, highway, a clear meadow at the start) and BFS helpers.
- `logic/sim.js` - the city as plain JSON (layers saved as strings); derived maps (power, water, coverage, traffic, pollution, crime, land value, demand) live in a WeakMap off the save. Actions (roads, lines, zones, placing, bulldoze) snapshot the tiles they touch so undo restores them exactly.
- `logic/advisors.js`, `logic/tutorial.js` - tips and the six-step first-minutes guide.
- `logic/bot.js` - a mayor bot that lays a grid of 6x6 blocks and fills them on demand; the tests use it.
- `scenes/Game.js` - map (one RenderTexture for terrain/roads/lines, a sprite per building), input state machine, HUD, trays, life, disasters.
- `scenes/panels.js` + `tb.css` - HTML sheets (inspect, budget, maps, advisors, city, demand, disasters, milestones, results, scenarios). Each one pauses the city.
- Save: `createSave('town-builder')` holds the run (autosaved every month, after each build and when the page hides), best scenario results and whether the guide was finished.

## Tests
`tests/town-builder.test.mjs`: sprite catalog on the grid, seeded maps, exact undo for every tool (and of growth on the land), placement rules, power through lines and running out, service coverage and funding, commuter reach and traffic, budget arithmetic, taxes and loans, growth needs power, demand reacts to jobs, overlays/info/advisors for every tile, save round trip with identical futures, fire service saves buildings, all five disasters start and end (police down a UFO), the guide follows the player, the bot passes every milestone, the bot wins each scenario, and an idle mayor loses.

## Next ideas
- More map layouts (coast, hills) and a seed picker for sandbox
- Rail lines and stations you connect yourself
- Neighbor cities to trade power and water with

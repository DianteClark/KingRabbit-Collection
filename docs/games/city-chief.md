# City Chief

**Status:** Playable (v1.1): crime map, weather, night lights, helicopter, first-day guide
**Art:** BAS Town by Aleksandr Makarov (`shared/assets/modern-city/BAS-Town-v.1.0/`)
**Rules text:** `games/city-chief/rules.js`

You are the new police chief of Tiny Town. The city runs live; you make the calls that matter.

## How it's built
- `logic/city.js` - fixed map: 4 districts (Uptown, Downtown, Eastside, Harbor) of 3 blocks each, two-lane roads, buildings packed from the BAS Town sets, road graph + BFS paths.
- `logic/sim.js` - the whole simulation as plain JSON (saved to localStorage every game hour): calls, dispatch, scenes, car chases, fires and fire trucks, officers (ranks, skill, morale, injuries, deaths, retirement, promotion), crime groups and detective cases, the newspaper, mayor meetings, the budget shop, firing conditions.
- `logic/majors.js` - big events that stop the clock: bank robbery, hostage, gang war, riot, raid, officer down.
- `scenes/City.js` - map rendering, pan/pinch zoom, markers, cars with lights, ambulances, civilians, walkers, HUD.
- `scenes/panels.js` - HTML panels (incident, big event, force, cases, budget, newspaper, briefing, mayor, game over).

## Modes
- **Career:** fired if trust or safety hits 0, or the money drops below -$2,500. Day 30 is a milestone; play continues.
- **Endless:** 25% less crime, 60% fewer officer deaths, 20% bigger budget, meters never fall below 10.

## Tests
`tests/city-chief.test.mjs`: road reachability, save round trip, a careful bot keeps its job for 12 days, a passive bot gets fired, endless never ends, units never get stuck.

## Next ideas
- More districts as the city grows
- Officer shifts and overtime

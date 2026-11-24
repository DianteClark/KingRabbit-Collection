# Pangea

**Status:** Playable (v1.0): solo games against 2-4 adaptive computer rivals, pass and play for 2-4 people, a guided first game
**Art:** Pangea v1.01 by Aleksandr Makarov (`shared/assets/pangea-strategy/Pangea-v.1.01/`): tilesets, towns, units, leaders, tech, building and wonder icons
**Rules text:** `games/pangea/rules.js` (shown by the gold ? button on every screen)

A Civilization-lite 4X game for a phone held upright. Found cities with settlers, grow them, research a 27-tech tree,
meet (and fight or trade with) rivals, and win by conquest, science or score. Civilizations and leaders are made up
(Verdani, Kharun, Thessmark, Sunreach and ten more); the leader portraits come from the art pack.

## Screens

| Scene / panel | What it does |
|---|---|
| Menu (Phaser) | Continue, New Game, Guided first game, Pass and Play, rival level, sound, a small animated diorama |
| Setup (HTML) | Solo: pick a civ (14 leaders), rivals 2-4, map small/medium, length quick 100 / standard 150. Pass and play: 2-4 players (each picks a civ), 0-3 computer rivals |
| World (Phaser) | Two cameras: the map camera (drag, pinch or +/- for 1x/2x/3x zoom) and a UI camera for the top bar (turn, gold, science, joy; tap it for the empire) and the order bar at the bottom |
| City (HTML) | Yields, growth, focus (balanced/food/production/gold), a queue of up to 6 items with buy, every buildable unit/building/wonder with cost and turns, what is built |
| Research (HTML) | All techs by era; tap to study, tap a locked tech to set it as a goal (its prerequisites are studied first) |
| Rivals (HTML) | Met civs with portrait, attitude, war/peace/pact; declare war, propose peace, trade pact, swap techs, gift gold |
| Empire (HTML) | Score, gold and happiness breakdowns, victory progress, score table, city list, sound, main menu |
| Battle odds, reports, offers, hand-off cover, game over (HTML) | |

World input: tap a unit to select it (light tiles = reachable this turn, red frames = targets, gold = capturable).
Tap a light tile to move; tap a far tile once to see the route and again to send the unit there over several turns.
Tap an enemy to see the odds first; nothing happens until Attack. Tap a city to open it. The bottom bar holds the
selected unit's orders (Found City, Farm, Mine, Chop, Fortify, Sleep, Wake, Skip, Disband, X to let go) or
Tech / Empire / Rivals, plus Next and End Turn.

## Rules in brief (`logic/game.js`, `logic/data.js`, `logic/map.js`)

- **Map:** value-noise continent ("the Pangea") centred on the map with bays, islands, latitude bands (snow, tundra,
  desert, plains, grassland), hills, mountains, forests and 10 resources. Every civ starts on the biggest landmass,
  at least 6 tiles apart, with a food resource nearby. Small 26x22, medium 34x28.
- **Tiles:** grass 2/0/0, plains 1/1/0, desert 0/1/0, tundra 1/0/0, coast 1/0/1, ocean 1/0/0; forest 1/2/0,
  hills 0/2/0 (+50% defence), mountains impassable. Farms +1 food, mines +2 production, chopping a forest gives 20
  production to the nearest city.
- **Cities:** found 3+ tiles from any city; the ring around the city is claimed and culture claims one more tile at a
  time (radius 3). Citizens work tiles in radius 2 picked by the focus (never starving the city). Each citizen eats 2
  food; growing needs 8 + 6 x size food. Every 2 citizens add 1 production and 1 gold. Size 8 needs an Aqueduct.
  Settlers cost a citizen. Production overflows; buying costs about 2 gold per missing hammer.
- **Happiness:** 6 base + 3 per luxury kind in your borders + temples, colosseums, cathedrals, wonders, minus 2 per
  city and 1 per citizen. Below 0 cities stop growing; at -5 production drops by a quarter; at -10 units fight 25% worse.
- **Gold:** tiles + city centres + citizens + markets/banks + trade pacts (+3 each), minus building upkeep and 1 per unit
  over the free limit (3 + 1.5 per city). Broke: units are disbanded, then buildings sold.
- **Tech tree:** 27 techs in 4 eras (Ancient 7, Medieval 7, Industrial 7, Modern 6), era costs 30/85/190/330 plus a
  little per prerequisite, scaled down for 100-turn games. Unlocks 13 combat units in 4 lines (newer ones replace
  older), 14 buildings and 10 wonders.
- **Combat:** rounds of A/(A+D); the loser of a round loses 1 of 10 health, until one unit dies. The forecast shows
  both strengths with every modifier (terrain, fortified, city, walls, veteran, vs mounted, vs city, at sea, unhappy)
  and the exact win chance. Empty enemy cities and lone civilians are captured by walking in. 35% of winners become
  veterans (+25%); barracks make veterans.
- **Diplomacy:** peace by default; attacking declares war (with a warning); peace only after 8 turns of war. Attitude
  comes from personality, shared borders, pacts, gifts and common enemies. AIs offer peace and pacts to humans.
- **Victory:** conquest (hold every rival's original capital, or be the last civ), science (build the Space Ark after
  Spaceflight), score at the last turn (citizens x3, cities x5, techs x4, wonders x10, land x0.25). A civ with no
  cities left (after its first) is destroyed.

## Computer rivals (`logic/ai.js`)

One `playTurn` per civ: diplomacy (war only when stronger, unfriendly and past an early grace period; longer in the
guided game), research (cheap useful techs first), city production (defenders for threatened cities, settlers up to a
land-based target, workers, an army sized to its cities and neighbours, buildings by need, wonders by production),
gold spending, settlers (best-scored reachable site), workers (farms, mines, chopping), and units (garrison every
city, strike when the odds are good, gather before marching on the nearest enemy city, walk into empty cities,
fall back to heal, scout early).

Personalities (war / grow / science per civ) change the mix. The **adaptive skill** (`adaptive.js`, Heroes Lite
pattern, 0..1 shown as level 1-10, starts at 0.3) only blends decision presets: how large an empire it aims for, how
often it picks sensibly rather than at random, research quality, the odds it needs before attacking, group size,
buying, city focus management, retreating. It never changes resources. The guided game caps rivals at 0.12.

## Saving

The whole game is one JSON object (explored maps packed as strings); it is saved after every order (debounced), after
each civ's turn and at every hand-off, under `kingrabbit:pangea`. Continue resumes mid-rival-turn, at a hand-off cover
in pass and play, or on the player's turn. Finished games are cleared and the result recorded.

## Tests

`tests/pangea.test.mjs` (map generation, founding, growth, focus, production, buying, wonders, borders, aqueducts,
happiness, upkeep, tech tree integrity, goals, movement, multi-turn trips, combat odds and modifiers, captures,
diplomacy, every victory, saving) and `tests/pangea-ai.test.mjs` (turn 1, expansion over 60 turns, no hopeless
attacks, capturing empty cities, emergency defenders, peace offers, whole AI-vs-AI games reaching a victory, and
skill 1 beating skill 0 in most of 12 duels).

# Hearth Valley

**Status:** Playable (v1.0): a year-one goal (restore the town hall), then endless farming; Daily Derby
**Art:** LAS Adventure Pack 1.0 and LAS Alchemist Lab v1.02 by Aleksandr Makarov
(`shared/assets/las-zelda-adventure/`): grass, water, trees, rocks, cliffs, cave, houses (also widened into the town
hall), the farmer, the six villagers, slimes, item and ingredient icons. Soil, crops, tools, animals, fish, seed packets
and farm objects are small sprites drawn in `tools/pack.py` to match. Everything used is packed into one 512x282
atlas (`assets/atlas.png`, ~45 KB) with frame names in `frames.js`; rerun `python3 games/hearth-valley/tools/pack.py`
from the repo root after changing it.
**Rules text:** `games/hearth-valley/rules.js` (gold ? button on every screen)

A pocket farming and life sim, played upright. You take over your grandmother's overgrown farm next to Emberbrook.
Fill the eight bundles on the community board to restore the old town hall, ideally within the first year, then keep
farming as long as you like.

## Screens

| Scene | What it does |
|---|---|
| Title | Continue (date, gold, bundles) / New farm (confirm) / Daily Derby (today's best and streak), music and sound toggles, credits |
| World | The farm, Emberbrook and Whisperwood (24x28, 26x24, 22x24 tiles) and the mine floors. Header: back, date and clock, weather and gold, ?. Task line under the header. Bottom: tool bar (6 tools + 2 hand slots), thumb pad, A, energy (and health in the mine), Bag, Craft, Menu |
| Fish | The fishing minigame over the World; also the River Derby (90 s) and the Daily Derby (60 s, seeded) |
| Ending | The town hall restoration ceremony, then back to the farm |

HTML sheets (`scenes/panels.js`, `hv.css`): bag, shipping bin, the three shops (forge upgrades tab, ranch animals),
craft, community board, letters, friends, menu (stats, fish log, music/sound, save and quit), animal house, the
end-of-day summary and an item picker (fair, Winter Star). Panels swallow touches and the game ignores taps for 300 ms
after one closes.

## Controls

- Thumb pad (copied from Pocket Pets): one big zone, direction from the thumb, slide to turn, lift to stop.
- Tap a tile next to you to use the selected tool or item on it (or talk, harvest, open, pet...). Tap farther away to
  walk there; if the tile has something to use (a person, door, bin, forage, rock, water with the rod...) or the selected
  tool would do something there (dry soil with the can, grass with the hoe, empty soil with seeds), you walk up and use it.
- A uses the tile you face. Keys: arrows/WASD, Space/Enter, 1-8 for the bar.

## Rules in brief (`logic/`)

- **Time** (`game.js`): 6am to 2am, ten game minutes every 4.5 s (paused in menus, dialogue and minigames). Sleeping
  saves and pays the shipping bin. Out at 2am you pass out: half energy and lose 10% of your gold (max 500).
  Four seasons of 28 days; weekdays matter for shop closing days.
- **Energy** 140: hoe 2, axe 2, pick 2 (1 in the mine), can 1, rod 4. Food from the bag or a hand slot restores it.
- **Crops** (`data.js`): 12 crops over spring/summer/fall; a crop grows a day only if watered (rain waters everything).
  Regrowing crops fruit again. Out-of-season crops die at the season change. Compost: +50% growth. Sprinklers (4
  tiles) and Quality Sprinklers (8 tiles) water every morning.
- **Tools:** copper (800g + 3 copper bars) and iron (2,000g + 3 iron bars) upgrades at the forge. Hoe and can: 3 in a
  row / a 3x3 patch. Axe, pick, sword hit harder; the rod gets a bigger bar.
- **Animals:** chickens (400g, coop of 4) and cows (1,200g, barn of 3) from the ranch. One hay each in the trough per day
  and a pat: mood goes up and there is an egg or milk next morning. Hay: cut tall grass (it spreads on the farm in
  spring to fall) or buy it (50g). Mayo Jar and Cheese Press recipes arrive by letter with your first animals.
- **Fishing** (`fishing.js`): wait, tap the "!" within 0.9 s, then hold to raise the bar and keep the fish inside it
  until the meter fills. 11 fish by place (pond, river, lake), season, hour and weather; Old Whiskers (lake, rain, once).
- **Mine** (`maps.js`): 20 generated floors (11x13). The ladder hides under one rock, or appears where the last slime
  dies. Copper from floor 1, iron 5+, gold 12+, gems 8+. Slimes (green/blue/red) chase you and hit every ~1.3 s.
  Health 0: carried home, lose half of up to 3 stacks of mining loot, 2 hours pass. Floors 5/10/15/20 become starting
  points. Chests on 10 and 20.
- **Villagers** (`story.js`): Bram (forge), Tess (market), Mayor Alder, Granny Wren (ranch), Pip, Mira. Schedules by
  hour, all in town when it rains, home at night. Talk once a day (+20), one gift a day (love +80, like +45, neutral
  +20, hate -40, birthdays x3). Heart events with a present at 2, 4 and 6 hearts (100 points per heart, 8 max).
- **Board:** 8 bundles (Spring/Summer/Fall crops, Forager's, Angler's, Miner's, Rancher's, a 2,500g vault), each with
  a reward. All eight restore the hall (the Ending scene).
- **Festivals** (9am-2pm in town, then the day ends): Egg Hunt (spring 13, find 9 of 12 eggs in 60 s), River Derby
  (summer 11, 4+ fish in 90 s), Harvest Fair (fall 16, show your most valuable item), Winter Star (winter 25, gift your
  secret friend). Festival days are always sunny.
- **Year review:** the first morning of year 2 shows how year one went, restored or not. Play continues either way.

## Guided start

A task line and a bouncing marker walk a new player through: read the mailbox, till 3 tiles, plant 3 radishes, water
them, walk to town, read the board, sleep. The tool slot the step needs pulses.

## Trophies and daily

15 trophies (`TROPHIES` in `data.js`): First Harvest, Nibble, Fresh Eggs, Neighbourly, Helping Hand, Blue Ribbon
(bronze); Kindred Spirit, Deep Digger, Angler, Prosperous (silver); Mine Floor 20, Hearth Restored, In One Year
(gold); secret: Old Whiskers (gold), Night Owl (bronze). The rules queue them in `G.awards`; scenes hand them to
`shared/core/trophies.js`. Daily Derby: `dailySeed('hearth-valley')` picks the fish order, the score is the value
of the catch, `reportDaily` keeps today's best and the streak.

## Saving

`createSave('hearth-valley')`: the whole state as JSON, saved when you sleep, on Back, and when the page is hidden or
closed. A mine floor is never saved (you resume at the mine entrance).

## Tests

`tests/hearth-valley.test.mjs` (with `tests/hearth-valley-bot.mjs`): maps and reachability, farming, regrowth, rain,
sprinklers and seasons, tool upgrades and energy, shipping and passing out, animals, machines, the fishing minigame
and fish availability, mine floors and fights, friendship and heart events, the board, calendar, festivals and the
tutorial; a bot that plays the whole first year (farming, animals, fishing, foraging, mining, crafting, festivals)
and restores the hall before winter on three seeds; and a lazy bot that only grows radishes, to check nothing gets
stuck.

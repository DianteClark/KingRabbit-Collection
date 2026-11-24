# Alchemist's Shop

**Status:** Playable (v1.0): 30-day story with the Festival of Flasks, endless mode, adaptive customers
**Art:** LAS Alchemist Lab v1.02 and LAS Adventure Pack 1.0 by Aleksandr Makarov
(`shared/assets/las-zelda-adventure/`: lab tileset, ingredients, alchemist/apprentice, gremlin, golem, shop building,
cinnabar vein, NPCs, tileset, the item flask). Potion flasks are the Adventure Pack flask recoloured per potion at boot.
**Rules text:** `games/alchemist/rules.js` (gold ? button on every screen)

A cozy portrait potion-shop sim. Aunt Hazel left you her shop: gather ingredients, brew potions, sell them to the
townsfolk, pay the rent, and beat Madame Vex at the Festival of Flasks on day 30.

## Screens

| Scene | What it does |
|---|---|
| Title | Continue / New shop (confirm) / Festival results, sound + music toggles, customer pickiness level, credits |
| Shop | The hub. Morning: Gather, Brew, Market, Upgrades, Recipes, Shelves, Open the shop. Open: customers walk in one at a time, offer a potion, set a price, haggle. Night: ledger + upgrades + sleep |
| Gather | Garden / Forest / Cave tabs; tap spots to pick (dots = picks left), basket picks per morning, tap gremlins/golems to shoo them off guarded spots |
| Brew | Ingredient grid with element dots, 3 pot slots, preview ("Makes: X" once known, "Potent!"), stirring minigame, result card |
| Festival | Day 30: three rounds against Madame Vex, judged by Elder Rowan |
| Ending | Champion / Runner-up (then endless mode) or Shop closed (try again) |

Lists are HTML sheets (`scenes/panels.js`, `shop.css`): market, recipe book (potions + ingredients), shelves (pour out
takes two taps), price picker, upgrades, night ledger, tips. Panels disable canvas input while open and ignore taps
for 450 ms after opening, so taps never fall through in either direction.

## Rules in brief (`logic/`)

- **Elements:** Fire, Water, Earth, Air, Life. Each ingredient has 1-6 element dots (`data.js`).
- **Mixing** (`brew.js`): 2-3 ingredients. Legendary sets first (Phoenix Plume + Dragon Heart = Phoenix Elixir;
  + Moonsilver = Sage's Gold). Else if the top element is at least 2x the next: pure potion. Else if the 2nd and 3rd
  are tied: Murky Sludge. Else the top two make a pair potion (10 pairs). 17 recipes in the book.
- **Stars:** three stirs (perfect 2 / good 1 / miss 0; total 5+ = 3 stars, 3+ = 2 stars) and +1 star for a potent
  brew (7+ dots). Cauldron upgrades widen the zones and slow the needle; Iron+ makes 3 potions a brew instead of 2.
- **Prices:** fair = value x 0.75 / 1 / 1.35 for 1-3 stars. Each customer pays up to fair x (1 + tolerance); above that
  they counter-offer. Accept, Insist (sale with -2 rep if within 15%, else they storm out, -3), or No deal (-1).
  Weaker than requested: they pay 30% less and give no thanks. Wrong potion: they decline (patience 2-3).
- **Reputation 0-100:** +1 per good sale, +1 for story customers, +1 for 3 stars, +1 at or below fair price, -1 when
  overcharging. Customers per day = 2 + rep/20 + sign level (max 9). The Cave needs 20 rep.
- **Money:** start 30 coins. Rent 6 and +3 every 5 days (24+ in endless), apprentice wage 4/6. Three nights in a row in
  debt closes the shop (the ledger warns you first).
- **Gathering:** 6/8/10 picks a morning (basket). Spots have 1-3 picks a day. The forest gremlin (2 taps) guards the
  Phoenix Plume, the cave gremlin the Moonsilver, the golem (3 taps) the Dragon Heart. Shooing costs picks.
- **Market:** Rock Salt, Honeycomb, Sunwater, Fire Pepper (limited stock), plus one daily special from your newest area.
- **Upgrades:** cauldron (45/120), basket (30/80), sign (35/90), shelves (20/60), apprentice Nell (50 from day 5, then
  90; brews 2 simple / 4 any known potions each morning), Forest (25, day 2+), Cave (60, rep 20+).

## Story

Named customers visit on fixed days (`STORY` in `data.js`): Mira the adventurer, Pip the errand boy, Tamsin the baker,
Bram the farmer, Elder Rowan (who announces the festival themes on day 20) and Madame Vex (taunts on days 10 and 25).
Each has a request with a reply for success or failure, some leave gifts (Mira's Dragon Heart on day 22), and Pip's
day-6 visit depends on how his day-2 race went.

**Festival (day 30):** rounds Fire, Healing Salve, your finest. Score = 10 if it fits + 5 per star + value/5
(value x 0.4 in the finest round); your reputation/10 is added at the end. Vex's scores come from the adaptive level.
Win or lose, you can then keep the shop open in endless mode.

## Adaptive customers

`adaptive.js` (the shared pattern): one skill 0..1 aims for about 70% happy customers each day. Presets in
`logic/tune.js` blend how much over fair customers pay, how often they want 2-3 stars, how often they name an exact
potion instead of any potion of an element, their patience, and Madame Vex's festival scores. Prices, rent and
ingredients never change. Shown on the title as "Picky N" (tap to read or reset).

## First-time guidance

A letter from Aunt Hazel, then tip cards the first time you gather, brew, serve a customer and reach the night, a
pulsing outline on the next step during day 1 (Gather, then Brew, then Open the shop), and a scripted easy day 1
(two customers who want a Healing Salve and a Featherstep, both brewable from the starting garden).

## Tests

`tests/alchemist.test.mjs` (bots in `tests/alchemist-bots.mjs`): mixing rules, every everyday potion reachable from
garden + market, stirring and stars, gathering/guards, market and upgrades, shelves, selling and haggling, fair vs
steep pricing, save round-trip mid-shop, adaptive presets, gentle early requests, festival scoring, debt closing,
story beats, a careful bot winning the 30 days at three skill levels, a reckless bot going broke, and a casual
garden-only player surviving but not walking the festival.

## Sound

Effects from `shared/core/sfx.js`; music loops (shop, gather, cave, festival, night), jingles and cauldron bubbles in
`music.js` on the shared audio context, started only after the first tap.

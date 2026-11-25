# Rabbit Survivors

**Status:** In development (`status: 'soon'` in `shared/games.js`), landscape, Vampire Survivors-style
**Art:** Aleksandr Makarov, RAS Overworld pack (`shared/assets/mas-mini-retro/RAS-Overworld-v.1.0/`): heroes, monsters, weapons, items, trees and graves. `games/survivors/tools/build_atlas.py` cuts them into `atlas/survivors.png/json` (flood-fills the black sheet background to transparent), bakes the floor texture and writes `games/public/thumbs/survivors.png`.
**Rules text:** `games/survivors/rules.js` (gold ? button, also in the pause menu)

Move with one thumb; weapons fire on their own. Survive 15 minutes of a ramping horde, then face the Horned King.

## Code
- `logic/data.js`: weapons (6), passives (6), evolutions (4), heroes (4), monsters (14), bosses (3), shop (8). Pure data.
- `logic/waves.js`: `waveAt(t, easy)` (types, spawn rate, alive cap up to 300, hp/damage multipliers per minute), `eventsBetween(t0, t1)` (elites every minute, bosses at 5/10/15 min, bat swarms at 2:30/7:30/12:30), `spawnCount`.
- `logic/build.js`: `playerStats` (hero + shop + passives + Easy), `weaponStats`, `rollOffers` (evolution first when ready, owned items weighted x2, gold/heal fill-ins), `applyOffer`, `readyEvolutions`, `hitDamage` / `hurtDamage`, `xpToNext`.
- `logic/meta.js`: coins, `buyUpgrade`, `unlockHero`, `refundShop`, `recordRun`, `dailyConfig(seed)` (hero + run seed), `dailyScore` (seconds x 10 + kills).
- `logic/grid.js`: uniform grid (typed-array linked lists) for all circle collision. No physics bodies.
- `scenes/Game.js`: the run. Fixed pools (304 monsters, 400 gems, 140 shots, 40 pickups, 24 damage numbers), sub-stepped update, camera follow in a 2560x2560 bounded arena with a pine wall. `window.__surv` debug hooks: `speed(n)`, `god()`, `setTime(s)`, `xp(n)`, `hurt(n)`, `alive()`.
- `scenes/Hud.js`: floating joystick (left 60% of the screen), keyboard (WASD/arrows, P/Esc, 1-3), controller via `padkit` (stick/d-pad, Start pauses, menus on the padkit frame), XP bar, timer, kills/coins, build icons, boss bar, low-HP red edges, level-up cards, pause menu.
- `scenes/Title.js`, `Shop.js` (heroes + permanent upgrades), `Results.js`.

## Rules in short
- Evolutions: Dagger 5 + Haste Ring = Thousand Edges, Shields 5 + Wide Tome = Holy Bulwark, Aura 5 + Big Heart = Soul Eater, Bomb 5 + Might = Meteor Storm. Offered as an EVOLVE card, or given by a chest (elites and bosses drop chests).
- At 15:00 the clock stops, the horde vanishes (the run counts as won) and the Horned King arrives; killing him ends the run as a Victory.
- Easy: x1.5 HP, monster hits x0.6, ramp on a 0.8x clock. Daily: fixed hero and seed, no shop bonuses, no Easy.
- Pickups: coin (3.5%), roast meat heals 30 (0.6%), horseshoe magnet pulls every gem (0.25%).

## Trophies
17 (8 bronze, 6 silver, 3 gold) in `trophies.js`; stats `runs`, `kills`, `bosses`, `evolutions`.

## Tests
`tests/survivors.test.mjs`: waves, events, spawn cap, offers, evolutions, damage, stats, shop/meta, daily, grid, atlas frames.

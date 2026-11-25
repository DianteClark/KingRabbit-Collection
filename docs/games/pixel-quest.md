# Pixel Quest

**Status:** Playable (v1.0): 4 towns, world map, 4 dungeons (11 floors), 6 bosses + a hidden one, ending, Daily Arena
**Art:** RAS Overworld v1.0 (tiles, heroes, people, item icons) and the MAS Darkness Pack creatures, both by Aleksandr
Makarov. `tools/pack_art.py` packs everything the game draws into one 256x372 atlas (`assets/atlas.png` + `atlas.json`,
about 30 KB); the creature sheet is recoloured per monster at load time (`art.js`). The NES Overworld .bmp palettes
decode, but hold too few usable tiles, so they are not used.
**Rules text:** `games/pixel-quest/rules.js` (shown by the gold ? button on every screen)

A compact, classic 8/16-bit party JRPG for a portrait phone. Vesper, the Night Warden, stole the three Chimes of the
Sun Bell and the sun stopped rising. Ash (Warrior) and Sola (Cleric) set out from Brightwater; Kit (Thief) and Wren
(Mage) join on the way. Find the Chimes, break the barrier around Nightspire and defeat Vesper to bring back the dawn.
About 2 to 3 hours for a first play.

## Screens

| Scene | What it does |
|---|---|
| Title | Continue (newest save), New game (Story / Normal), Load (autosave or menu save), Daily Arena, sound, All Games |
| World | One scene for the world map, towns and dungeons. 32px tiles drawn once into a RenderTexture (two frames for water and lava), live sprites for chests, switches, barriers, people, bosses. Big thumb pad (hold, slide), tap-to-walk with path finding, tap people/objects to walk up and use them (also across shop counters), A button, Menu. Party HP strip, gold, ward steps |
| Battle | Front view: monsters on an area backdrop, message box, four hero cards (HP bar, MP, status, buff marks). Fight / Skill / Item / Guard / Run / Back per hero, tap a monster or hero to target. Auto and Speed (x1/x2/x4) toggles. Header back button pauses |
| Ending | Sunrise epilogue, credits and play stats |

Lists are HTML sheets (`scenes/panels.js`, `pq.css`): Menu (goal, party, gold, chimes, play time), Items, Spells
(field healing), Equip (per slot, stat deltas, "equip the best I have"), Status, Shops (buy/sell, who can use it and by
how much), Options (difficulty, battle rate, music, sound), battle skill and item lists, tip cards.

## Rules in brief (`logic/`)

- **Party:** Warrior, Cleric, Thief, Mage. Stats from class base + growth per level (`stats.js`), gear adds to them.
  Level cap 30; XP to level L = 8(L-1)^2.4 + 8(L-1). Every hero gets the full XP of a won battle.
- **Damage:** physical `atk^2/(atk+def) x 0.95 x power`, x0.85-1.15, crits (thief 12%) x1.5 ignoring defence, guard
  halves. Magic `power + mag x scale`, weak x1.6, resist x0.5, Holy x2 on undead. Buffs x1.3 (atk) / x1.35 (def).
- **Rounds:** everyone picks, then actions run in speed order (x0.8-1.2 roll; Guard first). Run is a party action.
- **Status:** poison (7% max HP a round, lasts after battle), sleep (2-3 turns, hits may wake), silence (blocks
  Mage/Cleric spells), slow. Ribbon blocks all; bosses are immune to sleep and resist the rest.
- **Skills:** 5-7 per class (Power Slash, Provoke, Cleave, War Cry, Titan Blow / Heal, Cure, Shield, Heal All, Raise,
  Holy, Full Heal / Steal, Twin Strike, Venom Edge, Smoke Bomb, Mug, Shadow Rush / Fire, Sleep, Frost, Blaze, Hush,
  Thunder, Starfall).
- **Monsters:** 39 kinds (with the rare Gold Ooze) + 7 bosses on a level curve x archetype (blob, beast, flyer, brute, armor, caster, undead,
  boss), with weaknesses, skills, steals and drops. The Gold Ooze has huge XP and flees.
- **Encounters:** per-area rate (world 1/22 steps, dungeons 1/16-1/18) x battle-rate option (0.5/1/1.6), a few grace
  steps after every map change, Ward Incense stops them for 150 steps. Group size 1-4, +1/+2 when you out-level the
  area by 3/6, -1 when behind; at most 2 while the party is two heroes.
- **Difficulty:** Story = monster HP x0.72 (bosses too), attack/magic x0.85, one fewer monster per group (max 3), gold
  x1.25, no gold lost on a wipe. Normal = full strength; a wipe costs half your gold. Both wake you at the last inn.
- **Saving:** autosave on every map change, after battles, inns, chests and when the page hides; Save in the Menu
  writes a second slot. Continue loads the newer.

## World and story (`logic/maps.js`)

| Place | Notes |
|---|---|
| Brightwater | Start. Elder Bram gives the quest (the town exit waits for it), inn, item and gear shops, free rest at home |
| Mole Cave (2F) | Lever opens the red wall to the stairs; Cell Key frees Kit (joins); Kit picks the boss door; **Stonehide** (Earth Chime) |
| East bridge | Mended after Stonehide. Ferrow: Wren joins once you have a Chime |
| Wind Tower (3F + roof) | Wind seal opens for Wren. A crystal switch raises red walls and lowers blue ones on every floor; a secret wall on 3F; **Galewing** (Sky Chime) |
| North pass | The wind wall fades. Emberfall (desert town) |
| Ember Cave (2F) | Four braziers, lights-out style (each stirs its neighbours); secret wall; Lava Mimic; **Pyrescorp** (Fire Chime) |
| West pass | The rockfall shakes loose. Frosthollow: Sage Elra opens the dark barrier on the frozen sea |
| Nightspire (3F) | Spire Key door, two levers, **Bone Wyvern** on the stairs, hidden **Hive Queen** (optional), **Vesper** then **Vesper Unbound** |

23 chests (2 mimics). Gates on the world map (`GATES`) open with boss flags, so the world unlocks in story order.

## Trophies and Daily Arena

15 trophies (`trophies.js`): First Victory, Earth Chime, Party of Four, Sky Chime, Fire Chime, Dawnbringer (gold),
True Hero (finish on Normal, gold), Treasure Hunter, Sticky Fingers (15 steals), Seasoned (level 20), Flawless (a boss
with nobody falling), Arena Champion, and secret Gold Rush, Hidden Path, Queen Slayer (gold).

Daily Arena (`logic/daily.js`): `dailySeed('pixel-quest')` picks a level 21-23 party with seeded gear and bag and five
waves (two monster groups, a mid boss, a group, a final boss). A quarter of HP and a fifth of MP come back between
waves. Score = 1000 per wave, + up to 500 for HP left and up to 300 for speed on a full clear (`reportDaily`).

## Tests

- `tests/pixel-quest.test.mjs`: data references, stats and level-ups, gear, battle rules (commands, status, steal,
  run, silence, second boss form, auto commands always legal), every map's objects, every atlas frame, reachability
  of every chest, person, staircase, lever, brazier and exit on every map, the tower switches never trapping you
  (all reachable switch states across floors), gates opening in story order, each puzzle being required, shops,
  inns, chests, mimics, locks, joins, wipes, Home Wing, encounters, saves, the Daily Arena.
- `tests/pixel-quest-bot.test.mjs` (+ `pixel-quest-bot.mjs`): a bot plays the whole game with the real rules (walking
  with random battles, shopping, resting, puzzles, every boss with the Auto AI) on Normal and Story. It takes about
  130-150 battles and an estimated 60-75 minutes of optimal play.

## Files

`main.js`, `art.js` (atlas + monster recolours), `music.js` (12 tunes + jingles + battle sounds on the shared audio
context), `save.js`, `rules.js`, `trophies.js`, `scenes/` (Boot, Title, World, Battle, Ending, common, panels),
`logic/` (data, stats, battle, maps, game, daily, rng), `tools/pack_art.py`, `assets/`.

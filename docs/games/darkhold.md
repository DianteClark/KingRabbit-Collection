# Darkhold

**Status:** Playable (v1): 3 heroes, 10 generated floors + the Hollow King's hall, Normal / Lantern / Daily, saved after every turn
**Art:** MAS Darkness Pack by Aleksandr Makarov (`shared/assets/mas-mini-retro/MAS-Darkness-Pack-1.0/`): Tileset (lit map) and TilesetBlack (recoloured night palette for the remembered map), Creatures (heroes, monsters, the 32px boss) and CreaturesBlack (portraits), Items.
**Rules text:** `games/darkhold/rules.js` (the gold ? button on every screen)

A turn-based roguelike dungeon crawl by torchlight for portrait phones. Your torch burns down as you walk and your circle of light shrinks with it; monsters hide in the dark until they are close.

## Code layout

| Path | What |
|---|---|
| `logic/data.js` | Classes, 19 monsters + boss (tags drive behaviour), weapons, bows, armour, rings, potions, scrolls, supplies, perks, XP table, traps |
| `logic/gen.js` | Floor generation from (run seed, depth) only: rooms + MST corridors + loops, doors, secret shortcut doors, secret treasure closets, braziers, traps, loot, monsters, shops (floors 3/6/9), the boss hall (floor 11) |
| `logic/fov.js` | Recursive shadowcasting field of view, Bresenham lines, line of sight |
| `logic/game.js` | The run: actions (move/attack, wait, search, pick up, descend, fire, use, drop, unequip, perk, buy, sell), light and sight, monster AI, items, the turn clock, score. One JSON-safe object; light/FOV are cached on the side |
| `logic/bot.js` | Bot that plays whole runs through the same actions (used by the balance tests) |
| `logic/rng.js` | Seeded mulberry32 kept in the run, FNV hash for seeds |
| `scenes/` | Boot, Title, ClassSelect, Play (map, HUD, pad, popups, tips), panels (bag, shop, hero sheet, known items, map, perks, log), End (death recap / victory) |
| `art.js` | Sheets, frame names, the thin-wall autotile quarters, the night recolour, small generated textures (flame, trap plates, reticle) |
| `music.js` | Title / dungeon / boss tunes and Darkhold's own effects (steps, doors, ignite, wail, snuff...) on the shared audio context; music waits for the first tap |
| `adaptive.js` | Skill per mode (0..1). Only monster awareness and aggression change |
| `save.js` | Run in progress (after every turn), records per mode, today's daily, first-time tips |
| `debug.js` | `window.__dark` test hooks only in dev builds or with `?debug` |

## Rules

- **Heroes:** Knight (30 HP, longsword, leather, 15% shield block, knows Healing), Rogue (24 HP, dagger + short bow + 20 arrows, leather, triple sneak attacks, 20% weak-spot crits, twice as good at finding traps and secrets), Mage (20 HP, staff, Firebolt for 2 mana, mana refills 1 per 4 turns, torch burns 20% slower, knows Dawn/Teleport/Identify).
- **Light:** 400 fuel, 1 per turn. Radius 5/4/3/2 by quarter, 1 with no fuel; +1 Ring of Light, +1 Night Eyes, +2 Lantern mode, +2 Liquid Flame. You see a cell if it is in view and lit (by your torch, a lit brazier, a wisp, or Dawn light), or right next to you. Lighting a brazier lights 4 tiles around it for good and feeds your torch once (+120); a lit brazier rekindles a torch below 40%.
- **Monsters:** sleepers, wanderers, erratic fliers (bats, wisps), archers that keep their distance, ghosts through walls, light-fearing shades and wraiths (never enter bright light: your torch core or brazier light; cornered ones may strike), slimes and oozes that split, thieving imps that blink away, mimics, watchers that wake the floor, slow zombies. Deeper floors add stronger kinds, and a kind met deeper than its first floor gets +12% HP and harder hits per floor. A wanderer sometimes arrives from the dark after 220 turns on a floor.
- **The Hollow King:** 200 HP in a pillared hall with 4 unlit braziers. Takes x1.5 damage while in brazier/Dawn light (or while your torch blazes), only x0.4 in the dark; every 9 turns (6 below half HP) he blows the braziers out, drains 40 fuel and calls a shade.
- **Items:** 8 potions and 8 scrolls with per-run colours/labels, unknown until used or bought (Identify helps). Poison never kills (it stops at 1 HP); starvation can't kill in Lantern mode. Bag of 12; stacks for consumables; arrows and gold don't use slots.
- **Food:** 1000 max, 1 per turn (half in Lantern); Hungry below 150; starving costs 1 HP per 5 turns.
- **Levels:** XP table to level 13. Each level: +HP and 1 of 3 perks (Tough, Brawler, Stalwart, Night Eyes, Thrifty Flame, Marksman, Bloodthirst, Scavenger, Light Feet, Nimble, Second Wind, Alchemist, Keen Eye).
- **Modes:** Normal; Lantern (+2 light, fuel lasts longer, faster healing, 25% heal on each stair, slower hunger, 2 known healing potions); Daily (seed from the date, normal rules, fixed middle awareness, best score of the day kept).
- **Score:** deepest floor x100 + level x25 + kills x5 + gold, +2500 for a win.
- **Adaptive:** death -0.05 (-0.08 on floors 1-3), a floor cleared above 60% HP +0.012, a win +0.06. Skill blends wake-up chance, notice range, chase persistence, hesitation, archer fire rate and how often a monster alerts its sleeping neighbours.

## Tests

- `tests/darkhold.test.mjs`: every floor of 40 seeds x 11 depths is connected (secret doors counted) and its stairs/boss/shop reachable without secrets; deterministic floors and daily seeds; difficulty never changes map/loot/monsters; FOV and light; braziers; combat, XP and perks; sneak attacks; unknown potions/scrolls; equipment and bag; ghost, shade, slime, archer, imp, mimic, sleeper, watcher behaviour; traps and searching; the shop; save round-trip determinism; the Hollow King's light weakness.
- `tests/darkhold-bot.test.mjs`: 15 Normal runs (5 per hero) the bot must win at least 4 of and not all, average depth >= 6, every run ends; 9 Lantern runs at least 6 wins; easy awareness goes at least as far as hard.
- Bot results while tuning (skill 0.35): Normal about 70% wins (Knight 75%, Rogue 75%, Mage 60%), Lantern about 90%, skill 1.0 about 40%. A full run is about 2,000-2,500 turns.

## UI details

- Portrait 360x640: top bar (back/pause, HP and torch bars, floor, level + XP, gold, arrows or mana, ?), map view at 32px tiles centred on you, a two-line message band (tap for the log), and a pad (hold to keep walking, Wait in the middle) with Bag, Fire/Cast, Search/Pick up/Descend, Rest, Map, Hero.
- Tap a seen spot to walk there (dots show the path); walking, holding the pad and resting stop when a monster appears, you are hurt, a trap or secret turns up or you level up. Tap a distant monster for its card (Shoot from there). Fire shoots straight away with one target, otherwise shows reticles to pick from.
- Torchlight is drawn per 8px quarter with a flicker; remembered areas use the night palette; unknown is black.
- Popups and panels swallow every tap underneath; the map ignores taps for a moment after one closes; perk choice can't be skipped and reopens if anything else was in the way.
- First-time tips (once each): welcome, torch, first monster, light-fearing monsters, first item, stairs, brazier, traps, secret doors (floor 2), merchant, shooting, low torch, hunger, perks, the Hollow King.

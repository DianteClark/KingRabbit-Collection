# Gem Quest

**Status:** Playable (v1.0): 4 heroes, 4 regions (32 battles + 8 side quests + 4 riddle stones), Endless Tower, Daily Duel, 15 trophies
**Art:** HAS Heroic Fantasy by Aleksandr Makarov (`shared/assets/has-heroic-fantasy/`): creature packs and boss sheets for heroes and monsters, Magic Book icons for skills, Icon Pack items for gear, building and tree sprites for the map. Gems come from his MAS Mini Retro pack (Six Ball sheet), with skull, coin, star and special-gem overlays hand-drawn in the same style. Only the frames the game uses are packed into one 63 KB atlas (`assets/atlas.png`).
**Rules text:** `games/gem-quest/rules.js` (the gold ? button on every screen)

A Puzzle Quest-style match-3 RPG for portrait phones. You and a monster take turns on one 8x8 gem board: coloured gems charge your mana, skulls hit straight away, coins buy gear. Spend mana on your hero's skills, watch the monster's intent, and fight across Greenwood, the Haunted Crypt, the Frost Peaks and the Infernal Rift to the Red Dragon.

## Code layout

| Path | What |
|---|---|
| `logic/board.js` | 8x8 board: valid swaps, line/L/T detection, special gems (line, bomb, star), blasts that chain, gravity and refills, cascades, reshuffle when stuck. Every action returns animation steps; state is plain JSON |
| `logic/combat.js` | Turn engine: mana, skull damage, coins, extra turns on 4+ matches, skills and their effects (damage, heal, shield, poison, stun, rage, weak, leech, drain, convert gems, smash gems), turn limits, win/lose. Returns events for the view |
| `logic/ai.js` | Monster move choice (skull damage, mana it needs, extra turns, specials, a look at what it leaves you), presets blended by the adaptive skill; hero bot and hint |
| `logic/skills.js` | 16 hero skills and 19 monster skills, with plain-words descriptions |
| `logic/heroes.js` | Knight, Mage, Ranger, Berserker: HP/skull growth, skills opening at levels 1/3/6/10, XP curve, 23 pieces of gear |
| `logic/world.js` | 40 monsters (scaled by campaign position), 4 regions with 8 battles, 2 quests and a riddle stone each, shop stock, rewards |
| `logic/progress.js` | Campaign save: unlocking, XP (bench heroes get half), gold, shop, equipping; Endless Tower floors; Daily Duel |
| `logic/puzzle.js` | Riddle stones (fixed boards, no refills) and the solver that proves each one needs exactly its move limit |
| `logic/bot.js` | Plays battles, puzzles and the whole campaign (used by the tests) |
| `scenes/` | Boot (atlas + animations), Menu, WorldMap, Battle, Puzzle, Heroes, Shop, Tower; `boardview.js` draws the board, takes swipes/taps and animates steps |
| `art.js`, `tools/` | Map/menu art references; `tools/refs.mjs` + `tools/pack.py` rebuild the atlas from the shared sheets |
| `adaptive.js` | Adaptive monster skill (Game Night pattern), aimed at about 3 wins in 4 |
| `awards.js` | Trophies and the daily challenge (shared/core/trophies.js) |
| `save.js` | Progress, the battle in progress (saved after every action, mid-fight included), the tower climb, tips seen |
| `debug.js` | `window.__gq` / `__battle` / `__puzzle` test hooks only in dev builds or with `?debug` |

## Game rules

- **Board:** swipe a gem onto a neighbour, or tap one then the other. Only swaps that make a line of 3+ count (bad swaps slide back). Match 4 in a row: line gem (clears its row or column when it goes). L or T shape: bomb (3x3). Match 5: star (swap it with any gem to clear that colour; a star caught in a blast takes the most common colour). Specials caught in blasts go off too. 4+ matches give an extra turn. A board with no moves is reshuffled.
- **Battle:** red/blue/green/yellow gems fill that mana (cap 20, more with gear), skulls deal the matcher's skull damage, coins are gold (hero only). Whoever moves gets everything the cascade clears. Skills end the turn unless marked Free. The monster's intent box shows the skill it is charging and its mana progress; it casts the moment it can afford it, then charges its next skill.
- **Heroes:** Knight (shields, heals), Mage (burst damage, Transmute turns green into skulls), Ranger (cheap shots, poison, long stuns), Berserker (3 skull damage, rage, lifesteal). Knight and Mage start; the Ranger joins in region 2, the Berserker in region 3. Skull damage grows every 6 levels.
- **Campaign:** 8 battles per region, the 8th is a boss; beating it opens the next region. Side quests have a twist (turn limit or start wounded) and give unique gear. Riddle stones pay 100 gold. Losses still pay 25% XP, replays 60%, so nobody gets stuck. Gear is shared between heroes.
- **Endless Tower:** one hero, HP carries over (35% heal per floor), boss every 5th floor, monsters keep scaling. Pays gold into the campaign.
- **Daily Duel:** `dailySeed` picks the hero (level 8, no gear), the monster and the board. Score = 1000 + HP left x10 - turns x15 for a win, or damage dealt for a loss. Reported with `reportDaily`.

## Trophies (15)

Bronze: First Blood, Line Up, Hydra Slayer, Daily Duelist, By a Hair (secret). Silver: Starmaker, Avalanche (5 cascades), Full Party, Seasoned (level 10), Riddle Master, Climber (tower 10), Overkill (secret, 60 damage in one turn). Gold: Dragonbane, Errand Runner (all quests), Sky High (tower 25).

## Balance

`tests/gem-quest.test.mjs` (27 tests) covers the board rules, specials, cascades, reshuffles, a 400-move random game, skills, statuses, turn limits, save/resume determinism, honest intents, the adaptive AI, unlocking, rewards, gear, tower, daily, every riddle stone (solvable in exactly its limit) and two full bot campaigns. With the bot playing at "normal" against a normal monster, the campaign takes about 45 fights (a few losses, mostly on quests), regular fights leave ~70% HP and bosses ~40-60%. A weak bot against a gentle monster still finishes.

## UI details

- The battle is saved the moment an action resolves, before its animation; closing mid-animation loses nothing, and a fight that was already won pays out when resumed.
- Popups block every tap underneath and the screen ignores taps for a moment after a popup button, so a double tap can't land on what was under it. Scene changes ignore a second tap.
- First battle: a five-step coach (swipe, the monster's turn, gems and mana, the intent box, the first ready skill). The map shows one tip at a time (start, shop, riddle stone, quests, heroes). After 9 seconds without a move the game pulses a good swap.
- Tap the monster panel for its skills and statuses; tap your hero for yours; tap a skill to read it and cast it.

## Next ideas

- Music, more special-gem combos (line + bomb), more monster skill types
- A second set of riddle stones and a hard mode for the campaign

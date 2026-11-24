# Spire Roguelite

**Status:** Playable (v1.1): 3 heroes, 3 acts + Endless, full run saving, first-fight tutorial
**Art:** HAS Heroic Fantasy by Aleksandr Makarov (`shared/assets/has-heroic-fantasy/`): creature packs for heroes and monsters, boss sheets from the patron add-ons, Magic Book / Icon Pack / Skills icons for cards, relics and potions, building compilations for map rooms and events.
**Rules text:** `games/spire-roguelite/rules.js` (the gold ? button on every screen)

A Slay the Spire-style deckbuilding roguelite for portrait phones. Pick a hero, walk a branching map, fight with a deck of cards, build the deck as you climb, beat three bosses.

## Code layout

| Path | What |
|---|---|
| `logic/cards.js` | Every card: cost, target, values, upgrade, text template, `play(c, v, t)` |
| `logic/enemies.js` | Monsters, their moves (all telegraphed as intents) and AI, encounters per act |
| `logic/combat.js` | Turn engine: energy, draw/discard/exhaust, block, statuses, intents, events for the UI. State is plain JSON |
| `logic/statuses.js`, `relics.js`, `potions.js` | Buffs/debuffs, relic hooks, potions |
| `logic/map.js` | 12-floor branching map per act (StS-style path generation, no crossing paths) |
| `logic/run.js` | Whole run: heroes, rooms, rewards, shop, rest, events, boss relics, acts, Endless loops, score |
| `logic/events.js` | 13 "?" room events |
| `logic/bot.js` | Beam-search bot used by the balance tests |
| `scenes/` | Phaser scenes: Menu, HeroSelect, Map (with a Key legend), Battle, Reward (+ boss relic), Rooms (Rest/Treasure/Event/Shop), RunEnd, DeckView overlay, Gallery (dev builds only: `?gallery=enemies\|cards\|relics`) |
| `debug.js` | Test hooks `window.__spire` / `window.__battle` exist only in dev builds or with `?debug` in the URL (the browser checks use `?debug`) |
| `save.js` | Run in progress (saved after every action, including mid-fight) and records |

## Game rules

- **Heroes:** Knight (80 HP, Strength/Block, heals 8 after fights), Mage (72 HP, AoE spells and draw, +2 cards and +1 Energy on turn 1), Ranger (76 HP, Poison/Dexterity, poisons all enemies at the start of fights). Each has a starter deck, 3 starter-only cards and ~20 class cards; 10 neutral cards appear in shops.
- **Map:** 12 floors + boss per act. Row 1 fights, row 7 treasure, row 12 campfires. Elites and campfires from floor 5. At least one merchant per act. "?" rooms are events (sometimes a fight or a shop).
- **Combat:** 3 Energy, draw 5, hand limit 10. Hands of 6+ cards switch to two flat rows so every cost and name stays readable. The first fight ever shows a 4-step tutorial (Energy, intents, Block, how to play a card). Block resets each turn. Statuses: Strength, Dexterity, Weak, Vulnerable, Frail, Poison, Thorns, Plated, Ritual, Artifact, Regrowth, plus power effects. Ethereal, Exhaust, X-cost and status/curse cards.
- **Rewards:** gold, 40% potion chance (adapts like StS), 1 of 3 cards or skip (rare chance rises when you don't see rares), relics from elites/chests, rare cards and a choice of 3 boss relics after each boss. Later acts offer pre-upgraded cards.
- **Shop:** 5 class cards (one on sale), 2 neutral cards, 3 relics, 3 potions, card removal (75 gold, +25 each time).
- **Campfire:** rest (30% Max HP) or upgrade a card.
- **Endless:** +6 Max HP and a healing potion, enemies at 95% at first; after the act 3 boss the acts loop. Each loop: +100% enemy HP, +45% damage, +1 Strength and +1 Ritual on every enemy (elites and bosses +2 Strength and +1 Artifact), and the easy opening fights are gone. Strong bot runs end in loop 2 or 3 (floors ~50-110). Score = floors x10 + elites x25 + bosses x100 + gold/10 (+500 for a normal-mode win).

## Balance

`tests/spire-roguelite-balance.test.mjs` plays fixed-seed fights and runs with the bot:
- Act 1 opening fights with the starter deck: always won, 2-12 HP lost on average.
- Act 1 elites with a starter deck: at least 15 HP lost on average, but usually winnable.
- Full runs (8 per hero): the bot wins about 40%, beats act 1 in nearly every run, each hero wins between 1 and 6 of 8, and every hero averages past floor 14.
- Hero check (60 bot runs each, seeds 1000+ and 5000+): Knight 21 wins, Ranger 21, Mage 17.
- Endless goes at least as far as normal mode on the same seeds, but a strong deck can't coast past floor 160.

The bot plans each turn with a small beam search but builds its deck naively, so a person who drafts with a plan should win more often than it does.

## UI details
- The run is saved the moment an action resolves (before its animation), so closing the page mid-animation loses nothing; a fight that was already won resumes straight into its rewards.
- Status badges wrap to the space each enemy has and collapse into a "+n" marker (tap the enemy for the full list); the player's badges stack upward, away from the buttons.
- Screens that rebuild after a tap (rewards, shop, events) ignore taps for a moment, so a fast double tap can't take the next item by accident. Popups block every tap underneath, and the map doesn't scroll behind them.

## Next ideas
- Card animations per type (slash, spell burst) and more enemy special moves
- More events, a fourth hero, ascension-style difficulty levels

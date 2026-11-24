# Pocket Pets

**Status:** Playable (v1.0): 8 areas, 30 pets, 4 badges + Champion, adaptive computer tamers
**Art:** Pocket Pets v1.1 by Aleksandr Makarov (`shared/assets/pocketpets/`: pets, handheld cases, icons, screen
effects) and the RAS Overworld character sheet by Aleksandr Makarov (tamers on the map). Map tiles, buildings and item
icons are drawn in code (`tiles.js`, `art.js`) to match.
**Rules text:** `games/pocket-pets/rules.js` (shown by the gold ? button on every screen)

A pocket creature-collecting RPG for a portrait phone: walk a small overworld, catch pets in the tall grass, train a
team of six and win four Hall badges before facing Champion Aria at the Summit.

## Screens

| Scene | What it does |
|---|---|
| Title | Continue / New journey, a handheld case with a pet on its screen (tap for another), tamer level, sound |
| World | 32px tiles, camera follows you; d-pad (hold to walk) or tap a tile to path there; tap people, signs and doors to use them; A button; Pets / Bag / PetDex; coins and badges |
| Battle | The pets on an LCD "pocket screen"; FIGHT (four moves with type, PP and STRONG/weak hints) / PETS / BAG / RUN; capsule throw with shakes; evolution sequence at the end |

Lists are HTML sheets (`scenes/panels.js`, `pets.css`): party, pet summary (stats, moves, next moves, evolution),
bag (use items in and out of battle), shop, PetDex (seen/caught, type wheel), Pet Box (at clinics), learn-a-move.

## Rules in brief

- **Type wheel:** Flame > Leaf > Stone > Spark > Tide > Flame. x2 against the next type, x0.5 against the one
  before; Plain is neutral both ways. Same-type moves get x1.25.
- **Stats:** HP / Attack / Defence / Speed from species base stats and level (no hidden values). XP curve 0.8 x lv^3.
  Damage: `((2lv/5+2) x power x atk/def)/50 + 2`, x type, x same-type, x0.85-1.0 roll, 1/16 crits x1.5.
- **Moves:** 4 per pet, PP, accuracy, priority (Quick Jab), status, stat stages (-6..+6), drain, recoil, heal.
  Learnsets per evolution line; a fifth move asks which to forget.
- **Status:** burn (1/12 HP a turn, half damage), poison (1/8 a turn), paralysis (half speed, 25% stuck), sleep
  (1-3 turns). Flame can't burn, Leaf can't be poisoned, Spark can't be paralysed. Status persists after battle.
- **Catching:** `catchRate x capsule x (1 - 2/3 x hp%) x status` (sleep/para 1.6, burn/poison 1.3); capsules 1 / 1.6 /
  2.5. Shown as 0-3 shakes (each shake passes with p^1/4).
- **XP:** every pet that fought this foe gets full XP, the rest of the team half. Tamer battles x1.5.
- **Losing:** all pets fainted = lose 30% of your coins and wake at the last clinic/home you rested at. The very first
  rival battle is friendly (no penalty).
- **Party/box:** 6 in the party; extra catches go to the Pet Box (swap at any clinic).

## World (`logic/world.js`)

| Area | Notes |
|---|---|
| Sproutvale | Home (heals), Prof. Rowan's lab, clinic, shop. Pick a starter (Embit / Dribbit / Sprigling), then rival Kit battles you |
| Meadow Path | Wild Lv 2-5, two tamers, pond |
| Brookton | Hall 1: **Fern** (Leaf). Guard blocks Whisperwood until you have 1 badge |
| Whisperwood | Wild Lv 7-13, three tamers |
| Ember Cave | Gravel encounters Lv 13-19, two tamers, **Cinder** (Flame, badge 2) blocks the exit |
| Peakside | Rival Kit ambush on arrival, Hall 3: **Marina** (Tide), better shop. Guard blocks the trail until 3 badges |
| Summit Trail | Wild Lv 22-26, four tamers |
| The Summit | Lodge (heals), Hall 4: **Rocco** (Stone), Champion Tower: **Aria** (6 pets, Lv 32-34) after 4 badges |

Items lie on the map (walk over them); a few people hand out gifts. Shops gain stock with badges.

## Computer tamers and adaptive skill

`logic/ai.js` scores every move by expected damage (type, same-type, accuracy, KO bonus, priority when slower),
status value (not on a pet that already has a status or is immune) and set-up value (only when safe). It also
switches out of a bad type match-up (max twice a battle), uses potions when low, and picks who to send next by
match-up. Presets `easy / normal / hard` are blended by the adaptive skill (`adaptive.js`, the same pattern as Game
Night): `smart` (chance to play the best move), `noise`, `sense`, `swap`, `potion`, `pickNext`, `lowHp`. Only
decisions are tuned; pets, levels, items and dice are fixed. Skill moves after each tamer battle (leaders and the
Champion weigh 1, ordinary tamers 0.35, rivals 0.5-0.7).

## Saving

`createSave('pocket-pets')`: the whole journey as JSON (`game`), plus `skill` / `skillGames`. Saved on every map
change, after battles and menus, and at most once a second while walking.

## Tests

- `tests/pocket-pets.test.mjs`: type wheel, data integrity (learnsets, evolutions, every pet obtainable, no borrowed
  names), stats/XP/learning/evolution, damage and status rules, catch odds (simulated catch rate matches the
  formula), battle flow (forced switch, trainer's next pet, XP, losing), AI (hard picks super-strong moves, switches
  and heals; easy is more random; skill never changes teams), adaptive skill, maps (rectangular, doors and exits
  valid, everything reachable, gates hold until badges), journey rules (box, shop gating, resting, blackout, badges,
  friendly rival).
- `tests/pocket-pets-sim.test.mjs`: **completability**, the bot (grinds, catches, heals, shops, fights in order) plays the whole game for each starter at tamer skill 0.35 and 1. Its helpers are shared with the main test file.
- Test hooks: `window.__pets` (`tapTile(x, y)`, `state`, battle `bot()` / `ready`) and `window.__game`.

## Ideas for later

Rematches with leaders at higher levels, nicknames, a held-item slot, more areas (a lake town with Surf-free water
crossing), day/night palette for the LCD screen.

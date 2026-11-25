# KingRabbit Collection

A bundle of small, portrait-only HTML games for phones, all built from
Aleksandr Makarov's (iknowkingrabbit) pixel-art packs.

**Play:** https://dianteclark.github.io/KingRabbit-Collection/

| Game | Status | Link |
|---|---|---|
| Game Night: 20 board, card, arcade and puzzle games (see docs/games/game-night.md) | Playable | [/game-night/](https://dianteclark.github.io/KingRabbit-Collection/game-night/) |
| Spire Roguelite: deck-building roguelite (see docs/games/spire-roguelite.md) | Playable | [/spire-roguelite/](https://dianteclark.github.io/KingRabbit-Collection/spire-roguelite/) |
| Heroes Lite: pocket Heroes of Might & Magic (see docs/games/heroes-lite.md) | Playable | [/heroes-lite/](https://dianteclark.github.io/KingRabbit-Collection/heroes-lite/) |
| Pocket Pets: catch, train and battle pets (see docs/games/pocket-pets.md) | Playable | [/pocket-pets/](https://dianteclark.github.io/KingRabbit-Collection/pocket-pets/) |
| Hollow Crown: top-down sword-and-dungeon adventure (see docs/games/hero-quest.md) | Playable | [/hero-quest/](https://dianteclark.github.io/KingRabbit-Collection/hero-quest/) |
| Sand Tactics: turn-based desert war (see docs/games/sand-tactics.md) | Playable | [/sand-tactics/](https://dianteclark.github.io/KingRabbit-Collection/sand-tactics/) |
| Robbox: robot programming puzzles (see docs/games/robbox.md) | Playable | [/robbox/](https://dianteclark.github.io/KingRabbit-Collection/robbox/) |
| Alchemist's Shop: cozy potion-shop sim (see docs/games/alchemist.md) | Playable | [/alchemist/](https://dianteclark.github.io/KingRabbit-Collection/alchemist/) |
| Star Drifter: FTL-style space roguelite (see docs/games/star-drifter.md) | Playable | [/star-drifter/](https://dianteclark.github.io/KingRabbit-Collection/star-drifter/) |
| Pangea: Civilization-lite 4X (see docs/games/pangea.md) | Playable | [/pangea/](https://dianteclark.github.io/KingRabbit-Collection/pangea/) |
| MegaBoy Run: action platformer, landscape (see docs/games/megaboy.md) | Playable | [/megaboy/](https://dianteclark.github.io/KingRabbit-Collection/megaboy/) |
| Darkhold: torchlit roguelike dungeon crawl (see docs/games/darkhold.md) | Playable | [/darkhold/](https://dianteclark.github.io/KingRabbit-Collection/darkhold/) |
| Tiny Town Builder: calm city builder (see docs/games/town-builder.md) | Playable | [/town-builder/](https://dianteclark.github.io/KingRabbit-Collection/town-builder/) |
| Mini Golf: one-thumb mini golf (see docs/games/mini-golf.md) | Playable | [/mini-golf/](https://dianteclark.github.io/KingRabbit-Collection/mini-golf/) |
| Hearth Valley: farming and life sim (see docs/games/hearth-valley.md) | Playable | [/hearth-valley/](https://dianteclark.github.io/KingRabbit-Collection/hearth-valley/) |
| Sand Siege: desert tower defense (see docs/games/sand-siege.md) | Playable | [/sand-siege/](https://dianteclark.github.io/KingRabbit-Collection/sand-siege/) |
| City Chief: run the police force of Tiny Town (see docs/games/city-chief.md) | Playable | [/city-chief/](https://dianteclark.github.io/KingRabbit-Collection/city-chief/) |
| Pocket Soccer: 5-a-side arcade football (see docs/games/soccer.md) | Playable | [/soccer/](https://dianteclark.github.io/KingRabbit-Collection/soccer/) |

Progress on each game is tracked on the GitHub Project board, with one label per game.

## How it's set up

```
games/
  index.html, launcher.*   the "pick a game" page (site root)
  public/                  icons, thumbnails, web-app manifest
  <game-id>/               one folder per game -> published at /<game-id>/
shared/
  core/                    code every game uses (portrait scaling, rotate screen, saving, UI)
  games.js                 the launcher's list of games
  assets/                  the full art pack (see shared/assets/README.md)
  fonts/boldpixels/        the BoldPixels font
tests/                     rule tests, run on every push
docs/games/                a one-page design doc per game
```

- Built with **Phaser 3** and **Vite**. Every game runs at 360×640 and scales to fit the phone.
- Holding the phone sideways pauses the game and shows a "turn your phone upright" screen.
- A game only ships the sprites it actually imports, never the whole art pack.

## Publishing

Every push to `main` runs the tests, builds every game, and publishes the site to
GitHub Pages (`.github/workflows/deploy.yml`). This takes about a minute.

## Adding a game

1. Create `games/<game-id>/index.html` and `main.js`. Copying `games/game-night/` is the quickest start.
2. Call `startGame({ scenes: [...] })` from `shared/core/boot.js`.
3. Add the game to `shared/games.js` with status `hidden` (only reachable by its link), `soon`, or `playable`.
4. Add a 32×32 thumbnail at `games/public/thumbs/<game-id>.png`.
5. Write `docs/games/<game-id>.md`.

## Running locally

```bash
npm install
npm run dev      # http://localhost:5173 (open the Network URL on your phone, same Wi-Fi)
npm test
npm run build    # output in dist/
```

## Licenses

- **Code:** MIT (`LICENSE`)
- **Art:** Aleksandr Makarov, used with permission. It is **not** MIT-licensed (`shared/assets/LICENSE-ART.md`).
- **Font:** BoldPixels by YukiPixels, CC BY-SA 4.0

See `CREDITS.md` for the full list.

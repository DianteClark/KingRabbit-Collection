# Game Night

**Status:** Playable (v1.3): all 20 FunPack tables, adaptive CPU, sound effects; polish pass (rules fixes, no soft-locks, time-boxed CPUs)
**Art:** MAS FunPack (`shared/assets/mas-mini-retro/MASFunPack-v.1.2/AllGames/`)
**Rules text:** `games/game-night/rules.js` (shown by the ? button on every table)

| Tab | Table | Modes | Rules notes |
|---|---|---|---|
| Board | Tic-Tac-Toe | CPU, 2P | Players take turns going first; the CPU is beatable |
| Board | Reversi | CPU, 2P | Standard rules, passes when no move |
| Board | Checkers | CPU, 2P | American rules: forced captures, multi-jumps, kings; draw after 40 moves each with no capture or crowning |
| Board | Chess | CPU, 2P | Full rules: castling, en passant, promotion choice; checkmate, stalemate, material, 50-move and threefold-repetition draws |
| Board | Go 9x9 | CPU, 2P | Captures, suicide, ko; dead-stone marking, then area scoring with 6.5 komi |
| Board | Tables (backgammon) | CPU, 2P | Opening roll, bar, hitting, must use max dice / larger die, bearing off, gammon and backgammon (no doubling cube) |
| Board | Dominoes | CPU | Draw game with a spinner (4 directions), highest double leads, tap the end to play on, first to 100; tiles shrink so long layouts always fit |
| Board | Sea Battle | CPU | Classic fleet, place your own ships (they may touch), named sinkings |
| Cards | Yacht Dice | Solo, CPU, 2P | Yahtzee-style scoring with upper bonus, +100 extra Yachts and joker rules |
| Cards | Solitaire | Solo | Klondike draw 1 / draw 3, tap to pick then tap to place, undo, hint, clock, auto-finish |
| Cards | Wild Cards | CPU x2 | Official Uno rules: action start card, legal +4 and challenges, UNO call and catch, scoring to 500 |
| Arcade | Air Hockey | CPU | First to 7; the player scored on gets the puck |
| Arcade | Block Breaker | Solo | 8 layouts that loop, multi-hit bricks, power-ups incl. extra ball |
| Arcade | Space Rocks | Solo (adaptive) | Asteroids-style waves, flying saucer, extra ship every 10,000 |
| Arcade | Bowling | Solo | Proper 10-frame scoring, including the 10th frame |
| Arcade | Pool | CPU, 2P | 8-ball: open table after break, ball in hand, rail rule, call the 8 (8 with your last ball loses) |
| Arcade | Tank Battle | Solo (adaptive) | 4 stages, path-finding hunters/patrols, 6 power-ups, protect the flag |
| Puzzle | Box Box | Solo | 16 levels, all proven solvable by the test suite; level picker with fewest-move records |
| Puzzle | Six Ball | Solo | Columns-style matching with chains, landing outline, hold-to-slide |
| Puzzle | Mole Runner | Solo (adaptive) | Lode Runner-style, 6 levels; every gem proven reachable |

## Adaptive CPU
`games/game-night/adaptive.js` keeps a skill number (0 to 1, shown as level 1 to 10) per table. Wins raise it and losses lower it, scaled by the margin. Each AI has tested easy / normal / hard presets, and `tune()` blends between them. Only the computer's decisions change; dice, deals and shuffles never do.

## Next ideas
- Online two-player

# Pocket Soccer

**Status:** Playable (v1.0): Quick Match, Cup, Endless, penalty shoot-outs, adaptive CPU
**Art:** SportSeries Soccer test asset by Aleksandr Makarov (`shared/assets/soccer/SportSeries-Soccer-test-asset/`)
**Rules text:** `games/soccer/rules.js` (shown by the gold ? button)

Arcade five-a-side (four outfield players and a keeper each) on a vertical pitch that scrolls with the ball. You play the Rabbits in blue and always attack up the screen.

## Controls
| Input | With the ball | Without it |
|---|---|---|
| Left half: floating stick | Dribble | Run |
| PASS | Pass to the best teammate in the stick direction | Slide tackle toward the ball |
| SHOOT (hold, release) | Shoot; holding builds power, stick left/right aims | Switch to the teammate nearest the ball |

- Control auto-switches to the player nearest the ball (gold arrow and ring); a pass switches you to the receiver straight away, and with the stick idle he runs onto it.
- PASS or SHOOT pressed while a pass is on its way is played first time (one-touch).
- Keyboard for desktop: arrows/WASD, X/J pass, Space/K shoot.

## Rules
Two halves (Short 60 s, Normal 90 s or Long 150 s each, shown as 90 minutes). Kick-off, throw-ins, corners and goal kicks are quick restarts (the taker plays it, CPU or you; 6 s timeout). Goals need the ball between the posts and under the bar; a ball dribbled into the goal mouth also counts. Keepers dive, catch or parry (sometimes round the post for a corner) and may only handle in their box. No offside, no fouls. The ends don't swap at half time.

## Code layout
| File | What |
|---|---|
| `logic/constants.js` | Pitch size, goal, physics constants, side helpers |
| `logic/match.js` | `Match`: phases (setup, taking, play, goal, half, over), ball physics (height, bounces, posts, crossbar), touches, tackles, restarts, clock, human control |
| `logic/ai.js` | Team think (chaser, cover, man-marking), formation shape that shifts with the ball, dribbling, pass/shot scoring, keeper positioning/diving, set-piece takers, CPU presets |
| `logic/penalties.js` | Shoot-out order, early finish, sudden death, kick resolution |
| `logic/cup.js`, `logic/teams.js` | 8-team knockout, Endless ladder, team kits and strengths |
| `scenes/MatchScene.js` | Renders the match at 2x, camera, animations, sounds |
| `scenes/Hud.js` | Scoreboard, radar, joystick and buttons, banners, pause and full-time menus |
| `sprites.js` | Bakes body + recoloured shirt + head layers into one texture per kit and skin tone; grass tile and goals cut from TestField.png |

Everything in `logic/` is plain JavaScript, so `tests/soccer.test.mjs` plays CPU-vs-CPU matches in node (goals happen, nothing stays pinned to an edge, the ball never sits untouched, every restart is taken, a stronger CPU wins more), drives a scripted "human" through the touch inputs, and checks the shoot-out, cup and endless rules.

## Never stuck
- AI targets are clamped inside the pitch; players are pushed out of nets and off posts, never into corners.
- A loose ball always has a chaser (earliest interception), including the keeper inside his box.
- Dribblers swerve away from the lines; a CPU player holding the ball too long must pass or shoot.
- Set pieces time out (6 s for you, about 1 s for the CPU). A watchdog would nudge a dead ball after 5 s; the tests assert it never has to.

## Adaptive CPU
`adaptive.js` (same pattern as Game Night) keeps one skill number per player save: wins raise it, losses lower it, scaled by goal difference; shoot-outs count as draws. The CPU's reactions, pace, pass and shot accuracy, tackling, pressing and keeper reach/hands blend between easy, normal and hard presets. Cup opponents add their team strength plus a little per round; Endless starts 0.22 below your level and adds 0.045 per win in a row. Your own teammates and keeper always play at the normal level.

## Next ideas
- Two-player on one phone (split controls), swap ends at half time, fouls and free kicks

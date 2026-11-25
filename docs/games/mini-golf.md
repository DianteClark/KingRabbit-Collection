# Mini Golf

**Status:** Playable (v1.0): 27 holes in 3 courses, a daily hole from a set of 7, pass and play for 2-4, 15 trophies
**Art:** Tiny Tile Town trees and decorations by Aleksandr Makarov (`shared/assets/modern-city/TinyTileTown-v.1.0/`);
everything else (course, balls, obstacles, star, lock) is drawn in code in the MAS palette (`games/mini-golf/art.js`)
**Rules text:** `games/mini-golf/rules.js` (shown by the gold ? button on every screen)

A calm, one-thumb mini golf game in portrait. Pull back from the ball like a slingshot and let go.

## Screens

| Scene | What it does |
|---|---|
| Menu | Animated little green, Continue (saved round), Play courses, Pass & play, Daily hole (today's best), How to play, sound, All Games |
| Courses | A tab per course (locked ones show a padlock), Play 9-hole round, 3x3 hole cards with stars, par and best (tap to practise) |
| Party | 2 / 3 / 4 players and the course, then Tee off |
| Play | Top bar (back, hole and par, ?), putts / score row, the hole, bottom bar (Card or Restart, status and power bar, View) |

Play layout (360x640): the world is a container that is scaled and moved (not a Phaser camera), between a top bar
(0-80) and a bottom bar (580-640). Each hole opens on an overview with an intro card (name, par, tip), then glides
to the ball. The view follows the ball. Drag away from the ball to look around, pinch to zoom, View for the whole
hole (when it doesn't fit), Ball to come back after looking around.

## Putting (`logic/aim.js`)

- A touch within 56 screen px of the ball picks it up. Pull back: direction is ball minus finger, power grows from
  18 px (nothing) to 150 px (full).
- A tap, or a press that never got 18 px from the ball, never putts (it shows a hint). Bringing the finger back onto
  the ball shows "Let go to cancel".
- While aiming, a dotted line shows the first part of the real path (bounces included, moving obstacles left out)
  and the bottom bar shows the power.
- A second finger cancels the aim and starts a pinch.

## Physics (`logic/physics.js`)

Fixed step (1/120 s, with substeps so the ball never moves more than 2 px), deterministic, shared by the game,
the solver and the tests. Ball radius 5, cup radius 8, full power 600 px/s.

- Rolling resistance `a + b * speed`: grass (55, 0.8), sand / snow (420, 3.2), ice (9, 0.1).
- Walls (course outline and blocks) bounce with 0.78 restitution. Bumpers kick back harder (at least 260 px/s).
- Slopes add a constant push; boost pads push up to 520 px/s along their arrow; ramps launch a ball going
  over 150 px/s along them into the air (0.25-0.9 s), when it ignores hazards and the cup.
- Water / lava: +1 stroke, ball back to where it was hit from. Portals (a -> b) keep the speed.
- The cup catches a ball under 340 px/s whose centre is inside it, and gently pulls nearby balls in.
- Windmills (rotating sails) and sliders (sliding blocks; with `hold` they pause at each end and act as gates)
  move with world time and push the ball, even a resting one. A ball pinned between a slider and a wall pops out
  sideways.
- No soft-locks: a ball that tunnels into a wall is put back; a ball that stops somewhere invalid (inside a
  wall, block or slider, off the course) is reset to where it was hit from; any putt ends after 25 s.

## Holes (`logic/holes.js`)

| Course | Theme | Teaches |
|---|---|---|
| 1 Meadow Greens (par 24) | Grass, wooden rails | Straight putt, banking, sand, bumpers, a pond, the windmill, a slope, zig zag, a finale |
| 2 Frost Peak (par 24) | Snow, ice blocks | Ice, a boost pad, an icy slope, a sliding door, portals, an ice rink, uphill, gates, the summit |
| 3 Castle Keep (par 28) | Stone, lava | A ramp over the moat, a portcullis gate, two windmills, portals and bumpers, a maze, a lava bridge, guards, a spiral, a finale |
| Daily (7 holes) | Mixed | Crossroads, Frozen Pond, Pinball, Sandy Bay, Portal Hop, Mill Run, High Jump |

- Holes of a course open one after another for practice; a course opens when every hole of the one before has
  been holed. Full rounds always run holes 1-9.
- Stars: 3 at par or better, 2 at par + 1, 1 otherwise. After par + 5 putts the ball is picked up (score par + 5).
- `tests/mini-golf-solutions.mjs` runs the brute-force solver (`logic/solver.js`: real shots with the game's
  physics, beam search ranked by a flood-fill distance to the cup) and writes `logic/solutions.js`, one known
  way to hole each hole within par + 1. The tests replay them. Re-run it after changing physics or a hole.

## Modes and saving (`save.js`, `scenes/flow.js`)

- Round (9 holes, scorecard), practice (one hole), pass and play (2-4 players each play the hole in turn,
  "Pass the phone" between them, lowest total wins), daily (one hole picked by `dailySeed`, scored with
  `reportDaily(strokes, { lower: true })`, retry as often as you like).
- The round object is saved after every putt and every hole, so leaving and coming back resumes on the same
  hole with the same putts and ball position. Starting a new game while one is in progress asks first.
- Best per hole and best round per course are kept. First-time tips (sand, ice, slope, portal, ...) show once.
- First minutes: a ghost finger shows the pull-back on the first hole until the first putt; taps away from the
  ball explain where to start the drag.

## Trophies (`save.js`)

First Putt, Steady Hand (par), Birdie, Eagle Eye, Hole in One, Meadow Champion, Peak Bagger, King of the Keep,
Under Par (round), Star Collector (3 stars on all 27), Party Golf, Daily Golfer; secret: Splash!, Pinball Wizard
(4 bumpers in one putt), Wormhole (hole a putt that went through a portal). Toasts are queued 3 s apart.
Stats: putts, holes, aces, rounds.

## Sound (`sounds.js`)

Putt, wall tap, cup rattle, splash / lava sizzle, portal, ramp jump and landing, bumper, boost, windmill clack,
all synthesized on the shared audio context from `shared/core/sfx.js`.

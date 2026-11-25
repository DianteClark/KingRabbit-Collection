# Tiny Town Racers

**Status:** Playable (v1.0, landscape): three cups, Quick Race, Time Trial with ghosts, Daily Challenge, garage, adaptive rivals, 15 trophies
**Art:** BAS Town and Tiny Tile Town by Aleksandr Makarov (`shared/assets/modern-city/`): buildings, trees, ground decorations and parked cars as scenery, road colours from the road tileset. The race cars are drawn for this game (top-down, in the same palette) by `games/racers/tools/build_atlas.py`.
**Rules text:** `games/racers/rules.js` (shown by the gold ? button)

A top-down arcade racer in **landscape** (640x360 via `startGame({ orientation: 'landscape' })`). Six cars, three laps, through the streets, docks, parks and highways of Tiny Town, by day, by night and in the rain. Drift through bends to fill the boost meter, hit boost pads, and beat five computer rivals who adapt to how well you drive.

## Modes
- **Cup** (3 cups x 4 races): points 10/8/6/5/4/3, most points wins. Sunny Cup is open from the start; finishing a cup in the top three opens the next (Moonlight, then Champion). Winning a cup unlocks a car. The cup is saved after every race (title screen shows "race N of 4"), leaving mid-race just restarts that race next time, and the final table stays on screen until you tap Done. Later races grid by the standings (leader on pole); race 1 you start at the back.
- **Quick Race**: any track whose cup is open. You start at the back.
- **Time Trial**: alone, three laps. The best lap per track is saved with its ghost (packed delta string, ~3-5 KB) and replayed as a see-through car from the line each lap.
- **Daily Challenge**: track, car and colour from `dailySeed('racers')` (`logic/cup.js dailyConfig`); three-lap total goes to `reportDaily(time, { lower: true })`, which keeps today's best and the streak.
- **Garage**: six cars (Pocket Hatch, Dune Buggy, Street Coupe to start; Muscle Car, Rally Star, Golden Arrow from cup wins) with Speed / Accel / Grip / Drift bars, eight paint jobs.

## Tracks
12 races on 8 layouts (`logic/tracks.js`): Downtown Loop, Harbor Run, Park Lane, Highway Dash (Sunny Cup); Neon Streets (night), Harbor Storm (rain), Moonlit Park (night), Wet Highway (rain) (Moonlight Cup); and the Champion Cup runs four of the layouts the other way round in rain or at night. Each theme has its own ground (plaza, docks with water, park with ponds, fields), kerbs (red/white, hazard stripes, hedges, guard rails) and scenery. Night bakes in street lamps with pools of light plus headlight cones on every car; rain darkens the picture, adds falling rain on the HUD, puddles with little grip and a little less grip everywhere.

A layout is a loop of control points: `logic/track.js` runs a centripetal Catmull-Rom spline through them, resamples at 4 px, eases any corner tighter than the wall radius (so the inner wall can never fold), and puts the start line halfway along the first straight. `validate()` checks no two far-apart parts of the corridor come within touching distance.

## Controls (`layout.js`, `scenes/Hud.js`)
- Left thumb: two big steering pads; the whole left side of the screen counts (left of x=147 steers left, up to x=330 steers right), and the newest steering finger wins, so sliding or rolling the thumb across works.
- Right thumb: **DRIFT** (big): held while steering at speed it slides (faster turning, fills the boost meter); held without steering it brakes and then reverses. **BOOST** spends the meter (ring round the button; usable from a quarter full, the fuller the longer). Orange chevron pads give a free boost.
- Gas is automatic by default; the title screen switches to a GAS button (then DRIFT+steer keeps the power on).
- Steering assist: with no steering held the car eases its heading toward the road direction (max 1 rad/s), so a late correction doesn't end in a wall.
- Multi-touch: each pointer gets a role on touch-down (steer / drift / boost / gas). Touches are cleared when a popup or How to Play opens or closes, and when the race resumes; the race pauses itself when the page is hidden or the phone is turned upright.
- Keyboard: arrows/AD steer, Up/W gas, Space/Shift/Down drift, X/B boost.
- HUD: back (pause: Resume / Restart / Quit), position, lap, race time, best lap, mini-map (you in gold), countdown, lap banners, WRONG WAY, guided hints.

## Guided first minutes
The title's first button reads "Start racing!" and drops you straight into Sunny Cup race 1. Hints appear once each, at the moment they are useful: steer (during the countdown, until you have steered), drift (when the first tight bend is coming, until you hold a drift), boost (once the meter is half full, until you use it) and boost pads (as one approaches). A gold arrow marks your car at the start.

## Physics (`logic/car.js`)
Fixed 60 Hz steps. Forward/sideways velocity split; sideways slip decays at the grip rate (much slower while drifting). Turn rate scales with speed. The verge is slower than the road. Walls are the corridor edge: a car past it is pushed back along the normal, loses its outward speed (small bounce) and a little forward speed. A car trying to move but stuck under 8 px/s for 2.2 s is respawned on the centre line facing forward, blinking and non-colliding for 1.5 s. Car-to-car bumps are circle pushes with a speed exchange.

Lap progress comes from `locate()`, which only searches near the car's last sample index (+-14 samples), so progress can only change continuously: no shortcut through a gap, no jump to a nearby part of the track. Distance is unwrapped (backwards counts against you) and a lap counts the first time the distance passes the next multiple of the lap length.

## Computer drivers (`logic/ai.js`)
Each rival follows a racing line (iteratively straightened centre line clamped inside the road) with its own lane offset and wobble, a speed profile from its car's turn rate and braking, drifts when a bend needs more turn than grip gives, boosts on straights and steers round slower cars ahead. Skill 0..1 blends easy / normal / hard presets (pace, cornering, drift use, boost use, tidiness). Rubber band (`rubberBand()` in `logic/race.js`) is gentle: at most 5% slower when far ahead of you, 4% faster when far behind.

## Adaptive rivals (`adaptive.js`)
Same pattern as Game Night. One skill number (start 0.25, shown as level 1-10 on the title screen, resettable). After each Cup or Quick race: 1st pushes it up, 2nd slightly, 3rd is about neutral, 4th-6th ease it off, scaled by the time gap. Each rival adds a personal edge (Dot -0.1 ... Ace +0.08), and the Moonlight / Champion cups add +0.06 / +0.12. Calibrated with scripted "human" bots (binary steering with reaction lag) in node: a sloppy non-drifting driver averages about 2.6th at the starting level, a tidy drifting one wins.

## Trophies and daily (`trophies.js`)
15 trophies: Green Light, On the Podium, Chequered Flag, Sideways (3 s drift), Nitro Fan (50 boosts), Clean Lap, Sunny / Moonlight Champion, Champion of Tiny Town, Clean Sweep, Ghost Buster, Daily Driver, Full Garage, plus secret From the Back (win after running last on lap 2) and Wrong Way!. `recordPlay` on boot; stats `races`, `wins`, `boosts`.

## Art pipeline and loading
`python3 games/racers/tools/build_atlas.py` draws the six cars, pre-rotates each to 16 headings (Scale2x x3, nearest rotation, sample down: RotSprite-style, crisp), and packs them with the BAS buildings, parked cars, trees and decorations into one 512x249 sheet (`atlas/racers.png` + `.json`, ~40 KB). It also writes the launcher thumbnail. Car bodies use key colours swapped at load for the paint jobs. Each race bakes the whole track (ground, road, kerbs, start grid, pads, puddles, scenery, lamps and lighting) into a single canvas texture by `logic/raster.js` (about 0.1-0.2 s of CPU); only one track picture is kept at a time. Skid marks draw into a render texture.

## Sound (`sound.js`)
Engine hum (sawtooth + square through a low-pass, pitch and brightness follow speed and boost) and a band-passed noise tyre squeal while drifting, quiet, on the shared `audioContext()` with `onAudioReset` re-attach; silent when muted or paused. Countdown beeps, boost, pad and lap sounds; shared `sfx` for taps, walls, wins.

## Code layout
| File | What |
|---|---|
| `logic/track.js` | Spline, resampling, corner easing, `locate`, racing line, speed profile, `validate` |
| `logic/tracks.js` | Layouts, the 12 races, cups |
| `logic/car.js` | Car models and stats, physics step, walls, respawn, bumps |
| `logic/ai.js` | Rival driving and skill presets |
| `logic/race.js` | `Race`: grid, countdown, laps, positions, rubber band, stuck respawn, results, ghost recording; `simulate()` for tests |
| `logic/cup.js` | Points, table, unlocks, rivals, ghost packing, daily config, time format |
| `logic/raster.js` | Track picture, scenery placement, lamps, night/rain lighting |
| `logic/rng.js` | Seeded random, hashing, value noise |
| `layout.js` | Race touch layout (pure) |
| `scenes/` | Boot, Title, Garage, Tracks, Cup, RaceScene (world, camera, effects), Hud (controls, HUD, hints, pause), Results |

## Tests
`tests/racers.test.mjs` (node): every track validates and fits a texture; reversed tracks; local-only `locate`; racing line inside and smoother; acceleration and top speeds; boost and pads; drift fills the meter and turns tighter, brakes without steering; random driving never leaves the walls; a car shoved across a gap gains nothing; respawn; nose-in-wall respawn in a race; **the computer finishes all 12 tracks at skills 0-1 with laps counted exactly** and no lap faster than physically possible; higher skill is faster; rubber band bounds; backwards over the line doesn't count; positions and results ordering; grid slots; cup points and table; unlock order; rivals; ghost round trip and playback on the road; daily config; the painted picture and scenery clear of the road; touch layout sizes and overlaps.

Debug hooks for browser play-testing: `window.__race` (the Race), `window.__racer.autopilot = true` (the computer drives your car) and `window.__racer.turbo = k`.

// How the match is shown in landscape. The simulation works along a "length" axis (y, goal line
// to goal line, 0..L) and an "across" axis (x, touchline to touchline, 0..W). On screen the pitch
// runs horizontally: the goal at y = 0 is on the RIGHT, the goal at y = L on the LEFT, and x grows
// downward. That is a pure 90-degree rotation (no mirror), so left/right-footed shapes stay sane.
//
//   screen.x = OX + (L - y)      screen.y = OY + x
//
// Side 0 (you) attacks y = 0 in the first half, i.e. left to right, then right to left after the
// teams change ends.

import { L } from './constants.js';

export const OX = 56;   // world pixels left of the left goal line (room for the goal and run-off)
export const OY = 40;   // world pixels above the top touchline

/** Pitch point -> world (pre-camera) pixels. */
export const toScreen = (x, y) => ({ x: OX + (L - y), y: OY + x });

/** Pitch direction -> screen direction (same length). */
export const dirToScreen = (dx, dy) => ({ x: -dy, y: dx });

/** Screen direction (joystick, arrow keys) -> pitch direction. Inverse of dirToScreen. */
export const dirToPitch = (sx, sy) => ({ x: sy, y: -sx });

/** Screen x of the goal a pitch goal line (0 or L) is drawn at. */
export const goalScreenX = (gy) => OX + (L - gy);

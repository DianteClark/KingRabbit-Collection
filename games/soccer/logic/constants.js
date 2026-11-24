// Pitch geometry and physics constants, in art pixels (the camera draws them at 2x).
// The pitch runs from x 0..W (touchlines) and y 0..L (goal lines). Side 0 (home, you) defends the
// bottom goal at y = L and attacks up; side 1 defends the top goal at y = 0.

export const W = 232;            // touchline to touchline
export const L = 400;            // goal line to goal line
export const MARGIN = 26;        // run-off area around the pitch players may step into
export const GOAL_W = 56;        // between the posts
export const GOAL_D = 14;        // depth of the net
export const BAR = 13;           // crossbar height
export const POST_R = 1.5;
export const BALL_R = 2.5;
export const BOX_W = 136;        // penalty area
export const BOX_D = 52;
export const SIX_W = 80;         // goal area
export const SIX_D = 18;
export const CIRCLE_R = 30;
export const PEN_D = 36;         // penalty spot distance from the goal line
export const PLAYER_R = 4;
export const RUN = 60;           // base running speed, units per second
export const G = 330;            // gravity on the ball
export const FRICTION = 90;      // rolling deceleration
export const DT = 1 / 60;

export const ROLES = ['GK', 'DEF', 'LM', 'RM', 'FWD'];

/** Which way a side attacks along y (-1 = up the screen). */
export const attackDir = (side) => (side === 0 ? -1 : 1);
export const ownGoalY = (side) => (side === 0 ? L : 0);
export const oppGoalY = (side) => (side === 0 ? 0 : L);
/** 0 at a side's own goal line, 1 at the goal it attacks. */
export const depthOf = (side, y) => (side === 0 ? (L - y) / L : y / L);
export const yAtDepth = (side, d) => (side === 0 ? L - d * L : d * L);

/** Inside the penalty area that `side` defends (with a little slack). */
export function inBox(side, x, y, slack = 0) {
  if (Math.abs(x - W / 2) > BOX_W / 2 + slack) return false;
  const d = side === 0 ? L - y : y;
  return d < BOX_D + slack && d > -GOAL_D - slack;
}

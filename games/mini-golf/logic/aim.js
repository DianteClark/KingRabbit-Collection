// Turning a finger drag into a shot. Pure so the tap-never-shoots rule can be tested in node.
//
// The drag starts on (or near) the ball. Pulling back sets the direction (the ball goes the other
// way) and the power (further = harder). Bringing the finger back onto the ball cancels.

export const GRAB_R = 56;     // screen px: a touch this close to the ball picks it up for aiming
export const CANCEL_R = 18;   // screen px: let go this close to the ball and nothing happens
export const FULL_DRAG = 150; // screen px of pull for full power
export const MIN_POWER = 0.03;

/** True if a touch at (px, py) should start aiming the ball at (bx, by) (all in screen px). */
export const grabs = (bx, by, px, py) => Math.hypot(px - bx, py - by) <= GRAB_R;

/**
 * Shot for the current finger position, in screen px. Returns { angle, power, cancelled }.
 * maxDragged is the furthest the finger has been from the ball during this drag; a press that never
 * travelled beyond CANCEL_R is a tap and never shoots.
 */
export function aimFromDrag(bx, by, fx, fy, maxDragged = Infinity) {
  const dx = bx - fx; const dy = by - fy;
  const d = Math.hypot(dx, dy);
  if (d < CANCEL_R || maxDragged < CANCEL_R) return { angle: 0, power: 0, cancelled: true };
  const power = Math.min(1, Math.max(MIN_POWER, (d - CANCEL_R) / (FULL_DRAG - CANCEL_R)));
  return { angle: Math.atan2(dy, dx), power, cancelled: false };
}

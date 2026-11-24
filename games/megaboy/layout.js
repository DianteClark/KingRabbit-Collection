// Landscape layout for play (640 x 360 logical pixels). The stage fills the whole screen at 3x
// with its floor at screen y 240, so the controls sit over the floor in the bottom corners and
// everything standing on the floor stays in view. Bars and small buttons are in the top corners;
// the weapon button sits low in the middle, over the floor.
// Plain numbers so tests can check that everything fits, nothing overlaps and hit areas are big.

export const SCREEN = { W: 640, H: 360 };
export const PAUSE_BTN = { x: 30, y: 26, w: 48, h: 40 };
export const HELP_BTN = { x: 610, y: 26, w: 48, h: 40 };
// d-pad: a cross drawn here; any touch in the lower-left zone steers by its angle from the centre
export const DPAD = { x: 94, y: 296, r: 58 };
export const DPAD_ZONE = { x0: 0, x1: 250, y0: 150, y1: 360 };
export const SHOOT = { x: 494, y: 314, r: 38 };
export const JUMP = { x: 588, y: 286, r: 42 };
export const SWAP = { x: 380, y: 330, w: 96, h: 42 };
// HUD bars (top-left, next to the pause button) and the boss bar (top-right, under help)
export const BARS = { x: 62, y: 8, w: 9, gap: 4, h: 88 };
export const BOSS_BAR = { x: 619, y: 56, w: 9, h: 88 };
export const SLACK = { shoot: 6, jump: 6, swap: 4 };

export const hitShoot = (x, y) => Math.hypot(x - SHOOT.x, y - SHOOT.y) < SHOOT.r + SLACK.shoot;
export const hitJump = (x, y) => Math.hypot(x - JUMP.x, y - JUMP.y) < JUMP.r + SLACK.jump;
export const hitSwap = (x, y) => Math.abs(x - SWAP.x) < SWAP.w / 2 + SLACK.swap && Math.abs(y - SWAP.y) < SWAP.h / 2 + SLACK.swap;
export const inDpadZone = (x, y) => x >= DPAD_ZONE.x0 && x < DPAD_ZONE.x1 && y >= DPAD_ZONE.y0 && y <= DPAD_ZONE.y1;

/** Direction for a thumb at (x, y): a dead spot in the middle, diagonals allowed. */
export function dpadDir(x, y) {
  const dx = x - DPAD.x; const dy = y - DPAD.y;
  const out = { l: false, r: false, u: false, d: false };
  if (Math.hypot(dx, dy) < 10) return out;
  if (Math.abs(dx) > 10 && Math.abs(dx) >= Math.abs(dy) * 0.45) { out.l = dx < 0; out.r = dx > 0; }
  if (Math.abs(dy) > 14 && Math.abs(dy) >= Math.abs(dx) * 0.7) { out.u = dy < 0; out.d = dy > 0; }
  return out;
}

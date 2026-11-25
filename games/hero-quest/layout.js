// Screen layout for landscape play (640 x 360 logical pixels). Plain numbers so tests can check
// that everything fits and nothing overlaps.
//
// Rooms are wide (17 x 11 tiles). At a crisp 2x the room is 544 x 352, nearly the whole screen.
// The side margins are slim (48 px): the HUD lives there, and the stick and buttons reach just
// over the room's outer wall/tree column, never over the part you play in.
import { ROOM_W, ROOM_H, TILE } from './logic/constants.js';

export const SCREEN = { W: 640, H: 360 };
export const ZOOM = 2;
export const VIEW = { x: (SCREEN.W - ROOM_W * ZOOM) / 2, y: (SCREEN.H - ROOM_H * ZOOM) / 2, w: ROOM_W * ZOOM, h: ROOM_H * ZOOM };
const HALF_VIEW_H = VIEW.h / ZOOM / 2;
/** Camera centre y (world px). The whole room fits now, so this is the room's middle. */
export const camY = (py) => Math.max(HALF_VIEW_H, Math.min(ROOM_H - HALF_VIEW_H, py));

export const LEFT = VIEW.x;                // 48: left margin (pause, hearts, gems, keys)
export const RIGHT = VIEW.x + VIEW.w;      // 592: right margin (help)
export const MID = (LEFT + RIGHT) / 2;
/** Screen x range of the room's playable inside (everything but the outer wall column). */
export const INNER = { x0: LEFT + TILE * ZOOM, x1: RIGHT - TILE * ZOOM };
export const PAUSE_BTN = { x: 24, y: 22, w: 40, h: 36 };
export const HELP_BTN = { x: SCREEN.W - 24, y: 22, w: 40, h: 36 };
export const STICK = { x: 44, y: 300, r: 36, knob: 16 };
export const SWORD = { x: 600, y: 300, r: 36 };
export const ITEMB = { x: 612, y: 222, r: 26 };
export const SWAP = { x: 612, y: 170, w: 52, h: 26 };
/** The floating stick starts anywhere on the left half (margin or room), away from the buttons. */
export const stickZone = (x, y) => x < MID && !(y < 48 && x < 52);

// Touch hit areas: a little bigger than what's drawn, but never overlapping each other.
export const SLACK = { sword: 10, item: 4, swap: 4 };
export const hitSword = (x, y) => Math.hypot(x - SWORD.x, y - SWORD.y) < SWORD.r + SLACK.sword;
export const hitItem = (x, y) => Math.hypot(x - ITEMB.x, y - ITEMB.y) < ITEMB.r + SLACK.item;
export const hitSwap = (x, y) => Math.abs(x - SWAP.x) < SWAP.w / 2 + SLACK.swap && Math.abs(y - SWAP.y) < SWAP.h / 2 + SLACK.swap;

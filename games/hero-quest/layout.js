// Screen layout for landscape play (640 x 360 logical pixels). Plain numbers so tests can check
// that everything fits and nothing overlaps.
import { ROOM_W, ROOM_H } from './logic/constants.js';

export const SCREEN = { W: 640, H: 360 };
export const ZOOM = 2;
// The room sits in the middle at a crisp 2x, the full screen height. At 2x it is 416 px tall,
// so the camera follows the player up and down by up to 28 px.
export const VIEW = { x: (SCREEN.W - ROOM_W * ZOOM) / 2, y: 0, w: ROOM_W * ZOOM, h: SCREEN.H };
const HALF_VIEW_H = VIEW.h / ZOOM / 2;
/** Camera centre y (world px) for a player at py: follow, never past the room's top or bottom. */
export const camY = (py) => Math.max(HALF_VIEW_H, Math.min(ROOM_H - HALF_VIEW_H, py));

export const LEFT = VIEW.x;                // 144: left margin (pause, hearts, gems, keys, stick)
export const RIGHT = VIEW.x + VIEW.w;      // 496: right margin (help, SWAP, ITEM, SWORD)
export const MID = (LEFT + RIGHT) / 2;
export const PAUSE_BTN = { x: 30, y: 24, w: 44, h: 36 };
export const HELP_BTN = { x: SCREEN.W - 30, y: 24, w: 44, h: 36 };
export const STICK = { x: 72, y: 276, r: 44, knob: 20 };
export const SWORD = { x: 576, y: 286, r: 44 };
export const ITEMB = { x: 586, y: 184, r: 32 };
export const SWAP = { x: 586, y: 126, w: 72, h: 30 };
/** The floating stick starts anywhere on the left half (margin or room), away from the buttons. */
export const stickZone = (x, y) => x < MID && !(y < 48 && x < 60);

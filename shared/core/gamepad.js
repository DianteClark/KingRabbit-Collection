// Bluetooth / USB controller support for every game (standard-mapping gamepads: Xbox,
// PlayStation, Switch Pro, 8BitDo, Backbone...). Phones expose them through the browser's
// Gamepad API once a button is pressed.
//
// In a game's update loop:
//   import { pad } from '../../shared/core/gamepad.js';
//   const p = pad();            // poll once per frame
//   if (p.connected) {
//     p.x, p.y                  // stick or d-pad, -1..1 (dead zone applied)
//     p.left / p.right / p.up / p.down   // booleans (d-pad or stick past halfway)
//     p.a / p.b / p.x2 / p.y2 / p.start / p.select / p.l / p.r   // held
//     p.pressed('a')            // true only on the frame it went down
//   }
// Button names follow the Nintendo-style layout positions: a = bottom face button
// (Xbox A / PlayStation Cross), b = right (B / Circle), x2 = left (X / Square), y2 = top (Y / Triangle).

const NAMES = { a: 0, b: 1, x2: 2, y2: 3, l: 4, r: 5, lt: 6, rt: 7, select: 8, start: 9, up: 12, down: 13, left: 14, right: 15 };
const DEAD = 0.25;
let prev = {};
let lastFrame = -1;
let cached = null;
const listeners = new Set();

/** Called with (connected: boolean) whenever a controller connects or disconnects. */
export function onPadChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
if (typeof window !== 'undefined') {
  window.addEventListener('gamepadconnected', () => listeners.forEach((f) => f(true)));
  window.addEventListener('gamepaddisconnected', () => listeners.forEach((f) => f(!!firstPad())));
}

function firstPad() {
  const list = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  for (const g of list) if (g && g.connected) return g;
  return null;
}

const axis = (v) => (Math.abs(v) < DEAD ? 0 : v);

/** Current controller state (cheap to call several times per frame). */
export function pad() {
  const frame = typeof performance !== 'undefined' ? Math.floor(performance.now() / 8) : 0;
  if (cached && frame === lastFrame) return cached;
  lastFrame = frame;
  const g = firstPad();
  if (!g) { cached = { connected: false, x: 0, y: 0, pressed: () => false }; prev = {}; return cached; }
  const held = {};
  for (const [name, i] of Object.entries(NAMES)) held[name] = !!g.buttons[i]?.pressed;
  let x = axis(g.axes[0] || 0); let y = axis(g.axes[1] || 0);
  if (held.left) x = -1; else if (held.right) x = 1;
  if (held.up) y = -1; else if (held.down) y = 1;
  const state = {
    connected: true, id: g.id, x, y,
    left: x < -0.5, right: x > 0.5, up: y < -0.5, down: y > 0.5,
    ...held,
  };
  const before = prev;
  state.pressed = (name) => !!state[name] && !before[name];
  prev = { ...state };
  cached = state;
  return state;
}

/** True if a controller is connected right now. */
export const padConnected = () => !!firstPad();

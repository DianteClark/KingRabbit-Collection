// Hollow Crown landscape layout: the room, HUD and touch controls fit the 640x360 screen,
// don't overlap each other, and the camera keeps the player and the room in view.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const L = await import(new URL('../games/hero-quest/layout.js', import.meta.url).href);
const C = await import(new URL('../games/hero-quest/logic/constants.js', import.meta.url).href);

const circleBox = (c) => ({ x0: c.x - c.r, x1: c.x + c.r, y0: c.y - c.r, y1: c.y + c.r });
const rectBox = (r) => ({ x0: r.x - r.w / 2, x1: r.x + r.w / 2, y0: r.y - r.h / 2, y1: r.y + r.h / 2 });
const inside = (b) => b.x0 >= 0 && b.y0 >= 0 && b.x1 <= L.SCREEN.W && b.y1 <= L.SCREEN.H;
const overlaps = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

test('the screen is 640x360 (shared LANDSCAPE size) and the room fills its full height at a crisp 2x', () => {
  assert.deepEqual(L.SCREEN, { W: 640, H: 360 });
  assert.equal(L.VIEW.w, C.ROOM_W * L.ZOOM);
  assert.equal(L.VIEW.h, L.SCREEN.H);
  assert.equal(L.VIEW.x, (L.SCREEN.W - L.VIEW.w) / 2, 'centred');
  assert.ok(Number.isInteger(L.ZOOM));
});

test('controls and HUD buttons sit in the side margins, on screen, and apart', () => {
  const controls = { stick: circleBox(L.STICK), sword: circleBox(L.SWORD), item: circleBox(L.ITEMB), swap: rectBox(L.SWAP), pause: rectBox(L.PAUSE_BTN), help: rectBox(L.HELP_BTN) };
  for (const [name, b] of Object.entries(controls)) {
    assert.ok(inside(b), `${name} on screen`);
    assert.ok(b.x1 <= L.LEFT || b.x0 >= L.RIGHT, `${name} stays out of the room`);
  }
  const names = Object.keys(controls);
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    assert.ok(!overlaps(controls[names[i]], controls[names[j]]), `${names[i]} and ${names[j]} overlap`);
  }
  // thumb reach: the action buttons are in the lower part of the right margin, the stick low on the left
  assert.ok(L.SWORD.y > L.SCREEN.H * 0.6 && L.STICK.y > L.SCREEN.H * 0.6);
  assert.ok(L.SWORD.r >= 40 && L.ITEMB.r >= 30, 'big enough to hit');
});

test('the stick starts on the left half, never on the pause button or the right-hand buttons', () => {
  assert.ok(L.stickZone(L.STICK.x, L.STICK.y));
  assert.ok(L.stickZone(L.LEFT + 40, 200), 'left part of the room works too');
  assert.ok(!L.stickZone(L.PAUSE_BTN.x, L.PAUSE_BTN.y));
  for (const c of [L.SWORD, L.ITEMB, L.SWAP]) assert.ok(!L.stickZone(c.x, c.y));
});

test('the camera follows vertically but never shows past the room', () => {
  const half = L.VIEW.h / L.ZOOM / 2;
  for (let py = -10; py <= C.ROOM_H + 10; py += 2) {
    const cy = L.camY(py);
    assert.ok(cy - half >= 0 && cy + half <= C.ROOM_H, `view ${cy - half}..${cy + half}`);
    const clamped = Math.max(0, Math.min(C.ROOM_H, py));
    assert.ok(clamped >= cy - half && clamped <= cy + half, `player at ${py} in view`);
  }
  // doors on the top and bottom edges are visible when you stand at them
  assert.equal(L.camY(8), half);
  assert.equal(L.camY(C.ROOM_H - 8), C.ROOM_H - half);
});

// Controller support for this game, on top of shared/core/gamepad.js. Identical copies live in
// each game that has controller support (tests/padkit.test.mjs keeps them in step).
//
//   installPad(game)            once at boot: polls the controller once per frame, tracks
//                               "controller mode", and runs the menu navigator (below)
//   down('a') / hit('a')        held / pressed this frame. rep('left') = pressed, then repeats
//   stick()                     { x, y } -1..1 (stick or d-pad)
//   usingPad() / onPadMode(fn)  controller mode: on when the controller is used, off on the next
//                               touch. Scenes hide their on-screen controls while it is on:
//   hideWhilePad(scene, objs)   setVisible(false) on objs in controller mode, back on a touch
//
// Menu navigator: on every screen the d-pad moves a gold frame over the tappable things (the
// shared UI buttons, and other objects with tap handlers), A taps it, B taps the screen's back /
// cancel button. DOM sheets (How to play, game panels) work the same way with their <button>s.
// A scene can tune it with properties:
//   scene.padNav = 'off'        no navigator (the scene reads the controller itself)
//   scene.padNav = 'modal'      only inside popups (layers with a full-screen dim behind them)
//   scene.padBack = fn          what B does (default: tap a '<' / Back / Cancel button)
//   scene.padStart = fn         what Start does
//   scene.padAfterPress = fn    called after A taps an object (scenes that finish taps on scene pointerup)
//   obj.padSkip = true          never select this object; obj.padTarget = true: always selectable;
//   obj.padFirst = true         start the frame here
import { pad } from '../../shared/core/gamepad.js';

const NAMES = ['a', 'b', 'x2', 'y2', 'l', 'r', 'start', 'select', 'up', 'down', 'left', 'right'];
let held = {};
let prev = {};
const since = {};
let now = 0;
let last = 0;
let xy = { x: 0, y: 0 };
let mode = false;
const modeFns = new Set();
const eaten = new Set(); // buttons the menu navigator used this frame (the game doesn't see them)

function poll(t) {
  const p = pad();
  last = now; now = t;
  prev = held; held = {};
  eaten.clear();
  xy = { x: p.connected ? p.x : 0, y: p.connected ? p.y : 0 };
  if (p.connected) for (const n of NAMES) held[n] = !!p[n];
  for (const n of NAMES) if (held[n] && !prev[n]) since[n] = t;
  if (p.connected && (NAMES.some((n) => held[n]) || Math.abs(p.x) > 0.5 || Math.abs(p.y) > 0.5)) setMode(true);
}

export const down = (n) => !!held[n];
export const hit = (n) => !!held[n] && !prev[n] && !eaten.has(n);
/** Pressed this frame, then again every `every` ms once held for `delay` ms. */
export function rep(n, delay = 300, every = 110) {
  if (!held[n] || eaten.has(n)) return false;
  if (!prev[n]) return true;
  const a = last - since[n] - delay; const b = now - since[n] - delay;
  return b >= 0 && Math.floor(b / every) !== Math.floor(a / every);
}
export const stick = () => xy;
export const usingPad = () => mode;
export function onPadMode(fn) { modeFns.add(fn); return () => modeFns.delete(fn); }
function setMode(on) {
  if (mode === on) return;
  mode = on;
  document.body.classList.toggle('pad-mode', on);
  modeFns.forEach((f) => f(on));
}

/** Hide on-screen touch controls while the controller is in use (back on the next touch). */
export function hideWhilePad(scene, objs) {
  const list = [objs].flat().filter(Boolean);
  const apply = (on) => list.forEach((o) => { if (o.scene) o.setVisible(!on); });
  apply(mode);
  const off = onPadMode(apply);
  scene.events.once('shutdown', off);
  scene.events.once('destroy', off);
  return off;
}

let installed = false;
export function installPad(game) {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  for (const t of ['pointerdown', 'touchstart']) window.addEventListener(t, (e) => { if (e.isTrusted !== false) setMode(false); }, { capture: true, passive: true });
  const style = document.createElement('style');
  style.textContent = '.pad-focus{outline:3px solid #e3d245!important;outline-offset:2px}';
  document.head.appendChild(style);
  game.events.on('prestep', () => { poll(performance.now()); navigate(game); });
  // For browser tests: what the menu frame can pick and what it is on.
  window.__padkit = { list: () => (cache || []).map((c) => ({ scene: c.scene.scene.key, label: String(c.label), x: Math.round(c.cx), y: Math.round(c.cy), depth: c.depth })), sel: () => (sel?.el ? sel.el.textContent : sel?.obj ? String(sel.obj.label?.text ?? sel.obj.text ?? sel.obj.type) : null), mode: () => mode };
}

// ------------------------------------------------------------------ menu navigator

const DOM_SHEETS = '#howto, [data-pad-sheet], [role=dialog]';
const BACK_RE = /^(<|< ?back|back|cancel|close|no\b.*|not now|keep (playing|trying)|stay|resume|ok|got it|x|menu|main menu)$/i;
let sel = null;        // { scene, obj } or { el }
let frame = null;

function openSheet() {
  const all = [...document.querySelectorAll(DOM_SHEETS)].filter((el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed');
  return all[all.length - 1] || null;
}

function navigate(game) {
  const sheet = openSheet();
  if (sheet) { clearFrame(); domNav(sheet); return; }
  if (sel?.el) { sel.el.classList.remove('pad-focus'); sel = null; }
  if (!mode) { clearFrame(); return; }
  const active = game.scene.getScenes(true).filter((s) => s.sys.isActive());
  const top = active[active.length - 1];
  if (top?.padStart && hit('start')) { eaten.add('start'); top.padStart(); }
  // Finding the tappable objects walks the scenes, so only do it every few frames or on a key.
  const keys = ['a', 'b', 'up', 'down', 'left', 'right'].some((n) => rep(n));
  if (keys || !cache || ++tick % 6 === 0) cache = candidates(active.filter((s) => s.padNav !== 'off'));
  const cands = cache.filter((c) => c.obj.scene && c.obj.active !== false);
  if (!cands.length) { clearFrame(); return; }
  let cur = sel && cands.find((c) => c.obj === sel.obj);
  if (!cur) cur = pickDefault(cands);
  for (const [dir, dx, dy] of [['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]]) {
    if (rep(dir)) { eaten.add(dir); cur = nearest(cands, cur, dx, dy) || cur; break; }
  }
  sel = { scene: cur.scene, obj: cur.obj };
  drawFrame(cur);
  if (hit('a')) { eaten.add('a'); cache = null; press(cur); } else if (hit('b')) { eaten.add('b'); cache = null; back(cur.scene, cands); }
}
let cache = null;
let tick = 0;

function candidates(scenes) {
  const out = [];
  let modalScene = null; let modalDepth = -Infinity;
  for (const scene of scenes) {
    if (!scene.input?.enabled) continue;
    const cam = scene.cameras.main;
    const list = [];
    let popup = -Infinity; // depth of the top-most popup (a layer with a full-screen tap blocker)
    const walk = (o, root) => {
      if (!o.visible || o.alpha < 0.05 || o.padSkip || o === frame) return;
      if (o.list) o.list.forEach((k) => walk(k, root));
      const tappable = o.padTarget || (o.input?.enabled && (o.listenerCount('pointerup') || o.listenerCount('pointerdown')));
      const blocker = o.input?.enabled && !o.list;
      if (!tappable && !blocker) return;
      let a = o.alpha; for (let p = o.parentContainer; p; p = p.parentContainer) { if (!p.visible) return; a *= p.alpha; }
      const b = o.getBounds();
      if (b.width >= cam.width * 0.9 && b.height >= cam.height * 0.6) {
        // A backdrop: when it only blocks taps (a popup's dim layer) it marks a popup.
        if (!tappable || root !== o) popup = Math.max(popup, root.depth);
        return;
      }
      if (!tappable || b.width < 4 || b.height < 4) return;
      if (a < 0.5 && !o.padTarget) return; // a disabled (dimmed) button
      const sf = (root.scrollFactorX ?? 1);
      const cx = b.centerX - cam.scrollX * sf; const cy = b.centerY - cam.scrollY * sf;
      if (cx < 0 || cy < 0 || cx > cam.width / cam.zoom + 1 || cy > cam.height / cam.zoom + 1) return;
      list.push({ scene, obj: o, b, sf, depth: root.depth, cx, cy, label: o.label?.text ?? o.text ?? '' });
    };
    scene.children.list.forEach((o) => walk(o, o));
    const floor = popup > -Infinity ? popup : scene.padNav === 'modal' ? Infinity : -Infinity;
    const mine = list.filter((c) => c.depth >= floor && c.depth >= (scene.padModalDepth ?? -Infinity));
    if (popup > -Infinity) { modalScene = scene; modalDepth = popup; out.length = 0; }
    if (modalScene && modalScene !== scene && popup === -Infinity) continue; // a popup lower down still wins over plain screens above
    out.push(...mine);
    void modalDepth;
  }
  return out;
}

const GOLD = 0xe3d245;
function pickDefault(cands) {
  const first = cands.find((c) => c.obj.padFirst);
  if (first) return first;
  const plain = cands.filter((c) => !BACK_RE.test(String(c.label).trim()) && String(c.label).trim() !== '?');
  // A gold button is the screen's main action (a gold Resume on a pause menu counts too).
  const gold = cands.filter((c) => c.obj.body?.fillColor === GOLD && !/^(\?|<)$/.test(String(c.label).trim()));
  const pool = gold.length ? gold : plain;
  const list = pool.length ? pool : cands;
  return [...list].sort((p, q) => (p.cy - q.cy) || (p.cx - q.cx))[0];
}

function nearest(cands, cur, dx, dy) {
  let best = null; let score = Infinity;
  for (const c of cands) {
    if (c === cur) continue;
    const ox = c.cx - cur.cx; const oy = c.cy - cur.cy;
    const along = ox * dx + oy * dy;
    if (along <= 4) continue;
    const across = Math.abs(dx ? oy : ox);
    const s = along + across * 2.5;
    if (s < score) { score = s; best = c; }
  }
  return best;
}

function fakePointer(c) {
  const x = c.cx; const y = c.cy;
  const wx = c.b.centerX; const wy = c.b.centerY;
  return {
    id: 99, x, y, worldX: wx, worldY: wy, downX: x, downY: y, upX: x, upY: y, position: { x, y }, prevPosition: { x, y },
    isDown: true, primaryDown: true, wasTouch: false, button: 0, buttons: 1, event: {}, camera: c.scene.cameras.main,
    getDistance: () => 0, getDuration: () => 50, leftButtonDown: () => true, leftButtonReleased: () => true, rightButtonDown: () => false,
    positionToCamera: () => ({ x: wx, y: wy }),
  };
}

function press(c) {
  const p = fakePointer(c);
  const local = [c.b.width / 2, c.b.height / 2];
  const ev = { stopPropagation() {} };
  c.obj.emit('pointerdown', p, ...local, ev);
  p.isDown = false; p.primaryDown = false;
  c.obj.emit('pointerup', p, ...local, ev);
  c.scene.padAfterPress?.(c.obj, p); // for scenes that finish a tap in a scene-wide pointerup
}

function back(scene, cands) {
  if (scene.padBack) { scene.padBack(); return; }
  // The top-most matching button: a header's back button beats a '<' arrow further down.
  const b = cands.filter((c) => BACK_RE.test(String(c.label).trim())).sort((p, q) => (p.cy - q.cy) || (p.cx - q.cx))[0];
  if (b) press(b);
}

function drawFrame(c) {
  const scene = c.scene;
  if (!frame || frame.scene !== scene || !frame.active) {
    frame?.destroy?.();
    frame = scene.add.graphics().setDepth(1e6);
  }
  const pad2 = 3;
  frame.clear().lineStyle(3, GOLD, 1).strokeRect(c.b.x - pad2, c.b.y - pad2, c.b.width + pad2 * 2, c.b.height + pad2 * 2);
  frame.setScrollFactor(c.sf);
  frame.setVisible(true);
  scene.children.bringToTop(frame);
}

function clearFrame() { if (frame?.active) frame.setVisible(false); }

// DOM sheets: d-pad moves focus over the sheet's buttons (or scrolls it), A clicks, B closes.
function domNav(sheet) {
  const btns = [...sheet.querySelectorAll('button:not([disabled]), [data-pad]')].filter((b) => b.offsetParent !== null);
  if (!btns.length) return;
  let cur = sel?.el && btns.includes(sel.el) ? sel.el : null;
  if (!cur) {
    // The sheet's main action: its last gold button (usually in the footer), else its last button.
    cur = [...btns].reverse().find((b) => /gold|primary/.test(b.className)) || btns[btns.length - 1];
    sel?.el?.classList.remove('pad-focus');
  }
  const scroll = sheet.querySelector('.scroll, .sheet-body, .pp-scroll, .sd-scroll, .al-scroll, [data-pad-scroll]');
  for (const [dir, dx, dy] of [['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]]) {
    if (!rep(dir)) continue;
    eaten.add(dir);
    const r0 = cur.getBoundingClientRect();
    let best = null; let score = Infinity;
    for (const b of btns) {
      if (b === cur) continue;
      const r = b.getBoundingClientRect();
      const ox = (r.left + r.right) / 2 - (r0.left + r0.right) / 2; const oy = (r.top + r.bottom) / 2 - (r0.top + r0.bottom) / 2;
      const along = ox * dx + oy * dy;
      if (along <= 4) continue;
      const s = along + Math.abs(dx ? oy : ox) * 2.5;
      if (s < score) { score = s; best = b; }
    }
    if (best) cur = best;
    else if (scroll && dy) scroll.scrollBy({ top: dy * 80 });
  }
  if (sel?.el !== cur) sel?.el?.classList.remove('pad-focus');
  sel = { el: cur };
  if (mode) { cur.classList.add('pad-focus'); cur.scrollIntoView?.({ block: 'nearest' }); } else cur.classList.remove('pad-focus');
  if (hit('a')) { eaten.add('a'); cur.click(); } else if (hit('b')) {
    eaten.add('b');
    const b = [...btns].reverse().find((x) => BACK_RE.test(x.textContent.trim()) || /back|close|^x$/i.test(x.getAttribute('aria-label') || ''));
    (b || btns[btns.length - 1]).click();
  }
}

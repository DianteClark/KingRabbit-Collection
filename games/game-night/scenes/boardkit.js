// Shared bits for the grid board games (Checkers, Chess, Go).
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text } from '../../../shared/core/ui.js';
import { modal, go } from './common.js';
import { record } from '../save.js';

/** Draw a framed checkerboard. Returns { cell, left, top, center(i), indexAt(x,y) }. */
export function checkerboard(scene, { left, top, size = 8, cell = 40, light = PALETTE.cream, dark = PALETTE.lavender, frame = PALETTE.indigo, labels = false }) {
  const g = scene.add.graphics();
  const w = size * cell;
  g.fillStyle(hex(PALETTE.ink)).fillRect(left - 10, top - 10, w + 20, w + 20);
  g.fillStyle(hex(frame)).fillRect(left - 7, top - 7, w + 14, w + 14);
  g.fillStyle(hex(PALETTE.ink)).fillRect(left - 3, top - 3, w + 6, w + 6);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      g.fillStyle(hex((r + c) % 2 ? dark : light)).fillRect(left + c * cell, top + r * cell, cell, cell);
    }
  }
  if (labels) {
    for (let c = 0; c < size; c++) text(scene, left + c * cell + cell / 2, top - 20, 'ABCDEFGH'[c], { color: PALETTE.lavender });
    for (let r = 0; r < size; r++) text(scene, left - 18, top + r * cell + cell / 2, String(size - r), { color: PALETTE.lavender });
  }
  return grid(left, top, size, cell);
}

export function grid(left, top, size, cell) {
  return {
    left, top, size, cell,
    center: (i) => ({ x: left + (i % size) * cell + cell / 2, y: top + Math.floor(i / size) * cell + cell / 2 }),
    indexAt: (x, y) => {
      const c = Math.floor((x - left) / cell); const r = Math.floor((y - top) / cell);
      return c >= 0 && c < size && r >= 0 && r < size ? r * size + c : -1;
    },
  };
}

/** Highlights layer: selected square, move targets, last move. */
export function highlighter(scene, g) {
  const layer = scene.add.graphics().setDepth(5);
  const marks = scene.add.graphics().setDepth(15);
  return {
    clear() { layer.clear(); marks.clear(); },
    last(from, to) {
      layer.fillStyle(hex(PALETTE.gold), 0.35);
      for (const i of [from, to]) { const { x, y } = g.center(i); layer.fillRect(x - g.cell / 2, y - g.cell / 2, g.cell, g.cell); }
    },
    selected(i) {
      const { x, y } = g.center(i);
      layer.fillStyle(hex(PALETTE.gold), 0.75).fillRect(x - g.cell / 2, y - g.cell / 2, g.cell, g.cell);
    },
    target(i, capture) {
      const { x, y } = g.center(i);
      if (capture) {
        marks.lineStyle(3, hex(PALETTE.red)).strokeRect(x - g.cell / 2 + 2, y - g.cell / 2 + 2, g.cell - 4, g.cell - 4);
      } else {
        marks.fillStyle(hex(PALETTE.ink), 0.6).fillRect(x - 5, y - 5, 10, 10);
        marks.fillStyle(hex(PALETTE.gold)).fillRect(x - 3, y - 3, 6, 6);
      }
    },
  };
}

/** Standard end-of-game popup + record keeping. outcome from the human's view: 'w'|'d'|'l' (cpu mode). */
export function endGame(scene, { id, mode, title, lines = [], outcome, onAgain, margin }) {
  if (mode === 'cpu' && outcome) record(id, outcome, margin);
  scene.time.delayedCall(700, () => {
    const m = modal(scene, title, lines, [
      ['Play again', () => { m.destroy(); onAgain(); }],
      ['Menu', () => go(scene, 'Menu')],
    ]);
  });
}

/** Run `fn` after a short pause so "thinking..." text gets drawn before heavy CPU work. */
export function think(scene, fn, delay = 350) {
  scene.time.delayedCall(delay, () => requestAnimationFrame(() => fn()));
}

// Drawing ships: the outer hull around the room grid, room floors and system icons.
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { ART } from '../frames.js';

export const HULL_COLORS = {
  player: { hull: 0x8a8fc4, dark: 0x47416b, floor: 0x2b2640, line: 0x040303 },
  enemy: { hull: 0xa13d3b, dark: 0x4e282e, floor: 0x2e2226, line: 0x040303 },
  automata: { hull: 0x6c8c50, dark: 0x34452a, floor: 0x222a1e, line: 0x040303 },
  hegemony: { hull: 0x9a407e, dark: 0x4e2846, floor: 0x2a1e28, line: 0x040303 },
};

export function colorsFor(ship, side) {
  if (side === 'player') return HULL_COLORS.player;
  if (ship.faction === 'Automata') return HULL_COLORS.automata;
  if (ship.faction === 'Hegemony') return HULL_COLORS.hegemony;
  return HULL_COLORS.enemy;
}

/**
 * Outer hull: a rounded body around the rooms, a pointed nose and engine bells.
 * facing: 1 = nose to the right (player), -1 = nose to the left (enemy).
 */
export function drawHull(g, ship, x0, y0, cell, colors, facing = 1) {
  const w = ship.w * cell; const h = ship.h * cell;
  const m = Math.max(6, Math.round(cell * 0.35));
  const left = x0 - m; const top = y0 - m; const W = w + m * 2; const H = h + m * 2;
  g.fillStyle(colors.line);
  g.fillRoundedRect(left - 3, top - 3, W + 6, H + 6, 10);
  // Nose
  const noseX = facing > 0 ? left + W : left;
  const tip = noseX + facing * Math.round(H * 0.45);
  g.fillTriangle(noseX, top - 3, noseX, top + H + 3, tip + facing * 4, top + H / 2);
  g.fillStyle(colors.hull);
  g.fillRoundedRect(left, top, W, H, 8);
  g.fillTriangle(noseX - facing * 2, top, noseX - facing * 2, top + H, tip, top + H / 2);
  // Engine bells at the back
  const backX = facing > 0 ? left - 8 : left + W;
  g.fillStyle(colors.line);
  g.fillRect(backX - 1, top + H * 0.2 - 1, 10, H * 0.22 + 2);
  g.fillRect(backX - 1, top + H * 0.58 - 1, 10, H * 0.22 + 2);
  g.fillStyle(colors.dark);
  g.fillRect(backX, top + H * 0.2, 8, H * 0.22);
  g.fillRect(backX, top + H * 0.58, 8, H * 0.22);
  // Panel lines
  g.fillStyle(colors.dark, 0.6);
  for (let x = left + 10; x < left + W - 6; x += 18) g.fillRect(x, top + 2, 2, 3);
  for (let x = left + 10; x < left + W - 6; x += 18) g.fillRect(x, top + H - 5, 2, 3);
  return { left, top, W, H, backX, facing };
}

export const roomRect = (r, x0, y0, cell) => ({ x: x0 + r.x * cell, y: y0 + r.y * cell, w: r.w * cell, h: r.h * cell });

/** Static room floors and the doors between rooms. */
export function drawRooms(g, ship, x0, y0, cell, colors) {
  for (const r of ship.rooms) {
    const q = roomRect(r, x0, y0, cell);
    g.fillStyle(colors.line).fillRect(q.x, q.y, q.w, q.h);
    g.fillStyle(colors.floor).fillRect(q.x + 2, q.y + 2, q.w - 4, q.h - 4);
  }
  // Doors: a light gap in the shared wall.
  g.fillStyle(hex(PALETTE.sand), 0.9);
  for (let a = 0; a < ship.rooms.length; a++) {
    for (const b of ship.adj[a]) {
      if (b < a) continue;
      const A = ship.rooms[a]; const B = ship.rooms[b];
      if (A.x + A.w === B.x || B.x + B.w === A.x) {
        const x = x0 + (A.x + A.w === B.x ? B.x : A.x) * cell;
        const y1 = Math.max(A.y, B.y); const y2 = Math.min(A.y + A.h, B.y + B.h);
        const cy = y0 + ((y1 + y2) / 2) * cell;
        g.fillRect(x - 2, cy - 5, 4, 10);
      } else {
        const y = y0 + (A.y + A.h === B.y ? B.y : A.y) * cell;
        const x1 = Math.max(A.x, B.x); const x2 = Math.min(A.x + A.w, B.x + B.w);
        const cx = x0 + ((x1 + x2) / 2) * cell;
        g.fillRect(cx - 5, y - 2, 10, 4);
      }
    }
  }
}

/** System icon art for a room (or null). */
export const sysArt = (id) => ART[id] || null;

// Field of view (recursive shadowcasting) and line of sight on a w x h grid.
// opaque(x, y) says whether a cell blocks sight. Cells are indexed i = y * w + x.

const OCTANTS = [
  [1, 0, 0, 1], [0, 1, 1, 0], [0, -1, 1, 0], [-1, 0, 0, 1],
  [-1, 0, 0, -1], [0, -1, -1, 0], [0, 1, -1, 0], [1, 0, 0, -1],
];

/**
 * Every cell visible from (ox, oy) within radius (Euclidean). Opaque cells that are seen (walls)
 * are included. Calls visit(x, y, d2) once per visible cell (d2 = squared distance).
 */
export function fov(w, h, opaque, ox, oy, radius, visit) {
  const seen = new Set();
  const mark = (x, y) => {
    const i = y * w + x;
    if (seen.has(i)) return;
    seen.add(i);
    visit(x, y, (x - ox) ** 2 + (y - oy) ** 2);
  };
  mark(ox, oy);
  const r2 = (radius + 0.5) * (radius + 0.5);
  for (const [xx, xy, yx, yy] of OCTANTS) cast(1, 1.0, 0.0, xx, xy, yx, yy);

  function cast(row, start, end, xx, xy, yx, yy) {
    if (start < end) return;
    let newStart = 0;
    for (let j = row; j <= radius; j++) {
      let blocked = false;
      for (let dx = -j, dy = -j; dx <= 0; dx++) {
        const lSlope = (dx - 0.5) / (dy + 0.5);
        const rSlope = (dx + 0.5) / (dy - 0.5);
        if (start < rSlope) continue;
        if (end > lSlope) break;
        const x = ox + dx * xx + dy * xy;
        const y = oy + dx * yx + dy * yy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        if (dx * dx + dy * dy <= r2) mark(x, y);
        const op = opaque(x, y);
        if (blocked) {
          if (op) { newStart = rSlope; continue; }
          blocked = false;
          start = newStart;
        } else if (op && j < radius) {
          blocked = true;
          cast(j + 1, start, lSlope, xx, xy, yx, yy);
          newStart = rSlope;
        }
      }
      if (blocked) break;
    }
  }
  return seen;
}

/** Cells on a straight line from a to b (Bresenham), not including a, including b. */
export function line(x0, y0, x1, y1) {
  const out = [];
  const dx = Math.abs(x1 - x0); const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1; const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy; let x = x0; let y = y0;
  while (!(x === x1 && y === y1)) {
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
    out.push([x, y]);
  }
  return out;
}

/** True when nothing opaque stands strictly between a and b. Tries both line directions. */
export function los(opaque, x0, y0, x1, y1) {
  const clear = (pts) => {
    for (let k = 0; k < pts.length - 1; k++) if (opaque(pts[k][0], pts[k][1])) return false;
    return true;
  };
  if (clear(line(x0, y0, x1, y1))) return true;
  const back = line(x1, y1, x0, y0);
  return clear(back);
}

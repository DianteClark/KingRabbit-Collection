// Six Ball: a falling-gems match game (Columns-style). A stack of 3 gems falls into a 6x13 well.
// Cycle the order, move left/right, drop. 3+ in a row in any direction (incl. diagonals) clear;
// gems above fall and can chain. Six gem colours.

export const W = 6;
export const H = 13;
export const COLORS = 6;

export function newGame(rng = Math.random) {
  return {
    grid: new Array(W * H).fill(0),            // 0 empty, 1..6 gem
    piece: null,
    next: randomPiece(rng),
    score: 0, cleared: 0, level: 1, over: false, rng,
  };
}

export function randomPiece(rng) {
  return [1, 2, 3].map(() => 1 + Math.floor(rng() * COLORS));
}

/** Spawn the next piece at the top centre. piece = { x, y (row of the bottom gem), gems: [top, mid, bottom] } */
export function spawn(g) {
  const gems = g.next;
  g.next = randomPiece(g.rng);
  g.piece = { x: 2, y: 0, gems };
  if (g.grid[2] !== 0) { g.over = true; g.piece = null; }
  return g;
}

const cellFree = (g, x, y) => x >= 0 && x < W && y < H && (y < 0 || g.grid[y * W + x] === 0);

export function move(g, dx) {
  const p = g.piece;
  if (!p) return false;
  for (let k = 0; k < 3; k++) if (!cellFree(g, p.x + dx, p.y - k)) return false;
  p.x += dx;
  return true;
}

export function cycle(g) {
  if (!g.piece) return;
  const [a, b, c] = g.piece.gems;
  g.piece.gems = [c, a, b];
}

/** Move the piece down one row; returns false when it has landed (then call lock()). */
export function fall(g) {
  const p = g.piece;
  if (!p) return false;
  if (cellFree(g, p.x, p.y + 1)) { p.y++; return true; }
  return false;
}

export function hardDrop(g) {
  let n = 0;
  while (fall(g)) n++;
  return n;
}

/** Place the piece into the grid. Game over if any gem is above the top. */
export function lock(g) {
  const p = g.piece;
  for (let k = 0; k < 3; k++) {
    const y = p.y - (2 - k);
    if (y < 0) { g.over = true; continue; }
    g.grid[y * W + p.x] = p.gems[k];
  }
  g.piece = null;
}

/** Cells that are part of 3+ lines right now. */
export function findMatches(grid) {
  const hit = new Set();
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = grid[y * W + x];
      if (!v) continue;
      for (const [dx, dy] of dirs) {
        const run = [y * W + x];
        let cx = x + dx; let cy = y + dy;
        while (cx >= 0 && cx < W && cy >= 0 && cy < H && grid[cy * W + cx] === v) {
          run.push(cy * W + cx); cx += dx; cy += dy;
        }
        if (run.length >= 3) run.forEach((i) => hit.add(i));
      }
    }
  }
  return hit;
}

export function applyGravity(grid) {
  for (let x = 0; x < W; x++) {
    const col = [];
    for (let y = H - 1; y >= 0; y--) if (grid[y * W + x]) col.push(grid[y * W + x]);
    for (let y = H - 1, k = 0; y >= 0; y--, k++) grid[y * W + x] = col[k] || 0;
  }
}

/**
 * Resolve one round of matches. Returns the cleared cells (empty Set when stable).
 * chain = 1 for the first clear after a lock, 2 for the next, ... (multiplies points).
 */
export function resolveOnce(g, chain) {
  const hit = findMatches(g.grid);
  if (!hit.size) return hit;
  for (const i of hit) g.grid[i] = 0;
  g.score += hit.size * 10 * chain * g.level;
  g.cleared += hit.size;
  g.level = 1 + Math.floor(g.cleared / 30);
  applyGravity(g.grid);
  return hit;
}

/** Milliseconds per row at the current level. */
export const fallDelay = (level) => Math.max(110, 700 - (level - 1) * 60);

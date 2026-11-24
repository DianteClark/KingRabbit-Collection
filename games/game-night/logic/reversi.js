// Reversi (Othello) rules + CPU. Board: 64 cells, 0 empty, 1 dark, 2 light. Dark moves first.

export const SIZE = 8;
const DIRS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
export const other = (p) => 3 - p;

export function newBoard() {
  const b = new Array(64).fill(0);
  b[27] = 2; b[28] = 1; b[35] = 1; b[36] = 2;
  return b;
}

/** Discs that would flip if `player` plays at index i ([] = illegal). */
export function flipsFor(board, i, player) {
  if (board[i]) return [];
  const x0 = i % SIZE;
  const y0 = Math.floor(i / SIZE);
  const flips = [];
  for (const [dx, dy] of DIRS) {
    const run = [];
    let x = x0 + dx;
    let y = y0 + dy;
    while (x >= 0 && x < SIZE && y >= 0 && y < SIZE && board[y * SIZE + x] === other(player)) {
      run.push(y * SIZE + x);
      x += dx; y += dy;
    }
    if (run.length && x >= 0 && x < SIZE && y >= 0 && y < SIZE && board[y * SIZE + x] === player) flips.push(...run);
  }
  return flips;
}

export function legalMoves(board, player) {
  const moves = [];
  for (let i = 0; i < 64; i++) if (flipsFor(board, i, player).length) moves.push(i);
  return moves;
}

/** Returns a new board with the move applied, plus the flipped indexes. */
export function play(board, i, player) {
  const flips = flipsFor(board, i, player);
  if (!flips.length) return null;
  const next = board.slice();
  next[i] = player;
  for (const f of flips) next[f] = player;
  return { board: next, flips };
}

export function count(board) {
  let dark = 0; let light = 0;
  for (const c of board) { if (c === 1) dark++; else if (c === 2) light++; }
  return { dark, light };
}

export const isOver = (board) => !legalMoves(board, 1).length && !legalMoves(board, 2).length;

// Classic positional weights: corners are gold, squares next to corners are traps.
const WEIGHTS = [
  100, -20, 10, 5, 5, 10, -20, 100,
  -20, -50, -2, -2, -2, -2, -50, -20,
  10, -2, 1, 1, 1, 1, -2, 10,
  5, -2, 1, 0, 0, 1, -2, 5,
  5, -2, 1, 0, 0, 1, -2, 5,
  10, -2, 1, 1, 1, 1, -2, 10,
  -20, -50, -2, -2, -2, -2, -50, -20,
  100, -20, 10, 5, 5, 10, -20, 100,
];

const CORNERS = [0, 7, 56, 63];
// X-squares (diagonal to a corner) and C-squares (beside a corner) are only bad while that corner is empty.
const NEAR = { 0: [9, 1, 8], 7: [14, 6, 15], 56: [49, 57, 48], 63: [54, 62, 55] };

function evaluate(board, me) {
  const opp = other(me);
  const empties = board.filter((c) => !c).length;
  let s = 0;
  // Corners and the squares next to them.
  for (const c of CORNERS) {
    if (board[c] === me) s += 30; else if (board[c] === opp) s -= 30;
    else for (const [k, n] of NEAR[c].entries()) {
      const w = k === 0 ? 12 : 5;
      if (board[n] === me) s -= w; else if (board[n] === opp) s += w;
    }
  }
  // Mobility: having choices (and denying them) matters most in the middle game.
  const mm = legalMoves(board, me).length; const om = legalMoves(board, opp).length;
  s += 14 * (mm - om) / (mm + om + 1);
  // Frontier discs (touching an empty square) give the opponent moves.
  let front = 0;
  for (let i = 0; i < 64; i++) {
    if (!board[i]) continue;
    const r = i >> 3; const c = i & 7;
    let edge = false;
    for (let dr = -1; dr <= 1 && !edge; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr; const cc = c + dc;
      if ((dr || dc) && rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && !board[rr * 8 + cc]) { edge = true; break; }
    }
    if (edge) front += board[i] === me ? -1 : 1;
  }
  s += front * 1.5;
  // Disc count only matters near the end.
  if (empties < 16) { const { dark, light } = count(board); s += (me === 1 ? dark - light : light - dark) * (16 - empties) * 0.3; }
  return s;
}

function search(board, toMove, me, depth, alpha, beta) {
  if (depth === 0 || isOver(board)) {
    if (isOver(board)) {
      const { dark, light } = count(board);
      const diff = (me === 1 ? dark - light : light - dark);
      return diff * 1000;
    }
    return evaluate(board, me);
  }
  const moves = legalMoves(board, toMove);
  if (!moves.length) return search(board, other(toMove), me, depth - 1, alpha, beta);
  if (toMove === me) {
    let v = -Infinity;
    for (const m of moves) {
      v = Math.max(v, search(play(board, m, toMove).board, other(toMove), me, depth - 1, alpha, beta));
      alpha = Math.max(alpha, v);
      if (alpha >= beta) break;
    }
    return v;
  }
  let v = Infinity;
  for (const m of moves) {
    v = Math.min(v, search(play(board, m, toMove).board, other(toMove), me, depth - 1, alpha, beta));
    beta = Math.min(beta, v);
    if (alpha >= beta) break;
  }
  return v;
}

/** CPU move for `me` with a short look-ahead. Returns -1 if it must pass. */
export const LEVELS = { easy: { depth: 1, noise: 60 }, normal: { depth: 2, noise: 8 }, hard: { depth: 4, noise: 0, endgame: 9 } };

export function cpuMove(board, me, { depth, level = 'normal', rng = Math.random } = {}) {
  const cfg = LEVELS[level];
  depth ??= cfg.depth;
  const empties = board.filter((c) => !c).length;
  if (cfg.endgame && empties <= cfg.endgame) depth = empties;   // play the ending perfectly
  const noise = depth === empties ? 0 : cfg.noise;
  const moves = legalMoves(board, me);
  if (!moves.length) return -1;
  let best = -Infinity;
  let picks = [];
  for (const m of moves) {
    const s = search(play(board, m, me).board, other(me), me, depth - 1, -Infinity, Infinity) + rng() * noise;
    if (s > best) { best = s; picks = [m]; } else if (s === best) picks.push(m);
  }
  return picks[Math.floor(rng() * picks.length)];
}

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

function evaluate(board, me) {
  let s = 0;
  for (let i = 0; i < 64; i++) {
    if (board[i] === me) s += WEIGHTS[i];
    else if (board[i] === other(me)) s -= WEIGHTS[i];
  }
  // Mobility: having more options than the opponent is good.
  s += 5 * (legalMoves(board, me).length - legalMoves(board, other(me)).length);
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
export function cpuMove(board, me, { depth = 3, rng = Math.random } = {}) {
  const moves = legalMoves(board, me);
  if (!moves.length) return -1;
  let best = -Infinity;
  let picks = [];
  for (const m of moves) {
    const s = search(play(board, m, me).board, other(me), me, depth - 1, -Infinity, Infinity);
    if (s > best) { best = s; picks = [m]; } else if (s === best) picks.push(m);
  }
  return picks[Math.floor(rng() * picks.length)];
}

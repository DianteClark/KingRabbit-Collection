// Tic-Tac-Toe rules + CPU. Board is an array of 9: 'X' | 'O' | null.

export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

/** -> { winner: 'X'|'O', line } | { winner: 'draw' } | null (game continues) */
export function result(board) {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return { winner: board[a], line };
  }
  return board.every(Boolean) ? { winner: 'draw' } : null;
}

function minimax(board, turn, me, depth) {
  const r = result(board);
  if (r) return r.winner === 'draw' ? 0 : (r.winner === me ? 10 - depth : depth - 10);
  const scores = [];
  for (let i = 0; i < 9; i++) {
    if (board[i]) continue;
    board[i] = turn;
    scores.push(minimax(board, turn === 'X' ? 'O' : 'X', me, depth + 1));
    board[i] = null;
  }
  return turn === me ? Math.max(...scores) : Math.min(...scores);
}

/**
 * Pick the CPU's move. `mistakeChance` makes it beatable: that share of the time
 * it plays a random free square instead of a perfect one.
 */
export function cpuMove(board, me, { mistakeChance = 0.2, rng = Math.random } = {}) {
  const free = board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  if (!free.length) return -1;
  if (rng() < mistakeChance) return free[Math.floor(rng() * free.length)];
  let best = -Infinity;
  let moves = [];
  for (const i of free) {
    const b = board.slice();
    b[i] = me;
    const s = minimax(b, me === 'X' ? 'O' : 'X', me, 1);
    if (s > best) { best = s; moves = [i]; } else if (s === best) moves.push(i);
  }
  return moves[Math.floor(rng() * moves.length)];
}

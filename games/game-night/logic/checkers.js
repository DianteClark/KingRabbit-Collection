// Checkers (American / English draughts) rules + CPU.
// Board: 64 squares (row 0 at top). Pieces: 'd' dark man, 'D' dark king, 'l' light man, 'L' light king.
// Dark sits at the bottom and moves first (up the board). Captures are mandatory and
// multi-jumps must be completed. A man reaching the far row is crowned and the turn ends.

export const side = (p) => (p ? p.toLowerCase() : null);
export const other = (s) => (s === 'd' ? 'l' : 'd');
const isKing = (p) => p === 'D' || p === 'L';
const rc = (i) => [i >> 3, i & 7];
const on = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

export function newBoard() {
  const b = new Array(64).fill(null);
  for (let i = 0; i < 64; i++) {
    const [r, c] = rc(i);
    if ((r + c) % 2 === 1) {
      if (r < 3) b[i] = 'l';
      else if (r > 4) b[i] = 'd';
    }
  }
  return b;
}

const dirsFor = (p) => {
  if (isKing(p)) return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  return side(p) === 'd' ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
};

// All jump sequences starting from `from`. Each: { from, to, path: [squares], captured: [squares] }
function jumpsFrom(board, from, piece, path, captured, out) {
  const [r, c] = rc(from);
  let extended = false;
  for (const [dr, dc] of dirsFor(piece)) {
    const mr = r + dr; const mc = c + dc; const tr = r + 2 * dr; const tc = c + 2 * dc;
    if (!on(tr, tc)) continue;
    const mid = mr * 8 + mc; const to = tr * 8 + tc;
    if (board[to] || !board[mid] || side(board[mid]) === side(piece) || captured.includes(mid)) continue;
    // Crowning ends the move.
    const crowned = !isKing(piece) && (tr === 0 || tr === 7);
    const nextBoard = board.slice();
    nextBoard[from] = null; nextBoard[to] = piece;
    extended = true;
    if (crowned) out.push({ from: path[0], to, path: [...path, to], captured: [...captured, mid] });
    else jumpsFrom(nextBoard, to, piece, [...path, to], [...captured, mid], out);
  }
  if (!extended && captured.length) out.push({ from: path[0], to: from, path, captured });
}

export function legalMoves(board, turn) {
  const jumps = [];
  const steps = [];
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p || side(p) !== turn) continue;
    jumpsFrom(board, i, p, [i], [], jumps);
    const [r, c] = rc(i);
    for (const [dr, dc] of dirsFor(p)) {
      if (on(r + dr, c + dc) && !board[(r + dr) * 8 + c + dc]) {
        const to = (r + dr) * 8 + c + dc;
        steps.push({ from: i, to, path: [i, to], captured: [] });
      }
    }
  }
  return jumps.length ? jumps : steps;
}

export function play(board, m) {
  const b = board.slice();
  let p = b[m.from];
  b[m.from] = null;
  for (const x of m.captured) b[x] = null;
  const row = m.to >> 3;
  if (p === 'd' && row === 0) p = 'D';
  if (p === 'l' && row === 7) p = 'L';
  b[m.to] = p;
  return b;
}

/** Winner if the player to move has nothing left to do. */
export const winnerIfStuck = (board, turn) => (legalMoves(board, turn).length ? null : other(turn));

function evaluate(board, me) {
  let s = 0;
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p) continue;
    const [r, c] = rc(i);
    let v = isKing(p) ? 170 : 100;
    if (!isKing(p)) v += (side(p) === 'd' ? 7 - r : r) * 4;          // advance
    if (c === 0 || c === 7) v += 4;                                      // edges are safe
    if (!isKing(p) && (side(p) === 'd' ? r === 7 : r === 0)) v += 8;    // guard the back row
    s += side(p) === me ? v : -v;
  }
  return s;
}

function search(board, turn, me, depth, alpha, beta) {
  const moves = legalMoves(board, turn);
  if (!moves.length) return turn === me ? -10000 - depth : 10000 + depth;
  if (depth === 0) return evaluate(board, me);
  if (turn === me) {
    let v = -Infinity;
    for (const m of moves) {
      v = Math.max(v, search(play(board, m), other(turn), me, depth - 1, alpha, beta));
      alpha = Math.max(alpha, v);
      if (alpha >= beta) break;
    }
    return v;
  }
  let v = Infinity;
  for (const m of moves) {
    v = Math.min(v, search(play(board, m), other(turn), me, depth - 1, alpha, beta));
    beta = Math.min(beta, v);
    if (alpha >= beta) break;
  }
  return v;
}

export function cpuMove(board, me, { depth = 5, rng = Math.random } = {}) {
  const moves = legalMoves(board, me);
  let best = -Infinity;
  let picks = [];
  for (const m of moves) {
    const v = search(play(board, m), other(me), me, depth - 1, -Infinity, Infinity);
    if (v > best) { best = v; picks = [m]; } else if (v === best) picks.push(m);
  }
  return picks[Math.floor(rng() * picks.length)] ?? null;
}

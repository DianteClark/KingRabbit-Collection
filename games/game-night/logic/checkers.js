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
  let s = 0; let mine = 0; let theirs = 0;
  const myKings = []; const theirPieces = [];
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p) continue;
    const [r, c] = rc(i);
    let v = isKing(p) ? 170 : 100;
    if (!isKing(p)) v += (side(p) === 'd' ? 7 - r : r) * 4;          // advance
    if (c === 0 || c === 7) v += 4;                                      // edges are safe
    if (!isKing(p) && (side(p) === 'd' ? r === 7 : r === 0)) v += 8;    // guard the back row
    if (isKing(p) && r > 1 && r < 6 && c > 1 && c < 6) v += 6;          // kings like the centre
    if (side(p) === me) { s += v; mine += v; if (isKing(p)) myKings.push([r, c]); }
    else { s -= v; theirs += v; theirPieces.push([r, c]); }
  }
  // Ahead on material: trade down and chase the remaining pieces so the game actually ends.
  if (mine > theirs + 60 && theirPieces.length) {
    s += (1 - (mine + theirs) / 2400) * 120;
    for (const [kr, kc] of myKings) {
      const d = Math.min(...theirPieces.map(([r, c]) => Math.max(Math.abs(r - kr), Math.abs(c - kc))));
      s -= d * 6;
    }
  }
  return s;
}

class Timeout extends Error {}

function search(board, turn, me, depth, alpha, beta, clock) {
  if (clock && (++clock.nodes & 1023) === 0 && Date.now() > clock.deadline) throw new Timeout();
  const moves = legalMoves(board, turn);
  if (!moves.length) return turn === me ? -10000 - depth : 10000 + depth;
  if (depth === 0) return evaluate(board, me);
  if (turn === me) {
    let v = -Infinity;
    for (const m of moves) {
      v = Math.max(v, search(play(board, m), other(turn), me, depth - 1, alpha, beta, clock));
      alpha = Math.max(alpha, v);
      if (alpha >= beta) break;
    }
    return v;
  }
  let v = Infinity;
  for (const m of moves) {
    v = Math.min(v, search(play(board, m), other(turn), me, depth - 1, alpha, beta, clock));
    beta = Math.min(beta, v);
    if (alpha >= beta) break;
  }
  return v;
}

// timeMs caps the thinking time: the search deepens one level at a time and keeps the result of
// the deepest pass that finished, so Hard never freezes the screen in a king-heavy ending.
export const LEVELS = {
  easy: { depth: 2, noise: 70, timeMs: 400 },
  normal: { depth: 4, noise: 10, timeMs: 900 },
  hard: { depth: 8, noise: 0, timeMs: 1400 },
};

export function cpuMove(board, me, { depth, level = 'normal', cfg = LEVELS[level], rng = Math.random, timeMs } = {}) {
  const maxDepth = depth ?? cfg.depth;
  const noise = cfg.noise;
  let moves = legalMoves(board, me);
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0];
  const budget = timeMs ?? cfg.timeMs ?? Infinity;
  const clock = { deadline: Date.now() + budget, nodes: 0 };
  // One fixed wobble per move so every depth judges the same "mistakes".
  const wobble = new Map(moves.map((m) => [m, rng() * noise]));
  let pick = moves[0];
  for (let d = 1; d <= maxDepth; d++) {
    try {
      const scored = moves.map((m) => ({ m, v: search(play(board, m), other(me), me, d - 1, -Infinity, Infinity, d > 1 ? clock : null) + wobble.get(m) }));
      const best = Math.max(...scored.map((x) => x.v));
      const picks = scored.filter((x) => x.v === best).map((x) => x.m);
      pick = picks[Math.floor(rng() * picks.length)];
      moves = scored.sort((a, b) => b.v - a.v).map((x) => x.m);   // best first: better pruning next pass
      if (best >= 9000) break;                                     // found a forced win
      if (Date.now() > clock.deadline) break;
    } catch (e) {
      if (!(e instanceof Timeout)) throw e;
      break;
    }
  }
  return pick;
}

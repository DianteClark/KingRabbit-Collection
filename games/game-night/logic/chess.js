// Chess rules + CPU.
// Board: 64 squares, index = row * 8 + col, row 0 is rank 8 (black's back rank).
// Pieces: 'P','N','B','R','Q','K' white, lowercase black, null empty.
// Simplifications: pawns always promote to a queen; draws by stalemate, bare kings / single
// minor piece, and the 50-move rule (threefold repetition isn't tracked).

const isWhite = (p) => p && p === p.toUpperCase();
const colorOf = (p) => (p ? (isWhite(p) ? 'w' : 'b') : null);
const rc = (i) => [i >> 3, i & 7];
const idx = (r, c) => r * 8 + c;
const onBoard = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

export function newGame() {
  const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  const board = new Array(64).fill(null);
  for (let c = 0; c < 8; c++) {
    board[c] = back[c];
    board[8 + c] = 'p';
    board[48 + c] = 'P';
    board[56 + c] = back[c].toUpperCase();
  }
  return { board, turn: 'w', castle: { K: true, Q: true, k: true, q: true }, ep: -1, half: 0 };
}

const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];

/** Is square sq attacked by side `by` ('w'|'b')? */
export function attacked(board, sq, by) {
  const [r, c] = rc(sq);
  const own = (p, type) => p && colorOf(p) === by && p.toUpperCase() === type;
  // Pawns
  const pr = by === 'w' ? r + 1 : r - 1;
  for (const dc of [-1, 1]) if (onBoard(pr, c + dc) && own(board[idx(pr, c + dc)], 'P')) return true;
  for (const [dr, dc] of KNIGHT) if (onBoard(r + dr, c + dc) && own(board[idx(r + dr, c + dc)], 'N')) return true;
  for (const [dr, dc] of KING) if (onBoard(r + dr, c + dc) && own(board[idx(r + dr, c + dc)], 'K')) return true;
  const ray = (dirs, types) => {
    for (const [dr, dc] of dirs) {
      let rr = r + dr; let cc = c + dc;
      while (onBoard(rr, cc)) {
        const p = board[idx(rr, cc)];
        if (p) { if (colorOf(p) === by && types.includes(p.toUpperCase())) return true; break; }
        rr += dr; cc += dc;
      }
    }
    return false;
  };
  return ray(DIAG, 'BQ') || ray(ORTH, 'RQ');
}

const kingSquare = (board, side) => board.findIndex((p) => p === (side === 'w' ? 'K' : 'k'));
export const inCheck = (s, side = s.turn) => attacked(s.board, kingSquare(s.board, side), side === 'w' ? 'b' : 'w');

function pseudoMoves(s) {
  const { board, turn } = s;
  const enemy = turn === 'w' ? 'b' : 'w';
  const moves = [];
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p || colorOf(p) !== turn) continue;
    const [r, c] = rc(i);
    const type = p.toUpperCase();
    const add = (to, extra = {}) => moves.push({ from: i, to, piece: p, capture: board[to], ...extra });
    if (type === 'P') {
      const dir = turn === 'w' ? -1 : 1;
      const start = turn === 'w' ? 6 : 1;
      const last = turn === 'w' ? 0 : 7;
      const one = idx(r + dir, c);
      if (onBoard(r + dir, c) && !board[one]) {
        add(one, r + dir === last ? { promo: true } : {});
        const two = idx(r + 2 * dir, c);
        if (r === start && !board[two]) add(two, { double: true });
      }
      for (const dc of [-1, 1]) {
        if (!onBoard(r + dir, c + dc)) continue;
        const t = idx(r + dir, c + dc);
        if (board[t] && colorOf(board[t]) === enemy) add(t, r + dir === last ? { promo: true } : {});
        else if (t === s.ep) add(t, { enPassant: true, capture: turn === 'w' ? 'p' : 'P' });
      }
    } else if (type === 'N' || type === 'K') {
      for (const [dr, dc] of type === 'N' ? KNIGHT : KING) {
        if (!onBoard(r + dr, c + dc)) continue;
        const t = idx(r + dr, c + dc);
        if (!board[t] || colorOf(board[t]) === enemy) add(t);
      }
      if (type === 'K') {
        const row = turn === 'w' ? 7 : 0;
        const [kFlag, qFlag] = turn === 'w' ? ['K', 'Q'] : ['k', 'q'];
        if (i === idx(row, 4) && !attacked(board, i, enemy)) {
          if (s.castle[kFlag] && !board[idx(row, 5)] && !board[idx(row, 6)]
            && !attacked(board, idx(row, 5), enemy) && !attacked(board, idx(row, 6), enemy)) add(idx(row, 6), { castle: 'K' });
          if (s.castle[qFlag] && !board[idx(row, 3)] && !board[idx(row, 2)] && !board[idx(row, 1)]
            && !attacked(board, idx(row, 3), enemy) && !attacked(board, idx(row, 2), enemy)) add(idx(row, 2), { castle: 'Q' });
        }
      }
    } else {
      const dirs = type === 'B' ? DIAG : type === 'R' ? ORTH : [...DIAG, ...ORTH];
      for (const [dr, dc] of dirs) {
        let rr = r + dr; let cc = c + dc;
        while (onBoard(rr, cc)) {
          const t = idx(rr, cc);
          if (board[t]) { if (colorOf(board[t]) === enemy) add(t); break; }
          add(t);
          rr += dr; cc += dc;
        }
      }
    }
  }
  return moves;
}

/** Apply a move (no legality check). Returns a new state. */
export function makeMove(s, m) {
  const board = s.board.slice();
  const castle = { ...s.castle };
  const [r] = rc(m.from);
  board[m.to] = m.promo ? (s.turn === 'w' ? 'Q' : 'q') : m.piece;
  board[m.from] = null;
  if (m.enPassant) board[m.to + (s.turn === 'w' ? 8 : -8)] = null;
  if (m.castle) {
    const row = r;
    if (m.castle === 'K') { board[idx(row, 5)] = board[idx(row, 7)]; board[idx(row, 7)] = null; }
    else { board[idx(row, 3)] = board[idx(row, 0)]; board[idx(row, 0)] = null; }
  }
  // Castling rights vanish when the king or a rook moves, or a rook is captured.
  const touch = (sq) => {
    if (sq === 60) { castle.K = false; castle.Q = false; }
    if (sq === 4) { castle.k = false; castle.q = false; }
    if (sq === 63) castle.K = false;
    if (sq === 56) castle.Q = false;
    if (sq === 7) castle.k = false;
    if (sq === 0) castle.q = false;
  };
  touch(m.from); touch(m.to);
  const reset = m.capture || m.piece.toUpperCase() === 'P';
  return {
    board,
    turn: s.turn === 'w' ? 'b' : 'w',
    castle,
    ep: m.double ? (m.from + m.to) / 2 : -1,
    half: reset ? 0 : s.half + 1,
  };
}

export function legalMoves(s) {
  return pseudoMoves(s).filter((m) => !inCheck(makeMove(s, m), s.turn));
}

function insufficient(board) {
  const rest = board.filter((p) => p && p.toUpperCase() !== 'K');
  return rest.length === 0 || (rest.length === 1 && 'NB'.includes(rest[0].toUpperCase()));
}

/** null while playing, else { result: 'checkmate'|'stalemate'|'draw', winner: 'w'|'b'|null } */
export function status(s) {
  if (!legalMoves(s).length) {
    return inCheck(s) ? { result: 'checkmate', winner: s.turn === 'w' ? 'b' : 'w' } : { result: 'stalemate', winner: null };
  }
  if (s.half >= 100 || insufficient(s.board)) return { result: 'draw', winner: null };
  return null;
}

// ---------- CPU ----------
const VALUE = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
// Piece-square bonuses from white's point of view (row 0 = rank 8).
const PST = {
  P: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  N: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  B: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  R: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  Q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  K: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
};

/** Score from white's point of view. */
export function evaluate(board) {
  let s = 0;
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p) continue;
    const t = p.toUpperCase();
    if (isWhite(p)) s += VALUE[t] + PST[t][i];
    else s -= VALUE[t] + PST[t][(7 - (i >> 3)) * 8 + (i & 7)];
  }
  return s;
}

const order = (moves) => moves.sort((a, b) => (b.capture ? VALUE[b.capture.toUpperCase()] * 10 - VALUE[b.piece.toUpperCase()] : 0)
  - (a.capture ? VALUE[a.capture.toUpperCase()] * 10 - VALUE[a.piece.toUpperCase()] : 0));

function quiesce(s, alpha, beta, depth) {
  const sign = s.turn === 'w' ? 1 : -1;
  const stand = sign * evaluate(s.board);
  if (stand >= beta || depth === 0) return stand;
  if (stand > alpha) alpha = stand;
  for (const m of order(pseudoMoves(s).filter((x) => x.capture))) {
    const next = makeMove(s, m);
    if (inCheck(next, s.turn)) continue;
    const v = -quiesce(next, -beta, -alpha, depth - 1);
    if (v >= beta) return v;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

function negamax(s, depth, alpha, beta, ply) {
  if (depth === 0) return quiesce(s, alpha, beta, 4);
  let best = -Infinity;
  let legal = 0;
  for (const m of order(pseudoMoves(s))) {
    const next = makeMove(s, m);
    if (inCheck(next, s.turn)) continue;   // illegal: leaves own king in check
    legal++;
    const v = -negamax(next, depth - 1, -beta, -alpha, ply + 1);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  if (!legal) return inCheck(s) ? -100000 + ply : 0;
  return best;
}

/** Best move for the side to move. */
export function cpuMove(s, { depth = 2, rng = Math.random } = {}) {
  const moves = order(legalMoves(s));
  let best = -Infinity;
  let pick = null;
  let alpha = -Infinity;
  for (const m of moves) {
    const jitter = rng() * 6; // a little variety between games
    const v = -negamax(makeMove(s, m), depth, -Infinity, -alpha + 6, 1) + jitter;
    if (v > best) { best = v; pick = m; }
    if (v - 6 > alpha) alpha = v - 6;
  }
  return pick;
}

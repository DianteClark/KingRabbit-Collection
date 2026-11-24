// Go on a 9x9 board. Stones: 1 black (moves first), 2 white, 0 empty.
// Rules: captures, no suicide, positional ko (can't recreate the board from just before your
// last turn), two passes in a row end the game. Area scoring (stones + surrounded empty
// points) with 6.5 komi for white.

export const N = 9;
export const KOMI = 6.5;
export const other = (p) => 3 - p;

export function newGame() {
  return { board: new Array(N * N).fill(0), turn: 1, prev: null, passes: 0, captures: { 1: 0, 2: 0 } };
}

export function neighbors(i) {
  const r = Math.floor(i / N); const c = i % N; const out = [];
  if (r > 0) out.push(i - N);
  if (r < N - 1) out.push(i + N);
  if (c > 0) out.push(i - 1);
  if (c < N - 1) out.push(i + 1);
  return out;
}

/** Group containing i, plus its liberties. */
export function group(board, i) {
  const color = board[i];
  const stones = new Set([i]);
  const libs = new Set();
  const stack = [i];
  while (stack.length) {
    const s = stack.pop();
    for (const n of neighbors(s)) {
      if (board[n] === 0) libs.add(n);
      else if (board[n] === color && !stones.has(n)) { stones.add(n); stack.push(n); }
    }
  }
  return { stones: [...stones], libs: [...libs] };
}

const same = (a, b) => a && b && a.every((v, i) => v === b[i]);

/** Try a move. Returns { board, captured } or null if illegal. */
export function tryMove(g, i) {
  if (g.board[i] !== 0) return null;
  const board = g.board.slice();
  board[i] = g.turn;
  let captured = 0;
  for (const n of neighbors(i)) {
    if (board[n] === other(g.turn)) {
      const grp = group(board, n);
      if (!grp.libs.length) { for (const s of grp.stones) board[s] = 0; captured += grp.stones.length; }
    }
  }
  if (!group(board, i).libs.length) return null;  // suicide
  if (same(board, g.prev)) return null;           // ko
  return { board, captured };
}

export function play(g, i) {
  const r = tryMove(g, i);
  if (!r) return null;
  return {
    board: r.board,
    turn: other(g.turn),
    prev: g.board,
    passes: 0,
    captures: { ...g.captures, [g.turn]: g.captures[g.turn] + r.captured },
    lastCaptured: r.captured,
  };
}

export function pass(g) {
  return { ...g, turn: other(g.turn), prev: g.board, passes: g.passes + 1, lastCaptured: 0 };
}

export const isOver = (g) => g.passes >= 2;

/** Area score. territory[i] = owner (1|2) for empty points fully surrounded by one colour. */
export function score(board) {
  const territory = new Array(N * N).fill(0);
  const seen = new Set();
  const pts = { 1: 0, 2: 0 };
  for (let i = 0; i < N * N; i++) {
    if (board[i]) { pts[board[i]]++; continue; }
    if (seen.has(i)) continue;
    const region = []; const borders = new Set(); const stack = [i];
    seen.add(i);
    while (stack.length) {
      const s = stack.pop(); region.push(s);
      for (const n of neighbors(s)) {
        if (board[n]) borders.add(board[n]);
        else if (!seen.has(n)) { seen.add(n); stack.push(n); }
      }
    }
    if (borders.size === 1) {
      const owner = [...borders][0];
      pts[owner] += region.length;
      for (const s of region) territory[s] = owner;
    }
  }
  return { black: pts[1], white: pts[2] + KOMI, territory };
}

// ---------- CPU (beginner level: grabs captures, saves groups, avoids silly moves) ----------
function isOwnEye(board, i, me) {
  return neighbors(i).every((n) => board[n] === me);
}

/** Rough territory estimate: each stone spreads influence that fades with distance. */
export function influence(board) {
  const inf = new Array(N * N).fill(0);
  for (let i = 0; i < N * N; i++) {
    if (!board[i]) continue;
    const sign = board[i] === 1 ? 1 : -1;
    const r0 = Math.floor(i / N); const c0 = i % N;
    for (let r = Math.max(0, r0 - 3); r <= Math.min(N - 1, r0 + 3); r++) {
      for (let c = Math.max(0, c0 - 3); c <= Math.min(N - 1, c0 + 3); c++) {
        const d = Math.abs(r - r0) + Math.abs(c - c0);
        if (d <= 3) inf[r * N + c] += sign * [8, 4, 2, 1][d];
      }
    }
  }
  return inf;
}

/** Estimated (my area - their area) from influence, for player `me`. */
function areaEstimate(board, me) {
  const inf = influence(board);
  let s = 0;
  for (let i = 0; i < N * N; i++) {
    const v = board[i] ? (board[i] === 1 ? 6 : -6) : inf[i];
    if (v > 2) s += 1; else if (v < -2) s -= 1;
  }
  return me === 1 ? s : -s;
}

export const LEVELS = {
  easy: { noise: 6, area: 0, lookahead: false, wild: 0.35 },
  normal: { noise: 2.5, area: 0.3, lookahead: false },
  hard: { noise: 0.4, area: 0.6, lookahead: false },
};

export function cpuMove(g, { level = 'normal', rng = Math.random } = {}) {
  const cfg = LEVELS[level];
  const { best, list } = scoredMoves(g, cfg, rng);
  // Easy sometimes just plays somewhere reasonable-looking at random.
  if (cfg.wild && best >= 0 && rng() < cfg.wild) {
    const ok = list.filter((m) => m.v > -5);
    if (ok.length) return ok[Math.floor(rng() * ok.length)].i;
  }
  return best;
}

function scoredMoves(g, cfg, rng) {
  const list = [];
  const me = g.turn; const opp = other(me);
  const baseArea = cfg.area ? areaEstimate(g.board, me) : 0;
  let best = -Infinity; let pick = -1;
  const stones = g.board.filter(Boolean).length;
  for (let i = 0; i < N * N; i++) {
    if (g.board[i] || isOwnEye(g.board, i, me)) continue;
    const r = tryMove(g, i);
    if (!r) continue;
    let v = r.captured * 12;
    const mine = group(r.board, i);
    if (mine.libs.length === 1) v -= 14 + mine.stones.length * 3;   // don't walk into atari
    v += Math.min(mine.libs.length, 4);
    for (const n of neighbors(i)) {
      if (g.board[n] === me) {
        const before = group(g.board, n);
        if (before.libs.length === 1) v += 8 + before.stones.length * 3;   // rescue
      }
      if (r.board[n] === opp) {
        const og = group(r.board, n);
        if (og.libs.length === 1) v += 5 + og.stones.length;              // atari
        else if (og.libs.length === 2) v += 1.5;
      }
    }
    const rr = Math.floor(i / N); const cc = i % N;
    const edge = Math.min(rr, cc, N - 1 - rr, N - 1 - cc);
    if (stones < 10) v += edge === 2 ? 3 : edge === 0 ? -3 : edge === 1 ? -1 : 1;
    else if (edge === 0) v -= 1;
    v += neighbors(i).filter((n) => r.board[n] === 0).length * 0.5;
    // Territory: how much does this move change the estimated balance of the board?
    if (cfg.area) v += (areaEstimate(r.board, me) - baseArea) * cfg.area;
    // Look one move ahead: can the opponent immediately capture a big group in reply?
    if (cfg.lookahead) {
      let worst = 0;
      const after = { ...g, board: r.board, turn: opp, prev: g.board };
      for (const n of new Set(mine.libs)) {
        const rep = tryMove(after, n);
        if (rep) worst = Math.max(worst, rep.captured);
      }
      v -= worst * 10;
    }
    v += rng() * cfg.noise;
    list.push({ i, v });
    if (v > best) { best = v; pick = i; }
  }
  // Late in the game with nothing useful to do: pass.
  if (pick < 0 || (stones > 40 && best < 2)) return { best: -1, list };
  return { best: pick, list };
}

/**
 * Guess which groups are dead at the end: groups in atari, and small weak groups that sit
 * inside the opponent's area (removing them leaves space that only the opponent surrounds).
 * Returns a Set of stone indexes. Players can then adjust it before scoring.
 */
export function suggestDead(board) {
  const dead = new Set();
  const seen = new Set();
  for (let i = 0; i < N * N; i++) {
    if (!board[i] || seen.has(i)) continue;
    const g = group(board, i);
    g.stones.forEach((s) => seen.add(s));
    let isDead = g.libs.length <= 1;
    if (!isDead && g.stones.length <= 8) {
      const without = board.slice();
      for (const s of g.stones) without[s] = 0;
      const sc = score(without);
      isDead = g.stones.every((s) => sc.territory[s] === other(board[i]));
    }
    if (isDead) g.stones.forEach((s) => dead.add(s));
  }
  return dead;
}

/** Toggle a whole group in/out of the dead set. */
export function toggleDead(board, dead, i) {
  if (!board[i]) return dead;
  const next = new Set(dead);
  const { stones } = group(board, i);
  const on = !next.has(i);
  for (const s of stones) { if (on) next.add(s); else next.delete(s); }
  return next;
}

/** Area score after removing the dead stones. */
export function finalScore(board, dead) {
  const b = board.slice();
  for (const s of dead) b[s] = 0;
  return { ...score(b), board: b };
}

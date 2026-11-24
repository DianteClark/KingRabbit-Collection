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

export function cpuMove(g, { rng = Math.random } = {}) {
  const me = g.turn; const opp = other(me);
  let best = -Infinity; let pick = -1;
  const stones = g.board.filter(Boolean).length;
  for (let i = 0; i < N * N; i++) {
    if (g.board[i] || isOwnEye(g.board, i, me)) continue;
    const r = tryMove(g, i);
    if (!r) continue;
    let v = r.captured * 12;
    const mine = group(r.board, i);
    if (mine.libs.length === 1) v -= 14;            // don't walk into atari
    v += Math.min(mine.libs.length, 4);
    for (const n of neighbors(i)) {
      if (g.board[n] === me && group(g.board, n).libs.length === 1) v += 10;   // rescue
      if (r.board[n] === opp) {
        const og = group(r.board, n);
        if (og.libs.length === 1) v += 5;                                        // atari
        else if (og.libs.length === 2) v += 1.5;
      }
    }
    // Opening: prefer the 3-3 / 3-4 area and the centre over edges.
    const rr = Math.floor(i / N); const cc = i % N;
    const edge = Math.min(rr, cc, N - 1 - rr, N - 1 - cc);
    if (stones < 10) v += edge === 2 ? 3 : edge === 0 ? -3 : edge === 1 ? -1 : 1;
    else if (edge === 0) v -= 1;
    // Claim empty space: count nearby empty points not already owned by the opponent.
    v += neighbors(i).filter((n) => r.board[n] === 0).length * 0.5;
    v += rng() * 1.5;
    if (v > best) { best = v; pick = i; }
  }
  // Late in the game with nothing useful to do: pass.
  if (pick < 0 || (stones > 40 && best < 2)) return -1;
  return pick;
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

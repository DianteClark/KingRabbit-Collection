// Riddle stones: a fixed board with no new gems falling in. Clear every gem within the move limit.
import * as B from './board.js';
import { makeRng } from './rng.js';

const NO_RNG = makeRng(1);

export const PUZZLES = {
  p1: {
    name: 'Riddle of the Grove', moves: 2,
    rows: ['........', '........', '........', '........', '........', '....G...', '..RGRGR.', '.RGRGRG.'],
    tip: 'Gems fall into the gaps you make. Look two moves ahead.',
  },
  p2: {
    name: 'Riddle of Bones', moves: 3,
    rows: ['........', '........', '........', '........', '...R.R..', '..RR.K..', '..RKKR..', '.RKKRRK.'],
    tip: 'Order matters: think about what falls where.',
  },
  p3: {
    name: 'Riddle of Ice', moves: 4,
    rows: ['........', '........', '........', '........', '..G.GYG.', '..Y.YGY.', '..YGYGY.', '..GYGYG.'],
    tip: 'Only one first move works. Every gem must go.',
  },
  p4: {
    name: 'Riddle of Fire', moves: 5,
    rows: ['........', '........', '........', '........', '.BBRYYB.', '.BGBBRG.', '.RGRRYG.', '.BRGBGB.'],
    tip: 'Plan the last move first. Lines of 4 make gems that clear a whole row or column.',
  },
};

export function newPuzzle(id) {
  const P = PUZZLES[id];
  return { id, board: B.fromRows(P.rows), movesLeft: P.moves, made: 0, over: null };
}

/** Try a swap. Returns { ok, steps }; sets over to 'win' / 'lose'. */
export function puzzleMove(ps, a, b) {
  if (ps.over) return { ok: false, steps: [] };
  const res = B.swap(ps.board, a, b, NO_RNG, { spawn: false });
  if (!res.ok) return { ok: false, steps: res.steps };
  ps.movesLeft--;
  ps.made++;
  if (B.gemsLeft(ps.board) === 0) ps.over = 'win';
  else if (ps.movesLeft <= 0 || !B.hasMoves(ps.board)) ps.over = 'lose';
  return { ok: true, steps: res.steps };
}

/** Shortest list of swaps that clears the board within `moves` (or null). */
export function solve(board, moves) {
  const seen = new Map();
  function dfs(b, left) {
    if (B.gemsLeft(b) === 0) return [];
    if (left === 0) return null;
    const key = B.toRows(b).join('/');
    if ((seen.get(key) ?? -1) >= left) return null;
    seen.set(key, left);
    for (const m of B.findMoves(b)) {
      const c = B.cloneBoard(b);
      B.swap(c, m.a, m.b, NO_RNG, { spawn: false });
      const rest = dfs(c, left - 1);
      if (rest) return [m, ...rest];
    }
    return null;
  }
  for (let depth = 1; depth <= moves; depth++) {
    seen.clear();
    const r = dfs(B.cloneBoard(board), depth);
    if (r) return r;
  }
  return null;
}

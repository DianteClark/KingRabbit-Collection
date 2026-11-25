// The 8x8 gem board: matching, special gems, cascades and reshuffles. Pure logic (no Phaser),
// plain JSON state so a battle can be saved mid-fight and resumed exactly.
//
// A cell is null (empty, puzzle boards only) or { c, s, id }:
//   c  colour: 0 red, 1 blue, 2 green, 3 yellow (mana), 4 skull, 5 coin, 6 star (colour bomb)
//   s  special: null, 'h' (clears its row), 'v' (clears its column), 'bomb' (3x3), 'star'
//   id unique number so the view can follow each gem as it moves
//
// Every action returns a list of steps for the view to animate:
//   { t: 'swap', a, b, ida, idb, back }           gem ida (at a) and idb (at b) trade places (back: no match, they slide back)
//   { t: 'clear', chain, cells: [{i,id,c,s}], made: [{i,id,c,s}], blasts: [{i, s}] }
//   { t: 'fall', moves: [{id, from, to}], spawns: [{id, c, s, to, drop}] }
//   { t: 'shuffle', cells }                        no moves left: the gems were mixed up
// and the gains: { counts: [per colour], cleared, chain, extra, biggest, made: {h,v,bomb,star} }
import { next, int, shuffle } from './rng.js';

export const SIZE = 8;
export const N = SIZE * SIZE;
export const RED = 0; export const BLUE = 1; export const GREEN = 2; export const YELLOW = 3;
export const SKULL = 4; export const COIN = 5; export const STAR = 6;
export const COLOR_COUNT = 6;
export const MANA = ['r', 'b', 'g', 'y'];
export const COLOR_NAMES = ['Red', 'Blue', 'Green', 'Yellow', 'Skull', 'Coin', 'Star'];

export const idx = (x, y) => y * SIZE + x;
export const xy = (i) => [i % SIZE, Math.floor(i / SIZE)];
export function adjacent(a, b) {
  const [ax, ay] = xy(a); const [bx, by] = xy(b);
  return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
}

const gem = (board, c, s = null) => ({ c, s, id: board.nextId++ });

/** A random board with no ready-made matches and at least one move. */
export function newBoard(rng, colors = COLOR_COUNT) {
  const board = { cells: new Array(N).fill(null), nextId: 1, colors };
  for (let tries = 0; tries < 50; tries++) {
    for (let i = 0; i < N; i++) {
      const [x, y] = xy(i);
      const banned = new Set();
      if (x >= 2 && board.cells[i - 1].c === board.cells[i - 2].c) banned.add(board.cells[i - 1].c);
      if (y >= 2 && board.cells[i - SIZE].c === board.cells[i - 2 * SIZE].c) banned.add(board.cells[i - SIZE].c);
      const options = [];
      for (let c = 0; c < colors; c++) if (!banned.has(c)) options.push(c);
      board.cells[i] = gem(board, options[int(rng, 0, options.length - 1)]);
    }
    if (findMoves(board).length >= 3) break;
  }
  return board;
}

/**
 * Board from text rows (tests and puzzles). Letters: R B G Y K (skull) C (coin) * (star), '.' empty.
 * Lower-case r/b/g/y/k/c = that gem with a special given by `specials` ('h', 'v' or 'bomb'),
 * read in order, e.g. fromRows([...], ['h', 'bomb']).
 */
export function fromRows(rows, specials = []) {
  const board = { cells: new Array(N).fill(null), nextId: 1, colors: COLOR_COUNT };
  const letters = 'RBGYKC';
  let k = 0;
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.' || ch === ' ') return;
      if (ch === '*') { board.cells[idx(x, y)] = gem(board, STAR, 'star'); return; }
      const up = ch.toUpperCase();
      const c = letters.indexOf(up);
      if (c < 0) throw new Error(`bad board letter ${ch}`);
      board.cells[idx(x, y)] = gem(board, c, ch === up ? null : specials[k++]);
    });
  });
  return board;
}

export function toRows(board) {
  const rows = [];
  for (let y = 0; y < SIZE; y++) {
    let r = '';
    for (let x = 0; x < SIZE; x++) {
      const cell = board.cells[idx(x, y)];
      if (!cell) r += '.';
      else if (cell.c === STAR) r += '*';
      else r += cell.s ? 'rbgykc'[cell.c] : 'RBGYKC'[cell.c];
    }
    rows.push(r);
  }
  return rows;
}

export const cloneBoard = (b) => ({ cells: b.cells.map((c) => (c ? { ...c } : null)), nextId: b.nextId, colors: b.colors });

const colorAt = (cells, x, y) => {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return -1;
  const c = cells[idx(x, y)];
  return c && c.c !== STAR ? c.c : -1;
};

/** Is the gem at i part of a line of 3+ right now? */
export function lineAt(cells, i) {
  const [x, y] = xy(i);
  const c = colorAt(cells, x, y);
  if (c < 0) return false;
  let h = 1; for (let k = x - 1; colorAt(cells, k, y) === c; k--) h++; for (let k = x + 1; colorAt(cells, k, y) === c; k++) h++;
  if (h >= 3) return true;
  let v = 1; for (let k = y - 1; colorAt(cells, x, k) === c; k--) v++; for (let k = y + 1; colorAt(cells, x, k) === c; k++) v++;
  return v >= 3;
}

/** Would swapping a and b do anything? (makes a line, or uses a star) */
export function isValidSwap(board, a, b) {
  if (a === b || a < 0 || b < 0 || a >= N || b >= N || !adjacent(a, b)) return false;
  const cells = board.cells;
  if (!cells[a] || !cells[b]) return false;
  if (cells[a].c === STAR || cells[b].c === STAR) return true;
  if (cells[a].c === cells[b].c) return false;
  [cells[a], cells[b]] = [cells[b], cells[a]];
  const ok = lineAt(cells, a) || lineAt(cells, b);
  [cells[a], cells[b]] = [cells[b], cells[a]];
  return ok;
}

/** Every valid swap on the board: [{ a, b }] with a < b. */
export function findMoves(board) {
  const out = [];
  for (let i = 0; i < N; i++) {
    const [x, y] = xy(i);
    if (x < SIZE - 1 && isValidSwap(board, i, i + 1)) out.push({ a: i, b: i + 1 });
    if (y < SIZE - 1 && isValidSwap(board, i, i + SIZE)) out.push({ a: i, b: i + SIZE });
  }
  return out;
}

export const hasMoves = (board) => findMoves(board).length > 0;

/** All lines of 3+ merged into groups (an L or T shape is one group). */
export function findGroups(cells) {
  const runs = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE;) {
      const c = colorAt(cells, x, y);
      let e = x + 1;
      while (c >= 0 && colorAt(cells, e, y) === c) e++;
      if (c >= 0 && e - x >= 3) runs.push({ c, dir: 'h', cells: Array.from({ length: e - x }, (_, k) => idx(x + k, y)) });
      x = e;
    }
  }
  for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE;) {
      const c = colorAt(cells, x, y);
      let e = y + 1;
      while (c >= 0 && colorAt(cells, x, e) === c) e++;
      if (c >= 0 && e - y >= 3) runs.push({ c, dir: 'v', cells: Array.from({ length: e - y }, (_, k) => idx(x, y + k)) });
      y = e;
    }
  }
  // Merge runs that share a gem.
  const parent = runs.map((_, k) => k);
  const find = (k) => (parent[k] === k ? k : (parent[k] = find(parent[k])));
  const owner = new Map();
  runs.forEach((r, k) => r.cells.forEach((i) => {
    if (owner.has(i)) parent[find(k)] = find(owner.get(i)); else owner.set(i, k);
  }));
  const groups = new Map();
  runs.forEach((r, k) => {
    const root = find(k);
    if (!groups.has(root)) groups.set(root, { c: r.c, cells: new Set(), runs: [] });
    const g = groups.get(root);
    r.cells.forEach((i) => g.cells.add(i));
    g.runs.push(r);
  });
  return [...groups.values()];
}

/** What a group leaves behind, and where. focus = cells the player just moved. */
function specialFor(group, focus) {
  const longest = group.runs.reduce((m, r) => (r.cells.length > m.cells.length ? r : m), group.runs[0]);
  const dirs = new Set(group.runs.map((r) => r.dir));
  let s = null;
  if (longest.cells.length >= 5) s = 'star';
  else if (dirs.size === 2) s = 'bomb';
  else if (longest.cells.length === 4) s = longest.dir;
  if (!s) return null;
  let at = focus.find((i) => group.cells.has(i));
  if (at === undefined) {
    if (dirs.size === 2) at = group.runs[0].cells.find((i) => group.runs[1].cells.includes(i));
    if (at === undefined) at = longest.cells[Math.floor((longest.cells.length - 1) / 2)];
  }
  return { at, s, c: s === 'star' ? STAR : group.c };
}

function emptyGains() {
  return { counts: [0, 0, 0, 0, 0, 0, 0], cleared: 0, chain: 0, extra: false, biggest: 0, made: { h: 0, v: 0, bomb: 0, star: 0 } };
}

/** Most common colour on the board (what a star destroyed by a blast takes with it). */
function commonColor(cells) {
  const n = [0, 0, 0, 0, 0, 0];
  for (const c of cells) if (c && c.c < STAR) n[c.c]++;
  let best = 0;
  for (let c = 1; c < 6; c++) if (n[c] > n[best]) best = c;
  return best;
}

/** Cells a special blasts when it goes off at i. */
function blastCells(cells, i, cell) {
  const [x, y] = xy(i);
  const out = [];
  if (cell.s === 'h') for (let k = 0; k < SIZE; k++) out.push(idx(k, y));
  else if (cell.s === 'v') for (let k = 0; k < SIZE; k++) out.push(idx(x, k));
  else if (cell.s === 'bomb') {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx; const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE) out.push(idx(nx, ny));
    }
  } else if (cell.s === 'star') {
    const c = commonColor(cells);
    cells.forEach((g, k) => { if (g && g.c === c) out.push(k); });
  }
  return out;
}

/** Clear a set of cells (setting off any specials in it) and place new specials. */
function applyClear(board, clear, made, gains, chain) {
  const cells = board.cells;
  const set = new Set([...clear].filter((i) => cells[i]));
  const queue = [...set];
  const blasts = [];
  const fired = new Set();
  while (queue.length) {
    const i = queue.shift();
    const cell = cells[i];
    if (!cell || !cell.s || fired.has(i)) continue;
    fired.add(i);
    blasts.push({ i, s: cell.s });
    for (const j of blastCells(cells, i, cell)) {
      if (!set.has(j) && cells[j] && !made.has(j)) { set.add(j); queue.push(j); }
    }
  }
  const out = [];
  for (const i of set) {
    const cell = cells[i];
    out.push({ i, id: cell.id, c: cell.c, s: cell.s });
    gains.counts[cell.c]++;
    gains.cleared++;
    cells[i] = null;
  }
  const madeOut = [];
  for (const [i, m] of made) {
    cells[i] = gem(board, m.c, m.s);
    madeOut.push({ i, ...cells[i] });
    gains.made[m.s]++;
  }
  return { t: 'clear', chain, cells: out, made: madeOut, blasts };
}

/** Let gems fall into gaps; refill from the top when spawn is on. */
function applyGravity(board, rng, spawn) {
  const cells = board.cells;
  const moves = [];
  const spawns = [];
  for (let x = 0; x < SIZE; x++) {
    let write = SIZE - 1;
    for (let y = SIZE - 1; y >= 0; y--) {
      const i = idx(x, y);
      if (!cells[i]) continue;
      if (y !== write) {
        const to = idx(x, write);
        cells[to] = cells[i]; cells[i] = null;
        moves.push({ id: cells[to].id, from: i, to });
      }
      write--;
    }
    if (spawn) {
      const missing = write + 1;
      for (let y = write; y >= 0; y--) {
        const to = idx(x, y);
        cells[to] = gem(board, Math.floor(next(rng) * (board.colors || COLOR_COUNT)));
        spawns.push({ id: cells[to].id, c: cells[to].c, s: null, to, drop: missing });
      }
    }
  }
  return { t: 'fall', moves, spawns };
}

function groupsToClear(board, groups, focus, gains) {
  const clear = new Set();
  const made = new Map();
  for (const g of groups) {
    g.cells.forEach((i) => clear.add(i));
    const longest = Math.max(...g.runs.map((r) => r.cells.length));
    gains.biggest = Math.max(gains.biggest, longest);
    if (longest >= 4) gains.extra = true;
    const sp = specialFor(g, focus);
    if (sp && !made.has(sp.at)) made.set(sp.at, { c: sp.c, s: sp.s });
  }
  return { clear, made };
}

/**
 * Clear, fall, repeat until the board is still. first = { clear: Set, made: Map } from the action
 * that started it (or null to start from the lines already on the board).
 */
function cascade(board, rng, { spawn = true, focus = [] } = {}, first = null, gains = emptyGains()) {
  const steps = [];
  let pending = first;
  let chain = 0;
  for (let guard = 0; guard < 200; guard++) {
    if (!pending) {
      const groups = findGroups(board.cells);
      if (!groups.length) break;
      pending = groupsToClear(board, groups, chain === 0 ? focus : [], gains);
    }
    chain++;
    steps.push(applyClear(board, pending.clear, pending.made, gains, chain));
    steps.push(applyGravity(board, rng, spawn));
    pending = null;
  }
  gains.chain = Math.max(gains.chain, chain);
  if (spawn && !hasMoves(board)) steps.push(reshuffle(board, rng));
  return { steps, gains };
}

/**
 * Swap two gems and resolve everything that follows. Returns { ok, steps, gains }.
 * An invalid swap returns ok:false and leaves the board as it was.
 */
export function swap(board, a, b, rng, { spawn = true } = {}) {
  if (!isValidSwap(board, a, b)) {
    const can = a !== b && board.cells[a] && board.cells[b] && adjacent(a, b);
    return { ok: false, steps: can ? [{ t: 'swap', a, b, ida: board.cells[a].id, idb: board.cells[b].id, back: true }] : [], gains: emptyGains() };
  }
  const cells = board.cells;
  const steps = [{ t: 'swap', a, b, ida: cells[a].id, idb: cells[b].id, back: false }];
  [cells[a], cells[b]] = [cells[b], cells[a]];
  const gains = emptyGains();
  let first = null;
  const sa = cells[a].c === STAR; const sb = cells[b].c === STAR;
  if (sa || sb) {
    const clear = new Set([sa ? a : b]);
    if (sa && sb) cells.forEach((c, i) => { if (c) clear.add(i); });
    else {
      const color = cells[sa ? b : a].c;
      cells.forEach((c, i) => { if (c && c.c === color) clear.add(i); });
    }
    // The star itself has gone off already; don't let it fire a second time.
    cells[sa ? a : b].s = null;
    if (sa && sb) cells[b].s = null;
    first = { clear, made: new Map() };
  }
  const res = cascade(board, rng, { spawn, focus: [b, a] }, first, gains);
  return { ok: true, steps: [...steps, ...res.steps], gains: res.gains };
}

/**
 * Skills that smash gems: clear the given cells (specials go off), then cascade.
 * Also used to start the cascade after a skill changes gem colours (clear = empty set).
 */
export function blast(board, cellsToClear, rng, { spawn = true } = {}) {
  const clear = new Set(cellsToClear.filter((i) => board.cells[i]));
  if (!clear.size) return cascade(board, rng, { spawn });
  return cascade(board, rng, { spawn }, { clear, made: new Map() });
}

/** Turn every gem of colour `from` into colour `to` (specials stay). Returns the changed cells. */
export function convert(board, from, to) {
  const changed = [];
  board.cells.forEach((c, i) => {
    if (c && c.c === from) { c.c = to; changed.push({ i, id: c.id, c: to, s: c.s }); }
  });
  return changed;
}

/** Mix the gems around until there's a move and no ready-made line. */
export function reshuffle(board, rng) {
  const cells = board.cells;
  const filled = [];
  cells.forEach((c, i) => { if (c) filled.push(i); });
  const gems = filled.map((i) => cells[i]);
  for (let tries = 0; tries < 200; tries++) {
    shuffle(rng, gems);
    filled.forEach((i, k) => { cells[i] = gems[k]; });
    if (!findGroups(cells).length && hasMoves(board)) return { t: 'shuffle', cells: snapshot(board) };
  }
  // Give up mixing: start a fresh board (keeps the ids moving forward).
  const fresh = newBoard(rng, board.colors);
  for (let i = 0; i < N; i++) cells[i] = { ...fresh.cells[i], id: board.nextId++ };
  return { t: 'shuffle', cells: snapshot(board) };
}

export const snapshot = (board) => board.cells.map((c, i) => (c ? { i, id: c.id, c: c.c, s: c.s } : null));

/** Cells of a row / column / random spots, for skills. */
export const rowCells = (y) => Array.from({ length: SIZE }, (_, x) => idx(x, y));
export const colCells = (x) => Array.from({ length: SIZE }, (_, y) => idx(x, y));
export const colorCells = (board, c) => board.cells.flatMap((g, i) => (g && g.c === c ? [i] : []));
export const countColor = (board, c) => board.cells.reduce((n, g) => n + (g && g.c === c ? 1 : 0), 0);
export const gemsLeft = (board) => board.cells.reduce((n, g) => n + (g ? 1 : 0), 0);

/** A special gem placed onto a random ordinary gem (some skills). */
export function plantSpecial(board, rng, s, count = 1) {
  const plain = [];
  board.cells.forEach((c, i) => { if (c && !c.s && c.c < STAR) plain.push(i); });
  shuffle(rng, plain);
  const out = [];
  for (const i of plain.slice(0, count)) {
    const c = board.cells[i];
    if (s === 'star') { c.c = STAR; c.s = 'star'; } else c.s = s;
    out.push({ i, id: c.id, c: c.c, s: c.s });
  }
  return out;
}

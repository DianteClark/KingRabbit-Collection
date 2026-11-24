// Mole Runner: a dig-and-collect platformer on a grid (Lode Runner-style).
//   # brick (diggable)   = stone   H ladder   - rope   * gem   P player start   E enemy start   . empty
// Collect every gem to clear the level. Dig a hole in the brick below-left / below-right to trap enemies.

export const COLS = 15;
export const ROWS = 14;

export const LEVELS = [
  [
    '...............',
    '...*......*....',
    '#####H#####H###',
    '.....H.....H...',
    '..*..H..*..H.*.',
    '#######H#######',
    '.......H.......',
    '..-----H-----..',
    '.*.....H.....*.',
    '####H#####H####',
    '....H.....H....',
    '.P..H..*..H..E.',
    '###############',
    '===============',
  ],
  [
    '.......E.......',
    '.*...........*.',
    '###H#######H###',
    '...H...*...H...',
    '...H#######H...',
    '...H.......H...',
    '.*.H--H----H.*.',
    '####..H..######',
    '......H........',
    '..*...H....*...',
    '=====H##H======',
    '.....H..H......',
    'P....H..H..*..E',
    '===============',
  ],
  [
    '.......*.......',
    '.H===========H.',
    '.H...........H.',
    '.H..*..E..*..H.',
    '.H#####H#####H.',
    '.H.....H.....H.',
    '.H.*---H---*.H.',
    '.H.....H.....H.',
    '.####H###H####.',
    '.....H...H.....',
    '..*..H.*.H..*..',
    '##H#########H##',
    '..H....P....H.E',
    '===============',
  ],
  [
    '*.............*',
    'H#####...#####H',
    'H.....H.H.....H',
    'H..*..H.H..*..H',
    'H#####H.H#####H',
    'H.....H.H.....H',
    'H-----H*H-----H',
    'H.....H#H.....H',
    'H..E..H.H..*..H',
    'H#H#######H#H#H',
    'H.H.......H.H.H',
    'H.H.......H.H.H',
    'H.H.P.*.E.H*H.H',
    '===============',
  ],
  [
    '..E.........E..',
    '-------H-------',
    '.*.....H.....*.',
    '###H#######H###',
    '...H.......H...',
    '.*.H.......H.*.',
    '######H.H######',
    '......H.H......',
    '..*...H*H...*..',
    '==H=========H==',
    '..H----*----H..',
    '..H.........H..',
    '*.H....P....H.*',
    '===============',
  ],
  [
    '.......H.......',
    '.*.E...H...E.*.',
    '####H##H##H####',
    '....H..H..H....',
    '.*..H.*H*.H..*.',
    '#=#=#==H==#=#=#',
    '.......H.......',
    '.-----.H.-----.',
    '.*...H.H.H...*.',
    '#####H###H#####',
    '.....H...H.....',
    '..*..H.P.H..*..',
    '###############',
    '===============',
  ],
];

export function parse(rows) {
  const grid = []; let player = null; const enemies = []; let gems = 0;
  rows.forEach((row, r) => {
    for (let c = 0; c < COLS; c++) {
      let ch = row[c] ?? '.';
      if (ch === 'P') { player = { r, c }; ch = '.'; }
      if (ch === 'E') { enemies.push({ r, c }); ch = '.'; }
      if (ch === '*') gems++;
      grid.push(ch);
    }
  });
  return { grid, player, enemies, gems };
}

export const at = (grid, r, c) => (r < 0 || r >= ROWS || c < 0 || c >= COLS ? '=' : grid[r * COLS + c]);
/** Solid for walking/standing. `dug` = Set of brick indexes currently dug out. */
export const solid = (grid, dug, r, c) => {
  const t = at(grid, r, c);
  if (t === '=') return true;
  if (t === '#') return !dug?.has(r * COLS + c);
  return false;
};

/** Can something at (r,c) stand still (not fall)? `occupied(r,c)` reports a trapped/standing body below. */
export function supported(grid, dug, r, c, occupied) {
  if (r >= ROWS - 1) return true;
  const here = at(grid, r, c);
  if (here === 'H' || here === '-') return true;
  const below = at(grid, r + 1, c);
  if (below === 'H') return true;
  if (solid(grid, dug, r + 1, c)) return true;
  return Boolean(occupied && occupied(r + 1, c));
}

/** Legal single steps from (r,c): { dir, r, c } including 'fall' when unsupported. */
export function moves(grid, dug, r, c, occupied) {
  if (!supported(grid, dug, r, c, occupied)) return [{ dir: 'fall', r: r + 1, c }];
  const out = [];
  if (!solid(grid, dug, r, c - 1) && c > 0) out.push({ dir: 'left', r, c: c - 1 });
  if (!solid(grid, dug, r, c + 1) && c < COLS - 1) out.push({ dir: 'right', r, c: c + 1 });
  if (at(grid, r, c) === 'H' && r > 0 && !solid(grid, dug, r - 1, c)) out.push({ dir: 'up', r: r - 1, c });
  if (r < ROWS - 1 && !solid(grid, dug, r + 1, c) && !(occupied && occupied(r + 1, c))) out.push({ dir: 'down', r: r + 1, c });
  return out;
}

/** Cells reachable from (r,c) without digging (for level checks). */
export function reachable(grid, r, c) {
  const seen = new Set([r * COLS + c]);
  const q = [[r, c]];
  while (q.length) {
    const [cr, cc] = q.shift();
    for (const m of moves(grid, null, cr, cc)) {
      const k = m.r * COLS + m.c;
      if (!seen.has(k)) { seen.add(k); q.push([m.r, m.c]); }
    }
  }
  return seen;
}

/** First step on a shortest path from (r,c) to the target (for enemies). */
export function chaseStep(grid, dug, from, to, occupied) {
  const key = (r, c) => r * COLS + c;
  const prev = new Map([[key(from.r, from.c), null]]);
  const q = [[from.r, from.c]];
  while (q.length) {
    const [r, c] = q.shift();
    if (r === to.r && c === to.c) break;
    for (const m of moves(grid, dug, r, c, occupied)) {
      const k = key(m.r, m.c);
      if (prev.has(k)) continue;
      prev.set(k, { r, c, dir: m.dir });
      q.push([m.r, m.c]);
    }
  }
  let k = key(to.r, to.c);
  if (!prev.has(k)) return null;
  let step = null;
  while (prev.get(k)) { const p = prev.get(k); step = { r: Math.floor(k / COLS), c: k % COLS, dir: p.dir }; k = key(p.r, p.c); }
  return step;
}

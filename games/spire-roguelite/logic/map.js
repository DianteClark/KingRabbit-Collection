// The branching path map for one act: ROWS floors of rooms and a boss at the top.
// Paths only go up, to the room straight above or one column over, and never cross.

import { next, int, weighted } from './rng.js';

export const ROWS = 12;
export const COLS = 7;
export const TREASURE_ROW = 6;
const PATHS = 6;

export const NODE_TYPES = {
  fight: { name: 'Fight', desc: 'A fight against monsters. Win cards and gold.' },
  elite: { name: 'Elite', desc: 'A dangerous fight. Always drops a relic.' },
  event: { name: 'Unknown', desc: 'Something strange: a choice, a deal or a trap.' },
  rest: { name: 'Campfire', desc: 'Rest to heal, or upgrade a card.' },
  shop: { name: 'Merchant', desc: 'Buy cards, relics and potions, or remove a card.' },
  treasure: { name: 'Treasure', desc: 'A chest with a relic inside.' },
  boss: { name: 'Boss', desc: 'The guardian of this act.' },
};

const key = (r, c) => `${r},${c}`;

export function generateMap(rng) {
  const edges = new Map(); // "r,c" -> Set(next col)
  const add = (r, c, nc) => {
    if (!edges.has(key(r, c))) edges.set(key(r, c), new Set());
    edges.get(key(r, c)).add(nc);
  };
  const has = (r, c, nc) => edges.get(key(r, c))?.has(nc);

  const starts = [];
  for (let p = 0; p < PATHS; p++) {
    let c = int(rng, 0, COLS - 1);
    if (p === 1) while (c === starts[0]) c = int(rng, 0, COLS - 1);
    starts.push(c);
    for (let r = 0; r < ROWS - 1; r++) {
      const opts = [c - 1, c, c + 1].filter((nc) => nc >= 0 && nc < COLS).filter((nc) => {
        if (nc === c + 1 && has(r, c + 1, c)) return false; // would cross
        if (nc === c - 1 && has(r, c - 1, c)) return false;
        return true;
      });
      const nc = opts[Math.floor(next(rng) * opts.length)];
      add(r, c, nc);
      c = nc;
    }
    add(ROWS - 1, c, -1); // marks the top room as used
  }

  // Build nodes.
  const nodes = [];
  const byPos = new Map();
  const ensure = (r, c) => {
    if (byPos.has(key(r, c))) return byPos.get(key(r, c));
    const n = { id: nodes.length, row: r, col: c, type: null, next: [], prev: [], jx: int(rng, -7, 7), jy: int(rng, -6, 6) };
    nodes.push(n);
    byPos.set(key(r, c), n);
    return n;
  };
  for (const [k, set] of edges) {
    const [r, c] = k.split(',').map(Number);
    const n = ensure(r, c);
    for (const nc of set) {
      if (nc < 0) continue;
      const m = ensure(r + 1, nc);
      if (!n.next.includes(m.id)) n.next.push(m.id);
      if (!m.prev.includes(n.id)) m.prev.push(n.id);
    }
  }
  const boss = { id: nodes.length, row: ROWS, col: 3, type: 'boss', next: [], prev: [], jx: 0, jy: 0 };
  nodes.push(boss);
  for (const n of nodes) if (n.row === ROWS - 1) { n.next.push(boss.id); boss.prev.push(n.id); }

  // Room types, bottom to top.
  const sorted = nodes.filter((n) => n.type === null).sort((a, b) => a.row - b.row || a.col - b.col);
  for (const n of sorted) n.type = pickType(rng, n, nodes);
  // Every act gets at least one merchant.
  if (!nodes.some((n) => n.type === 'shop')) {
    const cands = nodes.filter((n) => n.type === 'event' && n.row >= 3 && n.row <= 9);
    const pool = cands.length ? cands : nodes.filter((n) => n.type === 'fight' && n.row >= 3 && n.row <= 9);
    if (pool.length) pool[Math.floor(next(rng) * pool.length)].type = 'shop';
  }
  return { nodes, boss: boss.id };
}

function pickType(rng, n, nodes) {
  if (n.row === 0) return 'fight';
  if (n.row === TREASURE_ROW) return 'treasure';
  if (n.row === ROWS - 1) return 'rest';
  const parents = n.prev.map((id) => nodes[id]);
  const siblings = parents.flatMap((p) => p.next.map((id) => nodes[id])).filter((s) => s !== n && s.type);
  const banned = new Set();
  for (const p of parents) if (['elite', 'rest', 'shop'].includes(p.type)) banned.add(p.type);
  const entries = [['fight', 46], ['event', 24]];
  if (n.row >= 4) entries.push(['elite', 10]);
  if (n.row >= 4 && n.row !== ROWS - 2) entries.push(['rest', 11]);
  if (n.row >= 2) entries.push(['shop', 6]);
  let opts = entries.filter(([t]) => !banned.has(t));
  // Try not to give two branches from the same room the same special type.
  const sibTypes = new Set(siblings.map((s) => s.type).filter((t) => t !== 'fight'));
  const varied = opts.filter(([t]) => !sibTypes.has(t));
  if (varied.length) opts = varied;
  return weighted(rng, opts);
}

/** Rooms you can walk to from where you stand (pos = node id, or null at the start of an act). */
export function reachable(map, pos) {
  if (pos === null || pos === undefined) return map.nodes.filter((n) => n.row === 0).map((n) => n.id);
  return map.nodes[pos].next;
}

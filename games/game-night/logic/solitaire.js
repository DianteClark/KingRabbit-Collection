// Klondike solitaire, draw one, unlimited passes through the stock.
// Card: { suit: 0..3 (spade, heart, club, diamond), rank: 1..13, up: bool }

export const SUITS = ['spade', 'heart', 'club', 'diamond'];
export const isRed = (c) => c.suit === 1 || c.suit === 3;
export const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function deal(rng = Math.random) {
  const deck = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ suit: s, rank: r, up: false });
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const tableau = [];
  for (let col = 0; col < 7; col++) {
    const pile = deck.splice(0, col + 1);
    pile[pile.length - 1].up = true;
    tableau.push(pile);
  }
  return { stock: deck, waste: [], foundations: [[], [], [], []], tableau, moves: 0 };
}

const clone = (g) => ({
  stock: g.stock.map((c) => ({ ...c })),
  waste: g.waste.map((c) => ({ ...c })),
  foundations: g.foundations.map((p) => p.map((c) => ({ ...c }))),
  tableau: g.tableau.map((p) => p.map((c) => ({ ...c }))),
  moves: g.moves,
});

const top = (pile) => pile[pile.length - 1];

export function canFound(g, card) {
  const f = g.foundations[card.suit];
  return f.length ? top(f).rank === card.rank - 1 : card.rank === 1;
}

export function canStack(pile, card) {
  if (!pile.length) return card.rank === 13;
  const t = top(pile);
  return t.up && isRed(t) !== isRed(card) && t.rank === card.rank + 1;
}

/** Flip the stock (or recycle the waste when the stock is empty). */
export function drawStock(g) {
  const n = clone(g);
  if (n.stock.length) {
    const c = n.stock.pop(); c.up = true; n.waste.push(c);
  } else if (n.waste.length) {
    n.stock = n.waste.reverse().map((c) => ({ ...c, up: false }));
    n.waste = [];
  } else return null;
  n.moves++;
  return n;
}

/**
 * A "source" is where a tapped card lives: { from: 'waste' } | { from: 'foundation', i } |
 * { from: 'tableau', i, k } (k = index of the tapped card in the column).
 * Returns the best destination: foundation first (single cards), else a tableau column.
 */
export function bestMove(g, src) {
  const cards = pick(g, src);
  if (!cards) return null;
  const first = cards[0];
  if (cards.length === 1 && src.from !== 'foundation' && canFound(g, first)) return { to: 'foundation', i: first.suit };
  // Prefer non-empty columns, then empty ones (only kings fit); skip moving a king from an empty-based column to another empty one.
  const order = [...g.tableau.keys()].sort((a, b) => (g.tableau[b].length ? 1 : 0) - (g.tableau[a].length ? 1 : 0));
  for (const i of order) {
    if (src.from === 'tableau' && src.i === i) continue;
    if (!g.tableau[i].length && src.from === 'tableau' && src.k === 0) continue;
    if (canStack(g.tableau[i], first)) return { to: 'tableau', i };
  }
  return null;
}

function pick(g, src) {
  if (src.from === 'waste') return g.waste.length ? [top(g.waste)] : null;
  if (src.from === 'foundation') return g.foundations[src.i].length ? [top(g.foundations[src.i])] : null;
  const col = g.tableau[src.i];
  const c = col[src.k];
  if (!c || !c.up) return null;
  return col.slice(src.k);
}

export function move(g, src, dst) {
  const n = clone(g);
  let cards;
  if (src.from === 'waste') cards = [n.waste.pop()];
  else if (src.from === 'foundation') cards = [n.foundations[src.i].pop()];
  else cards = n.tableau[src.i].splice(src.k);
  if (dst.to === 'foundation') n.foundations[dst.i].push(...cards);
  else n.tableau[dst.i].push(...cards);
  if (src.from === 'tableau') {
    const t = top(n.tableau[src.i]);
    if (t && !t.up) t.up = true;
  }
  n.moves++;
  return n;
}

export const won = (g) => g.foundations.every((f) => f.length === 13);

/** True when everything left is face up: the game can finish itself. */
export const canAutoFinish = (g) => !g.stock.length && !g.waste.length && g.tableau.every((p) => p.every((c) => c.up));

/** One automatic step toward the foundations (lowest card first), or null. */
export function autoStep(g) {
  let best = null;
  const consider = (src, card) => {
    if (card && canFound(g, card) && (!best || card.rank < best.card.rank)) best = { src, card };
  };
  if (g.waste.length) consider({ from: 'waste' }, top(g.waste));
  g.tableau.forEach((p, i) => { if (p.length) consider({ from: 'tableau', i, k: p.length - 1 }, top(p)); });
  return best ? move(g, best.src, { to: 'foundation', i: best.card.suit }) : null;
}

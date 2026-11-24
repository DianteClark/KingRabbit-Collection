import { test } from 'node:test';
import assert from 'node:assert/strict';

const L = new URL('../games/game-night/logic/', import.meta.url).href;
const Sol = await import(L + 'solitaire.js');
const Wild = await import(L + 'wildcards.js');
const Box = await import(L + 'sokoban.js');
const Six = await import(L + 'columns.js');
const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

test('solitaire: deal shape and basic moves', () => {
  const g = Sol.deal(seeded(1));
  assert.equal(g.stock.length, 24);
  g.tableau.forEach((p, i) => { assert.equal(p.length, i + 1); assert.ok(p[i].up); });
  // Every card exists exactly once.
  const all = [...g.stock, ...g.tableau.flat()].map((c) => c.suit * 13 + c.rank);
  assert.equal(new Set(all).size, 52);
  // Drawing through the whole stock and recycling keeps 24 cards.
  let s = g;
  for (let k = 0; k < 25; k++) s = Sol.drawStock(s);
  assert.equal(s.stock.length + s.waste.length, 24);
  assert.ok(Sol.canStack([{ suit: 0, rank: 8, up: true }], { suit: 1, rank: 7 }));
  assert.ok(!Sol.canStack([{ suit: 0, rank: 8, up: true }], { suit: 2, rank: 7 }));
  assert.ok(Sol.canStack([], { suit: 2, rank: 13 }));
});

test('solitaire: auto-finish completes a fully revealed game', () => {
  // Build a won-able layout: four columns of K..A alternating colours, all face up.
  const g = { stock: [], waste: [], foundations: [[], [], [], []], tableau: [[], [], [], [], [], [], []], moves: 0 };
  for (let s = 0; s < 4; s++) for (let r = 13; r >= 1; r--) g.tableau[s].push({ suit: s, rank: r, up: true });
  assert.ok(Sol.canAutoFinish(g));
  let s = g; let n = 0;
  while (!Sol.won(s) && n++ < 100) s = Sol.autoStep(s);
  assert.ok(Sol.won(s));
});

test('wild cards: deck, matching and a full CPU-only round finishes', () => {
  assert.equal(Wild.newDeck(seeded(2)).length, 108);
  const rng = seeded(4);
  const r = Wild.newRound(3, rng);
  assert.equal(typeof Wild.top(r).value, 'number');
  let turns = 0;
  while (Wild.winner(r) < 0 && turns++ < 2000) {
    const p = r.turn;
    let i = Wild.cpuPick(r, p);
    if (i < 0) {
      const d = Wild.drawOne(r);
      if (Wild.canPlay(r, r.hands[p][d])) i = d; else { Wild.passTurn(r); continue; }
    }
    Wild.play(r, p, i, Wild.favouriteColor(r.hands[p]));
    // Card count is conserved: 108 total.
    const total = r.deck.length + r.discard.length + r.hands.reduce((s, h) => s + h.length, 0);
    assert.equal(total, 108);
  }
  assert.ok(Wild.winner(r) >= 0, 'someone wins');
});

test('wild cards: skip, reverse and draw two', () => {
  const r = Wild.newRound(3, seeded(9));
  r.color = 0; r.discard.push({ color: 0, value: 5 });
  r.hands[0] = [{ color: 0, value: 'skip' }, { color: 0, value: 'reverse' }, { color: 0, value: 'draw2' }, { color: 1, value: 1 }];
  r.turn = 0; r.dir = 1;
  Wild.play(r, 0, 0);
  assert.equal(r.turn, 2);                          // player 1 skipped
  r.turn = 0;
  Wild.play(r, 0, 0);                               // reverse
  assert.equal(r.dir, -1); assert.equal(r.turn, 2);
  r.turn = 0; r.dir = 1;
  const before = r.hands[1].length;
  Wild.play(r, 0, 0);                               // draw two
  assert.equal(r.hands[1].length, before + 2); assert.equal(r.turn, 2);
});

test('box box: every level is solvable and none starts solved', () => {
  Box.LEVELS.forEach((rows, i) => {
    const lv = Box.parse(rows);
    assert.equal(lv.boxes.size, lv.goals.size, `level ${i + 1} boxes = goals`);
    assert.ok(!Box.solved(lv, lv), `level ${i + 1} not already solved`);
    assert.ok(Box.solve(rows) > 0, `level ${i + 1} solvable`);
  });
});

test('six ball: matching, gravity and chains', () => {
  const g = Six.newGame(seeded(1));
  // Horizontal three on the bottom row.
  const y = Six.H - 1;
  g.grid[y * Six.W] = 2; g.grid[y * Six.W + 1] = 2; g.grid[y * Six.W + 2] = 2;
  g.grid[(y - 1) * Six.W] = 5;                      // sits on top and should fall
  const hit = Six.resolveOnce(g, 1);
  assert.equal(hit.size, 3);
  assert.equal(g.grid[y * Six.W], 5);
  assert.equal(g.score, 30);
  // Diagonal match is found.
  const d = new Array(Six.W * Six.H).fill(0);
  d[12 * 6 + 0] = 3; d[11 * 6 + 1] = 3; d[10 * 6 + 2] = 3;
  assert.equal(Six.findMatches(d).size, 3);
  // Piece moves, cycles, lands and locks.
  Six.spawn(g);
  const gems = g.piece.gems.slice();
  Six.cycle(g);
  assert.deepEqual(g.piece.gems, [gems[2], gems[0], gems[1]]);
  assert.ok(Six.move(g, -1));
  Six.hardDrop(g); Six.lock(g);
  assert.ok(!g.over);
});

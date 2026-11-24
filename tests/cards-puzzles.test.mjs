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
  if (r.color === null) r.color = 0;   // opening wild: first player picks
  let turns = 0;
  while (Wild.winner(r) < 0 && turns++ < 2000) {
    const p = r.turn;
    let i = Wild.cpuPick(r, p);
    if (i < 0) {
      const d = Wild.drawOne(r);
      if (Wild.canPlay(r, r.hands[p][d])) i = d; else { Wild.passTurn(r); continue; }
    }
    const ev = Wild.play(r, p, i, Wild.favouriteColor(r.hands[p]));
    if (ev.effect === 'wild4') Wild.resolveWild4(r, false);
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

test('wild cards: +4 legality and challenges, scoring, opening cards', () => {
  const r = Wild.newRound(3, seeded(12));
  r.color = 1; r.discard.push({ color: 1, value: 3 }); r.turn = 0; r.dir = 1;
  r.hands[0] = [{ color: null, value: 'wild4' }, { color: 1, value: 7 }, { color: 2, value: 2 }];
  assert.equal(Wild.wild4Legal(r, 0), false);           // holds an orange card
  const before0 = r.hands[0].length;
  Wild.play(r, 0, 0, 2);
  assert.equal(Wild.resolveWild4(r, true), 'caught');   // bluff caught: offender draws 4
  assert.equal(r.hands[0].length, before0 - 1 + 4);
  assert.equal(r.turn, 1);
  // A legal +4 that gets challenged costs the challenger 6.
  r.turn = 0; r.color = 3;
  r.hands[0] = [{ color: null, value: 'wild4' }, { color: 1, value: 7 }];
  const before1 = r.hands[1].length;
  Wild.play(r, 0, 0, 2);
  assert.equal(Wild.resolveWild4(r, true), 'failed');
  assert.equal(r.hands[1].length, before1 + 6);
  assert.equal(r.turn, 2);
  // Points: numbers face value, actions 20, wilds 50.
  assert.equal(Wild.handPoints([{ color: 0, value: 7 }, { color: 1, value: 'skip' }, { color: null, value: 'wild' }]), 77);
  // Opening cards never start on a Wild Draw Four, and their effects apply.
  for (let sd = 1; sd < 200; sd++) {
    const g = Wild.newRound(3, seeded(sd));
    assert.notEqual(Wild.top(g).value, 'wild4');
    if (g.startEffect === 'skip') assert.equal(g.turn, 1);
    if (g.startEffect === 'reverse') { assert.equal(g.turn, 2); assert.equal(g.dir, -1); }
    if (g.startEffect === 'draw2') { assert.equal(g.hands[0].length, 9); assert.equal(g.turn, 1); }
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';

const L = new URL('../games/game-night/logic/', import.meta.url).href;
const Chess = await import(L + 'chess.js');
const Checkers = await import(L + 'checkers.js');
const Go = await import(L + 'go.js');
const BG = await import(L + 'backgammon.js');
const Dom = await import(L + 'dominoes.js');
const Sea = await import(L + 'seabattle.js');

// Seeded random so CPU-vs-CPU tests are repeatable.
const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

function fen(f) {
  const [placement, turn, castling, ep] = f.split(' ');
  const board = [];
  for (const ch of placement.replaceAll('/', '')) {
    if (/\d/.test(ch)) for (let k = 0; k < +ch; k++) board.push(null); else board.push(ch);
  }
  const castle = { K: castling.includes('K'), Q: castling.includes('Q'), k: castling.includes('k'), q: castling.includes('q') };
  const epIdx = ep === '-' ? -1 : (8 - +ep[1]) * 8 + (ep.charCodeAt(0) - 97);
  return { board, turn, castle, ep: epIdx, half: 0 };
}
function perft(s, d) {
  if (d === 0) return 1;
  let n = 0;
  for (const m of Chess.legalMoves(s)) n += perft(Chess.makeMove(s, m), d - 1);
  return n;
}

test('chess move generation matches known perft counts', () => {
  const start = Chess.newGame();
  assert.equal(perft(start, 1), 20);
  assert.equal(perft(start, 2), 400);
  assert.equal(perft(start, 3), 8902);
  // "Kiwipete": castling, en passant, pins, promotions. Promotions are queen-only here,
  // so compare the depth-1 count (no promotions possible yet) and depth 2 (also none).
  const kiwi = fen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -');
  assert.equal(perft(kiwi, 1), 48);
  assert.equal(perft(kiwi, 2), 2039);
  // Position 3 (en passant + checks), no promotions within depth 3.
  const p3 = fen('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - -');
  assert.equal(perft(p3, 1), 14);
  assert.equal(perft(p3, 2), 191);
  assert.equal(perft(p3, 3), 2812);
});

test('chess: mate detection and the CPU finds mate in one', () => {
  // Fool's mate position, white to move is checkmated.
  let s = Chess.newGame();
  const mv = (from, to) => { const m = Chess.legalMoves(s).find((x) => x.from === from && x.to === to); assert.ok(m); s = Chess.makeMove(s, m); };
  const sq = (n) => (8 - +n[1]) * 8 + (n.charCodeAt(0) - 97);
  mv(sq('f2'), sq('f3')); mv(sq('e7'), sq('e5')); mv(sq('g2'), sq('g4'));
  const mate = Chess.cpuMove(s);
  assert.equal(mate.to, sq('h4'));
  s = Chess.makeMove(s, mate);
  assert.deepEqual(Chess.status(s), { result: 'checkmate', winner: 'b' });
});

test('chess CPU answers quickly', () => {
  let s = Chess.newGame();
  let slowest = 0;
  for (let i = 0; i < 12; i++) {
    const t = Date.now();
    const m = Chess.cpuMove(s);
    slowest = Math.max(slowest, Date.now() - t);
    s = Chess.makeMove(s, m);
    if (Chess.status(s)) break;
  }
  assert.ok(slowest < 2500, `slowest move ${slowest}ms`);
});

test('checkers: forced capture and multi-jump', () => {
  const b = new Array(64).fill(null);
  b[5 * 8 + 2] = 'd';             // dark man
  b[4 * 8 + 3] = 'l';             // jumpable
  b[2 * 8 + 5] = 'l';             // second jump target
  b[5 * 8 + 6] = 'd';             // another dark man that could step
  const moves = Checkers.legalMoves(b, 'd');
  assert.equal(moves.length, 1);  // capture is mandatory
  assert.deepEqual(moves[0].captured.length, 2);
  assert.equal(moves[0].to, 1 * 8 + 6);
});

test('checkers: crowning, and CPU vs CPU finishes', () => {
  const b = new Array(64).fill(null);
  b[1 * 8 + 2] = 'd';
  const m = Checkers.legalMoves(b, 'd').find((x) => x.to === 1);
  assert.equal(Checkers.play(b, m)[1], 'D');
  let board = Checkers.newBoard(); let turn = 'd'; let n = 0;
  const rng = seeded(7);
  while (!Checkers.winnerIfStuck(board, turn) && n < 300) {
    board = Checkers.play(board, Checkers.cpuMove(board, turn, { depth: 3, rng })); turn = Checkers.other(turn); n++;
  }
  assert.ok(n > 10);
});

test('go: capture, suicide, ko and scoring', () => {
  let g = Go.newGame();
  const at = (r, c) => r * 9 + c;
  // Black surrounds a white stone at (1,1).
  const seq = [[0, 1], [1, 1], [1, 0], [8, 8], [1, 2], [8, 7], [2, 1]];
  for (const [r, c] of seq) g = Go.play(g, at(r, c));
  assert.equal(g.board[at(1, 1)], 0);
  assert.equal(g.captures[1], 1);
  // White can't play back into (1,1): suicide.
  assert.equal(Go.tryMove(g, at(1, 1)), null);
  // Ko: set up a classic shape.
  let k = Go.newGame();
  for (const [r, c] of [[0, 1], [0, 2], [1, 0], [1, 3], [2, 1], [2, 2], [8, 8], [1, 1]]) k = Go.play(k, at(r, c));
  // White's (1,1) is now in atari; black captures at (1,2)...
  k = Go.play(k, at(1, 2));
  assert.equal(k.board[at(1, 1)], 0);
  // ...and white may not immediately recapture.
  assert.equal(Go.tryMove(k, at(1, 1)), null);
  const sc = Go.score(new Array(81).fill(1));
  assert.equal(sc.black, 81);
});

test('go CPU vs CPU reaches the end', () => {
  let g = Go.newGame(); const rng = seeded(3); let n = 0;
  while (!Go.isOver(g) && n < 400) {
    const m = Go.cpuMove(g, { rng });
    g = m < 0 ? Go.pass(g) : Go.play(g, m);
    n++;
  }
  assert.ok(Go.isOver(g));
});

test('backgammon: opening sequences, bar entry and a full CPU game', () => {
  const s = BG.newGame();
  const seqs = BG.turnSequences(s, [3, 1]);
  assert.ok(seqs.length > 5);
  assert.ok(seqs.every((r) => r.moves.length === 2));
  // A checker on the bar must enter first.
  const b = BG.newGame(); b.bar[0] = 1;
  assert.ok(BG.singleMoves(b, 0, 3).every((m) => m.from === 'bar'));
  // Totals stay at 15 checkers each through a whole CPU game.
  let g = BG.newGame(); const rng = seeded(11); let turns = 0;
  while (BG.winner(g) === null && turns < 600) {
    const pick = BG.cpuTurn(g, BG.rollDice(rng));
    g = pick ? pick.state : g;
    g = { ...g, turn: BG.other(g.turn) };
    for (const p of [0, 1]) {
      let total = g.bar[p] + g.off[p];
      for (let i = 1; i <= 24; i++) if (g.pts[i].owner === p) total += g.pts[i].n;
      assert.equal(total, 15);
    }
    turns++;
  }
  assert.notEqual(BG.winner(g), null);
});

test('dominoes: highest double leads, spinner opens 4 ways, full round', () => {
  assert.equal(Dom.fullSet().length, 28);
  for (let seed = 1; seed < 40; seed++) {
    let r = Dom.newRound(seeded(seed));
    const leadTile = r.hands[r.lead.p][r.lead.i];
    // Only the lead tile can start the game.
    assert.equal(Dom.playable(r, r.turn).length, 1);
    r = Dom.playTile(r, r.turn, r.lead.i, 'center');
    assert.deepEqual(r.center, leadTile);
    if (leadTile[0] === leadTile[1]) {
      assert.ok(r.spinner);
      assert.equal(Dom.ends(r).length, 2);           // up/down not open yet
    }
    let guard = 0; let sawFour = false;
    while (!Dom.roundResult(r) && guard++ < 200) {
      const p = r.turn;
      const c = Dom.cpuChoice(r, p);
      if (c) r = Dom.playTile(r, p, c.i, c.side);
      else if (r.boneyard.length) r = Dom.draw(r, p);
      else r = Dom.passTurn(r);
      if (Dom.ends(r).length === 4) sawFour = true;
      // Every arm chains correctly: each tile's inner value matches the previous outer value.
      for (const side of Dom.SIDES) {
        const arm = r.arms[side];
        const base = side === 'right' ? r.center[1] : r.center[0];
        arm.forEach((t, k) => assert.equal(t[0], k === 0 ? base : arm[k - 1][1]));
      }
    }
    assert.ok(Dom.roundResult(r));
    if (r.spinner && r.arms.up.length) assert.ok(sawFour);
    // 28 tiles are always accounted for.
    assert.equal(Dom.tileCount(r) + r.boneyard.length + r.hands[0].length + r.hands[1].length, 28);
  }
});

test('sea battle: fleets never overlap and the CPU sinks a fleet in reasonable time', () => {
  const rng = seeded(9);
  for (let t = 0; t < 50; t++) {
    const fleet = Sea.randomFleet(rng);
    const all = fleet.flatMap((s) => s.cells);
    assert.equal(new Set(all).size, 17);
    assert.deepEqual(fleet.map((s) => s.name), Sea.NAMES);
  }
  assert.equal(Sea.shipCells(8, 3, true), null);            // runs off the right edge
  let total = 0;
  for (let g = 0; g < 10; g++) {
    const fleet = Sea.randomFleet(rng); const shots = new Map(); const sunk = new Set(); let n = 0;
    while (!Sea.allSunk(fleet) && n < 100) {
      const remaining = fleet.filter((s) => s.hits < s.cells.length).map((s) => s.cells.length);
      const res = Sea.fire(fleet, shots, Sea.cpuTarget(shots, sunk, remaining, rng));
      if (res.result === 'sunk') res.ship.cells.forEach((c) => sunk.add(c));
      n++;
    }
    assert.ok(Sea.allSunk(fleet));
    total += n;
  }
  assert.ok(total / 10 < 75, `average ${total / 10} shots`);
});

test('chess: under-promotion and threefold repetition', () => {
  const s = fen('8/P7/8/8/8/8/8/k6K w - -');
  const m = Chess.legalMoves(s).find((x) => x.promo);
  assert.equal(Chess.makeMove(s, { ...m, promoTo: 'N' }).board[m.to], 'N');
  assert.equal(Chess.makeMove(s, m).board[m.to], 'Q');
  // Knights shuffling back and forth repeat the start position.
  let g = Chess.newGame();
  const hist = new Map([[Chess.positionKey(g), 1]]);
  const sq = (n) => (8 - +n[1]) * 8 + (n.charCodeAt(0) - 97);
  const seq = [['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8'], ['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8']];
  for (const [a, b] of seq) {
    g = Chess.makeMove(g, Chess.legalMoves(g).find((x) => x.from === sq(a) && x.to === sq(b)));
    const k = Chess.positionKey(g); hist.set(k, (hist.get(k) || 0) + 1);
  }
  assert.equal(Chess.status(g, hist).result, 'repetition');
});

test('go: dead stones are suggested and removed for scoring', () => {
  const b = new Array(81).fill(0);
  // Black owns the left side with a wall on column 4; a lone white stone sits inside.
  for (let r = 0; r < 9; r++) b[r * 9 + 4] = 1;
  for (let r = 0; r < 9; r++) b[r * 9 + 5] = 2;
  b[4 * 9 + 1] = 2;
  const dead = Go.suggestDead(b);
  assert.ok(dead.has(4 * 9 + 1));
  assert.ok(!dead.has(4));
  const sc = Go.finalScore(b, dead);
  assert.equal(sc.black, 45);           // columns 0-4
  assert.equal(sc.white, 36 + Go.KOMI); // columns 5-8
  // Toggling brings it back.
  assert.ok(!Go.toggleDead(b, dead, 4 * 9 + 1).has(4 * 9 + 1));
});

test('backgammon: opening roll and gammon scoring', () => {
  const o = BG.openingRoll(seeded(3));
  assert.notEqual(o.dice[0], o.dice[1]);
  assert.equal(o.first, o.dice[0] > o.dice[1] ? 0 : 1);
  const s = BG.newGame();
  s.off[0] = 15; for (let i = 1; i <= 24; i++) if (s.pts[i].owner === 0) s.pts[i] = { owner: null, n: 0 };
  assert.equal(BG.winType(s, 0).points, 3);   // dark still has 2 on point 1 = light's home
  s.pts[1] = { owner: null, n: 0 }; s.pts[12].n += 2;
  assert.equal(BG.winType(s, 0).points, 2);
  s.off[1] = 1; s.pts[12].n -= 1;
  assert.equal(BG.winType(s, 0).points, 1);
});

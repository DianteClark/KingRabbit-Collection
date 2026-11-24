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

test('dominoes: set, matching and a full round', () => {
  assert.equal(Dom.fullSet().length, 28);
  let r = Dom.newRound(seeded(5)); let guard = 0;
  while (!Dom.roundResult(r) && guard++ < 200) {
    const p = r.turn;
    const c = Dom.cpuChoice(r, p);
    if (c) r = Dom.playTile(r, p, c.i, c.side);
    else if (r.boneyard.length) r = Dom.draw(r, p);
    else r = Dom.passTurn(r);
  }
  const res = Dom.roundResult(r);
  assert.ok(res);
  // Every adjacent pair in the chain matches.
  for (let i = 1; i < r.chain.length; i++) assert.equal(r.chain[i - 1][1], r.chain[i][0]);
});

test('sea battle: fleets never touch and the CPU sinks a fleet in reasonable time', () => {
  const rng = seeded(9);
  for (let t = 0; t < 30; t++) {
    const fleet = Sea.randomFleet(rng);
    const owner = new Map();
    fleet.forEach((s, k) => s.cells.forEach((c) => owner.set(c, k)));
    for (const [c, k] of owner) {
      const r = Math.floor(c / 10); const col = c % 10;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const n = (r + dr) * 10 + col + dc;
        if (r + dr < 0 || r + dr > 9 || col + dc < 0 || col + dc > 9) continue;
        if (owner.has(n)) assert.equal(owner.get(n), k);
      }
    }
  }
  const fleet = Sea.randomFleet(rng); const shots = new Map(); const sunk = new Set(); let n = 0;
  while (!Sea.allSunk(fleet) && n < 100) {
    const remaining = fleet.filter((s) => s.hits < s.cells.length).map((s) => s.cells.length);
    const res = Sea.fire(fleet, shots, Sea.cpuTarget(shots, sunk, remaining, rng));
    if (res.result === 'sunk') res.ship.cells.forEach((c) => sunk.add(c));
    n++;
  }
  assert.ok(Sea.allSunk(fleet));
  assert.ok(n < 80, `took ${n} shots`);
});

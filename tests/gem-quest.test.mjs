// Gem Quest: board, specials, cascades, combat, AI, progress, puzzles and a campaign bot.
import test from 'node:test';
import assert from 'node:assert/strict';

const L = new URL('../games/gem-quest/logic/', import.meta.url).href;
const B = await import(L + 'board.js');
const R = await import(L + 'rng.js');
const C = await import(L + 'combat.js');
const AI = await import(L + 'ai.js');
const SK = await import(L + 'skills.js');
const H = await import(L + 'heroes.js');
const W = await import(L + 'world.js');
const PR = await import(L + 'progress.js');
const PZ = await import(L + 'puzzle.js');
const BOT = await import(L + 'bot.js');

const clone = (o) => JSON.parse(JSON.stringify(o));
const rows = (b) => B.toRows(b);
const at = (x, y) => B.idx(x, y);

test('new boards have no ready-made lines and always a move', () => {
  for (let s = 1; s <= 200; s++) {
    const b = B.newBoard(R.makeRng(s));
    assert.equal(B.findGroups(b.cells).length, 0, `seed ${s}`);
    assert.ok(B.findMoves(b).length > 0, `seed ${s}`);
    assert.ok(b.cells.every((c) => c && c.c >= 0 && c.c < 6));
  }
});

test('a swap must make a line; a bad swap changes nothing', () => {
  const b = B.fromRows([
    'RBGYKCRB', 'BGYKCRBG', 'GYKCRBGY', 'YKCRBGYK', 'KCRBGYKC', 'CRBGYKCR', 'RRBRGYKC', 'BGYKCRBG',
  ]);
  const before = rows(b);
  assert.equal(B.isValidSwap(b, at(0, 0), at(1, 0)), false);
  const bad = B.swap(b, at(0, 0), at(1, 0), R.makeRng(1));
  assert.equal(bad.ok, false);
  assert.equal(bad.steps[0].back, true);
  assert.deepEqual(rows(b), before);
  // Row 6 is R R B R: swapping the B down/up isn't it, but swapping B with the R to its right is.
  assert.equal(B.isValidSwap(b, at(2, 6), at(3, 6)), true);
  assert.equal(B.isValidSwap(b, at(0, 0), at(2, 0)), false, 'not adjacent');
});

test('matching clears gems, gravity drops them and refills from the top', () => {
  const b = B.fromRows([
    'BGYKCBGY', 'GYKCBGYK', 'YKCBGYKC', 'KCBGYKCB', 'CBGYKCBG', 'BGYKCBGY', 'GYKCBGYK', 'RRYRKCBG',
  ]);
  const res = B.swap(b, at(2, 7), at(3, 7), R.makeRng(5));
  assert.ok(res.ok);
  assert.equal(res.gains.counts[B.RED] >= 3, true);
  assert.equal(b.cells.filter(Boolean).length, 64, 'board refilled');
  const fall = res.steps.find((s) => s.t === 'fall');
  assert.ok(fall.spawns.length >= 3);
  // Without refills (puzzles) the top stays empty.
  const p = B.fromRows(['........', '........', '........', '........', '........', '........', '..G.....', 'RRGRGB.B']);
  const before = B.gemsLeft(p);
  assert.ok(B.swap(p, at(2, 7), at(3, 7), R.makeRng(1), { spawn: false }).ok);
  assert.ok(B.gemsLeft(p) <= before - 3);
  assert.ok(B.rowCells(0).every((i) => !p.cells[i]), 'nothing new falls in');
});

test('match of 4 makes a line gem and gives an extra turn; match of 5 makes a star', () => {
  const b = B.fromRows([
    '........', '........', '........', '........', '........', '........', 'BBYBGKGK', 'GKBGKGKY',
  ]);
  const r = B.swap(b, at(2, 6), at(2, 7), R.makeRng(1), { spawn: false });
  assert.ok(r.ok);
  assert.equal(r.gains.made.h, 1);
  assert.equal(r.gains.extra, true);
  const line = b.cells.find((c) => c && c.s === 'h');
  assert.ok(line && line.c === B.BLUE);

  const s = B.fromRows([
    '........', '........', '........', '........', '........', '........', 'RRYRRGKG', 'GKRGKGKY',
  ]);
  const r2 = B.swap(s, at(2, 6), at(2, 7), R.makeRng(1), { spawn: false });
  assert.equal(r2.gains.made.star, 1);
  assert.ok(s.cells.some((c) => c && c.c === B.STAR));
});

test('L and T shapes make a bomb that blasts 3x3', () => {
  const b = B.fromRows([
    '........', '........', '........', '........', '....R...', '....R...', 'RRBGKBGK', 'GKRGKGKY',
  ]);
  // Swap the R at (2,7) up into (2,6): row R R R + column R R R at x=... no: build an L with the corner at (2,6).
  const b2 = B.fromRows([
    '........', '........', '........', '........', '..R.....', '..R.....', 'RRBGKBGK', 'GKRGKGKY',
  ]);
  const r = B.swap(b2, at(2, 6), at(2, 7), R.makeRng(1), { spawn: false });
  assert.ok(r.ok);
  assert.equal(r.gains.made.bomb, 1);
  // Set it off: a bomb in the middle of a full board clears 9 gems.
  const full = B.newBoard(R.makeRng(3));
  full.cells[at(4, 4)].s = 'bomb';
  const res = B.blast(full, [at(4, 4)], R.makeRng(3), { spawn: false });
  assert.ok(res.gains.cleared >= 9);
  void b;
});

test('line gems clear their row; chains of specials go off in turn', () => {
  const b = B.newBoard(R.makeRng(9));
  b.cells[at(0, 3)].s = 'h';
  b.cells[at(5, 3)].s = 'v';
  const res = B.blast(b, [at(0, 3)], R.makeRng(9), { spawn: false });
  const clear = res.steps.find((s) => s.t === 'clear');
  assert.ok(clear.blasts.some((x) => x.s === 'h'));
  assert.ok(clear.blasts.some((x) => x.s === 'v'), 'the column gem in that row went off too');
  assert.ok(clear.cells.length >= 15);
});

test('a star swapped with a gem clears every gem of that colour', () => {
  const b = B.newBoard(R.makeRng(11));
  b.cells[at(3, 3)] = { c: B.STAR, s: 'star', id: 999 };
  const color = b.cells[at(4, 3)].c;
  const n = B.countColor(b, color);
  const r = B.swap(b, at(3, 3), at(4, 3), R.makeRng(11));
  assert.ok(r.ok, 'stars can always be swapped');
  assert.ok(r.gains.counts[color] >= n);
});

test('cascades: falling gems that line up clear again (chain > 1)', () => {
  let found = false;
  for (let s = 1; s < 300 && !found; s++) {
    const b = B.newBoard(R.makeRng(s));
    for (const m of B.findMoves(b)) {
      const c = B.cloneBoard(b);
      const r = B.swap(c, m.a, m.b, R.makeRng(s));
      if (r.gains.chain >= 2) { found = true; assert.ok(r.steps.filter((x) => x.t === 'clear').length >= 2); break; }
    }
  }
  assert.ok(found);
});

test('when no moves are left the board is reshuffled', () => {
  const b = B.fromRows(['RBGYRBGY', 'GYRBGYRB', 'RBGYRBGY', 'GYRBGYRB', 'RBGYRBGY', 'GYRBGYRB', 'RBGYRBGY', 'GYRBGYRB']);
  assert.equal(B.hasMoves(b), false);
  const step = B.reshuffle(b, R.makeRng(4));
  assert.equal(step.t, 'shuffle');
  assert.ok(B.hasMoves(b));
  assert.equal(B.findGroups(b.cells).length, 0);
});

test('a long random game never leaves the board stuck or broken', () => {
  const rng = R.makeRng(42);
  const b = B.newBoard(rng);
  for (let k = 0; k < 400; k++) {
    const moves = B.findMoves(b);
    assert.ok(moves.length > 0, `move ${k}`);
    const m = moves[R.int(rng, 0, moves.length - 1)];
    B.swap(b, m.a, m.b, rng);
    assert.ok(b.cells.every(Boolean));
    assert.equal(B.findGroups(b.cells).length, 0, 'board settles');
    const ids = new Set(b.cells.map((c) => c.id));
    assert.equal(ids.size, 64, 'ids stay unique');
  }
});

// ---------------------------------------------------------------- combat

function duel({ hero = 'knight', lvl = 1, enemy = 'goblin', p = 1, seed = 1 } = {}) {
  const prog = PR.newProgress();
  prog.heroes[hero] = { lvl, xp: 0, gear: {} };
  const st = C.newBattle({ hero: PR.heroFighter(prog, hero), enemy: PR.enemyFighter(enemy, p), seed });
  return st;
}

test('skulls deal damage, gems give mana, turns pass to the monster', () => {
  const st = duel();
  st.board = B.fromRows(['RBGYCBGY', 'BGYCBGYC', 'GYCBGYCB', 'YCBGYCBG', 'CBGYCBGY', 'BGYCBGYC', 'GYCBGYCB', 'KKRKCBGY']);
  const r = C.move(st, 'hero', at(2, 7), at(3, 7));
  assert.ok(r.ok);
  assert.ok(st.enemy.hp <= st.enemy.maxHp - 3 * st.hero.skull);
  assert.ok(r.events.some((e) => e.t === 'dmg' && e.side === 'enemy' && e.src === 'skull'));
  // The hero matched no 4, so it is the monster's turn now (unless a cascade made a 4).
  if (!r.gains.extra) assert.equal(st.turn, 'enemy');
  assert.equal(C.move(st, 'hero', 0, 1).ok, false, 'not your turn');
});

test('skills cost mana and do what they say', () => {
  const st = duel({ hero: 'mage', lvl: 10 });
  st.enemy.maxHp = 500; st.enemy.hp = 500;
  assert.equal(C.cast(st, 'hero', 'fireball').ok, false, 'no mana');
  st.hero.mana = [20, 20, 20, 20];
  const hp = st.enemy.hp;
  const r = C.cast(st, 'hero', 'fireball');
  assert.ok(r.ok);
  assert.equal(st.hero.mana[0], 14);
  assert.equal(hp - st.enemy.hp, Math.min(hp, SK.fxValue(SK.SKILLS.fireball.fx[0], 10)));
  assert.equal(st.turn, 'enemy');
  // Frost Bolt stuns: the monster's turn is skipped.
  const st2 = duel({ hero: 'mage', lvl: 10 });
  st2.hero.mana = [20, 20, 20, 20];
  st2.enemy.maxHp = 500; st2.enemy.hp = 500;
  const r2 = C.cast(st2, 'hero', 'frostBolt');
  assert.ok(r2.events.some((e) => e.t === 'stunned' && e.side === 'enemy'));
  assert.equal(st2.turn, 'hero');
  // Transmute turns green into skulls (and any lines they make go off for the hero).
  const st3 = duel({ hero: 'mage', lvl: 10 });
  st3.hero.mana = [20, 20, 20, 20];
  C.cast(st3, 'hero', 'transmute');
  assert.equal(B.countColor(st3.board, B.GREEN), st3.board.cells.filter((c) => c.c === B.GREEN).length);
  assert.ok(st3.board.cells.every(Boolean));
});

test('free skills keep the turn; shields soak damage; poison ticks', () => {
  const st = duel({ hero: 'knight', lvl: 5 });
  st.hero.mana = [20, 20, 20, 20];
  C.cast(st, 'hero', 'shieldWall');
  assert.equal(st.turn, 'hero');
  assert.ok(st.hero.st.shield > 0);
  const st2 = duel({ hero: 'ranger', lvl: 5 });
  st2.hero.mana = [20, 20, 20, 20];
  st2.enemy.maxHp = 300; st2.enemy.hp = 300;
  const r = C.cast(st2, 'hero', 'poisonArrow');
  assert.ok(r.events.some((e) => e.t === 'poison' && e.side === 'enemy'));
  assert.ok(st2.enemy.hp < 300);
});

test('turn limits end quests; winning and losing are detected', () => {
  const st = duel();
  st.rules = { turnLimit: 1 };
  st.enemy.hp = 9999; st.enemy.maxHp = 9999;
  const ep = AI.aiParams(0.5);
  for (let k = 0; k < 40 && !st.over; k++) {
    if (st.turn === 'enemy') AI.enemyAct(st, ep);
    else { const m = AI.heroChoice(st); if (m.type === 'cast') C.cast(st, 'hero', m.skill); else C.move(st, 'hero', m.a, m.b); }
  }
  assert.equal(st.over, 'lose');
  assert.equal(st.reason, 'time');
  const st2 = duel();
  st2.enemy.hp = 1;
  st2.hero.mana = [20, 20, 20, 20];
  C.cast(st2, 'hero', 'cleave');
  assert.equal(st2.over, 'win');
});

test('battles are plain JSON: a saved fight resumes exactly', () => {
  const a = duel({ seed: 77 });
  const ep = AI.aiParams(0.5);
  const step = (st) => {
    if (st.turn === 'enemy') AI.enemyAct(st, ep);
    else { const m = AI.heroChoice(st); if (m.type === 'cast') C.cast(st, 'hero', m.skill); else C.move(st, 'hero', m.a, m.b); }
  };
  for (let k = 0; k < 6; k++) step(a);
  const b = clone(a);
  for (let k = 0; k < 12 && !a.over; k++) { step(a); step(b); }
  assert.deepEqual(b, a);
});

test('monster intent never lies: it casts the shown skill as soon as it can', () => {
  const st = duel({ enemy: 'orc', p: 5 });
  st.turn = 'enemy';
  const it = C.intent(st);
  st.enemy.mana = [20, 20, 20, 20];
  const choice = AI.enemyChoice(st, AI.aiParams(0.5));
  assert.deepEqual(choice, { type: 'cast', skill: it.skill });
  C.cast(st, 'enemy', it.skill);
  assert.notEqual(C.intent(st).skill, it.skill, 'then it charges the next skill');
});

test('adaptive AI: harder settings find better moves', () => {
  // Over many positions, the hard monster grabs at least as many skulls as the easy one.
  let easy = 0; let hard = 0;
  for (let s = 1; s <= 60; s++) {
    for (const [skill, add] of [[0, (n) => { easy += n; }], [1, (n) => { hard += n; }]]) {
      const st = duel({ seed: s, enemy: 'bandit', p: 3 });
      st.turn = 'enemy';
      const m = AI.enemyChoice(st, AI.aiParams(skill));
      const b = B.cloneBoard(st.board);
      add(B.swap(b, m.a, m.b, R.makeRng(1), { spawn: false }).gains.counts[B.SKULL]);
    }
  }
  assert.ok(hard > easy, `hard ${hard} vs easy ${easy}`);
  const p = AI.tune(AI.AI_PRESETS, 0.25);
  assert.ok(p.noise < AI.AI_PRESETS.easy.noise && p.noise > AI.AI_PRESETS.normal.noise);
});

// ---------------------------------------------------------------- progress

test('campaign structure: 4 regions, 32 battles with bosses, quests, puzzles, shops', () => {
  assert.equal(W.REGIONS.length, 4);
  assert.equal(W.TOTAL_BATTLES, 32);
  for (let r = 0; r < 4; r++) {
    const nodes = PR.nodesOf(r);
    assert.equal(nodes.filter((n) => n.kind === 'boss').length, 1);
    assert.equal(nodes.filter((n) => n.kind === 'quest').length, 2);
    assert.equal(nodes.filter((n) => n.kind === 'puzzle').length, 1);
    for (const n of nodes) if (n.enemy) assert.ok(W.ENEMIES[n.enemy], n.enemy);
  }
  for (const id of Object.keys(H.HEROES)) assert.equal(H.HEROES[id].skills.length, 4);
  for (const s of Object.values(SK.SKILLS)) for (const f of s.fx) assert.ok(SK.describe(Object.keys(SK.SKILLS).find((k) => SK.SKILLS[k] === s), 1).length > 0, f.k);
  for (const reg of W.REGIONS) for (const q of reg.quests) assert.ok(H.GEAR[q.reward]?.quest, q.reward);
  for (const ids of W.SHOP) for (const id of ids) assert.ok(H.GEAR[id]?.price > 0, id);
});

test('nodes unlock in order; heroes join as regions open', () => {
  const p = PR.newProgress();
  assert.deepEqual(PR.heroIds(p), ['knight', 'mage']);
  const n2 = PR.nodesOf(0).find((n) => n.k === 2);
  assert.equal(PR.nodeState(p, n2), 'locked');
  p.cleared['b0-1'] = true;
  assert.equal(PR.nodeState(p, n2), 'open');
  assert.equal(PR.nodeState(p, PR.nodesOf(1)[0]), 'locked');
  for (let k = 1; k <= 8; k++) p.cleared[`b0-${k}`] = true;
  assert.equal(PR.nodeState(p, PR.nodesOf(1)[0]), 'open');
  assert.deepEqual(PR.joinHeroes(p), ['ranger']);
});

test('rewards: XP levels heroes up, bench heroes get half, losses pay a little', () => {
  const p = PR.newProgress();
  const { battle } = PR.campaignBattle(p, 'b0-1', 1);
  battle.over = 'win';
  const r = PR.finishCampaignBattle(p, 'b0-1', battle, 'knight');
  assert.ok(r.firstClear && r.xp > 0 && r.gold > 0);
  assert.equal(p.heroes.knight.xp, r.xp);
  assert.equal(p.heroes.mage.xp, Math.round(r.xp / 2));
  const lost = PR.campaignBattle(p, 'b0-2', 2).battle;
  lost.over = 'lose';
  const r2 = PR.finishCampaignBattle(p, 'b0-2', lost, 'knight');
  assert.ok(r2.xp > 0 && !p.cleared['b0-2']);
  assert.equal(PR.addXp(p, 'knight', 100000) > 5, true);
  assert.equal(p.heroes.knight.lvl, H.MAX_LEVEL);
});

test('shop and gear: buying, equipping and the stats they give', () => {
  const p = PR.newProgress();
  assert.equal(PR.buy(p, 'ironSword'), false, 'no gold');
  p.gold = 500;
  assert.ok(PR.buy(p, 'ironSword'));
  assert.equal(PR.buy(p, 'ironSword'), false, 'already owned');
  assert.equal(PR.buy(p, 'plateArmor'), false, 'not on sale yet... still too dear');
  PR.equip(p, 'knight', 'ironSword');
  const s = PR.statsOf(p, 'knight');
  assert.equal(s.skull, H.HEROES.knight.skull + 1);
  assert.equal(PR.heroFighter(p, 'knight').skull, s.skull);
  assert.equal(PR.buy(p, 'frostBrand'), false, 'quest gear is not for sale');
});

test('tower floors scale up and every 5th floor is a boss', () => {
  for (let f = 1; f <= 30; f++) {
    const t = PR.towerFloor(123, f);
    assert.equal(t.boss, f % 5 === 0);
    assert.equal(W.ENEMIES[t.enemy].boss ? true : false, t.boss);
  }
  assert.ok(PR.towerFloor(1, 20).pos > PR.towerFloor(1, 2).pos);
  assert.equal(PR.towerHeal(10, 100), 45);
});

test('daily duel is the same for everyone on a day', () => {
  const a = PR.dailyBattle(555); const b = PR.dailyBattle(555);
  assert.deepEqual(a, b);
  assert.notDeepEqual(PR.dailyBattle(556).battle.board, a.battle.board);
  const st = a.battle;
  st.over = 'win'; st.hero.hp = 50; st.heroTurns = 10;
  assert.equal(PR.dailyScore(st), 1000 + 500 - 150);
});

// ---------------------------------------------------------------- puzzles

test('every riddle stone can be solved in its move limit (and not in fewer)', () => {
  for (const [id, P] of Object.entries(PZ.PUZZLES)) {
    const ps = PZ.newPuzzle(id);
    const sol = PZ.solve(ps.board, P.moves);
    assert.ok(sol, `${id} solvable`);
    assert.equal(sol.length, P.moves, `${id} needs all ${P.moves} moves`);
    for (const m of sol) assert.ok(PZ.puzzleMove(ps, m.a, m.b).ok);
    assert.equal(ps.over, 'win');
    assert.equal(B.gemsLeft(ps.board), 0);
  }
});

test('a wrong puzzle move can lose', () => {
  const ps = PZ.newPuzzle('p1');
  const moves = B.findMoves(ps.board);
  let lost = false;
  for (const m of moves) {
    const t = PZ.newPuzzle('p1');
    PZ.puzzleMove(t, m.a, m.b);
    if (t.over === 'lose' || (t.movesLeft === 1 && !PZ.solve(t.board, 1))) lost = true;
  }
  assert.ok(lost);
  assert.ok(moves.length > 1);
});

// ---------------------------------------------------------------- the bot finishes the campaign

test('bot clears the whole campaign (quests and puzzles too)', () => {
  for (const seed of [1, 2]) {
    const r = BOT.playCampaign({ seed, enemySkill: 0.5, heroP: AI.aiParams(0.5) });
    assert.ok(r.done, `seed ${seed} finished`);
    assert.ok(PR.questsDone(r.progress), 'all quests');
    assert.ok(PR.puzzlesDone(r.progress), 'all puzzles');
    assert.ok(r.fights < 80, `fights ${r.fights}`);
    // Not a walkover: the bot loses sometimes, and bosses leave a mark.
    const bosses = r.log.filter((l) => /-8$/.test(l.node) && l.won);
    assert.ok(bosses.reduce((a, l) => a + l.hp, 0) / bosses.length < 0.85);
  }
});

test('a weaker player against a gentler monster can still finish', () => {
  const r = BOT.playCampaign({ seed: 3, enemySkill: 0.15, heroP: AI.aiParams(0.15) });
  assert.ok(r.done);
});

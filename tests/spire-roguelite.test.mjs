// Spire Roguelite: rules and engine tests (pure logic, no Phaser).
import test from 'node:test';
import assert from 'node:assert/strict';

const L = new URL('../games/spire-roguelite/logic/', import.meta.url).href;
const rng = await import(L + 'rng.js');
const C = await import(L + 'cards.js');
const E = await import(L + 'enemies.js');
const S = await import(L + 'statuses.js');
const RL = await import(L + 'relics.js');
const P = await import(L + 'potions.js');
const M = await import(L + 'map.js');
const EV = await import(L + 'events.js');
const R = await import(L + 'run.js');
const CB = await import(L + 'combat.js');
const B = await import(L + 'bot.js');

const clone = (o) => JSON.parse(JSON.stringify(o));

/** A fight with a known hand. */
function fight(enemies = ['skeleton'], { hero = 'knight', hand = [], relics, seed = 1, setup } = {}) {
  const run = R.newRun({ hero, seed });
  if (relics) run.relics = relics;
  setup?.(run);
  R.startFight(run, enemies, 'normal');
  const c = new CB.Combat(run, run.combat);
  if (hand.length) {
    c.s.draw.push(...c.s.hand);
    c.s.hand = hand.map((id, i) => ({ uid: 9000 + i, id, up: false }));
  }
  c.takeEvents();
  return { run, c, e: c.livingEnemies()[0] };
}

test('rng is deterministic and resumable', () => {
  const a = rng.makeRng(123);
  const xs = [rng.next(a), rng.next(a)];
  const b = rng.makeRng(123);
  assert.deepEqual([rng.next(b), rng.next(b)], xs);
  const saved = clone(a);
  assert.equal(rng.next(a), rng.next(saved));
  const r = rng.makeRng(5);
  for (let i = 0; i < 200; i++) { const n = rng.int(r, 2, 4); assert.ok(n >= 2 && n <= 4); }
});

test('every card is complete and its text fills in', () => {
  for (const d of Object.values(C.CARDS)) {
    assert.ok(d.name && d.type && d.rarity && d.art && d.text, d.id);
    assert.match(d.art, /^(sp|ar|sk|ui|bld):\d+,\d+$/, d.id);
    for (const up of [false, true]) {
      const t = C.describe({ id: d.id, up });
      assert.ok(!/[{}?]/.test(t.replace(/\?$/, '')), `${d.id}: ${t}`);
    }
    if (!d.flags.unplayable) assert.equal(typeof d.play, 'function', d.id);
    if (['attack', 'skill', 'power'].includes(d.type) && d.rarity !== 'special') {
      const changed = JSON.stringify(C.values(d.id, false)) !== JSON.stringify(C.values(d.id, true))
        || d.upCost !== undefined || d.upText || d.upFlags;
      assert.ok(changed, `${d.id} upgrade does nothing`);
    }
  }
  for (const cls of C.CLASSES) {
    for (const r of ['common', 'uncommon', 'rare']) assert.ok(C.rewardPool(cls, r).length >= 3, `${cls} ${r}`);
    for (const id of C.STARTER_DECKS[cls]) assert.ok(C.CARDS[id], id);
  }
});

test('enemy data: sprites, moves, statuses and encounters are valid', () => {
  for (const [id, d] of Object.entries(E.ENEMIES)) {
    assert.match(d.sprite, /^(necro|castle|tower|strong|rampart|inferno|boss1|boss2):\d+$/, id);
    for (const m of Object.values(d.moves)) {
      for (const k of Object.keys({ ...(m.buff || {}), ...(m.debuff || {}) })) assert.ok(S.STATUSES[k], `${id}: unknown status ${k}`);
      if (m.add) assert.ok(C.CARDS[m.add[0]], `${id}: unknown card ${m.add[0]}`);
      if (m.summon) assert.ok(E.ENEMIES[m.summon], id);
    }
    for (const k of Object.keys(d.start || {})) assert.ok(S.STATUSES[k], `${id}: start ${k}`);
  }
  for (const act of E.ACTS) {
    for (const list of [act.easy, act.hard, act.elites]) for (const enc of list) for (const id of enc) assert.ok(E.ENEMIES[id], id);
    for (const id of act.bosses) assert.ok(E.ENEMIES[id].boss, id);
  }
  // AIs only ever pick moves they have, and announce something every turn.
  for (const id of Object.keys(E.ENEMIES)) {
    const { c } = fight([id]);
    const e = c.livingEnemies()[0];
    for (let t = 0; t < 30; t++) {
      assert.ok(E.ENEMIES[id].moves[e.move], `${id} picked ${e.move}`);
      assert.ok(c.intent(e).kinds.length, `${id} ${e.move} has no intent`);
      assert.ok(c.intentText(e).length > 5);
      c.chooseIntent(e);
    }
  }
});

test('damage math: Strength, Weak, Vulnerable and Block', () => {
  const { c, e } = fight(['zombie'], { hand: ['strike', 'strike', 'defend', 'bash'] });
  const hp = e.hp;
  c.playCard(9000, e.uid);
  assert.equal(e.hp, hp - 6);
  c.apply(e, 'vuln', 2);
  c.playCard(9001, e.uid);
  assert.equal(e.hp, hp - 6 - 9);
  c.playCard(9002);
  assert.equal(c.p.block, 5);
  c.applySelf('str', 2);
  c.applySelf('weak', 1);
  assert.equal(c.attackDamage(6, e), Math.floor((6 + 2) * 0.75 * 1.5));
  c.applySelf('dex', 2);
  c.applySelf('frail', 1);
  assert.equal(c.blockAmount(5), Math.floor(7 * 0.75));
  // Enemy hits go through Block first.
  c.p.block = 4;
  const before = c.p.hp;
  c.hitPlayer(10, {});
  assert.equal(c.p.block, 0);
  assert.equal(c.p.hp, before - 6);
});

test('enemy intent numbers include their Strength, Weak and your Vulnerable', () => {
  const { c, e } = fight(['zombie']);
  e.move = 'lurch';
  assert.equal(c.intent(e).dmg, 11);
  e.st.str = 3;
  assert.equal(c.intent(e).dmg, 14);
  e.st.weak = 1;
  assert.equal(c.intent(e).dmg, Math.floor(14 * 0.75));
  c.p.st.vuln = 1;
  assert.equal(c.intent(e).dmg, Math.floor(14 * 0.75 * 1.5));
});

test('energy, X cost, exhaust and ethereal', () => {
  const { c, e } = fight(['golem'], { hand: ['bash', 'bash', 'secondWind', 'reckless', 'whirlwind'] });
  c.playCard(9000, e.uid);
  assert.equal(c.s.energy, 1);
  assert.equal(c.playCard(9001, e.uid), false, 'not enough energy');
  assert.ok(c.whyNot(c.s.hand[0]));
  c.playCard(9002); // Battle Trance: costs 1, gives 2 energy, exhausts
  assert.equal(c.s.energy, 2);
  assert.ok(c.s.exhaust.some((x) => x.id === 'secondWind'));
  const hp = e.hp;
  c.playCard(9004); // Cyclone with X=2: 5 damage to all, twice (Vulnerable from Bash: 7 each)
  assert.equal(c.s.energy, 0);
  assert.equal(e.hp, hp - 2 * Math.floor(5 * 1.5));
  c.endTurn();
  assert.ok(c.s.exhaust.some((x) => x.id === 'reckless'), 'ethereal card exhausted at end of turn');
});

test('drawing reshuffles the discard pile and respects the hand limit', () => {
  const { c } = fight(['golem']);
  c.s.discard.push(...c.s.draw);
  c.s.draw = [];
  c.takeEvents();
  c.draw(2);
  assert.ok(c.takeEvents().some((ev) => ev.t === 'shuffle'));
  c.draw(20);
  assert.equal(c.s.hand.length, CB.HAND_LIMIT);
  const total = c.s.hand.length + c.s.draw.length + c.s.discard.length + c.s.exhaust.length;
  assert.equal(total, c.run.deck.length);
});

test('block clears each turn unless Bulwark; poison ticks on the enemy turn', () => {
  const { c, e } = fight(['golem'], { hand: ['defend', 'poisonDart'] , hero: 'knight' });
  c.playCard(9000);
  e.move = 'build'; // no attack this turn
  c.apply(e, 'poison', 4);
  const hp = e.hp;
  c.endTurn();
  assert.equal(e.hp, hp - 4);
  assert.equal(e.st.poison, 3);
  assert.equal(c.p.block, 0);
  c.applySelf('bulwark', 1);
  c.gainRawBlock(7);
  e.move = 'build';
  c.endTurn();
  assert.equal(c.p.block, 7);
});

test('artifact blocks debuffs, thorns hurt attackers, ritual grows', () => {
  const { c } = fight(['ironGolem', 'treant', 'acolyte']);
  const [golem, treant, aco] = c.livingEnemies();
  c.apply(golem, 'weak', 2);
  assert.equal(golem.st.weak, undefined);
  assert.equal(golem.st.artifact, undefined);
  c.apply(golem, 'weak', 2);
  assert.equal(golem.st.weak, 2);
  const hp = c.p.hp;
  c.attack(treant, 6);
  assert.equal(c.p.hp, hp - treant.st.thorns);
  assert.equal(aco.move, 'ritual');
  c.p.hp = 999; c.p.maxHp = 999;
  c.endTurn();
  assert.equal(aco.st.ritual, 3);
  assert.equal(aco.st.str || 0, 0, 'ritual does not trigger the turn it is cast');
  c.endTurn();
  assert.equal(aco.st.str, 3);
});

test('winning, losing and the Phoenix Feather', () => {
  const { c, e } = fight(['rat'], { hand: ['strike'] });
  e.hp = 3;
  c.playCard(9000, e.uid);
  assert.equal(c.s.over, 'win');
  const f = fight(['golem']);
  f.c.hitPlayer(9999, {});
  assert.equal(f.c.s.over, 'lose');
  const g = fight(['golem'], { setup: (run) => run.relics.push('phoenix') });
  g.c.hitPlayer(9999, {});
  assert.equal(g.c.s.over, null);
  assert.equal(g.c.p.hp, Math.floor(g.c.p.maxHp / 2));
  g.c.hitPlayer(9999, {});
  assert.equal(g.c.s.over, 'lose');
});

test('the lich summons skeletons, and they flee when it dies', () => {
  const { c } = fight(['lich']);
  c.p.hp = 999;
  const lich = c.livingEnemies()[0];
  assert.equal(lich.move, 'raise');
  c.endTurn();
  assert.equal(c.livingEnemies().length, 2);
  c.hitEnemy(lich, 999, {});
  assert.equal(c.s.over, 'win');
});

test('a fight saved as JSON resumes exactly', () => {
  const { run, c } = fight(['goblin', 'goblin', 'goblin'], { hero: 'mage', seed: 77 });
  B.planTurn(c).forEach((p) => c.playCard(p.uid, p.target));
  c.endTurn();
  c.takeEvents();
  const savedRun = clone(run);
  const play = (r) => {
    const cc = new CB.Combat(r, r.combat);
    for (let t = 0; t < 6 && !cc.s.over; t++) { B.planTurn(cc).forEach((p) => cc.playCard(p.uid, p.target)); cc.endTurn(); }
    cc.takeEvents();
    return JSON.stringify(r.combat);
  };
  assert.equal(play(savedRun), play(clone(savedRun)));
});

test('maps: connected, no crossings, room rules', () => {
  for (let s = 0; s < 150; s++) {
    const map = M.generateMap(rng.makeRng(s + 1));
    const nodes = map.nodes;
    const boss = nodes[map.boss];
    assert.equal(boss.type, 'boss');
    for (const n of nodes) {
      if (n.type === 'boss') continue;
      assert.ok(n.next.length, 'dead end');
      if (n.row > 0) assert.ok(n.prev.length, 'unreachable room');
      if (n.row === 0) assert.equal(n.type, 'fight');
      if (n.row === M.TREASURE_ROW) assert.equal(n.type, 'treasure');
      if (n.row === M.ROWS - 1) { assert.equal(n.type, 'rest'); assert.deepEqual(n.next, [map.boss]); }
      if (n.row < 4) assert.ok(!['elite', 'rest'].includes(n.type), `${n.type} too early`);
      for (const id of n.next) {
        const m = nodes[id];
        if (m.type === 'boss') continue;
        assert.equal(m.row, n.row + 1);
        assert.ok(Math.abs(m.col - n.col) <= 1);
        if (['elite', 'rest', 'shop'].includes(n.type)) assert.notEqual(m.type, n.type, 'same special room twice in a row');
      }
    }
    // No two edges between the same rows cross.
    const edges = nodes.flatMap((n) => n.next.filter((id) => nodes[id].type !== 'boss').map((id) => [n, nodes[id]]));
    for (const [a, b] of edges) for (const [c2, d] of edges) {
      if (a.row === c2.row && a.col < c2.col) assert.ok(b.col <= d.col, 'paths cross');
    }
    assert.ok(nodes.some((n) => n.type === 'shop'), 'every act has a shop');
  }
});

test('run flow: rewards, shop, rest, boss relic, acts and victory', () => {
  const run = R.newRun({ hero: 'ranger', seed: 9 });
  assert.equal(run.deck.length, 12);
  assert.deepEqual(run.relics, ['fang']);
  assert.equal(R.travel(run, 9999), false);
  const first = R.availableNodes(run)[0];
  assert.ok(R.travel(run, first));
  assert.equal(run.screen, 'combat');
  run.combat.over = 'win';
  R.finishCombat(run);
  assert.equal(run.screen, 'reward');
  const g = run.gold;
  const rw = run.rewards;
  const amount = rw.gold;
  assert.ok(amount >= 10 && amount <= 20);
  R.takeGold(run);
  assert.equal(run.gold, g + amount);
  R.takeCard(run, rw.cards[0]);
  assert.equal(run.deck.length, 13);
  R.takeCard(run, rw.cards[1]);
  assert.equal(run.deck.length, 13, 'only one card per reward');
  R.leaveRewards(run);
  assert.equal(run.screen, 'map');

  // Shop
  run.gold = 1000;
  run.screen = 'shop';
  run.shop = R.makeShop(run);
  assert.equal(run.shop.cards.length, 7);
  assert.ok(R.buy(run, 'cards', 0));
  assert.equal(R.buy(run, 'cards', 0), false, 'sold out');
  const uid = run.deck[0].uid;
  assert.ok(R.shopRemove(run, uid));
  assert.equal(run.removeCost, 100);
  assert.equal(R.shopRemove(run, run.deck[0].uid), false, 'one removal per shop');
  R.leaveRoom(run);

  // Rest heals 30%, smith upgrades.
  run.hp = 10; run.screen = 'rest';
  R.rest(run);
  assert.equal(run.hp, 10 + Math.floor(run.maxHp * 0.3));
  run.screen = 'rest';
  const card = run.deck.find((c) => C.canUpgrade(c));
  R.smith(run, card.uid);
  assert.ok(card.up);

  // Boss -> boss relic -> act 2, full heal.
  R.startFight(run, [run.bossId], 'boss');
  run.combat.over = 'win';
  run.combat.player.hp = 5;
  R.finishCombat(run);
  assert.ok(run.rewards.boss);
  R.leaveRewards(run);
  assert.equal(run.screen, 'bossRelic');
  assert.equal(run.bossRelics.length, 3);
  R.chooseBossRelic(run, run.bossRelics[0]);
  assert.equal(run.act, 2);
  assert.equal(run.hp, run.maxHp);
  assert.equal(run.screen, 'map');

  // Beating the act 3 boss wins a normal run.
  run.act = 3;
  R.startFight(run, ['redDragon'], 'boss');
  run.combat.over = 'win';
  R.finishCombat(run);
  R.leaveRewards(run);
  assert.equal(run.screen, 'victory');
  assert.ok(R.score(run) > 500);
});

test('endless mode loops the acts and enemies get tougher', () => {
  const run = R.newRun({ hero: 'knight', mode: 'endless', seed: 3 });
  assert.equal(run.maxHp, 86);
  run.act = 3;
  R.startFight(run, ['redDragon'], 'boss');
  run.combat.over = 'win';
  R.finishCombat(run);
  R.leaveRewards(run);
  R.chooseBossRelic(run, null);
  assert.equal(run.act, 1);
  assert.equal(run.loop, 1);
  const a = CB.scaling({ mode: 'endless', loop: 0 });
  const b = CB.scaling({ mode: 'endless', loop: 1 });
  const n = CB.scaling({ mode: 'normal', loop: 0 });
  assert.ok(a.hp < n.hp, 'endless starts gentler');
  assert.ok(b.hp > n.hp && b.dmg > n.dmg, 'and gets tougher every loop');
  R.startFight(run, ['skeleton'], 'normal');
  assert.ok(run.combat.enemies[0].maxHp > 38);
});

test('every event choice resolves without errors', () => {
  for (const [id, ev] of Object.entries(EV.EVENTS)) {
    ev.choices.forEach((ch, i) => {
      const run = R.newRun({ hero: 'mage', seed: 100 + i });
      run.gold = 200;
      run.event = { id, outcome: null };
      run.screen = 'event';
      assert.equal(R.eventChoiceBlocked(run, i), '', `${id}:${i}`);
      assert.ok(R.eventChoiceDesc(run, i).length > 3);
      const out = R.chooseEvent(run, i);
      assert.ok(out && out.text, `${id}:${i}`);
      if (out.pick) assert.ok(R.eventPick(run, R.pickable(run, out.pick.mode)[0].uid));
      if (out.offer) { R.eventTakeOffer(run, out.offer[0]); assert.ok(run.deck.some((c) => c.id === out.offer[0])); }
      R.eventContinue(run);
      assert.equal(run.screen, out.fight ? 'combat' : 'map');
      assert.ok(run.hp >= 1);
    });
  }
  const poor = R.newRun({ hero: 'mage', seed: 1 });
  poor.gold = 0;
  poor.event = { id: 'gambler', outcome: null };
  assert.ok(R.eventChoiceBlocked(poor, 0));
  assert.equal(R.chooseEvent(poor, 0), null);
});

test('every relic and potion works in a real fight', () => {
  const allRelics = Object.keys(RL.RELICS).filter((id) => !['cube'].includes(id));
  const run = R.newRun({ hero: 'knight', seed: 5 });
  for (const id of allRelics) if (!run.relics.includes(id)) R.giveRelic(run, id);
  run.hp = run.maxHp = 500;
  R.startFight(run, ['golem', 'rat'], 'elite');
  assert.equal(B.playFight(run), 'win');
  for (const id of P.POTION_IDS) {
    const f = fight(['golem', 'golem']);
    f.run.potions = [id, null, null];
    const target = P.POTIONS[id].target === 'enemy' ? f.e.uid : undefined;
    assert.ok(f.c.usePotion(0, target), id);
    assert.equal(f.run.potions[0], null);
  }
  // Boss relic flags.
  const r2 = R.newRun({ hero: 'mage', seed: 6 });
  R.giveRelic(r2, 'chalice');
  assert.equal(R.canGetPotion(r2), false);
  R.giveRelic(r2, 'lamp');
  assert.equal(R.canRest(r2), false);
  R.giveRelic(r2, 'crown');
  assert.equal(R.cardChoices(r2, 3).length, 1);
});

test('the bot can finish whole runs without errors', () => {
  for (const hero of C.CLASSES) {
    const r = B.playRun({ hero, seed: 4242 });
    assert.ok(['dead', 'victory'].includes(r.won ? 'victory' : 'dead'));
    assert.ok(r.floor >= 1 && !r.stopped, `${hero} run stalled`);
  }
});

test('rewards still work once every relic has been found', () => {
  const run = R.newRun({ hero: 'knight', seed: 12 });
  for (const id of Object.keys(RL.RELICS)) if (!run.relics.includes(id)) run.relics.push(id);
  R.startFight(run, ['ogre'], 'elite');
  run.combat.over = 'win';
  R.finishCombat(run);
  assert.equal(run.rewards.relics.length, 0);
  assert.ok(run.rewards.gold >= 40 + 25);
  run.screen = 'shop';
  run.shop = R.makeShop(run);
  assert.equal(run.shop.relics.length, 0);
  run.screen = 'event';
  run.event = { id: 'altar', outcome: null };
  const out = R.chooseEvent(run, 0);
  assert.match(out.text, /gold/);
});

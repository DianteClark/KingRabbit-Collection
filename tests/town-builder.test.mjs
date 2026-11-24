import { test } from 'node:test';
import assert from 'node:assert/strict';

const S = await import('../games/town-builder/logic/sim.js');
const { generate, lPath, rectTiles, idx } = await import('../games/town-builder/logic/map.js');
const { PLACE, MILESTONES, SCENARIOS, T } = await import('../games/town-builder/logic/defs.js');
const { runBot } = await import('../games/town-builder/logic/bot.js');
const { tips } = await import('../games/town-builder/logic/advisors.js');
const { STEPS, tutCheck, tutText } = await import('../games/town-builder/logic/tutorial.js');
const { FRAMES } = await import('../games/town-builder/logic/sprites.js');

/** A tiny starter town next to the highway: roads, homes, shops, industry, power and water. */
function starter(mode = 'sandbox') {
  const s = S.newGame(mode);
  const { x, y } = s.start;
  S.buildLine(s, 'road', lPath({ x, y }, { x: x + 12, y }));
  S.buildLine(s, 'road', lPath({ x: x + 6, y: y - 6 }, { x: x + 6, y: y + 6 }));
  S.zoneArea(s, 'R', rectTiles({ x: x + 1, y: y - 3 }, { x: x + 5, y: y - 1 }));
  S.zoneArea(s, 'R', rectTiles({ x: x + 1, y: y + 1 }, { x: x + 5, y: y + 3 }));
  S.zoneArea(s, 'C', rectTiles({ x: x + 7, y: y - 3 }, { x: x + 10, y: y - 1 }));
  S.zoneArea(s, 'I', rectTiles({ x: x + 7, y: y + 1 }, { x: x + 11, y: y + 3 }));
  return s;
}
const snap = (s) => JSON.stringify({ ...S.serialize(s), rs: 0, nextId: 0 });

test('town builder: every frame in the catalog is on the 16 px grid and every building has art', () => {
  for (const [sheet, list] of Object.entries(FRAMES)) for (const r of list) if (r) for (const v of r) assert.equal(v % 16, 0, sheet);
  for (const [k, p] of Object.entries(PLACE)) {
    const sizes = new Set(p.frames.map((f) => { const r = S.frameRect(f); assert.ok(r, `${k} ${f}`); return `${r[2]}x${r[3]}`; }));
    assert.equal(sizes.size, 1, `${k} frames share one footprint`);
  }
});

test('town builder: maps are the same for the same seed, with a highway and a clear start', () => {
  const a = generate(7); const b = generate(7); const c = generate(8);
  assert.deepEqual(a.terrain, b.terrain);
  assert.notDeepEqual(a.terrain, c.terrain);
  for (let x = 0; x <= a.start.x; x++) assert.equal(a.road[idx(x, a.hy)], 1);
  for (let dy = -2; dy <= 2; dy++) for (let dx = 1; dx <= 5; dx++) assert.equal(a.terrain[idx(a.start.x + dx, a.hy + dy)] === T.TREE, false);
});

test('town builder: every tool can be undone exactly, with a full refund', () => {
  const s = starter();
  S.place(s, 'wind', s.start.x + 2, s.start.y - 5);
  const before = snap(s); const money = s.money;
  const steps = [
    () => S.buildLine(s, 'road', lPath({ x: s.start.x + 12, y: s.start.y }, { x: s.start.x + 12, y: s.start.y + 8 })),
    () => S.buildLine(s, 'line', lPath({ x: s.start.x + 1, y: s.start.y - 8 }, { x: s.start.x + 8, y: s.start.y - 8 })),
    () => S.zoneArea(s, 'F', rectTiles({ x: s.start.x + 1, y: s.start.y + 5 }, { x: s.start.x + 5, y: s.start.y + 9 })),
    () => S.zoneArea(s, '', rectTiles({ x: s.start.x + 1, y: s.start.y - 3 }, { x: s.start.x + 3, y: s.start.y - 1 })),
    () => S.place(s, 'police', s.start.x + 2, s.start.y + 5),
    () => S.bulldoze(s, rectTiles({ x: s.start.x, y: s.start.y - 1 }, { x: s.start.x + 4, y: s.start.y + 1 })),
  ];
  for (const f of steps) {
    const res = f();
    assert.ok(res.ok, res.reason);
    assert.ok(S.canUndo(s));
    S.undo(s);
    assert.equal(snap(s), before);
    assert.equal(s.money, money);
  }
  // A stack of actions also unwinds in order.
  for (const f of steps.slice(0, 4)) f();
  while (S.canUndo(s) && s.blds.some((b) => b.k === 'wind') && S.undoLabel(s) !== 'Wind Turbine') S.undo(s);
  assert.equal(snap(s), before);
});

test('town builder: undo removes what grew on the land it gives back', () => {
  const s = S.newGame('sandbox');
  const { x, y } = s.start;
  S.place(s, 'wind', x + 1, y - 4);
  S.zoneArea(s, 'R', rectTiles({ x: x + 1, y: y - 2 }, { x: x + 6, y: y - 1 }));
  for (let k = 0; k < 6; k++) S.advance(s, 1);
  assert.ok(s.pop > 0, 'houses grew');
  S.undo(s);
  assert.equal(s.blds.filter((b) => b.k === 'grow').length, 0);
  assert.ok(s.zone.every((z) => z === ''));
});

test('town builder: placing checks the land, money and milestones', () => {
  const s = starter();
  const { x, y } = s.start;
  assert.equal(S.checkPlace(s, 'coal', x + 3, y - 1).ok, false, 'not over a road');
  assert.match(S.checkPlace(s, 'hospital', x + 2, y - 8).reason, /Unlocks at Town/);
  assert.match(S.checkPlace(s, 'busstop', x + 2, y - 9).reason, /next to a road/);
  assert.ok(S.checkPlace(s, 'busstop', x + 7, y - 4).ok);
  s.money = 100;
  assert.match(S.checkPlace(s, 'coal', x + 2, y - 8).reason, /money/);
  const c = S.newGame('clean');
  assert.match(S.checkPlace(c, 'coal', c.start.x + 2, c.start.y - 6).reason, /Banned/);
});

test('town builder: power flows along roads, zones and lines, and runs out', () => {
  const s = starter();
  const r = S.rt(s);
  const lot = idx(s.start.x + 2, s.start.y - 2);
  assert.equal(r.lotPower[lot], 0, 'no plant, no power');
  assert.equal(S.lotBlocker(s, lot), 'no power');
  // A turbine far away does nothing until a power line links it.
  const fx = s.start.x + 2; const fy = s.start.y - 12;
  assert.ok(S.place(s, 'wind', fx, fy).ok);
  assert.equal(r.lotPower[lot], 0);
  S.buildLine(s, 'line', lPath({ x: fx, y: fy + 2 }, { x: fx, y: s.start.y - 4 }));
  assert.equal(r.lotPower[lot], 1, 'linked by a power line');
  // Lots of houses on one turbine: some go dark.
  for (let k = 0; k < 24 && s.pop < 200; k++) S.advance(s, 1);
  const unpowered = s.blds.filter((b) => b.k === 'grow' && !b.pw).length;
  assert.ok(r.need > r.supply ? unpowered > 0 : unpowered === 0);
});

test('town builder: services cover the area around them, more when funded', () => {
  const s = starter();
  S.place(s, 'wind', s.start.x + 2, s.start.y - 5);
  S.place(s, 'police', s.start.x + 2, s.start.y + 4);
  const r = S.rt(s);
  const near = r.cov.police[idx(s.start.x + 3, s.start.y + 4)];
  const far = r.cov.police[idx(s.start.x + 30, s.start.y + 4)];
  assert.ok(near > 0.8 && far === 0, `${near} ${far}`);
  S.setFund(s, 'police', 50); S.refresh(s);
  assert.ok(r.cov.police[idx(s.start.x + 3, s.start.y + 4)] < near);
});

test('town builder: commuters only reach jobs that are linked by road, and fill the roads', () => {
  const s = starter();
  S.place(s, 'wind', s.start.x + 2, s.start.y - 5);
  S.place(s, 'wind', s.start.x + 3, s.start.y - 5);
  for (let k = 0; k < 8; k++) S.advance(s, 1);
  const r = S.rt(s);
  const homes = s.blds.filter((b) => b.k === 'grow' && b.z === 'R');
  assert.ok(homes.length && homes.every((b) => r.reach.has(b.id)));
  assert.ok(s.road.some((v, i) => v && r.traffic[i] > 0));
  // An island of homes with its own road and no jobs: nobody reaches work.
  const t = S.newGame('sandbox');
  const ix = t.start.x + 2; const iy = t.start.y + 10;
  S.buildLine(t, 'road', lPath({ x: ix, y: iy }, { x: ix + 6, y: iy }));
  S.zoneArea(t, 'R', rectTiles({ x: ix, y: iy + 1 }, { x: ix + 5, y: iy + 2 }));
  S.place(t, 'wind', ix, iy - 2);
  for (let k = 0; k < 6; k++) S.advance(t, 1);
  const tr = S.rt(t);
  const h2 = t.blds.filter((b) => b.k === 'grow');
  assert.ok(h2.length > 0 && h2.every((b) => !tr.reach.has(b.id)));
  assert.ok(S.info(t, h2[0].x, h2[0].y).warn.some((w) => /no jobs/.test(w)));
});

test('town builder: the monthly budget adds up, taxes and loans work', () => {
  const s = starter();
  S.place(s, 'wind', s.start.x + 2, s.start.y - 5);
  for (let k = 0; k < 6; k++) S.advance(s, 1);
  const b = S.budget(s);
  assert.ok(b.tin > 0 && b.tout > 0);
  assert.ok(Math.abs(b.net - (b.tin - b.tout)) < 1e-6);
  const m0 = s.money;
  S.advance(s, 1);
  const b2 = S.budget(s);
  assert.ok(Math.abs(s.money - m0 - s.report.net) < 2 || Math.abs(s.report.net - b2.net) < 200);
  const low = S.budget(s).tin;
  S.setTax(s, 'R', 15); S.setTax(s, 'C', 15); S.setTax(s, 'I', 15);
  assert.ok(S.budget(s).tin > low);
  assert.ok(s.demand.R < 1);
  const cash = s.money;
  assert.ok(S.takeLoan(s));
  assert.equal(s.money, cash + 5000);
  assert.ok(S.budget(s).expense.some(([k]) => k === 'Loan payments'));
  S.takeLoan(s); S.takeLoan(s);
  assert.equal(S.takeLoan(s), false, 'three loans at most');
  assert.ok(S.repayLoan(s, 0));
  assert.equal(s.loans.length, 2);
});

test('town builder: homes grow only with power and roads, and demand reacts to jobs', () => {
  const s = starter();
  for (let k = 0; k < 6; k++) S.advance(s, 1);
  assert.equal(s.pop, 0, 'nothing grows without power');
  S.place(s, 'wind', s.start.x + 2, s.start.y - 5);
  S.place(s, 'wind', s.start.x + 3, s.start.y - 5);
  for (let k = 0; k < 6; k++) S.advance(s, 1);
  assert.ok(s.pop > 30, `pop ${s.pop}`);
  assert.ok(s.jobs.C + s.jobs.I > 0);
  // All homes and no jobs: residential demand turns negative.
  const t = S.newGame('sandbox');
  t.pop = 2000; t.jobs = { C: 0, I: 0, F: 0 };
  assert.ok(S.demand(t).R < 0 && S.demand(t).C > 0 && S.demand(t).I > 0);
});

test('town builder: overlays, info and advisors all answer for every tile', () => {
  const s = starter();
  S.place(s, 'wind', s.start.x + 2, s.start.y - 5);
  for (let k = 0; k < 4; k++) S.advance(s, 1);
  for (const k of Object.keys(S.OVERLAYS)) for (let i = 0; i < 48 * 48; i += 37) { const v = S.overlayValue(s, k, i); assert.ok(v === null || (v >= 0 && v <= 1), k); }
  for (let y = 0; y < 48; y += 5) for (let x = 0; x < 48; x += 5) assert.ok(S.info(s, x, y).title);
  const t = tips(s);
  assert.ok(t.length > 0 && t.every((x) => x.text.length < 140));
});

test('town builder: a save survives JSON and keeps running', () => {
  const s = starter();
  S.place(s, 'wind', s.start.x + 2, s.start.y - 5);
  for (let k = 0; k < 5; k++) S.advance(s, 1);
  const copy = S.deserialize(JSON.parse(JSON.stringify(S.serialize(s))));
  assert.equal(snap(copy), snap(s));
  S.advance(copy, 3); S.advance(s, 3);
  assert.equal(copy.pop, s.pop, 'same seed state, same future');
});

test('town builder: fires spread without a firehouse and get put out with one', () => {
  const burn = (withFire) => {
    const s = starter();
    S.place(s, 'wind', s.start.x + 2, s.start.y - 5); S.place(s, 'wind', s.start.x + 3, s.start.y - 5);
    if (withFire) S.place(s, 'fire', s.start.x + 1, s.start.y + 4);
    for (let k = 0; k < 8; k++) S.advance(s, 1);
    const n = s.blds.length;
    const b = s.blds.find((q) => q.k === 'grow' && q.z === 'R');
    S.startFire(s, idx(b.x, b.y));
    for (let k = 0; k < 8; k++) S.advance(s, 0.25);
    return { lost: n - s.blds.length, fires: s.fires.length, rubble: s.terrain.filter((t) => t === T.RUBBLE).length };
  };
  let lostWith = 0; let lostWithout = 0;
  for (let k = 0; k < 5; k++) { lostWith += burn(true).rubble; lostWithout += burn(false).rubble; }
  assert.ok(lostWith <= lostWithout, `${lostWith} vs ${lostWithout}`);
});

test('town builder: every disaster starts, does its thing and ends', () => {
  for (const kind of ['fire', 'quake', 'meteor', 'tornado', 'ufo']) {
    const s = starter();
    S.place(s, 'wind', s.start.x + 2, s.start.y - 5); S.place(s, 'wind', s.start.x + 3, s.start.y - 5);
    for (let k = 0; k < 6; k++) S.advance(s, 1);
    const ev = [];
    assert.ok(S.trigger(s, kind, ev), kind);
    assert.ok(ev.some((e) => e.kind === 'disaster'));
    for (let k = 0; k < 40; k++) S.advance(s, 0.1);
    assert.equal(s.active.length, 0, `${kind} is over`);
  }
  // Police shoot down a UFO that hovers over their patch.
  const s = starter();
  S.place(s, 'wind', s.start.x + 2, s.start.y - 5); S.place(s, 'wind', s.start.x + 3, s.start.y - 5);
  s.ms = 2;
  assert.ok(S.place(s, 'policehq', s.start.x + 2, s.start.y + 4).ok);
  for (let k = 0; k < 6; k++) S.advance(s, 1);
  S.trigger(s, 'ufo');
  const ev = [];
  for (let k = 0; k < 60; k++) ev.push(...S.advance(s, 0.05));
  assert.ok(ev.some((e) => e.kind === 'ufoDown'));
});

test('town builder: the first-minutes guide follows what the player does', () => {
  const s = S.newGame('sandbox');
  assert.equal(STEPS[s.tut].id, 'road');
  const { x, y } = s.start;
  S.buildLine(s, 'road', lPath({ x, y }, { x: x + 8, y }));
  tutCheck(s); assert.equal(STEPS[s.tut].id, 'zoneR');
  S.zoneArea(s, 'R', rectTiles({ x: x + 1, y: y - 2 }, { x: x + 4, y: y - 1 }));
  tutCheck(s); assert.equal(STEPS[s.tut].id, 'power');
  // A turbine out in a field doesn't count until it's linked up.
  S.place(s, 'wind', x + 1, y - 10);
  tutCheck(s); assert.equal(STEPS[s.tut].id, 'power');
  assert.match(tutText(s, STEPS[s.tut]), /not linked/);
  S.undo(s);
  S.place(s, 'wind', x + 1, y - 4);
  tutCheck(s); assert.equal(STEPS[s.tut].id, 'jobs');
  S.zoneArea(s, 'C', rectTiles({ x: x + 5, y: y - 2 }, { x: x + 7, y: y - 1 }));
  S.zoneArea(s, 'I', rectTiles({ x: x + 5, y: y + 1 }, { x: x + 7, y: y + 2 }));
  tutCheck(s); assert.equal(STEPS[s.tut].id, 'water');
  S.place(s, 'wtower', x + 3, y - 5);
  tutCheck(s); assert.equal(STEPS[s.tut].id, 'grow');
  for (let k = 0; k < 12 && s.tut != null; k++) { S.advance(s, 1); tutCheck(s); }
  assert.equal(s.tut, null, `finished (pop ${s.pop})`);
});

test('town builder: the bot grows a sandbox city past every milestone', () => {
  const s = S.newGame('sandbox');
  const reached = {};
  runBot(s, 130, (st, ev) => { for (const e of ev) if (e.kind === 'milestone') reached[e.ms] = Math.floor(st.t); });
  for (let m = 1; m < MILESTONES.length; m++) assert.ok(reached[m] !== undefined, `reached ${MILESTONES[m].name} (pop ${s.pop})`);
  assert.ok(s.money > 0);
});

for (const id of Object.keys(SCENARIOS)) {
  test(`town builder: the bot wins the "${SCENARIOS[id].name}" scenario`, () => {
    const s = S.newGame(id);
    runBot(s, SCENARIOS[id].years * 12 + 1);
    assert.ok(s.result?.won, `${id}: ${JSON.stringify(s.result)} pop ${s.pop} happy ${Math.round(s.happy)} loans ${s.loans.length}`);
    if (SCENARIOS[id].noDirty) assert.ok(!s.blds.some((b) => PLACE[b.k]?.dirty));
  });
}

test('town builder: doing nothing loses a scenario when time runs out', () => {
  const s = S.newGame('first');
  const ev = [];
  for (let m = 0; m < 4 * 12 + 1; m++) ev.push(...S.advance(s, 1));
  assert.deepEqual(s.result, { over: true, won: false, reason: 'time' });
  assert.ok(ev.some((e) => e.kind === 'lose'));
  assert.deepEqual(S.advance(s, 1), [], 'the clock stops after the end');
  S.keepGoing(s);
  S.advance(s, 1);
  assert.ok(s.t >= 49);
});

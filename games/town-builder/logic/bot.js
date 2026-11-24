// A simple mayor bot: lays out a grid of 6x6 blocks off the highway and fills them with zones,
// power, water and services as the city asks. Used by the tests to prove the game can be won.
import { PLACE, T } from './defs.js';
import * as S from './sim.js';
import { lPath, rectTiles, W, H, idx } from './map.js';

const STEP = 7; // road every 7 tiles -> 6x6 blocks, every tile within 3 of a road

export function createBot(s) {
  const ox = ((s.start.x % STEP) + STEP) % STEP; const oy = ((s.hy % STEP) + STEP) % STEP;
  const blocks = [];
  for (let y0 = oy - STEP; y0 < H; y0 += STEP) {
    for (let x0 = ox - STEP; x0 < W; x0 += STEP) {
      const ix = x0 + 1; const iy = y0 + 1;
      const iw = Math.min(6, W - ix); const ih = Math.min(6, H - iy);
      if (ix < 0 || iy < 0 || iw < 4 || ih < 4) continue;
      let wet = 0;
      for (let y = iy; y < iy + ih; y++) for (let x = ix; x < ix + iw; x++) if (s.terrain[idx(x, y)] === T.WATER) wet++;
      if (wet > iw * ih * 0.3) continue;
      const d = Math.hypot(ix + 3 - s.start.x, iy + 3 - s.hy);
      blocks.push({ x0, y0, ix, iy, iw, ih, use: null, d, built: false });
    }
  }
  blocks.sort((a, b) => a.d - b.d);
  return { blocks, log: [] };
}

const centerOf = (b) => ({ x: b.ix + Math.floor(b.iw / 2), y: b.iy + Math.floor(b.ih / 2) });

function scoreFor(bot, blk, use) {
  const used = bot.blocks.filter((b) => b.use);
  const near = (u) => used.filter((b) => b.use === u).reduce((m, b) => Math.min(m, Math.hypot(b.ix - blk.ix, b.iy - blk.iy)), 99);
  let sc = blk.d;
  if (use === 'R' || use === 'C') sc += Math.max(0, 15 - near('I')) * 2 + Math.max(0, 12 - near('P')) * 3;
  if (use === 'I' || use === 'P') sc += Math.max(0, 15 - near('R')) * 2;
  if (use === 'S') sc -= 3;
  return sc;
}

function claim(s, bot, use, near) {
  let free = bot.blocks.filter((b) => !b.use);
  if (near) free = free.filter((b) => Math.hypot(b.ix + 3 - near.x, b.iy + 3 - near.y) < 8);
  else free = free.slice(0, 14);
  if (!free.length) return null;
  free.sort((a, b) => scoreFor(bot, a, use) - scoreFor(bot, b, use));
  const blk = free[0];
  if (!ringRoads(s, blk)) return null;
  blk.use = use;
  return blk;
}

function ringRoads(s, b) {
  const { x0, y0 } = b; const x1 = x0 + STEP; const y1 = y0 + STEP;
  const cl = (v, m) => Math.max(0, Math.min(m - 1, v));
  const segs = [[{ x: x0, y: y0 }, { x: x1, y: y0 }], [{ x: x1, y: y0 }, { x: x1, y: y1 }], [{ x: x0, y: y1 }, { x: x1, y: y1 }], [{ x: x0, y: y0 }, { x: x0, y: y1 }]]
    .map(([a, c]) => [{ x: cl(a.x, W), y: cl(a.y, H) }, { x: cl(c.x, W), y: cl(c.y, H) }]);
  let cost = 0;
  for (const [a, c] of segs) cost += S.planLine(s, 'road', lPath(a, c)).cost;
  if (cost > s.money - 200) return false;
  for (const [a, c] of segs) S.buildLine(s, 'road', lPath(a, c));
  return true;
}

function findSpot(s, blk, key) {
  const { w, h } = S.placeSize(key);
  for (let y = blk.iy; y + h <= blk.iy + blk.ih; y++) for (let x = blk.ix; x + w <= blk.ix + blk.iw; x++) {
    if (S.checkPlace(s, key, x, y).ok) return { x, y };
  }
  return null;
}

function placeIn(s, bot, key, uses, near) {
  let cands = bot.blocks.filter((b) => uses.includes(b.use));
  const dd = (b) => Math.hypot(b.ix + 3 - near.x, b.iy + 3 - near.y);
  if (near) cands = cands.sort((a, b) => dd(a) - dd(b)).filter((b) => dd(b) < (PLACE[key].r || 30) * 0.9);
  for (const blk of cands) {
    const p = findSpot(s, blk, key);
    if (p) return S.place(s, key, p.x, p.y).ok;
  }
  return false;
}

/** One month of decisions. Returns a list of what it did (for debugging). */
export function botStep(s, bot) {
  return S.batch(s, () => step(s, bot));
}

function step(s, bot) {
  const did = [];
  const r = S.rt(s);
  const sc = S.scenario(s);
  const noDebt = !!sc?.noDebt;
  const reserve = noDebt ? 800 : 300;
  const can = (c) => s.money - c >= reserve;
  // Money: taxes and loans.
  const bud = S.budget(s);
  if (bud.net < 0 && s.money < 4000) { for (const z of ['R', 'C', 'I']) S.setTax(s, z, Math.min(12, s.tax[z] + 1)); did.push('tax+'); } else if (s.money > 25000 && s.tax.R > 7) { for (const z of ['R', 'C', 'I']) S.setTax(s, z, s.tax[z] - 1); did.push('tax-'); }
  if (!noDebt && s.money < 300 && s.loans.length < 2) { S.takeLoan(s); did.push('loan'); }
  if (s.loans.length && s.money > 12000) { S.repayLoan(s, 0); did.push('repay'); }

  // Power first.
  const want = r.need * 1.15 + 25;
  if (r.supply < want) {
    let key = 'wind';
    if (sc?.noDirty) key = s.ms >= 1 && can(PLACE.solar.cost) ? 'solar' : 'wind';
    else if (s.ms >= 3 && can(PLACE.nuclear.cost + 3000) && r.need > 1000) key = 'nuclear';
    else if (s.pop > 150 && can(PLACE.coal.cost)) key = 'coal';
    if (can(PLACE[key].cost)) {
      let ok = placeIn(s, bot, key, ['P']);
      if (!ok) { const b = claim(s, bot, 'P'); if (b) ok = placeIn(s, bot, key, ['P']); }
      if (!ok) ok = placeAnywhere(s, key);
      if (ok) did.push(key);
    }
  }
  // Water for every block that has zones.
  for (const blk of bot.blocks.filter((b) => b.use === 'R' || b.use === 'C' || b.use === 'I')) {
    const c = centerOf(blk);
    if (r.water[idx(c.x, c.y)] > 0 || !can(PLACE.wtower.cost)) continue;
    if (s.blds.some((q) => PLACE[q.k]?.svc === 'water' && Math.hypot(q.x + q.w / 2 - c.x, q.y + q.h / 2 - c.y) < PLACE[q.k].r * 0.85)) continue;
    const key = s.ms >= 2 && can(PLACE.pump.cost + 2000) ? 'pump' : 'wtower';
    if (placeIn(s, bot, key, ['S', 'P', blk.use], c)) { did.push(key); }
  }
  // Services where people live.
  const svcWanted = [];
  if (s.pop > 120) svcWanted.push(['police', 'policehq'], ['fire', 'firest']);
  if (s.ms >= 1) svcWanted.push(['clinic', 'hospital'], ['school', 'highschool']);
  for (const blk of bot.blocks.filter((b) => b.use === 'R' || b.use === 'C')) {
    const c = centerOf(blk);
    for (const [small, big] of svcWanted) {
      const svc = PLACE[small].svc;
      if (r.cov[svc][idx(c.x, c.y)] >= 0.3) continue;
      if (s.blds.some((q) => PLACE[q.k]?.svc === svc && Math.hypot(q.x + q.w / 2 - c.x, q.y + q.h / 2 - c.y) < PLACE[q.k].r * 0.9)) continue;
      if (s.blds.filter((q) => PLACE[q.k]?.svc === svc).length >= 1 + Math.floor(s.pop / 900)) continue;
      const key = s.ms >= 2 && can(PLACE[big].cost + 1500) ? big : small;
      if (!can(PLACE[key].cost)) continue;
      let ok = placeIn(s, bot, key, ['S'], c);
      if (!ok && can(PLACE[key].cost + 500)) { const b = claim(s, bot, 'S', c); if (b) ok = placeIn(s, bot, key, ['S'], c); }
      if (ok) { did.push(key); }
    }
  }
  // Parks in residential blocks once there's money to spare.
  if (s.ms >= 1 && can(2500)) {
    for (const blk of bot.blocks.filter((b) => b.use === 'R')) {
      const c = centerOf(blk);
      if (r.cov.park[idx(c.x, c.y)] >= 0.5) continue;
      if (placeIn(s, bot, 'plaza', ['S'], c) || placeIn(s, bot, 'park', ['S', 'R'], c)) { did.push('park'); break; }
    }
  }
  // Rich? Better services and parks raise land value, so buildings can grow taller.
  if (s.money > 15000) {
    for (const blk of bot.blocks.filter((b) => b.use === 'R' || b.use === 'C')) {
      const c = centerOf(blk);
      for (const [key, svc, want] of [['bigpark', 'park', 0.8], ['hospital', 'health', 0.8], ['highschool', 'edu', 0.8], ['policehq', 'police', 0.7]]) {
        if (S.isLocked(s, key) || r.cov[svc][idx(c.x, c.y)] >= want || !can(PLACE[key].cost + 8000)) continue;
        let ok = placeIn(s, bot, key, ['S'], c);
        if (!ok) { const b = claim(s, bot, 'S', c); if (b) ok = placeIn(s, bot, key, ['S'], c); }
        if (ok) { did.push(key); }
      }
    }
  }
  // Landmarks for happiness and money.
  for (const key of ['mansion', 'bank', 'court', 'hotel', 'arena', 'university', 'airport']) {
    const p = PLACE[key];
    if (S.isLocked(s, key) || (p.landmark && S.landmarkBuilt(s, key)) || !can(p.cost + 4000)) continue;
    if (key === 'court' && s.blds.some((b) => b.k === 'court')) continue;
    if (key === 'airport') {
      // Needs a 16x8 site next to a road: try the edge of the map.
      if (tryAirport(s)) did.push(key);
      continue;
    }
    let ok = placeIn(s, bot, key, ['S']);
    if (!ok) { const b = claim(s, bot, 'S'); if (b) ok = placeIn(s, bot, key, ['S']); }
    if (ok) did.push(key);
  }
  // Zone whatever people ask for.
  const empty = { R: 0, C: 0, I: 0 };
  for (let i = 0; i < W * H; i++) if (s.zone[i] && s.zone[i] !== 'F' && !r.tileB[i] && !S.lotBlocker(s, i)) empty[s.zone[i]]++;
  for (const z of ['R', 'C', 'I']) {
    const need = 6 + s.pop / 300;
    if (s.demand[z] > 0.1 && empty[z] < need && can(500)) {
      const blk = claim(s, bot, z);
      if (!blk) {
        // Out of fresh blocks: fill the spare corners of service and power blocks instead.
        const spare = bot.blocks.filter((b) => (z === 'I' ? b.use === 'P' : b.use === 'S') && !b.filled?.[z]);
        for (const b of spare.slice(0, 2)) {
          const res = S.zoneArea(s, z, rectTiles({ x: b.ix, y: b.iy }, { x: b.ix + b.iw - 1, y: b.iy + b.ih - 1 }));
          b.filled = { ...(b.filled || {}), [z]: true };
          if (res.ok) did.push(`fill${z}`);
        }
        continue;
      }
      if (z === 'R' && s.ms >= 1) S.place(s, 'park', blk.ix + 2, blk.iy + 2);
      S.zoneArea(s, z, rectTiles({ x: blk.ix, y: blk.iy }, { x: blk.ix + blk.iw - 1, y: blk.iy + blk.ih - 1 }));
      did.push(`zone${z}`);
    }
  }
  return did;
}

/** Any free spot touching something that carries power, as far from homes as possible. */
function placeAnywhere(s, key) {
  const { w, h } = S.placeSize(key);
  const homes = s.blds.filter((b) => b.k === 'grow' && b.z === 'R');
  const hx = homes.reduce((a, b) => a + b.x, 0) / Math.max(1, homes.length);
  const hy = homes.reduce((a, b) => a + b.y, 0) / Math.max(1, homes.length);
  const spots = [];
  for (let y = 0; y + h <= H; y++) for (let x = 0; x + w <= W; x++) {
    let touch = false;
    for (let ty = y - 1; ty <= y + h && !touch; ty++) for (let tx = x - 1; tx <= x + w; tx++) {
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
      const i = idx(tx, ty);
      if (s.road[i] || s.line[i]) { touch = true; break; }
    }
    if (touch && S.checkPlace(s, key, x, y).ok) spots.push({ x, y, d: Math.hypot(x - hx, y - hy) });
  }
  if (!spots.length) return false;
  spots.sort((a, b) => b.d - a.d);
  return S.place(s, key, spots[0].x, spots[0].y).ok;
}

function tryAirport(s) {
  const { w, h } = S.placeSize('airport');
  for (let y = 1; y + h < H; y += 1) for (let x = 1; x + w < W; x += 1) {
    if (S.checkPlace(s, 'airport', x, y).ok) return S.place(s, 'airport', x, y).ok;
  }
  return false;
}

/** Play n months with the bot. onMonth(s) is called after each month. */
export function runBot(s, months, onMonth) {
  const bot = createBot(s);
  for (let m = 0; m < months; m++) {
    botStep(s, bot);
    const ev = S.advance(s, 1);
    onMonth?.(s, ev, bot);
    if (s.result?.over && !s.result.keepGoing) break;
  }
  return bot;
}

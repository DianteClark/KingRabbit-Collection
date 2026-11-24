// Bots that play Alchemist's Shop through the pure logic (used by tests/alchemist.test.mjs).
const G = await import('../games/alchemist/logic/game.js');
const D = await import('../games/alchemist/logic/data.js');
const B = await import('../games/alchemist/logic/brew.js');

export { G, D, B };

/** Every distinct 2-3 ingredient combo the inventory allows. */
export function combos(inv) {
  const ids = Object.keys(inv).filter((k) => inv[k] > 0).sort();
  const out = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i; j < ids.length; j++) {
      const two = [ids[i], ids[j]];
      if (i === j && inv[ids[i]] < 2) continue;
      out.push(two);
      for (let k = j; k < ids.length; k++) {
        const three = [...two, ids[k]];
        const need = {}; for (const x of three) need[x] = (need[x] || 0) + 1;
        if (Object.entries(need).every(([x, n]) => inv[x] >= n)) out.push(three);
      }
    }
  }
  return out;
}

const stock = (s, p) => G.shelfList(s).filter((e) => e.potion === p).reduce((a, e) => a + e.n, 0);
const RESERVE = [['fire', 'cinnabar'], ['life'], ['finest']];

/** A careful, sensible shopkeeper with perfect stirring. */
export function goodDay(s, { stir = 6, log = false } = {}) {
  if (s.phase !== 'prep') return;
  // unlock and upgrade, keeping a cushion for rent
  for (const a of ['forest', 'cave']) if (G.areaInfo(s, a).can && s.coins - D.AREAS[a].cost >= 20) G.unlockArea(s, a);
  for (const k of ['basket', 'cauldron', 'shelf', 'sign', 'apprentice']) {
    const u = G.upgradeInfo(s, k);
    if (u.can && s.coins - u.next.cost >= 35) G.buyUpgrade(s, k);
  }
  // shoo guards and gather, rare first, then whatever is most useful
  for (const a of ['cave', 'forest']) {
    if (!s.areas[a]) continue;
    for (const sp of D.AREAS[a].spots) {
      if (sp.guard && s.guards[sp.id] > 0 && s.stamina > s.guards[sp.id]) while (s.guards[sp.id] > 0) G.shoo(s, sp.id);
      if (sp.guard && !(s.guards[sp.id] > 0)) G.gather(s, sp.id);
    }
  }
  const order = [];
  for (const a of ['cave', 'forest', 'garden']) if (s.areas[a]) order.push(...D.AREAS[a].spots.filter((sp) => !sp.guard));
  let guard = 50;
  while (s.stamina > 0 && guard-- > 0) {
    // prefer the ingredient we hold the fewest of
    const open = order.filter((sp) => s.spots[sp.id] > 0);
    if (!open.length) break;
    open.sort((a, b) => (s.inv[a.ing] || 0) - (s.inv[b.ing] || 0));
    G.gather(s, open[0].id);
  }
  // a little fire from the market early on
  if (!s.areas.cave && s.coins > 30) { G.buy(s, 'pepper'); G.buy(s, 'sunwater'); }
  if (s.coins > 60) { G.buy(s, 'pepper'); G.buy(s, 'sunwater'); G.buy(s, 'salt'); }
  // brew what is short on the shelf
  const want = (p) => {
    if (!p || p === 'sludge') return -1;
    const have = stock(s, p);
    const target = D.POTIONS[p].legendary ? 2 : s.day >= 24 && ['fire', 'life'].includes(p) ? 4 : 3;
    if (have >= target) return 0;
    return D.POTIONS[p].value * (target - have);
  };
  let tries = 30;
  while (tries-- > 0 && G.shelfCount(s) < G.shelfCap(s)) {
    let best = null; let bestV = 0;
    for (const c of combos(s.inv)) {
      const m = B.mix(c);
      const v = want(m.potion) / c.length + (m.potent ? 3 : 0);
      if (v > bestV) { bestV = v; best = c; }
    }
    if (!best) break;
    const r = G.brew(s, best, stir);
    if (log) console.log(`  day ${s.day} brew ${best} -> ${r.potion} ${r.stars}*`);
    if (!r.ok) break;
  }
}

function keepForFestival(s, key) {
  if (s.mode !== 'story' || s.day < 24) return false;
  const { potion, stars } = G.parseKey(key);
  if (stars < 3) return false;
  const best = G.shelfList(s).filter((e) => e.stars === 3);
  if (potion === 'life') return best.filter((e) => e.potion === 'life').reduce((a, e) => a + e.n, 0) <= 1;
  if (D.POTIONS[potion].els.includes('fire') && !D.POTIONS[potion].legendary) return best.filter((e) => D.POTIONS[e.potion].els.includes('fire') && !D.POTIONS[e.potion].legendary).reduce((a, e) => a + e.n, 0) <= 1;
  if (D.POTIONS[potion].legendary) return true;
  return false;
}

export function goodShop(s) {
  if (!G.openShop(s)) return;
  while (!G.shopDone(s)) {
    const c = G.current(s);
    if (c.talk) { G.goodbye(s); continue; }
    const cands = G.shelfList(s).filter((e) => G.matches(c.req, e.potion) && !keepForFestival(s, e.key));
    cands.sort((a, b) => (b.stars >= (c.req.stars || 1)) - (a.stars >= (c.req.stars || 1)) || a.stars - b.stars);
    const e = cands[0];
    if (!e) { G.sorry(s); continue; }
    const r = G.offer(s, e.key, G.fairPrice(e.potion, e.stars));
    if (r.outcome === 'counter') G.acceptCounter(s);
  }
  return G.closeShop(s);
}

export function goodFestival(s) {
  G.startFestival(s);
  for (let r = 0; r < 3; r++) {
    let best = null; let bestV = -1;
    for (const e of G.shelfList(s)) {
      const v = G.festivalScore(r, e.potion, e.stars).score;
      if (v > bestV) { bestV = v; best = e.key; }
    }
    G.enterFestival(s, best);
  }
}

/** Plays the 30-day story well. */
export function playGood(seed, { skill = 0.5, stir = 6, log = false } = {}) {
  const s = G.newGame(seed);
  s.skill = skill;
  while (s.phase !== 'over') {
    goodDay(s, { stir, log });
    if (G.isFestivalDay(s)) { goodFestival(s); break; }
    const r = goodShop(s);
    if (log && r) console.log(`day ${r.day}: +${r.income} sold ${r.sold}/${r.customers} rep ${r.rep} coins ${r.coins}`);
    if (s.phase === 'night') G.sleep(s);
  }
  return s;
}

/** A shopkeeper who splurges at the market, botches every brew and overcharges everyone. */
export function playBad(seed, { maxDays = 30 } = {}) {
  const s = G.newGame(seed);
  let r = seed;
  const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  while (s.phase !== 'over' && s.day <= maxDays) {
    // shopping spree, no gathering
    for (const m of D.MARKET) { G.buy(s, m.ing); G.buy(s, m.ing); }
    for (let t = 0; t < 4; t++) {
      const cs = combos(s.inv);
      if (!cs.length) break;
      G.brew(s, cs[Math.floor(rnd() * cs.length)], 0);
    }
    if (G.isFestivalDay(s)) { G.startFestival(s); for (let i = 0; i < 3; i++) G.enterFestival(s, null); break; }
    G.openShop(s);
    while (!G.shopDone(s)) {
      const c = G.current(s);
      if (c.talk) { G.goodbye(s); continue; }
      const list = G.shelfList(s);
      if (!list.length) { G.sorry(s); continue; }
      const e = list[Math.floor(rnd() * list.length)];
      const o = G.offer(s, e.key, G.fairPrice(e.potion, e.stars) * 3);
      if (o.outcome === 'counter') G.insist(s);
      else if (o.outcome === 'wrong') G.sorry(s);
    }
    G.closeShop(s);
    if (s.phase === 'night') G.sleep(s);
  }
  return s;
}

/** A casual player: garden only, sloppy stirring, fair prices, never upgrades or prepares. */
export function playLazy(seed, { stir = 2 } = {}) {
  const s = G.newGame(seed);
  while (s.phase !== 'over') {
    let guard = 30;
    while (s.stamina > 0 && guard-- > 0) {
      const open = D.AREAS.garden.spots.filter((sp) => s.spots[sp.id] > 0).sort((a, b) => (s.inv[a.ing] || 0) - (s.inv[b.ing] || 0));
      if (!open.length) break;
      G.gather(s, open[0].id);
    }
    for (let t = 0; t < 6; t++) {
      let best = null; let bestV = 0;
      for (const c of combos(s.inv)) {
        const p = B.mix(c).potion;
        if (!p || p === 'sludge') continue;
        const v = D.POTIONS[p].value / (1 + stock(s, p));
        if (v > bestV) { bestV = v; best = c; }
      }
      if (!best || !G.brew(s, best, stir).ok) break;
    }
    if (G.isFestivalDay(s)) { goodFestival(s); break; }
    G.openShop(s);
    while (!G.shopDone(s)) {
      const c = G.current(s);
      if (c.talk) { G.goodbye(s); continue; }
      const e = G.shelfList(s).find((x) => G.matches(c.req, x.potion));
      if (!e) { G.sorry(s); continue; }
      const o = G.offer(s, e.key, G.fairPrice(e.potion, e.stars));
      if (o.outcome === 'counter') G.acceptCounter(s);
    }
    G.closeShop(s);
    if (s.phase === 'night') G.sleep(s);
  }
  return s;
}

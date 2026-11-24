// Alchemist's Shop: the whole game state and every action on it. Pure JS (no Phaser), JSON-safe,
// so it saves after every action and the bots in tests/alchemist.test.mjs can play it.
import {
  INGREDIENTS, POTIONS, AREAS, AREA_ORDER, MARKET, SPECIAL_PRICE, UPGRADES, START, STORY, STORY_DAYS,
  MAX_REP, NAMED, FOLK, NEEDS, EL_NEEDS, REQUEST_TIERS, FESTIVAL,
} from './data.js';
import { mix, starsFor } from './brew.js';
import { rand, randInt, pick } from './rng.js';
import { customerTune } from './tune.js';

export const VERSION = 1;
const STAR_MULT = [0, 0.75, 1, 1.35];

// ---------------------------------------------------------------- setup

export function newGame(seed = (Date.now() >>> 0)) {
  const s = {
    v: VERSION,
    seed: seed >>> 0,
    day: 1,
    phase: 'prep',
    mode: 'story',
    coins: START.coins,
    rep: START.rep,
    inv: { ...START.inv },
    shelf: {},
    known: {},
    up: { cauldron: 0, basket: 0, sign: 0, shelf: 0, apprentice: 0 },
    areas: { garden: true, forest: false, cave: false },
    spots: {},
    guards: {},
    stamina: 0,
    market: {},
    special: null,
    queue: [],
    cur: 0,
    today: null,
    storyLog: {},
    debtNights: 0,
    skill: 0.35,
    tut: {},
    festival: null,
    result: null,
    stats: { sold: 0, earned: 0, brewed: 0, served: 0, happy: 0, bestDay: 0 },
    lastReport: null,
  };
  startDay(s);
  return s;
}

/** Morning: refill the gathering spots, guards, picks and the market; the apprentice brews. */
export function startDay(s) {
  s.phase = 'prep';
  s.spots = {}; s.guards = {};
  for (const id of AREA_ORDER) {
    for (const sp of AREAS[id].spots) {
      s.spots[sp.id] = sp.picks;
      if (sp.guard) s.guards[sp.id] = sp.hp;
    }
  }
  s.stamina = staminaMax(s);
  s.market = Object.fromEntries(MARKET.map((m) => [m.ing, m.stock]));
  const wild = AREA_ORDER.filter((a) => s.areas[a]);
  const area = wild[wild.length - 1];
  const options = AREAS[area].spots.filter((sp) => !INGREDIENTS[sp.ing].rare).map((sp) => sp.ing);
  s.special = { ing: pick(s, options), price: SPECIAL_PRICE[area], stock: 3 };
  s.queue = []; s.cur = 0;
  s.today = { income: 0, sold: 0, customers: 0, happy: 0, repStart: s.rep, coinsStart: s.coins, brewed: [], apprentice: [], log: [] };
  apprenticeBrews(s);
}

export const staminaMax = (s) => UPGRADES.basket.levels[s.up.basket].picks;
export const shelfCap = (s) => UPGRADES.shelf.levels[s.up.shelf].cap;
export const shelfCount = (s) => Object.values(s.shelf).reduce((a, b) => a + b, 0);
export const cauldron = (s) => UPGRADES.cauldron.levels[s.up.cauldron];
export const rentFor = (day) => (day <= STORY_DAYS ? 6 + 3 * Math.floor((day - 1) / 5) : 24 + 2 * Math.floor((day - STORY_DAYS - 1) / 10));
export const DEBT_NIGHTS = 3; // this many nights in a row in debt and the shop closes
export const wageFor = (s) => UPGRADES.apprentice.levels[s.up.apprentice].wage;
export const isFestivalDay = (s) => s.mode === 'story' && s.day === STORY_DAYS;

// ---------------------------------------------------------------- shelf helpers

export const keyOf = (potion, stars) => `${potion}|${stars}`;
export function parseKey(k) { const [p, st] = k.split('|'); return { potion: p, stars: Number(st) }; }

function addPotion(s, potion, stars, n) {
  const room = shelfCap(s) - shelfCount(s);
  const add = Math.max(0, Math.min(n, room));
  if (add) s.shelf[keyOf(potion, stars)] = (s.shelf[keyOf(potion, stars)] || 0) + add;
  return add;
}
function takePotion(s, k) {
  if (!s.shelf[k]) return false;
  s.shelf[k] -= 1;
  if (s.shelf[k] <= 0) delete s.shelf[k];
  return true;
}
/** Shelf as a sorted list [{ key, potion, stars, n }]. */
export function shelfList(s) {
  return Object.entries(s.shelf).map(([key, n]) => ({ key, ...parseKey(key), n }))
    .sort((a, b) => POTIONS[b.potion].value - POTIONS[a.potion].value || a.potion.localeCompare(b.potion) || b.stars - a.stars);
}

export const fairPrice = (potion, stars) => Math.max(1, Math.round(POTIONS[potion].value * STAR_MULT[stars]));

// ---------------------------------------------------------------- gathering

export function spotInfo(id) {
  for (const a of AREA_ORDER) { const sp = AREAS[a].spots.find((x) => x.id === id); if (sp) return { ...sp, area: a }; }
  return null;
}

/** Tap a gathering spot. Returns { ok, ing } or { ok: false, why }. */
export function gather(s, spotId) {
  const sp = spotInfo(spotId);
  if (!sp || s.phase !== 'prep') return { ok: false, why: 'closed' };
  if (!s.areas[sp.area]) return { ok: false, why: 'locked' };
  if (s.guards[spotId] > 0) return { ok: false, why: 'guarded' };
  if (!(s.spots[spotId] > 0)) return { ok: false, why: 'empty' };
  if (s.stamina <= 0) return { ok: false, why: 'tired' };
  s.spots[spotId] -= 1;
  s.stamina -= 1;
  s.inv[sp.ing] = (s.inv[sp.ing] || 0) + 1;
  return { ok: true, ing: sp.ing };
}

/** Shoo a guard away (costs one pick per tap). Returns { ok, hp, fled }. */
export function shoo(s, spotId) {
  const sp = spotInfo(spotId);
  if (!sp || !(s.guards[spotId] > 0) || s.phase !== 'prep') return { ok: false, why: 'none' };
  if (!s.areas[sp.area]) return { ok: false, why: 'locked' };
  if (s.stamina <= 0) return { ok: false, why: 'tired' };
  s.stamina -= 1;
  s.guards[spotId] -= 1;
  return { ok: true, hp: s.guards[spotId], fled: s.guards[spotId] <= 0 };
}

// ---------------------------------------------------------------- market

export function buy(s, ing) {
  if (s.phase === 'open') return { ok: false, why: 'busy' };
  let price; let left;
  if (s.special && s.special.ing === ing && !(ing in s.market)) {
    price = s.special.price; left = s.special.stock;
  } else {
    const m = MARKET.find((x) => x.ing === ing);
    if (!m) return { ok: false, why: 'none' };
    price = m.price; left = s.market[ing];
  }
  if (!(left > 0)) return { ok: false, why: 'sold out' };
  if (s.coins < price) return { ok: false, why: 'coins' };
  s.coins -= price;
  if (s.special && s.special.ing === ing && !(ing in s.market)) s.special.stock -= 1; else s.market[ing] -= 1;
  s.inv[ing] = (s.inv[ing] || 0) + 1;
  if (s.today) s.today.spent = (s.today.spent || 0) + price;
  return { ok: true, price };
}

// ---------------------------------------------------------------- brewing

/** Can these ingredients go in the pot? (2-3, all in stock, room on the shelf) */
export function canBrew(s, ids) {
  if (s.phase === 'open' || s.phase === 'over') return { ok: false, why: 'The shop is busy.' };
  if (ids.length < 2) return { ok: false, why: 'Add at least 2 ingredients.' };
  if (ids.length > 3) return { ok: false, why: 'At most 3 ingredients.' };
  const need = {};
  for (const id of ids) need[id] = (need[id] || 0) + 1;
  for (const [id, n] of Object.entries(need)) if ((s.inv[id] || 0) < n) return { ok: false, why: `Not enough ${INGREDIENTS[id].name}.` };
  if (shelfCount(s) >= shelfCap(s)) return { ok: false, why: 'Your shelves are full. Sell or pour out some potions first.' };
  return { ok: true };
}

/** What the pot would make, if you already know that potion (else null). */
export function preview(s, ids) {
  const m = mix(ids);
  return { ...m, known: !!(m.potion && s.known[m.potion]) };
}

/**
 * Brew: uses the ingredients, makes a batch. stirTotal is the minigame score (0..6).
 * Returns { ok, potion, stars, n, isNew, potent }.
 */
export function brew(s, ids, stirTotal) {
  const c = canBrew(s, ids);
  if (!c.ok) return c;
  const m = mix(ids);
  for (const id of ids) { s.inv[id] -= 1; if (s.inv[id] <= 0) delete s.inv[id]; }
  const stars = starsFor(stirTotal, m.potent);
  const isNew = !s.known[m.potion];
  if (isNew) s.known[m.potion] = { combo: [...ids].sort(), best: stars, day: s.day };
  else if (stars > s.known[m.potion].best) s.known[m.potion].best = stars;
  const n = addPotion(s, m.potion, stars, cauldron(s).batch);
  s.stats.brewed += n;
  s.today?.brewed.push({ potion: m.potion, stars, n });
  return { ok: true, potion: m.potion, stars, n, isNew, potent: m.potent };
}

/** Pour one potion away (frees shelf space). */
export function pourOut(s, key) {
  if (s.phase === 'open') return false;
  return takePotion(s, key);
}

function apprenticeBrews(s) {
  const lvl = UPGRADES.apprentice.levels[s.up.apprentice];
  if (!lvl.brews) return;
  const known = Object.keys(s.known).filter((p) => p !== 'sludge' && !POTIONS[p].legendary && (s.up.apprentice >= 2 || POTIONS[p].els.length === 1));
  if (!known.length) return;
  for (let i = 0; i < lvl.brews; i++) {
    // brew whatever is lowest on the shelf
    const have = (p) => Object.entries(s.shelf).filter(([k]) => parseKey(k).potion === p).reduce((a, [, n]) => a + n, 0);
    const p = known.slice().sort((a, b) => have(a) - have(b) || POTIONS[b].value - POTIONS[a].value)[0];
    const stars = s.up.apprentice >= 2 ? 2 : 1 + randInt(s, 2);
    if (addPotion(s, p, stars, 1)) s.today.apprentice.push({ potion: p, stars });
  }
}

// ---------------------------------------------------------------- upgrades and areas

export function upgradeInfo(s, key) {
  const u = UPGRADES[key];
  const lvl = s.up[key];
  const next = u.levels[lvl + 1] || null;
  let why = null;
  if (!next) why = 'Fully upgraded';
  else if (next.minDay && s.day < next.minDay) why = `From day ${next.minDay}`;
  else if (s.coins < next.cost) why = `Need ${next.cost} coins`;
  return { key, name: u.name, now: u.levels[lvl], next, can: !why, why };
}

export function buyUpgrade(s, key) {
  if (s.phase === 'open' || s.phase === 'over') return { ok: false };
  const info = upgradeInfo(s, key);
  if (!info.can) return { ok: false, why: info.why };
  s.coins -= info.next.cost;
  s.up[key] += 1;
  if (key === 'basket') s.stamina += info.next.picks - UPGRADES.basket.levels[s.up.basket - 1].picks;
  return { ok: true };
}

export function areaInfo(s, id) {
  const a = AREAS[id];
  if (s.areas[id]) return { id, open: true };
  let why = null;
  if (a.minDay && s.day < a.minDay) why = `Opens on day ${a.minDay}`;
  else if (a.minRep && s.rep < a.minRep) why = `Needs ${a.minRep} reputation`;
  else if (s.coins < a.cost) why = `Costs ${a.cost} coins`;
  return { id, open: false, cost: a.cost, can: !why, why };
}

export function unlockArea(s, id) {
  if (s.phase === 'open' || s.phase === 'over') return { ok: false };
  const info = areaInfo(s, id);
  if (info.open || !info.can) return { ok: false, why: info.why };
  s.coins -= AREAS[id].cost;
  s.areas[id] = true;
  return { ok: true };
}

// ---------------------------------------------------------------- customers

export function customerCount(s) {
  if (s.day === 1 && s.mode === 'story') return 2;
  return Math.min(9, 2 + Math.floor(s.rep / 20) + UPGRADES.sign.levels[s.up.sign].extra);
}

function requestPool(s) {
  const out = [];
  for (const t of REQUEST_TIERS) if (s.day >= t.day || s.rep >= t.rep) out.push(...t.potions);
  return out;
}

function makeRequest(s, T) {
  const pool = requestPool(s);
  // Rich customers sometimes want a legendary potion late in the game.
  if (s.day >= 18 && s.rep >= 40 && rand(s) < 0.07) {
    const p = rand(s) < 0.6 ? 'phoenix' : 'philosopher';
    return { req: { potion: p, stars: 1 }, text: pick(s, NEEDS[p]), noble: true };
  }
  const potion = pick(s, pool);
  const ramp = Math.min(1, s.day / 10);
  let stars = 1;
  if (rand(s) < T.starsChance * ramp) stars = s.day > 15 && rand(s) < 0.3 ? 3 : 2;
  if (s.day > 2 && rand(s) < T.elChance) {
    const el = pick(s, POTIONS[potion].els);
    const text = EL_NEEDS[el] + (stars >= 2 ? (stars === 3 ? ' The very best you have!' : ' And make it strong.') : '');
    return { req: { el, stars }, text };
  }
  return { req: { potion, stars }, text: pick(s, NEEDS[potion]) + (stars >= 2 ? (stars === 3 ? ' Only the very best!' : ' A strong one, please.') : '') };
}

function storyToday(s) { return s.mode === 'story' ? STORY.find((b) => b.day === s.day) : null; }

/** Open the doors: line up today's customers. */
export function openShop(s) {
  if (s.phase !== 'prep' || isFestivalDay(s)) return false;
  const T = customerTune(s.skill);
  const n = customerCount(s);
  const q = [];
  const beat = storyToday(s);
  if (beat) {
    const who = NAMED[beat.who];
    const c = { name: who.name, title: who.title, row: who.row, tint: null, story: beat.day, patience: 3, tol: Math.max(T.tol, 0.35) };
    if (beat.talk) {
      const ok = beat.needs ? !!s.storyLog[beat.needs] : true;
      c.talk = true; c.text = ok || !beat.helloFail ? beat.hello : beat.helloFail; c.giftOk = ok;
    } else {
      c.req = { stars: 1, ...beat.req }; c.text = beat.hello;
    }
    q.push(c);
  }
  // Day 1 has a fixed, easy second customer so the first shop always works.
  if (s.mode === 'story' && s.day === 1) {
    q.push({ ...FOLK[4], req: { potion: 'air', stars: 1 }, text: 'Hello! I\'m late for school again. Something for quick feet?', patience: 3, tol: 0.4 });
  }
  while (q.length < Math.max(n, beat ? 1 : 0)) {
    const f = pick(s, FOLK.slice(0, 9));
    const r = makeRequest(s, T);
    const folk = r.noble ? FOLK[9] : f;
    q.push({ name: folk.name, row: folk.row, tint: folk.tint, req: r.req, text: r.text, patience: T.patience, tol: (r.noble ? 0.6 : T.tol) * (0.75 + rand(s) * 0.5) });
  }
  s.queue = q.map((c, i) => ({ ...c, id: i, offers: 0, done: false, outcome: null }));
  s.cur = 0;
  s.phase = 'open';
  s.today.customers = q.filter((c) => !c.talk).length;
  return true;
}

export const current = (s) => (s.phase === 'open' ? s.queue[s.cur] || null : null);
export const shopDone = (s) => s.phase === 'open' && s.cur >= s.queue.length;

/** Does this potion answer the request? */
export function matches(req, potion) {
  if (!req || !potion || potion === 'sludge') return false;
  if (req.potion) return req.potion === potion;
  return POTIONS[potion].els.includes(req.el);
}

/** What the customer is willing to pay at most for this potion (internal; the UI never shows it). */
function maxPay(c, potion, stars) {
  const weak = stars < (c.req.stars || 1);
  const eff = fairPrice(potion, stars) * (weak ? 0.7 : 1);
  return { eff, max: Math.round(eff * (1 + c.tol)), weak };
}

function addRep(s, d) { s.rep = Math.max(0, Math.min(MAX_REP, s.rep + d)); return d; }

function finish(s, c, outcome, extra = {}) {
  c.done = true; c.outcome = outcome;
  Object.assign(c, extra);
  if (c.story && !c.talk) {
    const ok = outcome === 'sold' && !c.weak;
    s.storyLog[c.story] = ok;
  }
  s.cur += 1;
}

function storyGift(s, c, ok) {
  const beat = STORY.find((b) => b.day === c.story);
  if (!beat?.gift || !(ok || beat.giftAlways)) return null;
  if (beat.gift.coins) { s.coins += beat.gift.coins; s.today.income += beat.gift.coins; }
  if (beat.gift.ing) s.inv[beat.gift.ing] = (s.inv[beat.gift.ing] || 0) + beat.gift.n;
  return beat.gift;
}

function sell(s, c, key, price, repDelta) {
  const { potion, stars } = parseKey(key);
  takePotion(s, key);
  s.coins += price;
  s.today.income += price; s.today.sold += 1;
  s.stats.sold += 1; s.stats.earned += price;
  const { weak } = maxPay(c, potion, stars);
  addRep(s, repDelta);
  const happy = !weak && repDelta > 0;
  if (happy) { s.today.happy += 1; s.stats.happy += 1; }
  s.stats.served += 1;
  finish(s, c, 'sold', { price, potion, stars, weak, rep: repDelta });
  const gift = c.story ? storyGift(s, c, !weak) : null;
  const beat = c.story ? STORY.find((b) => b.day === c.story) : null;
  s.today.log.push({ name: c.name, text: `${POTIONS[potion].name} for ${price}`, good: happy });
  return { outcome: 'sold', price, potion, stars, weak, rep: repDelta, gift, line: beat ? (weak ? beat.thanks : beat.thanks) : null };
}

function saleRep(c, potion, stars, price) {
  const { eff, weak } = maxPay(c, potion, stars);
  if (weak) return price <= eff ? 1 : 0;
  let gain = 1 + (c.story ? 1 : 0) + (stars === 3 ? 1 : 0);
  if (price <= fairPrice(potion, stars)) gain += 1;
  else if (price > eff * 1.2) gain -= 1;
  return gain;
}

/**
 * Offer a potion from the shelf at a price.
 * Returns { outcome: 'sold' | 'counter' | 'wrong' | 'left', ... }.
 */
export function offer(s, key, price) {
  const c = current(s);
  if (!c || c.talk || c.counter) return { outcome: 'none' };
  if (!s.shelf[key]) return { outcome: 'none' };
  price = Math.max(1, Math.round(price));
  const { potion, stars } = parseKey(key);
  c.offers += 1;
  if (!matches(c.req, potion)) {
    c.patience -= 1;
    if (c.patience <= 0) {
      addRep(s, -1);
      finish(s, c, 'left', { rep: -1 });
      s.today.log.push({ name: c.name, text: 'left empty-handed', good: false });
      return { outcome: 'left', rep: -1, why: 'wrong' };
    }
    return { outcome: 'wrong', potion, patience: c.patience };
  }
  const { eff, max, weak } = maxPay(c, potion, stars);
  if (price <= max) return sell(s, c, key, price, saleRep(c, potion, stars, price));
  const counter = Math.max(1, Math.min(price - 1, Math.round(eff * (1 + c.tol * 0.4))));
  c.counter = { key, price, counter };
  return { outcome: 'counter', counter, price, weak };
}

/** Take the customer's counter-offer. */
export function acceptCounter(s) {
  const c = current(s);
  if (!c?.counter) return { outcome: 'none' };
  const { key, counter } = c.counter;
  delete c.counter;
  if (!s.shelf[key]) return { outcome: 'none' };
  const { potion, stars } = parseKey(key);
  return sell(s, c, key, counter, saleRep(c, potion, stars, counter));
}

/** Stick to your price: a grumpy sale if it is not too far off, otherwise they walk out. */
export function insist(s) {
  const c = current(s);
  if (!c?.counter) return { outcome: 'none' };
  const { key, price } = c.counter;
  delete c.counter;
  const { potion, stars } = parseKey(key);
  const { max } = maxPay(c, potion, stars);
  if (price <= Math.round(max * 1.15) && s.shelf[key]) return { ...sell(s, c, key, price, -2), grumpy: true };
  addRep(s, -3);
  finish(s, c, 'left', { rep: -3 });
  s.today.log.push({ name: c.name, text: 'stormed out over the price', good: false });
  return { outcome: 'left', rep: -3, why: 'price' };
}

/** Say no to the counter-offer and let them go. */
export function refuseCounter(s) {
  const c = current(s);
  if (!c?.counter) return { outcome: 'none' };
  delete c.counter;
  addRep(s, -1);
  finish(s, c, 'left', { rep: -1 });
  s.today.log.push({ name: c.name, text: 'left after haggling', good: false });
  return { outcome: 'left', rep: -1, why: 'refused' };
}

/** "Sorry, I can't help." Story customers are a little disappointed. */
export function sorry(s) {
  const c = current(s);
  if (!c || c.talk) return { outcome: 'none' };
  delete c.counter;
  const d = c.story ? -1 : 0;
  addRep(s, d);
  finish(s, c, 'sorry', { rep: d });
  s.today.log.push({ name: c.name, text: 'went away without a potion', good: false });
  const beat = c.story ? STORY.find((b) => b.day === c.story) : null;
  const gift = beat?.giftAlways ? storyGift(s, c, false) : null;
  return { outcome: 'sorry', rep: d, line: beat?.sorry || null, gift };
}

/** Finish a story visit that has no request. */
export function goodbye(s) {
  const c = current(s);
  if (!c?.talk) return { outcome: 'none' };
  const gift = c.giftOk ? storyGift(s, c, true) : null;
  finish(s, c, 'talk');
  return { outcome: 'talk', gift };
}

// ---------------------------------------------------------------- night

/**
 * Close up: pay rent and wages, check for debt. Returns the day's report (also kept in s.lastReport).
 * Three nights in a row in debt and the shop closes.
 */
export function closeShop(s) {
  if (s.phase !== 'open' || !shopDone(s)) return null;
  const rent = rentFor(s.day);
  const wage = wageFor(s);
  s.coins -= rent + wage;
  const t = s.today;
  const report = {
    day: s.day, income: t.income, spent: t.spent || 0, sold: t.sold, customers: t.customers, happy: t.happy,
    rep: s.rep, repDelta: s.rep - t.repStart, rent, wage, coins: s.coins, log: t.log, brewed: t.brewed,
    debt: s.coins < 0, closed: false, satisfaction: t.customers ? t.happy / t.customers : 1,
  };
  if (s.coins < 0) {
    s.debtNights += 1;
    if (s.debtNights >= DEBT_NIGHTS) { report.closed = true; s.phase = 'over'; s.result = { kind: 'broke', day: s.day }; }
  } else s.debtNights = 0;
  s.stats.bestDay = Math.max(s.stats.bestDay, t.income);
  if (!report.closed) s.phase = 'night';
  s.lastReport = report;
  return report;
}

/** Go to bed: next morning. */
export function sleep(s) {
  if (s.phase !== 'night') return false;
  s.day += 1;
  startDay(s);
  return true;
}

// ---------------------------------------------------------------- festival (day 30)

export function festivalScore(round, potion, stars) {
  const r = FESTIVAL[round];
  const p = POTIONS[potion];
  if (!p || potion === 'sludge') return { score: 1, match: false };
  const match = r.finest ? true : r.potion ? r.potion === potion : p.els.includes(r.el);
  const valuePts = Math.round(p.value * (r.finest ? 0.4 : 0.2));
  return { score: (match ? 10 : 0) + stars * 5 + valuePts, match };
}

/** Madame Vex's three scores: fixed by the adaptive skill, with a little seeded wobble. */
export function rivalScores(s) {
  const base = customerTune(s.skill).rival;
  const out = [];
  let x = s.seed ^ 0x5eed;
  for (let i = 0; i < 3; i++) { x = (x * 1103515245 + 12345) >>> 0; out.push(Math.round(base + ((x >>> 16) % 5) - 2 + (i === 2 ? 4 : 0))); }
  return out;
}
export const repBonus = (s) => Math.round(s.rep / 10);

export function startFestival(s) {
  if (s.phase !== 'prep' || !isFestivalDay(s)) return false;
  s.phase = 'festival';
  s.festival = { round: 0, picks: [], scores: [], rival: rivalScores(s) };
  return true;
}

/** Enter a potion for the current round (key null = enter nothing). */
export function enterFestival(s, key) {
  const f = s.festival;
  if (s.phase !== 'festival' || !f || f.round >= FESTIVAL.length) return null;
  let res = { score: 0, match: false };
  let potion = null; let stars = 0;
  if (key && s.shelf[key]) {
    ({ potion, stars } = parseKey(key));
    takePotion(s, key);
    res = festivalScore(f.round, potion, stars);
  }
  f.picks.push(key ? { potion, stars } : null);
  f.scores.push(res.score);
  f.round += 1;
  if (f.round >= FESTIVAL.length) {
    const you = f.scores.reduce((a, b) => a + b, 0) + repBonus(s);
    const vex = f.rival.reduce((a, b) => a + b, 0);
    f.total = you; f.vexTotal = vex;
    s.result = { kind: you >= vex ? 'win' : 'second', you, vex, day: s.day };
    s.phase = 'over';
  }
  return { ...res, potion, stars, rival: f.rival[f.round - 1], done: f.round >= FESTIVAL.length };
}

/** After the story ends (festival won or lost), keep the shop going forever. */
export function goEndless(s) {
  if (!s.result || s.result.kind === 'broke') return false;
  s.mode = 'endless';
  s.result = null;
  s.festival = null;
  s.day += 1;
  s.debtNights = 0;
  startDay(s);
  return true;
}

/** Fill in fields an older save might be missing. */
export function migrate(s) {
  if (!s || typeof s !== 'object' || !s.up) return null;
  const fresh = newGame(1);
  for (const k of Object.keys(fresh)) if (s[k] === undefined) s[k] = fresh[k];
  for (const k of Object.keys(fresh.up)) if (s.up[k] === undefined) s.up[k] = 0;
  return s;
}

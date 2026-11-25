// Between runs: coins, the permanent upgrade shop, unlocking heroes, the daily challenge and run
// scoring. Works on a plain object (the save), so tests can run it without localStorage.
import { SHOP, CHARACTERS, CHARACTER_IDS } from './data.js';
import { makeRng } from './rng.js';

export const META_DEFAULTS = {
  coins: 0, shop: {}, heroes: ['wanderer'], hero: 'wanderer', easy: false,
  runs: 0, bestTime: 0, bestKills: 0, totalKills: 0, wins: 0, hints: {},
};

export const shopCost = (id, level) => (level >= SHOP[id].max ? null : SHOP[id].base * (level + 1));

/** Buy the next level of a permanent upgrade. Returns true if bought. */
export function buyUpgrade(meta, id) {
  const lv = meta.shop[id] || 0;
  const cost = shopCost(id, lv);
  if (cost == null || meta.coins < cost) return false;
  meta.coins -= cost;
  meta.shop = { ...meta.shop, [id]: lv + 1 };
  return true;
}

/** Unlock a hero with coins. Returns true if unlocked now. */
export function unlockHero(meta, id) {
  const c = CHARACTERS[id];
  if (!c || meta.heroes.includes(id) || meta.coins < c.cost) return false;
  meta.coins -= c.cost;
  meta.heroes = [...meta.heroes, id];
  return true;
}

/** Sell everything back (full refund of the shop). */
export function refundShop(meta) {
  let back = 0;
  for (const [id, lv] of Object.entries(meta.shop)) for (let k = 0; k < lv; k++) back += SHOP[id].base * (k + 1);
  meta.coins += back;
  meta.shop = {};
  return back;
}

/** Today's challenge from dailySeed(): a fixed hero and a fixed run seed, normal difficulty. */
export function dailyConfig(seed) {
  const rng = makeRng(seed);
  return { hero: CHARACTER_IDS[rng.int(CHARACTER_IDS.length)], seed: (rng() * 0xffffffff) >>> 0 };
}

/** Daily score: time survived counts most, kills break ties. */
export const dailyScore = (time, kills) => Math.floor(Math.min(time, 900)) * 10 + kills;

/** Fold a finished run into the save. Returns the coins banked. */
export function recordRun(meta, { time, kills, coins, won }) {
  meta.coins += coins;
  meta.runs += 1;
  meta.totalKills += kills;
  meta.bestTime = Math.max(meta.bestTime, Math.floor(time));
  meta.bestKills = Math.max(meta.bestKills, kills);
  if (won) meta.wins += 1;
  return coins;
}

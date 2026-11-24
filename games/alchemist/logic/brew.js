// Brewing: what a mix of ingredients makes, and how the stirring minigame turns into stars.
import { INGREDIENTS, POTIONS, ELEMENTS, pairPotion } from './data.js';

export const POTENT_AT = 7; // total element power for a "potent" brew (+1 star)

/** Sum of element amounts for a list of ingredient ids. */
export function elementsOf(ids) {
  const sum = Object.fromEntries(ELEMENTS.map((e) => [e, 0]));
  for (const id of ids) for (const [e, v] of Object.entries(INGREDIENTS[id]?.el || {})) sum[e] += v;
  return sum;
}

/**
 * What 2-3 ingredients make.
 * Rules (also shown in How to Play):
 *  - Legendary sets win first (all their rare ingredients are in the pot).
 *  - If the strongest element is at least twice the next one, it is a pure potion.
 *  - If the 2nd and 3rd strongest are tied, the brew is muddled (Murky Sludge).
 *  - Otherwise the two strongest elements make a pair potion.
 * Returns { potion, els (sums), power, potent }.
 */
export function mix(ids) {
  const els = elementsOf(ids);
  const power = Object.values(els).reduce((a, b) => a + b, 0);
  const potent = power >= POTENT_AT;
  const out = (potion) => ({ potion, els, power, potent });
  if (ids.length < 2 || ids.length > 3) return out(null);
  for (const [id, p] of Object.entries(POTIONS)) {
    if (p.legendary && p.legendary.length <= ids.length && p.legendary.every((need) => ids.includes(need))) {
      // the most demanding legendary wins (Sage's Gold over Phoenix Elixir)
      const better = Object.entries(POTIONS).find(([, q]) => q.legendary && q.legendary.length > p.legendary.length && q.legendary.every((n) => ids.includes(n)));
      if (!better) return out(id);
    }
  }
  const sorted = ELEMENTS.map((e) => [e, els[e]]).sort((a, b) => b[1] - a[1] || ELEMENTS.indexOf(a[0]) - ELEMENTS.indexOf(b[0]));
  const [[e1, v1], [e2, v2], [, v3]] = sorted;
  if (v2 === 0 || v1 >= 2 * v2) return out(e1);
  if (v3 > 0 && v3 === v2) return out('sludge');
  return out(pairPotion(e1, e2));
}

// ---------------------------------------------------------------- stirring minigame

// The heat bar runs 0..1. The needle sweeps back and forth; you tap Stir three times.
// The green zone is "good", the gold centre "perfect". zoneScale widens both (cauldron upgrades).
export const STIR = { rounds: 3, good: 0.16, perfect: 0.05, period: 1.5 };

/** Zone for a round: centre moves each round so it doesn't become muscle memory. */
export function stirZone(round, zoneScale = 1, seed = 0) {
  const centres = [0.5, 0.68, 0.32, 0.6, 0.4];
  const c = centres[(round + seed) % centres.length];
  return { centre: c, good: STIR.good * zoneScale, perfect: STIR.perfect * zoneScale };
}

/** Needle position (0..1) at time t seconds for a sweep period (s per one-way pass). */
export function needleAt(t, period) {
  const p = (t / period) % 2;
  return p <= 1 ? p : 2 - p;
}

/** 2 = perfect, 1 = good, 0 = miss. */
export function stirHit(pos, zone) {
  const d = Math.abs(pos - zone.centre);
  if (d <= zone.perfect) return 2;
  if (d <= zone.good) return 1;
  return 0;
}

/** Total of three stir hits (0..6) -> 1..3 stars, +1 if potent (max 3). */
export function starsFor(total, potent = false) {
  const base = total >= 5 ? 3 : total >= 3 ? 2 : 1;
  return Math.min(3, base + (potent ? 1 : 0));
}

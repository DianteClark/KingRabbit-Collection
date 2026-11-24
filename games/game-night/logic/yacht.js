// Yacht dice scoring (Yahtzee-style rules, 13 rounds).

export const CATEGORIES = [
  { id: 'ones', name: 'Ones', upper: 1 },
  { id: 'twos', name: 'Twos', upper: 2 },
  { id: 'threes', name: 'Threes', upper: 3 },
  { id: 'fours', name: 'Fours', upper: 4 },
  { id: 'fives', name: 'Fives', upper: 5 },
  { id: 'sixes', name: 'Sixes', upper: 6 },
  { id: 'three', name: '3 of a Kind' },
  { id: 'four', name: '4 of a Kind' },
  { id: 'house', name: 'Full House' },
  { id: 'small', name: 'Sm Straight' },
  { id: 'large', name: 'Lg Straight' },
  { id: 'yacht', name: 'Yacht' },
  { id: 'chance', name: 'Chance' },
];

export const UPPER_BONUS_AT = 63;
export const UPPER_BONUS = 35;

const sum = (dice) => dice.reduce((a, b) => a + b, 0);

function counts(dice) {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) c[d]++;
  return c;
}

function hasRun(dice, len) {
  const set = new Set(dice);
  for (let start = 1; start + len - 1 <= 6; start++) {
    let ok = true;
    for (let v = start; v < start + len; v++) if (!set.has(v)) { ok = false; break; }
    if (ok) return true;
  }
  return false;
}

/** Points the 5 dice would earn in category `id`. */
export function score(id, dice) {
  const c = counts(dice);
  const most = Math.max(...c);
  const cat = CATEGORIES.find((x) => x.id === id);
  if (cat?.upper) return c[cat.upper] * cat.upper;
  switch (id) {
    case 'three': return most >= 3 ? sum(dice) : 0;
    case 'four': return most >= 4 ? sum(dice) : 0;
    case 'house': return c.includes(3) && c.includes(2) ? 25 : 0;
    case 'small': return hasRun(dice, 4) ? 30 : 0;
    case 'large': return hasRun(dice, 5) ? 40 : 0;
    case 'yacht': return most === 5 ? 50 : 0;
    case 'chance': return sum(dice);
    default: return 0;
  }
}

/** Totals for a scorecard { id: points|undefined }. */
export function totals(card) {
  let upper = 0;
  let lower = 0;
  for (const cat of CATEGORIES) {
    const v = card[cat.id] ?? 0;
    if (cat.upper) upper += v; else lower += v;
  }
  const bonus = upper >= UPPER_BONUS_AT ? UPPER_BONUS : 0;
  return { upper, bonus, lower, total: upper + bonus + lower };
}

export const isComplete = (card) => CATEGORIES.every((c) => card[c.id] !== undefined);

// ---- Extra Yacht bonus + joker rules (official Yahtzee rules) ----
export const isYacht = (dice) => dice.every((d) => d === dice[0]);

/** A second Yacht acts as a joker once the Yacht box has been filled (with 50 or 0). */
export const jokerActive = (card, dice) => isYacht(dice) && card.yacht !== undefined;

/** Categories you may score this roll in. */
export function allowed(card, dice) {
  const open = CATEGORIES.filter((c) => card[c.id] === undefined);
  if (!jokerActive(card, dice)) return open.map((c) => c.id);
  const upper = CATEGORIES.find((c) => c.upper === dice[0]);
  if (card[upper.id] === undefined) return [upper.id];                 // must use the matching upper box
  const lower = open.filter((c) => !c.upper);
  return (lower.length ? lower : open).map((c) => c.id);               // else any lower box, else a zero
}

/** Points for a category, applying joker values when they apply. */
export function scoreFor(id, dice, card) {
  if (!jokerActive(card, dice)) return score(id, dice);
  const fixed = { house: 25, small: 30, large: 40 };
  if (fixed[id] !== undefined) return fixed[id];
  return score(id, dice);
}

/** Total including the +100 bonuses for extra Yachts. */
export function grandTotal(card) {
  return totals(card).total + (card.yachtBonus || 0);
}

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

// ---------- CPU player ----------
const countsOf = (dice) => { const c = [0, 0, 0, 0, 0, 0, 0]; for (const d of dice) c[d]++; return c; };

/** Value of scoring `id` now: the points, adjusted for what the box could be worth later. */
function categoryValue(id, dice, card, level) {
  const pts = scoreFor(id, dice, card);
  const cat = CATEGORIES.find((c) => c.id === id);
  let v = pts;
  if (cat.upper) {
    // Three or more of a face keeps the 63-point bonus on track.
    const n = countsOf(dice)[cat.upper];
    v += (n - 3) * cat.upper * (level === 'hard' ? 1.2 : 0.6);
  }
  if (id === 'chance') v -= level === 'hard' ? 14 : 6;                 // keep Chance as a safety net
  if (id === 'yacht' && pts === 0) v -= 25;                           // don't throw away the Yacht box early
  if ((id === 'large' || id === 'small' || id === 'house' || id === 'four') && pts === 0) v -= 8;
  if (pts === 0 && cat.upper) v -= cat.upper * 2;                     // zero the cheap upper boxes first
  return v;
}

export const LEVELS = { easy: { random: 0.3, smart: 0 }, normal: { random: 0, smart: 0 }, hard: { random: 0, smart: 1 } };

/** Pick a play style for this decision from a blended config. */
export function styleFor(cfg, rng = Math.random) {
  if (typeof cfg === 'string') return cfg;
  if (rng() < cfg.random) return 'easy';
  return rng() < cfg.smart ? 'hard' : 'normal';
}

export function cpuChoose(dice, card, cfgOrLevel = 'normal') {
  const level = styleFor(cfgOrLevel);
  const ids = allowed(card, dice);
  return ids.sort((a, b) => categoryValue(b, dice, card, level) - categoryValue(a, dice, card, level))[0];
}

/** Which dice to keep before the next roll (true = hold). null means "stop rolling". */
export function cpuHold(dice, card, cfgOrLevel = 'normal', rng = Math.random) {
  const level = styleFor(cfgOrLevel, rng);
  const open = (id) => card[id] === undefined;
  const c = countsOf(dice);
  const set = new Set(dice);
  const has = (seq) => seq.every((v) => set.has(v));
  // Already great: stop.
  if (isYacht(dice) && (open('yacht') || card.yacht === 50)) return null;
  if (open('large') && score('large', dice)) return null;
  if (open('house') && score('house', dice) && level !== 'easy') return null;
  if (level === 'easy' && rng() < 0.3) return dice.map(() => rng() < 0.5);
  // Chase straights when we have 4 in a row, or 3 in a row early with both straight boxes open.
  for (const run of [[1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6]]) {
    if ((open('large') || open('small')) && has(run)) {
      if (!open('large') && open('small')) return null;
      const keep = new Set(run);
      return dice.map((d) => { if (keep.has(d)) { keep.delete(d); return true; } return false; });
    }
  }
  // Otherwise keep the best set of matching dice.
  let face = 6; let best = -1;
  for (let f = 6; f >= 1; f--) {
    const upperOpen = open(['', 'ones', 'twos', 'threes', 'fours', 'fives', 'sixes'][f]);
    const w = c[f] * 10 + f + (upperOpen ? 4 : 0);
    if (c[f] >= 1 && w > best) { best = w; face = f; }
  }
  if (c[face] === 1 && level === 'hard' && open('small')) {
    // Nothing paired: keep a 3-run toward a straight instead.
    for (const run of [[3, 4, 5], [2, 3, 4], [4, 5, 6]]) {
      if (has(run)) { const keep = new Set(run); return dice.map((d) => { if (keep.has(d)) { keep.delete(d); return true; } return false; }); }
    }
  }
  return dice.map((d) => d === face);
}

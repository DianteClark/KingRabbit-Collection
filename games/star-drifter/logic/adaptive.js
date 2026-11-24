// Adaptive enemy skill (the Game Night pattern), as pure functions over a plain number so it can be
// tested in node and saved anywhere. Skill 0..1 drifts toward the level where fights cost you a
// fair bit of hull. Only HOW enemy ships play is tuned: which room they aim at and when they pull
// the trigger. Ship loadouts, damage, hull and the dice are never touched.

export const START = 0.35;

/** Presets blended by skill. smart = chance to aim at a key system; sync = chance to hold
 * weapons for one big volley; delay = reaction seconds once a weapon is ready; hold = max seconds
 * spent waiting for a volley. */
export const AI_PRESETS = {
  easy: { smart: 0.15, sync: 0, delay: 2.2, hold: 0 },
  normal: { smart: 0.55, sync: 0.45, delay: 0.9, hold: 4 },
  hard: { smart: 0.9, sync: 0.85, delay: 0.25, hold: 7 },
};

export function tune(presets, s, ints = []) {
  const { easy, normal, hard } = presets;
  const out = {};
  const keys = new Set([...Object.keys(easy), ...Object.keys(normal), ...Object.keys(hard)]);
  for (const k of keys) {
    const a = easy[k] ?? 0; const b = normal[k] ?? 0; const c = hard[k] ?? 0;
    const v = s <= 0.5 ? a + (b - a) * (s / 0.5) : b + (c - b) * ((s - 0.5) / 0.5);
    out[k] = ints.includes(k) ? Math.round(v) : v;
  }
  return out;
}

export const aiFor = (skill) => tune(AI_PRESETS, Math.max(0, Math.min(1, skill)));

/**
 * After a fight the player won or fled. hullLostFrac: hull lost as a share of max hull.
 * A clean win (< 8%) nudges the enemy smarter, a bruising one (> 22%) makes it gentler.
 * Returns the new skill. games = fights reported so far (settles quickly at first).
 */
export function adjust(skill, hullLostFrac, games = 10) {
  let result = 0.5;
  if (hullLostFrac < 0.08) result = 1;
  else if (hullLostFrac > 0.22) result = 0;
  const k = games <= 4 ? 0.12 : 0.06;
  return Math.max(0, Math.min(1, skill + k * (result - 0.5) * 2));
}

/** Losing a run (the ship is destroyed) backs the skill off a good step. */
export const afterLoss = (skill) => Math.max(0, skill - 0.15);

/** 1-10 for display. */
export const skillLabel = (s) => Math.round(s * 9) + 1;

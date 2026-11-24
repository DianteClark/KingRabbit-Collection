// Draw dominoes with a spinner, you vs CPU (double-six set, 7 tiles each).
//  - The player holding the highest double leads with it (if nobody has a double, the heaviest tile leads).
//  - The opening double is the spinner: tiles can be played off its left and right, and once both
//    of those sides are covered, off its top and bottom too, so the layout can grow in 4 directions.
//  - On your turn play a tile that matches an open end; if you can't, draw from the boneyard until
//    you can (pass only when the boneyard is empty).
//  - Domino! The first player out scores the pips left in the opponent's hand. A blocked game is
//    won by the lighter hand, which scores the opponent's pips. First to 100 wins the match.

export const TARGET = 100;
export const SIDES = ['left', 'right', 'up', 'down'];

export function fullSet() {
  const set = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) set.push([a, b]);
  return set;
}

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export const pips = (hand) => hand.reduce((s, [a, b]) => s + a + b, 0);
const isDouble = (t) => t[0] === t[1];
const weight = (t) => (isDouble(t) ? 100 + t[0] : t[0] + t[1]);

export function newRound(rng = Math.random) {
  const bones = shuffle(fullSet(), rng);
  const hands = [bones.splice(0, 7), bones.splice(0, 7)];
  // Find the lead tile: highest double, else heaviest tile.
  let best = -1; let lead = null;
  hands.forEach((h, p) => h.forEach((t, i) => { const w = weight(t); if (w > best) { best = w; lead = { p, i }; } }));
  return {
    hands, boneyard: bones, center: null, spinner: false,
    arms: { left: [], right: [], up: [], down: [] },
    turn: lead.p, lead, passes: 0,
  };
}

/** Open ends: [{ side, value }] */
export function ends(r) {
  if (!r.center) return [];
  const c = r.center;
  const tip = (side, base) => {
    const arm = r.arms[side];
    return arm.length ? arm[arm.length - 1][1] : base;
  };
  const out = [
    { side: 'left', value: tip('left', c[0]) },
    { side: 'right', value: tip('right', c[1]) },
  ];
  if (r.spinner && r.arms.left.length && r.arms.right.length) {
    out.push({ side: 'up', value: tip('up', c[0]) }, { side: 'down', value: tip('down', c[0]) });
  }
  return out;
}

/** Sides where hand tile `tile` (at hand index i of player p) may be played. */
export function placements(r, tile, p, i) {
  if (!r.center) return r.lead.p === p && r.lead.i === i ? ['center'] : [];
  return ends(r).filter((e) => tile[0] === e.value || tile[1] === e.value).map((e) => e.side);
}

export const playable = (r, p) => r.hands[p]
  .map((t, i) => ({ i, sides: placements(r, t, p, i) }))
  .filter((x) => x.sides.length);

/** Play hand[p][i] on side. Arm tiles are stored oriented [innerValue, outerValue]. */
export function playTile(r, p, i, side) {
  const hands = r.hands.map((h) => h.slice());
  const [tile] = hands[p].splice(i, 1);
  const arms = { left: r.arms.left.slice(), right: r.arms.right.slice(), up: r.arms.up.slice(), down: r.arms.down.slice() };
  let { center, spinner } = r;
  if (side === 'center') {
    center = tile;
    spinner = isDouble(tile);
  } else {
    const e = ends(r).find((x) => x.side === side);
    const oriented = tile[0] === e.value ? [tile[0], tile[1]] : [tile[1], tile[0]];
    arms[side].push(oriented);
  }
  return { ...r, hands, arms, center, spinner, turn: 1 - p, passes: 0 };
}

export function draw(r, p) {
  if (!r.boneyard.length) return r;
  const boneyard = r.boneyard.slice();
  const hands = r.hands.map((h) => h.slice());
  hands[p].push(boneyard.pop());
  return { ...r, hands, boneyard };
}

export const passTurn = (r) => ({ ...r, turn: 1 - r.turn, passes: r.passes + 1 });

export const tileCount = (r) => (r.center ? 1 : 0) + SIDES.reduce((s, k) => s + r.arms[k].length, 0);

/** null while the round continues, else { winner: 0|1|null, points } */
export function roundResult(r) {
  for (const p of [0, 1]) {
    if (!r.hands[p].length) return { winner: p, points: pips(r.hands[1 - p]) };
  }
  if (r.passes >= 2) {
    const a = pips(r.hands[0]); const b = pips(r.hands[1]);
    if (a === b) return { winner: null, points: 0 };
    return a < b ? { winner: 0, points: b } : { winner: 1, points: a };
  }
  return null;
}

/** CPU: heaviest playable tile (doubles first), on the end that leaves it the most options. */
export function cpuChoice(r, p) {
  const opts = playable(r, p);
  if (!opts.length) return null;
  let best = -Infinity; let pick = null;
  for (const o of opts) {
    const t = r.hands[p][o.i];
    for (const side of o.sides) {
      let v = t[0] + t[1] + (isDouble(t) ? 4 : 0);
      if (side !== 'center') {
        // Prefer leaving an end value the CPU still holds.
        const next = playTile(r, p, o.i, side);
        const own = ends(next).filter((e) => next.hands[p].some((h) => h[0] === e.value || h[1] === e.value)).length;
        v += own * 1.5;
      }
      if (v > best) { best = v; pick = { i: o.i, side }; }
    }
  }
  return pick;
}

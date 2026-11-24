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

/**
 * CPU choice. level: 'easy' (any legal tile), 'normal' (heaviest, keeps options),
 * 'hard' (also uses `voids`: numbers the opponent showed it lacks by drawing or passing,
 * and blocks harder when the opponent is close to going out).
 */
export const LEVELS = { easy: { random: 1, memory: 0 }, normal: { random: 0, memory: 0 }, hard: { random: 0, memory: 1 } };

export function cpuChoice(r, p, { level = 'normal', cfg = LEVELS[level], voids = new Set(), rng = Math.random } = {}) {
  const opts = playable(r, p);
  if (!opts.length) return null;
  if (rng() < cfg.random) {
    const o = opts[Math.floor(rng() * opts.length)];
    return { i: o.i, side: o.sides[Math.floor(rng() * o.sides.length)] };
  }
  const oppCount = r.hands[1 - p].length;
  let best = -Infinity; let pick = null;
  for (const o of opts) {
    const t = r.hands[p][o.i];
    for (const side of o.sides) {
      let v = t[0] + t[1] + (isDouble(t) ? 4 : 0);
      if (side !== 'center') {
        const next = playTile(r, p, o.i, side);
        const openEnds = ends(next);
        const own = openEnds.filter((e) => next.hands[p].some((h) => h[0] === e.value || h[1] === e.value)).length;
        v += own * 1.5;
        if (cfg.memory > 0) {
          const blocked = openEnds.filter((e) => voids.has(e.value)).length;
          v += blocked * (oppCount <= 2 ? 9 : 4) * cfg.memory;
          // Count how many tiles of each end value are already out of play (on the table or in hand).
          const seen = (val) => tilesShowing(next, p).filter((x) => x[0] === val || x[1] === val).length;
          v += openEnds.reduce((acc, e) => acc + (seen(e.value) >= 6 ? 3 : 0), 0) * cfg.memory;
        }
      }
      if (v > best) { best = v; pick = { i: o.i, side }; }
    }
  }
  return pick;
}

/** Every tile p can see: the layout plus their own hand. */
function tilesShowing(r, p) {
  const out = [...r.hands[p]];
  if (r.center) out.push(r.center);
  for (const side of SIDES) out.push(...r.arms[side]);
  return out;
}

// ---------- table layout ----------
// Each arm runs out from the centre tile and turns clockwise near the edge, so the arms make a
// pinwheel. If a long round would make arms cross or run off the table, the whole layout is
// drawn with smaller tiles (like zooming out), so every tile and every open end stays visible.
const DIR = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
const TURNS = { left: ['left', 'up', 'right'], up: ['up', 'right', 'down'], right: ['right', 'down', 'left'], down: ['down', 'left', 'up'] };
export const TILE_SIZES = [15, 13, 11, 10, 9, 8];

/** Centres + orientation for n tiles on an arm plus the next free slot. h = half tile size. */
export function armSlots(side, n, centerVertical, h, area, center) {
  const L = h * 2; const GAP = 2;
  const slots = [];
  const dirs = TURNS[side];
  let di = 0;
  let d = DIR[dirs[0]];
  const centerHalf = (d[0] !== 0) === centerVertical ? h / 2 : L / 2;
  let c = { x: center.x + d[0] * (centerHalf + GAP + L / 2), y: center.y + d[1] * (centerHalf + GAP + L / 2) };
  for (let k = 0; k <= n; k++) {
    const out = (p) => {
      const hx = d[0] !== 0 ? L / 2 : h / 2; const hy = d[0] !== 0 ? h / 2 : L / 2;
      return p.x - hx < area.x0 || p.x + hx > area.x1 || p.y - hy < area.y0 || p.y + hy > area.y1;
    };
    if (out(c) && di < dirs.length - 1 && k > 0) {
      // Turn the corner: tuck the next tile against the side of the last one.
      const prev = slots[k - 1];
      const nd = DIR[dirs[++di]];
      c = {
        x: prev.x + d[0] * (L / 2 - h / 2) + nd[0] * (h / 2 + GAP + L / 2),
        y: prev.y + d[1] * (L / 2 - h / 2) + nd[1] * (h / 2 + GAP + L / 2),
      };
      d = nd;
    }
    slots.push({ x: c.x, y: c.y, dir: d, vertical: d[1] !== 0 });
    c = { x: c.x + d[0] * (L + GAP), y: c.y + d[1] * (L + GAP) };
  }
  return slots;
}

const boxOf = (s, h) => {
  const w = s.vertical ? h : h * 2; const ht = s.vertical ? h * 2 : h;
  return { x0: s.x - w / 2, x1: s.x + w / 2, y0: s.y - ht / 2, y1: s.y + ht / 2 };
};
const overlaps = (a, b) => a.x0 < b.x1 - 0.5 && b.x0 < a.x1 - 0.5 && a.y0 < b.y1 - 0.5 && b.y0 < a.y1 - 0.5;

/**
 * Lay out the whole table: { h, arms: { side: slots (one per tile, plus the next free slot) } }.
 * Picks the biggest tile size where nothing overlaps or leaves `area`.
 */
export function layoutTable(r, area, center) {
  let fallback = null;
  for (const h of TILE_SIZES) {
    const cv = r.spinner;
    const boxes = [boxOf({ x: center.x, y: center.y, vertical: cv }, h)];
    const arms = {};
    let ok = true;
    const open = new Set(ends(r).map((e) => e.side));
    for (const side of SIDES) {
      const n = r.arms[side].length;
      arms[side] = armSlots(side, n, cv, h, area, center);
      const used = arms[side].slice(0, open.has(side) ? n + 1 : n);
      for (const s of used) {
        const b = boxOf(s, h);
        if (b.x0 < area.x0 - 0.5 || b.x1 > area.x1 + 0.5 || b.y0 < area.y0 - 0.5 || b.y1 > area.y1 + 0.5) ok = false;
        if (boxes.some((o) => overlaps(o, b))) ok = false;
        boxes.push(b);
      }
    }
    fallback = { h, arms };
    if (ok) return fallback;
  }
  return fallback;
}

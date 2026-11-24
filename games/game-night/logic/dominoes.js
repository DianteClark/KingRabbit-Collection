// Draw dominoes (double-six set), you vs CPU. Each player draws 7; play a matching end or draw
// from the boneyard; pass only when the boneyard is empty. A round ends when someone plays out
// (they score the pips left in the other hand) or the game is blocked (lowest hand scores the
// difference). First to 100 points wins the match.

export const TARGET = 100;

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

/** New round. The player holding the highest double (or highest tile) leads automatically. */
export function newRound(rng = Math.random) {
  const bones = shuffle(fullSet(), rng);
  const hands = [bones.splice(0, 7), bones.splice(0, 7)];
  return { hands, boneyard: bones, chain: [], ends: null, turn: firstPlayer(hands), passes: 0 };
}

function firstPlayer(hands) {
  let best = -1; let who = 0;
  hands.forEach((h, p) => h.forEach(([a, b]) => {
    const v = a === b ? 100 + a : a + b;
    if (v > best) { best = v; who = p; }
  }));
  return who;
}

/** Where tile can go: ['left'|'right'] (both for the first tile it's ['right']). */
export function placements(r, tile) {
  if (!r.ends) return ['right'];
  const [l, rt] = r.ends;
  const out = [];
  if (tile[0] === l || tile[1] === l) out.push('left');
  if (tile[0] === rt || tile[1] === rt) out.push('right');
  return out;
}

export const playable = (r, p) => r.hands[p].map((t, i) => ({ i, sides: placements(r, t) })).filter((x) => x.sides.length);

/** Play hand[p][i] on `sideName`. Chain entries are oriented [leftValue, rightValue]. */
export function playTile(r, p, i, sideName) {
  const hands = r.hands.map((h) => h.slice());
  const [tile] = hands[p].splice(i, 1);
  const chain = r.chain.slice();
  let ends;
  if (!r.ends) {
    chain.push(tile);
    ends = [tile[0], tile[1]];
  } else if (sideName === 'left') {
    const t = tile[1] === r.ends[0] ? tile : [tile[1], tile[0]];
    chain.unshift(t);
    ends = [t[0], r.ends[1]];
  } else {
    const t = tile[0] === r.ends[1] ? tile : [tile[1], tile[0]];
    chain.push(t);
    ends = [r.ends[0], t[1]];
  }
  return { ...r, hands, chain, ends, turn: 1 - p, passes: 0 };
}

export function draw(r, p) {
  if (!r.boneyard.length) return r;
  const boneyard = r.boneyard.slice();
  const hands = r.hands.map((h) => h.slice());
  hands[p].push(boneyard.pop());
  return { ...r, hands, boneyard };
}

export const passTurn = (r) => ({ ...r, turn: 1 - r.turn, passes: r.passes + 1 });

/** null while the round continues, else { winner: 0|1|null, points } */
export function roundResult(r) {
  for (const p of [0, 1]) {
    if (!r.hands[p].length) return { winner: p, points: pips(r.hands[1 - p]) };
  }
  if (r.passes >= 2) {
    const a = pips(r.hands[0]); const b = pips(r.hands[1]);
    if (a === b) return { winner: null, points: 0 };
    return a < b ? { winner: 0, points: b - a } : { winner: 1, points: a - b };
  }
  return null;
}

/** CPU: play the heaviest tile that fits, preferring doubles; null means it must draw/pass. */
export function cpuChoice(r, p) {
  const opts = playable(r, p);
  if (!opts.length) return null;
  let best = -1; let pick = null;
  for (const o of opts) {
    const [a, b] = r.hands[p][o.i];
    const v = a + b + (a === b ? 3 : 0);
    if (v > best) { best = v; pick = { i: o.i, side: o.sides[0] }; }
  }
  return pick;
}

// Tables (backgammon) rules + CPU. No doubling cube; a single game, first to bear off all 15 wins.
// Points 1..24. Player 0 (light) moves from 24 down toward 1 and bears off below 1.
// Player 1 (dark) moves from 1 up toward 24 and bears off above 24.
// pts[i] = { owner: 0|1|null, n }   bar[p] = checkers on the bar   off[p] = borne off.

export const other = (p) => 1 - p;

export function newGame() {
  const pts = Array.from({ length: 25 }, () => ({ owner: null, n: 0 }));
  const put = (i, owner, n) => { pts[i] = { owner, n }; };
  // Light (player 0) home is points 1-6.
  put(24, 0, 2); put(13, 0, 5); put(8, 0, 3); put(6, 0, 5);
  // Dark (player 1) mirrored.
  put(1, 1, 2); put(12, 1, 5); put(17, 1, 3); put(19, 1, 5);
  return { pts, bar: [0, 0], off: [0, 0], turn: 0 };
}

const clone = (s) => ({ pts: s.pts.map((p) => ({ ...p })), bar: [...s.bar], off: [...s.off], turn: s.turn });
const dir = (p) => (p === 0 ? -1 : 1);
const entryPoint = (p, die) => (p === 0 ? 25 - die : die);
const inHome = (p, i) => (p === 0 ? i >= 1 && i <= 6 : i >= 19 && i <= 24);

function allHome(s, p) {
  if (s.bar[p]) return false;
  for (let i = 1; i <= 24; i++) if (s.pts[i].owner === p && s.pts[i].n && !inHome(p, i)) return false;
  return true;
}

const open = (s, p, i) => !(s.pts[i].owner === other(p) && s.pts[i].n >= 2);

/** Single-die moves: { from: 'bar'|1..24, to: 1..24|'off', die } */
export function singleMoves(s, p, die) {
  const moves = [];
  if (s.bar[p]) {
    const to = entryPoint(p, die);
    if (open(s, p, to)) moves.push({ from: 'bar', to, die });
    return moves;
  }
  const home = allHome(s, p);
  for (let i = 1; i <= 24; i++) {
    if (s.pts[i].owner !== p || !s.pts[i].n) continue;
    const to = i + dir(p) * die;
    if (to >= 1 && to <= 24) {
      if (open(s, p, to)) moves.push({ from: i, to, die });
    } else if (home) {
      // Exact bear-off, or a higher die when no checker sits further back.
      const exact = p === 0 ? i === die : 25 - i === die;
      let furthest = true;
      if (!exact) {
        for (let j = 1; j <= 24; j++) {
          if (s.pts[j].owner !== p || !s.pts[j].n) continue;
          if (p === 0 ? j > i : j < i) { furthest = false; break; }
        }
      }
      if (exact || furthest) moves.push({ from: i, to: 'off', die });
    }
  }
  return moves;
}

export function apply(s, m) {
  const n = clone(s);
  const p = s.turn;
  if (m.from === 'bar') n.bar[p]--;
  else { n.pts[m.from].n--; if (!n.pts[m.from].n) n.pts[m.from].owner = null; }
  m.hit = false;
  if (m.to === 'off') n.off[p]++;
  else {
    const t = n.pts[m.to];
    if (t.owner === other(p) && t.n === 1) { t.n = 0; n.bar[other(p)]++; m.hit = true; }
    t.owner = p; t.n++;
  }
  return n;
}

const key = (s) => `${s.pts.map((x) => (x.n ? `${x.owner}${x.n}` : '')).join(',')}|${s.bar}|${s.off}`;

/** Every complete turn that uses as many dice as possible: [{ moves: [...], state }] */
export function turnSequences(s, dice) {
  const results = [];
  const seen = new Set();
  let maxUsed = 0;
  const rec = (state, remaining, moves) => {
    let any = false;
    const tried = new Set();
    for (let k = 0; k < remaining.length; k++) {
      const d = remaining[k];
      if (tried.has(d)) continue;
      tried.add(d);
      for (const m of singleMoves(state, s.turn, d)) {
        any = true;
        const rest = remaining.slice(); rest.splice(k, 1);
        rec(apply(state, m), rest, [...moves, { ...m }]);
      }
    }
    if (!any) {
      maxUsed = Math.max(maxUsed, moves.length);
      const kk = key(state);
      if (!seen.has(kk)) { seen.add(kk); results.push({ moves, state }); }
    }
  };
  rec(s, dice, []);
  let best = results.filter((r) => r.moves.length === maxUsed);
  // If only one die can be played, the larger one must be used when possible.
  if (maxUsed === 1 && dice.length === 2 && dice[0] !== dice[1]) {
    const hi = Math.max(...dice);
    if (best.some((r) => r.moves[0].die === hi)) best = best.filter((r) => r.moves[0].die === hi);
  }
  return best;
}

export const rollDice = (rng = Math.random) => {
  const a = 1 + Math.floor(rng() * 6); const b = 1 + Math.floor(rng() * 6);
  return a === b ? [a, a, a, a] : [a, b];
};

export const winner = (s) => (s.off[0] === 15 ? 0 : s.off[1] === 15 ? 1 : null);

export function pipCount(s, p) {
  let pips = s.bar[p] * 25;
  for (let i = 1; i <= 24; i++) if (s.pts[i].owner === p) pips += s.pts[i].n * (p === 0 ? i : 25 - i);
  return pips;
}

function evaluate(s, me) {
  const opp = other(me);
  let v = (pipCount(s, opp) - pipCount(s, me)) * 1.0;
  v += (s.off[me] - s.off[opp]) * 8;
  v += s.bar[opp] * 12 - s.bar[me] * 12;
  for (let i = 1; i <= 24; i++) {
    const pt = s.pts[i];
    if (pt.owner !== me) continue;
    if (pt.n === 1) {
      // A blot the opponent could reach is a risk; worse the deeper in our side it is.
      const exposed = opp === 0 ? hasOppBehind(s, i, opp) : hasOppBehind(s, i, opp);
      if (exposed) v -= 6 + (inHome(me, i) ? 3 : 0);
    } else if (pt.n >= 2) {
      v += inHome(me, i) ? 5 : 2;
    }
  }
  return v;
}

function hasOppBehind(s, i, opp) {
  if (s.bar[opp]) return true;
  for (let j = 1; j <= 24; j++) {
    if (s.pts[j].owner !== opp || !s.pts[j].n) continue;
    const d = opp === 0 ? j - i : i - j;
    if (d > 0 && d <= 12) return true;
  }
  return false;
}

// How many of the 36 rolls hit a blot at each distance (direct and combination shots, no blocking).
const SHOTS = [0, 11, 12, 14, 15, 15, 17, 6, 6, 5, 3, 2, 3, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 1];

function contact(s) {
  // Is any checker of player 0 still behind any checker of player 1 (in movement terms)?
  let max0 = 0; let min1 = 25;
  for (let i = 1; i <= 24; i++) {
    if (s.pts[i].owner === 0 && s.pts[i].n) max0 = Math.max(max0, i);
    if (s.pts[i].owner === 1 && s.pts[i].n) min1 = Math.min(min1, i);
  }
  if (s.bar[0]) max0 = 25;
  if (s.bar[1]) min1 = 0;
  return max0 > min1;
}

/** Stronger evaluation for Hard: shot counting, primes, anchors, home board, pure race mode. */
export const HARD_W = { pip: 1, bar: 12, home: 5, outer: 3, anchor: 4, blot: 0.5, blotBase: 4, prime: 1.5 };

function evaluateHard(s, me, W = HARD_W) {
  const opp = other(me);
  const dirMe = me === 0 ? -1 : 1;
  if (!contact(s)) {
    // Pure race: fewer pips and more borne off is all that matters.
    return (pipCount(s, opp) - pipCount(s, me)) * 2 + (s.off[me] - s.off[opp]) * 6;
  }
  let v = (pipCount(s, opp) - pipCount(s, me)) * W.pip;
  v += s.bar[opp] * W.bar - s.bar[me] * W.bar + (s.off[me] - s.off[opp]) * 8;
  let run = 0; let bestRun = 0;
  for (let k = 1; k <= 24; k++) {
    const i = me === 0 ? k : 25 - k;               // walk from my home outward
    const pt = s.pts[i];
    const made = pt.owner === me && pt.n >= 2;
    run = made ? run + 1 : 0;
    bestRun = Math.max(bestRun, run);
    if (made) {
      v += inHome(me, i) ? W.home : W.outer;
      if (inHome(opp, i)) v += W.anchor;                  // an anchor in their home board
    }
    if (pt.owner === me && pt.n === 1) {
      // Blot: penalise by the chance the opponent can hit it and how far back it would go.
      let shots = 0;
      if (s.bar[opp]) shots = 20;
      for (let j = 1; j <= 24; j++) {
        if (s.pts[j].owner !== opp || !s.pts[j].n) continue;
        const d = (j - i) * dirMe;                  // opponent moves the other way
        if (d > 0 && d <= 24) shots = Math.max(shots, SHOTS[d]);
      }
      const loss = me === 0 ? 25 - i : i;           // pips lost if hit
      v -= (shots / 36) * (loss * W.blot + W.blotBase);
    }
  }
  v += bestRun * bestRun * W.prime;                       // primes trap the opponent
  return v;
}

// random: chance of a random legal play; noise: wobble in judging moves; look: how many top moves
// get the full reply-roll lookahead (0 = none); sharp: weight of the stronger evaluation.
export const LEVELS = {
  easy: { random: 0.5, noise: 15, look: 0, sharp: 0 },
  normal: { random: 0, noise: 0, look: 0, sharp: 0 },
  hard: { random: 0, noise: 0, look: 6, sharp: 1 },
};

// The 21 distinct rolls with their odds out of 36.
const ROLLS = [];
for (let a = 1; a <= 6; a++) for (let b = a; b <= 6; b++) ROLLS.push({ dice: a === b ? [a, a, a, a] : [a, b], w: a === b ? 1 : 2 });

/** Hard: take the best few moves, then average over every reply roll the opponent could get. */
function lookahead(s, seqs, keep = 6) {
  const me = s.turn; const opp = other(me);
  const ranked = seqs.map((r) => ({ r, v: evaluateHard(r.state, me) + (winner(r.state) === me ? 10000 : 0) }))
    .sort((a, b) => b.v - a.v).slice(0, keep);
  if (ranked[0].v > 5000) return ranked[0].r;
  let best = -Infinity; let pick = ranked[0].r;
  for (const { r } of ranked) {
    const after = { ...r.state, turn: opp };
    let total = 0;
    for (const roll of ROLLS) {
      const replies = turnSequences(after, roll.dice);
      let oppBest = -Infinity;
      for (const rep of replies) {
        const v = winner(rep.state) === opp ? 10000 : evaluateHard(rep.state, opp);
        if (v > oppBest) oppBest = v;
      }
      if (oppBest === -Infinity) oppBest = evaluateHard(after, opp);
      total += -oppBest * roll.w;
    }
    const v = total / 36;
    if (v > best) { best = v; pick = r; }
  }
  return pick;
}

export function cpuTurn(s, dice, { level = 'normal', cfg = LEVELS[level], rng = Math.random } = {}) {
  const seqs = turnSequences(s, dice);
  if (!seqs.length || !seqs[0].moves.length) return seqs[0] && seqs[0].moves.length ? seqs[0] : null;
  if (rng() < cfg.random) return seqs[Math.floor(rng() * seqs.length)];
  if (cfg.look >= 2) return lookahead(s, seqs, cfg.look);
  let best = -Infinity; let pick = null;
  for (const r of seqs) {
    const base = evaluate(r.state, s.turn) * (1 - cfg.sharp) + evaluateHard(r.state, s.turn) * cfg.sharp;
    const v = base + (winner(r.state) === s.turn ? 10000 : 0) + rng() * cfg.noise;
    if (v > best) { best = v; pick = r; }
  }
  return pick;
}

/** 1 single, 2 gammon (loser bore off nothing), 3 backgammon (also still on the bar or in the winner's home). */
export function winType(s, w) {
  const l = other(w);
  if (s.off[l] > 0) return { points: 1, name: 'Single game' };
  const inWinnersHome = (i) => (w === 0 ? i >= 1 && i <= 6 : i >= 19 && i <= 24);
  let stuck = s.bar[l] > 0;
  for (let i = 1; i <= 24; i++) if (s.pts[i].owner === l && s.pts[i].n && inWinnersHome(i)) stuck = true;
  return stuck ? { points: 3, name: 'Backgammon!' } : { points: 2, name: 'Gammon!' };
}

/** Opening roll: each side rolls one die, re-rolling ties. Returns { first, dice:[a,b], rolls }. */
export function openingRoll(rng = Math.random) {
  const rolls = [];
  for (;;) {
    const a = 1 + Math.floor(rng() * 6); const b = 1 + Math.floor(rng() * 6);
    rolls.push([a, b]);
    if (a !== b) return { first: a > b ? 0 : 1, dice: [a, b], rolls };
  }
}

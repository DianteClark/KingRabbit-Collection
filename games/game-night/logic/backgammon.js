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

export function cpuTurn(s, dice) {
  const seqs = turnSequences(s, dice);
  let best = -Infinity; let pick = null;
  for (const r of seqs) {
    const v = evaluate(r.state, s.turn) + (winner(r.state) === s.turn ? 10000 : 0);
    if (v > best) { best = v; pick = r; }
  }
  return pick; // null when no move is possible
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

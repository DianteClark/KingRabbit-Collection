// Cup run (8-team knockout, lose once and you're out) and Endless mode bookkeeping.
// Pure data in, data out, so it can be saved as JSON and tested.

import { TEAMS, PLAYER_TEAM } from './teams.js';
import { clamp, makeRng } from './util.js';

export const ROUND_NAMES = ['Quarter-final', 'Semi-final', 'Final'];

/** A fresh cup: you plus 7 drawn CPU teams, seeded randomly into the bracket. */
export function newCup(seed = Date.now()) {
  const rng = makeRng(seed);
  const pool = [...TEAMS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const ids = [PLAYER_TEAM.id, ...pool.slice(0, 7).map((t) => t.id)];
  // Shuffle the slots so you're not always in the top tie.
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return { seed, round: 0, rounds: [ids], results: [], alive: true, champion: null };
}

/** Ties of the current round as [teamA, teamB] pairs. */
export function ties(cup, round = cup.round) {
  const r = cup.rounds[round] || [];
  const out = [];
  for (let i = 0; i < r.length; i += 2) out.push([r[i], r[i + 1]]);
  return out;
}

export function opponentOf(cup) {
  const tie = ties(cup).find(([a, b]) => a === PLAYER_TEAM.id || b === PLAYER_TEAM.id);
  if (!tie) return null;
  return tie[0] === PLAYER_TEAM.id ? tie[1] : tie[0];
}

/** CPU skill for a cup opponent: your adaptive level, their strength, and later rounds are tougher. */
export function cupSkill(base, team, round) {
  return clamp(base + team.strength + round * 0.04, 0, 1);
}

/**
 * Record your match (won: did you go through, score: [you, them], pens: optional [you, them])
 * and play out the other ties. Returns the updated cup.
 */
export function advanceCup(cup, won, score, pens = null) {
  const rng = makeRng(cup.seed + 101 * (cup.round + 1));
  const next = [];
  const results = [];
  for (const [a, b] of ties(cup)) {
    let winner; let line;
    if (a === PLAYER_TEAM.id || b === PLAYER_TEAM.id) {
      const opp = a === PLAYER_TEAM.id ? b : a;
      winner = won ? PLAYER_TEAM.id : opp;
      line = { a: PLAYER_TEAM.id, b: opp, score, pens };
    } else {
      const ta = TEAMS.find((t) => t.id === a); const tb = TEAMS.find((t) => t.id === b);
      const sim = simulateTie(ta, tb, rng);
      winner = sim.winner === 0 ? a : b;
      line = { a, b, score: sim.score, pens: sim.pens };
    }
    next.push(winner);
    results.push(line);
  }
  const out = { ...cup, rounds: [...cup.rounds], results: [...cup.results, results] };
  if (!won) { out.alive = false; return out; }
  if (next.length === 1) { out.champion = next[0]; out.round = cup.round + 1; return out; }
  out.rounds.push(next);
  out.round = cup.round + 1;
  return out;
}

/** Quick result for a CPU-vs-CPU tie, weighted by strength. */
export function simulateTie(ta, tb, rng) {
  const goals = (s) => {
    let g = 0;
    const lambda = 1.6 + s * 4;
    let p = Math.exp(-lambda); let c = p; const u = rng();
    while (u > c && g < 9) { g++; p *= lambda / g; c += p; }
    return g;
  };
  const score = [goals(ta.strength - tb.strength), goals(tb.strength - ta.strength)];
  if (score[0] !== score[1]) return { winner: score[0] > score[1] ? 0 : 1, score, pens: null };
  const pa = 3 + Math.floor(rng() * 3); let pb = 3 + Math.floor(rng() * 3);
  if (pa === pb) pb += rng() < 0.5 + (tb.strength - ta.strength) ? 1 : -1;
  return { winner: pa > pb ? 0 : 1, score, pens: [pa, pb] };
}

// ------------------------------------------------------------------ Endless

/** Endless opponents cycle through the teams, getting a little sharper with every win. */
export function endlessOpponent(streak) {
  const order = [...TEAMS].sort((a, b) => a.strength - b.strength);
  return order[streak % order.length];
}

/** A bit easier than normal to start, then steadily tougher with every win in a row. */
export function endlessSkill(base, streak) {
  return clamp(base - 0.22 + streak * 0.045, 0, 1);
}

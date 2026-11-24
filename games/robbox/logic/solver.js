// Solvers used by the tests (and handy when designing levels).
//   shortestPlain: breadth-first search over world states with single commands. For a level with only
//                  MAIN this is exactly the shortest possible program.
//   searchPrograms: tries every program up to a length (all slot splits, calls and colours) and
//                  returns the first that wins. Only practical for short targets.
import { parseLevel, initState, act, isWon, runProgram, hasLoop, SLOTS } from './engine.js';

const key = (s) => `${s.x},${s.y},${s.d},${s.gears},${s.carrying ? 1 : 0}|${[...s.lit].sort((a, b) => a - b)}|${[...s.crates].sort((a, b) => a - b)}|${[...s.keys].sort((a, b) => a - b)}|${[...s.opened].sort((a, b) => a - b)}`;

/** Shortest list of basic commands that wins, or null. ops: string of basic commands allowed. */
export function shortestPlain(def, ops = 'FLRJA', limit = 200000) {
  const lv = parseLevel(def);
  const basic = [...ops].filter((o) => 'FLRJA'.includes(o));
  const start = initState(lv);
  const seen = new Map([[key(start), null]]);
  let frontier = [[start, []]];
  while (frontier.length && seen.size < limit) {
    const next = [];
    for (const [s, seq] of frontier) {
      for (const op of basic) {
        const r = act(lv, s, op);
        if (r.fail) continue;
        const k = key(r.state);
        if (seen.has(k)) continue;
        seen.set(k, true);
        const nseq = [...seq, op];
        if (isWon(lv, r.state)) return nseq;
        next.push([r.state, nseq]);
      }
    }
    frontier = next;
  }
  return null;
}

/** Every token the level's palette can make: commands, painted or not. */
export function tokensFor(def) {
  const out = [];
  for (const op of def.ops) {
    out.push({ op, cond: null });
    for (const c of def.brushes || '') out.push({ op, cond: c });
  }
  return out;
}

/**
 * Try every program of total length <= maxLen. Returns the first winning program found
 * (shortest first) or null. Programs where a filled function is never called, or a call goes to
 * an empty function, are skipped: a shorter program always does the same.
 */
export function searchPrograms(def, maxLen, { budget = 5e6 } = {}) {
  const lv = parseLevel(def);
  const tokens = tokensFor(def);
  const cap = { main: def.slots.main, f1: def.slots.f1 || 0, f2: def.slots.f2 || 0 };
  let tried = 0;
  for (let n = 1; n <= maxLen; n++) {
    for (let m = 1; m <= Math.min(n, cap.main); m++) {
      for (let a = 0; a <= Math.min(n - m, cap.f1); a++) {
        const b = n - m - a;
        if (b > cap.f2) continue;
        const sizes = { main: m, f1: a, f2: b };
        const total = m + a + b;
        const seq = new Array(total).fill(0);
        // Odometer over all token choices.
        for (;;) {
          const prog = { main: [], f1: [], f2: [] };
          let k = 0;
          for (const s of SLOTS) for (let i = 0; i < sizes[s]; i++) prog[s].push(tokens[seq[k++]]);
          if (useful(prog) && (def.loops || !hasLoop(prog))) {
            tried++;
            if (tried > budget) throw new Error(`search budget exceeded for ${def.id}`);
            if (runProgram(lv, prog).won) return prog;
          }
          let j = total - 1;
          while (j >= 0 && seq[j] === tokens.length - 1) { seq[j] = 0; j--; }
          if (j < 0) break;
          seq[j]++;
        }
      }
    }
  }
  return null;
}

function useful(prog) {
  const all = [...prog.main, ...prog.f1, ...prog.f2];
  const calls1 = all.some((c) => c.op === '1');
  const calls2 = all.some((c) => c.op === '2');
  if (calls1 !== prog.f1.length > 0) return false;
  if (calls2 !== prog.f2.length > 0) return false;
  // A function only reached from inside itself is never run.
  if (prog.f1.length && !prog.main.some((c) => c.op === '1') && !prog.f2.some((c) => c.op === '1')) return false;
  if (prog.f2.length && !prog.main.some((c) => c.op === '2') && !prog.f1.some((c) => c.op === '2')) return false;
  return true;
}

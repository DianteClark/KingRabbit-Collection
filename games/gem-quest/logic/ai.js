// Move choice for the monsters (and for the bot that plays the hero in tests, and the hint).
// Monsters always cast the skill their intent shows as soon as they can afford it, so the intent
// never lies; their skill (adaptive, 0-1) only changes how well they pick gems.
import * as B from './board.js';
import { makeRng, next } from './rng.js';
import { SKILLS, fxValue } from './skills.js';
import { canCast, intent, other, skullHit, move, cast } from './combat.js';

/** Calibrated presets, blended by skill (see adaptive.js). */
export const AI_PRESETS = {
  easy: { noise: 14, look: 0, skullW: 1.0, manaW: 0.6, extraW: 2 },
  normal: { noise: 4, look: 0.3, skullW: 1.6, manaW: 1.0, extraW: 6 },
  hard: { noise: 0.3, look: 0.6, skullW: 1.8, manaW: 1.1, extraW: 8 },
};

const DUMMY = makeRng(1);

/** How much side wants mana of each colour right now (0.3 = nice to have, 1 = needed). */
function manaWants(f) {
  const want = [0.3, 0.3, 0.3, 0.3];
  for (const id of f.skills) {
    SKILLS[id].cost.forEach((n, c) => { if (n && f.mana[c] < n) want[c] = 1; });
  }
  return want;
}

/** Best skull damage the foe could grab next on this board (ignoring refills). */
function threat(board, foe) {
  let best = 0;
  for (const m of B.findMoves(board)) {
    const b = B.cloneBoard(board);
    const r = B.swap(b, m.a, m.b, DUMMY, { spawn: false });
    const v = r.gains.counts[B.SKULL] * skullHit(foe) + (r.gains.extra ? 4 : 0);
    if (v > best) best = v;
  }
  return best;
}

/** Score one swap for side. */
export function scoreMove(st, side, m, p = AI_PRESETS.normal) {
  const me = st[side];
  const foe = st[other(side)];
  const b = B.cloneBoard(st.board);
  const r = B.swap(b, m.a, m.b, DUMMY, { spawn: false });
  if (!r.ok) return -Infinity;
  const g = r.gains;
  let s = 0;
  const dmg = g.counts[B.SKULL] * skullHit(me);
  s += dmg * p.skullW;
  if (dmg >= foe.hp + foe.st.shield) s += 1000;
  const want = manaWants(me);
  for (let c = 0; c < 4; c++) s += Math.min(g.counts[c], me.cap - me.mana[c]) * want[c] * p.manaW;
  if (side === 'hero') s += g.counts[B.COIN] * 0.2;
  if (g.extra) s += p.extraW;
  s += (g.made.h + g.made.v) * 1.5 + g.made.bomb * 2 + g.made.star * 3;
  if (p.look && !g.extra) s -= p.look * threat(b, foe);
  return s;
}

/** Best swaps for side, best first: [{ a, b, score }] */
export function rankMoves(st, side, p = AI_PRESETS.normal, rand = null, noise = 0) {
  return B.findMoves(st.board)
    .map((m) => ({ ...m, score: scoreMove(st, side, m, p) + (rand ? next(rand) * noise : 0) }))
    .sort((x, y) => y.score - x.score);
}

/** The monster's action: { type: 'cast', skill } or { type: 'move', a, b }. */
export function enemyChoice(st, p) {
  const it = intent(st);
  if (it.ready && canCast(st, 'enemy', it.skill)) return { type: 'cast', skill: it.skill };
  const ranked = rankMoves(st, 'enemy', p, st.aiRng, p.noise);
  return ranked.length ? { type: 'move', a: ranked[0].a, b: ranked[0].b } : null;
}

/** Play the monster's turn action. */
export function enemyAct(st, p) {
  const choice = enemyChoice(st, p);
  if (!choice) return { ok: false, events: [] };
  return choice.type === 'cast' ? cast(st, 'enemy', choice.skill) : move(st, 'enemy', choice.a, choice.b);
}

/** How good a skill would be for side right now (used by the hero bot). */
export function skillValue(st, side, id) {
  const me = st[side];
  const foe = st[other(side)];
  const sk = SKILLS[id];
  let v = 0;
  for (const f of sk.fx) {
    const n = fxValue(f, me.level, me.power);
    switch (f.k) {
      case 'dmg': v += n >= foe.hp + foe.st.shield ? 1000 : n; break;
      case 'leech': v += n >= foe.hp + foe.st.shield ? 1000 : n * (me.hp < me.maxHp ? 1.6 : 1); break;
      case 'heal': v += Math.min(n, me.maxHp - me.hp) * (me.hp < me.maxHp * 0.6 ? 1.2 : 0.4); break;
      case 'shield': v += me.st.shield ? n * 0.3 : n * 0.8; break;
      case 'poison': v += foe.st.poisonT ? 1 : n * f.turns * 0.7; break;
      case 'stun': v += foe.st.stun ? 2 : 9 * n; break;
      case 'rage': v += me.st.rageT ? 0 : 8; break;
      case 'weak': v += foe.st.weakT ? 1 : 6; break;
      case 'drain': v += foe.mana.reduce((a, x) => a + Math.min(x, n), 0) * 0.5; break;
      case 'mana': v += n * 0.6; break;
      case 'convert': v += B.countColor(st.board, f.from) * (f.to === B.SKULL ? skullHit(me) * 0.9 : 0.5); break;
      case 'smash': {
        const skulls = f.how === 'color' ? B.countColor(st.board, f.col) : f.how === 'random' ? n / 6 : f.how === 'bottom' ? 16 / 6 : 8 / 6;
        v += skulls * skullHit(me) + 3;
        break;
      }
      default: break;
    }
  }
  return sk.extra ? v + 3 : v;
}

/** The hero bot's action: cast a good skill when one is ready, else the best swap. */
export function heroChoice(st, p = AI_PRESETS.hard, rand = null) {
  const ready = st.hero.skills.filter((id) => canCast(st, 'hero', id));
  let best = null;
  for (const id of ready) {
    const v = skillValue(st, 'hero', id);
    if (v >= 7 && (!best || v > best.v)) best = { id, v };
  }
  if (best) return { type: 'cast', skill: best.id };
  const ranked = rankMoves(st, 'hero', p, rand, p.noise);
  return ranked.length ? { type: 'move', a: ranked[0].a, b: ranked[0].b } : null;
}

/** A good move to suggest to a stuck player (no lookahead; quick). */
export function hintMove(st, side = 'hero') {
  const ranked = rankMoves(st, side, { ...AI_PRESETS.normal, look: 0 });
  return ranked[0] || null;
}

/** Blend presets { easy, normal, hard } at skill s (0 easy, 0.5 normal, 1 hard). */
export function tune(presets, s) {
  const { easy, normal, hard } = presets;
  const out = {};
  for (const k of Object.keys(normal)) {
    const a = easy[k]; const b = normal[k]; const c = hard[k];
    out[k] = s <= 0.5 ? a + (b - a) * (s / 0.5) : b + (c - b) * ((s - 0.5) / 0.5);
  }
  return out;
}

export const aiParams = (skill) => tune(AI_PRESETS, Math.max(0, Math.min(1, skill)));

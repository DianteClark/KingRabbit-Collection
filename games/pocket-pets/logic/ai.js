// Computer tamers. They pick moves by expected damage and status value, switch away from bad
// type match-ups, use their potions and choose who to send next. The adaptive skill only blends
// how carefully they decide (presets below); their pets, levels and items never change with it.
import { MOVES, ITEMS } from './data.js';
import { typeMult } from './types.js';
import { active, alive, baseDamage, statusBlock, effStat } from './battle.js';
import { maxHp, petType, statsOf } from './pet.js';
import { tune } from './tune.js';

export const AI_PRESETS = {
  // smart: chance to play the best-scored move (else a random one); noise: random wobble on scores
  // sense: how much status and stat moves are valued; swap: chance to switch out of a bad match-up
  // potion: chance to use a potion when low; pickNext: chance to choose the best pet to send next
  easy: { smart: 0.35, noise: 0.5, sense: 0.3, swap: 0, potion: 0.35, pickNext: 0, lowHp: 0.15 },
  normal: { smart: 0.8, noise: 0.2, sense: 0.7, swap: 0.35, potion: 0.75, pickNext: 0.6, lowHp: 0.3 },
  hard: { smart: 1, noise: 0.03, sense: 1, swap: 0.85, potion: 1, pickNext: 1, lowHp: 0.35 },
};

export const aiParams = (skill) => tune(AI_PRESETS, skill);

const STATUS_VALUE = { sleep: 0.65, para: 0.5, burn: 0.45, poison: 0.4 };

/** Score every usable move of the active pet on `side` (higher is better). */
export function scoreMoves(b, side, p = AI_PRESETS.hard) {
  const me = active(b, side);
  const foe = active(b, 1 - side);
  const myFrac = me.hp / maxHp(me);
  const foeFrac = foe.hp / maxHp(foe);
  const faster = effStat(b, side, 'spd') > effStat(b, 1 - side, 'spd');
  // How hard can the foe hit me back? (used to decide whether set-up moves are safe)
  const threat = Math.max(0, ...foe.moves.map((m) => baseDamage(b, 1 - side, m.id, side))) / Math.max(1, me.hp);
  const out = [];
  me.moves.forEach((mv, slot) => {
    if (mv.pp <= 0) return;
    const m = MOVES[mv.id];
    const acc = (m.acc ?? 100) / 100;
    let s;
    if (m.power > 0) {
      const est = baseDamage(b, side, mv.id) * 0.925;
      s = Math.min(1.2, est / Math.max(1, foe.hp)) * acc;
      if (est * 0.85 >= foe.hp) s += 0.5 * acc + (m.prio && !faster ? 0.3 : 0);
      if (m.recoil && me.hp < maxHp(me) * 0.3) s -= 0.2;
      if (m.drain && myFrac < 0.6) s += 0.1;
      if (m.status && !statusBlock(foe, m.status)) s += 0.05 * p.sense;
    } else if (m.status) {
      s = statusBlock(foe, m.status) ? -1 : p.sense * STATUS_VALUE[m.status] * foeFrac * acc * (threat > 0.8 ? 0.4 : 1);
      if (m.status === 'burn' && statsOf(foe).atk > statsOf(foe).def) s += 0.1 * p.sense;
    } else if (m.stat) {
      const fx = b.sides[m.stat.who === 'self' ? side : 1 - side].fx[m.stat.key];
      const room = m.stat.n > 0 ? fx < 2 : fx > -2;
      s = room ? p.sense * (m.stat.who === 'self' ? 0.35 : 0.25) * (threat < 0.4 ? 1 : 0.3) * Math.min(1, myFrac + 0.2) : 0.02;
    } else if (m.heal) {
      s = myFrac < 0.5 && threat < 0.6 ? (1 - myFrac) * 0.9 * p.sense : 0.02;
    } else s = 0;
    out.push({ slot, id: mv.id, score: s });
  });
  return out;
}

/** Pick a move slot for `side` using presets p. */
export function pickMove(b, side, p, rng) {
  const scored = scoreMoves(b, side, p);
  if (!scored.length) return { type: 'move', slot: 0 };
  if (rng() >= p.smart) return { type: 'move', slot: rng.pick(scored).slot };
  let best = scored[0]; let bestV = -Infinity;
  for (const m of scored) {
    const v = m.score + (rng() - 0.5) * p.noise;
    if (v > bestV) { bestV = v; best = m; }
  }
  return { type: 'move', slot: best.slot };
}

/** How good is this pet against the foe's active pet? (offence minus danger) */
export function matchup(b, side, pet) {
  const foe = active(b, 1 - side);
  const mine = Math.max(0, ...pet.moves.map((m) => baseDamage(b, side, m.id, 1 - side, { att: pet }))) / Math.max(1, foe.hp);
  const theirs = Math.max(0, ...foe.moves.map((m) => baseDamage(b, 1 - side, m.id, side, { def: pet }))) / Math.max(1, pet.hp);
  return Math.min(1.5, mine) - Math.min(1.5, theirs) * 0.8;
}

/** Best pet index to send in for `side` (excluding the active one when it is still up). */
export function bestSwitch(b, side) {
  const sd = b.sides[side];
  let best = -1; let bestV = -Infinity;
  sd.party.forEach((pet, i) => {
    if (pet.hp <= 0 || (i === sd.active && active(b, side).hp > 0)) return;
    const v = matchup(b, side, pet);
    if (v > bestV) { bestV = v; best = i; }
  });
  return { idx: best, value: bestV };
}

export function makeAI(skill, rng) {
  const p = aiParams(skill);
  return {
    params: p,
    act(b) {
      const me = active(b, 1);
      const frac = me.hp / maxHp(me);
      // Potion when low.
      const potion = ['maxpotion', 'superpotion', 'potion'].find((k) => b.foe.items[k] > 0);
      if (potion && frac < p.lowHp && rng() < p.potion) return { type: 'item', item: potion, target: b.sides[1].active };
      // Switch out of a bad type match-up (at most twice a battle so it doesn't ping-pong).
      const foeType = petType(active(b, 0));
      if ((b.foe.swaps || 0) < 2 && frac > 0.35 && typeMult(foeType, petType(me)) > 1 && rng() < p.swap) {
        const cur = matchup(b, 1, me);
        const alt = bestSwitch(b, 1);
        if (alt.idx >= 0 && alt.value > cur + 0.3) {
          b.foe.swaps = (b.foe.swaps || 0) + 1;
          return { type: 'switch', idx: alt.idx };
        }
      }
      return pickMove(b, 1, p, rng);
    },
    next(b) {
      const options = b.sides[1].party.map((x, i) => i).filter((i) => b.sides[1].party[i].hp > 0);
      if (rng() < p.pickNext) return bestSwitch(b, 1).idx;
      return options[0];
    },
  };
}

/**
 * A sensible player for tests and simulations: best move, heals when low (if `heal`), switches
 * to the best pet after a faint. Returns an action for side 0.
 */
export function botAction(b, rng, { heal = true, catchItem = null } = {}) {
  const me = active(b, 0);
  const frac = me.hp / maxHp(me);
  if (catchItem && b.kind === 'wild' && b.bag[catchItem] > 0) {
    const foe = active(b, 1);
    if (foe.hp / maxHp(foe) < 0.5 || foe.st) return { type: 'catch', item: catchItem };
  }
  if (heal && frac < 0.3) {
    const potion = ['superpotion', 'potion', 'maxpotion'].find((k) => b.bag[k] > 0 && maxHp(me) - me.hp >= Math.min(ITEMS[k].amount, maxHp(me)) * 0.6);
    if (potion) return { type: 'item', item: potion, target: b.sides[0].active };
  }
  // Swap to a much better pet when the current one is badly matched.
  const foe = active(b, 1);
  if (typeMult(petType(foe), petType(me)) > 1 && alive(b.sides[0].party).length > 1) {
    const alt = bestSwitch(b, 0);
    if (alt.idx >= 0 && alt.value > matchup(b, 0, me) + 0.5) return { type: 'switch', idx: alt.idx };
  }
  return pickMove(b, 0, AI_PRESETS.hard, rng);
}

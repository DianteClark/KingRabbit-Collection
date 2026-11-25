// Battle engine: hero and monster take turns on one shared board. Pure logic, plain JSON state.
//
// Every action returns { ok, events } for the view to play in order:
//   { t: 'board', side, steps }            gems moving (see board.js)
//   { t: 'convert', side, cells }          gems changing colour
//   { t: 'cast', side, skill }             a skill is used
//   { t: 'dmg', side, amount, blocked, hp, shield, src }   side took damage
//   { t: 'heal', side, amount, hp }        { t: 'shield', side, shield }
//   { t: 'status', side, key, value }      poison / stun / rage / weak put on side
//   { t: 'mana', side, mana }              mana after the action
//   { t: 'gold', amount, total }           coins collected (hero only)
//   { t: 'extra', side }                   4+ match or a free skill: side goes again
//   { t: 'turn', side }                    side's turn starts
//   { t: 'poison', side, amount, hp }      poison ticks       { t: 'stunned', side }  turn skipped
//   { t: 'over', result, reason }          'win' or 'lose' (reason 'time' when out of turns)
import * as B from './board.js';
import { makeRng, int, shuffle } from './rng.js';
import { SKILLS, fxValue } from './skills.js';

export const MANA_CAP = 20;
export const other = (side) => (side === 'hero' ? 'enemy' : 'hero');

export function makeFighter({ name, sprite, maxHp, hp, skull, level, skills, power = 0, cap = 0, start = [0, 0, 0, 0], shield = 0 }) {
  const max = MANA_CAP + cap;
  return {
    name, sprite, maxHp, hp: Math.min(maxHp, hp ?? maxHp), skull, level, skills: [...skills], power, cap: max,
    mana: start.map((n) => Math.min(n, max)),
    st: { shield, poison: 0, poisonT: 0, stun: 0, rage: 0, rageT: 0, weak: 0, weakT: 0 },
  };
}

export function newBattle({ hero, enemy, seed = 1, rules = {}, goldMult = 1, first = 'hero' }) {
  const rng = makeRng(seed);
  const board = B.newBoard(rng);
  return {
    v: 1, rng, aiRng: makeRng(seed ^ 0x5bd1e995), board, hero, enemy,
    turn: first, heroTurns: 1, over: null, reason: null, gold: 0, goldMult, rules, plan: 0,
    stats: { maxChain: 0, turnDmg: 0, maxTurnDmg: 0, dmgDealt: 0, dmgTaken: 0, skills: 0, made: { h: 0, v: 0, bomb: 0, star: 0 }, biggest: 0, gems: 0 },
  };
}

export const canAfford = (f, id) => SKILLS[id].cost.every((n, c) => f.mana[c] >= n);
export const canCast = (st, side, id) => !st.over && st.turn === side && st[side].skills.includes(id) && canAfford(st[side], id);

/** What the monster is working toward: { skill, ready, have, need } */
export function intent(st) {
  const e = st.enemy;
  const skill = e.skills[st.plan % e.skills.length];
  const cost = SKILLS[skill].cost;
  let have = 0; let need = 0;
  cost.forEach((n, c) => { if (n) { need += n; have += Math.min(n, e.mana[c]); } });
  return { skill, ready: canAfford(e, skill), have, need };
}

function deal(st, from, amount, src, ev) {
  const side = other(from);
  const f = st[side];
  if (amount <= 0 || f.hp <= 0) return 0;
  const blocked = Math.min(f.st.shield, amount);
  f.st.shield -= blocked;
  const hit = Math.min(f.hp, amount - blocked);
  f.hp -= hit;
  ev.push({ t: 'dmg', side, amount: amount - blocked, blocked, hp: f.hp, shield: f.st.shield, src });
  if (from === 'hero') { st.stats.dmgDealt += hit; st.stats.turnDmg += hit; st.stats.maxTurnDmg = Math.max(st.stats.maxTurnDmg, st.stats.turnDmg); } else st.stats.dmgTaken += hit;
  return hit;
}

function heal(st, side, amount, ev) {
  const f = st[side];
  const before = f.hp;
  f.hp = Math.min(f.maxHp, f.hp + amount);
  ev.push({ t: 'heal', side, amount: f.hp - before, hp: f.hp });
}

/** Mana, skull damage and coins from gems that were cleared on side's behalf. */
function applyGains(st, side, gains, ev) {
  const me = st[side];
  for (let c = 0; c < 4; c++) me.mana[c] = Math.min(me.cap, me.mana[c] + gains.counts[c]);
  ev.push({ t: 'mana', side, mana: [...me.mana] });
  const skulls = gains.counts[B.SKULL];
  if (skulls) deal(st, side, skulls * skullHit(me), 'skull', ev);
  if (side === 'hero') {
    const coins = gains.counts[B.COIN];
    if (coins) {
      const g = Math.round(coins * st.goldMult);
      st.gold += g;
      ev.push({ t: 'gold', amount: g, total: st.gold });
    }
    const s = st.stats;
    s.maxChain = Math.max(s.maxChain, gains.chain);
    s.biggest = Math.max(s.biggest, gains.biggest);
    s.gems += gains.cleared;
    for (const k of Object.keys(s.made)) s.made[k] += gains.made[k];
  }
}

export const skullHit = (f) => Math.max(1, f.skull + f.st.rage - f.st.weak);

function checkOver(st, actor, ev) {
  if (st.over) return true;
  const foe = st[other(actor)];
  const me = st[actor];
  let result = null;
  if (foe.hp <= 0) result = actor === 'hero' ? 'win' : 'lose';
  else if (me.hp <= 0) result = actor === 'hero' ? 'lose' : 'win';
  if (!result) return false;
  st.over = result;
  ev.push({ t: 'over', result, reason: null });
  return true;
}

/** End side's turn and start the next one (poison, stuns, turn limit). */
function endTurn(st, ev) {
  for (let guard = 0; guard < 6 && !st.over; guard++) {
    const ending = st[st.turn];
    if (ending.st.rageT > 0 && --ending.st.rageT === 0) ending.st.rage = 0;
    if (ending.st.weakT > 0 && --ending.st.weakT === 0) ending.st.weak = 0;
    st.turn = other(st.turn);
    const side = st.turn;
    const f = st[side];
    if (side === 'hero') {
      st.heroTurns++;
      st.stats.turnDmg = 0;
      if (st.rules.turnLimit && st.heroTurns > st.rules.turnLimit) {
        st.over = 'lose'; st.reason = 'time';
        ev.push({ t: 'over', result: 'lose', reason: 'time' });
        return;
      }
    }
    ev.push({ t: 'turn', side });
    if (f.st.poisonT > 0) {
      const amount = Math.min(f.hp, f.st.poison);
      f.hp -= amount;
      if (side === 'enemy') { st.stats.dmgDealt += amount; } else st.stats.dmgTaken += amount;
      if (--f.st.poisonT === 0) f.st.poison = 0;
      ev.push({ t: 'poison', side, amount, hp: f.hp });
      if (checkOver(st, other(side), ev)) return;
    }
    if (f.st.stun > 0) {
      f.st.stun--;
      ev.push({ t: 'stunned', side });
      continue; // skip this turn
    }
    return;
  }
}

/** Swap two gems for side. Returns { ok, events }. */
export function move(st, side, a, b) {
  if (st.over || st.turn !== side) return { ok: false, events: [] };
  const res = B.swap(st.board, a, b, st.rng);
  const ev = [{ t: 'board', side, steps: res.steps }];
  if (!res.ok) return { ok: false, events: ev };
  applyGains(st, side, res.gains, ev);
  if (checkOver(st, side, ev)) return { ok: true, events: ev, gains: res.gains };
  if (res.gains.extra) ev.push({ t: 'extra', side });
  else endTurn(st, ev);
  return { ok: true, events: ev, gains: res.gains };
}

/** Use a skill. Returns { ok, events }. */
export function cast(st, side, id) {
  if (!canCast(st, side, id)) return { ok: false, events: [] };
  const me = st[side];
  const foe = st[other(side)];
  const sk = SKILLS[id];
  sk.cost.forEach((n, c) => { me.mana[c] -= n; });
  const ev = [{ t: 'cast', side, skill: id }, { t: 'mana', side, mana: [...me.mana] }];
  if (side === 'hero') st.stats.skills++;
  else st.plan = (me.skills.indexOf(id) + 1) % me.skills.length;
  const fside = other(side);
  for (const f of sk.fx) {
    if (st.over) break;
    const v = fxValue(f, me.level, me.power);
    switch (f.k) {
      case 'dmg': deal(st, side, v, 'skill', ev); break;
      case 'heal': heal(st, side, v, ev); break;
      case 'shield': me.st.shield += v; ev.push({ t: 'shield', side, shield: me.st.shield }); break;
      case 'poison': foe.st.poison = Math.max(foe.st.poison, v); foe.st.poisonT = f.turns; ev.push({ t: 'status', side: fside, key: 'poison', value: v }); break;
      case 'stun': foe.st.stun = Math.min(2, foe.st.stun + v); ev.push({ t: 'status', side: fside, key: 'stun', value: foe.st.stun }); break;
      case 'rage': me.st.rage = v; me.st.rageT = f.turns; ev.push({ t: 'status', side, key: 'rage', value: v }); break;
      case 'weak': foe.st.weak = v; foe.st.weakT = f.turns; ev.push({ t: 'status', side: fside, key: 'weak', value: v }); break;
      case 'leech': { const hit = deal(st, side, v, 'skill', ev); if (hit > 0) heal(st, side, hit, ev); break; }
      case 'drain':
        for (let c = 0; c < 4; c++) foe.mana[c] = Math.max(0, foe.mana[c] - v);
        ev.push({ t: 'mana', side: fside, mana: [...foe.mana] });
        break;
      case 'mana':
        me.mana[f.col] = Math.min(me.cap, me.mana[f.col] + v);
        ev.push({ t: 'mana', side, mana: [...me.mana] });
        break;
      case 'convert': {
        const cells = B.convert(st.board, f.from, f.to);
        ev.push({ t: 'convert', side, cells });
        const res = B.blast(st.board, [], st.rng);
        ev.push({ t: 'board', side, steps: res.steps });
        applyGains(st, side, res.gains, ev);
        break;
      }
      case 'smash': {
        const cells = smashCells(st, f, v);
        const res = B.blast(st.board, cells, st.rng);
        ev.push({ t: 'board', side, steps: res.steps });
        applyGains(st, side, res.gains, ev);
        break;
      }
      case 'plant': ev.push({ t: 'convert', side, cells: B.plantSpecial(st.board, st.rng, f.s, v) }); break;
      default: break;
    }
    checkOver(st, side, ev);
  }
  if (st.over || checkOver(st, side, ev)) return { ok: true, events: ev };
  if (sk.extra) ev.push({ t: 'extra', side });
  else endTurn(st, ev);
  return { ok: true, events: ev };
}

function smashCells(st, f, v) {
  const rng = st.rng;
  switch (f.how) {
    case 'row': return B.rowCells(int(rng, 0, B.SIZE - 1));
    case 'col': return B.colCells(int(rng, 0, B.SIZE - 1));
    case 'bottom': return [...B.rowCells(B.SIZE - 2), ...B.rowCells(B.SIZE - 1)];
    case 'color': return B.colorCells(st.board, f.col);
    case 'random': {
      const all = [];
      st.board.cells.forEach((c, i) => { if (c) all.push(i); });
      return shuffle(rng, all).slice(0, v);
    }
    default: return [];
  }
}

/** Remove the battle's bulky parts that the view never needs to keep (nothing for now). */
export const cloneBattle = (st) => JSON.parse(JSON.stringify(st));

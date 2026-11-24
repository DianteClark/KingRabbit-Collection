// Turn-based battle engine (no Phaser). The scene asks for a turn and gets back a list of events
// to animate. Pets are the real party objects, so HP, PP, status and XP stick after the battle.
//
//   const b = createBattle({ kind, party, bag, foeParty, foe, rng });
//   const events = takeTurn(b, { type: 'move', slot: 0 });   // or switch / item / catch / run
//   b.phase: 'choose' (pick an action), 'switch' (your pet fainted: call sendOut), 'over' (b.result)
//
// Event shapes (all have msg when there is something to say):
//   text, use {side, move}, miss {side}, hit {side, dmg, hp, eff, crit}, heal {side, hp}, status {side, st},
//   cure {side}, stat {side, key, n}, faint {side}, send {side, idx}, recall {side}, catch {shakes, ok},
//   xp {uid, amount}, level {uid, lv}, learn {uid, move, auto}, item {side, item, target}, end {result}

import { MOVES, SPECIES, ITEMS, STATUS_IMMUNE, STATUS_INFO } from './data.js';
import { typeMult } from './types.js';
import { statsOf, maxHp, petName, petType, gainXp, xpReward } from './pet.js';

export const STAGE_KEYS = ['atk', 'def', 'spd'];
const freshFx = () => ({ atk: 0, def: 0, spd: 0 });

export function createBattle({ kind = 'wild', party, bag = {}, foeParty, foe = {}, rng, ai }) {
  const firstAlive = (p) => Math.max(0, p.findIndex((x) => x.hp > 0));
  const b = {
    kind,
    rng,
    bag,
    foe: { name: foe.name || '', title: foe.title || '', items: { ...(foe.items || {}) }, id: foe.id },
    ai: ai || null,
    sides: [
      { party, active: firstAlive(party), fx: freshFx() },
      { party: foeParty, active: 0, fx: freshFx() },
    ],
    participants: new Set(),
    phase: 'choose',
    result: null,
    turn: 0,
    runs: 0,
    log: [],
  };
  b.participants.add(active(b, 0).uid);
  for (const s of [0, 1]) wakeCounter(b, active(b, s));
  return b;
}

export const active = (b, side) => b.sides[side].party[b.sides[side].active];
export const alive = (party) => party.filter((p) => p.hp > 0);

export function label(b, side, pet = active(b, side)) {
  const n = petName(pet);
  if (side === 0) return n;
  return b.kind === 'wild' ? `Wild ${n}` : `Foe ${n}`;
}

const stageMult = (n) => (n >= 0 ? (2 + n) / 2 : 2 / (2 - n));

/** Effective stat of the active pet on a side, with stages and status. */
export function effStat(b, side, key) {
  const pet = active(b, side);
  let v = statsOf(pet)[key] * stageMult(b.sides[side].fx[key]);
  if (key === 'spd' && pet.st === 'para') v *= 0.5;
  return v;
}

/** Damage before the random roll and crits (used by the AI to compare options). */
export function baseDamage(b, side, moveId, defSide = 1 - side, overrides = {}) {
  const m = MOVES[moveId];
  if (!m.power) return 0;
  const att = overrides.att || active(b, side);
  const def = overrides.def || active(b, defSide);
  const a = overrides.att ? statsOf(att).atk : effStat(b, side, 'atk');
  const d = overrides.def ? statsOf(def).def : effStat(b, defSide, 'def');
  const lvf = Math.floor((2 * att.lv) / 5) + 2;
  let dmg = Math.floor(Math.floor((lvf * m.power * a) / d) / 50) + 2;
  if (m.type === petType(att)) dmg *= 1.25;
  dmg *= typeMult(m.type, petType(def));
  if (att.st === 'burn') dmg *= 0.5;
  return dmg;
}

function rollDamage(b, side, moveId) {
  const crit = b.rng() < 1 / 16;
  const roll = 0.85 + b.rng() * 0.15;
  const dmg = Math.max(1, Math.floor(baseDamage(b, side, moveId) * roll * (crit ? 1.5 : 1)));
  return { dmg, crit };
}

const usableMoves = (pet) => pet.moves.map((m, i) => ({ ...m, slot: i })).filter((m) => m.pp > 0);

function wakeCounter(b, pet) {
  if (pet.st === 'sleep' && !(pet.slp > 0)) pet.slp = b.rng.int(1, 3);
}

/** Speed order for this turn: returns [first, second] sides. */
function order(b, acts) {
  const pr = (s) => {
    const a = acts[s];
    if (!a) return -99;
    if (a.type !== 'move') return 10 - s; // switching, items, capsules and running come first (player first)
    const id = moveIdFor(b, s, a);
    return MOVES[id].prio || 0;
  };
  const p0 = pr(0); const p1 = pr(1);
  if (p0 !== p1) return p0 > p1 ? [0, 1] : [1, 0];
  const s0 = effStat(b, 0, 'spd'); const s1 = effStat(b, 1, 'spd');
  if (s0 !== s1) return s0 > s1 ? [0, 1] : [1, 0];
  return b.rng() < 0.5 ? [0, 1] : [1, 0];
}

function moveIdFor(b, side, a) {
  const pet = active(b, side);
  if (!usableMoves(pet).length) return 'flail';
  return pet.moves[a.slot]?.id ?? 'flail';
}

/** Can the player use this action right now? Returns '' when fine, else a reason. */
export function actionProblem(b, a) {
  if (b.phase !== 'choose') return 'Not now';
  const me = active(b, 0);
  if (a.type === 'move') {
    if (!usableMoves(me).length) return '';
    const m = me.moves[a.slot];
    if (!m) return 'No move';
    if (m.pp <= 0) return 'No PP left for that move';
    return '';
  }
  if (a.type === 'switch') {
    const p = b.sides[0].party[a.idx];
    if (!p || p.hp <= 0) return 'That pet has fainted';
    if (a.idx === b.sides[0].active) return 'Already in battle';
    return '';
  }
  if (a.type === 'run') return b.kind === 'wild' ? '' : 'You can\'t run from a tamer battle!';
  if (a.type === 'catch') {
    if (b.kind !== 'wild') return 'You can\'t catch another tamer\'s pet!';
    if (!(b.bag[a.item] > 0)) return 'You have none left';
    return '';
  }
  if (a.type === 'item') return itemProblem(b.bag, a.item, b.sides[0].party[a.target]);
  return 'Unknown action';
}

/** Why an item can't be used on a pet ('' if it can). Shared with the bag outside battle. */
export function itemProblem(bag, item, pet) {
  const it = ITEMS[item];
  if (!it || !(bag[item] > 0)) return 'You have none left';
  if (!pet) return 'Pick a pet';
  if (it.kind === 'capsule') return 'Capsules are for wild pets';
  if (it.kind === 'revive') return pet.hp > 0 ? 'Only for fainted pets' : '';
  if (pet.hp <= 0) return 'This pet has fainted';
  if (it.kind === 'heal') return pet.hp >= maxHp(pet) ? 'HP is already full' : '';
  if (it.kind === 'cure') return pet.st ? '' : 'Nothing to cure';
  if (it.kind === 'pp') return pet.moves.every((m) => m.pp >= MOVES[m.id].pp) ? 'PP is already full' : '';
  return '';
}

/** Use a healing item on a pet (mutates). Returns a message. */
export function applyItem(item, pet) {
  const it = ITEMS[item];
  const n = petName(pet);
  if (it.kind === 'heal') {
    const before = pet.hp;
    pet.hp = Math.min(maxHp(pet), pet.hp + it.amount);
    return `${n} got back ${pet.hp - before} HP.`;
  }
  if (it.kind === 'cure') { const was = pet.st; pet.st = null; pet.slp = 0; return `${n} is no longer ${STATUS_INFO[was].name.toLowerCase()}.`; }
  if (it.kind === 'revive') { pet.hp = Math.max(1, Math.floor(maxHp(pet) / 2)); pet.st = null; return `${n} is back on its feet!`; }
  if (it.kind === 'pp') { for (const m of pet.moves) m.pp = MOVES[m.id].pp; return `${n}'s moves are fully charged.`; }
  return '';
}

/** Chance a capsule catches the wild pet right now (0..1). */
export function catchChance(pet, item) {
  const sp = SPECIES[pet.sp];
  const hpFrac = pet.hp / maxHp(pet);
  const st = pet.st === 'sleep' || pet.st === 'para' ? 1.6 : pet.st ? 1.3 : 1;
  const p = sp.catchRate * ITEMS[item].catch * (1 - (2 / 3) * hpFrac) * st;
  return Math.max(0.01, Math.min(1, p));
}

// ---------------------------------------------------------------- turns

export function takeTurn(b, action) {
  const ev = [];
  if (b.phase !== 'choose') return ev;
  const problem = actionProblem(b, action);
  if (problem) return [{ t: 'text', msg: problem, bad: true }];
  b.turn += 1;
  const acts = [action, b.ai ? b.ai.act(b) : wildAction(b)];
  const [first, second] = order(b, acts);
  for (const side of [first, second]) {
    if (b.phase === 'over') break;
    if (active(b, side).hp <= 0) continue;
    if (side === 1 && active(b, 0).hp <= 0 && acts[1].type === 'move') continue; // nothing to hit
    doAction(b, side, acts[side], ev);
    if (b.phase === 'over') break;
    if (resolveFaints(b, ev)) break;
  }
  if (b.phase === 'choose') endOfTurn(b, ev);
  b.log.push(...ev);
  return ev;
}

function wildAction(b) {
  const pet = active(b, 1);
  const opts = usableMoves(pet);
  if (!opts.length) return { type: 'move', slot: 0 };
  return { type: 'move', slot: b.rng.pick(opts).slot };
}

function doAction(b, side, a, ev) {
  if (a.type === 'move') return useMove(b, side, a.slot, ev);
  if (a.type === 'switch') return switchIn(b, side, a.idx, ev, true);
  if (a.type === 'item') {
    const target = b.sides[side].party[a.target ?? b.sides[side].active];
    if (side === 0) b.bag[a.item] -= 1; else b.foe.items[a.item] -= 1;
    const who = side === 0 ? 'You' : b.foe.name;
    ev.push({ t: 'item', side, item: a.item, msg: `${who} used a ${ITEMS[a.item].name}.` });
    const msg = applyItem(a.item, target);
    const onField = target === active(b, side);
    ev.push({ t: 'heal', side, hp: target.hp, onField, msg: side === 1 ? msg.replace(petName(target), label(b, 1, target)) : msg });
    return null;
  }
  if (a.type === 'catch') return throwCapsule(b, a.item, ev);
  if (a.type === 'run') {
    const ps = effStat(b, 0, 'spd'); const fs = effStat(b, 1, 'spd');
    b.runs += 1;
    const odds = ps >= fs ? 1 : Math.min(1, 0.25 + 0.5 * (ps / fs) + 0.25 * (b.runs - 1));
    if (b.rng() < odds) {
      ev.push({ t: 'text', msg: 'You got away safely!' });
      finish(b, 'ran', ev);
    } else ev.push({ t: 'text', msg: 'You couldn\'t get away!' });
  }
  return null;
}

function throwCapsule(b, item, ev) {
  b.bag[item] -= 1;
  const pet = active(b, 1);
  const p = catchChance(pet, item);
  const s = Math.pow(p, 1 / 4);
  let shakes = 0;
  while (shakes < 4 && b.rng() < s) shakes += 1;
  const ok = shakes === 4;
  ev.push({ t: 'throw', item, msg: `You threw a ${ITEMS[item].name}!` });
  ev.push({
    t: 'catch', shakes: Math.min(3, shakes), ok,
    msg: ok ? `Gotcha! ${petName(pet)} was caught!` : ['Oh no! It broke free!', 'Argh! Almost had it!', 'So close!', 'So close!'][shakes],
  });
  if (ok) finish(b, 'caught', ev);
}

function switchIn(b, side, idx, ev, recall) {
  const sd = b.sides[side];
  if (recall) ev.push({ t: 'recall', side, msg: side === 0 ? `Come back, ${petName(active(b, 0))}!` : `${b.foe.name} called back ${petName(active(b, 1))}.` });
  sd.active = idx;
  sd.fx = freshFx();
  const pet = active(b, side);
  wakeCounter(b, pet);
  if (side === 0) b.participants.add(pet.uid);
  ev.push({ t: 'send', side, idx, msg: side === 0 ? `Go, ${petName(pet)}!` : `${b.foe.name} sent out ${petName(pet)}!` });
}

function useMove(b, side, slot, ev) {
  const me = active(b, side);
  const foeSide = 1 - side;
  const who = label(b, side);
  // Status that stops a move.
  if (me.st === 'sleep') {
    me.slp = (me.slp || 1) - 1;
    if (me.slp > 0) { ev.push({ t: 'text', side, msg: `${who} is fast asleep.`, anim: 'sleep' }); return; }
    me.st = null;
    ev.push({ t: 'cure', side, msg: `${who} woke up!` });
  }
  if (me.st === 'para' && b.rng() < 0.25) { ev.push({ t: 'text', side, msg: `${who} is paralysed! It can't move!`, anim: 'para' }); return; }

  const id = moveIdFor(b, side, { slot });
  const m = MOVES[id];
  if (id === 'flail') ev.push({ t: 'text', msg: `${who} has no moves left!` });
  else me.moves[slot].pp -= 1;
  ev.push({ t: 'use', side, move: id, msg: `${who} used ${m.name}!` });

  const target = active(b, foeSide);
  const hitsFoe = m.power > 0 || m.status || (m.stat && m.stat.who === 'foe');
  if (hitsFoe && m.acc != null && b.rng() * 100 >= m.acc) { ev.push({ t: 'miss', side, msg: `${who}'s attack missed!` }); return; }

  if (m.power > 0) {
    const { dmg, crit } = rollDamage(b, side, id);
    const dealt = Math.min(target.hp, dmg);
    target.hp -= dealt;
    const eff = typeMult(m.type, petType(target));
    ev.push({ t: 'hit', side: foeSide, dmg: dealt, hp: target.hp, eff, crit, moveType: m.type });
    if (crit) ev.push({ t: 'text', msg: 'A critical hit!' });
    if (eff > 1) ev.push({ t: 'text', msg: 'It\'s super strong!' });
    else if (eff < 1) ev.push({ t: 'text', msg: 'It\'s not very strong...' });
    if (m.drain && dealt > 0 && me.hp < maxHp(me)) {
      me.hp = Math.min(maxHp(me), me.hp + Math.max(1, Math.floor(dealt * m.drain)));
      ev.push({ t: 'heal', side, hp: me.hp, onField: true, msg: `${who} drank up some energy.` });
    }
    if (m.recoil && dealt > 0) {
      const r = Math.min(me.hp, Math.max(1, Math.floor(dealt * m.recoil)));
      me.hp -= r;
      ev.push({ t: 'hit', side, dmg: r, hp: me.hp, eff: 1, recoil: true, msg: `${who} is hurt by recoil.` });
    }
    if (target.hp > 0 && m.status && b.rng() < m.chance) inflict(b, foeSide, m.status, ev, true);
    if (target.hp > 0 && m.stat && m.stat.who === 'foe' && b.rng() < (m.stat.chance ?? 1)) changeStage(b, foeSide, m.stat.key, m.stat.n, ev);
    if (target.hp <= 0) ev.push({ t: 'faint', side: foeSide, msg: `${label(b, foeSide, target)} fainted!` });
    if (me.hp <= 0) ev.push({ t: 'faint', side, msg: `${who} fainted!` });
    return;
  }
  if (m.status) { inflict(b, foeSide, m.status, ev, false); return; }
  if (m.stat) { changeStage(b, m.stat.who === 'self' ? side : foeSide, m.stat.key, m.stat.n, ev); return; }
  if (m.heal) {
    if (me.hp >= maxHp(me)) { ev.push({ t: 'text', msg: 'But its HP is already full!' }); return; }
    me.hp = Math.min(maxHp(me), me.hp + Math.floor(maxHp(me) * m.heal));
    ev.push({ t: 'heal', side, hp: me.hp, onField: true, msg: `${who} got some HP back.` });
  }
}

/** Can this status land on the pet? '' if yes, else why not. */
export function statusBlock(pet, st) {
  if (pet.st) return 'already';
  if (STATUS_IMMUNE[st] === petType(pet)) return 'immune';
  return '';
}

function inflict(b, side, st, ev, secondary) {
  const pet = active(b, side);
  const why = statusBlock(pet, st);
  if (why) {
    if (!secondary) ev.push({ t: 'text', msg: why === 'immune' ? `It doesn't affect ${label(b, side)}...` : 'But it failed!' });
    return;
  }
  pet.st = st;
  if (st === 'sleep') pet.slp = b.rng.int(1, 3);
  const verb = { burn: 'was burned', poison: 'was poisoned', para: 'is paralysed! It may not be able to move', sleep: 'fell asleep' }[st];
  ev.push({ t: 'status', side, st, msg: `${label(b, side)} ${verb}!` });
}

function changeStage(b, side, key, n, ev) {
  const fx = b.sides[side].fx;
  const before = fx[key];
  fx[key] = Math.max(-6, Math.min(6, fx[key] + n));
  const name = { atk: 'Attack', def: 'Defence', spd: 'Speed' }[key];
  const who = label(b, side);
  if (fx[key] === before) { ev.push({ t: 'text', msg: `${who}'s ${name} won't go any ${n > 0 ? 'higher' : 'lower'}!` }); return; }
  const d = fx[key] - before;
  const how = Math.abs(d) > 1 ? (d > 0 ? 'rose sharply' : 'fell sharply') : (d > 0 ? 'rose' : 'fell');
  ev.push({ t: 'stat', side, key, n: d, msg: `${who}'s ${name} ${how}!` });
}

function endOfTurn(b, ev) {
  for (const side of [0, 1]) {
    const pet = active(b, side);
    if (pet.hp <= 0 || (pet.st !== 'burn' && pet.st !== 'poison')) continue;
    const dmg = Math.min(pet.hp, Math.max(1, Math.floor(maxHp(pet) / (pet.st === 'burn' ? 12 : 8))));
    pet.hp -= dmg;
    ev.push({ t: 'hit', side, dmg, hp: pet.hp, eff: 1, dot: pet.st, msg: `${label(b, side)} is hurt by its ${pet.st === 'burn' ? 'burn' : 'poison'}.` });
    if (pet.hp <= 0) ev.push({ t: 'faint', side, msg: `${label(b, side)} fainted!` });
  }
  resolveFaints(b, ev);
}

/** After any faint: hand out XP, bring in the next foe pet, or end the battle. True if the turn should stop. */
function resolveFaints(b, ev) {
  let stop = false;
  const foePet = active(b, 1);
  if (foePet.hp <= 0 && !foePet.xpGiven) {
    foePet.xpGiven = true;
    awardXp(b, foePet, ev);
    stop = true;
    if (!alive(b.sides[1].party).length) {
      if (b.kind === 'trainer') ev.push({ t: 'text', msg: `You beat ${b.foe.title ? `${b.foe.title} ` : ''}${b.foe.name}!` });
      finish(b, 'win', ev);
      return true;
    }
  }
  const mine = active(b, 0);
  if (mine.hp <= 0) {
    stop = true;
    if (!alive(b.sides[0].party).length) {
      ev.push({ t: 'text', msg: 'You have no pets left that can fight!' });
      finish(b, 'lose', ev);
      return true;
    }
    b.phase = 'switch';
  }
  if (foePet.hp <= 0 && b.phase !== 'over') {
    const idx = b.ai ? b.ai.next(b) : b.sides[1].party.findIndex((p) => p.hp > 0);
    switchIn(b, 1, idx, ev, false);
  }
  return stop;
}

function awardXp(b, foePet, ev) {
  const party = b.sides[0].party;
  for (const pet of party) {
    if (pet.hp <= 0) continue;
    const base = xpReward(foePet, b.kind === 'trainer', pet.lv);
    const share = b.participants.has(pet.uid) ? base : Math.floor(base / 2);
    if (share <= 0) continue;
    ev.push({ t: 'xp', uid: pet.uid, amount: share, msg: `${petName(pet)} gained ${share} XP.`, quiet: !b.participants.has(pet.uid) });
    for (const e of gainXp(pet, share)) {
      if (e.t === 'level') ev.push({ t: 'level', uid: pet.uid, lv: e.lv, gains: e.gains, msg: `${petName(pet)} grew to level ${e.lv}!` });
      else ev.push({ t: 'learn', uid: pet.uid, move: e.move, auto: e.auto, msg: e.auto ? `${petName(pet)} learned ${MOVES[e.move].name}!` : '' });
    }
  }
  b.participants = new Set([active(b, 0).uid].filter(() => active(b, 0).hp > 0));
}

/** The player picks a new pet after theirs fainted. */
export function sendOut(b, idx) {
  const ev = [];
  if (b.phase !== 'switch') return ev;
  const p = b.sides[0].party[idx];
  if (!p || p.hp <= 0) return [{ t: 'text', msg: 'That pet can\'t fight.', bad: true }];
  b.phase = 'choose';
  switchIn(b, 0, idx, ev, false);
  b.log.push(...ev);
  return ev;
}

function finish(b, result, ev) {
  b.phase = 'over';
  b.result = result;
  for (const s of b.sides) for (const p of s.party) delete p.xpGiven;
  ev.push({ t: 'end', result });
}

/** How well the player did, 0..1 (share of the party's HP left), for the adaptive skill. */
export function margin(b) {
  const party = b.sides[0].party;
  const tot = party.reduce((a, p) => a + maxHp(p), 0);
  return tot ? party.reduce((a, p) => a + Math.max(0, p.hp), 0) / tot : 0;
}

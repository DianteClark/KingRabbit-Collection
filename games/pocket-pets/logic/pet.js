// A pet: { uid, sp, lv, xp, hp, st, moves: [{ id, pp }], nick? }. Stats come from the species
// and level, so they never need saving.
import { SPECIES, MOVES, LINES } from './data.js';

export const MAX_LEVEL = 50;

let uidCounter = 1;
/** Uids only need to be unique within one save; game.js keeps its own counter. */
export function setUidCounter(n) { uidCounter = n; }
export const nextUid = () => uidCounter++;

/** Total XP needed to reach a level (a gentle cubic curve). */
export const xpForLevel = (lv) => (lv <= 1 ? 0 : Math.floor(0.8 * lv * lv * lv));

export function statsOf(pet) {
  const b = SPECIES[pet.sp].base;
  const lv = pet.lv;
  return {
    hp: Math.floor((b.hp * 2 * lv) / 100) + lv + 10,
    atk: Math.floor((b.atk * 2 * lv) / 100) + 5,
    def: Math.floor((b.def * 2 * lv) / 100) + 5,
    spd: Math.floor((b.spd * 2 * lv) / 100) + 5,
  };
}

export const maxHp = (pet) => statsOf(pet).hp;
export const speciesOf = (pet) => SPECIES[pet.sp];
export const petName = (pet) => pet.nick || SPECIES[pet.sp].name;

export const NICK_MAX = 10;
/** Give a pet a nickname (letters, digits, spaces and - ' . only; blank clears it). Returns the name used. */
export function setNick(pet, name) {
  const clean = String(name || '').replace(/[^A-Za-z0-9 '.-]/g, '').replace(/\s+/g, ' ').trim().slice(0, NICK_MAX);
  if (clean && clean !== SPECIES[pet.sp].name) pet.nick = clean; else delete pet.nick;
  return petName(pet);
}
export const petType = (pet) => SPECIES[pet.sp].type;

/** Moves a line learns at exactly this level. */
export function movesAtLevel(sp, lv) {
  return LINES[SPECIES[sp].line].filter(([l]) => l === lv).map(([, m]) => m);
}

/** The last four moves learnt by this level (what a wild or trainer pet knows). */
export function defaultMoves(sp, lv) {
  const known = [];
  for (const [l, m] of LINES[SPECIES[sp].line]) {
    if (l > lv) break;
    if (!known.includes(m)) known.push(m);
  }
  return known.slice(-4).map((id) => ({ id, pp: MOVES[id].pp }));
}

export function createPet(sp, lv, { uid } = {}) {
  const pet = { uid: uid ?? nextUid(), sp, lv, xp: xpForLevel(lv), hp: 0, st: null, moves: defaultMoves(sp, lv) };
  pet.hp = maxHp(pet);
  return pet;
}

export function healPet(pet) {
  pet.hp = maxHp(pet);
  pet.st = null;
  for (const m of pet.moves) m.pp = MOVES[m.id].pp;
}

export const knows = (pet, id) => pet.moves.some((m) => m.id === id);

/**
 * Add XP and handle level ups. Returns a list of events:
 *   { t: 'level', lv, gains }  and  { t: 'learn', move, auto: true|false }
 * Moves are learnt automatically while there is a free slot; otherwise a 'learn' event with
 * auto false is returned and the caller asks the player (see learnMove).
 */
export function gainXp(pet, amount) {
  const ev = [];
  if (pet.lv >= MAX_LEVEL || pet.hp <= 0 && amount <= 0) return ev;
  pet.xp += amount;
  while (pet.lv < MAX_LEVEL && pet.xp >= xpForLevel(pet.lv + 1)) {
    const before = statsOf(pet);
    pet.lv += 1;
    const after = statsOf(pet);
    if (pet.hp > 0) pet.hp += after.hp - before.hp;
    ev.push({ t: 'level', lv: pet.lv, gains: { hp: after.hp - before.hp, atk: after.atk - before.atk, def: after.def - before.def, spd: after.spd - before.spd } });
    for (const m of movesAtLevel(pet.sp, pet.lv)) {
      if (knows(pet, m)) continue;
      if (pet.moves.length < 4) { pet.moves.push({ id: m, pp: MOVES[m].pp }); ev.push({ t: 'learn', move: m, auto: true }); }
      else ev.push({ t: 'learn', move: m, auto: false });
    }
  }
  if (pet.lv >= MAX_LEVEL) pet.xp = xpForLevel(MAX_LEVEL);
  return ev;
}

/** Replace move slot `slot` with `move` (slot null = give up on the new move). */
export function learnMove(pet, move, slot) {
  if (slot == null || knows(pet, move)) return false;
  if (pet.moves.length < 4) pet.moves.push({ id: move, pp: MOVES[move].pp });
  else pet.moves[slot] = { id: move, pp: MOVES[move].pp };
  return true;
}

/** Species this pet evolves into right now, or null. */
export function canEvolve(pet) {
  const evo = SPECIES[pet.sp].evo;
  return evo && pet.lv >= evo[1] ? evo[0] : null;
}

/** Evolve in place, keeping the same HP fraction. Returns new moves learnt on arrival (none in this game). */
export function evolve(pet) {
  const to = canEvolve(pet);
  if (!to) return null;
  const frac = pet.hp / maxHp(pet);
  const from = pet.sp;
  pet.sp = to;
  pet.hp = Math.max(pet.hp > 0 ? 1 : 0, Math.round(maxHp(pet) * frac));
  return { from, to };
}

/** The base XP the winner earns for beating this pet. */
export function xpReward(foe, trainer = false, winnerLv = foe.lv) {
  // Beating a higher-level pet is worth more (up to double), so a team that falls behind catches up.
  const catchUp = Math.min(2, Math.max(1, 1 + 0.15 * (foe.lv - winnerLv)));
  return Math.floor(((SPECIES[foe.sp].xpYield * foe.lv) / 6) * (trainer ? 1.5 : 1) * catchUp);
}

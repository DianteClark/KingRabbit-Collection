// Settlers as people: making them, thoughts and mood, getting hurt, dying.
import { NAMES, LOOKS, SKILLS, TRAITS, CLASH, TPD, TPH, ITEMS } from './data.js';
import { next, pick, randInt, chance, shuffle } from './rng.js';
import { settlers, log, note, dropNear, clearReservations, tx, ty, dayOf } from './world.js';

// key: [text, mood, hours]
export const THOUGHTS = {
  meal: ['Had a hot meal', 6, 18],
  feast: ['Loved that meal', 9, 18],
  raw: ['Ate raw food', -4, 18],
  bed: ['Slept in a bed', 3, 16],
  ground: ['Slept on the ground', -5, 16],
  coldsleep: ['Slept in the cold', -6, 16],
  chat: ['Had a nice chat', 3, 12],
  argue: ['Had an argument', -5, 18],
  friend: ['Made a friend', 5, 48],
  friendDied: ['My friend died', -16, 96],
  died: ['A settler died', -7, 72],
  raidWon: ['We beat the raiders', 7, 48],
  hurt: ['Got hurt badly', -6, 48],
  joined: ['New faces in the colony', 3, 36],
  rescued: ['Help is on the way', 10, 120],
  vent: ['Let it all out', 8, 36],
  cured: ['Feeling better', 5, 36],
  sunny: ['Lovely weather', 2, 12],
  rotten: ['Food went to waste', -3, 24],
  cargo: ['Supplies from the sky', 4, 24],
};
// Situational thoughts, worked out every hour.
export const SIT = {
  hungry: ['Hungry', -8], starving: ['Starving', -20], tired: ['Tired', -6], exhausted: ['Exhausted', -12],
  cold: ['Freezing', -9], sick: ['Feeling sick', -8], injured: ['In pain', -7], downed: ['Can\'t get up', -10],
  winter: ['Dark winter days', -2], optimist: ['Optimist', 12], pessimist: ['Pessimist', -12], lazy: ['Easy-going', 4],
  inspired: ['Feeling inspired', 0], friends: ['Among friends', 4], rival: ['A rival is here', -4], hot: ['Too hot', -5],
};

export function addThought(s, m, k, scale = 1) {
  const [, v, hrs] = THOUGHTS[k];
  m.thoughts = m.thoughts.filter((t) => t.k !== k);
  m.thoughts.push({ k, v: Math.round(v * scale), until: s.t + hrs * TPH });
}
export function moodTarget(m) {
  let v = 0;
  for (const t of m.thoughts) v += t.v;
  for (const t of m.sit || []) v += SIT[t][1];
  return Math.max(0, Math.min(1, 0.55 + v / 100));
}
export const has = (m, t) => m.traits?.includes(t);

function rollTraits(s) {
  const out = [];
  const keys = shuffle(s, Object.keys(TRAITS));
  for (const k of keys) {
    if (out.length >= 2) break;
    if (out.some((o) => CLASH.some(([a, b]) => (a === o && b === k) || (b === o && a === k)))) continue;
    out.push(k);
  }
  return out;
}

export function makeSettler(s, at, opts = {}) {
  const used = new Set(s.mobs.filter((m) => m.kind === 'settler').map((m) => m.name));
  const free = NAMES.filter((n) => !used.has(n));
  const name = opts.name || (free.length ? pick(s, free) : `Settler ${s.nextMob}`);
  const looks = new Set(settlers(s).map((m) => m.look));
  let look = randInt(s, 1, LOOKS);
  for (let k = 0; k < 20 && looks.has(look); k++) look = randInt(s, 1, LOOKS);
  const skills = {};
  for (const k of SKILLS) skills[k] = randInt(s, 0, 3);
  const best = shuffle(s, [...SKILLS]);
  skills[best[0]] = randInt(s, 5, 8);
  skills[best[1]] = randInt(s, 3, 6);
  if (opts.skill) skills[opts.skill] = Math.max(skills[opts.skill], 6);
  const m = {
    id: s.nextMob++, kind: 'settler', name, look,
    x: tx(at) + 0.5, y: ty(at) + 0.5, at, path: null, dest: null, job: null,
    food: 0.8 + next(s) * 0.15, rest: 0.85 + next(s) * 0.1, mood: 0.6, hp: 100, sick: null, downed: false,
    thoughts: [], sit: [], rel: {}, skills, xp: {}, traits: opts.traits || rollTraits(s),
    gear: { weapon: opts.weapon || null, tool: null, coat: null }, carry: null, bed: null,
    off: {}, focus: null, cold: 0, brk: null, think: 0, tendAt: -1e9, bleed: false,
    joined: dayOf(s), status: 'Looking around', stuck: 0, kills: 0, wasDowned: false,
  };
  return m;
}

/** Damage to anything with hp. by = attacker (or null). */
export function hurt(s, m, dmg, by = null, cause = 'wounds') {
  if (m.dead) return;
  if (m.kind === 'settler' && has(m, 'tough')) dmg *= 0.6;
  m.hp -= dmg;
  m.hitAt = s.t;
  if (by) m.lastBy = by.id;
  if (m.kind === 'settler') {
    if (m.hp <= 0) { die(s, m, cause); return; }
    if (m.hp <= 20 && !m.downed) {
      m.downed = true; m.wasDowned = true; m.bleed = true; m.sleeping = false;
      dropJob(s, m);
      log(s, `${m.name} is down and bleeding. A doctor needs to tend them.`, 'bad', m.at);
      note(s, { type: 'sfx', name: 'hit' });
      addThought(s, m, 'hurt');
    }
  } else if (m.hp <= 0) {
    kill(s, m, by);
  }
}

/** Let go of the current job: free reservations and drop anything carried. */
export function dropJob(s, m) {
  if (m.job?.type === 'heal' && m.job.step === 'carry') { const q = s.mobs.find((o) => o.id === m.job.patient); if (q) q.carriedBy = null; }
  if (m.carry) { dropNear(s, m.at, m.carry.k, m.carry.n, m.carry.r || 0); m.carry = null; }
  clearReservations(s, m.id);
  m.job = null; m.path = null; m.dest = null; m.sleeping = false;
}

export function die(s, m, cause) {
  if (m.dead) return;
  dropJob(s, m);
  m.dead = true; m.diedAt = s.t; m.cause = cause; m.downed = false;
  for (const g of Object.values(m.gear)) if (g) dropNear(s, m.at, g, 1);
  m.gear = { weapon: null, tool: null, coat: null };
  s.stats.deaths++;
  log(s, `${m.name} has died (${cause}).`, 'bad', m.at);
  note(s, { type: 'death', id: m.id }); note(s, { type: 'adapt', kind: 'death' });
  for (const o of settlers(s)) {
    if ((o.rel[m.id] || 0) >= 30) addThought(s, o, 'friendDied'); else addThought(s, o, 'died');
    delete o.rel[m.id];
  }
}

/** A raider or animal dies: leave meat, leather or the raider's weapon. */
export function kill(s, m, by) {
  if (m.dead) return;
  m.dead = true; m.diedAt = s.t;
  clearReservations(s, m.id);
  if (m.kind === 'animal') {
    const def = m.def;
    if (def.meat) dropNear(s, m.at, 'meat', def.meat);
    if (def.leather) dropNear(s, m.at, 'leather', def.leather);
    if (m.hostile && by?.kind === 'settler') by.kills = (by.kills || 0) + 1;
  } else if (m.kind === 'raider') {
    if (m.weapon && chance(s, 0.6)) dropNear(s, m.at, m.weapon, 1);
    if (by?.kind === 'settler') by.kills = (by.kills || 0) + 1;
  }
  note(s, { type: 'kill', id: m.id });
}

export function gainXp(s, m, skill, amt = 1) {
  if (!skill) return;
  m.xp[skill] = (m.xp[skill] || 0) + amt;
  const lvl = m.skills[skill];
  if (lvl < 10 && m.xp[skill] >= (lvl + 1) * 90) {
    m.xp[skill] = 0; m.skills[skill]++;
    if (m.skills[skill] >= 5) log(s, `${m.name} got better at ${skill} (level ${m.skills[skill]}).`, 'good');
  }
}

/** Work speed multiplier for a skill. */
export function workRate(m, skill) {
  let r = skill ? 0.55 + 0.09 * m.skills[skill] : 1;
  if (has(m, 'hardworker')) r *= 1.2;
  if (has(m, 'lazy')) r *= 0.8;
  if (has(m, 'greenthumb') && skill === 'farm') r *= 1.4;
  if (m.gear.tool) r *= 1.4;
  if (m.mood > 0.85) r *= 1.2;
  if (m.sick) r *= 0.7;
  if (m.hp < 50) r *= 0.75;
  return r;
}
export function speedOf(m) {
  let v = 0.14;
  if (has(m, 'fast')) v *= 1.2;
  if (has(m, 'slow')) v *= 0.85;
  if (m.hp < 50) v *= 0.8;
  if (m.sick && m.sick.sev > 0.5) v *= 0.8;
  return v;
}
export const canFight = (m) => !m.downed && !has(m, 'wimp') && (m.gear.weapon || has(m, 'brave') || m.skills.fight >= 4);
export const weaponOf = (m) => (m.gear?.weapon ? ITEMS[m.gear.weapon] : null) || (m.weapon ? ITEMS[m.weapon] : null);
export const comfortMin = (m) => (has(m, 'coldproof') ? -10 : 0) - (m.gear?.coat ? ITEMS[m.gear.coat].warm : 0);

export const daysAlive = (s, m) => dayOf(s) - m.joined;
export const TPD_ = TPD;

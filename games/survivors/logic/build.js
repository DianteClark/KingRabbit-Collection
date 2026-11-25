// The hero's build during a run: weapons, passives, evolutions, level-up offers and the stats and
// damage that come out of them. Pure, so the tests can check it.
import { WEAPONS, WEAPON_IDS, PASSIVES, PASSIVE_IDS, EVOLUTIONS, EVOLUTION_IDS, CHARACTERS, MAX_LEVEL, SHOP } from './data.js';
import { EASY } from './waves.js';

export const BASE = { speed: 80, magnet: 48 };

/** A fresh build for a hero: their starting weapon at level 1. */
export function newBuild(charId) {
  const c = CHARACTERS[charId] || CHARACTERS.wanderer;
  return { weapons: { [c.weapon]: 1 }, passives: {}, evolved: {} };
}

/** XP needed to go from level L to L + 1. */
export const xpToNext = (L) => Math.floor(5 + L * 4 + L * L * 0.3);

/** The hero's stats from hero + permanent upgrades + passives (+ Easy mode). */
export function playerStats(charId, shop = {}, passives = {}, easy = false) {
  const c = CHARACTERS[charId] || CHARACTERS.wanderer;
  const lv = (k) => Math.min(SHOP[k].max, shop[k] || 0);
  const p = (k) => passives[k] || 0;
  const b = c.bonus || {};
  const maxHp = Math.round((c.hp + lv('vitality') * 10 + p('heart') * PASSIVES.heart.per) * (easy ? EASY.hp : 1));
  return {
    maxHp,
    speed: BASE.speed * c.speed * (1 + lv('swift') * 0.05 + p('boots') * PASSIVES.boots.per),
    magnet: BASE.magnet * (1 + lv('magnet') * 0.15 + p('magnet') * PASSIVES.magnet.per + (b.magnet || 0)),
    cdMul: Math.max(0.4, 1 - p('ring') * PASSIVES.ring.per),
    area: 1 + p('tome') * PASSIVES.tome.per + (b.area || 0),
    might: 1 + lv('might') * 0.05 + p('might') * PASSIVES.might.per,
    armor: lv('armor') + (b.armor || 0),
    xpMul: 1 + lv('growth') * 0.08,
    coinMul: 1 + lv('greed') * 0.15,
    revives: lv('revival'),
  };
}

/** Damage a weapon hit does: base x might, rounded, never below 1. */
export const hitDamage = (base, might = 1) => Math.max(1, Math.round(base * might));

/** Damage the hero takes from a monster: scaled by time/Easy, minus armor, at least 1. */
export const hurtDamage = (dmg, dmgMul = 1, armor = 0) => Math.max(1, Math.round(dmg * dmgMul - armor));

/** Stats for one weapon at its level (or its evolution). Area and cooldown multipliers applied. */
export function weaponStats(id, level, stats, evolved = null) {
  const area = stats?.area ?? 1; const cdMul = stats?.cdMul ?? 1;
  if (evolved) {
    const e = EVOLUTIONS[evolved];
    return { ...e, evolved, cd: e.cd != null ? e.cd * cdMul : undefined, radius: e.radius != null ? e.radius * area : undefined };
  }
  const w = WEAPONS[id]; const i = Math.min(MAX_LEVEL, Math.max(1, level)) - 1;
  const at = (k) => (Array.isArray(w[k]) ? w[k][i] : w[k]);
  const out = {};
  for (const k of Object.keys(w)) if (!['name', 'icon', 'desc'].includes(k)) out[k] = at(k);
  if (out.cd != null) out.cd *= cdMul;
  if (out.radius != null) out.radius *= area;
  return out;
}

/** Evolutions ready right now: weapon at max level + the passive, and not evolved yet. */
export function readyEvolutions(build) {
  return EVOLUTION_IDS.filter((e) => {
    const ev = EVOLUTIONS[e];
    return (build.weapons[ev.from] || 0) >= MAX_LEVEL && (build.passives[ev.needs] || 0) > 0 && !build.evolved[ev.from];
  });
}

/**
 * Up to n level-up choices. A ready evolution always takes the first slot; then upgrades of what
 * you own (twice as likely) and new things. Short of cards: gold and a snack.
 * Each offer: { kind: 'weapon'|'passive'|'evolve'|'gold'|'heal', id, level }.
 */
export function rollOffers(build, rng, n = 3) {
  const offers = readyEvolutions(build).slice(0, 1).map((id) => ({ kind: 'evolve', id, level: 1 }));
  const pool = [];
  for (const id of WEAPON_IDS) {
    const lv = build.weapons[id] || 0;
    if (lv < MAX_LEVEL && !build.evolved[id]) pool.push({ kind: 'weapon', id, level: lv + 1, w: lv ? 2 : 1 });
  }
  for (const id of PASSIVE_IDS) {
    const lv = build.passives[id] || 0;
    if (lv < MAX_LEVEL) pool.push({ kind: 'passive', id, level: lv + 1, w: lv ? 2 : 1 });
  }
  while (offers.length < n && pool.length) {
    const total = pool.reduce((s, o) => s + o.w, 0);
    let r = rng() * total; let k = 0;
    while (k < pool.length - 1 && (r -= pool[k].w) >= 0) k++;
    const [o] = pool.splice(k, 1);
    offers.push({ kind: o.kind, id: o.id, level: o.level });
  }
  // nearly everything maxed: fill up with gold and a snack
  for (const k of ['gold', 'heal']) if (offers.length < n) offers.push({ kind: k, id: k, level: 0 });
  return offers;
}

/** Apply a chosen offer to the build (returns the same build). */
export function applyOffer(build, o) {
  if (o.kind === 'weapon') build.weapons[o.id] = Math.min(MAX_LEVEL, (build.weapons[o.id] || 0) + 1);
  else if (o.kind === 'passive') build.passives[o.id] = Math.min(MAX_LEVEL, (build.passives[o.id] || 0) + 1);
  else if (o.kind === 'evolve') build.evolved[EVOLUTIONS[o.id].from] = o.id;
  return build;
}

/** Name, icon and one-line text for an offer card. */
export function describeOffer(o) {
  if (o.kind === 'evolve') { const e = EVOLUTIONS[o.id]; return { name: e.name, icon: e.icon, tag: 'EVOLVE!', desc: e.desc }; }
  if (o.kind === 'gold') return { name: 'Pouch of Gold', icon: 'i_coin', tag: '+25 coins', desc: 'Everything is maxed. Take some coins.' };
  if (o.kind === 'heal') return { name: 'Roast Meat', icon: 'i_meat', tag: 'Heal 30', desc: 'Everything is maxed. Have a snack.' };
  const d = o.kind === 'weapon' ? WEAPONS[o.id] : PASSIVES[o.id];
  return { name: d.name, icon: d.icon, tag: o.level === 1 ? 'NEW' : `Lv ${o.level}`, desc: d.desc };
}

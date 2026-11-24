// A whole run: hero, deck, relics, potions, gold, the act map and what screen you're on.
// Everything is plain JSON so it can be saved to localStorage after every step.
//
// run.screen: 'map' | 'combat' | 'reward' | 'event' | 'shop' | 'rest' | 'treasure' | 'bossRelic' | 'dead' | 'victory'

import { makeRng, next, int, pick, sample, weighted, chance, shuffle } from './rng.js';
import { CARDS, STARTER_DECKS, rewardPool, NEUTRAL_POOL, canUpgrade, cardName } from './cards.js';
import { RELICS, relicPool, STARTER_RELIC } from './relics.js';
import { POTIONS, POTION_IDS } from './potions.js';
import { ACTS } from './enemies.js';
import { EVENTS, EVENT_IDS } from './events.js';
import { generateMap, reachable } from './map.js';
import { createCombat, Combat } from './combat.js';

export const VERSION = 1;
export const POTION_SLOTS = 3;

export const HEROES = {
  knight: {
    name: 'Knight', hp: 80, sprite: 'castle:64', color: '#a13d3b',
    blurb: 'Tough and steady. Builds Strength and hides behind a wall of Block.',
  },
  mage: {
    name: 'Mage', hp: 72, sprite: 'tower:80', color: '#47416b',
    blurb: 'Hits every enemy at once with fire and lightning, and draws lots of cards.',
  },
  ranger: {
    name: 'Ranger', hp: 72, sprite: 'rampart:64', color: '#6c8c50',
    blurb: 'Nimble. Poisons enemies, dodges with Dexterity and plays many cheap cards.',
  },
};

// ------------------------------------------------------------------ setup

export function newRun({ hero = 'knight', mode = 'normal', seed = Date.now() } = {}) {
  const rng = makeRng(seed);
  const h = HEROES[hero];
  const run = {
    v: VERSION, seed, rng, hero, mode,
    hp: h.hp, maxHp: h.hp, gold: 99,
    deck: [], uidNext: 1,
    relics: [], relicData: {}, potions: Array(POTION_SLOTS).fill(null),
    act: 1, loop: 0, floor: 0,
    map: null, pos: null, bossId: null,
    screen: 'map',
    fightsThisAct: 0, lastEncounters: [], lastElite: null,
    potionChance: 0.4, removeCost: 75, rareBonus: 0,
    seenEvents: [],
    stats: { kills: 0, elites: 0, bosses: 0, gold: 0, cards: 0, floors: 0, dealt: 0 },
    combat: null, combatKind: null, rewards: null, event: null, shop: null, treasure: null, bossRelics: null,
    phoenixUsed: false,
  };
  for (const id of STARTER_DECKS[hero]) addCard(run, id);
  run.relics.push(STARTER_RELIC[hero]);
  if (mode === 'endless') {
    // Endless is a little gentler at the start: a bit more HP and a potion to begin with.
    run.maxHp += 10; run.hp += 10;
    run.potions[0] = 'heal';
  }
  startAct(run);
  return run;
}

function startAct(run) {
  run.map = generateMap(run.rng);
  run.pos = null;
  run.fightsThisAct = 0;
  run.bossId = pick(run.rng, ACTS[run.act - 1].bosses);
  run.screen = 'map';
}

export function addCard(run, id, up = false) {
  const c = { uid: run.uidNext++, id, up };
  run.deck.push(c);
  return c;
}

export const actInfo = (run) => ACTS[run.act - 1];
export const hasRelic = (run, id) => run.relics.includes(id);
const relicFlag = (run, flag) => run.relics.some((r) => RELICS[r]?.[flag]);

/** Helpers handed to relics and events. */
export function api(run) {
  return {
    rng: run.rng,
    chance: (p) => chance(run.rng, p),
    gainGold: (n) => { run.gold = Math.max(0, run.gold + n); if (n > 0) run.stats.gold += n; },
    loseHp: (n) => { run.hp = Math.max(1, run.hp - n); },
    healPct: (p) => { run.hp = Math.min(run.maxHp, run.hp + Math.floor(run.maxHp * p)); },
    gainMaxHp: (n) => { run.maxHp = Math.max(1, run.maxHp + n); run.hp = Math.max(1, Math.min(run.maxHp, run.hp + Math.max(0, n))); },
    addCard: (id) => addCard(run, id),
    giveRelic: (rarity) => RELICS[giveRelic(run, rarity)]?.name ?? 'nothing',
    givePotion: () => POTIONS[givePotion(run)]?.name ?? 'nothing',
    canGetPotion: () => canGetPotion(run),
    upgradeRandom: (n) => upgradeRandom(run, n),
    cardChoices: (n) => cardChoices(run, n, 'normal'),
  };
}

// ------------------------------------------------------------------ map

export function availableNodes(run) {
  if (run.screen !== 'map') return [];
  return reachable(run.map, run.pos);
}

/** Walk to a room on the map and enter it. */
export function travel(run, nodeId) {
  if (!availableNodes(run).includes(nodeId)) return false;
  run.pos = nodeId;
  run.floor += 1;
  run.stats.floors += 1;
  const node = run.map.nodes[nodeId];
  enterRoom(run, node.type);
  return true;
}

function enterRoom(run, type) {
  if (type === 'fight') startFight(run, pickEncounter(run), 'normal');
  else if (type === 'elite') startFight(run, pickElite(run), 'elite');
  else if (type === 'boss') startFight(run, [run.bossId], 'boss');
  else if (type === 'event') startEvent(run);
  else if (type === 'shop') { run.shop = makeShop(run); run.screen = 'shop'; }
  else if (type === 'rest') run.screen = 'rest';
  else if (type === 'treasure') {
    run.treasure = { gold: int(run.rng, 25, 45), relic: rollRelic(run, weighted(run.rng, [['common', 50], ['uncommon', 35], ['rare', 15]])), opened: false };
    run.screen = 'treasure';
  }
}

function pickEncounter(run) {
  const act = actInfo(run);
  const list = run.fightsThisAct < 3 ? act.easy : act.hard;
  const keyOf = (e) => e.join('+');
  let opts = list.filter((e) => !run.lastEncounters.includes(keyOf(e)));
  if (!opts.length) opts = list;
  const enc = pick(run.rng, opts);
  run.lastEncounters = [...run.lastEncounters, keyOf(enc)].slice(-2);
  run.fightsThisAct += 1;
  return enc;
}

function pickElite(run) {
  const list = actInfo(run).elites;
  let opts = list.filter((e) => e[0] !== run.lastElite);
  if (!opts.length) opts = list;
  const enc = pick(run.rng, opts);
  run.lastElite = enc[0];
  return enc;
}

// ------------------------------------------------------------------ combat

export function startFight(run, enemies, kind) {
  run.combatKind = kind;
  run.combat = createCombat(run, enemies, kind);
  run.screen = 'combat';
}

/** The live combat engine for the saved fight. */
export function combatOf(run) {
  return run.combat ? new Combat(run, run.combat) : null;
}

/** Call once the fight is over ('win' or 'lose'): hands out rewards or ends the run. */
export function finishCombat(run) {
  const s = run.combat;
  if (!s || !s.over) return;
  run.stats.dealt += s.stats.dealt;
  if (s.over === 'lose') {
    run.hp = 0;
    run.combat = null;
    run.screen = 'dead';
    return;
  }
  const kind = run.combatKind;
  run.stats.kills += s.enemies.length;
  if (kind === 'elite') run.stats.elites += 1;
  if (kind === 'boss') run.stats.bosses += 1;
  run.hp = Math.max(1, s.player.hp);
  run.combat = null;
  for (const r of run.relics) RELICS[r]?.combatEnd?.(run);
  run.rewards = makeRewards(run, kind);
  run.screen = 'reward';
}

function makeRewards(run, kind) {
  const gm = run.relics.reduce((m, r) => m * (RELICS[r]?.goldMult || 1), 1);
  const gold = Math.round((kind === 'boss' ? int(run.rng, 95, 105) : kind === 'elite' ? int(run.rng, 25, 35) : int(run.rng, 10, 20)) * gm);
  const rw = { gold, potion: null, relics: [], cards: cardChoices(run, 3, kind), cardsTaken: false, boss: kind === 'boss' };
  if (kind !== 'boss') {
    if (canGetPotion(run, true) && chance(run.rng, run.potionChance)) { rw.potion = pick(run.rng, POTION_IDS); run.potionChance = Math.max(0.1, run.potionChance - 0.1); }
    else run.potionChance = Math.min(0.9, run.potionChance + 0.1);
  }
  if (kind === 'elite') {
    const n = relicFlag(run, 'eliteRelics') ? 2 : 1;
    for (let i = 0; i < n; i++) rw.relics.push(rollRelic(run, weighted(run.rng, [['common', 50], ['uncommon', 33], ['rare', 17]]), rw.relics));
  }
  return rw;
}

/** n card ids for a reward. kind changes the rarity odds. */
export function cardChoices(run, n = 3, kind = 'normal') {
  const fewer = run.relics.reduce((t, r) => t + (RELICS[r]?.fewerCards || 0), 0);
  const count = Math.max(1, n - (kind === 'shop' ? 0 : fewer));
  const out = [];
  for (let i = 0; i < count; i++) {
    let rarity;
    if (kind === 'boss') rarity = 'rare';
    else {
      const rare = (kind === 'elite' ? 10 : 3) + run.rareBonus;
      rarity = weighted(run.rng, [['common', kind === 'elite' ? 50 : 60], ['uncommon', 37], ['rare', rare]]);
    }
    if (rarity === 'rare') run.rareBonus = 0; else run.rareBonus = Math.min(15, run.rareBonus + 1);
    const pool = rewardPool(run.hero, rarity).filter((id) => !out.includes(id));
    const fallback = ['common', 'uncommon', 'rare'].flatMap((r) => rewardPool(run.hero, r)).filter((id) => !out.includes(id));
    out.push(pick(run.rng, pool.length ? pool : fallback));
  }
  return out;
}

export const canGetPotion = (run, ignoreSpace = false) => !relicFlag(run, 'noPotions') && (ignoreSpace || run.potions.some((p) => !p));

export function givePotion(run, id) {
  if (!canGetPotion(run)) return null;
  const slot = run.potions.findIndex((p) => !p);
  const pid = id || pick(run.rng, POTION_IDS);
  run.potions[slot] = pid;
  return pid;
}

export function discardPotion(run, slot) { run.potions[slot] = null; }

/** Drink a potion that works outside of fights (the healing potion). */
export function drinkOnMap(run, slot) {
  const id = run.potions[slot];
  if (!id || !POTIONS[id].anytime) return false;
  if (id === 'heal') run.hp = Math.min(run.maxHp, run.hp + Math.floor(run.maxHp * 0.25));
  run.potions[slot] = null;
  return true;
}

/** Pick a relic id of a rarity the player doesn't own yet (falls back to other rarities, then null). */
export function rollRelic(run, rarity, exclude = []) {
  const order = { common: ['common', 'uncommon', 'rare'], uncommon: ['uncommon', 'rare', 'common'], rare: ['rare', 'uncommon', 'common'], boss: ['boss'] }[rarity] || ['common'];
  const shopping = run.shop ? [...run.shop.relics.map((r) => r.id)] : [];
  for (const r of order) {
    const pool = relicPool(r).filter((id) => !run.relics.includes(id) && !exclude.includes(id) && !shopping.includes(id));
    if (pool.length) return pick(run.rng, pool);
  }
  return null;
}

export function giveRelic(run, rarityOrId) {
  const id = RELICS[rarityOrId] ? rarityOrId : rollRelic(run, rarityOrId);
  if (!id) { run.gold += 50; return null; }
  run.relics.push(id);
  RELICS[id].pickup?.(run, run.rng, { givePotion: (r) => givePotion(r), upgradeRandom: (r, n) => upgradeRandom(r, n) });
  return id;
}

// ------------------------------------------------------------------ rewards screen

export function takeGold(run) {
  if (!run.rewards || !run.rewards.gold) return;
  run.gold += run.rewards.gold;
  run.stats.gold += run.rewards.gold;
  run.rewards.gold = 0;
}

export function takePotion(run) {
  if (!run.rewards?.potion || !canGetPotion(run)) return false;
  givePotion(run, run.rewards.potion);
  run.rewards.potion = null;
  return true;
}

export function takeRelic(run, i) {
  const id = run.rewards?.relics[i];
  if (!id) return;
  giveRelic(run, id);
  run.rewards.relics.splice(i, 1);
}

export function takeCard(run, id) {
  if (!run.rewards || run.rewards.cardsTaken || !run.rewards.cards.includes(id)) return;
  addCard(run, id, maybeUpgraded(run));
  run.stats.cards += 1;
  run.rewards.cardsTaken = true;
}

export function skipCards(run) {
  if (run.rewards) run.rewards.cardsTaken = true;
}

// Cards found later in the run are sometimes already upgraded.
function maybeUpgraded(run) {
  const p = (run.act - 1) * 0.12 + (run.loop || 0) * 0.2;
  return p > 0 && chance(run.rng, Math.min(0.6, p));
}

/** Leave the reward screen: back to the map, on to the boss relic, or the end of the run. */
export function leaveRewards(run) {
  const wasBoss = run.rewards?.boss;
  run.rewards = null;
  if (!wasBoss) { run.screen = 'map'; return; }
  if (run.mode === 'normal' && run.act === 3) { run.screen = 'victory'; return; }
  run.bossRelics = sample(run.rng, relicPool('boss').filter((id) => !run.relics.includes(id)), 3);
  if (!run.bossRelics.length) { nextAct(run); return; }
  run.screen = 'bossRelic';
}

export function chooseBossRelic(run, id) {
  if (id && run.bossRelics?.includes(id)) giveRelic(run, id);
  run.bossRelics = null;
  nextAct(run);
}

function nextAct(run) {
  run.act += 1;
  if (run.act > ACTS.length) { run.act = 1; run.loop += 1; }
  run.hp = run.maxHp;
  startAct(run);
}

// ------------------------------------------------------------------ deck edits

export function findCard(run, uid) { return run.deck.find((c) => c.uid === uid); }

export function upgradeCard(run, uid) {
  const c = findCard(run, uid);
  if (!c || !canUpgrade(c)) return false;
  c.up = true;
  return true;
}

export function removeCard(run, uid) {
  const i = run.deck.findIndex((c) => c.uid === uid);
  if (i < 0) return false;
  run.deck.splice(i, 1);
  return true;
}

export function upgradeRandom(run, n) {
  const opts = shuffle(run.rng, run.deck.filter(canUpgrade));
  opts.slice(0, n).forEach((c) => { c.up = true; });
  return Math.min(n, opts.length);
}

export function transformCard(run, uid) {
  const c = findCard(run, uid);
  if (!c) return null;
  const pool = ['common', 'uncommon', 'rare'].flatMap((r) => rewardPool(run.hero, r)).filter((id) => id !== c.id);
  removeCard(run, uid);
  return addCard(run, pick(run.rng, pool));
}

export function duplicateCard(run, uid) {
  const c = findCard(run, uid);
  return c ? addCard(run, c.id, c.up) : null;
}

/** Which deck cards a pick mode applies to. */
export function pickable(run, mode) {
  if (mode === 'upgrade') return run.deck.filter(canUpgrade);
  return run.deck;
}

export function applyPick(run, mode, uid) {
  if (mode === 'upgrade') return upgradeCard(run, uid);
  if (mode === 'remove') return removeCard(run, uid);
  if (mode === 'transform') return !!transformCard(run, uid);
  if (mode === 'duplicate') return !!duplicateCard(run, uid);
  return false;
}

// ------------------------------------------------------------------ rest

export const canRest = (run) => !relicFlag(run, 'noRest');
export const restAmount = (run) => Math.floor(run.maxHp * 0.3);

export function rest(run) {
  if (run.screen !== 'rest' || !canRest(run)) return false;
  run.hp = Math.min(run.maxHp, run.hp + restAmount(run));
  run.screen = 'map';
  return true;
}

export function smith(run, uid) {
  if (run.screen !== 'rest' || !upgradeCard(run, uid)) return false;
  run.screen = 'map';
  return true;
}

// ------------------------------------------------------------------ treasure

export function openTreasure(run) {
  const t = run.treasure;
  if (!t || t.opened) return;
  t.opened = true;
  run.gold += t.gold;
  run.stats.gold += t.gold;
  if (t.relic) giveRelic(run, t.relic);
}

export function leaveRoom(run) {
  run.treasure = null;
  run.shop = null;
  run.event = null;
  run.screen = 'map';
}

// ------------------------------------------------------------------ shop

function price(run, base) { return Math.round(base * (0.92 + next(run.rng) * 0.16)); }
const CARD_PRICE = { common: 50, uncommon: 75, rare: 150 };
const RELIC_PRICE = { common: 150, uncommon: 220, rare: 280 };

export function makeShop(run) {
  const cls = cardChoices(run, 5, 'shop').map((id) => ({ id, price: price(run, CARD_PRICE[CARDS[id].rarity]), sold: false }));
  const sale = int(run.rng, 0, cls.length - 1);
  cls[sale].price = Math.round(cls[sale].price / 2);
  cls[sale].sale = true;
  const neutral = sample(run.rng, NEUTRAL_POOL, 2).map((id) => ({ id, price: price(run, CARD_PRICE[CARDS[id].rarity] * 1.2), sold: false }));
  const shop = { cards: [...cls, ...neutral], relics: [], potions: [], removeUsed: false };
  run.shop = shop; // so rollRelic avoids duplicates
  for (let i = 0; i < 3; i++) {
    const id = rollRelic(run, weighted(run.rng, [['common', 45], ['uncommon', 38], ['rare', 17]]));
    if (id) shop.relics.push({ id, price: price(run, RELIC_PRICE[RELICS[id].rarity]), sold: false });
  }
  if (!relicFlag(run, 'noPotions')) for (let i = 0; i < 3; i++) shop.potions.push({ id: pick(run.rng, POTION_IDS), price: price(run, 55), sold: false });
  return shop;
}

export function buy(run, kind, i) {
  const item = run.shop?.[kind]?.[i];
  if (!item || item.sold || run.gold < item.price) return false;
  if (kind === 'potions' && !canGetPotion(run)) return false;
  run.gold -= item.price;
  item.sold = true;
  if (kind === 'cards') { addCard(run, item.id); run.stats.cards += 1; }
  if (kind === 'relics') giveRelic(run, item.id);
  if (kind === 'potions') givePotion(run, item.id);
  return true;
}

export function shopRemove(run, uid) {
  if (!run.shop || run.shop.removeUsed || run.gold < run.removeCost) return false;
  if (!removeCard(run, uid)) return false;
  run.gold -= run.removeCost;
  run.removeCost += 25;
  run.shop.removeUsed = true;
  return true;
}

// ------------------------------------------------------------------ events

function startEvent(run) {
  // ? rooms are sometimes a surprise fight, shop or treasure, like in the classics.
  const roll = next(run.rng);
  if (roll < 0.1) { startFight(run, pickEncounter(run), 'normal'); return; }
  if (roll < 0.15) { run.shop = makeShop(run); run.screen = 'shop'; return; }
  const ok = EVENT_IDS.filter((id) => EVENTS[id].acts.includes(run.act) && !run.seenEvents.includes(id));
  const pool = ok.length ? ok : EVENT_IDS.filter((id) => EVENTS[id].acts.includes(run.act));
  const id = pick(run.rng, pool);
  run.seenEvents = [...run.seenEvents, id].slice(-8);
  run.event = { id, outcome: null };
  run.screen = 'event';
}

export const eventChoiceCount = (run) => EVENTS[run.event.id].choices.length;

/** Why an event choice can't be taken ('' if it can). */
export function eventChoiceBlocked(run, i) {
  const ch = EVENTS[run.event?.id]?.choices[i];
  if (!ch) return 'Missing';
  return ch.need ? ch.need(run, api(run)) : '';
}

export function eventChoiceDesc(run, i) {
  const ch = EVENTS[run.event.id].choices[i];
  return typeof ch.desc === 'function' ? ch.desc(run) : ch.desc;
}

export function chooseEvent(run, i) {
  const ev = run.event;
  if (!ev || ev.outcome) return null;
  if (eventChoiceBlocked(run, i)) return null;
  const out = EVENTS[ev.id].choices[i].go(run, api(run)) || { text: '' };
  ev.outcome = out;
  if (out.fight) { ev.fight = true; }
  return out;
}

/** After an event: resolve a deck pick, an offered card, or start its fight. */
export function eventPick(run, uid) {
  const out = run.event?.outcome;
  if (!out?.pick || out.done) return false;
  const ok = uid === null ? true : applyPick(run, out.pick.mode, uid);
  if (ok) out.done = true;
  return ok;
}

export function eventTakeOffer(run, id) {
  const out = run.event?.outcome;
  if (!out?.offer || out.done) return;
  if (id && out.offer.includes(id)) { addCard(run, id); run.stats.cards += 1; }
  out.done = true;
}

export function eventContinue(run) {
  const out = run.event?.outcome;
  if (out?.fight) { const f = out.fight; run.event = null; startFight(run, f, 'normal'); return; }
  leaveRoom(run);
}

// ------------------------------------------------------------------ scoring

export function score(run) {
  const won = run.screen === 'victory';
  return run.stats.floors * 10 + run.stats.elites * 25 + run.stats.bosses * 100 + Math.floor(run.stats.gold / 10) + (won ? 500 : 0);
}

export function summary(run) {
  return {
    hero: run.hero, mode: run.mode, won: run.screen === 'victory', floor: run.floor, act: run.act, loop: run.loop,
    score: score(run), deck: run.deck.length, relics: run.relics.length, kills: run.stats.kills,
  };
}

export { cardName };

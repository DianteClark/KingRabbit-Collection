// Campaign progress: heroes (level, XP, gear), gold, owned gear and which map nodes are done.
// Pure functions over a plain object, so the save and the bot use exactly the same rules.
import { HEROES, HERO_IDS, GEAR, MAX_LEVEL, xpToNext, heroStats, heroSkills } from './heroes.js';
import { ENEMIES, REGIONS, SHOP, JOINS, enemyStats, regionNodes, findNode, battleId, battleReward, TOTAL_BATTLES, BATTLES_PER_REGION } from './world.js';
import { makeFighter, newBattle } from './combat.js';
import { makeRng, int, pick } from './rng.js';

export const PROGRESS_VERSION = 1;

const newHero = () => ({ lvl: 1, xp: 0, gear: { weapon: null, armor: null, charm: null } });

export function newProgress() {
  const p = { v: PROGRESS_VERSION, heroes: {}, active: 'knight', gold: 0, owned: [], cleared: {}, region: 0, wins: 0, losses: 0 };
  joinHeroes(p);
  return p;
}

export const regionUnlocked = (p, r) => r === 0 || !!p.cleared[battleId(r - 1, BATTLES_PER_REGION)];

/** Heroes join as regions open. Returns the ids that just joined. */
export function joinHeroes(p) {
  const out = [];
  for (const [r, ids] of Object.entries(JOINS)) {
    if (!regionUnlocked(p, Number(r))) continue;
    for (const id of ids) if (!p.heroes[id]) { p.heroes[id] = newHero(); out.push(id); }
  }
  return out;
}

export const heroIds = (p) => HERO_IDS.filter((id) => p.heroes[id]);

/** 'done', 'open' or 'locked'. */
export function nodeState(p, node) {
  if (p.cleared[node.id]) return 'done';
  const r = node.region ?? Number(node.id.match(/^b(\d)/)?.[1] ?? 0);
  if (!regionUnlocked(p, r)) return 'locked';
  if (node.kind === 'battle' || node.kind === 'boss') {
    return node.k === 1 || p.cleared[battleId(r, node.k - 1)] ? 'open' : 'locked';
  }
  return p.cleared[battleId(r, node.after)] ? 'open' : 'locked';
}

export const nodesOf = (r) => regionNodes(r).map((n) => ({ ...n, region: r }));

/** The next main battle to fight, or null when the campaign is won. */
export function nextBattle(p) {
  for (let r = 0; r < REGIONS.length; r++) {
    for (const n of nodesOf(r)) if ((n.kind === 'battle' || n.kind === 'boss') && nodeState(p, n) === 'open') return n;
  }
  return null;
}

export const mainCleared = (p) => Object.keys(p.cleared).filter((id) => id.startsWith('b')).length;
export const campaignDone = (p) => mainCleared(p) >= TOTAL_BATTLES;
export const questsDone = (p) => REGIONS.every((reg) => reg.quests.every((q) => p.cleared[q.id]));
export const puzzlesDone = (p) => REGIONS.every((reg) => p.cleared[reg.puzzle.id]);

export function gearOf(p, heroId) {
  const g = p.heroes[heroId]?.gear || {};
  return [g.weapon, g.armor, g.charm].filter(Boolean);
}

export const statsOf = (p, heroId) => heroStats(heroId, p.heroes[heroId].lvl, gearOf(p, heroId));

/** A hero ready for battle. opts.hpFrac starts wounded; opts.level overrides (daily). */
export function heroFighter(p, heroId, { hpFrac = 1, level, gear } = {}) {
  const lvl = level ?? p.heroes[heroId].lvl;
  const st = heroStats(heroId, lvl, gear ?? gearOf(p, heroId));
  const h = HEROES[heroId];
  return makeFighter({
    name: h.name, sprite: h.sprite, maxHp: st.maxHp, hp: Math.round(st.maxHp * hpFrac), skull: st.skull, level: lvl,
    skills: heroSkills(heroId, lvl), power: st.power, cap: st.cap, start: st.start, shield: st.shield,
  });
}

export function enemyFighter(id, pos) {
  const e = enemyStats(id, pos);
  return makeFighter({ name: e.name, sprite: e.sprite, maxHp: e.maxHp, skull: e.skull, level: pos, skills: e.skills });
}

/** Build the battle for a campaign node. */
export function campaignBattle(p, nodeId, seed) {
  const node = findNode(nodeId);
  const rules = node.quest?.rules || {};
  const hero = heroFighter(p, p.active, { hpFrac: rules.startHp ?? 1 });
  const enemy = enemyFighter(node.enemy, node.p);
  const st = newBattle({ hero, enemy, seed, rules, goldMult: 1 + statsOf(p, p.active).gold / 100 });
  return { battle: st, ctx: { mode: 'campaign', node: nodeId, hero: p.active } };
}

/** Add XP to a hero. Returns the levels gained. */
export function addXp(p, heroId, xp) {
  const h = p.heroes[heroId];
  let ups = 0;
  h.xp += xp;
  while (h.lvl < MAX_LEVEL && h.xp >= xpToNext(h.lvl)) { h.xp -= xpToNext(h.lvl); h.lvl++; ups++; }
  if (h.lvl >= MAX_LEVEL) h.xp = 0;
  return ups;
}

/**
 * Pay out a finished campaign battle. Returns what happened, for the results screen:
 * { won, xp, gold, levelUps: {heroId: n}, item, joined: [heroIds], firstClear, region }
 */
export function finishCampaignBattle(p, nodeId, battle, heroId) {
  const node = findNode(nodeId);
  const won = battle.over === 'win';
  const first = won && !p.cleared[nodeId];
  const base = battleReward(node.p, { boss: node.kind === 'boss', elite: ENEMIES[node.enemy]?.elite, quest: node.kind === 'quest' });
  // Replays pay less; a loss still pays a little XP so nobody gets stuck.
  const xp = won ? (first ? base.xp : Math.round(base.xp * 0.6)) : Math.round(base.xp * 0.25);
  const gold = battle.gold + (won ? (first ? base.gold : Math.round(base.gold * 0.5)) : 0);
  const levelUps = {};
  levelUps[heroId] = addXp(p, heroId, xp);
  for (const id of heroIds(p)) if (id !== heroId) levelUps[id] = addXp(p, id, Math.round(xp / 2));
  p.gold += gold;
  let item = null;
  if (won) {
    p.wins++;
    if (first) {
      p.cleared[nodeId] = true;
      if (node.quest?.reward && !p.owned.includes(node.quest.reward)) { item = node.quest.reward; p.owned.push(item); }
    }
  } else p.losses++;
  const joined = joinHeroes(p);
  return { won, xp, gold, levelUps, item, joined, firstClear: first, region: node.region, boss: node.kind === 'boss' };
}

/** Shop stock for the regions you have reached. */
export function shopStock(p) {
  const out = [];
  SHOP.forEach((ids, r) => { if (regionUnlocked(p, r)) out.push(...ids); });
  return out;
}

export function buy(p, itemId) {
  const g = GEAR[itemId];
  if (!g || g.quest || p.owned.includes(itemId) || p.gold < g.price) return false;
  p.gold -= g.price;
  p.owned.push(itemId);
  return true;
}

/** Equip (or with null, take off) an owned item. Gear is shared: any hero can wear what you own. */
export function equip(p, heroId, itemId, slot) {
  const h = p.heroes[heroId];
  if (!h) return false;
  if (itemId === null) { h.gear[slot] = null; return true; }
  if (!p.owned.includes(itemId)) return false;
  h.gear[GEAR[itemId].slot] = itemId;
  return true;
}

/** Best owned item per slot for a hero (used by the bot and "Auto equip"). */
export function autoEquip(p, heroId) {
  const score = (id) => {
    const s = GEAR[id].stats;
    return (s.skull || 0) * 12 + (s.hp || 0) * 0.5 + (s.power || 0) * 3 + (s.shield || 0) * 0.6 + (s.cap || 0)
      + (s.start || []).reduce((a, n, c) => a + n * (HEROES[heroId].colors.includes(c) ? 1.5 : 0.3), 0) + (s.gold || 0) * 0.02;
  };
  for (const slot of ['weapon', 'armor', 'charm']) {
    const best = p.owned.filter((id) => GEAR[id].slot === slot).sort((a, b) => score(b) - score(a))[0];
    if (best) p.heroes[heroId].gear[slot] = best;
  }
}

// ------------------------------------------------------------------ endless tower

const TOWER_POOL = Object.keys(ENEMIES).filter((id) => !ENEMIES[id].boss);
const TOWER_BOSSES = Object.keys(ENEMIES).filter((id) => ENEMIES[id].boss);

/** Monster on a tower floor (every 5th floor is a boss). Power climbs past the campaign's. */
export function towerFloor(seed, floor) {
  const r = makeRng((seed ^ Math.imul(floor, 2654435761)) >>> 0);
  const boss = floor % 5 === 0;
  const id = boss ? pick(r, TOWER_BOSSES) : pick(r, TOWER_POOL);
  return { enemy: id, pos: 2 + Math.round(floor * 1.25), boss };
}

export function towerBattle(p, tower) {
  const f = towerFloor(tower.seed, tower.floor);
  const hero = heroFighter(p, tower.hero);
  hero.hp = Math.min(hero.maxHp, tower.hp ?? hero.maxHp);
  const enemy = enemyFighter(f.enemy, f.pos);
  const st = newBattle({ hero, enemy, seed: (tower.seed + tower.floor * 7919) >>> 0, goldMult: 1 + statsOf(p, tower.hero).gold / 100 });
  return { battle: st, ctx: { mode: 'tower', floor: tower.floor, hero: tower.hero } };
}

/** Heal between tower floors: 35% of max HP. */
export const towerHeal = (hp, maxHp) => Math.min(maxHp, hp + Math.round(maxHp * 0.35));

export const towerGold = (floor) => 8 + floor * 3;

// ------------------------------------------------------------------ daily duel

const DAILY_FOES = ['ogre', 'lich', 'drake', 'blackKnight', 'stalker', 'kraken', 'minotaur', 'fireGiant', 'deathKnight', 'stormGiant'];

/** Same duel for everyone on a day: hero, foe and board come from the seed. */
export function dailyBattle(seed) {
  const r = makeRng(seed);
  const heroId = pick(r, Object.keys(HEROES));
  const foe = pick(r, DAILY_FOES);
  const level = 8;
  const hero = heroFighter({ heroes: { [heroId]: { lvl: level, gear: {} } } }, heroId, { level, gear: [] });
  const enemy = enemyFighter(foe, 14);
  const st = newBattle({ hero, enemy, seed: int(r, 1, 2 ** 30) });
  return { battle: st, ctx: { mode: 'daily', hero: heroId } };
}

/** Daily score: a win is worth 1000 + HP left x 10 - turns x 15; a loss scores the damage dealt. */
export function dailyScore(st) {
  if (st.over === 'win') return Math.max(100, 1000 + st.hero.hp * 10 - st.heroTurns * 15);
  return st.stats.dmgDealt;
}

export { findNode, regionNodes };

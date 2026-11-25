// A bot that plays battles, puzzles and the whole campaign (used by the tests to prove the game
// can be finished and to keep the balance honest).
import { makeRng, next } from './rng.js';
import { move, cast } from './combat.js';
import { enemyAct, heroChoice, aiParams, AI_PRESETS } from './ai.js';
import { GEAR } from './heroes.js';
import { REGIONS } from './world.js';
import * as PR from './progress.js';
import { newPuzzle, puzzleMove, solve, PUZZLES } from './puzzle.js';

/** Play a battle to the end. heroP: AI params for the hero; enemySkill 0-1. */
export function playBattle(st, { heroP = AI_PRESETS.normal, enemySkill = 0.5, rand = makeRng(7), maxActions = 600 } = {}) {
  const ep = aiParams(enemySkill);
  for (let n = 0; n < maxActions && !st.over; n++) {
    if (st.turn === 'enemy') { enemyAct(st, ep); continue; }
    const c = heroChoice(st, heroP, rand);
    if (!c) break;
    if (c.type === 'cast') cast(st, 'hero', c.skill); else move(st, 'hero', c.a, c.b);
  }
  return st;
}

/** Spend gold the way a sensible player would: the strongest affordable upgrade first. */
function shop(p) {
  const stock = PR.shopStock(p).filter((id) => !p.owned.includes(id)).sort((a, b) => GEAR[b].price - GEAR[a].price);
  for (const id of stock) if (GEAR[id].price <= p.gold * 0.8) PR.buy(p, id);
}

/**
 * Play the whole campaign. Picks the highest-level hero, buys gear, does side quests and
 * puzzles as they open, and retries lost battles. Returns a summary.
 */
export function playCampaign({ seed = 1, enemySkill = 0.5, heroP = AI_PRESETS.normal, maxBattles = 400, quests = true } = {}) {
  const p = PR.newProgress();
  const rand = makeRng(seed);
  let fights = 0; let losses = 0; const lossesAt = {};
  const hpLeft = [];
  const log = [];
  while (!PR.campaignDone(p) && fights < maxBattles) {
    // Puzzles: solved by search, like a patient player.
    for (const reg of REGIONS) {
      const node = PR.findNode(reg.puzzle.id);
      if (PR.nodeState(p, { ...node }) === 'open') {
        const ps = newPuzzle(reg.puzzle.id);
        for (const m of solve(ps.board, PUZZLES[reg.puzzle.id].moves) || []) puzzleMove(ps, m.a, m.b);
        if (ps.over === 'win') { p.cleared[reg.puzzle.id] = true; p.gold += 100; }
      }
    }
    let node = PR.nextBattle(p);
    if (quests) {
      for (let r = 0; r < REGIONS.length; r++) {
        const q = PR.nodesOf(r).find((n) => n.kind === 'quest' && PR.nodeState(p, n) === 'open');
        if (q) { node = q; break; }
      }
    }
    if (!node) break;
    shop(p);
    const ids = PR.heroIds(p);
    p.active = ids.reduce((best, id) => (p.heroes[id].lvl > p.heroes[best].lvl ? id : best), ids[0]);
    for (const id of ids) PR.autoEquip(p, id);
    const { battle } = PR.campaignBattle(p, node.id, Math.floor(next(rand) * 2 ** 31));
    playBattle(battle, { heroP, enemySkill, rand });
    fights++;
    log.push({ node: node.id, won: battle.over === 'win', hp: +(battle.hero.hp / battle.hero.maxHp).toFixed(2), turns: battle.heroTurns, lvl: p.heroes[p.active].lvl, hero: p.active });
    if (battle.over !== 'win') { losses++; lossesAt[node.id] = (lossesAt[node.id] || 0) + 1; } else hpLeft.push(battle.hero.hp / battle.hero.maxHp);
    PR.finishCampaignBattle(p, node.id, battle, p.active);
  }
  return {
    done: PR.campaignDone(p), fights, log, losses, lossesAt, progress: p,
    levels: Object.fromEntries(PR.heroIds(p).map((id) => [id, p.heroes[id].lvl])),
    avgHpLeft: hpLeft.reduce((a, b) => a + b, 0) / Math.max(1, hpLeft.length),
  };
}

// Computer player for the adventure map. aiTurn() is a generator so the game can pause it:
//   yield { type: 'move', heroId, steps }   -> caller may animate, then calls next()
//   yield { type: 'battle', setup }         -> a fight against the human: caller plays it and calls next(result)
//   yield { type: 'news', msg }
// Fights that don't involve the human are resolved instantly with the tactical AI.
import { CREATURES, FACTIONS, BUILDINGS, BOOSTS, MINES, armyValue, creatureValue } from './data.js';
import {
  heroesOf, townsOf, heroPaths, findPath, planMove, applySteps, battleSetup, makeBattle, applyBattle, visit,
  takeChest, recruitDwelling, recruit, build, buildStatus, canHire, hireHero, visitingHero, heroArmyValue,
  autoLevelUps, getHero, getObj, idx, armyCount, addToArmy, canAdd, defenderOwner, rngOf, maxAffordable, heroMaxMana,
  heroMaxMp, setupValues, checkOver, guardAt, townDefBonus,
} from './game.js';
import { autoResolve, TACTIC_PRESETS } from './combat.js';
import { tune } from '../adaptive.js';

/** Strategy presets blended by adaptive skill (0 easy .. 1 hard). */
export const STRATEGY_PRESETS = {
  easy: { attackRatio: 0.9, monsterRatio: 1.0, greed: 0.7, noise: 0.5, maxHeroes: 1, buildSmart: 0, defend: 0, aggression: 0.6 },
  normal: { attackRatio: 1.3, monsterRatio: 1.5, greed: 1, noise: 0.2, maxHeroes: 2, buildSmart: 0.7, defend: 0.6, aggression: 1 },
  hard: { attackRatio: 1.2, monsterRatio: 1.7, greed: 1.2, noise: 0, maxHeroes: 3, buildSmart: 1, defend: 1, aggression: 1.3 },
};

export function aiParams(skill) {
  return {
    ...tune(STRATEGY_PRESETS, skill, ['maxHeroes']),
    tactics: tune(TACTIC_PRESETS, skill),
  };
}

const SMART_BUILD = ['dw1', 'dw2', 'hall2', 'guild1', 'dw3', 'fort', 'dw4', 'tavern', 'market', 'hall3', 'dw5', 'guild2', 'guild3'];

function aiBuild(state, town, p, rng) {
  if (town.builtToday) return null;
  let order = SMART_BUILD;
  if (rng() > p.buildSmart) order = rng.shuffle([...SMART_BUILD]);
  for (const id of order) {
    const st = buildStatus(state, town, id);
    if (st.ok) { build(state, town, id); return id; }
    // A smart builder saves up for the next thing on its list instead of skipping ahead.
    if (p.buildSmart > 0.5 && st.reason === 'Cost' && rng() < p.buildSmart) return null;
  }
  return null;
}

/** Buy every creature we can afford into the garrison, then let a hero in town take what it can
 *  carry while leaving a fifth of the strength behind to hold the town. */
function aiRecruit(state, town, threatened = false) {
  for (let t = 5; t >= 0; t--) {
    if (!town.built[`dw${t}`] || town.stock[t] <= 0) continue;
    recruit(state, town, t, town.stock[t], 'garrison');
  }
  const vh = visitingHero(state, town);
  if (!vh || threatened) return;
  const g = town.garrison;
  const order = g.map((st, i) => ({ st, i })).filter((x) => x.st).sort((a, b) => creatureValue(b.st.type) - creatureValue(a.st.type));
  for (const { st, i } of order) if (canAdd(vh.army, st.type)) { addToArmy(vh.army, st.type, st.count); g[i] = null; }
  const total = armyValue(vh.army) + armyValue(g);
  const keep = state.day < 15 ? 0.35 : 0.2;
  for (let n = 0; n < 2 && armyValue(g) < total * keep && armyCount(vh.army) > 1; n++) {
    // Leave the weakest stack behind.
    let wi = -1;
    vh.army.forEach((st, i) => { if (st && (wi < 0 || armyValue([st]) < armyValue([vh.army[wi]]))) wi = i; });
    if (wi >= 0 && canAdd(g, vh.army[wi].type)) { addToArmy(g, vh.army[wi].type, vh.army[wi].count); vh.army[wi] = null; }
  }
}

function townDefense(state, town) {
  const vh = visitingHero(state, town);
  return (armyValue(town.garrison) + (vh ? heroArmyValue(vh) : 0)) * (1 + 0.05 * townDefBonus(town));
}

function pileValue(o) {
  if (o.res === 'gold') return o.amount;
  return o.amount * (o.res === 'gems' ? 300 : 120);
}

/** Score every interesting tile for this hero. Returns the best { x, y, score, kind }. */
function chooseTarget(state, hero, paths, p, rng, pid, main) {
  const hv = heroArmyValue(hero);
  const res = state.players[pid].res;
  const { dist } = paths.res;
  let best = null;
  const consider = (x, y, value, kind) => {
    if (value <= 0) return;
    const d = dist[idx(state, x, y)];
    if (!Number.isFinite(d) || d === 0) return;
    // Don't walk into a monster's ambush we can't beat.
    if (kind !== 'monster') {
      const g = guardAt(state, x, y);
      if (g && hv < armyValue([{ type: g.type, count: g.count }]) * p.monsterRatio) return;
    }
    let score = value / (d + 30);
    score *= 1 + p.noise * (rng() * 2 - 1);
    if (!best || score > best.score) best = { x, y, score, kind };
  };
  for (const o of state.objects) {
    switch (o.kind) {
      case 'pile': consider(o.x, o.y, pileValue(o) * p.greed, 'pile'); break;
      case 'campfire': consider(o.x, o.y, 900 * p.greed, 'campfire'); break;
      case 'chest': consider(o.x, o.y, 1500 * p.greed, 'chest'); break;
      case 'artifact': consider(o.x, o.y, 2500, 'artifact'); break;
      case 'mine': if (o.owner !== pid) consider(o.x, o.y, (o.res === 'gold' ? 5000 : 2500) * (o.owner !== null ? 1.3 : 1), 'mine'); break;
      case 'boost': {
        const b = BOOSTS[o.boost];
        if (o.visited.includes(hero.id)) break;
        let v = 0;
        if (b.atk || b.def || b.pow || b.know) v = 2000;
        if (b.level) v = 3000;
        if (b.exp) v = 1500;
        if (b.mana && hero.spells.length && hero.mana < heroMaxMana(hero) / 2) v = 500;
        if (b.spell && !hero.spells.includes(o.spell)) v = 1500;
        if (b.move) v = 200;
        consider(o.x, o.y, v, 'boost');
        break;
      }
      case 'dwelling': {
        const c = CREATURES[o.creature];
        const n = Math.min(o.stock, maxAffordable(res, c.cost));
        if (n > 0 && canAdd(hero.army, o.creature)) consider(o.x, o.y, n * c.cost.gold * 0.6, 'dwelling');
        break;
      }
      case 'monster': {
        const mv = armyValue([{ type: o.type, count: o.count }]);
        if (hv >= mv * p.monsterRatio) consider(o.x, o.y, 700 + mv * 10, 'monster');
        break;
      }
      case 'town': {
        if (o.owner === pid) {
          // Come home to pick up recruits.
          const vh = visitingHero(state, o);
          if (vh && vh.id !== hero.id) break;
          // Troops waiting in the garrison beyond what should stay to guard it.
          const v = armyValue(o.garrison) - (hv + armyValue(o.garrison)) * (state.day < 15 ? 0.35 : 0.2);
          if (v > Math.max(150, hv * 0.2)) consider(o.x, o.y, v * 15 * (main ? 1 : 0.3), 'home');
        } else {
          // Some scenarios give the human a quiet first stretch before the computer comes for them.
          if (o.owner !== null && state.players[o.owner].human && state.day <= (state.grace || 0)) break;
          const dv = townDefense(state, o);
          // Early on, only an overwhelming army goes for a town.
          const early = state.day < 8 ? 2.5 : state.day < 15 ? 1.4 : 1;
          if (hv >= dv * p.attackRatio * early) consider(o.x, o.y, (o.owner === null ? 9000 : 16000) * p.aggression, 'town');
        }
        break;
      }
      default: break;
    }
  }
  const pl = state.players[pid];
  if (pl.human) {
    // A computer standing in for the human (simulations) has fog of war: explore its edge.
    const { w, h } = state;
    for (let y = 1; y < h - 1; y += 2) {
      for (let x = 1; x < w - 1; x += 2) {
        if (!pl.explored[y * w + x]) continue;
        let hidden = 0;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          const xx = x + dx; const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < w && yy < h && !pl.explored[yy * w + xx]) hidden++;
        }
        if (hidden) consider(x, y, 60 * hidden, 'explore');
      }
    }
  }
  for (const e of state.heroes) {
    if (e.owner === pid) continue;
    // A hero standing in its town is attacked as part of the town (handled above).
    if (state.objects.some((o) => o.kind === 'town' && o.x === e.x && o.y === e.y)) continue;
    if (state.players[e.owner].human && state.day <= (state.grace || 0)) continue;
    const ev = heroArmyValue(e);
    if (hv >= ev * p.attackRatio) consider(e.x, e.y, (5000 + ev * 10) * p.aggression, 'hero');
  }
  return best;
}

/** Is one of our towns threatened by a strong enemy hero nearby? Returns the town or null. */
function threatenedTown(state, pid) {
  for (const t of townsOf(state, pid)) {
    for (const e of state.heroes) {
      if (e.owner === pid) continue;
      const d = Math.max(Math.abs(e.x - t.x), Math.abs(e.y - t.y));
      if (d <= 12 && heroArmyValue(e) > townDefense(state, t) * 0.8) return { town: t, enemy: e };
    }
  }
  return null;
}

function involvesHuman(state, setup) {
  const a = getHero(state, setup.attacker);
  if (state.players[a.owner].human) return true;
  const d = defenderOwner(state, setup);
  return d !== null && state.players[d].human;
}

/** Run a fight. Yields to the caller when the human is involved. Returns applyBattle's summary. */
export function* fight(state, hero, trigger, tactics) {
  let trig = trigger;
  let last = null;
  while (trig) {
    const setup = battleSetup(state, hero, trig);
    if (!setup) break;
    if (setup.kind === 'capture') {
      last = applyBattle(state, setup, { winner: 0, sides: [{ survivors: [], killedHp: 0, killedLiving: 0, mana: hero.mana }, { survivors: [], killedHp: 0, killedLiving: 0, mana: 0 }] });
      yield { type: 'news', msg: last.msgs.join('. ') };
      break;
    }
    let res;
    if (involvesHuman(state, setup)) {
      res = yield { type: 'battle', setup };
    } else {
      const b = makeBattle(state, setup);
      const dOwner = defenderOwner(state, setup);
      res = autoResolve(b, tactics, dOwner === null ? TACTIC_PRESETS.normal : tactics);
    }
    last = applyBattle(state, setup, res);
    if (!getHero(state, hero.id)) break;
    autoLevelUps(state, hero);
    trig = last.won ? last.next : null;
  }
  return last;
}

function* aiVisit(state, hero, obj, tactics) {
  const r = visit(state, hero, obj);
  if (r.choice?.kind === 'chest') takeChest(state, hero, obj, state.players[hero.owner].res.gold < 6000 ? 'gold' : 'exp');
  if (r.choice?.kind === 'dwelling') recruitDwelling(state, hero, obj, 999);
  if (obj.kind === 'town' && obj.owner === hero.owner) aiRecruit(state, obj);
  autoLevelUps(state, hero);
  void tactics;
  if (r.msg) yield { type: 'visit', heroId: hero.id, msg: r.msg, objId: obj.id };
}

/** One AI player's whole day. */
export function* aiTurn(state, pid, params) {
  const p = params;
  const rng = rngOf(state);
  const pl = state.players[pid];
  // Towns: build, hire, recruit.
  const danger = threatenedTown(state, pid);
  for (const town of townsOf(state, pid)) {
    const wantHeroes = Math.max(1, Math.round(p.maxHeroes));
    // Without any hero, hiring one comes before building.
    if (!heroesOf(state, pid).length && canHire(state, town).ok) {
      const h = hireHero(state, town);
      if (h) yield { type: 'news', msg: `${h.name} joins the enemy` };
    }
    aiBuild(state, town, p, rng);
    if (canHire(state, town).ok && heroesOf(state, pid).length < wantHeroes && pl.res.gold >= 4000) {
      const h = hireHero(state, town);
      if (h) yield { type: 'news', msg: `${h.name} joins the enemy` };
    }
    aiRecruit(state, town, danger?.town === town || !heroesOf(state, pid).length);
  }
  // Heroes, strongest first.
  const heroes = heroesOf(state, pid).sort((a, b) => heroArmyValue(b) - heroArmyValue(a));
  for (const hero0 of heroes) {
    let hero = getHero(state, hero0.id);
    if (!hero || state.over) continue;
    for (let action = 0; action < 10 && hero && hero.mp > 0 && !state.over; action++) {
      const paths = heroPaths(state, hero);
      const threat = rng() < p.defend ? threatenedTown(state, pid) : null;
      let target = null;
      // Defend a threatened town with the main army if we can't beat the attacker.
      if (threat && hero.id === heroes[0].id && getHero(state, threat.enemy.id)) {
        const ev = heroArmyValue(threat.enemy);
        if (ev * p.attackRatio > heroArmyValue(hero)) {
          // Too strong to fight in the field: hold the town (its garrison fights alongside).
          if (hero.x === threat.town.x && hero.y === threat.town.y) { aiRecruit(state, threat.town, true); break; }
          target = { x: threat.town.x, y: threat.town.y, kind: 'defend' };
        } else if (Number.isFinite(paths.res.dist[idx(state, threat.enemy.x, threat.enemy.y)])) {
          target = { x: threat.enemy.x, y: threat.enemy.y, kind: 'intercept' };
        }
      }
      if (!target) target = chooseTarget(state, hero, paths, p, rng, pid, hero.id === heroes[0].id);
      if (!target) break;
      const path = findPath(state, hero, target.x, target.y, paths);
      if (!path) break;
      const plan = planMove(state, hero, path);
      if (!plan.steps.length && !plan.trigger) break;
      if (plan.steps.length) {
        yield { type: 'move', heroId: hero.id, steps: plan.steps };
        applySteps(state, hero, plan.steps);
      }
      const trig = plan.trigger;
      if (trig) {
        if (trig.type === 'visit') {
          const obj = getObj(state, trig.objId);
          if (obj) yield* aiVisit(state, hero, obj, p.tactics);
        } else {
          const r = yield* fight(state, hero, trig, p.tactics);
          if (r && r.msgs.length) yield { type: 'news', msg: r.msgs[r.msgs.length - 1] };
          const after = getHero(state, hero.id) && r?.won && trig.then ? getObj(state, trig.then) : null;
          if (after) yield* aiVisit(state, hero, after, p.tactics);
        }
      } else if (plan.steps.length < path.length) break; // out of movement for today
      hero = getHero(state, hero.id);
      checkOver(state);
    }
    // A hero ending the day in a town recruits there.
    if (hero) {
      const town = townsOf(state, pid).find((t) => t.x === hero.x && t.y === hero.y);
      if (town) aiRecruit(state, town);
    }
  }
  void heroMaxMp; void armyCount; void BUILDINGS; void MINES; void setupValues;
}

/**
 * Drive a generator to completion, answering battles against the human with a stand-in AI
 * (used by tests and AI-vs-AI simulations).
 */
export function runAuto(gen, state, humanTactics = TACTIC_PRESETS.normal, aiTactics = TACTIC_PRESETS.normal) {
  let r = gen.next();
  while (!r.done) {
    const ev = r.value;
    if (ev.type === 'battle') {
      const b = makeBattle(state, ev.setup);
      const humanAttacks = state.players[getHero(state, ev.setup.attacker).owner].human;
      const res = autoResolve(b, humanAttacks ? humanTactics : aiTactics, humanAttacks ? aiTactics : humanTactics);
      r = gen.next(res);
    } else r = gen.next();
  }
  return r.value;
}

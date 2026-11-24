// A simple bot that plays whole runs. Used by the balance tests (and handy for debugging).
// In fights it tries every playable card on a copy of the fight and keeps the play that
// improves a rough "how good is this position" score the most.

import { CARDS, canUpgrade } from './cards.js';
import { ENEMIES } from './enemies.js';
import { POTIONS } from './potions.js';
import { Combat } from './combat.js';
import * as R from './run.js';

const clone = (o) => JSON.parse(JSON.stringify(o));

const POWER_VALUE = { warlord: 14, noxious: 9, pyro: 7, wildfire: 10, archmage: 18, eagle: 9, envenom: 8, bulwark: 8, thorns: 2.5, plate: 4.5 };

/** Rough value of a fight position for the player (higher is better). */
export function evaluate(c) {
  const s = c.s;
  if (s.over === 'win') return 1e6 + s.player.hp * 10;
  if (s.over === 'lose') return -1e6;
  const p = s.player;
  if (!c.livingEnemies) return 0;
  let incoming = 0;
  let enemyHp = 0;
  let v = 0;
  for (const e of c.livingEnemies()) {
    const it = c.intent(e);
    if (it?.dmg !== undefined) incoming += it.dmg * it.times;
    const threat = 1 + ((it?.dmg || 0) * (it?.times || 1)) / 25 + Math.max(0, e.st.str || 0) / 6 + (e.st.ritual || 0) / 2;
    enemyHp += (e.hp + e.block * 0.5) * threat;
    const poison = e.st.poison || 0;
    v += Math.min((poison * (poison + 1)) / 2, e.hp) * 0.7;
    v += (e.st.vuln || 0) * 2.5 + Math.min(e.st.weak || 0, 3) * (it?.dmg !== undefined ? 2.5 : 1);
    v -= Math.max(0, e.st.str || 0) * 3;
  }
  const unblocked = Math.max(0, incoming - p.block);
  v -= unblocked * 1.4;
  v -= enemyHp * 1.0;
  v += p.hp * 1.5;
  v += (p.st.str || 0) * 6 + (p.st.dex || 0) * 4.5 + (p.st.nextBlock || 0) * 0.8;
  for (const [k, w] of Object.entries(POWER_VALUE)) v += (p.st[k] || 0) * w;
  v -= (p.st.weak || 0) * 1.5 + (p.st.frail || 0) * 1.5 + (p.st.vuln || 0) * 2;
  v += s.energy * 1.2;
  v += s.hand.filter((h) => !CARDS[h.id].flags.unplayable).length * 1.5;
  return v;
}

function copyCombat(c) {
  const r2 = clone(c.run);
  const s2 = clone(c.s);
  r2.combat = s2;
  return new Combat(r2, s2);
}

/** Every distinct (card, target) play available right now. */
function options(c) {
  const out = [];
  const seen = new Set();
  for (const card of c.s.hand) {
    if (c.whyNot(card)) continue;
    const sig = `${card.id}:${card.up}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    const targets = c.needsTarget(card) ? c.livingEnemies().map((e) => e.uid) : [undefined];
    for (const t of targets) out.push({ uid: card.uid, target: t });
  }
  return out;
}

/**
 * Plan a whole turn with a small beam search over card sequences (the copy of the fight uses the
 * same shuffled deck, so the plan can be played back exactly). Returns a list of plays.
 */
export function planTurn(c, { width = 5, depth = 8 } = {}) {
  let beam = [{ c, plays: [], score: evaluate(c) }];
  let best = beam[0];
  for (let d = 0; d < depth; d++) {
    const nextBeam = [];
    for (const node of beam) {
      if (node.c.s.over) continue;
      for (const o of options(node.c)) {
        const c2 = copyCombat(node.c);
        if (!c2.playCard(o.uid, o.target)) continue;
        c2.takeEvents();
        nextBeam.push({ c: c2, plays: [...node.plays, o], score: evaluate(c2) });
      }
    }
    if (!nextBeam.length) break;
    nextBeam.sort((a, b) => b.score - a.score);
    beam = nextBeam.slice(0, width);
    if (beam[0].score > best.score + 0.01) best = beam[0];
  }
  return best.plays;
}

/** The best single action right now (first step of the turn plan), or null to end the turn. */
export function bestPlay(c) {
  return planTurn(c)[0] || null;
}

function usePotions(c) {
  const run = c.run;
  const big = c.s.kind !== 'normal';
  run.potions.forEach((id, slot) => {
    if (!id || c.s.over) return;
    const d = POTIONS[id];
    const low = c.p.hp < c.p.maxHp * 0.35;
    if (id === 'heal' ? low : (big && c.s.turn === 1) || low) {
      const target = d.target === 'enemy' ? c.livingEnemies().sort((a, b) => b.hp - a.hp)[0]?.uid : undefined;
      c.usePotion(slot, target);
    }
  });
}

/** Play out a whole fight. Returns 'win' or 'lose'. */
export function playFight(run, maxTurns = 60) {
  const c = new Combat(run, run.combat);
  while (!c.s.over && c.s.turn <= maxTurns) {
    usePotions(c);
    for (const play of planTurn(c)) {
      if (c.s.over || !c.playCard(play.uid, play.target)) break;
    }
    c.takeEvents();
    if (!c.s.over) c.endTurn();
  }
  if (!c.s.over) { c.s.over = 'lose'; }
  return c.s.over;
}

// ---------------------------------------------------------------- run decisions

function cardValue(run, id) {
  const d = CARDS[id];
  let v = { common: 3, uncommon: 4.2, rare: 5.5 }[d.rarity] ?? 1;
  const have = run.deck.filter((c) => c.id === id).length;
  if (d.type === 'power') v += have ? -2 : 1;
  if (d.type === 'attack' && run.act === 1) v += 0.5;
  v -= have * 0.7;
  return v;
}

function upgradeValue(c) {
  const d = CARDS[c.id];
  let v = { starter: 1, common: 2, uncommon: 3, rare: 4 }[d.rarity] ?? 0;
  if (c.id === 'bash' || c.id === 'venomArrow' || c.id === 'spark') v += 2.5;
  if (d.type === 'power') v += 1;
  return v;
}

function bestUpgrade(run) {
  return run.deck.filter(canUpgrade).sort((a, b) => upgradeValue(b) - upgradeValue(a))[0];
}

function worstCard(run) {
  const order = (c) => {
    const d = CARDS[c.id];
    if (d.type === 'curse') return 0;
    if (c.id === 'strike') return 1 + (c.up ? 0.5 : 0);
    if (c.id === 'defend') return 2 + (c.up ? 0.5 : 0);
    return 10;
  };
  return [...run.deck].sort((a, b) => order(a) - order(b))[0];
}

function chooseNode(run) {
  const opts = R.availableNodes(run).map((id) => run.map.nodes[id]);
  const hpPct = run.hp / run.maxHp;
  const score = (n) => {
    switch (n.type) {
      case 'elite': return hpPct > 0.75 && run.deck.length >= 12 ? 3 : -2;
      case 'rest': return hpPct < 0.5 ? 5 : 1;
      case 'shop': return run.gold >= 140 ? 3.5 : 0.5;
      case 'treasure': return 6;
      case 'event': return 2;
      case 'fight': return hpPct > 0.4 ? 2.5 : 1;
      default: return 1;
    }
  };
  // Look one step ahead so the bot heads for good rooms.
  const look = (n) => score(n) + 0.5 * Math.max(0, ...n.next.map((id) => score(run.map.nodes[id])));
  opts.sort((a, b) => look(b) - look(a));
  return opts[0];
}

/** Play a complete run with the bot. Returns the run summary. */
export function playRun({ hero, mode = 'normal', seed, maxFloors = 200, log = null }) {
  const run = R.newRun({ hero, mode, seed });
  let fights = 0;
  for (let step = 0; step < 4000; step++) {
    if (run.floor > maxFloors) break;
    switch (run.screen) {
      case 'map': R.travel(run, chooseNode(run).id); break;
      case 'combat': {
        const before = run.hp;
        const kind = run.combatKind; const foes = run.combat.enemies.map((e) => e.id).join('+');
        playFight(run);
        fights++;
        log?.(`F${run.floor} A${run.act} ${kind} ${foes}: ${before} -> ${run.combat.player.hp}/${run.maxHp} ${run.combat.over} t${run.combat.turn} deck ${run.deck.length} relics ${run.relics.length}`);
        R.finishCombat(run);
        break;
      }
      case 'reward': {
        R.takeGold(run);
        R.takePotion(run);
        while (run.rewards.relics.length) R.takeRelic(run, 0);
        const best = [...run.rewards.cards].sort((a, b) => cardValue(run, b) - cardValue(run, a))[0];
        if (best && (run.deck.length < 22 || cardValue(run, best) >= 4.5)) R.takeCard(run, best);
        else R.skipCards(run);
        R.leaveRewards(run);
        break;
      }
      case 'rest': {
        if (run.hp < run.maxHp * 0.55 && R.canRest(run)) R.rest(run);
        else { const c = bestUpgrade(run); if (c) R.smith(run, c.uid); else if (R.canRest(run)) R.rest(run); else run.screen = 'map'; }
        break;
      }
      case 'shop': {
        if (run.gold >= run.removeCost) R.shopRemove(run, worstCard(run).uid);
        run.shop.relics.forEach((r, i) => { if (run.gold >= r.price) R.buy(run, 'relics', i); });
        const cards = run.shop.cards.map((c, i) => [c, i]).filter(([c]) => !c.sold).sort((a, b) => cardValue(run, b[0].id) - cardValue(run, a[0].id));
        if (cards[0] && run.gold >= cards[0][0].price && cardValue(run, cards[0][0].id) >= 4) R.buy(run, 'cards', cards[0][1]);
        R.leaveRoom(run);
        break;
      }
      case 'treasure': R.openTreasure(run); R.leaveRoom(run); break;
      case 'event': {
        const ev = run.event;
        const n = R.eventChoiceCount(run);
        let choice = 0;
        const risky = /Lose \d+ HP|Lose \d+ Max|Fight|Bet/.test(R.eventChoiceDesc(run, 0));
        if (risky && run.hp < run.maxHp * 0.5) choice = n - 1;
        while (choice < n && R.eventChoiceBlocked(run, choice)) choice++;
        if (choice >= n) choice = n - 1;
        const out = R.chooseEvent(run, choice) || {};
        if (out.pick) {
          const mode = out.pick.mode;
          const target = mode === 'upgrade' ? bestUpgrade(run) : mode === 'duplicate' ? [...run.deck].sort((a, b) => upgradeValue(b) - upgradeValue(a))[0] : worstCard(run);
          R.eventPick(run, target ? target.uid : null);
        }
        if (out.offer) R.eventTakeOffer(run, [...out.offer].sort((a, b) => cardValue(run, b) - cardValue(run, a))[0]);
        if (ev) R.eventContinue(run);
        break;
      }
      case 'bossRelic': R.chooseBossRelic(run, run.bossRelics[0]); break;
      case 'dead': case 'victory': return { ...R.summary(run), fights, hpLeft: run.hp };
      default: throw new Error(`bot: unknown screen ${run.screen}`);
    }
  }
  return { ...R.summary(run), fights, hpLeft: run.hp, stopped: true };
}

export { ENEMIES };

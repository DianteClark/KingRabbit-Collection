// Turn-based card combat. Pure logic: no Phaser. All state lives in a plain JSON object (s) so a
// fight can be saved after every action and resumed exactly.
//
// The UI calls: playCard(uid, targetUid), usePotion(slot, targetUid), endTurn(), takeEvents().
// Events describe what happened (hits, blocks, statuses, deaths...) so the UI can animate them.

import { CARDS, values, costOf, flagsOf, canUpgrade } from './cards.js';
import { ENEMIES, val } from './enemies.js';
import { RELICS } from './relics.js';
import { POTIONS } from './potions.js';
import { STATUSES } from './statuses.js';
import { next, shuffle, makeRng } from './rng.js';

export const HAND_LIMIT = 10;
export const BASE_ENERGY = 3;
export const BASE_DRAW = 5;
const MAX_ENEMIES = 4;

/** Enemy scaling for the act / Endless loop. */
export function scaling(run) {
  const loop = run.loop || 0;
  const easy = run.mode === 'endless' ? 0.95 : 1;
  return { hp: easy * (1 + loop), dmg: easy * (1 + 0.45 * loop) };
}

function makeEnemy(s, run, id, rng) {
  const d = ENEMIES[id];
  const sc = scaling(run);
  const base = d.hp[0] + Math.floor(next(rng) * (d.hp[1] - d.hp[0] + 1));
  const hp = Math.max(1, Math.round(base * sc.hp));
  const e = { uid: s.uidNext++, id, hp, maxHp: hp, block: 0, st: { ...(d.start || {}) }, mem: {}, turn: 0, hist: [], move: null, dead: false };
  // Endless loops: every enemy starts stronger, elites and bosses even more, and they keep growing
  // (Ritual), so long, slow fights with a bloated deck get dangerous.
  const loop = run.loop || 0;
  if (loop) {
    e.st.str = (e.st.str || 0) + loop * ((d.boss || d.elite) ? 2 : 1);
    e.st.ritual = (e.st.ritual || 0) + loop;
    if (d.boss || d.elite) e.st.artifact = (e.st.artifact || 0) + loop;
  }
  d.init?.(e, { rng: () => next(rng) });
  return e;
}

/** Build a new fight. kind: 'normal' | 'elite' | 'boss'. */
export function createCombat(run, enemyIds, kind = 'normal', seed) {
  const rng = makeRng(seed ?? Math.floor(next(run.rng) * 2 ** 31));
  const s = {
    kind, turn: 0, energy: 0, over: null, uidNext: 1000,
    player: { hp: run.hp, maxHp: run.maxHp, block: 0, st: {} },
    enemies: [], draw: [], hand: [], discard: [], exhaust: [],
    rng, counters: { attacks: 0, skills: 0, cards: 0 }, bonusDraw: 0, doubleNext: false,
    stats: { dealt: 0, taken: 0 },
    log: [],
  };
  s.enemies = enemyIds.map((id) => makeEnemy(s, run, id, rng));
  const cards = run.deck.map((c) => ({ uid: c.uid, id: c.id, up: !!c.up }));
  shuffle(rng, cards);
  // Innate cards go on top (none in the base set, but keep the rule).
  s.draw = cards;
  const c = new Combat(run, s);
  for (const r of run.relics) RELICS[r]?.combatStart?.(c);
  for (const e of s.enemies) c.chooseIntent(e);
  c.startTurn();
  return s;
}

export class Combat {
  constructor(run, s) {
    this.run = run;
    this.s = s;
  }

  // ---------- small helpers ----------
  get p() { return this.s.player; }
  emit(ev) { this.s.log.push(ev); }
  takeEvents() { const l = this.s.log; this.s.log = []; return l; }
  rnd() { return next(this.s.rng); }
  livingEnemies() { return this.s.enemies.filter((e) => !e.dead); }
  enemyByUid(uid) { return this.s.enemies.find((e) => e.uid === uid && !e.dead); }
  relic(flag) { return this.run.relics.some((r) => RELICS[r]?.[flag]); }
  relicSum(flag) { return this.run.relics.reduce((t, r) => t + (RELICS[r]?.[flag] || 0), 0); }
  counter(id) { return this.run.relicData?.[id] || 0; }
  setCounter(id, n) { this.run.relicData = { ...(this.run.relicData || {}), [id]: n }; }
  attacksThisTurn() { return this.s.counters.attacks; }
  skillsThisTurn() { return this.s.counters.skills; }
  setDoubleNext() { this.s.doubleNext = true; }
  addBonusDraw(n) { this.s.bonusDraw += n; }
  playerBlock() { return this.p.block; }
  playerStatus(st) { return this.p.st[st] || 0; }
  enemyStatus(e, st) { return e?.st?.[st] || 0; }
  maxEnergy() { return BASE_ENERGY + this.relicSum('energy'); }
  syncRun() { this.run.hp = this.p.hp; this.run.maxHp = this.p.maxHp; }

  // ---------- numbers ----------
  /** Damage of one player attack hit on enemy e (e may be null for a preview). */
  attackDamage(base, e, strMult = 1) {
    let d = base + (this.p.st.str || 0) * strMult;
    if (this.p.st.weak) d *= 0.75;
    if (e && e.st.vuln) d *= 1.5;
    if (this.s.doubleNext) d *= 2;
    return Math.max(0, Math.floor(d));
  }

  blockAmount(base) {
    let b = base + (this.p.st.dex || 0);
    if (this.p.st.frail) b *= 0.75;
    return Math.max(0, Math.floor(b));
  }

  /** Damage of one hit of an enemy move on the player. */
  enemyHit(e, base) {
    let d = base * scaling(this.run).dmg + (e.st.str || 0);
    if (e.st.weak) d *= 0.75;
    if (this.p.st.vuln) d *= 1.5;
    return Math.max(0, Math.floor(d));
  }

  /** What an enemy is about to do: { kind, dmg, times, block, move, name, extra[] }. */
  intent(e) {
    const d = ENEMIES[e.id];
    const m = d.moves[e.move];
    if (!m) return null;
    const out = { name: m.name, move: e.move, kinds: [] };
    if (m.dmg !== undefined) {
      out.dmg = this.enemyHit(e, val(m.dmg, e));
      out.times = val(m.times, e) || 1;
      out.kinds.push('attack');
    }
    if (m.block || m.blockAllies) { out.block = m.block || m.blockAllies; out.kinds.push('defend'); }
    if (m.buff || m.heal) out.kinds.push('buff');
    if (m.debuff || m.add) out.kinds.push('debuff');
    if (m.summon) out.kinds.push('summon');
    out.kind = out.kinds[0] || 'unknown';
    return out;
  }

  /** Plain-words description of an intent, for the info popup. */
  intentText(e) {
    const d = ENEMIES[e.id];
    const m = d.moves[e.move];
    const it = this.intent(e);
    if (!m || !it) return '';
    const parts = [];
    if (it.dmg !== undefined) parts.push(it.times > 1 ? `attack for ${it.dmg} x${it.times}` : `attack for ${it.dmg}`);
    if (m.drain) parts.push('heal from the damage');
    if (m.block) parts.push(`gain ${m.block} Block`);
    if (m.blockAllies) parts.push(`give all allies ${m.blockAllies} Block`);
    if (m.buff) parts.push(Object.entries(m.buff).map(([k, n]) => `gain ${n} ${STATUSES[k]?.name ?? k}`).join(', '));
    if (m.debuff) parts.push(`give you ${Object.entries(m.debuff).map(([k, n]) => `${n} ${STATUSES[k]?.name ?? k}`).join(' and ')}`);
    if (m.add) parts.push(`add ${m.add[1]} ${CARDS[m.add[0]].name} to your ${m.add[2] === 'draw' ? 'draw pile' : 'discard pile'}`);
    if (m.summon) parts.push(`summon a ${ENEMIES[m.summon].name}`);
    return `${m.name}: will ${parts.join(', then ')}.`;
  }

  chooseIntent(e) {
    const d = ENEMIES[e.id];
    const key = d.ai(e, { rng: () => this.rnd(), allies: this.livingEnemies().length, c: this });
    e.move = key;
    e.hist.push(key);
    if (e.hist.length > 6) e.hist.shift();
    e.turn++;
  }

  // ---------- effects used by cards, relics and potions ----------
  attack(e, base, times = 1, { strMult = 1, pierce = false } = {}) {
    for (let i = 0; i < times; i++) {
      if (e && e.dead) return;
      const t = e || this.livingEnemies()[0];
      if (!t || this.s.over) return;
      this.hitEnemy(t, this.attackDamage(base, t, strMult), { attack: true, pierce });
    }
  }

  attackAll(base) {
    for (const e of this.livingEnemies()) this.hitEnemy(e, this.attackDamage(base, e), { attack: true });
  }

  attackRandom(base) {
    const alive = this.livingEnemies();
    if (!alive.length || this.s.over) return;
    const e = alive[Math.floor(this.rnd() * alive.length)];
    this.hitEnemy(e, this.attackDamage(base, e), { attack: true });
  }

  /** Non-attack damage (potions, relics, powers). */
  damage(e, n) { if (e && !e.dead) this.hitEnemy(e, n, {}); }
  damageAll(n) { for (const e of this.livingEnemies()) this.hitEnemy(e, n, {}); }

  hitEnemy(e, dmg, { attack = false, pierce = false } = {}) {
    if (e.dead || this.s.over) return;
    const blocked = pierce ? 0 : Math.min(e.block, dmg);
    e.block -= blocked;
    const lost = Math.min(e.hp, dmg - blocked);
    e.hp -= lost;
    this.s.stats.dealt += lost;
    this.emit({ t: 'hit', who: e.uid, amt: dmg - blocked, blocked, hp: e.hp, block: e.block, attack });
    if (attack && lost > 0) {
      if (e.st.plated) { e.st.plated -= 1; if (!e.st.plated) delete e.st.plated; }
      if (e.st.angry) e.st.str = (e.st.str || 0) + e.st.angry;
      if (this.p.st.envenom && e.hp > 0) this.apply(e, 'poison', this.p.st.envenom);
    }
    if (attack && e.st.thorns && e.hp > 0) this.hitPlayer(e.st.thorns, { source: 'thorns' });
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    e.hp = 0;
    e.block = 0;
    this.emit({ t: 'die', who: e.uid });
    // When a summoner dies, its minions flee.
    if (ENEMIES[e.id].moves.raise && this.livingEnemies().every((x) => ENEMIES[x.id].name === 'Skeleton' && x.mem.summoned)) {
      for (const x of this.livingEnemies()) { x.dead = true; this.emit({ t: 'flee', who: x.uid }); }
    }
    this.checkWin();
  }

  checkWin() {
    if (!this.s.over && this.livingEnemies().length === 0) {
      this.s.over = 'win';
      this.s.doubleNext = false;
      this.emit({ t: 'win' });
      this.syncRun();
    }
  }

  hitPlayer(dmg, { attacker, source } = {}) {
    if (this.s.over) return 0;
    const p = this.p;
    const blocked = Math.min(p.block, dmg);
    p.block -= blocked;
    let lost = dmg - blocked;
    if (lost > 0 && this.relic('tungsten')) lost -= 1;
    lost = Math.min(p.hp, lost);
    p.hp -= lost;
    this.s.stats.taken += lost;
    this.emit({ t: 'hit', who: 'p', amt: dmg - blocked, blocked, hp: p.hp, block: p.block, source });
    this.checkDeath();
    if (!this.s.over && attacker && p.st.thorns && !attacker.dead) this.hitEnemy(attacker, p.st.thorns, {});
    return lost;
  }

  loseHp(n) {
    if (this.s.over) return;
    let lost = n;
    if (lost > 0 && this.relic('tungsten')) lost -= 1;
    lost = Math.min(this.p.hp, lost);
    this.p.hp -= lost;
    this.s.stats.taken += lost;
    this.emit({ t: 'hit', who: 'p', amt: lost, blocked: 0, hp: this.p.hp, block: this.p.block });
    this.checkDeath();
  }

  checkDeath() {
    if (this.p.hp > 0 || this.s.over) return;
    if (this.relic('phoenix') && !this.run.phoenixUsed) {
      this.run.phoenixUsed = true;
      this.p.hp = Math.floor(this.p.maxHp / 2);
      this.emit({ t: 'heal', who: 'p', amt: this.p.hp, hp: this.p.hp, note: 'Phoenix Feather!' });
      return;
    }
    this.s.over = 'lose';
    this.emit({ t: 'lose' });
    this.syncRun();
  }

  block(base) {
    const n = this.blockAmount(base);
    this.gainRawBlock(n);
    return n;
  }

  gainRawBlock(n) {
    if (n <= 0) return;
    this.p.block += n;
    this.emit({ t: 'block', who: 'p', amt: n, block: this.p.block });
  }

  heal(n) {
    const before = this.p.hp;
    this.p.hp = Math.min(this.p.maxHp, this.p.hp + n);
    if (this.p.hp > before) this.emit({ t: 'heal', who: 'p', amt: this.p.hp - before, hp: this.p.hp });
  }

  healPct(p) { this.heal(Math.floor(this.p.maxHp * p)); }

  /** Add (or remove, with negative n) a status on an enemy. Debuffs are stopped by Artifact. */
  apply(e, st, n, silent = false) {
    if (!e || e.dead || !n) return;
    const isDebuff = STATUSES[st]?.kind === 'debuff' || (st === 'str' && n < 0);
    if (isDebuff && e.st.artifact > 0 && st !== 'strUp') {
      e.st.artifact -= 1;
      if (!e.st.artifact) delete e.st.artifact;
      this.emit({ t: 'negate', who: e.uid });
      // Shackles: if the Strength loss was blocked, don't give it back later either.
      if (st === 'str') e.mem.blockedStr = (e.mem.blockedStr || 0) + 1;
      return;
    }
    if (st === 'strUp' && e.mem.blockedStr) { e.mem.blockedStr -= 1; return; }
    if (st === 'ritual') e.mem.freshRitual = true;
    e.st[st] = (e.st[st] || 0) + n;
    if (!e.st[st]) delete e.st[st];
    if (!silent) this.emit({ t: 'status', who: e.uid, st, n });
  }

  applyAll(st, n) { for (const e of this.livingEnemies()) this.apply(e, st, n); }

  applyRandom(st, n) {
    const alive = this.livingEnemies();
    if (alive.length) this.apply(alive[Math.floor(this.rnd() * alive.length)], st, n);
  }

  applySelf(st, n) {
    if (!n) return;
    this.p.st[st] = (this.p.st[st] || 0) + n;
    if (!this.p.st[st]) delete this.p.st[st];
    this.emit({ t: 'status', who: 'p', st, n });
  }

  cleanse() {
    for (const k of ['weak', 'vuln', 'frail']) delete this.p.st[k];
    this.emit({ t: 'status', who: 'p', st: 'cleanse', n: 0 });
  }

  gainEnergy(n) {
    this.s.energy += n;
    this.emit({ t: 'energy', n });
  }

  draw(n) {
    const s = this.s;
    for (let i = 0; i < n; i++) {
      if (!s.draw.length) {
        if (!s.discard.length) return;
        s.draw = shuffle(s.rng, s.discard);
        s.discard = [];
        this.emit({ t: 'shuffle' });
      }
      const card = s.draw.pop();
      if (s.hand.length >= HAND_LIMIT) { s.discard.push(card); continue; }
      s.hand.push(card);
      this.emit({ t: 'draw', uid: card.uid });
    }
  }

  addCard(id, pile, n = 1) {
    for (let i = 0; i < n; i++) {
      const card = { uid: this.s.uidNext++, id, up: false };
      if (pile === 'hand' && this.s.hand.length < HAND_LIMIT) this.s.hand.push(card);
      else if (pile === 'draw') this.s.draw.splice(Math.floor(this.rnd() * (this.s.draw.length + 1)), 0, card);
      else this.s.discard.push(card);
    }
    this.emit({ t: 'addCard', id, pile, n });
  }

  upgradeAllInCombat() {
    for (const pile of ['draw', 'hand', 'discard']) for (const c of this.s[pile]) if (canUpgrade(c)) c.up = true;
    this.emit({ t: 'upgradeAll' });
  }

  // ---------- turn flow ----------
  startTurn() {
    const s = this.s;
    const p = this.p;
    if (s.over) return;
    s.turn += 1;
    s.counters = { attacks: 0, skills: 0, cards: 0 };
    if (s.turn > 1 && !p.st.bulwark) p.block = 0;
    if (p.st.nextBlock) { this.gainRawBlock(p.st.nextBlock); delete p.st.nextBlock; }
    const leftover = this.relic('keepEnergy') && s.turn > 1 ? s.energy : 0;
    s.energy = this.maxEnergy() + leftover + (p.st.archmage || 0);
    if (p.st.poison) {
      this.loseHp(p.st.poison);
      p.st.poison -= 1;
      if (!p.st.poison) delete p.st.poison;
      if (s.over) return;
    }
    if (p.st.warlord) this.applySelf('str', p.st.warlord);
    if (p.st.noxious) this.applyAll('poison', p.st.noxious);
    for (const r of this.run.relics) RELICS[r]?.turnStart?.(this, s.turn);
    if (s.over) return;
    const n = BASE_DRAW + (p.st.eagle || 0) + (s.turn === 1 ? s.bonusDraw : 0);
    this.draw(n);
    this.emit({ t: 'turn', turn: s.turn });
    this.syncRun();
  }

  /** Can this card be played right now? Returns '' or a reason. */
  whyNot(card) {
    const d = CARDS[card.id];
    if (this.s.over) return 'The fight is over';
    if (flagsOf(card).unplayable) return `${d.name} can't be played`;
    const cost = costOf(card);
    if (cost !== 'X' && cost > this.s.energy) return 'Not enough energy';
    return '';
  }

  needsTarget(card) {
    return CARDS[card.id].target === 'enemy';
  }

  playCard(uid, targetUid) {
    const s = this.s;
    const idx = s.hand.findIndex((c) => c.uid === uid);
    if (idx < 0 || this.whyNot(s.hand[idx])) return false;
    const card = s.hand[idx];
    const d = CARDS[card.id];
    let target = null;
    if (d.target === 'enemy') {
      target = targetUid !== undefined ? this.enemyByUid(targetUid) : null;
      if (!target) { const alive = this.livingEnemies(); if (alive.length === 1) [target] = alive; }
      if (!target) return false;
    }
    let cost = costOf(card);
    const v = values(card);
    if (cost === 'X') { v.X = s.energy; cost = s.energy; }
    s.energy -= cost;
    s.hand.splice(idx, 1);
    s.counters.cards += 1;
    if (d.type === 'attack') s.counters.attacks += 1;
    if (d.type === 'skill') s.counters.skills += 1;
    this.emit({ t: 'play', uid, id: card.id, target: target?.uid, type: d.type });

    const doubled = s.doubleNext && d.type === 'attack';
    d.play?.(this, v, target, card.up);
    if (doubled) s.doubleNext = false;

    if (d.type === 'skill') for (const e of this.livingEnemies()) if (e.st.enrage) this.apply(e, 'str', e.st.enrage);
    if (d.type === 'attack' && this.p.st.pyro) this.damageAll(this.p.st.pyro);
    for (const r of this.run.relics) RELICS[r]?.cardPlayed?.(this, card, d);

    delete card.costTmp;
    if (d.type === 'power') { /* powers stay in play */ }
    else if (flagsOf(card).exhaust) { s.exhaust.push(card); this.emit({ t: 'exhaust', uid }); }
    else s.discard.push(card);
    this.syncRun();
    return true;
  }

  usePotion(slot, targetUid) {
    const id = this.run.potions[slot];
    const d = POTIONS[id];
    if (!d || this.s.over) return false;
    let target = null;
    if (d.target === 'enemy') {
      target = targetUid !== undefined ? this.enemyByUid(targetUid) : null;
      if (!target) { const alive = this.livingEnemies(); if (alive.length === 1) [target] = alive; }
      if (!target) return false;
    }
    this.run.potions[slot] = null;
    this.emit({ t: 'potion', id });
    d.use(this, target);
    this.checkWin();
    this.syncRun();
    return true;
  }

  endTurn() {
    const s = this.s;
    const p = this.p;
    if (s.over) return;
    this.emit({ t: 'endTurn' });
    // Burns and curses in hand.
    for (const card of [...s.hand]) {
      if (card.id === 'burn' || card.id === 'decay') this.hitPlayer(2, { source: card.id });
      if (card.id === 'doubt') this.applySelf('weak', 1);
      if (s.over) return;
    }
    for (const r of this.run.relics) RELICS[r]?.turnEnd?.(this);
    if (p.st.plate) this.gainRawBlock(p.st.plate);
    if (p.st.wildfire) this.damageAll(p.st.wildfire);
    if (s.over) return;
    if (p.st.strDown) { this.applySelf('str', -p.st.strDown); delete p.st.strDown; }
    // Discard the hand (ethereal cards burn away).
    const keep = this.relic('keepHand');
    const kept = [];
    for (const card of s.hand) {
      delete card.costTmp;
      if (flagsOf(card).ethereal) { s.exhaust.push(card); this.emit({ t: 'exhaust', uid: card.uid }); }
      else if (keep) kept.push(card);
      else s.discard.push(card);
    }
    s.hand = kept;
    for (const k of ['weak', 'vuln', 'frail']) if (p.st[k]) { p.st[k] -= 1; if (!p.st[k]) delete p.st[k]; }

    this.enemyTurn();
    if (s.over) return;
    this.startTurn();
  }

  enemyTurn() {
    const s = this.s;
    for (const e of [...s.enemies]) {
      if (e.dead || s.over) continue;
      e.block = 0;
      if (e.st.poison) {
        this.emit({ t: 'poison', who: e.uid });
        this.hitEnemy(e, e.st.poison, {});
        if (e.dead) continue;
        e.st.poison -= 1;
        if (!e.st.poison) delete e.st.poison;
      }
      this.doMove(e);
      if (s.over) return;
      if (e.dead) continue;
      // End of this enemy's turn.
      if (e.st.ritual) { if (e.mem.freshRitual) delete e.mem.freshRitual; else this.apply(e, 'str', e.st.ritual); }
      if (e.st.plated) { e.block += e.st.plated; this.emit({ t: 'block', who: e.uid, amt: e.st.plated, block: e.block }); }
      if (e.st.regen) { const h = Math.min(e.maxHp - e.hp, e.st.regen); if (h > 0) { e.hp += h; this.emit({ t: 'heal', who: e.uid, amt: h, hp: e.hp }); } }
      if (e.st.strUp) { e.st.str = (e.st.str || 0) + e.st.strUp; if (!e.st.str) delete e.st.str; delete e.st.strUp; }
      for (const k of ['weak', 'vuln', 'frail']) if (e.st[k]) { e.st[k] -= 1; if (!e.st[k]) delete e.st[k]; }
    }
    if (s.over) return;
    for (const e of this.livingEnemies()) {
      if (e.mem.fresh) { delete e.mem.fresh; continue; }
      this.chooseIntent(e);
    }
  }

  doMove(e) {
    const d = ENEMIES[e.id];
    const m = d.moves[e.move];
    if (!m) return;
    this.emit({ t: 'move', who: e.uid, name: m.name });
    if (m.block) { e.block += m.block; this.emit({ t: 'block', who: e.uid, amt: m.block, block: e.block }); }
    if (m.blockAllies) {
      for (const a of this.livingEnemies()) { a.block += m.blockAllies; this.emit({ t: 'block', who: a.uid, amt: m.blockAllies, block: a.block }); }
    }
    if (m.dmg !== undefined) {
      const times = val(m.times, e) || 1;
      for (let i = 0; i < times; i++) {
        if (e.dead || this.s.over) break;
        const lost = this.hitPlayer(this.enemyHit(e, val(m.dmg, e)), { attacker: e });
        if (m.drain && lost > 0 && !e.dead) {
          e.hp = Math.min(e.maxHp, e.hp + lost);
          this.emit({ t: 'heal', who: e.uid, amt: lost, hp: e.hp });
        }
      }
    }
    if (this.s.over || e.dead) return;
    if (m.buff) for (const [k, n] of Object.entries(m.buff)) this.apply(e, k, n);
    if (m.debuff) for (const [k, n] of Object.entries(m.debuff)) this.applySelf(k, n);
    if (m.add) this.addCard(m.add[0], m.add[2], m.add[1]);
    if (m.heal) { e.hp = Math.min(e.maxHp, e.hp + m.heal); this.emit({ t: 'heal', who: e.uid, amt: m.heal, hp: e.hp }); }
    if (m.summon && this.livingEnemies().length < MAX_ENEMIES) {
      const minion = makeEnemy(this.s, this.run, m.summon, this.s.rng);
      minion.mem.summoned = true;
      minion.mem.fresh = true;
      this.s.enemies.push(minion);
      this.chooseIntent(minion);
      this.emit({ t: 'summon', who: minion.uid });
    }
    m.fn?.(this, e);
  }
}

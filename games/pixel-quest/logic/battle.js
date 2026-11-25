// Turn-based, front-view party battles (Dragon Quest style rounds). Pure logic: the scene picks
// commands, calls runRound() and plays back the returned events.
import { CLASSES, SKILLS, MSKILLS, MONSTERS, ITEMS } from './data.js';
import { statsOf, monsterStats, monsterXp, monsterGold, skillsAt, hasCharm } from './stats.js';

const SPELLS = new Set([...CLASSES.mage.skills, ...CLASSES.cleric.skills].map(([id]) => id));
export const isSpell = (id) => SPELLS.has(id);

const ALREADY = { poison: 'poisoned', sleep: 'asleep', silence: 'silenced', slow: 'slowed' };
const TARGET_WEIGHT = { warrior: 1.35, thief: 1, cleric: 0.9, mage: 0.85 };

/**
 * party: the members (state.party entries; written back by finish()).
 * enemies: monster ids. bag: { itemId: count } (shared with the save, used up as items are used).
 * opts: { diff (enemy strength), boss, canRun, phase2 (monster id that appears when the first wave falls) }
 */
export function createBattle({ party, enemies, bag, rng, diff = 1, boss = false, canRun = true, phase2 = null, goldMult = 1 }) {
  const b = {
    rng, bag, diff, boss, canRun: canRun && !boss, phase2, goldMult,
    round: 0, over: null, runTries: 0,
    allies: party.map((m, i) => ally(m, i)),
    foes: [],
    xp: 0, gold: 0, drops: [], stolen: [], defeated: [],
  };
  setFoes(b, enemies);
  return b;
}

function ally(m, i) {
  const s = statsOf(m);
  return {
    side: 'ally', idx: i, id: m.cls, name: CLASSES[m.cls].name, m, lv: m.lv,
    hp: Math.min(m.hp, s.hp), mp: Math.min(m.mp, s.mp), s,
    st: { poison: m.st === 'poison' ? 99 : 0, sleep: 0, silence: 0, slow: 0 },
    buff: { atk: 0, def: 0 }, provoke: 0, guard: false,
    skills: skillsAt(m.cls, m.lv),
    ward: hasCharm(m, 'ward'), luck: hasCharm(m, 'luck'),
  };
}

function setFoes(b, ids) {
  const count = {};
  ids.forEach((id) => { count[id] = (count[id] || 0) + 1; });
  const seen = {};
  b.foes = ids.map((id, i) => {
    const d = MONSTERS[id];
    const s = monsterStats(id, b.diff);
    let name = d.name;
    if (count[id] > 1) { seen[id] = (seen[id] || 0) + 1; name = `${d.name} ${'ABCDEF'[seen[id] - 1]}`; }
    return {
      side: 'foe', idx: i, id, name, d, hp: s.hp, maxhp: s.hp, s,
      st: { poison: 0, sleep: 0, silence: 0, slow: 0 }, buff: { atk: 0, def: 0 }, provoke: 0, guard: false,
      stolen: false, fled: false, boss: !!d.boss, undead: !!d.undead,
    };
  });
}

export const alive = (u) => u.hp > 0 && !u.fled;
export const livingFoes = (b) => b.foes.filter(alive);
export const livingAllies = (b) => b.allies.filter(alive);
export const unit = (b, side, idx) => (side === 'ally' ? b.allies : b.foes)[idx];
const ref = (u) => ({ side: u.side, idx: u.idx });

/** Can this ally act this round (pick a command)? */
export const canAct = (a) => alive(a) && a.st.sleep <= 0;

/** Skill ids an ally could use now (enough MP, not silenced for spells). */
export function usableSkills(b, a) {
  return a.skills.filter((id) => skillProblem(b, a, id) == null);
}

export function skillProblem(b, a, id) {
  const sk = SKILLS[id];
  if (a.mp < sk.mp) return 'Not enough MP';
  if (a.st.silence > 0 && isSpell(id)) return 'Silenced';
  if (sk.kind === 'flee' && !b.canRun) return 'Can\'t escape';
  if (sk.target === 'dead' && !b.allies.some((x) => x.hp <= 0)) return 'Nobody to revive';
  return null;
}

export function itemProblem(b, id) {
  const it = ITEMS[id];
  if (!it || !(b.bag[id] > 0)) return 'None left';
  if (it.fieldOnly) return 'Only outside battle';
  if (it.target === 'dead' && !b.allies.some((x) => x.hp <= 0)) return 'Nobody to revive';
  return null;
}

// ------------------------------------------------------------------ maths

function atkOf(u) { return u.s.atk * (u.buff.atk > 0 ? 1.3 : 1); }
function defOf(u) { return u.s.def * (u.buff.def > 0 ? 1.35 : 1); }
function spdOf(u) { return u.s.spd * (u.st.slow > 0 ? 0.5 : 1); }

function elemMult(target, element) {
  if (!element || target.side !== 'foe') return 1;
  const d = target.d;
  let m = 1;
  if (d.weak?.includes(element)) m = 1.6;
  if (d.resist?.includes(element)) m = 0.5;
  if (element === 'holy' && target.undead) m = 2;
  return m;
}

function physDamage(b, att, tgt, power = 1, pierce = 0) {
  const A = atkOf(att);
  const D = defOf(tgt) * (1 - pierce);
  let crit = false;
  const critChance = att.side === 'ally' ? (att.id === 'thief' ? 0.12 : 0.04) + (att.luck ? 0.08 : 0) : 0.03;
  let dmg;
  if (b.rng.chance(critChance)) { crit = true; dmg = A * 0.95 * power * 1.5; } else dmg = (A * A) / (A + D) * 0.95 * power;
  dmg *= b.rng.range(0.85, 1.15);
  if (tgt.guard) dmg *= 0.5;
  return { dmg: Math.max(1, Math.round(dmg)), crit };
}

function magicDamage(b, att, tgt, sk) {
  let dmg = (sk.power + att.s.mag * (sk.scale ?? 1)) * b.rng.range(0.9, 1.1);
  const mult = elemMult(tgt, sk.element);
  dmg *= mult;
  if (tgt.guard) dmg *= 0.6;
  if (tgt.buff.def > 0) dmg *= 0.85;
  if (tgt.side === 'ally') dmg *= 0.9;
  return { dmg: Math.max(1, Math.round(dmg)), weak: mult > 1, resist: mult < 1 };
}

function healAmount(b, att, sk) {
  return Math.round((sk.power + att.s.mag * (sk.scale ?? 1)) * b.rng.range(0.95, 1.05));
}

const maxHpOf = (u) => (u.side === 'ally' ? u.s.hp : u.maxhp);
const maxMpOf = (u) => (u.side === 'ally' ? u.s.mp : 999);

// ------------------------------------------------------------------ effects (push events)

function hurt(b, ev, tgt, dmg, extra = {}) {
  if (!alive(tgt)) return;
  tgt.hp = Math.max(0, tgt.hp - dmg);
  ev.push({ t: 'dmg', ...ref(tgt), amount: dmg, hp: tgt.hp, ...extra });
  if (tgt.hp <= 0) {
    ev.push({ t: 'ko', ...ref(tgt) });
    ev.push({ t: 'msg', text: tgt.side === 'foe' ? `${tgt.name} is defeated!` : `${tgt.name} falls!` });
    tgt.st = { poison: 0, sleep: 0, silence: 0, slow: 0 };
    tgt.buff = { atk: 0, def: 0 };
    tgt.provoke = 0;
    if (tgt.side === 'foe') b.defeated.push(tgt.id);
  } else if (tgt.st.sleep > 0 && extra.kind === 'phys' && b.rng.chance(0.4)) {
    tgt.st.sleep = 0;
    ev.push({ t: 'status', ...ref(tgt), st: 'sleep', on: false });
    ev.push({ t: 'msg', text: `${tgt.name} wakes up!` });
  }
}

function heal(b, ev, tgt, amt) {
  if (!alive(tgt)) return;
  const before = tgt.hp;
  tgt.hp = Math.min(maxHpOf(tgt), tgt.hp + amt);
  ev.push({ t: 'heal', ...ref(tgt), amount: tgt.hp - before, hp: tgt.hp });
  ev.push({ t: 'msg', text: `${tgt.name} recovers ${tgt.hp - before} HP.` });
}

function tryStatus(b, ev, tgt, st, chance) {
  if (!alive(tgt)) return false;
  let c = chance;
  if (tgt.side === 'ally' && tgt.ward) c = 0;
  if (tgt.boss) c *= st === 'sleep' ? 0 : st === 'poison' ? 0.5 : 0.3;
  if (tgt.st[st] > 0) { ev.push({ t: 'msg', text: `${tgt.name} is already ${ALREADY[st]}.` }); return false; }
  if (!b.rng.chance(c)) { ev.push({ t: 'msg', text: `${tgt.name} resists.` }); return false; }
  tgt.st[st] = st === 'poison' ? 99 : st === 'sleep' ? b.rng.int(2, 3) : st === 'silence' ? b.rng.int(3, 4) : 3;
  ev.push({ t: 'status', ...ref(tgt), st, on: true });
  const word = { poison: 'is poisoned!', sleep: 'falls asleep!', silence: 'is silenced!', slow: 'slows down!' }[st];
  ev.push({ t: 'msg', text: `${tgt.name} ${word}` });
  return true;
}

function cure(b, ev, tgt, list = ['poison', 'sleep', 'silence', 'slow']) {
  let any = false;
  for (const st of list) {
    if (tgt.st[st] > 0) { tgt.st[st] = 0; any = true; ev.push({ t: 'status', ...ref(tgt), st, on: false }); }
  }
  ev.push({ t: 'msg', text: any ? `${tgt.name} feels better.` : 'It has no effect.' });
}

function revive(b, ev, tgt, frac) {
  if (tgt.hp > 0) { ev.push({ t: 'msg', text: 'It has no effect.' }); return; }
  tgt.hp = Math.max(1, Math.round(maxHpOf(tgt) * frac));
  ev.push({ t: 'revive', ...ref(tgt), hp: tgt.hp });
  ev.push({ t: 'msg', text: `${tgt.name} is back on their feet!` });
}

function steal(b, ev, att, tgt) {
  if (!alive(tgt)) return;
  const item = tgt.d.steal;
  if (tgt.stolen || !item) { ev.push({ t: 'msg', text: `${tgt.name} has nothing left.` }); return; }
  let chance = 0.5 + (spdOf(att) - spdOf(tgt)) * 0.01 + (att.luck ? 0.2 : 0);
  if (tgt.boss) chance *= 0.5;
  chance = Math.max(0.15, Math.min(0.9, chance));
  ev.push({ t: 'fx', kind: 'steal', targets: [ref(tgt)] });
  if (b.rng.chance(chance)) {
    tgt.stolen = true;
    b.bag[item] = (b.bag[item] || 0) + 1;
    b.stolen.push(item);
    ev.push({ t: 'msg', text: `Stole a ${ITEMS[item]?.name || item}!` });
    ev.push({ t: 'steal', item });
  } else ev.push({ t: 'msg', text: 'Couldn\'t steal anything.' });
}

function retarget(b, side, idx, wantDead = false) {
  const list = side === 'ally' ? b.allies : b.foes;
  const u = list[idx];
  if (u && (wantDead ? u.hp <= 0 && !u.fled : alive(u))) return u;
  if (wantDead) return list.find((x) => x.hp <= 0) || null;
  if (side === 'ally') return [...list].filter(alive).sort((a, c) => a.hp / maxHpOf(a) - c.hp / maxHpOf(c))[0] || null;
  const living = list.filter(alive);
  return living.length ? b.rng.pick(living) : null;
}

// ------------------------------------------------------------------ actions

/** Run a skill-like action (ally skill or monster skill). */
function useSkill(b, ev, actor, sk, target) {
  const own = actor.side === 'ally' ? b.allies : b.foes;
  const other = actor.side === 'ally' ? b.foes : b.allies;
  const pickTargets = () => {
    if (sk.target === 'foes') return other.filter(alive);
    if (sk.target === 'allies') return own.filter(alive);
    if (sk.target === 'self') return [actor];
    if (sk.target === 'dead') { const t = retarget(b, actor.side, target?.idx ?? 0, true); return t ? [t] : []; }
    if (sk.target === 'ally') { const t = retarget(b, actor.side, target?.idx ?? actor.idx); return t ? [t] : []; }
    const t = retarget(b, actor.side === 'ally' ? 'foe' : 'ally', target?.idx ?? 0);
    return t ? [t] : [];
  };
  let targets = pickTargets();
  const fxKind = sk.element || { phys: 'slash', heal: 'heal', buff: 'buff', revive: 'heal', cure: 'heal', status: 'status', magic: 'dark', provoke: 'buff' }[sk.kind] || 'slash';
  if (sk.kind === 'phys') {
    const hits = sk.hits || 1;
    for (let h = 0; h < hits; h++) {
      if (sk.target === 'random') { const l = other.filter(alive); if (!l.length) break; targets = [b.rng.pick(l)]; }
      for (const t of targets) {
        if (!alive(t)) continue;
        ev.push({ t: 'fx', kind: 'slash', targets: [ref(t)], by: ref(actor) });
        if (b.rng.chance(t.side === 'ally' ? 0.04 : 0.03)) { ev.push({ t: 'miss', ...ref(t) }); ev.push({ t: 'msg', text: `${t.name} dodges!` }); continue; }
        const { dmg, crit } = physDamage(b, actor, t, sk.power, sk.pierce || 0);
        if (crit) ev.push({ t: 'msg', text: 'A critical hit!' });
        hurt(b, ev, t, dmg, { crit, kind: 'phys' });
        if (sk.drain && alive(actor)) { const before = actor.hp; actor.hp = Math.min(maxHpOf(actor), actor.hp + Math.round(dmg * sk.drain)); ev.push({ t: 'heal', ...ref(actor), amount: actor.hp - before, hp: actor.hp }); }
        if (sk.status && alive(t)) tryStatus(b, ev, t, sk.status, sk.chance ?? 1);
        if (sk.steal) steal(b, ev, actor, t);
      }
      if (sk.target !== 'random' && targets.every((t) => !alive(t))) break;
    }
    return;
  }
  if (sk.kind === 'magic') {
    ev.push({ t: 'fx', kind: fxKind, targets: targets.map(ref), by: ref(actor) });
    for (const t of targets) {
      const { dmg, weak, resist } = magicDamage(b, actor, t, sk);
      if (weak && targets.length === 1) ev.push({ t: 'msg', text: 'It\'s very effective!' });
      if (resist && targets.length === 1) ev.push({ t: 'msg', text: 'It barely hurts.' });
      hurt(b, ev, t, dmg, { weak, kind: 'magic' });
      if (sk.status && alive(t)) tryStatus(b, ev, t, sk.status, sk.chance ?? 1);
    }
    return;
  }
  if (sk.kind === 'heal') {
    ev.push({ t: 'fx', kind: 'heal', targets: targets.map(ref) });
    for (const t of targets) heal(b, ev, t, healAmount(b, actor, sk));
    return;
  }
  if (sk.kind === 'status') {
    ev.push({ t: 'fx', kind: 'status', targets: targets.map(ref), by: ref(actor) });
    for (const t of targets) tryStatus(b, ev, t, sk.status, sk.chance ?? 1);
    return;
  }
  if (sk.kind === 'buff') {
    ev.push({ t: 'fx', kind: 'buff', targets: targets.map(ref) });
    for (const t of targets) { t.buff[sk.buff] = sk.turns + 1; ev.push({ t: 'buff', ...ref(t), buff: sk.buff, on: true }); }
    ev.push({ t: 'msg', text: sk.buff === 'atk' ? `${targets.length > 1 ? 'Attack' : `${targets[0].name}'s attack`} rises!` : `${targets.length > 1 ? 'Defence' : `${targets[0].name}'s defence`} rises!` });
    return;
  }
  if (sk.kind === 'cure') { for (const t of targets) { ev.push({ t: 'fx', kind: 'heal', targets: [ref(t)] }); cure(b, ev, t); } return; }
  if (sk.kind === 'revive') { for (const t of targets) { ev.push({ t: 'fx', kind: 'heal', targets: [ref(t)] }); revive(b, ev, t, sk.frac); } return; }
  if (sk.kind === 'steal') { for (const t of targets) steal(b, ev, actor, t); return; }
  if (sk.kind === 'provoke') {
    actor.provoke = sk.turns + 1; actor.buff.def = Math.max(actor.buff.def, sk.turns + 1);
    ev.push({ t: 'fx', kind: 'buff', targets: [ref(actor)] });
    ev.push({ t: 'msg', text: `Foes glare at ${actor.name}!` });
    return;
  }
  if (sk.kind === 'flee') {
    if (actor.side === 'foe') {
      actor.fled = true;
      ev.push({ t: 'flee', ...ref(actor) });
      ev.push({ t: 'msg', text: `${actor.name} runs away!` });
      return;
    }
    if (!b.canRun) { ev.push({ t: 'msg', text: 'There is no escape!' }); return; }
    ev.push({ t: 'fx', kind: 'smoke', targets: [] });
    ev.push({ t: 'msg', text: 'The party slips away in the smoke!' });
    b.over = 'fled';
  }
}

function useItem(b, ev, actor, id, target) {
  const it = ITEMS[id];
  if (!(b.bag[id] > 0)) { ev.push({ t: 'msg', text: `There are no ${it.name}s left.` }); return; }
  b.bag[id]--;
  if (b.bag[id] <= 0) delete b.bag[id];
  ev.push({ t: 'item', id });
  if (it.use === 'bomb') {
    const ts = livingFoes(b);
    ev.push({ t: 'fx', kind: 'fire', targets: ts.map(ref) });
    for (const t of ts) hurt(b, ev, t, Math.round(it.amount * b.rng.range(0.9, 1.1)), { kind: 'magic' });
    return;
  }
  if (it.use === 'revive') { const t = retarget(b, 'ally', target?.idx ?? 0, true); if (t) { ev.push({ t: 'fx', kind: 'heal', targets: [ref(t)] }); revive(b, ev, t, it.frac); } else ev.push({ t: 'msg', text: 'It has no effect.' }); return; }
  const t = retarget(b, 'ally', target?.idx ?? actor.idx);
  if (!t) return;
  ev.push({ t: 'fx', kind: 'heal', targets: [ref(t)] });
  if (it.use === 'heal') heal(b, ev, t, it.amount);
  else if (it.use === 'full') { heal(b, ev, t, 9999); t.mp = maxMpOf(t); ev.push({ t: 'mp', ...ref(t), mp: t.mp }); }
  else if (it.use === 'mp') { const before = t.mp; t.mp = Math.min(maxMpOf(t), t.mp + it.amount); ev.push({ t: 'mp', ...ref(t), mp: t.mp }); ev.push({ t: 'msg', text: `${t.name} recovers ${t.mp - before} MP.` }); }
  else if (it.use === 'cure') cure(b, ev, t, it.cures);
}

function doAllyCommand(b, ev, a, cmd) {
  if (cmd.type === 'guard') { a.guard = true; ev.push({ t: 'msg', text: `${a.name} is on guard.` }); return; }
  if (cmd.type === 'attack') {
    ev.push({ t: 'msg', text: `${a.name} attacks!` });
    useSkill(b, ev, a, { kind: 'phys', target: 'foe', power: 1 }, cmd.target);
    return;
  }
  if (cmd.type === 'item') {
    ev.push({ t: 'msg', text: `${a.name} uses a ${ITEMS[cmd.item].name}.` });
    useItem(b, ev, a, cmd.item, cmd.target);
    return;
  }
  if (cmd.type === 'skill') {
    const sk = SKILLS[cmd.skill];
    const why = skillProblem(b, a, cmd.skill);
    if (why) {
      ev.push({ t: 'msg', text: why === 'Silenced' ? `${a.name} can't cast while silenced!` : `${a.name} can't use ${sk.name}.` });
      return;
    }
    a.mp -= sk.mp;
    ev.push({ t: 'mp', ...ref(a), mp: a.mp });
    ev.push({ t: 'msg', text: `${a.name} uses ${sk.name}!` });
    useSkill(b, ev, a, sk, cmd.target);
  }
}

// ------------------------------------------------------------------ enemy AI

function foeTarget(b, foe) {
  const living = livingAllies(b);
  const prov = living.find((a) => a.provoke > 0);
  if (prov && b.rng.chance(0.85)) return prov;
  return b.rng.weighted(living.map((a) => [a, TARGET_WEIGHT[a.id] || 1]));
}

export function foeAction(b, foe) {
  const list = foe.d.skills || [];
  for (const [id, p] of list) {
    const sk = MSKILLS[id];
    if (!b.rng.chance(p)) continue;
    if (foe.st.silence > 0 && sk.kind !== 'phys' && sk.kind !== 'flee') continue;
    if (sk.kind === 'heal' && !livingFoes(b).some((f) => f.hp < f.maxhp * 0.6)) continue;
    if (sk.kind === 'buff' && (sk.target === 'self' ? foe.buff[sk.buff] > 0 : livingFoes(b).every((f) => f.buff[sk.buff] > 0))) continue;
    if (sk.kind === 'status' && sk.target === 'foe' && livingAllies(b).every((a) => a.st[sk.status] > 0)) continue;
    let target = null;
    if (sk.target === 'foe') target = ref(foeTarget(b, foe));
    if (sk.target === 'ally') target = ref([...livingFoes(b)].sort((x, y) => x.hp / x.maxhp - y.hp / y.maxhp)[0]);
    return { type: 'mskill', skill: id, target };
  }
  return { type: 'attack', target: ref(foeTarget(b, foe)) };
}

function doFoe(b, ev, foe) {
  const act = foeAction(b, foe);
  if (act.type === 'attack') {
    ev.push({ t: 'msg', text: `${foe.name} attacks!` });
    useSkill(b, ev, foe, { kind: 'phys', target: 'foe', power: 1 }, act.target);
    return;
  }
  const sk = MSKILLS[act.skill];
  if (sk.kind !== 'flee') ev.push({ t: 'msg', text: `${foe.name} uses ${sk.name}!` });
  useSkill(b, ev, foe, sk, act.target);
}

// ------------------------------------------------------------------ rounds

function checkEnd(b, ev) {
  if (b.over) return true;
  if (!livingFoes(b).length) {
    if (b.phase2) {
      const next = b.phase2;
      b.phase2 = null;
      setFoes(b, [next]);
      ev.push({ t: 'phase', foes: b.foes.map((f) => ({ id: f.id, name: f.name, hp: f.hp })) });
      ev.push({ t: 'msg', text: `${b.foes[0].name} rises from the dark!` });
      return true; // the round ends here; the new foe acts next round
    }
    b.over = 'win';
    return true;
  }
  if (!livingAllies(b).length) { b.over = 'lose'; return true; }
  return false;
}

function tryRun(b, ev) {
  b.runTries++;
  if (!b.canRun) { ev.push({ t: 'msg', text: 'There is no escape!' }); return false; }
  const ps = livingAllies(b).reduce((s, a) => s + spdOf(a), 0) / Math.max(1, livingAllies(b).length);
  const fs = livingFoes(b).reduce((s, f) => s + spdOf(f), 0) / Math.max(1, livingFoes(b).length);
  const chance = Math.max(0.35, Math.min(0.95, 0.6 + (ps - fs) * 0.02 + (b.runTries - 1) * 0.2));
  if (b.rng.chance(chance)) { ev.push({ t: 'msg', text: 'The party runs away!' }); b.over = 'fled'; return true; }
  ev.push({ t: 'msg', text: 'Couldn\'t get away!' });
  return false;
}

/**
 * Play one round. commands: array by ally index of { type, skill?, item?, target? } (null for allies
 * who can't act). A 'run' command from anyone makes the whole party try to run first.
 */
export function runRound(b, commands) {
  const ev = [];
  if (b.over) return ev;
  b.round++;
  for (const u of [...b.allies, ...b.foes]) u.guard = false;
  let order = [];
  let ran = false;
  if (commands.some((c) => c?.type === 'run')) {
    ran = true;
    if (tryRun(b, ev)) { ev.push({ t: 'end', result: b.over }); return ev; }
  }
  for (const a of b.allies) {
    if (!alive(a)) continue;
    const cmd = commands[a.idx];
    if (cmd?.type === 'guard' && !ran) { a.guard = true; }
    order.push({ u: a, cmd: ran ? null : cmd, sp: spdOf(a) * b.rng.range(0.8, 1.2) + (cmd?.type === 'guard' ? 1000 : 0) });
  }
  for (const f of b.foes) if (alive(f)) order.push({ u: f, sp: spdOf(f) * b.rng.range(0.8, 1.2) });
  order.sort((x, y) => y.sp - x.sp);
  for (const { u, cmd } of order) {
    if (!alive(u)) continue;
    if (u.st.sleep > 0) {
      u.st.sleep--;
      if (u.st.sleep <= 0) { ev.push({ t: 'status', ...ref(u), st: 'sleep', on: false }); ev.push({ t: 'msg', text: `${u.name} wakes up!` }); } else { ev.push({ t: 'msg', text: `${u.name} is fast asleep.` }); }
      continue;
    }
    ev.push({ t: 'turn', ...ref(u) });
    if (u.side === 'ally') {
      if (!cmd) continue;
      if (cmd.type === 'guard') { ev.push({ t: 'msg', text: `${u.name} is on guard.` }); continue; }
      doAllyCommand(b, ev, u, cmd);
    } else doFoe(b, ev, u);
    if (checkEnd(b, ev)) break;
  }
  if (!b.over) endOfRound(b, ev);
  checkEnd(b, ev);
  if (b.over) ev.push({ t: 'end', result: b.over });
  return ev;
}

function endOfRound(b, ev) {
  for (const u of [...b.allies, ...b.foes]) {
    if (!alive(u)) continue;
    if (u.st.poison > 0) {
      const max = maxHpOf(u);
      const dmg = Math.max(1, Math.min(u.boss ? 40 : 999, Math.round(max * (u.side === 'ally' ? 0.07 : 0.06))));
      ev.push({ t: 'msg', text: `${u.name} is hurt by poison.` });
      hurt(b, ev, u, dmg, { poison: true });
      if (checkEnd(b, ev)) return;
    }
    for (const k of ['silence', 'slow']) {
      if (u.st[k] > 0) {
        u.st[k]--;
        if (u.st[k] <= 0) { ev.push({ t: 'status', ...ref(u), st: k, on: false }); ev.push({ t: 'msg', text: k === 'silence' ? `${u.name} can cast again.` : `${u.name} speeds up again.` }); }
      }
    }
    for (const k of ['atk', 'def']) if (u.buff[k] > 0) { u.buff[k]--; if (!u.buff[k]) ev.push({ t: 'buff', ...ref(u), buff: k, on: false }); }
    if (u.provoke > 0) u.provoke--;
  }
}

/** Rewards and write-back. Call once when b.over is set. Returns { xp, gold, drops }. */
export function finish(b) {
  for (const a of b.allies) {
    const m = a.m;
    m.hp = Math.max(0, a.hp);
    m.mp = Math.max(0, a.mp);
    m.st = a.hp > 0 && a.st.poison > 0 ? 'poison' : null;
  }
  if (b.over !== 'win') return { xp: 0, gold: 0, drops: [] };
  let xp = 0; let gold = 0;
  const drops = [];
  for (const id of b.defeated) {
    xp += monsterXp(id);
    gold += monsterGold(id);
    const d = MONSTERS[id].drop;
    if (d && b.rng.chance(d[1])) drops.push(d[0]);
  }
  gold = Math.round(gold * b.goldMult);
  for (const it of drops) b.bag[it] = (b.bag[it] || 0) + 1;
  b.xp = xp; b.gold = gold; b.drops = drops;
  return { xp, gold, drops };
}

// ------------------------------------------------------------------ auto battle (also the bot)

const hpFrac = (u) => u.hp / maxHpOf(u);

/** A sensible command for an ally: used by the Auto button and by the test bot. */
export function autoCommand(b, a) {
  if (!canAct(a)) return null;
  const foes = livingFoes(b);
  const allies = b.allies;
  const living = allies.filter(alive);
  const dead = allies.filter((x) => x.hp <= 0);
  const can = (id) => a.skills.includes(id) && skillProblem(b, a, id) == null;
  const hasItem = (id) => b.bag[id] > 0;
  const tough = b.boss || foes.reduce((s, f) => s + f.hp, 0) > 260;
  const lowest = [...living].sort((x, y) => hpFrac(x) - hpFrac(y))[0];
  const weakest = [...foes].sort((x, y) => x.hp - y.hp)[0];
  const strongest = [...foes].sort((x, y) => y.hp - x.hp)[0];
  const attack = (t = weakest) => ({ type: 'attack', target: ref(t) });
  const healerUp = allies.some((x) => x.id === 'cleric' && canAct(x) && x.mp >= 3 && x !== a);

  // Anyone: emergencies with items.
  if (dead.length && a.id !== 'cleric' && !allies.some((x) => x.id === 'cleric' && canAct(x) && x.skills.includes('raise') && x.mp >= 12) && hasItem('lifeleaf')) return { type: 'item', item: 'lifeleaf', target: ref(dead[0]) };
  if (lowest && hpFrac(lowest) < 0.3 && (a.id !== 'cleric' || a.mp < 3) && !healerUp) {
    const it = hasItem('tonic') && maxHpOf(lowest) - lowest.hp > 60 ? 'tonic' : hasItem('herb') ? 'herb' : hasItem('tonic') ? 'tonic' : null;
    if (it) return { type: 'item', item: it, target: ref(lowest) };
  }

  // Boss fights: keep the healer's MP up with Ethers, and save the day with an Elixir.
  if (b.boss) {
    const healer = allies.find((x) => x.id === 'cleric' && alive(x));
    if (healer && healer.mp < 14 && hasItem('ether') && (a === healer || a.id === 'thief' || a.id === 'warrior')) return { type: 'item', item: 'ether', target: ref(healer) };
    if (lowest && hpFrac(lowest) < 0.25 && hasItem('elixir') && !healerUp && (a.id !== 'cleric' || a.mp < 9)) return { type: 'item', item: 'elixir', target: ref(lowest) };
    if (lowest && hpFrac(lowest) < 0.35 && hasItem('tonic') && a.id === 'thief') return { type: 'item', item: 'tonic', target: ref(lowest) };
  }

  if (a.id === 'cleric') {
    if (dead.length && can('raise')) return { type: 'skill', skill: 'raise', target: ref(dead[0]) };
    const hurtList = living.filter((x) => hpFrac(x) < 0.55);
    if (hurtList.length >= 2 && can('healall')) return { type: 'skill', skill: 'healall' };
    if (lowest && hpFrac(lowest) < 0.5) {
      if (can('fullheal') && maxHpOf(lowest) - lowest.hp > 220) return { type: 'skill', skill: 'fullheal', target: ref(lowest) };
      if (can('heal')) return { type: 'skill', skill: 'heal', target: ref(lowest) };
    }
    const sick = living.find((x) => x.st.sleep > 0 || (x.st.silence > 0 && (x.id === 'mage' || x.id === 'cleric')) || x.st.poison > 0);
    if (sick && can('cure') && (sick.st.sleep > 0 || tough || sick.st.silence > 0)) return { type: 'skill', skill: 'cure', target: ref(sick) };
    if (tough && can('shield') && living.some((x) => x.buff.def <= 1)) return { type: 'skill', skill: 'shield' };
    if (can('holy') && (strongest?.undead || (tough && a.mp > a.s.mp * 0.5))) return { type: 'skill', skill: 'holy', target: ref(strongest.undead ? strongest : foes.find((f) => f.undead) || strongest) };
    return attack();
  }
  if (a.id === 'mage') {
    const mpOk = (cost) => a.mp >= cost && (tough || a.mp - cost >= a.s.mp * 0.25);
    const best = (ids) => {
      let pick = null; let score = 0;
      for (const id of ids) {
        if (!can(id) || !mpOk(SKILLS[id].mp)) continue;
        const sk = SKILLS[id];
        const ts = sk.target === 'foes' ? foes : [strongest];
        const val = ts.reduce((s, t) => s + Math.min(t.hp, (sk.power + a.s.mag * sk.scale) * elemMult(t, sk.element)), 0) / Math.sqrt(sk.mp);
        if (val > score) { score = val; pick = id; }
      }
      return pick;
    };
    if (foes.length >= 2 || tough) {
      const id = best(['starfall', 'thunder', 'blaze', 'frost', 'fire']);
      if (id) return { type: 'skill', skill: id, target: ref(strongest) };
    }
    if (strongest && strongest.hp > atkOf(a) * 1.5) {
      const id = best(['frost', 'fire']);
      if (id) return { type: 'skill', skill: id, target: ref(strongest) };
    }
    return attack();
  }
  if (a.id === 'warrior') {
    if (tough && can('warcry') && living.filter((x) => x.buff.atk <= 1).length >= 2 && b.round <= 1) return { type: 'skill', skill: 'warcry' };
    if (b.boss && can('provoke') && a.provoke <= 0 && hpFrac(a) > 0.6 && living.some((x) => x.id === 'mage' || x.id === 'cleric') && b.rng.chance(0.35)) return { type: 'skill', skill: 'provoke' };
    if (foes.length >= 3 && can('cleave') && a.mp >= 12) return { type: 'skill', skill: 'cleave' };
    if (tough && can('titan')) return { type: 'skill', skill: 'titan', target: ref(strongest) };
    if (tough && can('slash')) return { type: 'skill', skill: 'slash', target: ref(strongest) };
    if (strongest.hp > atkOf(a) * 1.2 && can('slash') && a.mp > 6) return { type: 'skill', skill: 'slash', target: ref(strongest) };
    return attack(tough ? strongest : weakest);
  }
  if (a.id === 'thief') {
    const unstolen = foes.find((f) => !f.stolen && f.d.steal && f.boss);
    if (unstolen && can('steal') && b.rng.chance(0.5)) return { type: 'skill', skill: can('mug') ? 'mug' : 'steal', target: ref(unstolen) };
    if (tough && can('rush') && foes.length >= 2) return { type: 'skill', skill: 'rush' };
    if (tough && can('twin')) return { type: 'skill', skill: 'twin', target: ref(strongest) };
    if (b.boss && can('venom') && strongest.st.poison <= 0) return { type: 'skill', skill: 'venom', target: ref(strongest) };
    return attack(tough ? strongest : weakest);
  }
  return attack();
}

export function autoCommands(b) {
  return b.allies.map((a) => autoCommand(b, a));
}

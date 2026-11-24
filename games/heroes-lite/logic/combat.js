// Tactical combat on a small square grid (7 wide x 8 tall, portrait friendly).
// Side 0 deploys on the left, side 1 on the right. Stacks act in speed order; each can move,
// attack (with one retaliation per round), shoot, wait or defend. Each side's hero may cast one
// spell per round. Pure logic: the Battle scene animates the events this module returns.
import { CREATURES, SPELLS, SKILL_EFFECT, creatureValue } from './data.js';
import { rngFrom } from './rng.js';

export const GRID_W = 7;
export const GRID_H = 8;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

const sk = (hero, id) => (hero?.skills?.[id] || 0);
const eff = (hero, id) => (SKILL_EFFECT[id] ? SKILL_EFFECT[id][sk(hero, id)] : 0);

/**
 * side = { hero: {name, atk, def, pow, know, mana, spells, skills} | null, army: [{type,count}|null], ai: bool, owner }
 * opts = { seed, obstacles: true, defBonus: 0 (defender), terrain }
 */
export function createBattle(side0, side1, opts = {}) {
  const b = {
    w: GRID_W, h: GRID_H,
    rng: { s: (opts.seed ?? 12345) >>> 0 },
    sides: [side0, side1].map((s, i) => ({
      hero: s.hero ? { ...s.hero, spells: [...(s.hero.spells || [])], skills: { ...(s.hero.skills || {}) } } : null,
      ai: !!s.ai, owner: s.owner ?? null, cast: false, name: s.name || s.hero?.name || (i ? 'Defenders' : 'Attackers'),
      defBonus: i === 1 ? (opts.defBonus || 0) : 0,
      // Fleeing: a hero may retreat (army lost); surrender needs gold and an enemy hero to pay.
      canRetreat: !!s.hero && s.canRetreat !== false, gold: s.gold ?? null,
    })),
    stacks: [], obstacles: [], round: 1, queue: [], waitQueue: [], activeId: null,
    over: false, winner: null, fled: null, nextId: 1, terrain: opts.terrain || 'grass', log: [],
  };
  const rng = rngFrom(b.rng);
  [side0, side1].forEach((s, side) => {
    const units = s.army.map((st, slot) => (st && st.count > 0 ? { ...st, slot } : null)).filter(Boolean);
    const rows = deployRows(units.length);
    units.forEach((u, i) => {
      const c = CREATURES[u.type];
      b.stacks.push({
        id: b.nextId++, side, slot: u.slot, type: u.type, count: u.count, startCount: u.count, hp: c.hp,
        x: side === 0 ? 0 : GRID_W - 1, y: rows[i], shots: c.shots || 0, retals: c.twoRetal ? 2 : 1,
        waited: false, defending: false, buffs: { def: 0, speed: 0, bless: false }, alive: true,
      });
    });
  });
  if (opts.obstacles !== false) {
    const n = rng.int(1, 3);
    let tries = 0;
    while (b.obstacles.length < n && tries++ < 40) {
      const x = rng.int(2, GRID_W - 3); const y = rng.int(0, GRID_H - 1);
      if (!cellBlocked(b, x, y)) b.obstacles.push({ x, y, kind: rng.int(0, 2) });
    }
  }
  startRound(b);
  return b;
}

function deployRows(n) {
  if (n === 0) return [];
  const out = [];
  for (let i = 0; i < n; i++) out.push(Math.min(GRID_H - 1, Math.round(((i + 0.5) * GRID_H) / n - 0.5)));
  // Make unique (can only collide for n > GRID_H, which never happens with 7 slots max).
  return out;
}

export const stackAt = (b, x, y) => b.stacks.find((s) => s.alive && s.x === x && s.y === y);
export const inGrid = (x, y) => x >= 0 && y >= 0 && x < GRID_W && y < GRID_H;
const obstacleAt = (b, x, y) => b.obstacles.some((o) => o.x === x && o.y === y);
const cellBlocked = (b, x, y) => !inGrid(x, y) || obstacleAt(b, x, y) || !!stackAt(b, x, y);
export const getStack = (b, id) => b.stacks.find((s) => s.id === id);
export const active = (b) => getStack(b, b.activeId);
export const dist = (a, c) => Math.max(Math.abs(a.x - c.x), Math.abs(a.y - c.y));
export const alive = (b, side) => b.stacks.filter((s) => s.alive && (side === undefined || s.side === side));
export const speedOf = (s) => Math.max(1, CREATURES[s.type].speed + s.buffs.speed);

function startRound(b) {
  for (const s of b.stacks) { if (!s.alive) continue; s.waited = false; s.retals = CREATURES[s.type].twoRetal ? 2 : 1; }
  b.sides.forEach((sd) => { sd.cast = false; });
  b.queue = alive(b).sort((a, c) => speedOf(c) - speedOf(a) || a.side - c.side || a.id - c.id).map((s) => s.id);
  b.waitQueue = [];
  nextActive(b, []);
}

function nextActive(b, events) {
  for (;;) {
    if (checkOver(b)) { b.activeId = null; return; }
    let id = b.queue.shift();
    if (id === undefined) id = b.waitQueue.shift();
    if (id === undefined) {
      b.round += 1;
      events.push({ type: 'round', round: b.round });
      if (b.round > 40) { b.over = true; b.winner = 1; b.activeId = null; events.push({ type: 'timeout' }); return; }
      startRound(b);
      return;
    }
    const s = getStack(b, id);
    if (!s || !s.alive) continue;
    b.activeId = id;
    s.defending = false;
    if (CREATURES[s.type].regen && s.hp < CREATURES[s.type].hp) {
      s.hp = CREATURES[s.type].hp;
      events.push({ type: 'regen', id: s.id });
    }
    return;
  }
}

function checkOver(b) {
  if (b.over) return true;
  const a0 = alive(b, 0).length; const a1 = alive(b, 1).length;
  if (a0 && a1) return false;
  b.over = true;
  b.winner = a0 ? 0 : 1;
  return true;
}

/** Cells the stack can move to this turn: Map key 'x,y' -> steps. */
export function reachable(b, s) {
  const sp = speedOf(s);
  const out = new Map();
  if (CREATURES[s.type].fly) {
    for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) {
      const d = dist(s, { x, y });
      if (d > 0 && d <= sp && !cellBlocked(b, x, y)) out.set(`${x},${y}`, d);
    }
    return out;
  }
  const seen = new Map([[`${s.x},${s.y}`, 0]]);
  let frontier = [[s.x, s.y]];
  for (let d = 1; d <= sp && frontier.length; d++) {
    const next = [];
    for (const [x, y] of frontier) {
      for (const [dx, dy] of DIRS) {
        const nx = x + dx; const ny = y + dy; const k = `${nx},${ny}`;
        if (seen.has(k) || cellBlocked(b, nx, ny)) continue;
        seen.set(k, d); out.set(k, d); next.push([nx, ny]);
      }
    }
    frontier = next;
  }
  return out;
}

/** Walking path (list of cells) from the stack to (tx, ty), for animation. Fliers go straight. */
export function pathTo(b, s, tx, ty) {
  if (CREATURES[s.type].fly || (s.x === tx && s.y === ty)) return [{ x: tx, y: ty }];
  const prev = new Map([[`${s.x},${s.y}`, null]]);
  const q = [[s.x, s.y]];
  while (q.length) {
    const [x, y] = q.shift();
    if (x === tx && y === ty) break;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx; const ny = y + dy; const k = `${nx},${ny}`;
      if (prev.has(k) || cellBlocked(b, nx, ny)) continue;
      prev.set(k, [x, y]); q.push([nx, ny]);
    }
  }
  const path = [];
  let cur = [tx, ty];
  while (cur && !(cur[0] === s.x && cur[1] === s.y)) { path.unshift({ x: cur[0], y: cur[1] }); cur = prev.get(`${cur[0]},${cur[1]}`); }
  return path;
}

export const enemiesAdjacent = (b, s) => alive(b, 1 - s.side).some((e) => dist(e, s) === 1);
export const canShoot = (b, s) => s.shots > 0 && !enemiesAdjacent(b, s);

/** All melee options: [{ target, x, y }] where (x, y) is the cell the attacker strikes from. */
export function meleeOptions(b, s) {
  const reach = reachable(b, s);
  const out = [];
  for (const e of alive(b, 1 - s.side)) {
    for (const [dx, dy] of DIRS) {
      const x = e.x + dx; const y = e.y + dy;
      if (!inGrid(x, y)) continue;
      if ((x === s.x && y === s.y) || reach.has(`${x},${y}`)) out.push({ target: e.id, x, y });
    }
  }
  return out;
}

function heroOf(b, side) { return b.sides[side].hero; }

function attackStat(b, s) { return CREATURES[s.type].atk + (heroOf(b, s.side)?.atk || 0); }
function defenseStat(b, s) {
  const c = CREATURES[s.type];
  let d = c.def + (heroOf(b, s.side)?.def || 0) + s.buffs.def + b.sides[s.side].defBonus;
  if (s.defending) d = Math.round(d * 1.3);
  return d;
}

/**
 * Damage att deals to def. mode: 'melee' | 'ranged' | 'retal'. avg=true gives the expected value (AI).
 * moved = squares charged (cavalier joust).
 */
export function calcDamage(b, att, def, { mode = 'melee', avg = false, moved = 0, rng } = {}) {
  const c = CREATURES[att.type];
  let base;
  if (att.buffs.bless) base = c.max * att.count;
  else if (avg) base = ((c.min + c.max) / 2) * att.count;
  else {
    const n = Math.min(att.count, 10);
    let sum = 0;
    for (let i = 0; i < n; i++) sum += rng.int(c.min, c.max);
    base = (sum * att.count) / n;
  }
  const A = attackStat(b, att); const D = defenseStat(b, def);
  let mult = A >= D ? Math.min(3, 1 + 0.05 * (A - D)) : Math.max(0.3, 1 - 0.025 * (D - A));
  const ah = heroOf(b, att.side); const dh = heroOf(b, def.side);
  if (mode === 'ranged') mult *= 1 + eff(ah, 'archery');
  else mult *= 1 + eff(ah, 'offense');
  mult *= 1 - eff(dh, 'armorer');
  if (mode !== 'ranged' && c.shots) mult *= 0.5;          // shooters are weak in melee
  if (c.joust && mode === 'melee') mult *= 1 + 0.05 * moved;
  let dmg = base * mult;
  if (c.deathBlow) {
    if (avg) dmg *= 1.2;
    else if (rng() < 0.2) dmg *= 2;
  }
  return Math.max(1, Math.floor(dmg));
}

export const totalHp = (s) => (s.alive ? (s.count - 1) * CREATURES[s.type].hp + s.hp : 0);

/** Apply damage to a stack, returns creatures killed. */
function hurt(s, dmg) {
  const hpMax = CREATURES[s.type].hp;
  const before = s.count;
  const left = totalHp(s) - dmg;
  if (left <= 0) { s.count = 0; s.hp = 0; s.alive = false; return before; }
  s.count = Math.ceil(left / hpMax);
  s.hp = left - (s.count - 1) * hpMax;
  return before - s.count;
}

function heal(s, amount, revive = true) {
  const hpMax = CREATURES[s.type].hp;
  const cap = (revive ? s.startCount : s.count) * hpMax;
  const now = totalHp(s);
  const next = Math.min(cap, now + amount);
  s.count = Math.ceil(next / hpMax);
  s.hp = next - (s.count - 1) * hpMax;
  return next - now;
}

/** Simulate damage on a copy: how many die and how much value is removed (for the AI). */
function simHurt(s, dmg) {
  const copy = { ...s };
  const hpBefore = totalHp(copy);
  const killed = hurt(copy, dmg);
  const removed = Math.min(hpBefore, dmg);
  return { killed, removed, dead: !copy.alive, after: copy };
}

function strike(b, att, def, mode, events, rng, moved = 0) {
  const dmg = calcDamage(b, att, def, { mode, rng, moved });
  const killed = hurt(def, dmg);
  events.push({ type: mode === 'ranged' ? 'shoot' : (mode === 'retal' ? 'retaliate' : 'attack'), id: att.id, target: def.id, dmg, killed, dead: !def.alive });
  if (CREATURES[att.type].drain && dmg > 0) {
    const healed = heal(att, Math.min(dmg, killed * CREATURES[def.type].hp + 1));
    if (healed > 0) events.push({ type: 'drain', id: att.id, amount: healed });
  }
  if (CREATURES[att.type].splash && mode === 'ranged') {
    for (const o of b.stacks) {
      if (!o.alive || o.id === def.id || dist(o, def) !== 1 || CREATURES[o.type].undead) continue;
      const d2 = Math.max(1, Math.floor(dmg / 2));
      const k2 = hurt(o, d2);
      events.push({ type: 'splash', id: att.id, target: o.id, dmg: d2, killed: k2, dead: !o.alive });
    }
  }
}

/** Mana cost for a side's hero (Wisdom makes spells cheaper). */
export function spellCost(hero, id) { return Math.max(1, SPELLS[id].cost - sk(hero, 'wisdom')); }

export function castable(b, side) {
  const sd = b.sides[side];
  const h = sd.hero;
  if (!h || sd.cast) return [];
  return h.spells.filter((id) => SPELLS[id] && h.mana >= spellCost(h, id));
}

/** Valid targets of a spell: stack ids, or cells for area spells. */
export function spellTargets(b, side, id) {
  const sp = SPELLS[id];
  if (sp.target === 'area') {
    const out = [];
    for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) out.push({ x, y });
    return out;
  }
  const want = sp.target === 'enemy' ? 1 - side : side;
  return alive(b, want).filter((s) => {
    if (id === 'cure') return totalHp(s) < s.startCount * CREATURES[s.type].hp;
    if (id === 'bless') return !s.buffs.bless;
    if (id === 'haste') return s.buffs.speed <= 0;
    if (id === 'slow') return s.buffs.speed >= 0;
    if (id === 'stoneskin') return s.buffs.def === 0;
    return true;
  }).map((s) => ({ id: s.id, x: s.x, y: s.y }));
}

export function spellDamage(hero, id) {
  const p = hero.pow;
  const base = { arrow: 10 + 10 * p, ice: 20 + 20 * p, lightning: 25 + 25 * p, fireball: 15 + 15 * p }[id] || 0;
  return Math.round(base * (1 + eff(hero, 'sorcery')));
}

function castSpell(b, side, id, target, events) {
  const h = b.sides[side].hero;
  h.mana -= spellCost(h, id);
  b.sides[side].cast = true;
  const sp = SPELLS[id];
  const ev = { type: 'cast', side, spell: id, x: target.x, y: target.y, hits: [] };
  events.push(ev);
  const dmgTo = (s, dmg) => {
    const d = CREATURES[s.type].resist ? Math.floor(dmg * 0.6) : dmg;
    const killed = hurt(s, d);
    ev.hits.push({ target: s.id, dmg: d, killed, dead: !s.alive });
  };
  if (sp.target === 'area') {
    for (const s of alive(b)) if (dist(s, target) <= 1) dmgTo(s, spellDamage(h, id));
  } else {
    const s = getStack(b, target.id);
    if (!s) return;
    if (['arrow', 'ice', 'lightning'].includes(id)) dmgTo(s, spellDamage(h, id));
    else if (id === 'cure') ev.hits.push({ target: s.id, healed: heal(s, 20 + 10 * h.pow) });
    else if (id === 'stoneskin') { s.buffs.def = 5; ev.hits.push({ target: s.id }); }
    else if (id === 'haste') { s.buffs.speed = 2; ev.hits.push({ target: s.id }); }
    else if (id === 'slow') { s.buffs.speed = -2; ev.hits.push({ target: s.id }); }
    else if (id === 'bless') { s.buffs.bless = true; ev.hits.push({ target: s.id }); }
  }
}

/** Gold it costs a side to surrender now: half the price of the troops it still has. */
export function surrenderCost(b, side) {
  let g = 0;
  for (const s of alive(b, side)) g += (CREATURES[s.type].cost.gold || 0) * s.count;
  return Math.max(100, Math.round(g / 2 / 10) * 10);
}

/** Which ways out does a side have? { retreat, surrender: cost|null } */
export function fleeOptions(b, side) {
  const sd = b.sides[side];
  const foe = b.sides[1 - side];
  const out = { retreat: !!sd.hero && sd.canRetreat, surrender: null };
  if (sd.hero && foe.hero && sd.gold !== null) {
    const cost = surrenderCost(b, side);
    if (sd.gold >= cost) out.surrender = cost;
  }
  return out;
}

/**
 * Perform an action for the active stack (or a hero spell). Returns animation events.
 * action: {type:'move',x,y} | {type:'attack',target,x,y} | {type:'shoot',target} | {type:'wait'} | {type:'defend'}
 *         | {type:'cast', spell, target:{id}|{x,y}}  (cast does not end the stack's turn)
 */
export function act(b, action) {
  const events = [];
  if (b.over) return events;
  const s = active(b);
  const rng = rngFrom(b.rng);
  if (action.type === 'cast') {
    if (!castable(b, s.side).includes(action.spell)) return events;
    castSpell(b, s.side, action.spell, action.target, events);
    if (!s.alive || checkOver(b)) nextActive(b, events);
    return events;
  }
  if (action.type === 'retreat' || action.type === 'surrender') {
    const opt = fleeOptions(b, s.side);
    if (action.type === 'retreat' && !opt.retreat) return events;
    if (action.type === 'surrender' && opt.surrender === null) return events;
    b.over = true;
    b.winner = 1 - s.side;
    b.activeId = null;
    b.fled = { side: s.side, how: action.type, cost: action.type === 'surrender' ? opt.surrender : 0 };
    events.push({ type: 'flee', side: s.side, how: action.type });
    return events;
  }
  if (action.type === 'move') {
    const reach = reachable(b, s);
    if (!reach.has(`${action.x},${action.y}`)) return events;
    const path = pathTo(b, s, action.x, action.y);
    s.x = action.x; s.y = action.y;
    events.push({ type: 'move', id: s.id, path });
  } else if (action.type === 'attack') {
    const t = getStack(b, action.target);
    if (!t || !t.alive || t.side === s.side) return events;
    let moved = 0;
    if (action.x !== s.x || action.y !== s.y) {
      const reach = reachable(b, s);
      if (!reach.has(`${action.x},${action.y}`)) return events;
      const path = pathTo(b, s, action.x, action.y);
      moved = reach.get(`${action.x},${action.y}`);
      s.x = action.x; s.y = action.y;
      events.push({ type: 'move', id: s.id, path });
    }
    if (dist(s, t) !== 1) return events;
    strike(b, s, t, 'melee', events, rng, moved);
    if (t.alive && t.retals > 0 && !CREATURES[s.type].noRetal) {
      t.retals -= 1;
      strike(b, t, s, 'retal', events, rng);
    }
  } else if (action.type === 'shoot') {
    const t = getStack(b, action.target);
    if (!t || !t.alive || !canShoot(b, s)) return events;
    s.shots -= 1;
    strike(b, s, t, 'ranged', events, rng);
  } else if (action.type === 'wait') {
    if (s.waited) return act(b, { type: 'defend' });
    s.waited = true;
    // Waiting stacks act after everyone else, slowest first.
    b.waitQueue.push(s.id);
    b.waitQueue.sort((a, c) => speedOf(getStack(b, a)) - speedOf(getStack(b, c)));
    events.push({ type: 'wait', id: s.id });
  } else if (action.type === 'defend') {
    events.push({ type: 'defend', id: s.id });
  } else return events;
  nextActive(b, events);
  if (action.type === 'defend') s.defending = true;
  return events;
}

// ---------- Computer play ----------

/**
 * Tactical AI presets, blended by adaptive skill.
 * noise: random error on every evaluation; retal: how much it fears retaliation;
 * focus: preference for shooters and finishing kills; spell: chance to look for a spell each round;
 * hold: keep melee units back to guard own shooters.
 */
export const TACTIC_PRESETS = {
  easy: { noise: 0.6, retal: 0, focus: 0, spell: 0.35, hold: 0, flee: 0 },
  normal: { noise: 0.2, retal: 0.6, focus: 0.5, spell: 0.8, hold: 0.5, flee: 0.22 },
  hard: { noise: 0, retal: 1, focus: 1, spell: 1, hold: 1, flee: 0.3 },
};

const valueOfHp = (s, hp) => (hp / CREATURES[s.type].hp) * creatureValue(s.type);

function threat(b, s) {
  // How much damage this stack would do to a typical target: drives focus fire.
  const c = CREATURES[s.type];
  return ((c.min + c.max) / 2) * s.count * (c.shots && s.shots > 0 ? 1.5 : 1);
}

function attackValue(b, s, t, mode, p, moved = 0) {
  const dmg = calcDamage(b, s, t, { mode, avg: true, moved });
  const r = simHurt(t, dmg);
  let v = valueOfHp(t, r.removed);
  if (r.dead) v *= 1 + 0.3 * p.focus;
  if (CREATURES[t.type].shots && t.shots > 0) v *= 1 + 0.5 * p.focus;
  v *= 1 + 0.002 * p.focus * threat(b, t) / Math.max(1, creatureValue(t.type));
  if (mode === 'melee' && !r.dead && t.retals > 0 && !CREATURES[s.type].noRetal && p.retal > 0) {
    const back = calcDamage(b, r.after, s, { mode: 'retal', avg: true });
    v -= p.retal * 0.8 * valueOfHp(s, simHurt(s, back).removed);
  }
  return v;
}

function bestSpell(b, side, p, rng) {
  const h = b.sides[side].hero;
  let best = null;
  for (const id of castable(b, side)) {
    for (const t of spellTargets(b, side, id)) {
      let v = 0;
      if (SPELLS[id].target === 'area') {
        for (const s of alive(b)) {
          if (dist(s, t) > 1) continue;
          const val = valueOfHp(s, simHurt(s, spellDamage(h, id)).removed);
          v += s.side === side ? -val * 1.2 : val;
        }
      } else {
        const s = getStack(b, t.id);
        if (['arrow', 'ice', 'lightning'].includes(id)) v = valueOfHp(s, simHurt(s, spellDamage(h, id) * (CREATURES[s.type].resist ? 0.6 : 1)).removed);
        else if (id === 'cure') v = valueOfHp(s, Math.min(20 + 10 * h.pow, s.startCount * CREATURES[s.type].hp - totalHp(s))) * 0.9;
        else if (id === 'bless') v = creatureValue(s.type) * s.count * 0.18;
        else if (id === 'stoneskin') v = creatureValue(s.type) * s.count * 0.12;
        else if (id === 'haste') v = creatureValue(s.type) * s.count * (CREATURES[s.type].shots ? 0.04 : 0.12);
        else if (id === 'slow') v = creatureValue(s.type) * s.count * (CREATURES[s.type].shots ? 0.04 : 0.14);
      }
      v *= 1 + p.noise * (rng() * 2 - 1);
      if (!best || v > best.v) best = { v, spell: id, target: t.id ? { id: t.id, x: t.x, y: t.y } : { x: t.x, y: t.y } };
    }
  }
  return best && best.v > 0 ? best : null;
}

/** Choose an action for the active stack. p = tactic params (see TACTIC_PRESETS). */
export function chooseAction(b, p = TACTIC_PRESETS.normal) {
  const s = active(b);
  if (!s) return null;
  const rng = rngFrom(b.rng);
  const jitter = (v) => v * (1 + p.noise * (rng() * 2 - 1));
  // A hopeless fight: save the hero (and the army, if we can pay for it).
  if (p.flee > 0 && b.round >= 2 && b.sides[s.side].hero) {
    const mine = sideValue(b, s.side); const theirs = sideValue(b, 1 - s.side);
    if (mine < theirs * p.flee) {
      const opt = fleeOptions(b, s.side);
      const gold = b.sides[s.side].gold ?? 0;
      if (opt.surrender !== null && opt.surrender <= gold * 0.6) return { type: 'surrender' };
      const h = b.sides[s.side].hero;
      if (opt.retreat && ((h.level || 1) >= 3 || (h.artifacts || 0) > 0 || mine < theirs * p.flee * 0.5)) return { type: 'retreat' };
    }
  }
  // Hero spell first (once per round).
  if (!b.sides[s.side].cast && b.sides[s.side].hero && rng() < p.spell) {
    const sp = bestSpell(b, s.side, p, rng);
    if (sp && sp.v > creatureValue(s.type) * 0.5) return { type: 'cast', spell: sp.spell, target: sp.target };
  }
  const enemies = alive(b, 1 - s.side);
  let best = null;
  const consider = (action, v) => { const jv = jitter(v); if (!best || jv > best.v) best = { v: jv, action }; };
  if (canShoot(b, s)) {
    for (const e of enemies) consider({ type: 'shoot', target: e.id }, attackValue(b, s, e, 'ranged', p) * 1.05);
  }
  const reach = reachable(b, s);
  for (const o of meleeOptions(b, s)) {
    const t = getStack(b, o.target);
    const moved = o.x === s.x && o.y === s.y ? 0 : reach.get(`${o.x},${o.y}`) || 0;
    let v = attackValue(b, s, t, 'melee', p, moved);
    // Shooters prefer not to walk into melee.
    if (CREATURES[s.type].shots && s.shots > 0) v *= 0.4;
    consider({ type: 'attack', target: t.id, x: o.x, y: o.y }, v);
  }
  if (best && best.v > 0) return best.action;
  if (CREATURES[s.type].shots && s.shots > 0 && !enemiesAdjacent(b, s)) {
    // A shooter with nothing worth shooting (shouldn't happen) just defends.
    return { type: 'defend' };
  }
  // No attack: advance toward the most attractive enemy, or hold to guard our shooters.
  const ownRanged = alive(b, s.side).filter((x) => CREATURES[x.type].shots && x.shots > 0).reduce((a, x) => a + creatureValue(x.type) * x.count, 0);
  const foeRanged = enemies.filter((x) => CREATURES[x.type].shots && x.shots > 0).reduce((a, x) => a + creatureValue(x.type) * x.count, 0);
  if (p.hold > 0 && ownRanged > foeRanged * 1.2 && rng() < p.hold && b.round <= 4) {
    return s.waited ? { type: 'defend' } : { type: 'wait' };
  }
  let target = null;
  for (const e of enemies) {
    const score = jitter(creatureValue(e.type) * e.count * (CREATURES[e.type].shots ? 1 + p.focus : 1)) / (1 + dist(s, e));
    if (!target || score > target.score) target = { e, score };
  }
  if (!target) return { type: 'defend' };
  let move = null;
  for (const [k, d] of reach) {
    const [x, y] = k.split(',').map(Number);
    const dd = dist({ x, y }, target.e) * 10 + d * 0.1;
    if (!move || dd < move.dd) move = { x, y, dd };
  }
  if (move && dist(move, target.e) < dist(s, target.e)) return { type: 'move', x: move.x, y: move.y };
  return { type: 'defend' };
}

const sideValue = (b, side) => alive(b, side).reduce((a, s) => a + valueOfHp(s, totalHp(s)), 0);

/** Run the battle to the end with the computer playing both sides (auto-combat / quick battle). */
export function autoResolve(b, p0 = TACTIC_PRESETS.normal, p1 = TACTIC_PRESETS.normal, maxSteps = 2000) {
  let steps = 0;
  while (!b.over && steps++ < maxSteps) {
    const s = active(b);
    const a = chooseAction(b, s.side === 0 ? p0 : p1);
    const ev = act(b, a);
    if (!ev.length) act(b, { type: 'defend' });
  }
  if (!b.over) { b.over = true; b.winner = 1; }
  return result(b);
}

/** Battle outcome: survivors per original army slot, experience, losses. */
export function result(b) {
  const out = { winner: b.winner, fled: b.fled, sides: [] };
  for (let side = 0; side < 2; side++) {
    const own = b.stacks.filter((s) => s.side === side);
    const foe = b.stacks.filter((s) => s.side !== side);
    const survivors = own.map((s) => ({ slot: s.slot, type: s.type, count: s.alive ? s.count : 0 }));
    const lost = own.map((s) => ({ type: s.type, lost: s.startCount - (s.alive ? s.count : 0) })).filter((l) => l.lost > 0);
    const killedHp = foe.reduce((a, s) => a + (s.startCount - (s.alive ? s.count : 0)) * CREATURES[s.type].hp, 0);
    const killedLiving = foe.filter((s) => !CREATURES[s.type].undead).reduce((a, s) => a + (s.startCount - (s.alive ? s.count : 0)) * CREATURES[s.type].hp, 0);
    out.sides.push({ survivors, lost, killedHp, killedLiving, mana: b.sides[side].hero?.mana ?? 0 });
  }
  return out;
}

// Computer commander. aiStep() picks ONE next action (move + act, or build) so the screen can animate
// each move; it returns null when the turn should end. The adaptive skill (0..1) only changes how
// the computer decides (risk, focus fire, guarding, building, noise); it never gets extra funds or units.
import { UNITS, UNIT_ORDER, TERRAIN, CAPTURE_POINTS, baseDamage, displayHp, isRanged } from './data.js';
import * as G from './game.js';
import { rngFrom } from './rng.js';

export const PRESETS = {
  easy: {
    noise: 0.9, risk: 0.35, suicide: 0.6, kill: 0.25, guard: 0, terrain: 0.2, goal: 0.7,
    build: 0.15, capture: 0.7, hunt: 0, hold: 0.2, threatAware: 0.5,
  },
  normal: {
    noise: 0.3, risk: 0.4, suicide: 1, kill: 0.7, guard: 0.6, terrain: 0.7, goal: 1,
    build: 0.7, capture: 1, hunt: 0.4, hold: 0.7, threatAware: 1,
  },
  hard: {
    noise: 0.04, risk: 0.4, suicide: 1.3, kill: 1.1, guard: 1, terrain: 1, goal: 1.15,
    build: 1, capture: 1.2, hunt: 0.8, hold: 1, threatAware: 1,
  },
};

/** Blend the presets at skill s (0 easy, 0.5 normal, 1 hard). */
export function aiParams(skill) {
  const s = Math.max(0, Math.min(1, skill));
  const { easy, normal, hard } = PRESETS;
  const out = { skill: s };
  for (const k of Object.keys(normal)) {
    out[k] = s <= 0.5 ? easy[k] + (normal[k] - easy[k]) * (s / 0.5) : normal[k] + (hard[k] - normal[k]) * ((s - 0.5) / 0.5);
  }
  return out;
}

const PROP_VALUE = { city: 3000, factory: 5000, hq: 12000 };

// ---------- Situation analysis (rebuilt for every step) ----------

/** Per tile, the enemy units that could attack it next turn. */
function threatMap(s, side) {
  const map = new Array(s.w * s.h);
  for (let i = 0; i < map.length; i++) map[i] = [];
  for (const e of s.units) {
    if (e.side === side) continue;
    const seen = new Set();
    const mark = (x, y) => {
      if (!G.inMap(s, x, y)) return;
      const i = G.idx(s, x, y);
      if (seen.has(i)) return;
      seen.add(i);
      map[i].push(e);
    };
    if (isRanged(e.type)) {
      for (const [x, y] of G.rangeTiles(s, e.type, e.x, e.y)) mark(x, y);
    } else {
      for (const n of G.reachable(s, e).values()) {
        mark(n.x + 1, n.y); mark(n.x - 1, n.y); mark(n.x, n.y + 1); mark(n.x, n.y - 1);
      }
    }
  }
  return map;
}

/** Multi-source distance field in movement cost for a unit type, ignoring units. */
function field(s, type, sources) {
  const D = new Array(s.w * s.h).fill(Infinity);
  const open = [];
  for (const [x, y] of sources) {
    if (!G.inMap(s, x, y)) continue;
    const i = G.idx(s, x, y);
    if (D[i] === 0) continue;
    D[i] = 0; open.push(i);
  }
  // Bucketed Dijkstra: costs are small integers.
  let bucket = 0; const buckets = [open];
  while (bucket < buckets.length) {
    const list = buckets[bucket];
    if (!list || !list.length) { bucket++; continue; }
    const i = list.pop();
    if (D[i] !== bucket) continue;
    const x = i % s.w; const y = (i - x) / s.w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy;
      if (!G.inMap(s, nx, ny)) continue;
      // Cost of stepping from n into i equals entering i; we search backwards so use the cost of i.
      const c = G.moveCost(type, G.terrainAt(s, x, y)) || 0;
      const ni = G.idx(s, nx, ny);
      const enter = G.moveCost(type, G.terrainAt(s, nx, ny));
      if (!enter || !c) continue;
      const nd = bucket + c;
      if (nd < D[ni]) { D[ni] = nd; (buckets[nd] ||= []).push(ni); }
    }
  }
  return D;
}

// Distance fields from a single building never change (terrain is fixed), so they are kept for good.
const staticFields = new Map();
// Everything else is reused while the enemy army and building owners stay the same during a turn.
let turnCache = { key: null, threat: null, fields: null };

function makeCtx(s, side, P) {
  const enemies = s.units.filter((u) => u.side !== side);
  const key = `${s.mapId}|${s.day}|${s.turn}|${side}|${enemies.map((e) => `${e.id}@${e.x},${e.y}`).join(';')}|${s.props.map((p) => p.owner).join('')}`;
  if (turnCache.key !== key) turnCache = { key, threat: threatMap(s, side), fields: new Map() };
  const ctx = {
    s, side, P,
    rng: rngFrom(s.rng),
    enemies,
    own: s.units.filter((u) => u.side === side),
    threat: turnCache.threat,
    fields: turnCache.fields,
    // Later in a battle the computer gets braver, so two careful sides don't stare at each other forever.
    boldness: Math.min(1, Math.max(0, (s.day - 4) / 14)),
  };
  ctx.enemyHq = G.hqOf(s, 1 - side);
  ctx.ownHq = G.hqOf(s, side);
  ctx.capTargets = assignCaptures(ctx);
  // Enemy foot soldiers closing in on our HQ: send the nearest fighters after them.
  ctx.hqThreats = new Set();
  ctx.defenders = new Map();
  if (ctx.ownHq) {
    const hq = ctx.ownHq;
    const raiders = enemies.filter((e) => UNITS[e.type].capture && G.dist(e.x, e.y, hq.x, hq.y) <= UNITS[e.type].move * 2 + 1);
    const free = ctx.own.filter((u) => !ctx.capTargets.has(u.id));
    for (const e of raiders) {
      ctx.hqThreats.add(e);
      free.sort((a, b) => G.dist(a.x, a.y, e.x, e.y) - G.dist(b.x, b.y, e.x, e.y));
      for (const u of free.splice(0, 2)) if (G.canHit(u.type, e.type)) ctx.defenders.set(u.id, e);
    }
  }
  return ctx;
}

function cachedField(ctx, key, type, sources) {
  const k = `${key}|${UNITS[type].moveType}`;
  if (!ctx.fields.has(k)) ctx.fields.set(k, field(ctx.s, type, sources));
  return ctx.fields.get(k);
}

function propField(ctx, p, type) {
  const k = `${ctx.s.mapId}|${ctx.s.w}x${ctx.s.h}|${p.x},${p.y}|${UNITS[type].moveType}`;
  let D = staticFields.get(k);
  if (!D) { D = field(ctx.s, type, [[p.x, p.y]]); staticFields.set(k, D); }
  return D;
}

/** Send each capturer to a different building (nearest first). Returns Map unitId -> prop. */
function assignCaptures(ctx) {
  const { s, side } = ctx;
  const out = new Map();
  const targets = s.props.filter((p) => p.owner !== side);
  if (!targets.length) return out;
  const capturers = ctx.own.filter((u) => UNITS[u.type].capture);
  const pairs = [];
  for (const u of capturers) {
    for (const p of targets) {
      const D = propField(ctx, p, u.type);
      const d = D[G.idx(s, u.x, u.y)];
      if (!Number.isFinite(d)) continue;
      // Prefer close and valuable buildings; the enemy HQ is worth walking a bit further for.
      let w = d / UNITS[u.type].move;
      if (p.kind === 'hq') w -= 1.5;
      if (p.kind === 'factory') w -= 0.5;
      if (p.capBy === u.id) w -= 10;
      // Buildings deep among enemies are less attractive.
      w += Math.min(3, ctx.threat[G.idx(s, p.x, p.y)].length * 0.6);
      pairs.push({ u, p, w });
    }
  }
  pairs.sort((a, b) => a.w - b.w);
  const usedU = new Set(); const usedP = new Set();
  for (const { u, p } of pairs) {
    if (usedU.has(u.id) || usedP.has(p)) continue;
    // Leave some foot soldiers free to fight once buildings are mostly taken.
    out.set(u.id, p);
    usedU.add(u.id); usedP.add(p);
  }
  return out;
}

/** Expected damage (hp points) unit u would take at tile (x, y) with hp, ignoring `skip` (a unit we kill). */
function exposure(ctx, u, x, y, hp, skip) {
  const list = ctx.threat[G.idx(ctx.s, x, y)];
  if (!list.length) return 0;
  const dmgs = [];
  for (const e of list) {
    if (e === skip) continue;
    dmgs.push(G.damage(ctx.s, e.type, e.hp, u.type, hp, x, y));
  }
  dmgs.sort((a, b) => b - a);
  // The strongest two hits count fully, more attackers count half (they have other targets too).
  let total = 0;
  dmgs.forEach((d, i) => { total += i < 2 ? d : d * 0.5; });
  return Math.min(hp, total * ctx.P.threatAware);
}

// ---------- Scoring ----------

function goalField(ctx, u) {
  const { s } = ctx;
  const foe = ctx.defenders.get(u.id);
  if (foe) {
    const src = [[foe.x + 1, foe.y], [foe.x - 1, foe.y], [foe.x, foe.y + 1], [foe.x, foe.y - 1], [foe.x, foe.y]];
    return { D: cachedField(ctx, `hunt${foe.id}`, u.type, src), w: 1.6 };
  }
  const d = UNITS[u.type];
  if (d.harvest) {
    const dunes = [];
    for (let i = 0; i < s.terrain.length; i++) if (s.terrain[i] === 'dunes') dunes.push([i % s.w, Math.floor(i / s.w)]);
    if (dunes.length) return { D: cachedField(ctx, 'dunes', u.type, dunes), w: 1.5 };
  }
  if (d.supply) {
    // Follow hurt friends, otherwise the army.
    const hurt = ctx.own.filter((o) => o !== u && o.hp <= 70 && !UNITS[o.type].unarmed);
    const src = (hurt.length ? hurt : ctx.own.filter((o) => o !== u && !UNITS[o.type].unarmed)).map((o) => [o.x, o.y]);
    if (src.length) return { D: cachedField(ctx, `supply${hurt.length}`, u.type, src), w: 0.8 };
  }
  const cap = ctx.capTargets.get(u.id);
  if (cap) return { D: propField(ctx, cap, u.type), w: 1.2 * ctx.P.capture };
  if (isRanged(u.type)) {
    // Artillery wants to be 2-3 tiles from enemies, not next to them.
    const src = [];
    for (const e of ctx.enemies) for (const [x, y] of G.rangeTiles(s, u.type, e.x, e.y)) src.push([x, y]);
    if (src.length) return { D: cachedField(ctx, 'artyline', u.type, src), w: 0.8 };
  }
  const src = [];
  for (const e of ctx.enemies) {
    if (!G.canHit(u.type, e.type)) continue;
    src.push([e.x, e.y]);
  }
  // Defend own buildings that enemy foot soldiers are capturing.
  for (const p of s.props) if (p.owner === ctx.side && p.capBy) src.push([p.x, p.y]);
  if (ctx.enemyHq) src.push([ctx.enemyHq.x, ctx.enemyHq.y]);
  if (!src.length) for (const p of s.props) if (p.owner !== ctx.side) src.push([p.x, p.y]);
  if (!src.length) return null;
  const key = `enemies:${u.type === 'drone' ? 'air' : UNITS[u.type].air ? 'air' : u.type}`;
  return { D: cachedField(ctx, key, u.type, src), w: 1 };
}

/** Value of standing at (x, y) at the end of this action with hp left. */
function positionScore(ctx, u, x, y, hp, skip, goal) {
  const { s, P } = ctx;
  const cost = UNITS[u.type].cost * hp / 100;
  let v = 0;
  v += P.terrain * G.defStars(s, u.type, x, y) * cost * 0.025;
  // Risk of being shot next turn.
  const exp = exposure(ctx, u, x, y, hp, skip);
  const riskW = P.risk * (1 - 0.55 * ctx.boldness) * (isRanged(u.type) || UNITS[u.type].unarmed ? 1.5 : 1);
  v -= riskW * exp / 100 * UNITS[u.type].cost;
  if (exp >= hp) v -= P.suicide * cost * 0.6;
  // Progress toward the unit's goal.
  if (goal) {
    const here = goal.D[G.idx(s, u.x, u.y)];
    const there = goal.D[G.idx(s, x, y)];
    if (Number.isFinite(there)) {
      const per = UNITS[u.type].cost * 0.035 * goal.w * P.goal * (1 + ctx.boldness);
      const gain = Number.isFinite(here) ? here - there : 4;
      v += gain * Math.max(60, per);
      // Being right at the goal is good in itself.
      if (there === 0) v += Math.max(60, per) * 2;
    }
  }
  // Guard artillery: stand next to a threatened friendly gun.
  if (!isRanged(u.type) && P.guard > 0) {
    for (const r of ctx.own) {
      if (r === u || !isRanged(r.type)) continue;
      if (G.dist(x, y, r.x, r.y) !== 1) continue;
      if (ctx.threat[G.idx(s, r.x, r.y)].length) v += P.guard * UNITS[r.type].cost * 0.12;
    }
  }
  if (UNITS[u.type].harvest && G.terrainAt(s, x, y) === 'dunes') v += UNITS[u.type].harvest * 2.5;
  if (UNITS[u.type].supply) {
    for (const o of ctx.own) {
      if (o === u || G.dist(x, y, o.x, o.y) !== 1 || o.hp >= 100) continue;
      v += Math.min(10, 100 - o.hp) / 100 * UNITS[o.type].cost * 0.6;
    }
  }
  const p = G.propAt(s, x, y);
  // Keep factories free for new units.
  if (p && p.kind === 'factory' && p.owner === ctx.side && s.funds[ctx.side] >= 1000) v -= 900;
  // Sit on the HQ if enemy foot soldiers are close.
  if (p && p.kind === 'hq' && p.owner === ctx.side) {
    const danger = ctx.enemies.some((e) => UNITS[e.type].capture && G.dist(e.x, e.y, x, y) <= UNITS[e.type].move + 1);
    if (danger) v += 2500 * P.hold;
  }
  // Heal on own buildings when hurt.
  if (p && p.owner === ctx.side && hp <= 50) v += (100 - hp) / 100 * UNITS[u.type].cost * 0.25 * P.hold;
  return v;
}

function attackValue(ctx, u, v, f) {
  const { P } = ctx;
  const vCost = UNITS[v.type].cost;
  let dealt = f.dmg / 100 * vCost;
  if (isRanged(v.type)) dealt *= 1 + P.hunt;
  if (f.kills) dealt += P.kill * vCost * 0.6 + 400;
  // Stop enemy captures, above all of the HQ.
  const p = G.propAt(ctx.s, v.x, v.y);
  if (p && p.owner === ctx.side && p.capBy === v.id) {
    const urgency = 1 - p.cap / CAPTURE_POINTS;
    const worth = p.kind === 'hq' ? 20000 : PROP_VALUE[p.kind];
    dealt += worth * (0.3 + urgency) * (f.kills ? 1.5 : f.dmg / 100);
  }
  if (ctx.hqThreats.has(v)) dealt += 4000 * ctx.P.hold * (f.kills ? 1.5 : f.dmg / 100);
  let taken = f.counter / 100 * UNITS[u.type].cost;
  if (f.counterKills) taken += UNITS[u.type].cost * 0.5 * P.suicide;
  return dealt - taken;
}

function captureValue(ctx, u, x, y) {
  const { s, P } = ctx;
  const p = G.propAt(s, x, y);
  const hpd = displayHp(u.hp);
  const left = p.cap - hpd;
  const worth = PROP_VALUE[p.kind] * (p.owner >= 0 ? 1.4 : 1);
  if (left <= 0) {
    if (p.kind === 'hq') return 1e7;
    return P.capture * worth * 1.6;
  }
  // Partial progress; staying on a capture in progress is worth more.
  const progress = (CAPTURE_POINTS - left) / CAPTURE_POINTS;
  return P.capture * worth * (0.35 + 0.65 * progress) * (p.kind === 'hq' ? 2 : 1);
}

/** Best action for one unit: { score, cmd }. */
function bestFor(ctx, u) {
  const { s } = ctx;
  const reach = G.reachable(s, u);
  const goal = goalField(ctx, u);
  let best = null;
  const consider = (score, cmd) => {
    const noisy = score + (ctx.rng() - 0.5) * ctx.P.noise * UNITS[u.type].cost * 0.5;
    if (!best || noisy > best.score) best = { score: noisy, raw: score, cmd };
  };
  for (const n of reach.values()) {
    if (!n.stop) continue;
    const moved = n.x !== u.x || n.y !== u.y;
    const to = [n.x, n.y];
    const base = positionScore(ctx, u, n.x, n.y, u.hp, null, goal);
    // Moving off a building we are capturing throws the progress away.
    const capP = s.props.find((p) => p.capBy === u.id);
    const leave = capP && moved ? -PROP_VALUE[capP.kind] * 0.8 : 0;
    consider(base + leave, { id: u.id, to, action: 'wait' });
    if (G.canCaptureAt(s, u, n.x, n.y)) consider(base + captureValue(ctx, u, n.x, n.y), { id: u.id, to, action: 'capture' });
    for (const v of G.targetsFrom(s, u, n.x, n.y, moved)) {
      const f = G.forecast(s, u, n.x, n.y, v);
      if (f.counterKills && !f.kills && ctx.P.suicide >= 0.8) continue; // never trade a unit for nothing
      const hpAfter = u.hp - f.counter;
      if (hpAfter <= 0) {
        consider(attackValue(ctx, u, v, f) - UNITS[u.type].cost * 0.3, { id: u.id, to, action: 'attack', target: v.id });
        continue;
      }
      const pos = positionScore(ctx, u, n.x, n.y, hpAfter, f.kills ? v : null, goal);
      consider(pos + leave + attackValue(ctx, u, v, f), { id: u.id, to, action: 'attack', target: v.id });
    }
  }
  return best;
}

// ---------- Building ----------

function buildChoice(ctx, x, y, budget) {
  const { s, P } = ctx;
  const enemies = ctx.enemies;
  const own = ctx.own;
  const options = UNIT_ORDER.filter((t) => UNITS[t].cost <= budget);
  if (!options.length) return null;
  if (ctx.rng() > P.build) {
    // A sloppy commander buys whatever it can afford, leaning cheap.
    const cheap = options.filter((t) => UNITS[t].cost <= Math.max(3000, budget * 0.5));
    return ctx.rng.pick(cheap.length ? cheap : options);
  }
  // Foot soldiers first while there are buildings to take.
  const open = s.props.filter((p) => p.owner !== ctx.side).length;
  const capturers = own.filter((u) => UNITS[u.type].capture).length;
  const wantCap = Math.min(open, 2 + Math.floor(open / 2)) - capturers;
  if (wantCap > 0 && (capturers === 0 || budget < 6000 || (wantCap > 2 && ctx.rng() < 0.4))) {
    const far = frontDist(ctx, { x, y }) > 8;
    if (far && options.includes('scout') && ctx.rng() < 0.3) return 'scout';
    return 'inf';
  }
  // Support units now and then: a harvester early on dune maps, a supply truck for a big army.
  const dunes = s.terrain.filter((t) => t === 'dunes').length;
  const has = (t) => own.filter((u) => u.type === t).length;
  if (options.includes('harv') && dunes >= 6 && has('harv') < (dunes >= 25 ? 2 : 1) && s.day <= 12 && budget < 9000 && ctx.rng() < 0.4) return 'harv';
  if (options.includes('truck') && own.length >= 8 && !has('truck') && ctx.rng() < 0.3) return 'truck';
  // Otherwise: the unit that deals the most damage over its life per fund against the enemy army.
  // Plan against the enemy army as it is, plus a generic mix (they will adapt too).
  const generic = ['inf', 'inf', 'lancer', 'tank', 'arty', 'recon'].map((type) => ({ type, hp: 100 }));
  const foes = [...enemies, ...generic];
  const total = foes.reduce((a, e) => a + e.hp * (e.side === undefined ? 0.25 : 1), 0) || 1;
  let best = null;
  for (const t of options) {
    if (UNITS[t].unarmed) continue;
    const c = UNITS[t].cost;
    let offense = 0; let defense = 0;
    for (const e of foes) {
      const w = e.hp * (e.side === undefined ? 0.25 : 1) / total;
      offense += baseDamage(t, e.type) * UNITS[e.type].cost / 100 * w;
      defense += baseDamage(e.type, t) * w;
    }
    const life = 100 / Math.max(15, defense);
    let ratio = offense * life / c * Math.sqrt(UNITS[t].move / 5) * mobility(s, t);
    if (isRanged(t)) {
      const have = own.filter((u) => isRanged(u.type)).length;
      ratio *= have < Math.max(1, Math.floor(own.length / 5)) ? 1.3 : 0.6;
    }
    if (UNITS[t].capture) ratio *= 0.8;
    // Variety: each copy we already have makes another a little less attractive.
    ratio *= Math.pow(0.85, own.filter((u) => u.type === t).length);
    // Spend the money: a unit that uses more of the budget is preferred.
    const score = ratio * Math.pow(c / budget, 0.35) * (1 + (ctx.rng() - 0.5) * 0.3 * (1 - P.build));
    if (!best || score > best.score) best = { t, score };
  }
  return best?.t ?? null;
}

// How freely a unit type gets around this map (0..1): share of tiles it crosses at cost 1.
const mobilityCache = new Map();
function mobility(s, type) {
  const k = `${s.mapId}|${UNITS[type].moveType}`;
  if (!mobilityCache.has(k)) {
    let ok = 0;
    for (const t of s.terrain) { const c = G.moveCost(type, t); ok += c === 1 ? 1 : c === 2 ? 0.5 : c ? 0.3 : 0; }
    mobilityCache.set(k, Math.sqrt(ok / s.terrain.length));
  }
  return mobilityCache.get(k);
}

function buildStep(ctx) {
  const { s, side } = ctx;
  const facs = s.props.filter((p) => p.kind === 'factory' && p.owner === side && !G.unitAt(s, p.x, p.y));
  if (!facs.length) return null;
  const funds = s.funds[side];
  if (funds < 1000 || ctx.own.length >= G.UNIT_CAP) return null;
  // Spread the money over the free factories; the first gets a bit more.
  const budget = Math.max(Math.floor(funds / facs.length), funds - 1500 * (facs.length - 1));
  // Nearest factory to the front first.
  facs.sort((a, b) => frontDist(ctx, a) - frontDist(ctx, b));
  for (const f of facs) {
    const t = buildChoice(ctx, f.x, f.y, Math.min(funds, budget));
    if (t) return { kind: 'build', x: f.x, y: f.y, type: t };
  }
  return null;
}

function frontDist(ctx, p) {
  let d = 99;
  for (const e of ctx.enemies) d = Math.min(d, G.dist(p.x, p.y, e.x, e.y));
  return d;
}

// ---------- Public API ----------

/**
 * The next thing the computer wants to do this turn, or null to end the turn.
 *   { kind: 'act', cmd }  -> G.act(s, cmd)
 *   { kind: 'build', x, y, type } -> G.build(s, x, y, type)
 */
export function aiStep(s, side, P, { quick = false } = {}) {
  if (s.over || s.turn !== side) return null;
  const ctx = makeCtx(s, side, P);
  let best = null;
  let ready = ctx.own.filter((u) => !u.done);
  if (quick && ready.length > 1) {
    // Out of thinking time (slow phone, huge army): decide unit by unit, guns and front line first.
    ready = ready.sort((a, b) => (isRanged(b.type) - isRanged(a.type)) || (frontDist(ctx, a) - frontDist(ctx, b))).slice(0, 1);
  }
  for (const u of ready) {
    const b = bestFor(ctx, u);
    if (b && (!best || b.score > best.score)) best = b;
  }
  if (best) return { kind: 'act', cmd: best.cmd };
  return buildStep(ctx);
}

/** Apply one step (used by tests and the fast path of the screen). Returns the events or null. */
export function applyStep(s, step) {
  if (!step) return null;
  if (step.kind === 'build') { G.build(s, step.x, step.y, step.type); return [{ type: 'build', ...step }]; }
  return G.act(s, step.cmd);
}

/** Play a whole turn for `side` and end it (tests and simulations). */
export function playTurn(s, side, P, maxSteps = 200) {
  let n = 0;
  while (!s.over && n < maxSteps) {
    const step = aiStep(s, side, P);
    if (!step) break;
    applyStep(s, step);
    n++;
  }
  if (!s.over) G.endTurn(s);
  return n;
}

/** Simulate a whole battle with the computer on both sides. Returns the final state. */
export function simulate(s, skills, { maxDays = 60 } = {}) {
  const P = skills.map((k) => aiParams(k));
  while (!s.over && s.day <= maxDays) playTurn(s, s.turn, P[s.turn]);
  return s;
}

export { TERRAIN };

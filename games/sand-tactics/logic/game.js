// Game rules: map setup, movement, combat, capturing, building, turns and victory.
// The state is a plain JSON-able object so it can be saved mid-mission and simulated in node.
import {
  UNITS, TERRAIN, TERRAIN_CHARS, PROP_CHARS, UNIT_CHARS, CAPTURE_POINTS, INCOME, baseDamage, displayHp,
} from './data.js';

// ---------- Setup ----------

/**
 * Parse a map definition:
 *   rows:  terrain + buildings, one string per row (see data.js for the characters)
 *   units: same-size overlay of unit letters (upper case Blue, lower case Red), anything else is empty
 */
export function parseMap(def) {
  const h = def.rows.length;
  const w = def.rows[0].length;
  const terrain = [];
  const props = [];
  for (let y = 0; y < h; y++) {
    if (def.rows[y].length !== w) throw new Error(`${def.id}: row ${y} is ${def.rows[y].length} wide, expected ${w}`);
    for (let x = 0; x < w; x++) {
      const ch = def.rows[y][x];
      if (PROP_CHARS[ch]) {
        const [kind, owner] = PROP_CHARS[ch];
        terrain.push(kind);
        props.push({ x, y, kind, owner, cap: CAPTURE_POINTS, capBy: null });
      } else if (TERRAIN_CHARS[ch]) terrain.push(TERRAIN_CHARS[ch]);
      else throw new Error(`${def.id}: unknown map character "${ch}" at ${x},${y}`);
    }
  }
  const units = [];
  (def.units || []).forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      const type = UNIT_CHARS[ch.toUpperCase()];
      if (!type || !/[A-Za-z]/.test(ch)) continue;
      units.push({ type, side: ch === ch.toUpperCase() ? 0 : 1, x, y });
    }
  });
  return { w, h, terrain, props, units };
}

/**
 * New game from a map definition.
 * opts: seed, controllers ['human'|'cpu', ...], mode ('campaign' | 'skirmish' | 'versus'), missionId.
 */
export function newGame(def, opts = {}) {
  const m = parseMap(def);
  const s = {
    v: 1,
    mapId: def.id,
    name: def.name,
    mode: opts.mode || 'skirmish',
    missionId: opts.missionId ?? null,
    w: m.w,
    h: m.h,
    terrain: m.terrain,
    props: m.props,
    units: [],
    nextId: 1,
    turn: 0,
    day: 1,
    funds: [...(def.funds || [0, 0])],
    income: def.income ?? INCOME,
    survive: def.survive || null, // { side, days }: that side wins on reaching day days + 1
    controllers: opts.controllers || ['human', 'cpu'],
    everHad: [false, false],
    stats: [0, 1].map(() => ({ built: 0, lost: 0, kills: 0, captured: 0, damage: 0 })),
    over: false,
    winner: null,
    reason: null,
    rng: { s: (opts.seed ?? 1) >>> 0 },
  };
  for (const u of m.units) addUnit(s, u.type, u.side, u.x, u.y, false);
  beginTurn(s);
  return s;
}

export function addUnit(s, type, side, x, y, done = true) {
  const u = { id: s.nextId++, type, side, x, y, hp: 100, done };
  s.units.push(u);
  s.everHad[side] = true;
  return u;
}

// ---------- Queries ----------

export const inMap = (s, x, y) => x >= 0 && y >= 0 && x < s.w && y < s.h;
export const idx = (s, x, y) => y * s.w + x;
export const terrainAt = (s, x, y) => s.terrain[idx(s, x, y)];
export const propAt = (s, x, y) => s.props.find((p) => p.x === x && p.y === y) || null;
export const unitAt = (s, x, y) => s.units.find((u) => u.x === x && u.y === y) || null;
export const unitById = (s, id) => s.units.find((u) => u.id === id) || null;
export const unitsOf = (s, side) => s.units.filter((u) => u.side === side);
export const readyUnits = (s, side) => s.units.filter((u) => u.side === side && !u.done);
export const propsOf = (s, side) => s.props.filter((p) => p.owner === side);
export const hqOf = (s, side) => s.props.find((p) => p.kind === 'hq' && p.owner === side) || null;
export const incomeOf = (s, side) => propsOf(s, side).length * s.income;
export const dist = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);

/** Movement cost of a terrain for a unit type (0 = can't enter). */
export const moveCost = (type, tkey) => TERRAIN[tkey].cost[UNITS[type].moveType];

/** Terrain defence stars a unit gets standing on a tile (air units get none). */
export function defStars(s, type, x, y) {
  if (UNITS[type].air) return 0;
  return TERRAIN[terrainAt(s, x, y)].def;
}

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/**
 * Every tile a unit can move through this turn (Dijkstra on movement cost).
 * Friendly units can be passed through, enemies block. Returns Map idx -> { x, y, c, prev, stop }:
 * stop is true where the unit may end its move (empty tile or its own tile).
 * opts.ignoreUnits: plan as if the map were empty (used by the computer for long-range goals).
 */
export function reachable(s, u, { ignoreUnits = false, budget } = {}) {
  const mp = budget ?? UNITS[u.type].move;
  const out = new Map();
  const start = idx(s, u.x, u.y);
  out.set(start, { x: u.x, y: u.y, c: 0, prev: -1, stop: true });
  const open = [start];
  const occ = ignoreUnits ? null : occupancy(s);
  while (open.length) {
    // Small maps: a linear scan for the cheapest open node is plenty fast.
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (out.get(open[i]).c < out.get(open[bi]).c) bi = i;
    const cur = open.splice(bi, 1)[0];
    const n = out.get(cur);
    for (const [dx, dy] of DIRS) {
      const x = n.x + dx; const y = n.y + dy;
      if (!inMap(s, x, y)) continue;
      const cost = moveCost(u.type, terrainAt(s, x, y));
      if (!cost) continue;
      const c = n.c + cost;
      if (c > mp) continue;
      const i = idx(s, x, y);
      const other = occ ? occ[i] : null;
      if (other && other.side !== u.side) continue;
      const prev = out.get(i);
      if (prev && prev.c <= c) continue;
      out.set(i, { x, y, c, prev: cur, stop: !other || other.id === u.id });
      if (!prev) open.push(i);
    }
  }
  return out;
}

function occupancy(s) {
  const occ = new Array(s.w * s.h).fill(null);
  for (const u of s.units) occ[idx(s, u.x, u.y)] = u;
  return occ;
}

/** Path [[x, y], ...] from the unit's tile to tile i of a reachable() result. */
export function pathTo(reach, i) {
  const path = [];
  let cur = i;
  while (cur !== -1 && cur !== undefined) {
    const n = reach.get(cur);
    if (!n) return null;
    path.push([n.x, n.y]);
    cur = n.prev;
  }
  return path.reverse();
}

/** Tiles at attack distance from (x, y) for a unit type. */
export function rangeTiles(s, type, x, y) {
  const [lo, hi] = UNITS[type].range;
  const out = [];
  for (let dy = -hi; dy <= hi; dy++) {
    for (let dx = -hi; dx <= hi; dx++) {
      const d = Math.abs(dx) + Math.abs(dy);
      if (d < lo || d > hi) continue;
      if (inMap(s, x + dx, y + dy)) out.push([x + dx, y + dy]);
    }
  }
  return out;
}

export const canHit = (attType, defType) => baseDamage(attType, defType) > 0;

/** Enemy units the unit could attack standing at (x, y). moved: it moved this turn (ranged units can't fire then). */
export function targetsFrom(s, u, x, y, moved) {
  const def = UNITS[u.type];
  if (moved && def.range[1] > 1) return [];
  const out = [];
  for (const v of s.units) {
    if (v.side === u.side) continue;
    const d = dist(x, y, v.x, v.y);
    if (d < def.range[0] || d > def.range[1]) continue;
    if (!canHit(u.type, v.type)) continue;
    out.push(v);
  }
  return out;
}

/** Damage (in hp points, 0-100 scale) an attacker with attHp deals to defender standing on (dx, dy). */
export function damage(s, attType, attHp, defType, defHp, dx, dy) {
  const base = baseDamage(attType, defType);
  if (!base) return 0;
  const stars = defStars(s, defType, dx, dy);
  const v = base * (displayHp(attHp) / 10) * ((100 - stars * displayHp(defHp)) / 100);
  return Math.max(0, Math.floor(v + 1e-9));
}

/**
 * What happens if u (standing at fx, fy) attacks v:
 * { dmg, kills, counter, counterKills } (hp points; counter is 0 when v can't strike back).
 */
export function forecast(s, u, fx, fy, v, attHp = u.hp) {
  const dmg = damage(s, u.type, attHp, v.type, v.hp, v.x, v.y);
  const left = v.hp - dmg;
  let counter = 0;
  if (left > 0 && dist(fx, fy, v.x, v.y) === 1 && UNITS[v.type].range[1] === 1) {
    counter = damage(s, v.type, left, u.type, attHp, fx, fy);
  }
  return { dmg: Math.min(dmg, v.hp), kills: left <= 0, counter: Math.min(counter, attHp), counterKills: counter >= attHp };
}

export function canCaptureAt(s, u, x, y) {
  if (!UNITS[u.type].capture) return false;
  const p = propAt(s, x, y);
  return !!p && p.owner !== u.side;
}

/** Which actions the unit has after moving to (x, y). */
export function actionsAt(s, u, x, y) {
  const moved = x !== u.x || y !== u.y;
  const acts = [];
  if (targetsFrom(s, u, x, y, moved).length) acts.push('attack');
  if (canCaptureAt(s, u, x, y)) acts.push('capture');
  acts.push('wait');
  return acts;
}

// ---------- Actions ----------

function fail(msg) { throw new Error(msg); }

function removeUnit(s, u) {
  s.units = s.units.filter((x) => x !== u);
  for (const p of s.props) if (p.capBy === u.id) { p.capBy = null; p.cap = CAPTURE_POINTS; }
  s.stats[u.side].lost++;
}

/**
 * Move a unit and act: cmd = { id, to: [x, y], action: 'wait' | 'attack' | 'capture', target }.
 * Returns a list of events for the screen to animate. Throws on an illegal command.
 */
export function act(s, cmd) {
  if (s.over) fail('game over');
  const u = unitById(s, cmd.id);
  if (!u) fail('no such unit');
  if (u.side !== s.turn) fail('not your unit');
  if (u.done) fail('unit already acted');
  const [tx, ty] = cmd.to || [u.x, u.y];
  const reach = reachable(s, u);
  const node = reach.get(idx(s, tx, ty));
  if (!node || !node.stop) fail(`can't move to ${tx},${ty}`);
  const moved = tx !== u.x || ty !== u.y;
  const events = [];
  if (moved) {
    events.push({ type: 'move', id: u.id, path: pathTo(reach, idx(s, tx, ty)) });
    for (const p of s.props) if (p.capBy === u.id) { p.capBy = null; p.cap = CAPTURE_POINTS; }
    u.x = tx; u.y = ty;
  }
  const action = cmd.action || 'wait';
  if (action === 'attack') {
    const v = unitById(s, cmd.target);
    if (!v || !targetsFrom(s, u, tx, ty, moved).includes(v)) fail('invalid target');
    events.push(...fight(s, u, v));
  } else if (action === 'capture') {
    if (!canCaptureAt(s, u, tx, ty)) fail('nothing to capture');
    const p = propAt(s, tx, ty);
    p.capBy = u.id;
    p.cap -= displayHp(u.hp);
    if (p.cap <= 0) {
      const from = p.owner;
      p.owner = u.side;
      p.cap = CAPTURE_POINTS;
      p.capBy = null;
      s.stats[u.side].captured++;
      events.push({ type: 'captured', id: u.id, x: tx, y: ty, kind: p.kind, from });
      if (p.kind === 'hq' && from >= 0) {
        // Taking an HQ wins the battle; any other buildings of the loser stay as they are.
        endGame(s, u.side, 'hq');
      }
    } else events.push({ type: 'capture', id: u.id, x: tx, y: ty, left: p.cap });
  } else if (action !== 'wait') fail('unknown action');
  if (unitById(s, u.id)) u.done = true;
  checkRout(s);
  if (s.over) events.push({ type: 'over', winner: s.winner, reason: s.reason });
  return events;
}

function fight(s, u, v) {
  const events = [];
  const f = forecast(s, u, u.x, u.y, v);
  v.hp -= f.dmg;
  s.stats[u.side].damage += f.dmg * UNITS[v.type].cost / 100;
  events.push({ type: 'attack', a: u.id, d: v.id, dmg: f.dmg, killed: v.hp <= 0, hp: Math.max(0, v.hp) });
  if (v.hp <= 0) {
    removeUnit(s, v);
    s.stats[u.side].kills++;
    return events;
  }
  if (f.counter > 0) {
    u.hp -= f.counter;
    s.stats[v.side].damage += f.counter * UNITS[u.type].cost / 100;
    events.push({ type: 'counter', a: v.id, d: u.id, dmg: f.counter, killed: u.hp <= 0, hp: Math.max(0, u.hp) });
    if (u.hp <= 0) {
      removeUnit(s, u);
      s.stats[v.side].kills++;
    }
  }
  return events;
}

/** Most units one side may have on the map (keeps big battles quick on a phone). */
export const UNIT_CAP = 30;

/** Units a factory can build right now (affordable or not). */
export function canBuildAt(s, x, y) {
  const p = propAt(s, x, y);
  return !!p && p.kind === 'factory' && p.owner === s.turn && !unitAt(s, x, y) && !s.over;
}

export function build(s, x, y, type) {
  if (!canBuildAt(s, x, y)) fail('can\'t build here');
  if (unitsOf(s, s.turn).length >= UNIT_CAP) fail('unit limit reached');
  const cost = UNITS[type].cost;
  if (s.funds[s.turn] < cost) fail('not enough funds');
  s.funds[s.turn] -= cost;
  s.stats[s.turn].built++;
  s.builtNow = (s.builtNow || 0) + 1;
  return addUnit(s, type, s.turn, x, y, true);
}

/** End the current side's turn and start the next one. Returns the start-of-turn report. */
export function endTurn(s) {
  if (s.over) return null;
  s.builtNow = 0;
  for (const u of s.units) if (u.side === s.turn) u.done = false;
  s.turn = 1 - s.turn;
  if (s.turn === 0) s.day++;
  return beginTurn(s);
}

/** Start-of-turn upkeep for s.turn: survival goal, income, repairs. */
export function beginTurn(s) {
  const side = s.turn;
  const report = { side, income: 0, repaired: [] };
  if (s.survive && s.turn === s.survive.side && s.day > s.survive.days) {
    endGame(s, s.survive.side, 'survive');
    return report;
  }
  report.income = incomeOf(s, side);
  s.funds[side] += report.income;
  for (const u of s.units) {
    if (u.side !== side) continue;
    u.done = false;
    const p = propAt(s, u.x, u.y);
    if (!p || p.owner !== side || u.hp >= 100) continue;
    const gain = Math.min(20, 100 - u.hp);
    const steps = Math.ceil(gain / 10);
    const cost = Math.round(UNITS[u.type].cost * steps / 10);
    if (s.funds[side] < cost) continue;
    s.funds[side] -= cost;
    u.hp = Math.min(100, u.hp + gain);
    report.repaired.push({ id: u.id, gain });
  }
  return report;
}

function checkRout(s) {
  if (s.over) return;
  for (const side of [0, 1]) {
    if (s.everHad[side] && !s.units.some((u) => u.side === side)) {
      endGame(s, 1 - side, 'rout');
      return;
    }
  }
}

function endGame(s, winner, reason) {
  if (s.over) return;
  s.over = true;
  s.winner = winner;
  s.reason = reason;
}

/** A side gives up (or a pass-and-play player resigns). */
export function resign(s, side) { endGame(s, 1 - side, 'resign'); }

/** Army value in funds (cost scaled by health). */
export function armyValue(s, side) {
  return s.units.filter((u) => u.side === side).reduce((a, u) => a + UNITS[u.type].cost * u.hp / 100, 0);
}

/** Who is ahead (for tie-breaks in simulations): army value + buildings. */
export function standing(s, side) {
  return armyValue(s, side) + propsOf(s, side).length * 2500 + s.funds[side] * 0.5;
}

export const clone = (s) => JSON.parse(JSON.stringify(s));

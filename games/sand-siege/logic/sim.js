// The Sand Siege simulation: a plain, JSON-safe state object and pure functions that change it.
// No Phaser here, so the same code runs in the game, in the node tests and in the bot.
// Time moves in fixed steps of DT seconds; the screen calls step() 30 times a second (60 at 2x).
// Positions are in cells: the centre of cell (x, y) is (x + 0.5, y + 0.5).
import {
  TOWERS, ENEMIES, POWERS, towerStats, upgradeCost, damageSplit, airstrikeDamage, AIRSTRIKE_RADIUS,
  START_LIVES, HARD, WAVE_BREAK, EARLY_RATE, SELL_BACK, TARGETS,
} from './data.js';
import { COLS, ROWS, waveGroups } from './maps.js';

export const DT = 1 / 30;
const N4 = [[0, 1], [-1, 0], [1, 0], [0, -1]];

// ---------------------------------------------------------------- setup

/**
 * A new game on a map definition (from maps.js).
 * opts: mode 'campaign' | 'endless' | 'daily'; hard; hpScale (adaptive, about 0.88-1.12); powers (unlocked ids).
 */
export function newGame(def, { mode = 'campaign', hard = false, hpScale = 1, powers = [] } = {}) {
  const mods = def.mods || [];
  let lives = hard ? HARD.lives : START_LIVES;
  if (mods.includes('fragile')) lives = 10;
  const funds = Math.round(def.funds * (hard ? HARD.funds : 1));
  const s = {
    v: 1,
    mode, hard, mapId: def.id, name: def.name, kind: def.kind || 'path', rows: def.rows.slice(),
    def: {
      tier: def.tier || 0, waves: def.waves, roster: def.roster, bosses: def.bosses || {}, power: def.power || 1,
      airHeavy: !!def.airHeavy, armorHeavy: !!def.armorHeavy, funds: def.funds,
    },
    mods,
    hpMul: hpScale * (hard ? HARD.hp : 1) * (mods.includes('horde') ? 0.8 : 1),
    totalWaves: mode === 'endless' ? 0 : def.waves,
    lives, maxLives: lives, funds,
    t: 0, wave: 0, nextIn: null, storm: 0, fast: false,
    spawners: [], enemies: [], towers: [], shells: [], strikes: [],
    powers: Object.fromEntries(powers.map((p) => [p, 0])),
    nextId: 1,
    stats: { kills: 0, early: 0, leaks: 0, built: 0, bossKills: 0, maxRoute: 0, sold: 0, strikeBest: 0, maxFunds: funds },
    over: null,
    events: [],
  };
  s.stats.maxRoute = longestRoute(s);
  return s;
}

export function serialize(s) {
  const { events, ...rest } = s;
  return JSON.stringify(rest);
}
export function deserialize(str) {
  const s = typeof str === 'string' ? JSON.parse(str) : str;
  if (!s || s.v !== 1 || !Array.isArray(s.rows)) return null;
  s.events = [];
  return s;
}

// ---------------------------------------------------------------- grid and paths

export const inMap = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
export const cell = (s, x, y) => (inMap(x, y) ? s.rows[y][x] : 'r');
const idx = (x, y) => y * COLS + x;

const cache = new WeakMap();
function derived(s) {
  let c = cache.get(s);
  if (!c || c.towers !== s.towers.length || c.ver !== s.gridVer) {
    const occ = new Map();
    for (const t of s.towers) occ.set(idx(t.x, t.y), t);
    c = { towers: s.towers.length, ver: s.gridVer, occ, dist: null, buff: null };
    c.dist = distField(s, occ);
    cache.set(s, c);
  }
  return c;
}
/** Call after anything changes which cells are blocked. */
function touch(s) { s.gridVer = (s.gridVer || 0) + 1; }

function walkable(s, x, y, occ, extra = -1) {
  const ch = cell(s, x, y);
  if (s.kind === 'maze') return '.SB'.includes(ch) && !occ.has(idx(x, y)) && idx(x, y) !== extra;
  return '#SB'.includes(ch);
}

/** Steps from every cell to the base (-1 where the base can't be reached). */
function distField(s, occ, extra = -1) {
  const d = new Int16Array(COLS * ROWS).fill(-1);
  const q = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (s.rows[y][x] === 'B') { d[idx(x, y)] = 0; q.push(x, y); }
  for (let h = 0; h < q.length; h += 2) {
    const x = q[h]; const y = q[h + 1]; const k = d[idx(x, y)];
    for (const [dx, dy] of N4) {
      const nx = x + dx; const ny = y + dy;
      if (!inMap(nx, ny) || d[idx(nx, ny)] >= 0 || !walkable(s, nx, ny, occ, extra)) continue;
      d[idx(nx, ny)] = k + 1;
      q.push(nx, ny);
    }
  }
  return d;
}

export const distAt = (s, x, y) => (inMap(x, y) ? derived(s).dist[idx(x, y)] : -1);
export const towerAt = (s, x, y) => derived(s).occ.get(idx(x, y)) || null;
export const towerById = (s, id) => s.towers.find((t) => t.id === id) || null;

export function spawns(s) {
  const out = [];
  for (let x = 0; x < COLS; x++) if (s.rows[0][x] === 'S') out.push([x, 0]);
  return out;
}
export function baseCell(s) {
  for (let y = ROWS - 1; y >= 0; y--) for (let x = 0; x < COLS; x++) if (s.rows[y][x] === 'B') return [x, y];
  return [5, ROWS - 1];
}

/** Next cell from (x, y) towards the base; prefers to keep going the way it was heading. */
function nextCell(s, x, y, hx = 0, hy = 1) {
  const d = derived(s).dist;
  const here = d[idx(x, y)];
  let best = null; let bestD = Infinity;
  const order = [[hx, hy], ...N4.filter(([a, b]) => a !== hx || b !== hy)];
  for (const [dx, dy] of order) {
    const nx = x + dx; const ny = y + dy;
    if (!inMap(nx, ny)) continue;
    const nd = d[idx(nx, ny)];
    if (nd < 0) continue;
    if (here >= 0 ? nd === here - 1 : nd < bestD) { if (here >= 0) return [nx, ny]; best = [nx, ny]; bestD = nd; }
  }
  return best;
}

/** The cells a ground unit walks from a spawn to the base. */
export function route(s, [sx, sy]) {
  const out = [[sx, sy]];
  let x = sx; let y = sy; let hx = 0; let hy = 1;
  for (let guard = 0; guard < COLS * ROWS; guard++) {
    if (cell(s, x, y) === 'B') break;
    const n = nextCell(s, x, y, hx, hy);
    if (!n) break;
    hx = n[0] - x; hy = n[1] - y;
    [x, y] = n;
    out.push([x, y]);
  }
  return out;
}
export function longestRoute(s) { return Math.max(0, ...spawns(s).map((sp) => route(s, sp).length)); }

/** Can a tower go on (x, y)? Returns { ok, reason }. Ignores funds (see build()). */
export function canPlace(s, x, y) {
  if (!inMap(x, y) || cell(s, x, y) !== '.') return { ok: false, reason: 'Can\'t build here' };
  const c = derived(s);
  if (c.occ.has(idx(x, y))) return { ok: false, reason: 'Already a tower here' };
  if (s.kind !== 'maze') return { ok: true };
  for (const e of s.enemies) {
    if (e.air) continue;
    if ((e.tx === x && e.ty === y) || (Math.floor(e.x) === x && Math.floor(e.y) === y)) return { ok: false, reason: 'Enemy in the way' };
  }
  const d = distField(s, c.occ, idx(x, y));
  for (const [sx, sy] of spawns(s)) if (d[idx(sx, sy)] < 0) return { ok: false, reason: 'That would block the path' };
  for (const e of s.enemies) if (!e.air && e.ty >= 0 && d[idx(e.tx, e.ty)] < 0) return { ok: false, reason: 'That would trap an enemy' };
  return { ok: true };
}

// ---------------------------------------------------------------- player actions

export const towerCost = (s, type) => Math.round(TOWERS[type].cost * (s.mods.includes('pricey') ? 1.15 : 1));
export const upgradePrice = (s, t, branch = 0) => {
  const c = upgradeCost(t.type, t.level, branch);
  return c == null ? null : Math.round(c * (s.mods.includes('pricey') ? 1.15 : 1));
};
export const sellValue = (s, t) => Math.floor(t.spent * (s.wave === 0 ? 1 : SELL_BACK));

export function build(s, type, x, y) {
  if (s.over) return { ok: false, reason: 'Game over' };
  const cost = towerCost(s, type);
  if (s.funds < cost) return { ok: false, reason: 'Not enough funds' };
  const p = canPlace(s, x, y);
  if (!p.ok) return p;
  s.funds -= cost;
  const t = { id: s.nextId++, type, x, y, level: 0, branch: null, spent: cost, cd: 0, prio: TOWERS[type].prio || 'first', dir: 'u', kills: 0 };
  s.towers.push(t);
  touch(s);
  s.stats.built++;
  if (s.kind === 'maze') s.stats.maxRoute = Math.max(s.stats.maxRoute, longestRoute(s));
  s.events.push({ k: 'build', id: t.id });
  return { ok: true, tower: t };
}

export function upgrade(s, id, branch = 0) {
  const t = towerById(s, id);
  if (!t || s.over) return { ok: false, reason: 'No tower' };
  const cost = upgradePrice(s, t, branch);
  if (cost == null) return { ok: false, reason: 'Fully upgraded' };
  if (s.funds < cost) return { ok: false, reason: 'Not enough funds' };
  s.funds -= cost;
  t.spent += cost;
  t.level++;
  if (t.level === 3) t.branch = branch;
  touch(s);
  s.events.push({ k: 'upgrade', id: t.id, level: t.level });
  return { ok: true, tower: t };
}

export function sell(s, id) {
  const t = towerById(s, id);
  if (!t || s.over) return { ok: false };
  if (s.mods.includes('nosell')) return { ok: false, reason: 'No selling today' };
  const value = sellValue(s, t);
  s.funds += value;
  s.towers = s.towers.filter((o) => o !== t);
  touch(s);
  s.stats.sold++;
  s.events.push({ k: 'sell', x: t.x, y: t.y, value });
  return { ok: true, value };
}

export function setPriority(s, id, prio) {
  const t = towerById(s, id);
  if (!t || !TARGETS.includes(prio)) return false;
  t.prio = prio;
  return true;
}

export const moreWaves = (s) => !s.totalWaves || s.wave < s.totalWaves;
/** Can the next wave be sent now? Before wave 1, or during the break between waves. */
export const canCall = (s) => !s.over && moreWaves(s) && (s.wave === 0 || s.nextIn != null);
export const earlyBonus = (s) => (s.wave > 0 && s.nextIn != null ? Math.floor(s.nextIn * EARLY_RATE) : 0);

export function callWave(s) {
  if (!canCall(s)) return { ok: false };
  const bonus = earlyBonus(s);
  if (bonus > 0) { s.funds += bonus; s.stats.early++; }
  startWave(s);
  return { ok: true, bonus };
}

export function waveMods(s) {
  return { hp: s.hpMul, count: s.mods.includes('horde') ? 1.3 : 1, air: s.mods.includes('air'), endless: s.mode === 'endless' };
}
export const groupsFor = (s, w) => waveGroups(s.def, w, waveMods(s));

/** Funds paid at the start of every wave after the first (on top of Supply Depots). */
export const waveBonus = (w) => (w > 0 ? 15 + 3 * w : 0);

function startWave(s) {
  const groups = groupsFor(s, s.wave);
  s.spawners.push({ w: s.wave, k: 0, groups: groups.map((g) => ({ ...g, left: g.n, timer: g.delay })) });
  s.wave++;
  s.nextIn = null;
  let income = waveBonus(s.wave - 1);
  for (const t of s.towers) { const st = towerStats(t.type, t.level, t.branch); if (st.income) income += st.income; }
  s.funds += income;
  s.events.push({ k: 'wave', wave: s.wave, income });
}

export function canUsePower(s, id) {
  if (!(id in s.powers) || s.over || s.powers[id] > 0) return false;
  if (id === 'repair') return s.lives < s.maxLives;
  return s.wave > 0;
}
export function usePower(s, id, x = 0, y = 0) {
  if (!canUsePower(s, id)) return { ok: false };
  s.powers[id] = POWERS[id].cd;
  if (id === 'airstrike') s.strikes.push({ x, y, t: 0.8 });
  if (id === 'sandstorm') s.storm = 5;
  if (id === 'repair') s.lives = Math.min(s.maxLives, s.lives + 3);
  s.events.push({ k: 'power', id, x, y });
  return { ok: true };
}

// ---------------------------------------------------------------- the step

/** Take the events (shots, deaths, waves...) that happened since the last call, for the screen. */
export function drain(s) { const ev = s.events; s.events = []; return ev; }

/** Advance the game by one fixed step. Events for the screen collect in s.events until drain(). */
export function step(s) {
  if (s.over) return;
  if (s.events.length > 500) s.events.splice(0, s.events.length - 500);
  const dt = DT;
  s.t += dt;
  for (const p of Object.keys(s.powers)) s.powers[p] = Math.max(0, s.powers[p] - dt);
  if (s.storm > 0) s.storm = Math.max(0, s.storm - dt);

  // Wave countdown and spawning.
  if (s.nextIn != null) {
    s.nextIn -= dt;
    if (s.nextIn <= 0) startWave(s);
  }
  for (const sp of s.spawners) {
    for (const g of sp.groups) {
      if (g.left <= 0) continue;
      g.timer -= dt;
      while (g.timer <= 0 && g.left > 0) { spawn(s, g, sp); g.left--; g.timer += g.gap || 0.5; }
    }
  }
  const before = s.spawners.length;
  s.spawners = s.spawners.filter((sp) => sp.groups.some((g) => g.left > 0));
  if (before && !s.spawners.length && s.nextIn == null && moreWaves(s)) s.nextIn = s.wave === 1 ? WAVE_BREAK + 5 : WAVE_BREAK;

  moveEnemies(s, dt);
  supportEnemies(s, dt);
  fireTowers(s, dt);
  flyShells(s, dt);
  resolveStrikes(s, dt);

  s.stats.maxFunds = Math.max(s.stats.maxFunds, s.funds);
  if (s.lives <= 0) { s.lives = 0; s.over = 'lose'; s.events.push({ k: 'over', result: 'lose' }); return; }
  if (s.totalWaves && s.wave >= s.totalWaves && !s.spawners.length && !s.enemies.length) {
    s.over = 'win';
    s.events.push({ k: 'over', result: 'win' });
  }
}

function spawn(s, g, sp) {
  const def = ENEMIES[g.type];
  const gates = spawns(s);
  const [sx] = gates[sp.k++ % gates.length];
  const armor = (def.armor || 0) + (s.mods.includes('armor') ? 2 : 0);
  const shield = def.shield ? Math.round((def.shield * g.hp) / def.hp) : 0;
  const e = {
    id: s.nextId++, type: g.type, x: sx + 0.5, y: -0.5, hp: g.hp, maxHp: g.hp, shield, maxShield: shield, armor,
    speed: def.speed * (s.mods.includes('fast') ? 1.2 : 1), air: !!def.air, boss: !!def.boss,
    reward: def.reward * (1 + 0.05 * sp.w) * (1 + 0.03 * s.def.tier), tx: sx, ty: 0, hx: 0, hy: 1, prog: 99, slow: 0, slowT: 0, jamT: 0, lastHit: -9, healCd: 0.5,
  };
  s.enemies.push(e);
  s.events.push({ k: 'spawn', id: e.id });
}

function moveEnemies(s, dt) {
  const [bx, by] = baseCell(s);
  const leaked = [];
  for (const e of s.enemies) {
    if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slow = 0; }
    if (e.jamT > 0) e.jamT -= dt;
    let move = e.speed * (1 - e.slow) * (s.storm > 0 ? 0.33 : 1) * dt;
    if (e.air) {
      const dx = bx + 0.5 - e.x; const dy = by + 0.5 - e.y; const d = Math.hypot(dx, dy);
      if (d <= move) { leaked.push(e); continue; }
      e.x += (dx / d) * move; e.y += (dy / d) * move;
      e.hx = dx / d; e.hy = dy / d;
      e.prog = d - move;
      continue;
    }
    let guard = 0;
    while (move > 0 && guard++ < 4) {
      const cx = e.tx + 0.5; const cy = e.ty + 0.5;
      const dx = cx - e.x; const dy = cy - e.y; const d = Math.hypot(dx, dy);
      if (d > move) { e.x += (dx / d) * move; e.y += (dy / d) * move; move = 0; break; }
      e.x = cx; e.y = cy; move -= d;
      if (cell(s, e.tx, e.ty) === 'B') { leaked.push(e); move = 0; break; }
      const n = nextCell(s, e.tx, e.ty, e.hx, e.hy);
      if (!n) { move = 0; break; }
      e.hx = n[0] - e.tx; e.hy = n[1] - e.ty;
      e.tx = n[0]; e.ty = n[1];
    }
    const dd = distAt(s, e.tx, e.ty);
    e.prog = (dd < 0 ? 99 : dd) + Math.hypot(e.tx + 0.5 - e.x, e.ty + 0.5 - e.y);
  }
  for (const e of leaked) {
    s.enemies = s.enemies.filter((o) => o !== e);
    const cost = ENEMIES[e.type].lives;
    s.lives -= cost;
    s.stats.leaks += cost;
    s.events.push({ k: 'leak', id: e.id, lives: cost, boss: e.boss });
  }
}

function supportEnemies(s, dt) {
  for (const e of s.enemies) {
    const def = ENEMIES[e.type];
    if (e.maxShield && e.jamT <= 0 && s.t - e.lastHit > 2.5 && e.shield < e.maxShield) {
      e.shield = Math.min(e.maxShield, e.shield + e.maxShield * 0.4 * dt);
    }
    if (def.heal) {
      e.healCd -= dt;
      if (e.healCd <= 0) {
        e.healCd = 0.5;
        if (e.jamT > 0) continue;
        let healed = false;
        for (const o of s.enemies) {
          if (o === e || o.hp >= o.maxHp || o.jamT > 0) continue;
          if (Math.hypot(o.x - e.x, o.y - e.y) > def.healRange) continue;
          o.hp = Math.min(o.maxHp, o.hp + def.heal * 0.5 * (e.maxHp / def.hp) ** 0.5);
          healed = true;
        }
        if (healed) s.events.push({ k: 'heal', id: e.id });
      }
    }
  }
}

// ---------------------------------------------------------------- towers

function spotted(s, t) {
  for (const o of s.towers) {
    if (o === t || o.type !== 'sniper' || o.level < 3 || o.branch !== 1) continue;
    if (Math.hypot(o.x - t.x, o.y - t.y) <= TOWERS.sniper.branches[1].aura + 0.01) return true;
  }
  return false;
}
/** Range of a tower in cells, with the Spotter bonus. */
export function rangeOf(s, t) {
  const st = towerStats(t.type, t.level, t.branch);
  return st.range * (st.range && spotted(s, t) ? 1.2 : 1);
}

const canHit = (st, e) => (e.air ? st.air : st.ground);

function pickTarget(s, t, st, range) {
  const tx = t.x + 0.5; const ty = t.y + 0.5;
  let best = null; let bestV = Infinity;
  for (const e of s.enemies) {
    if (!canHit(st, e) || e.y < 0) continue;
    const d = Math.hypot(e.x - tx, e.y - ty);
    if (d > range || d < st.minRange) continue;
    let v;
    if (t.prio === 'first') v = e.prog;
    else if (t.prio === 'last') v = -e.prog;
    else if (t.prio === 'strong') v = -(e.hp + e.shield) - (e.boss ? 1e6 : 0) - (ENEMIES[e.type].heal ? 5e5 : 0);
    else v = d;
    if (v < bestV) { bestV = v; best = e; }
  }
  return best;
}

export function facing(dx, dy) {
  const k = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)); // 0 = right, 2 = down (screen y grows down)
  return { 0: 'r', 1: 'dr', 2: 'd', 3: 'dl', 4: 'l', '-4': 'l', '-3': 'ul', '-2': 'u', '-1': 'ur' }[k] || 'r';
}

function fireTowers(s, dt) {
  for (const t of s.towers) {
    const st = towerStats(t.type, t.level, t.branch);
    if (TOWERS[t.type].money) continue;
    t.cd -= dt;
    if (t.cd > 0) continue;
    const range = rangeOf(s, t);
    const tx = t.x + 0.5; const ty = t.y + 0.5;
    if (st.pulse) {
      let any = false;
      for (const e of s.enemies) {
        if (e.y < 0 || Math.hypot(e.x - tx, e.y - ty) > range) continue;
        any = true;
        e.slow = Math.max(e.slow, st.slow); e.slowT = 1.0;
        if (st.jam) e.jamT = 1.0;
        hurt(s, e, st.dmg, t, {});
      }
      if (any) { t.cd = st.rate; s.events.push({ k: 'pulse', id: t.id, r: range, jam: !!st.jam }); } else t.cd = 0;
      continue;
    }
    const target = pickTarget(s, t, st, range);
    if (!target) { t.cd = 0; continue; }
    t.cd = st.rate;
    t.dir = facing(target.x - tx, target.y - ty);
    if (TOWERS[t.type].shell) {
      const n = st.shots || 1;
      const offs = [[0, 0], [0.55, 0.3], [-0.5, 0.35]];
      for (let k = 0; k < n; k++) {
        s.shells.push({
          from: [tx, ty], to: [target.x + offs[k][0], target.y + offs[k][1]], off: offs[k], target: target.id, t: 0,
          dur: TOWERS[t.type].shell * (1 + 0.12 * k), dmg: st.dmg, splash: st.splash || 0.6, ground: st.ground, air: st.air, tower: t.id,
          pierce: !!st.pierce, big: t.type === 'arty',
        });
      }
      s.events.push({ k: 'fire', id: t.id, type: t.type, tx: target.x, ty: target.y });
      continue;
    }
    s.events.push({ k: 'fire', id: t.id, type: t.type, tx: target.x, ty: target.y, target: target.id });
    if (st.splash) {
      for (const e of [...s.enemies]) {
        if (canHit(st, e) && Math.hypot(e.x - target.x, e.y - target.y) <= st.splash) hurt(s, e, st.dmg, t, st);
      }
      s.events.push({ k: 'burst', x: target.x, y: target.y, r: st.splash, air: true });
    } else hurt(s, target, st.dmg, t, st);
  }
}

function flyShells(s, dt) {
  const landed = [];
  for (const sh of s.shells) {
    sh.t += dt;
    const tgt = s.enemies.find((e) => e.id === sh.target);
    if (tgt) sh.to = [tgt.x + sh.off[0], tgt.y + sh.off[1]];
    if (sh.t >= sh.dur) landed.push(sh);
  }
  if (!landed.length) return;
  s.shells = s.shells.filter((sh) => !landed.includes(sh));
  for (const sh of landed) {
    const [x, y] = sh.to;
    const tower = towerById(s, sh.tower);
    for (const e of [...s.enemies]) {
      if ((e.air ? sh.air : sh.ground) && Math.hypot(e.x - x, e.y - y) <= sh.splash) hurt(s, e, sh.dmg, tower, sh);
    }
    s.events.push({ k: 'burst', x, y, r: sh.splash, big: sh.big });
  }
}

function resolveStrikes(s, dt) {
  const done = [];
  for (const st of s.strikes) {
    st.t -= dt;
    if (st.t > 0) continue;
    done.push(st);
    const dmg = airstrikeDamage(s.wave);
    let kills = 0;
    for (const e of [...s.enemies]) {
      if (Math.hypot(e.x - st.x, e.y - st.y) > AIRSTRIKE_RADIUS) continue;
      if (hurt(s, e, dmg, null, { pierce: true })) kills++;
    }
    s.stats.strikeBest = Math.max(s.stats.strikeBest, kills);
    s.events.push({ k: 'strike', x: st.x, y: st.y, kills });
  }
  if (done.length) s.strikes = s.strikes.filter((x) => !done.includes(x));
}

/** Deal damage; returns true if it killed. */
function hurt(s, e, dmg, tower, opts) {
  if (e.hp <= 0) return false;
  const jamBonus = e.jamT > 0 ? 1.15 : 1;
  const d = damageSplit(e, dmg * jamBonus, opts);
  e.shield -= d.shield;
  e.hp -= d.hp;
  e.lastHit = s.t;
  if (e.hp > 0) return false;
  s.enemies = s.enemies.filter((o) => o !== e);
  const def = ENEMIES[e.type];
  let reward = (e.reward || def.reward) * (s.mods.includes('poor') ? 0.75 : 1);
  for (const t of s.towers) {
    if (t.type === 'bank' && t.level === 3 && t.branch === 1 && Math.hypot(t.x + 0.5 - e.x, t.y + 0.5 - e.y) <= TOWERS.bank.branches[1].range) { reward *= 2; break; }
  }
  reward = Math.round(reward);
  s.funds += reward;
  s.stats.kills++;
  if (e.boss) s.stats.bossKills++;
  if (tower) tower.kills++;
  s.events.push({ k: 'die', id: e.id, type: e.type, x: e.x, y: e.y, reward, boss: e.boss, air: e.air });
  return true;
}

// ---------------------------------------------------------------- results

export const wavesCleared = (s) => (s.over === 'win' ? s.totalWaves : Math.max(0, s.wave - 1));
export function dailyScore(s) { return wavesCleared(s) * 100 + (s.over === 'win' ? s.lives * 25 : 0); }

/** Run until the game ends or maxT seconds pass (tests and the bot). onTick(s) runs every step. */
export function runUntilOver(s, { maxT = 3600, onTick, keepEvents = false } = {}) {
  while (!s.over && s.t < maxT) { onTick?.(s); step(s); if (!keepEvents) s.events.length = 0; }
  return s.over;
}

// Computer rivals. One call to playTurn() makes all of a civ's decisions for its turn: diplomacy,
// research, what cities build, and every unit's orders. The adaptive skill (0..1) only changes HOW
// it decides (how many cities it aims for, how well it picks builds and techs, how carefully it
// attacks). It never gets extra gold, production or units.
import * as G from './game.js';
import {
  UNITS, BUILDINGS, WONDERS, TECHS, CIV_BY_ID, RESOURCES, JOBS,
} from './data.js';
import { siteScore } from './map.js';

const PRESETS = {
  easy: { cities: 0.45, workerRatio: 0.3, milRatio: 0.7, attackOdds: 0.36, group: 1, smartBuild: 0.35, smartTech: 0.2, siteLook: 5, garrison: 1, buy: 0, warEager: 0.6, focusFire: 0, retreat: 0, wonderBias: 0.3 },
  normal: { cities: 0.75, workerRatio: 0.7, milRatio: 1.0, attackOdds: 0.58, group: 2, smartBuild: 0.8, smartTech: 0.7, siteLook: 7, garrison: 1, buy: 0.6, warEager: 1, focusFire: 0.6, retreat: 0.5, wonderBias: 0.6 },
  hard: { cities: 1.05, workerRatio: 1.0, milRatio: 1.1, attackOdds: 0.64, group: 3, smartBuild: 1, smartTech: 1, siteLook: 9, garrison: 1, buy: 1, warEager: 1.2, focusFire: 1, retreat: 1, wonderBias: 0.8 },
};

/** Blend the presets at skill k (0 easy, 0.5 normal, 1 hard). */
export function aiParams(k) {
  const s = Math.max(0, Math.min(1, k));
  const { easy, normal, hard } = PRESETS;
  const out = { skill: s };
  for (const key of Object.keys(normal)) {
    const a = easy[key]; const b = normal[key]; const c = hard[key];
    out[key] = s <= 0.5 ? a + (b - a) * (s / 0.5) : b + (c - b) * ((s - 0.5) / 0.5);
  }
  out.group = Math.round(out.group);
  out.garrison = Math.round(out.garrison);
  return out;
}

const personality = (s, c) => CIV_BY_ID[s.civs[c].key];

// ---------------------------------------------------------------- helpers

function enemiesOf(s, c) { return s.civs.filter((o) => o.alive && o.id !== c && G.atWar(s, c, o.id)).map((o) => o.id); }

function threatNear(s, c, x, y, r = 3) {
  return s.units.filter((u) => u.owner !== c && !G.isCivilian(u) && G.atWar(s, c, u.owner) && G.dist(u.x, u.y, x, y) <= r)
    .reduce((a, u) => a + UNITS[u.type].str * u.hp / 10, 0);
}

function bestUnit(s, c, role) {
  const opts = Object.keys(UNITS).filter((t) => !UNITS[t].civ && G.unitAvailable(s, c, t));
  if (!opts.length) return 'warrior';
  const val = (t) => {
    const d = UNITS[t];
    if (role === 'def') return (d.str * (d.vsMounted ? 1.25 : 1)) / Math.sqrt(d.cost) - (d.vsCity ? 2 : 0) - (d.move > 1 ? 0.3 : 0);
    if (role === 'siege') return d.vsCity ? d.str * 3 : d.str * 0.5;
    return (d.str * (1 + (d.move - 1) * 0.25)) / Math.sqrt(d.cost) - (d.vsCity ? 0.5 : 0);
  };
  return opts.sort((a, b) => val(b) - val(a))[0];
}

function civTargetCities(s, c, P) {
  const land = s.tiles.filter((t) => G.isLand(t)).length;
  const share = land / s.civs.filter((x) => x.alive).length;
  const room = Math.max(2, share / 13);
  const grow = personality(s, c).grow;
  return Math.max(2, Math.round(room * P.cities * (0.8 + grow * 0.4)));
}

// ---------------------------------------------------------------- settling

/** Best spot to found a city reachable from (x, y), avoiding spots other settlers are heading to. */
export function pickSite(s, c, u, P, taken = []) {
  const cities = G.citiesOf(s, c);
  const ex = s.civs[c].explored;
  let best = null; let bs = -Infinity;
  const look = Math.round(P.siteLook);
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      const d = G.dist(u.x, u.y, x, y);
      if (d > look) continue;
      if (!ex[G.idx(s, x, y)]) continue;
      if (!G.canFoundAt(s, c, x, y)) continue;
      if (taken.some(([tx, ty]) => G.dist(tx, ty, x, y) < G.MIN_CITY_DIST)) continue;
      const near = cities.length ? Math.min(...cities.map((ct) => G.dist(ct.x, ct.y, x, y))) : 0;
      if (cities.length && near > 6) continue;
      // Stay away from enemy units.
      if (threatNear(s, c, x, y, 2) > 0) continue;
      let sc = siteScore(s, x, y) - d * (P.smartBuild > 0.7 ? 1.6 : 0.8);
      if (cities.length && near === 3) sc += 2; // packed cities share land but stay compact
      if (G.tileAt(s, x, y).t === 'coast') sc += 0;
      if (sc > bs) { bs = sc; best = [x, y]; }
    }
  }
  return best;
}

function playSettler(s, c, u, P, taken) {
  // First city: found right away (or one step away if this spot is bad).
  if (!G.citiesOf(s, c).length && !s.civs[c].everCity) {
    if (G.canFoundAt(s, c, u.x, u.y)) { G.foundCity(s, u); return; }
  }
  let site = u.aiSite && G.canFoundAt(s, c, u.aiSite[0], u.aiSite[1]) ? u.aiSite : null;
  if (!site) site = pickSite(s, c, u, P, taken);
  if (!site) {
    // Nowhere to go: settle here if possible, else wander back home.
    if (G.canFoundAt(s, c, u.x, u.y) && s.turn > 30) G.foundCity(s, u);
    return;
  }
  u.aiSite = site;
  taken.push(site);
  if (u.x === site[0] && u.y === site[1]) { G.foundCity(s, u); return; }
  G.moveUnit(s, u, site[0], site[1], { keepGoto: false });
  if (u.x === site[0] && u.y === site[1] && u.moves > 0) G.foundCity(s, u);
}

// ---------------------------------------------------------------- workers

function jobValue(s, c, i, kind) {
  const t = s.tiles[i];
  const ct = G.cityById(s, t.c);
  if (!ct) return -1;
  if (kind === 'farm') {
    const surplus = G.cityYield(s, ct).surplus;
    return (surplus >= 3 ? 1 : t.t === 'grass' || t.t === 'plains' ? 3 : 1.5) + (t.r ? 1 : 0);
  }
  if (kind === 'mine') return 3 + (t.r ? 1.5 : 0);
  if (kind === 'chop') {
    const forests = G.cityRadiusTiles(s, ct).filter((k) => s.tiles[k].f === 'forest').length;
    return forests > 3 ? 1.6 : -1;
  }
  return -1;
}

function playWorker(s, c, u, P, claimed) {
  if (u.job) return;
  // Already standing on a good job?
  const here = G.jobOptions(s, u).map((k) => [k, jobValue(s, c, G.idx(s, u.x, u.y), k)]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (here.length && !claimed.has(G.idx(s, u.x, u.y))) { G.startJob(s, u, here[0][0]); claimed.add(G.idx(s, u.x, u.y)); return; }
  let best = null; let bv = 0;
  for (let i = 0; i < s.tiles.length; i++) {
    const t = s.tiles[i];
    if (t.o !== c || claimed.has(i) || t.c < 0) continue;
    const x = i % s.w; const y = Math.floor(i / s.w);
    if (G.cityAt(s, x, y)) continue;
    const d = G.dist(u.x, u.y, x, y);
    if (d > 10) continue;
    for (const [k, j] of Object.entries(JOBS)) {
      if (!j.ok(t.t, t.f) || t.imp === k) continue;
      const v = jobValue(s, c, i, k) - d * 0.25;
      if (v > bv && !G.civilianAt(s, x, y)) { bv = v; best = [x, y, i]; }
    }
  }
  if (!best) {
    // Nothing to do: go home and wait in safety.
    const home = G.citiesOf(s, c)[0];
    if (home && !G.cityAt(s, u.x, u.y)) G.moveUnit(s, u, home.x, home.y, { keepGoto: false });
    if (u.moves > 0) G.fortify(s, u);
    return;
  }
  claimed.add(best[2]);
  G.moveUnit(s, u, best[0], best[1], { keepGoto: false });
  if (u.x === best[0] && u.y === best[1]) {
    const opts = G.jobOptions(s, u).map((k) => [k, jobValue(s, c, best[2], k)]).sort((a, b) => b[1] - a[1]);
    if (opts.length && opts[0][1] > 0) G.startJob(s, u, opts[0][0]);
  }
}

// ---------------------------------------------------------------- research

const TECH_TASTE = {
  pottery: 2, bronze: 2.5, writing: 3, burial: 1.5, masonry: 1.5, currency: 2.5, philosophy: 2.5, iron: 1.5, wheel: 1,
  mathematics: 1.5, mapmaking: 0.6, construction: 1.5, religion: 1.2, astronomy: 2.5, banking: 2, gunpowder: 2,
  medicine: 1.2, chivalry: 1, metallurgy: 1.2, steam: 1.5, conscription: 1.5, industry: 2.5, electricity: 2,
  automobile: 1.5, computers: 2.5, rocketry: 2, spaceflight: 3,
};

function pickTech(s, c, P) {
  const opts = G.availableTechs(s, c);
  if (!opts.length) return null;
  const r = G.rng(s);
  if (r() > P.smartTech) return opts[Math.floor(r() * opts.length)];
  const p = personality(s, c);
  const war = enemiesOf(s, c).length > 0;
  const val = (t) => {
    const d = TECHS[t];
    // Cheap, useful techs first: a smart civ fills in its economy before chasing big ones.
    let v = (TECH_TASTE[t] || 1) / d.cost;
    const unlocksUnit = Object.values(UNITS).some((u) => u.tech === t && !u.civ);
    if (unlocksUnit && war) v *= 1.6;
    if (Object.values(BUILDINGS).some((b) => b.tech === t && b.pct?.sci)) v *= 1 + p.sci * 0.4;
    return v * (0.95 + r() * 0.1);
  };
  return opts.sort((a, b) => val(b) - val(a))[0];
}

// ---------------------------------------------------------------- production

function militaryCount(s, c) { return s.units.filter((u) => u.owner === c && !G.isCivilian(u)).length; }

function defendersIn(s, ct) { return s.units.filter((u) => u.owner === ct.owner && !G.isCivilian(u) && u.x === ct.x && u.y === ct.y).length; }
/** Defenders in or right next to the city (only one military unit fits on the city tile). */
function guardsOf(s, ct) { return s.units.filter((u) => u.owner === ct.owner && !G.isCivilian(u) && G.dist(u.x, u.y, ct.x, ct.y) <= 1).length; }

function chooseBuild(s, ct, P, ctx) {
  const c = ct.owner;
  const opts = G.buildOptions(s, ct);
  if (!opts.length) return null;
  const r = G.rng(s);
  if (r() > P.smartBuild) {
    // A sloppy pick (lower skill), but never a settler from a size-1 city.
    const enough = ctx.settlers + G.citiesOf(s, c).length >= ctx.targetCities;
    const ok = opts.filter((o) => !(o.kind === 'unit' && UNITS[o.id].pop && (ct.pop < 2 || enough)));
    return ok[Math.floor(r() * ok.length)] || null;
  }
  const p = personality(s, c);
  const y = G.cityYield(s, ct);
  const joy = G.joyOf(s, c);
  const war = enemiesOf(s, c).length > 0;
  const threat = threatNear(s, c, ct.x, ct.y, 4);
  const score = new Map();
  const set = (item, v) => { if (opts.some((o) => o.kind === item.kind && o.id === item.id)) score.set(`${item.kind}:${item.id}`, { item, v }); };

  // Defence first.
  const defs = guardsOf(s, ct);
  const needDef = threat > 0 ? P.garrison + 1 : P.garrison;
  if (defs < needDef) set({ kind: 'unit', id: bestUnit(s, c, 'def') }, 100 + threat);
  // Expansion.
  const cities = G.citiesOf(s, c).length;
  if (ctx.settlers + cities < ctx.targetCities && ct.pop >= 2 && joy.net >= -2 && ctx.room && !war) set({ kind: 'unit', id: 'settler' }, 60 + p.grow * 30);
  // Workers.
  if (ctx.workers < Math.max(1, Math.round(cities * P.workerRatio))) set({ kind: 'unit', id: 'worker' }, 45);
  // Army.
  const income = G.civTotals(s, c).net;
  // Smarter rivals keep up with the strongest neighbour's army.
  const myPow = G.militaryPower(s, c);
  const rivalPow = Math.max(0, ...s.civs.filter((o) => o.alive && o.id !== c && s.civs[c].met[o.id]).map((o) => G.militaryPower(s, o.id)));
  const keepUp = P.smartBuild > 0.7 && rivalPow > myPow * 1.1 ? Math.ceil(cities * 0.6) : 0;
  const wantMil = keepUp + (income < 0 && !war ? -2 : 0) + Math.round(cities * P.milRatio * (0.6 + p.war * 0.8) + (war ? cities * 1.2 : 0) + (s.turn > 60 ? 1 : 0));
  if (ctx.military < wantMil) {
    const siege = ctx.siege < Math.floor(ctx.military / 3) && war;
    set({ kind: 'unit', id: bestUnit(s, c, siege ? 'siege' : 'att') }, 40 + (war ? 35 : 0) + p.war * 15);
  }
  // Buildings.
  for (const o of opts) {
    if (o.kind !== 'bld') continue;
    const b = BUILDINGS[o.id];
    let v = 10;
    if (b.joy) v += joy.net < -2 ? 70 + b.joy * 5 : joy.net < 1 ? 42 + b.joy * 4 : 6;
    if (b.add?.food) v += y.surplus <= 1 ? 26 : 12;
    if (b.pct?.sci) v += 14 + y.sci * 1.5 * (0.6 + p.sci);
    if (b.pct?.gold) v += 10 + y.gold * 1.5;
    if (b.pct?.prod) v += 12 + y.prod * 1.2;
    if (b.walls) v += threat > 0 || war ? 40 : 2;
    if (b.veteran) v += war ? 18 : 0;
    if (b.aqueduct) v += ct.pop >= 7 ? 40 : -5;
    v -= b.upkeep * (s.civs[c].gold < 30 || income < 2 ? 10 : 2) * P.smartBuild;
    if (b.pct?.gold && income < 3) v += 20;
    set(o, v);
  }
  // Wonders (best production city, personality and skill).
  for (const o of opts) {
    if (o.kind !== 'wonder') continue;
    const w = WONDERS[o.id];
    let v = 8 + y.prod * 1.4 * P.wonderBias * (0.6 + p.sci);
    if (w.victory) v = 200;
    if (war) v -= 15;
    set(o, v);
  }
  let best = null;
  for (const e of score.values()) if (!best || e.v > best.v) best = e;
  return best?.item || opts[0];
}

// ---------------------------------------------------------------- diplomacy

function diplomacy(s, c, P) {
  const me = s.civs[c];
  const p = personality(s, c);
  const r = G.rng(s);
  const myPow = G.militaryPower(s, c);
  for (const o of s.civs) {
    if (!o.alive || o.id === c || !me.met[o.id]) continue;
    const rr = G.rel(s, c, o.id);
    if (rr.war) {
      // Make peace when it suits both sides (humans are asked).
      if (G.acceptsPeace(s, c, o.id) && r() < 0.35) {
        if (o.human) offer(s, c, o.id, 'peace');
        else if (G.acceptsPeace(s, o.id, c)) G.makePeace(s, c, o.id);
      }
      continue;
    }
    if (!rr.pact && G.acceptsPact(s, c, o.id) && r() < 0.06) {
      if (o.human) offer(s, c, o.id, 'pact');
      else if (G.acceptsPact(s, o.id, c)) G.signPact(s, c, o.id);
    }
    // War: only when stronger, unfriendly and the time is right.
    const minTurn = (s.tutorial && o.human ? 60 : 22) + Math.round((1 - p.war) * 15);
    if (s.turn < minTurn) continue;
    if (s.turn - rr.since < 10 && rr.since > 0) continue;
    if (enemiesOf(s, c).length) continue;
    const theirPow = G.militaryPower(s, o.id);
    const att = G.attitude(s, c, o.id);
    const ratio = myPow / Math.max(4, theirPow);
    const need = 1.6 - p.war * 0.5 - (P.warEager - 1) * 0.2;
    if (att > 1 || ratio < need) continue;
    const chance = 0.04 * p.war * P.warEager * (att <= -4 ? 2 : 1);
    if (r() < chance && G.citiesOf(s, o.id).length) G.declareWar(s, c, o.id);
  }
}

function offer(s, from, to, kind) {
  s.offers = s.offers || [];
  s.offerLog = s.offerLog || {};
  const key = `${from}-${to}-${kind}`;
  // Don't pester: one offer of a kind every 12 turns.
  if (s.offers.some((o) => o.from === from && o.to === to && o.kind === kind) || s.turn - (s.offerLog[key] ?? -99) < 12) return;
  s.offerLog[key] = s.turn;
  s.offers.push({ from, to, kind, turn: s.turn });
}

// ---------------------------------------------------------------- military

function strikeValue(s, u, info) {
  if (info.kind === 'capture') return info.city ? 1000 : 30;
  const dv = UNITS[info.def.type].str * (info.city ? 3 : 1);
  const uv = UNITS[u.type].str;
  return info.win * dv - (1 - info.win) * uv;
}

/** Look for the best attack reachable this turn. Returns { tile, from, info } or null. */
function bestStrike(s, c, u, P, reach) {
  let best = null; let bv = 0;
  const ox = u.x; const oy = u.y;
  for (const [i, r] of reach) {
    if (r.passOnly) continue;
    if (r.left <= 0 && i !== G.idx(s, ox, oy)) continue;
    const fx = i % s.w; const fy = Math.floor(i / s.w);
    for (const [dx, dy] of G.DIRS8) {
      const tx = fx + dx; const ty = fy + dy;
      if (!G.inMap(s, tx, ty)) continue;
      u.x = fx; u.y = fy;
      const info = G.targetInfo(s, u, tx, ty);
      u.x = ox; u.y = oy;
      if (!info || info.needsWar) continue;
      if (info.kind === 'attack') {
        // Damaged defenders are worth finishing (focus fire on higher skill).
        const finish = info.def.hp <= 4 ? 0.15 * P.focusFire : 0;
        if (info.win + finish < P.attackOdds) continue;
      }
      const v = strikeValue(s, u, info) - G.dist(ox, oy, fx, fy) * 0.1;
      if (v > bv) { bv = v; best = { from: [fx, fy], tile: [tx, ty], info }; }
    }
  }
  return best;
}

function nearestEnemyCity(s, c, x, y) {
  let best = null; let bd = 999;
  for (const ct of s.cities) {
    if (!G.atWar(s, c, ct.owner)) continue;
    const d = G.dist(ct.x, ct.y, x, y);
    if (d < bd) { bd = d; best = ct; }
  }
  return best;
}

function explore(s, c, u) {
  const ex = s.civs[c].explored;
  let best = null; let bd = 999;
  for (let i = 0; i < ex.length; i++) {
    if (ex[i]) continue;
    const t = s.tiles[i];
    if (!G.isLand(t)) continue;
    const x = i % s.w; const y = Math.floor(i / s.w);
    const d = G.dist(u.x, u.y, x, y);
    if (d < bd) { bd = d; best = [x, y]; }
  }
  if (!best) return false;
  const steps = G.moveUnit(s, u, best[0], best[1], { keepGoto: false });
  return steps.length > 0;
}

function playMilitary(s, c, P, ctx) {
  const mine = () => s.units.filter((u) => u.owner === c && !G.isCivilian(u));
  const cities = G.citiesOf(s, c);
  const enemies = enemiesOf(s, c);
  const assigned = new Set();
  // 1. Garrisons: keep P.garrison (more when threatened) defenders in each city.
  for (const ct of cities) {
    const threat = threatNear(s, c, ct.x, ct.y, 4);
    const need = threat > 0 ? P.garrison + 1 : P.garrison;
    const inside = mine().filter((u) => u.x === ct.x && u.y === ct.y);
    inside.forEach((u) => assigned.add(u.id));
    let have = inside.length;
    // Only one military unit fits per tile: extra defenders stand guard next to the city.
    if (have < need) {
      const free = mine().filter((u) => !assigned.has(u.id) && u.moves > 0).sort((a, b) => G.dist(a.x, a.y, ct.x, ct.y) - G.dist(b.x, b.y, ct.x, ct.y));
      for (const u of free) {
        if (have >= need) break;
        if (G.dist(u.x, u.y, ct.x, ct.y) > 8) break;
        assigned.add(u.id);
        have++;
        if (!inside.length && !G.militaryAt(s, ct.x, ct.y)) G.moveUnit(s, u, ct.x, ct.y, { keepGoto: false });
        else if (G.dist(u.x, u.y, ct.x, ct.y) > 1) {
          const spot = G.DIRS8.map(([dx, dy]) => [ct.x + dx, ct.y + dy]).find(([x, y]) => G.inMap(s, x, y) && !G.militaryAt(s, x, y) && G.stepCost(s, u, x, y) < 9 && G.isLand(G.tileAt(s, x, y)));
          if (spot) G.moveUnit(s, u, spot[0], spot[1], { keepGoto: false });
        }
      }
    }
  }
  // Defenders hit adjacent attackers with good odds, then fortify.
  for (const u of mine().filter((x) => assigned.has(x.id))) {
    if (u.moves > 0 && enemies.length) {
      for (const [dx, dy] of G.DIRS8) {
        const info = G.targetInfo(s, u, u.x + dx, u.y + dy);
        if (info && !info.needsWar && info.kind === 'attack' && info.win >= Math.max(0.7, P.attackOdds + 0.1) && u.moves > 0) {
          const home = [u.x, u.y];
          const res = G.attack(s, u, u.x + dx, u.y + dy);
          if (res?.won && G.unitById(s, u.id) && (u.x !== home[0] || u.y !== home[1])) G.moveUnit(s, u, home[0], home[1], { keepGoto: false });
          break;
        }
      }
    }
    const live = G.unitById(s, u.id);
    if (live && live.moves > 0 && G.cityAt(s, live.x, live.y)) G.fortify(s, live);
  }
  // 2. Field army.
  const field = mine().filter((u) => !assigned.has(u.id));
  let scout = enemies.length ? null : field.find((u) => UNITS[u.type].move > 1) || (s.turn < 40 ? field[0] : null);
  for (const u of field) {
    if (!G.unitById(s, u.id) || u.moves <= 0) continue;
    // Hurt units fall back to heal (higher skill only).
    if (u.hp <= 4 && r01(s) < P.retreat) {
      const home = cities.sort((a, b) => G.dist(a.x, a.y, u.x, u.y) - G.dist(b.x, b.y, u.x, u.y))[0];
      if (home && G.dist(home.x, home.y, u.x, u.y) > 1) { G.moveUnit(s, u, home.x, home.y, { keepGoto: false }); continue; }
      G.fortify(s, u); u.fort = false; continue;
    }
    if (enemies.length) {
      // Strike if something good is in reach.
      let guard = 0;
      while (u.moves > 0 && guard++ < 3 && G.unitById(s, u.id)) {
        const reach = G.reachable(s, u);
        const strike = bestStrike(s, c, u, P, reach);
        if (!strike) break;
        if (u.x !== strike.from[0] || u.y !== strike.from[1]) G.moveUnit(s, u, strike.from[0], strike.from[1], { keepGoto: false });
        if (u.moves <= 0 || G.dist(u.x, u.y, strike.tile[0], strike.tile[1]) !== 1) break;
        const res = G.attack(s, u, strike.tile[0], strike.tile[1]);
        if (!res) break;
        // Walk into a city whose last defender just fell.
        const live = G.unitById(s, u.id);
        if (live && res.won && res.kind === 'attack' && res.info.city && live.moves > 0) {
          const again = G.targetInfo(s, live, strike.tile[0], strike.tile[1]);
          if (again?.kind === 'capture') G.attack(s, live, strike.tile[0], strike.tile[1]);
        }
      }
      if (!G.unitById(s, u.id) || u.moves <= 0) continue;
      // March on the nearest enemy city, waiting for the group to gather.
      const target = nearestEnemyCity(s, c, u.x, u.y);
      if (target) {
        const d = G.dist(u.x, u.y, target.x, target.y);
        const near = field.filter((o) => G.unitById(s, o.id) && G.dist(o.x, o.y, target.x, target.y) <= Math.max(d, 4) + 1).length;
        if (d <= 4 && near < P.group && d > 1) { G.fortify(s, u); u.fort = false; continue; }
        const path = G.findPath(s, u, target.x, target.y, { attack: true });
        if (path && path.length > 1) {
          const stop = path[Math.min(path.length - 2, path.length - 2)];
          G.moveUnit(s, u, stop[0], stop[1], { keepGoto: false });
        } else if (!path) {
          // Can't get there (water or blocked): step toward it anyway.
          G.moveUnit(s, u, target.x, target.y, { keepGoto: false });
        }
        continue;
      }
    }
    if (u === scout && explore(s, c, u)) continue;
    // Peacetime: guard the city closest to rivals.
    const front = cities.map((ct) => ({ ct, d: Math.min(99, ...s.cities.filter((o) => o.owner !== c).map((o) => G.dist(o.x, o.y, ct.x, ct.y))) })).sort((a, b) => a.d - b.d)[0]?.ct;
    if (front) {
      if (G.dist(u.x, u.y, front.x, front.y) > 1) {
        const spot = G.DIRS8.map(([dx, dy]) => [front.x + dx, front.y + dy]).find(([x, y]) => G.inMap(s, x, y) && !G.militaryAt(s, x, y) && G.isLand(G.tileAt(s, x, y)) && G.stepCost(s, u, x, y) < 9 && !G.cityAt(s, x, y));
        if (spot) G.moveUnit(s, u, spot[0], spot[1], { keepGoto: false });
      } else G.fortify(s, u);
    }
  }
}

const r01 = (s) => G.rng(s)();

// ---------------------------------------------------------------- the whole turn

export function playTurn(s, c, P = aiParams(s.civs[c].skill)) {
  if (s.over || !s.civs[c].alive) return;
  diplomacy(s, c, P);
  const cv = s.civs[c];
  if (!cv.research) { const t = pickTech(s, c, P); if (t) G.setResearch(s, c, t); }

  // Settlers and workers.
  const taken = [];
  for (const u of s.units.filter((x) => x.owner === c && x.type === 'settler')) if (G.unitById(s, u.id)) playSettler(s, c, u, P, taken);
  const claimed = new Set(s.units.filter((x) => x.owner === c && x.job).map((x) => G.idx(s, x.x, x.y)));
  for (const u of s.units.filter((x) => x.owner === c && x.type === 'worker')) if (G.unitById(s, u.id)) playWorker(s, c, u, P, claimed);

  // Military.
  playMilitary(s, c, P, {});

  // Production.
  const settlers = () => s.units.filter((u) => u.owner === c && u.type === 'settler').length + s.cities.filter((ct) => ct.owner === c && ct.queue[0]?.id === 'settler').length;
  const ctx = {
    targetCities: civTargetCities(s, c, P),
    get settlers() { return settlers(); },
    get workers() { return s.units.filter((u) => u.owner === c && u.type === 'worker').length + s.cities.filter((ct) => ct.owner === c && ct.queue[0]?.id === 'worker').length; },
    get military() { return militaryCount(s, c) + s.cities.filter((ct) => ct.owner === c && ct.queue[0]?.kind === 'unit' && !UNITS[ct.queue[0].id].civ).length; },
    get siege() { return s.units.filter((u) => u.owner === c && UNITS[u.type].vsCity).length; },
    incoming: () => 0,
    room: true,
  };
  // Is there anywhere left to settle?
  const anyCity = G.citiesOf(s, c)[0];
  if (anyCity) ctx.room = !!pickSite(s, c, anyCity, { ...P, siteLook: 8 }, []);
  for (const ct of G.citiesOf(s, c)) {
    const threat = threatNear(s, c, ct.x, ct.y, 3);
    // Better players steer their cities: grow small ones, push production for big builds.
    if (P.smartBuild >= 0.75) {
      const joy = G.joyOf(s, c).net;
      const q = ct.queue[0];
      const big = q && (q.kind === 'wonder' || (q.id === 'settler' && ct.pop >= 2));
      ct.focus = q?.id === 'settler' && ct.pop < 2 ? 'food' : joy >= 1 && ct.pop < 4 && !big ? 'food' : big || joy < 0 ? 'prod' : 'balanced';
    }
    // A settler waiting for a city that can't grow: build something else first.
    if (ct.queue[0]?.id === 'settler' && ct.pop < 2 && G.cityYield(s, ct).surplus <= 0) {
      ct.queue.shift();
      if (!ct.queue.length) { const item = chooseBuild(s, ct, P, { ...ctx, targetCities: 0 }); if (item && item.id !== 'settler') G.enqueue(s, ct, item); }
    }
    // Emergency: an undefended city under threat switches to a defender.
    if (threat > 0 && defendersIn(s, ct) === 0 && ct.queue[0]?.kind !== 'unit') {
      ct.queue.unshift({ kind: 'unit', id: bestUnit(s, c, 'def') });
      if (P.buy > 0.3) G.buy(s, ct);
    }
    if (!ct.queue.length) {
      const item = chooseBuild(s, ct, P, ctx);
      if (item) G.enqueue(s, ct, item);
    }
    // Spend spare gold (better players buy what matters).
    if (P.buy > 0 && ct.queue.length) {
      const cost = G.buyCost(s, ct);
      const reserve = 40 + G.citiesOf(s, c).length * 10;
      const q = ct.queue[0];
      const useful = q.kind === 'unit' ? (UNITS[q.id].id === 'settler' || threat > 0 || P.buy > 0.5) : true;
      if (cost != null && useful && cv.gold - cost > reserve * (1.2 - P.buy * 0.5)) G.buy(s, ct);
    }
  }
}

/** Answer pending offers addressed to AI civs (from other AIs nothing is queued). */
export function answerOffer(s, o, accept) {
  s.offers = (s.offers || []).filter((x) => x !== o);
  if (!accept) { s.civs[o.from].mood[o.to] = (s.civs[o.from].mood[o.to] || 0) - 1; return false; }
  if (o.kind === 'peace') return G.makePeace(s, o.from, o.to);
  if (o.kind === 'pact') return G.signPact(s, o.from, o.to);
  return false;
}

/** Let the AI play every non-human civ until it is a human's turn (or the game ends). */
export function runAi(s, paramsFor = (c) => aiParams(s.civs[c].skill), maxSteps = 50) {
  let n = 0;
  while (!s.over && !s.civs[s.cur].human && n++ < maxSteps) {
    playTurn(s, s.cur, paramsFor(s.cur));
    G.endTurn(s);
  }
}

/** AI-vs-AI simulation (tests and balancing). skills: one skill per civ. */
export function simulate(s, skills, { maxTurns = 400 } = {}) {
  const P = skills.map((k) => aiParams(k));
  for (const c of s.civs) c.human = false;
  let guard = 0;
  while (!s.over && guard++ < maxTurns * s.civs.length) {
    playTurn(s, s.cur, P[s.cur]);
    // AI-to-AI offers never reach a human; clear any stray ones.
    s.offers = [];
    G.endTurn(s);
  }
  return s;
}

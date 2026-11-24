// Heroes Lite adventure rules: the map, heroes, towns, economy, visiting objects, battles'
// consequences, days and weeks, and win / lose conditions. Pure logic (no Phaser).
import {
  CREATURES, FACTIONS, BUILDINGS, SPELLS, ARTIFACTS, ARTIFACT_IDS, SKILLS, SKILL_IDS, MAX_SKILLS, SKILL_EFFECT,
  MINES, PILES, BOOSTS, MAP_DWELLINGS, NEUTRALS_BY_TIER, RES, expForLevel, armyValue, creatureValue, spellsOfLevel,
} from './data.js';
import { rngFrom } from './rng.js';
import { dijkstra, tracePath } from './path.js';
import { createBattle } from './combat.js';

export const ARMY_SLOTS = 5;
export const MAX_HEROES = 4;
export const HERO_COST = 2500;
export const BASE_MP = 100;
export const PLAYER_COLORS = ['#3b78c4', '#a13d3b', '#6c8c50', '#d88038'];

const BLOCKING = new Set(['T', 'M', '~']);
const BIG_KINDS = new Set(['mine', 'dwelling']);

export const rngOf = (state) => rngFrom(state.rng);
export const idx = (state, x, y) => y * state.w + x;
export const inMap = (state, x, y) => x >= 0 && y >= 0 && x < state.w && y < state.h;
export const getHero = (state, id) => state.heroes.find((h) => h.id === id);
export const getObj = (state, id) => state.objects.find((o) => o.id === id);
export const heroesOf = (state, pid) => state.heroes.filter((h) => h.owner === pid);
export const townsOf = (state, pid) => state.objects.filter((o) => o.kind === 'town' && o.owner === pid);
export const objAt = (state, x, y) => state.objects.find((o) => o.x === x && o.y === y);
export const heroAt = (state, x, y) => state.heroes.find((h) => h.x === x && h.y === y);
export const human = (state) => state.players.find((p) => p.human);

// ---------- Setup ----------

/** Tiles covered (blocked) by an object's picture, not counting its entrance tile. */
export function footprint(o) {
  if (o.kind === 'town') {
    const t = [];
    for (let dy = -3; dy <= -1; dy++) for (let dx = -1; dx <= 1; dx++) t.push([o.x + dx, o.y + dy]);
    t.push([o.x - 1, o.y], [o.x + 1, o.y]);
    return t;
  }
  if (BIG_KINDS.has(o.kind) || (o.kind === 'boost' && BOOSTS[o.boost].big)) return [[o.x, o.y - 1]];
  return [];
}

const LETTERS = {
  G: { kind: 'mine', res: 'gold' }, W: { kind: 'mine', res: 'wood' }, O: { kind: 'mine', res: 'ore' }, E: { kind: 'mine', res: 'gems' },
  g: { kind: 'pile', res: 'gold' }, w: { kind: 'pile', res: 'wood' }, o: { kind: 'pile', res: 'ore' }, e: { kind: 'pile', res: 'gems' },
  c: { kind: 'chest' }, f: { kind: 'campfire' }, a: { kind: 'artifact' }, d: { kind: 'dwelling' },
  r: { kind: 'boost', boost: 'ruby' }, s: { kind: 'boost', boost: 'sapphire' }, p: { kind: 'boost', boost: 'opal' },
  L: { kind: 'boost', boost: 'library' }, X: { kind: 'boost', boost: 'arena' }, k: { kind: 'boost', boost: 'stone' },
  Y: { kind: 'boost', boost: 'tree' }, F: { kind: 'boost', boost: 'fountain' }, S: { kind: 'boost', boost: 'stables' },
  Q: { kind: 'boost', boost: 'shrine' },
};

/**
 * Build a new game from a scenario definition.
 * opts = { faction: player faction, seed, enemyFaction }
 */
export function newGame(scn, opts = {}) {
  const seed = (opts.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  const h = scn.map.length; const w = scn.map[0].length;
  const pf = opts.faction || scn.players[0].faction;
  const ef = opts.enemyFaction || (pf === 'castle' ? 'necro' : 'castle');
  const state = {
    v: 1, scenario: scn.id, name: scn.name, mode: scn.endless ? 'endless' : 'scenario', biome: scn.biome,
    w, h, terrain: [], objects: [], heroes: [], day: 1, rng: { s: seed }, seed, nextId: 1, over: null, news: [],
    endless: null,
    players: scn.players.map((p, i) => ({
      id: i, human: i === 0, faction: i === 0 ? pf : (p.faction === 'enemy' ? ef : p.faction || ef),
      color: PLAYER_COLORS[i], res: { gold: 0, wood: 0, ore: 0, gems: 0, ...(p.res || scn.res || { gold: 7500, wood: 15, ore: 15, gems: 5 }) },
      explored: [], noTownDays: 0, alive: true, waves: !!p.waves, heroesHired: 0,
    })),
  };
  const rng = rngOf(state);
  const dwellQueue = [...(scn.dwellings || [])];
  const spawns = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) {
      const ch = scn.map[y][x];
      if (BLOCKING.has(ch) || ch === ',') { row += ch; continue; }
      row += '.';
      if (ch === '.') continue;
      if (ch === '@') { spawns.push({ x, y }); continue; }
      if (ch === 'A' || ch === 'B' || ch === 'C' || ch === 'N') {
        const owner = ch === 'A' ? 0 : ch === 'N' ? null : 1;
        const faction = owner === null ? (scn.neutralTownFaction || ef) : state.players[owner].faction;
        addTown(state, x, y, owner, faction, rng, scn, ch);
        continue;
      }
      if (/[1-6]/.test(ch)) {
        const ov = scn.monsters?.[`${x},${y}`];
        const tier = Number(ch);
        const type = ov?.type || rng.pick(NEUTRALS_BY_TIER[tier]);
        const count = ov?.count || monsterCount(type, scn.monsterScale || 1, rng);
        addObj(state, { kind: 'monster', x, y, type, count });
        continue;
      }
      const L = LETTERS[ch];
      if (!L) throw new Error(`Unknown map letter ${ch} at ${x},${y} in ${scn.id}`);
      const o = { ...L, x, y };
      if (o.kind === 'mine') o.owner = null;
      if (o.kind === 'pile') o.amount = rng.int(...PILES[o.res].amount);
      if (o.kind === 'pile' && o.res === 'gold') o.amount = Math.round(o.amount / 100) * 100;
      if (o.kind === 'chest') o.gold = rng.pick([1000, 1500, 2000]);
      if (o.kind === 'campfire') { o.gold = rng.int(4, 6) * 100; o.res = rng.pick(['wood', 'ore', 'gems']); o.amount = o.res === 'gems' ? rng.int(2, 4) : rng.int(4, 6); }
      if (o.kind === 'artifact') o.art = scn.artifacts?.[`${x},${y}`] || rng.pick(ARTIFACT_IDS);
      if (o.kind === 'dwelling') { o.creature = dwellQueue.shift() || rng.pick(Object.keys(MAP_DWELLINGS)); o.stock = CREATURES[o.creature].growth; }
      if (o.kind === 'boost') { o.visited = []; if (o.boost === 'shrine') o.spell = rng.pick([...spellsOfLevel(1), ...spellsOfLevel(2)]); }
      addObj(state, o);
    }
    state.terrain.push(row);
  }
  // Starting heroes: one at each owned town.
  for (const p of state.players) {
    for (const t of townsOf(state, p.id)) {
      if (heroesOf(state, p.id).length >= (scn.startHeroes || 1)) break;
      createHero(state, p.id, t.x, t.y, rng, { main: true });
    }
    p.explored = new Array(w * h).fill(0);
  }
  if (scn.endless) {
    state.endless = { spawns, wave: 0, nextWave: scn.firstWave || 6, every: 7, scale: scn.waveScale || 1 };
  }
  if (scn.enemyExtraHero) {
    const t = townsOf(state, 1)[0];
    const spot = [[0, 1], [1, 1], [-1, 1], [0, 2]].map(([dx, dy]) => [t.x + dx, t.y + dy])
      .find(([x, y]) => inMap(state, x, y) && !BLOCKING.has(state.terrain[y][x]) && !objAt(state, x, y) && !heroAt(state, x, y));
    if (spot) createHero(state, 1, spot[0], spot[1], rng, {});
  }
  for (const p of state.players) revealAll(state, p.id);
  state.news = [];
  return state;
}

function addObj(state, o) { o.id = state.nextId++; state.objects.push(o); return o; }

function addTown(state, x, y, owner, faction, rng, scn, letter) {
  const built = {};
  for (const [id, b] of Object.entries(BUILDINGS)) if (b.pre) built[id] = true;
  const extra = scn.townBuilt?.[letter] || (owner === null ? [] : ['tavern']);
  for (const b of extra) built[b] = true;
  const guild = {};
  guild[1] = rng.shuffle([...spellsOfLevel(1)]).slice(0, 2);
  guild[2] = rng.shuffle([...spellsOfLevel(2)]).slice(0, 3);
  guild[3] = rng.shuffle([...spellsOfLevel(3)]).slice(0, 2);
  const f = FACTIONS[faction];
  const stock = f.creatures.map((c, i) => (built[`dw${i}`] ? CREATURES[c].growth : 0));
  const names = scn.townNames?.[letter];
  const t = addObj(state, {
    kind: 'town', x, y, owner, faction, built, builtToday: false, stock, guild,
    name: names || `${['Ashford', 'Brightwater', 'Coldharbor', 'Dunmere', 'Elmstead', 'Greywall'][state.objects.filter((o) => o.kind === 'town').length % 6]}`,
    garrison: new Array(ARMY_SLOTS).fill(null),
  });
  if (owner === null) {
    // Neutral towns are held by their own creatures.
    const g = scn.neutralGarrison || [[0, 20], [1, 10], [2, 5]];
    g.forEach(([tier, n], i) => { t.garrison[i] = { type: f.creatures[tier], count: n }; });
  } else {
    // Every owned town starts with a small garrison so it can't be walked into on day 2.
    (scn.garrison || [[0, 14], [1, 6], [2, 2]]).forEach(([tier, n], i) => { t.garrison[i] = { type: f.creatures[tier], count: n }; });
  }
  return t;
}

function monsterCount(type, scale, rng) {
  const base = { 1: [12, 22], 2: [8, 14], 3: [6, 10], 4: [4, 7], 5: [3, 5], 6: [2, 3] }[CREATURES[type].tier];
  return Math.max(1, Math.round(rng.int(base[0], base[1]) * scale));
}

export function createHero(state, pid, x, y, rng = rngOf(state), { main = false, level = 1, army } = {}) {
  const p = state.players[pid];
  const f = FACTIONS[p.faction];
  const used = new Set(state.heroes.map((h) => h.name));
  const names = f.heroNames.filter((n) => !used.has(n));
  const cls = rng.pick(f.classes);
  const name = names.length ? rng.pick(names) : `${f.heroNames[0]} ${state.heroes.length}`;
  const ni = Math.max(0, f.heroNames.indexOf(name));
  const hero = {
    id: state.nextId++, owner: pid, name, cls: cls.id, might: cls.might, faction: p.faction,
    portrait: [(ni % 10) * 16, f.iconRow + (ni >= 10 ? 16 : 0)], x, y,
    atk: cls.start.atk, def: cls.start.def, pow: cls.start.pow, know: cls.start.know,
    level: 1, exp: 0, mp: 0, mana: 0, army: new Array(ARMY_SLOTS).fill(null), artifacts: [], spells: [],
    skills: {}, visited: [], pendingLevels: 0, levelUp: null, main,
  };
  const startSkill = f.startSkill[cls.might ? 0 : 1];
  hero.skills[startSkill] = 1;
  if (!cls.might) hero.spells.push(rng.pick(spellsOfLevel(1)));
  const cr = f.creatures;
  hero.army = army || [
    { type: cr[0], count: rng.int(10, 16) },
    { type: cr[1], count: rng.int(3, 6) },
    main ? { type: cr[2], count: rng.int(1, 3) } : null,
    null, null,
  ];
  hero.mp = heroMaxMp(hero);
  hero.mana = heroMaxMana(hero);
  state.heroes.push(hero);
  while (level > 1 && hero.level < level) { gainExp(state, hero, expForLevel(hero.level + 1) - hero.exp); autoLevelUps(state, hero); }
  return hero;
}

// ---------- Hero stats ----------

const artSum = (hero, key) => hero.artifacts.reduce((a, id) => a + (ARTIFACTS[id]?.[key] || 0), 0);
export const heroStat = (hero, key) => hero[key] + artSum(hero, key);
export const heroMaxMana = (hero) => heroStat(hero, 'know') * 10;
export function heroMaxMp(hero) {
  const lg = SKILL_EFFECT.logistics[hero.skills.logistics || 0];
  return Math.round(BASE_MP * (1 + lg)) + artSum(hero, 'move');
}
export const heroSight = (hero) => 4 + (hero.skills.scouting || 0) + artSum(hero, 'sight');
/** Stats used in battle. */
export function battleHero(hero) {
  return {
    name: hero.name, atk: heroStat(hero, 'atk'), def: heroStat(hero, 'def'), pow: heroStat(hero, 'pow'),
    know: heroStat(hero, 'know'), mana: hero.mana, spells: hero.spells, skills: hero.skills, portrait: hero.portrait,
  };
}
export const heroArmyValue = (hero) => armyValue(hero.army, { atk: heroStat(hero, 'atk'), def: heroStat(hero, 'def'), pow: heroStat(hero, 'pow'), spells: hero.spells });

// ---------- Fog of war ----------

export function reveal(state, pid, cx, cy, r) {
  const ex = state.players[pid].explored;
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (!inMap(state, x, y)) continue;
      const dx = x - cx; const dy = y - cy;
      if (dx * dx + dy * dy <= r * r + r) ex[idx(state, x, y)] = 1;
    }
  }
}
export function revealAll(state, pid) {
  for (const h of heroesOf(state, pid)) reveal(state, pid, h.x, h.y, heroSight(h));
  for (const t of townsOf(state, pid)) reveal(state, pid, t.x, t.y - 1, 6);
  for (const o of state.objects) if (o.kind === 'mine' && o.owner === pid) reveal(state, pid, o.x, o.y, 2);
}
export const isExplored = (state, pid, x, y) => !!state.players[pid].explored[idx(state, x, y)];

// ---------- Path finding on the adventure map ----------

/** Tile grid as seen by one hero (see path.js for block / stop meaning). */
export function heroGrid(state, hero) {
  const { w, h } = state;
  const n = w * h;
  const block = new Uint8Array(n); const stop = new Uint8Array(n); const attack = new Uint8Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (BLOCKING.has(state.terrain[y][x])) block[y * w + x] = 1;
  const pl = state.players[hero.owner];
  if (pl.human) for (let i = 0; i < n; i++) if (!pl.explored[i]) block[i] = 1;
  for (const o of state.objects) {
    for (const [x, y] of footprint(o)) if (inMap(state, x, y)) block[idx(state, x, y)] = 1;
  }
  const hidden = (i) => pl.human && !pl.explored[i];
  for (const o of state.objects) {
    const i = idx(state, o.x, o.y);
    if (hidden(i)) continue;
    block[i] = 0;
    stop[i] = 1;
    if (o.kind === 'monster') {
      attack[i] = 1;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = o.x + dx; const y = o.y + dy;
        if (inMap(state, x, y)) stop[idx(state, x, y)] = 1;
      }
    }
  }
  for (const o2 of state.heroes) {
    if (o2.id === hero.id) continue;
    const i = idx(state, o2.x, o2.y);
    if (o2.owner === hero.owner) block[i] = 1;
    else if (!hidden(i)) { block[i] = 0; stop[i] = 1; }
  }
  return { w, h, block, stop, attack };
}

export function heroPaths(state, hero, maxCost = Infinity) {
  const grid = heroGrid(state, hero);
  const res = dijkstra(grid, hero.x, hero.y, maxCost);
  return { grid, res };
}

/** Full path to (x, y) or null. */
export function findPath(state, hero, x, y, paths = heroPaths(state, hero)) {
  if (!inMap(state, x, y) || (x === hero.x && y === hero.y)) return null;
  const p = tracePath(paths.grid, paths.res, x, y);
  return p && p.length ? p : null;
}

/** Monster next to a tile (ambushes heroes who step there). */
export function guardAt(state, x, y) {
  return state.objects.find((o) => o.kind === 'monster' && Math.abs(o.x - x) <= 1 && Math.abs(o.y - y) <= 1);
}

/**
 * What happens when the hero follows `path` today.
 * Returns { steps: tiles actually walked, cost, trigger: null | {type, objId?, heroId?} }
 */
export function planMove(state, hero, path) {
  const steps = [];
  let trigger = null;
  let prevCost = 0;
  for (let i = 0; i < path.length; i++) {
    const t = path[i];
    if (t.cost > hero.mp) break;
    const extra = t.cost - prevCost;
    const last = i === path.length - 1;
    const other = heroAt(state, t.x, t.y);
    const o = objAt(state, t.x, t.y);
    if (other && other.owner !== hero.owner) { trigger = { type: 'hero', heroId: other.id, cost: extra }; break; }
    if (o && o.kind === 'monster') { trigger = { type: 'monster', objId: o.id, cost: extra }; break; }
    if (o && o.kind === 'town' && o.owner !== hero.owner) {
      trigger = { type: 'town', objId: o.id, cost: extra };
      break;
    }
    steps.push(t);
    prevCost = t.cost;
    const g = guardAt(state, t.x, t.y);
    // A monster next to the tile ambushes first; visit the object afterwards if you win.
    if (g) {
      const end = path[path.length - 1];
      const meant = end.x === g.x && end.y === g.y; // walking up to attack it on purpose
      trigger = { type: 'monster', objId: g.id, cost: 0, ambush: !meant, then: o ? o.id : null };
      break;
    }
    if (o) { trigger = { type: 'visit', objId: o.id }; break; }
    if (last) break;
  }
  return { steps, cost: prevCost, trigger };
}

/** Move the hero along already-planned steps (updates position, MP and fog). */
export function applySteps(state, hero, steps) {
  for (const s of steps) {
    hero.x = s.x; hero.y = s.y;
    reveal(state, hero.owner, hero.x, hero.y, heroSight(hero));
  }
  if (steps.length) hero.mp = Math.max(0, hero.mp - steps[steps.length - 1].cost);
}

// ---------- Armies ----------

export function addToArmy(army, type, count) {
  if (count <= 0) return true;
  const same = army.findIndex((s) => s && s.type === type);
  if (same >= 0) { army[same].count += count; return true; }
  const empty = army.findIndex((s) => !s);
  if (empty < 0) return false;
  army[empty] = { type, count };
  return true;
}
export const armyCount = (army) => army.filter((s) => s && s.count > 0).length;
export const canAdd = (army, type) => army.some((s) => !s || s.type === type);

// ---------- Visiting objects ----------

/**
 * The hero arrived at an object. Returns { msg, choice?, open? } describing what happened.
 * choice = { kind: 'chest', gold, exp } | { kind: 'dwelling' }  (the UI/AI then calls takeChest / recruitDwelling)
 */
export function visit(state, hero, obj) {
  const p = state.players[hero.owner];
  const out = { msg: '', obj: obj.id };
  switch (obj.kind) {
    case 'pile': {
      p.res[obj.res] += obj.amount;
      out.msg = `Found ${obj.amount} ${obj.res}`;
      out.gain = { [obj.res]: obj.amount };
      removeObj(state, obj);
      break;
    }
    case 'campfire': {
      p.res.gold += obj.gold; p.res[obj.res] += obj.amount;
      out.msg = `Campfire: ${obj.gold} gold, ${obj.amount} ${obj.res}`;
      out.gain = { gold: obj.gold, [obj.res]: obj.amount };
      removeObj(state, obj);
      break;
    }
    case 'chest':
      out.choice = { kind: 'chest', gold: obj.gold, exp: obj.gold - 500 };
      out.msg = 'A treasure chest!';
      break;
    case 'artifact': {
      hero.artifacts.push(obj.art);
      out.msg = `Found the ${ARTIFACTS[obj.art].name}: ${ARTIFACTS[obj.art].desc}`;
      out.art = obj.art;
      removeObj(state, obj);
      if (ARTIFACTS[obj.art].move) hero.mp += ARTIFACTS[obj.art].move;
      break;
    }
    case 'mine': {
      const m = MINES[obj.res];
      if (obj.owner !== hero.owner) {
        obj.owner = hero.owner;
        out.msg = `${m.name} captured: +${m.amount} ${obj.res} a day`;
        out.flag = true;
        reveal(state, hero.owner, obj.x, obj.y, 2);
      } else out.msg = `${m.name}: +${m.amount} ${obj.res} a day`;
      break;
    }
    case 'boost': {
      const b = BOOSTS[obj.boost];
      if (obj.visited.includes(hero.id)) { out.msg = `${b.name}: already visited${b.daily ? ' today' : ''}`; break; }
      obj.visited.push(hero.id);
      if (b.atk) hero.atk += b.atk;
      if (b.def) hero.def += b.def;
      if (b.pow) hero.pow += b.pow;
      if (b.know) hero.know += b.know;
      if (b.mana) hero.mana = Math.max(hero.mana, heroMaxMana(hero));
      if (b.move) hero.mp += b.move;
      out.msg = `${b.name}: ${b.desc}`;
      if (b.exp) gainExp(state, hero, b.exp);
      if (b.level) gainExp(state, hero, expForLevel(hero.level + 1) - hero.exp);
      if (b.spell) {
        if (hero.spells.includes(obj.spell)) out.msg = `${b.name}: you already know ${SPELLS[obj.spell].name}`;
        else { hero.spells.push(obj.spell); out.msg = `${b.name}: learned ${SPELLS[obj.spell].name}`; }
      }
      break;
    }
    case 'dwelling':
      out.choice = { kind: 'dwelling', creature: obj.creature, stock: obj.stock };
      out.msg = `${MAP_DWELLINGS[obj.creature].name}`;
      break;
    case 'town':
      enterTown(state, hero, obj);
      out.open = 'town';
      out.msg = obj.name;
      break;
    default: break;
  }
  return out;
}

export function takeChest(state, hero, obj, pick) {
  if (pick === 'gold') state.players[hero.owner].res.gold += obj.gold;
  else gainExp(state, hero, obj.gold - 500);
  removeObj(state, obj);
}

export function recruitDwelling(state, hero, obj, n) {
  const c = CREATURES[obj.creature];
  const p = state.players[hero.owner];
  n = Math.min(n, obj.stock, maxAffordable(p.res, c.cost));
  if (n <= 0 || !canAdd(hero.army, obj.creature)) return 0;
  payCost(p.res, c.cost, n);
  addToArmy(hero.army, obj.creature, n);
  obj.stock -= n;
  return n;
}

function removeObj(state, obj) { state.objects = state.objects.filter((o) => o !== obj); }

/** Hero stands in a town: learn its guild spells and refill mana if it has a guild. */
export function enterTown(state, hero, town) {
  let learned = 0;
  for (let lv = 1; lv <= 3; lv++) {
    if (!town.built[`guild${lv}`]) continue;
    for (const s of town.guild[lv]) if (!hero.spells.includes(s)) { hero.spells.push(s); learned++; }
  }
  if (town.built.guild1) hero.mana = Math.max(hero.mana, heroMaxMana(hero));
  return learned;
}

// ---------- Experience ----------

export function gainExp(state, hero, n) {
  hero.exp += Math.round(n);
  while (hero.exp >= expForLevel(hero.level + 1)) {
    hero.level += 1;
    hero.pendingLevels += 1;
  }
  prepareLevelUp(state, hero);
}

/** Roll the next level-up offer (a primary stat plus a choice of two skills). Saved, so reloads can't reroll. */
export function prepareLevelUp(state, hero) {
  if (hero.pendingLevels <= 0 || hero.levelUp) return hero.levelUp;
  const rng = rngOf(state);
  const r = rng();
  const w = hero.might ? [0.38, 0.38, 0.12, 0.12] : [0.15, 0.15, 0.35, 0.35];
  let acc = 0; let stat = 'atk';
  for (const [i, k] of ['atk', 'def', 'pow', 'know'].entries()) { acc += w[i]; if (r < acc) { stat = k; break; } }
  const owned = Object.keys(hero.skills);
  const upgrades = owned.filter((s) => hero.skills[s] < 3);
  const fresh = owned.length < MAX_SKILLS
    ? SKILL_IDS.filter((s) => !hero.skills[s] && (!SKILLS[s].necroOnly || hero.faction === 'necro')) : [];
  const opts = [];
  if (upgrades.length) opts.push(rng.pick(upgrades));
  const pool = fresh.filter((s) => !opts.includes(s));
  if (pool.length) opts.push(rng.pick(pool));
  while (opts.length < 2) {
    const more = [...upgrades, ...fresh].filter((s) => !opts.includes(s));
    if (!more.length) break;
    opts.push(rng.pick(more));
  }
  hero.levelUp = { stat, skills: opts };
  return hero.levelUp;
}

export function applyLevelUp(state, hero, pick) {
  const lu = hero.levelUp;
  if (!lu) return;
  hero[lu.stat] += 1;
  const s = lu.skills[pick];
  if (s) hero.skills[s] = (hero.skills[s] || 0) + 1;
  hero.pendingLevels -= 1;
  hero.levelUp = null;
  prepareLevelUp(state, hero);
}

const AI_SKILL_PREF = ['offense', 'armorer', 'necromancy', 'logistics', 'archery', 'wisdom', 'sorcery', 'estates', 'mysticism', 'scouting'];
export function autoLevelUps(state, hero) {
  while (hero.pendingLevels > 0) {
    const lu = prepareLevelUp(state, hero);
    let pick = 0;
    if (lu.skills.length === 2) {
      const a = AI_SKILL_PREF.indexOf(lu.skills[0]); const b = AI_SKILL_PREF.indexOf(lu.skills[1]);
      pick = b < a ? 1 : 0;
    }
    applyLevelUp(state, hero, pick);
  }
}

// ---------- Economy ----------

export function canPay(res, cost, n = 1) { return RES.every((r) => (res[r] || 0) >= (cost[r] || 0) * n); }
export function payCost(res, cost, n = 1) { for (const r of RES) res[r] -= (cost[r] || 0) * n; }
export function maxAffordable(res, cost) {
  let n = Infinity;
  for (const r of RES) if (cost[r]) n = Math.min(n, Math.floor((res[r] || 0) / cost[r]));
  return n === Infinity ? 999 : n;
}

export function townIncome(t) { return t.built.hall3 ? 2000 : t.built.hall2 ? 1000 : 500; }

export function dailyIncome(state, pid) {
  const inc = { gold: 0, wood: 0, ore: 0, gems: 0 };
  for (const t of townsOf(state, pid)) inc.gold += townIncome(t);
  for (const o of state.objects) if (o.kind === 'mine' && o.owner === pid) inc[o.res] += MINES[o.res].amount;
  for (const h of heroesOf(state, pid)) {
    inc.gold += artSum(h, 'gold') + 100 * (h.skills.estates || 0);
  }
  return inc;
}

// ---------- Towns ----------

export function buildStatus(state, town, id) {
  const b = BUILDINGS[id];
  const p = state.players[town.owner];
  if (town.built[id]) return { ok: false, reason: 'Built' };
  const missing = (b.req || []).filter((r) => !town.built[r]);
  if (missing.length) return { ok: false, reason: 'Needs', missing };
  if (town.builtToday) return { ok: false, reason: 'Built today' };
  if (!canPay(p.res, b.cost)) return { ok: false, reason: 'Cost' };
  return { ok: true };
}

export function build(state, town, id) {
  if (!buildStatus(state, town, id).ok) return false;
  const b = BUILDINGS[id];
  payCost(state.players[town.owner].res, b.cost);
  town.built[id] = true;
  town.builtToday = true;
  if (b.dwelling !== undefined) {
    const c = FACTIONS[town.faction].creatures[b.dwelling];
    town.stock[b.dwelling] += CREATURES[c].growth;
  }
  // Heroes in town learn new guild spells at once.
  const vh = visitingHero(state, town);
  if (vh && id.startsWith('guild')) enterTown(state, vh, town);
  return true;
}

export const visitingHero = (state, town) => state.heroes.find((h) => h.x === town.x && h.y === town.y);

export function growth(town, tier) {
  const c = FACTIONS[town.faction].creatures[tier];
  return Math.floor(CREATURES[c].growth * (town.built.fort ? 1.5 : 1));
}

/** Recruit n creatures of a tier. They join the visiting hero (if any and there is room), else the garrison. */
export function recruit(state, town, tier, n, into) {
  const type = FACTIONS[town.faction].creatures[tier];
  const c = CREATURES[type];
  const p = state.players[town.owner];
  n = Math.min(n, town.stock[tier], maxAffordable(p.res, c.cost));
  if (n <= 0) return 0;
  const vh = visitingHero(state, town);
  let army = town.garrison;
  if (into === 'hero' || (into === undefined && vh && canAdd(vh.army, type))) army = vh ? vh.army : town.garrison;
  if (!canAdd(army, type)) {
    const other = army === town.garrison ? vh?.army : town.garrison;
    if (other && canAdd(other, type)) army = other; else return 0;
  }
  payCost(p.res, c.cost, n);
  addToArmy(army, type, n);
  town.stock[tier] -= n;
  return n;
}

/** Move a whole stack between the visiting hero and the garrison. A hero must keep one stack. */
export function transfer(state, town, from, slot) {
  const vh = visitingHero(state, town);
  if (!vh) return false;
  const src = from === 'hero' ? vh.army : town.garrison;
  const dst = from === 'hero' ? town.garrison : vh.army;
  const st = src[slot];
  if (!st) return false;
  if (from === 'hero' && armyCount(vh.army) <= 1) return false;
  if (!canAdd(dst, st.type)) return false;
  addToArmy(dst, st.type, st.count);
  src[slot] = null;
  return true;
}

/** Two of your heroes standing next to each other can swap stacks (each keeps at least one). */
export function exchange(state, from, to, slot) {
  if (Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y)) > 1 || from.owner !== to.owner) return false;
  const st = from.army[slot];
  if (!st || armyCount(from.army) <= 1 || !canAdd(to.army, st.type)) return false;
  addToArmy(to.army, st.type, st.count);
  from.army[slot] = null;
  return true;
}

export function canHire(state, town) {
  const p = state.players[town.owner];
  if (!town.built.tavern) return { ok: false, reason: 'Build a Tavern first' };
  if (visitingHero(state, town)) return { ok: false, reason: 'A hero is in town' };
  if (heroesOf(state, town.owner).length >= MAX_HEROES) return { ok: false, reason: `At most ${MAX_HEROES} heroes` };
  if (p.res.gold < HERO_COST) return { ok: false, reason: `Costs ${HERO_COST} gold` };
  return { ok: true };
}

export function hireHero(state, town) {
  if (!canHire(state, town).ok) return null;
  const p = state.players[town.owner];
  p.res.gold -= HERO_COST;
  p.heroesHired += 1;
  const rng = rngOf(state);
  const cr = FACTIONS[town.faction].creatures;
  const h = createHero(state, town.owner, town.x, town.y, rng, {
    army: [{ type: cr[0], count: rng.int(6, 10) }, null, null, null, null],
  });
  h.mp = heroMaxMp(h);
  enterTown(state, h, town);
  reveal(state, h.owner, h.x, h.y, heroSight(h));
  return h;
}

export const MARKET = { buy: { wood: 300, ore: 300, gems: 600 }, sell: { wood: 100, ore: 100, gems: 250 } };
export function trade(state, pid, res, n) {
  const p = state.players[pid];
  if (!townsOf(state, pid).some((t) => t.built.market)) return false;
  if (n > 0) {
    if (p.res.gold < MARKET.buy[res] * n) return false;
    p.res.gold -= MARKET.buy[res] * n; p.res[res] += n;
  } else {
    if (p.res[res] < -n) return false;
    p.res[res] += n; p.res.gold += MARKET.sell[res] * -n;
  }
  return true;
}

// ---------- Battles on the map ----------

/** Split a wandering monster into a few stacks for battle. */
export function monsterArmy(obj) {
  const n = obj.count;
  const stacks = n < 4 ? 1 : n < 10 ? 2 : n < 30 ? 3 : n < 60 ? 4 : 5;
  const out = [];
  let left = n;
  for (let i = 0; i < stacks; i++) {
    const c = Math.ceil(left / (stacks - i));
    out.push({ type: obj.type, count: c });
    left -= c;
  }
  return out;
}

/** Town walls: defenders get +2 Defense, +5 with a Citadel. */
export const townDefBonus = (t) => (t.built.fort ? 5 : 2);

/** Who fights: setup describes both sides of a map battle. */
export function battleSetup(state, hero, trigger) {
  if (trigger.type === 'monster') {
    const m = getObj(state, trigger.objId);
    return { attacker: hero.id, kind: 'monster', objId: m.id, defName: CREATURES[m.type].name, defArmy: monsterArmy(m), cost: trigger.cost };
  }
  if (trigger.type === 'hero') {
    const d = getHero(state, trigger.heroId);
    const town = state.objects.find((o) => o.kind === 'town' && o.x === d.x && o.y === d.y);
    return { attacker: hero.id, kind: 'hero', heroId: d.id, townId: town?.id, defName: d.name, defArmy: d.army, cost: trigger.cost, defBonus: town ? townDefBonus(town) : 0 };
  }
  if (trigger.type === 'town') {
    const t = getObj(state, trigger.objId);
    const vh = visitingHero(state, t);
    if (vh) return battleSetup(state, hero, { type: 'hero', heroId: vh.id, cost: trigger.cost });
    if (armyCount(t.garrison) === 0) return { attacker: hero.id, kind: 'capture', townId: t.id, cost: trigger.cost };
    return { attacker: hero.id, kind: 'garrison', townId: t.id, defName: `${t.name} garrison`, defArmy: t.garrison, cost: trigger.cost, defBonus: townDefBonus(t) };
  }
  return null;
}

export function setupValues(state, setup) {
  const a = getHero(state, setup.attacker);
  const av = heroArmyValue(a);
  let dv = 0;
  if (setup.kind === 'hero') dv = heroArmyValue(getHero(state, setup.heroId));
  else if (setup.defArmy) dv = armyValue(setup.defArmy) * (1 + 0.05 * (setup.defBonus || 0));
  return { av, dv };
}

/** Owner (player id or null) of the defending side. */
export function defenderOwner(state, setup) {
  if (setup.kind === 'hero') return getHero(state, setup.heroId).owner;
  if (setup.kind === 'garrison' || setup.kind === 'capture') return getObj(state, setup.townId).owner;
  return null;
}

export function makeBattle(state, setup, { seed } = {}) {
  const a = getHero(state, setup.attacker);
  const dOwner = defenderOwner(state, setup);
  const side0 = { hero: battleHero(a), army: a.army, ai: !state.players[a.owner].human, owner: a.owner };
  let side1;
  if (setup.kind === 'hero') {
    const d = getHero(state, setup.heroId);
    side1 = { hero: battleHero(d), army: d.army, ai: !state.players[d.owner].human, owner: d.owner };
  } else {
    side1 = { hero: null, army: setup.defArmy, ai: dOwner === null || !state.players[dOwner].human, owner: dOwner, name: setup.defName };
  }
  const rng = rngOf(state);
  return createBattle(side0, side1, { seed: seed ?? Math.floor(rng() * 2 ** 31), defBonus: setup.defBonus || 0, terrain: state.biome });
}

function writeSurvivors(army, survivors) {
  for (const s of survivors) {
    if (s.count > 0) army[s.slot] = { type: s.type, count: s.count };
    else army[s.slot] = null;
  }
}

/**
 * Apply a finished battle to the map. res = combat result(). Returns
 * { won, msgs[], next: trigger|null (a second battle, e.g. the garrison after the hero), raised? }
 */
export function applyBattle(state, setup, res) {
  const a = getHero(state, setup.attacker);
  const out = { won: res.winner === 0, msgs: [], next: null };
  const [ra, rd] = res.sides;
  writeSurvivors(a.army, ra.survivors);
  a.mana = Math.max(0, ra.mana);
  if (setup.cost) a.mp = Math.max(0, a.mp - setup.cost);
  if (setup.kind === 'hero') {
    const d = getHero(state, setup.heroId);
    writeSurvivors(d.army, rd.survivors);
    d.mana = Math.max(0, rd.mana);
  } else if (setup.kind === 'garrison') {
    writeSurvivors(getObj(state, setup.townId).garrison, rd.survivors);
  } else if (setup.kind === 'monster') {
    const m = getObj(state, setup.objId);
    const left = rd.survivors.reduce((s, x) => s + x.count, 0);
    if (m) m.count = left;
  }
  const winnerHero = out.won ? a : (setup.kind === 'hero' ? getHero(state, setup.heroId) : null);
  const loserHero = out.won ? (setup.kind === 'hero' ? getHero(state, setup.heroId) : null) : a;
  const winSide = out.won ? ra : rd;
  if (winnerHero) {
    let exp = winSide.killedHp + (loserHero ? 500 : 0);
    gainExp(state, winnerHero, exp);
    out.msgs.push(`${winnerHero.name} gains ${exp} experience`);
    const nl = SKILL_EFFECT.necromancy[winnerHero.skills.necromancy || 0];
    if (nl > 0) {
      const raised = Math.floor((winSide.killedLiving * nl) / CREATURES.skeleton.hp);
      if (raised > 0 && addToArmy(winnerHero.army, 'skeleton', raised)) { out.raised = raised; out.msgs.push(`Necromancy raises ${raised} skeletons`); }
    }
  }
  if (loserHero) {
    // The beaten hero is gone; the winner takes the artifacts.
    if (winnerHero) winnerHero.artifacts.push(...loserHero.artifacts);
    if (winnerHero && loserHero.artifacts.length) out.msgs.push(`Took ${loserHero.artifacts.length} artifact(s)`);
    state.heroes = state.heroes.filter((h) => h !== loserHero);
    out.msgs.push(`${loserHero.name} was defeated`);
  }
  if (out.won) {
    if (setup.kind === 'monster') {
      const m = getObj(state, setup.objId);
      if (m) removeObj(state, m);
    } else if (setup.kind === 'hero' && setup.townId) {
      out.next = { type: 'town', objId: setup.townId, cost: 0 };
    } else if (setup.kind === 'garrison' || setup.kind === 'capture') {
      const t = getObj(state, setup.townId);
      captureTown(state, a, t);
      out.msgs.push(`${t.name} captured!`);
      out.captured = t.id;
    }
  }
  checkOver(state);
  return out;
}

export function captureTown(state, hero, town) {
  town.owner = hero.owner;
  town.garrison = town.garrison.map(() => null);
  hero.x = town.x; hero.y = town.y;
  enterTown(state, hero, town);
  reveal(state, hero.owner, town.x, town.y - 1, 6);
  state.players[hero.owner].noTownDays = 0;
}

// ---------- Days ----------

/** Start a new day: income, movement, mana, weekly growth, waves, elimination checks. */
export function newDay(state) {
  state.day += 1;
  state.news = [];
  const week = state.day % 7 === 1;
  const rng = rngOf(state);
  for (const p of state.players) {
    if (!p.alive) continue;
    const inc = dailyIncome(state, p.id);
    for (const r of Object.keys(inc)) p.res[r] += inc[r];
    if (!townsOf(state, p.id).length && !p.waves) p.noTownDays += 1; else p.noTownDays = 0;
  }
  for (const h of state.heroes) {
    h.mp = heroMaxMp(h);
    const myst = 2 * (h.skills.mysticism || 0);
    if (h.mana < heroMaxMana(h)) h.mana = Math.min(heroMaxMana(h), h.mana + 1 + myst);
    const town = state.objects.find((o) => o.kind === 'town' && o.x === h.x && o.y === h.y && o.built.guild1);
    if (town) h.mana = Math.max(h.mana, heroMaxMana(h));
  }
  for (const o of state.objects) {
    if (o.kind === 'town') {
      o.builtToday = false;
      if (week) for (let t = 0; t < 6; t++) if (o.built[`dw${t}`]) o.stock[t] += growth(o, t);
    }
    if (o.kind === 'boost' && BOOSTS[o.boost].daily) o.visited = [];
    if (week && o.kind === 'dwelling') o.stock += CREATURES[o.creature].growth;
    if (week && o.kind === 'monster') o.count = Math.ceil(o.count * 1.1);
  }
  if (state.endless && state.day >= state.endless.nextWave) spawnWave(state, rng);
  checkOver(state);
}

/** Endless mode: a new enemy hero arrives with an army that grows every wave. */
export function spawnWave(state, rng = rngOf(state)) {
  const e = state.endless;
  e.wave += 1;
  e.nextWave = state.day + e.every;
  const pid = state.players.findIndex((p) => p.waves);
  const p = state.players[pid];
  const free = e.spawns.filter((s) => !heroAt(state, s.x, s.y) && !objAt(state, s.x, s.y));
  if (!free.length) return null;
  const sp = rng.pick(free);
  const cr = FACTIONS[p.faction].creatures;
  const budget = 110 * e.scale * Math.pow(e.wave, 1.55);
  const army = new Array(ARMY_SLOTS).fill(null);
  // Spend the budget on the best tiers available for this wave.
  const maxTier = Math.min(5, 1 + Math.floor(e.wave / 2));
  let left = budget;
  for (let t = maxTier; t >= 0 && left > 0; t--) {
    const share = t === 0 ? left : left * (t === maxTier ? 0.4 : 0.3);
    const n = Math.floor(share / creatureValue(cr[t]));
    if (n > 0) { addToArmy(army, cr[t], n); left -= n * creatureValue(cr[t]); }
  }
  if (!army.some(Boolean)) army[0] = { type: cr[0], count: 5 };
  const h = createHero(state, pid, sp.x, sp.y, rng, { army, level: Math.min(12, 1 + Math.floor(e.wave / 2)) });
  h.wave = e.wave;
  // Scouts spot where the wave comes in.
  for (const pl of state.players) if (pl.human) reveal(state, pl.id, h.x, h.y, 2);
  state.news.push(`Wave ${e.wave}: ${h.name} approaches!`);
  return h;
}

/** Sets state.over when someone has won or lost. */
export function checkOver(state) {
  if (state.over) return state.over;
  const hp = human(state);
  const hTowns = townsOf(state, hp.id).length; const hHeroes = heroesOf(state, hp.id).length;
  if ((!hTowns && !hHeroes) || hp.noTownDays >= 7) {
    hp.alive = false;
    state.over = { winner: 'ai', reason: hTowns || hHeroes ? 'A week without a town' : 'All your towns and heroes are lost', day: state.day };
    return state.over;
  }
  for (const p of state.players) {
    if (p.human || p.waves || !p.alive) continue;
    const t = townsOf(state, p.id).length; const hh = heroesOf(state, p.id).length;
    if ((!t && !hh) || p.noTownDays >= 7) p.alive = false;
  }
  if (state.mode === 'scenario') {
    const enemyTowns = state.objects.filter((o) => o.kind === 'town' && o.owner !== null && o.owner !== hp.id).length;
    const enemiesAlive = state.players.some((p) => !p.human && p.alive);
    if (enemyTowns === 0 || !enemiesAlive) {
      state.over = { winner: 'human', reason: 'All enemy towns captured', day: state.day };
      for (const p of state.players) if (!p.human) p.alive = false;
    }
  }
  return state.over;
}

/** Turn the player's whole state into JSON-safe data (it already is) and back. */
export const serialize = (state) => JSON.stringify(state);
export const deserialize = (json) => JSON.parse(json);

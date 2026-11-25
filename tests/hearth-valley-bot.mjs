// A bot that plays Hearth Valley through the pure rules (used by tests/hearth-valley.test.mjs).
// It farms, keeps animals, fishes, forages, mines, crafts and fills the community board, paying
// game time for walking and work the way a player would.
const G = await import('../games/hearth-valley/logic/game.js');
const D = await import('../games/hearth-valley/logic/data.js');
const F = await import('../games/hearth-valley/logic/fishing.js');
const M = await import('../games/hearth-valley/logic/maps.js');

export { G, D, F, M };

const FIELD = { x: 3, y: 9, w: 18, h: 9 };
const MAP_COST = { farm: 0, town: 12, woods: 10, mine: 20 };

/** Walk somewhere: costs game time for the distance (about a third of a minute per tile). */
function walk(s, map, x, y) {
  const hop = map !== s.map ? MAP_COST[map] + MAP_COST[s.map] : 0;
  const d = map === s.map ? Math.abs(s.x - x) + Math.abs(s.y - y) : 20;
  G.passTime(s, Math.round(d * 0.35 + hop));
  s.map = map; s.x = x; s.y = y;
}
const work = (s, mins = 1) => G.passTime(s, mins);
const late = (s, t) => s.time >= t;

function needs(s) {
  // what's still missing on the board: { id: n }
  const out = {};
  for (const b of D.BUNDLES) {
    if (s.bundlesDone.includes(b.id)) continue;
    const got = s.bundles[b.id] || {};
    for (const [id, n] of Object.entries(b.needs)) if ((got[id] || 0) < n) out[id] = (out[id] || 0) + n - (got[id] || 0);
  }
  return out;
}

function giveBundles(s) {
  for (const b of D.BUNDLES) {
    if (s.bundlesDone.includes(b.id)) continue;
    for (const id of Object.keys(b.needs)) {
      if (id === 'gold' && s.gold < 2500 + 300) continue;
      G.contribute(s, b.id, id);
    }
  }
}

function shipExtras(s) {
  const need = needs(s);
  const keep = { hay: 999, wood: 200, stone: 200, fiber: 50, slime: 20, copperore: 30, ironore: 30, goldore: 30, copperbar: 10, ironbar: 10, goldbar: 4, bait: 999, egg: 2, milk: 2, hazelnut: 4, salmonberry: 4 };
  for (const id of Object.keys(s.inv)) {
    if (!G.sellable(id)) continue;
    const reserve = (need[id] || 0) + (keep[id] || 0) + (D.CROPS[id] ? 1 : 0);
    const n = s.inv[id] - reserve;
    if (n > 0) G.ship(s, id, n);
  }
}

function clearDebris(s, x, y) {
  const o = G.objAt(s, 'farm', x, y);
  if (!o) return true;
  const tool = { rock: 'pick', twig: 'axe', stump: 'axe', bush: 'axe', weed: 'sword', tall: 'sword' }[o.k];
  if (!tool) return o.k === 'forage' ? (G.forage(s, x, y), true) : false;
  for (let i = 0; i < 8 && G.objAt(s, 'farm', x, y); i++) {
    if (s.energy < 6) return false;
    G.useTool(s, tool, x, y); work(s, 1);
  }
  return !G.objAt(s, 'farm', x, y);
}

function fieldTiles() {
  const out = [];
  for (let y = FIELD.y; y < FIELD.y + FIELD.h; y++) for (let x = FIELD.x; x < FIELD.x + FIELD.w; x++) {
    // leave walkways every third column for sprinklers and paths
    out.push([x, y]);
  }
  return out;
}

/** Which seeds to plant today, best value first, always keeping the bundle crops in. */
function plantPlan(s) {
  const season = s.season;
  const plan = [];
  const need = needs(s);
  const daysLeft = D.SEASON_DAYS - s.day + 1;
  for (const [id, c] of Object.entries(D.CROPS)) {
    if (!c.seasons.includes(season)) continue;
    const lastSeason = Math.max(...c.seasons);
    const left = daysLeft + (lastSeason > season ? D.SEASON_DAYS * (lastSeason - season) : 0);
    if (c.days > left - 1) continue;
    plan.push({ id, prio: (need[id] ? 1000 : 0) + D.ITEMS[id].price / c.days });
  }
  return plan.sort((a, b) => b.prio - a.prio);
}

function farmDay(s, log) {
  // harvest
  for (const [k, so] of Object.entries(s.soil)) {
    const [x, y] = k.split(',').map(Number);
    if (so.crop?.dead) so.crop = null;
    if (so.crop && G.cropStage(so.crop) === 'ready') { s.map = 'farm'; G.harvest(s, x, y); work(s, 0.5); }
  }
  // plant: keep up to `target` crops in the ground
  const target = Math.min(60, 14 + Math.floor(G.dayIndex(s) / 3));
  const plan = plantPlan(s);
  if (plan.length) {
    let growing = Object.values(s.soil).filter((so) => so.crop && !so.crop.dead).length;
    const need = needs(s);
    for (const { id } of plan) {
      const want = need[id] ? Math.max(3, need[id] + 2) : Math.ceil((target - growing) / 2);
      const have = Object.values(s.soil).filter((so) => so.crop?.id === id && !so.crop.dead).length;
      let n = Math.max(0, Math.min(want - have, target - growing));
      for (const [x, y] of fieldTiles()) {
        if (n <= 0 || s.energy < 12 || late(s, 17 * 60)) break;
        s.map = 'farm';
        if (G.soilAt(s, 'farm', x, y)?.crop) continue;
        if (!G.soilAt(s, 'farm', x, y)) {
          if (!clearDebris(s, x, y)) continue;
          if (!G.useTool(s, 'hoe', x, y).ok) continue;
          work(s, 1);
        }
        const seed = `seed_${id}`;
        if (!G.has(s, seed)) break;
        if (G.useItem(s, seed, x, y).ok) { n--; growing++; work(s, 0.5); }
      }
    }
  }
  // place sprinklers on the field
  for (const id of ['qsprinkler', 'sprinkler']) {
    while (G.has(s, id)) {
      const spot = fieldTiles().find(([x, y]) => (x - FIELD.x) % 3 === 1 && (y - FIELD.y) % 3 === 1 && !G.soilAt(s, 'farm', x, y)?.crop && !G.objAt(s, 'farm', x, y));
      if (!spot) break;
      delete s.soil[`${spot[0]},${spot[1]}`];
      if (!G.useItem(s, id, spot[0], spot[1]).ok) break;
    }
  }
  // water
  if (!['rain', 'storm'].includes(s.weather)) {
    for (const [k, so] of Object.entries(s.soil)) {
      if (!so.crop || so.crop.dead || so.wet) continue;
      if (s.energy < 4) break;
      if (s.water <= 0) { walk(s, 'farm', 16, 19); G.useTool(s, 'can', 16, 20); }
      const [x, y] = k.split(',').map(Number);
      s.map = 'farm';
      G.useTool(s, 'can', x, y); work(s, 0.5);
    }
  }
  void log;
}

function animalDay(s) {
  if (!s.animals.length) return;
  walk(s, 'farm', 6, 23);
  for (const a of s.animals) { G.petAnimal(s, a); G.petAnimal(s, a); work(s, 0.5); }
  for (const home of ['coop', 'barn']) {
    const want = s.animals.filter((a) => D.ANIMALS[a.kind].home === home).length;
    if (!want) continue;
    if ((s.inv.hay || 0) < want && G.shopOpen(s, 'ranch').open && s.gold > 300) G.buy(s, 'ranch', 'hay', want * 3);
    G.feedTrough(s, home);
  }
}

function machines(s) {
  for (const [k, o] of Object.entries(s.objs.farm)) {
    if (!D.MACHINES[o.k]) continue;
    const mi = G.machineInfo(s, k);
    if (mi.ready) G.useMachine(s, k);
    if (!G.machineInfo(s, k).busy) {
      if (o.k === 'mayojar' && (s.inv.egg || 0) <= (needs(s).egg || 0)) continue;
      if (o.k === 'press' && (s.inv.milk || 0) <= (needs(s).milk || 0) && G.has(s, 'cheese')) continue;
      G.useMachine(s, k);
    }
  }
}

function placeMachine(s, id) {
  if (!G.has(s, id)) return;
  for (let x = 14; x <= 21; x++) for (let y = 2; y <= 5; y++) {
    if (G.useItem(s, id, x, y).ok) return;
  }
}

function craftThings(s) {
  const want = { furnace: 2, mayojar: 1, press: 1 };
  for (const [id, n] of Object.entries(want)) {
    const placed = Object.values(s.objs.farm).filter((o) => o.k === id).length;
    if (placed < n && G.craft(s, id)) { s.map = 'farm'; placeMachine(s, id); }
  }
  if (s.recipes.includes('sprinkler') && (s.inv.copperbar || 0) > 3 && (s.inv.ironbar || 0) > 3) G.craft(s, 'sprinkler');
  if ((s.inv.fiber || 0) >= 6 && (s.inv.slime || 0) >= 1 && (s.inv.bait || 0) < 10) G.craft(s, 'bait');
  while ((s.inv.fiber || 0) >= 3 && (s.inv.wood || 0) >= 30 && (s.inv.compost || 0) < 6) G.craft(s, 'compost');
}

/** Buy the seeds today's plan wants (the market opens at 9). */
function buySeeds(s) {
  if (!G.shopOpen(s, 'market').open) return;
  const target = Math.min(60, 14 + Math.floor(G.dayIndex(s) / 3));
  let growing = Object.values(s.soil).filter((so) => so.crop && !so.crop.dead).length;
  const need = needs(s);
  for (const { id } of plantPlan(s)) {
    const want = need[id] ? Math.max(3, need[id] + 2) : Math.ceil((target - growing) / 2);
    const have = Object.values(s.soil).filter((so) => so.crop?.id === id && !so.crop.dead).length + (s.inv[`seed_${id}`] || 0);
    const n = Math.max(0, Math.min(want - have, target - growing));
    const buyN = Math.min(n, Math.floor((s.gold - 300) / D.CROPS[id].seed));
    if (buyN > 0) { G.buy(s, 'market', `seed_${id}`, buyN); growing += buyN; }
  }
}

function townDay(s) {
  walk(s, 'town', 12, 6);
  buySeeds(s);
  // buy animals once there's money to spare
  if (G.shopOpen(s, 'ranch').open) {
    if (G.animalCount(s, 'chicken') < 2 && s.gold > 1200) G.buyAnimal(s, 'chicken');
    if (G.animalCount(s, 'cow') < 1 && s.gold > 2500 && G.dayIndex(s) > 10) G.buyAnimal(s, 'cow');
    if ((s.inv.hay || 0) < 12 && s.gold > 600) G.buy(s, 'ranch', 'hay', 10);
  }
  // upgrades
  if (G.shopOpen(s, 'forge').open) for (const t of ['can', 'hoe', 'pick']) if (s.gold > 1500) G.upgrade(s, t);
  // chat
  for (const v of G.villagersOn(s, 'town')) {
    G.talk(s, v.id);
    const gift = Object.keys(s.inv).find((id) => G.taste(v.id, id) === 'love' && !needs(s)[id]) || Object.keys(s.inv).find((id) => G.taste(v.id, id) === 'like' && !needs(s)[id] && !['ironbar', 'copperbar', 'egg', 'milk'].includes(id));
    if (gift && G.canGift(s, v.id)) G.giveGift(s, v.id, gift);
  }
  giveBundles(s);
}

function fishFor(s, rnd, wantIds) {
  const spots = { pond: ['farm', 16, 19, 16, 20], river: ['town', 8, 18, 8, 19], lake: ['woods', 13, 14, 13, 13] };
  let best = null;
  for (const [where, sp] of Object.entries(spots)) {
    const here = G.fishHere(s, where);
    const hit = wantIds.filter((id) => here.includes(id)).length;
    if (!best || hit > best.hit) best = { where, sp, hit };
  }
  if (!best.hit) return;
  const [map, x, y] = best.sp;
  walk(s, map, x, y);
  for (let i = 0; i < 10 && s.energy > 10 && !late(s, 23 * 60); i++) {
    G.useTool(s, 'rod', best.sp[3], best.sp[4]);
    work(s, 6);
    const id = G.rollFish(s, best.where, rnd);
    if (F.autoReel(id, s.tools.rod, 0.85, rnd)) G.caughtFish(s, id);
    work(s, 4);
  }
}

function forageWoods(s) {
  walk(s, 'woods', 10, 20);
  for (const [k, o] of Object.entries(s.objs.woods)) {
    if (o.k !== 'forage') continue;
    const [x, y] = k.split(',').map(Number);
    walk(s, 'woods', x, y);
    s.map = 'woods';
    G.forage(s, x, y);
  }
  // chop some trees for wood
  for (const [k, o] of Object.entries(s.objs.woods)) {
    if (s.energy < 30 || (s.inv.wood || 0) > 120) break;
    if (o.k !== 'bush' && o.k !== 'weed') continue;
    const [x, y] = k.split(',').map(Number);
    s.map = 'woods';
    for (let i = 0; i < 5 && G.objAt(s, 'woods', x, y); i++) { G.useTool(s, o.k === 'weed' ? 'sword' : 'axe', x, y); work(s, 1); }
  }
}

function mineTrip(s, rnd, goalFloor) {
  if (!G.mineUnlocked(s)) return;
  walk(s, 'woods', 10, 3);
  const start = Math.max(...G.checkpoints(s).filter((c) => c <= goalFloor));
  G.enterMine(s, start);
  while (s.mine && s.energy > 14 && !late(s, 22 * 60)) {
    const m = s.mine;
    // fight slimes (they hit back)
    for (const sl of [...m.slimes]) {
      while (sl.hp > 0 && s.mine) {
        G.hitSlime(s, sl, 'sword'); work(s, 1);
        if (sl.hp > 0 && rnd() < 0.5) G.hurt(s, G.slimeDamage(sl));
        if (s.hp < 20) {
          const food = Object.keys(s.inv).find((id) => D.ITEMS[id].energy && !needs(s)[id] && !D.CROPS[id]) || Object.keys(s.inv).find((id) => D.ITEMS[id].energy && !needs(s)[id]);
          if (food) G.eat(s, food);
        }
        if (s.hp <= 0) { G.knockedOut(s); return; }
      }
    }
    if (!s.mine) return;
    // break rocks until the ladder shows (ore first)
    const order = [...m.rocks].sort((a, b) => (b.kind !== 'stone') - (a.kind !== 'stone'));
    for (const r of order) {
      if (m.ladderOpen && r.kind === 'stone') continue;
      while (m.rocks.includes(r) && s.energy > 8) { G.mineRock(s, r.x, r.y); work(s, 1.5); }
      if (s.energy <= 8) break;
    }
    if (m.ladderOpen && m.floor < G.MINE_FLOORS && m.floor < goalFloor) { G.enterMine(s, m.floor + 1); continue; }
    break;
  }
  if (s.mine) G.leaveMine(s);
}

/**
 * Play days with a sensible routine until the given day index (or the hall is restored and
 * the year is over). Returns { s, log }.
 */
export function playYear(seed, { days = 112, skill = 0.85, log = false } = {}) {
  const s = G.newGame(seed);
  const rnd = G.seeded(seed ^ 0x5eed);
  const notes = [];
  while (G.dayIndex(s) < days) {
    while (G.readMail(s));
    giveBundles(s);
    machines(s);
    animalDay(s);
    farmDay(s, notes);
    craftThings(s);
    const need = needs(s);
    const f = G.festivalToday(s);
    // afternoon: festival, then town, then whatever the board needs most
    if (f && !s.fest[`${s.year}-${f.id}`]) {
      s.time = Math.max(s.time, 9 * 60);
      if (f.id === 'fair') { const best = Object.keys(s.inv).filter(G.sellable).sort((a, b) => D.ITEMS[b].price - D.ITEMS[a].price)[0]; if (best) G.fairJudge(s, best); }
      if (f.id === 'star') { const g = Object.keys(s.inv).find(G.giftable); if (g) G.starExchange(s, g); }
      G.markFestival(s, f, false);
    } else {
      if (s.time < 16 * 60) { s.time = Math.max(s.time, 9 * 60); townDay(s); walk(s, 'farm', 10, 10); farmDay(s, notes); }
      const fishNeed = ['perch', 'dace', 'bass', 'pike'].filter((id) => need[id]);
      const mineNeed = ['copperbar', 'ironbar', 'goldbar', 'jade'].some((id) => need[id]) || s.mineDeepest < 12 || (s.inv.copperbar || 0) + (s.inv.copperore || 0) / 5 < 6;
      const forageNeed = ['daffodil', 'sunbloom', 'hazelnut', 'holly'].some((id) => need[id] && D.FORAGE.woods[s.season].includes(id));
      if (forageNeed || (s.inv.wood || 0) < 60) forageWoods(s);
      const dayKind = G.dayIndex(s) % 3;
      if (mineNeed && dayKind !== 2 && G.mineUnlocked(s)) mineTrip(s, rnd, s.mineDeepest >= 12 ? 16 : s.mineDeepest + 4);
      else if (fishNeed.length) fishFor(s, rnd, fishNeed);
      else if (s.energy > 30) fishFor(s, rnd, D.FISH_ORDER);
      // smelting: start jobs, sell what isn't needed
      walk(s, 'farm', 9, 6);
      machines(s);
      craftThings(s);
      giveBundles(s);
      shipExtras(s);
    }
    if (log && G.dayIndex(s) % 14 === 0) notes.push(`${G.dateText(s)} gold ${s.gold} bundles ${s.bundlesDone.join(',')} floor ${s.mineDeepest}`);
    G.sleep(s);
  }
  return { s, notes };
}

/** A lazy player: only farms radishes and sleeps. Used to check the game never gets stuck. */
export function playLazy(seed, days = 40) {
  const s = G.newGame(seed);
  while (G.dayIndex(s) < days) {
    G.readMail(s);
    for (const [k, so] of Object.entries(s.soil)) {
      const [x, y] = k.split(',').map(Number);
      s.map = 'farm';
      if (so.crop && G.cropStage(so.crop) === 'ready') G.harvest(s, x, y);
    }
    s.map = 'farm';
    for (let x = 3; x < 8; x++) {
      if (!G.soilAt(s, 'farm', x, 10)) G.useTool(s, 'hoe', x, 10);
      if (!G.soilAt(s, 'farm', x, 10)?.crop && G.has(s, 'seed_radish')) G.useItem(s, 'seed_radish', x, 10);
      G.useTool(s, 'can', x, 10);
    }
    for (const id of Object.keys(s.inv)) if (G.sellable(id)) G.ship(s, id);
    G.passTime(s, 20 * 60);
    G.sleep(s, { passedOut: s.time >= D.DAY_END });
  }
  return s;
}

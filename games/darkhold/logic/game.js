// Darkhold rules: the run state, player actions, light, monsters and items. Pure logic (no
// Phaser), so it runs in node for the tests and the bot. The whole run is one JSON-safe object
// that is saved after every turn; derived things (light, field of view) are cached on the side.
import { makeRng, next, int, chance, pick, shuffle, hash } from './rng.js';
import { fov, los, line } from './fov.js';
import {
  W, H, PASSABLE, OPAQUE, generateFloor, makeItem, rollMonster, reachable,
} from './gen.js';
import {
  CLASSES, MONSTERS, MELEE, RANGED, ARMORS, RINGS, POTIONS, SCROLLS, SUPPLIES, PERKS, TRAPS,
  POTION_LOOKS, scrollLabel, XP_FOR, MAX_LEVEL, MAX_FUEL, MAX_FOOD, BAG_SIZE, BOSS_DEPTH, SHOP_DEPTHS,
} from './data.js';

export const VERSION = 1;
export { W, H, BOSS_DEPTH, SHOP_DEPTHS };

const DIRS4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const idx = (x, y) => y * W + x;
const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const roll = (st, [a, b]) => int(st.rng, a, b);
// 'the Giant Rat' / 'The Giant Rat', and the Hollow King keeps his own 'The'.
const the = (k) => (k.name.startsWith('The ') ? `the ${k.name.slice(4)}` : `the ${k.name}`);
const The = (k) => (k.name.startsWith('The ') ? k.name : `The ${k.name}`);

// ------------------------------------------------------------------ difficulty (adaptive)
// Only how alert and pushy monsters are. Loot, maps and monster stats never change.
export const TUNE = {
  easy: { wake: 0.55, notice: -2, persist: 7, hesitate: 0.28, fire: 0.45, alert: 0 },
  normal: { wake: 1, notice: 0, persist: 14, hesitate: 0.08, fire: 0.75, alert: 0.25 },
  hard: { wake: 1.5, notice: 2, persist: 24, hesitate: 0, fire: 0.95, alert: 0.6 },
};
export function tuneFor(s) {
  const out = {};
  for (const k of Object.keys(TUNE.normal)) {
    const a = TUNE.easy[k]; const b = TUNE.normal[k]; const c = TUNE.hard[k];
    out[k] = s <= 0.5 ? a + (b - a) * (s / 0.5) : b + (c - b) * ((s - 0.5) / 0.5);
  }
  return out;
}

// ------------------------------------------------------------------ new run

export function dailySeed(dateStr) { return hash(`daily:${dateStr}`); }

export function newRun({ cls = 'knight', mode = 'normal', seed, daily = null, skill = 0.35 } = {}) {
  const runSeed = (seed ?? (daily ? dailySeed(daily) : Math.floor(Math.random() * 2 ** 31))) >>> 0;
  const c = CLASSES[cls];
  const lookRng = makeRng(hash(`looks:${runSeed}`));
  const colours = shuffle(lookRng, POTION_LOOKS.map((_, i) => i));
  const potionLook = {};
  Object.keys(POTIONS).forEach((id, i) => { potionLook[id] = colours[i]; });
  const scrollLook = {};
  const usedLabels = new Set();
  for (const id of Object.keys(SCROLLS)) {
    let a; let b;
    do { a = int(lookRng, 0, 15); b = int(lookRng, 0, 15); } while (a === b || usedLabels.has(a) || usedLabels.has(b));
    usedLabels.add(a); usedLabels.add(b);
    scrollLook[id] = [a, b];
  }
  const st = {
    v: VERSION, seed: runSeed, mode, daily, cls, depth: 0, turn: 0, time: 0, floorTurns: 0,
    rng: makeRng(hash(`play:${runSeed}:${cls}`)),
    skill, tune: tuneFor(skill),
    looks: { potion: potionLook, scroll: scrollLook },
    known: { potion: {}, scroll: {} },
    p: {
      x: 0, y: 0, hp: c.hp, baseHp: c.hp, lvl: 1, xp: 0, gold: c.gold, fuel: MAX_FUEL, fuelAcc: 0,
      food: 900, foodAcc: 0, arrows: c.arrows, mana: c.mana || 0, regenAcc: 0, manaAcc: 0, str: 0,
      inv: [], eq: { melee: makeItem('melee', c.melee, { e: 0 }), ranged: c.ranged ? makeItem('ranged', c.ranged, { e: 0 }) : null, armor: c.armor ? makeItem('armor', c.armor, { e: 0 }) : null, ring: null },
      perks: {}, fx: {}, secondWind: false, pendingPerks: 0,
    },
    f: null, mons: [], nextId: 1,
    stats: { kills: 0, gold: 0, potions: 0, scrolls: 0, deepest: 1, traps: 0, secrets: 0 },
    log: [], levelUp: null, over: null, killedBy: null,
  };
  st.p.inv.push(makeItem('food', 'ration', { n: 1 }), makeItem('oil', 'oil', { n: 1 }));
  if (cls === 'knight') { st.p.inv.push(makeItem('potion', 'healing', { n: 1 })); st.known.potion.healing = true; }
  if (cls === 'mage') { for (const s of ['light', 'teleport', 'identify']) st.known.scroll[s] = true; }
  if (mode === 'lantern') {
    st.known.potion.healing = true;
    addToBag(st, makeItem('potion', 'healing', { n: 2 }));
  }
  st.p.hp = maxHp(st);
  enterFloor(st, 1);
  say(st, [], cls === 'mage' ? 'You light your witch-torch and step into the Darkhold.' : 'You light your torch and step into the Darkhold.', 'info');
  return st;
}

export function enterFloor(st, depth) {
  st.depth = depth;
  st.stats.deepest = Math.max(st.stats.deepest, depth);
  const f = generateFloor(st.seed, depth);
  f.seen = new Array(W * H).fill(0);
  st.mons = f.monsters.map((m) => spawn(st, m.kind, m.x, m.y, { asleep: m.asleep, disguised: m.disguised }));
  delete f.monsters;
  st.f = f;
  st.p.x = f.start.x; st.p.y = f.start.y;
  st.p.secondWind = false;
  st.floorTurns = 0;
  st.tune = tuneFor(st.skill);
  refresh(st);
}

// Monsters met deeper than they first appear are a bit tougher (more HP, harder hits).
export function veteran(kind, depth) {
  const m = MONSTERS[kind];
  return Math.max(0, Math.min(depth, 10) - m.depth[0]);
}

function spawn(st, kind, x, y, { asleep = false, disguised = false, hunt = false } = {}) {
  const m = MONSTERS[kind];
  const vet = veteran(kind, st.depth);
  const hp = Math.round(m.hp * (1 + 0.12 * vet));
  return {
    id: st.nextId++, kind, x, y, hp, maxHp: hp, vet,
    st: hunt ? 'hunt' : asleep ? 'sleep' : 'wander', tx: null, ty: null, lx: null, ly: null,
    chase: hunt ? 10 : 0, energy: 0, fx: {}, gold: 0, disguised, cd: 0,
  };
}

// ------------------------------------------------------------------ derived stats

export const perk = (st, id) => st.p.perks[id] || 0;
const ringIs = (st, id) => st.p.eq.ring?.id === id;

export function maxHp(st) {
  const p = st.p;
  const c = CLASSES[st.cls];
  return p.baseHp + (p.lvl - 1) * c.hpPerLvl + perk(st, 'tough') * 8 + (ringIs(st, 'vigor') ? 8 : 0) + (p.hpBonus || 0);
}

export function armorTotal(st) {
  const a = st.p.eq.armor;
  return (a ? ARMORS[a.id].armor + (a.e || 0) : 0) + perk(st, 'stalwart') + (ringIs(st, 'guard') ? 1 : 0);
}

export function meleeDmg(st) {
  const w = st.p.eq.melee;
  const base = w ? MELEE[w.id].dmg : [1, 2];
  const bonus = (w?.e || 0) + st.p.str + perk(st, 'brawler') + (ringIs(st, 'might') ? 2 : 0);
  return [base[0] + bonus, base[1] + bonus];
}

export function manaMax(st) { return st.cls === 'mage' ? 6 + Math.floor((st.p.lvl - 1) / 2) : 0; }

/** What the Fire button does right now: { kind, name, dmg, range } or null. */
export function rangedAttack(st) {
  const p = st.p;
  const bonus = perk(st, 'marksman') * 2;
  const rng = perk(st, 'marksman');
  if (p.eq.ranged && p.arrows > 0) {
    const r = RANGED[p.eq.ranged.id];
    const e = p.eq.ranged.e || 0;
    return { kind: 'arrow', name: r.name, dmg: [r.dmg[0] + e + bonus, r.dmg[1] + e + bonus], range: r.range + rng };
  }
  if (st.cls === 'mage' && p.mana >= 2) {
    const lv = Math.floor(p.lvl / 2);
    return { kind: 'fire', name: 'Firebolt', dmg: [3 + lv + bonus, 6 + lv + bonus], range: 6 + rng };
  }
  return null;
}

export function fireBlocked(st) {
  const p = st.p;
  if (st.cls === 'mage' && !(p.eq.ranged && p.arrows > 0)) return p.mana < 2 ? 'Not enough mana. It refills as you walk.' : null;
  if (p.eq.ranged && p.arrows <= 0) return 'You are out of arrows.';
  if (!p.eq.ranged) return 'You have no bow equipped.';
  return null;
}

export function torchRadius(st) {
  const p = st.p;
  const frac = p.fuel / MAX_FUEL;
  let r = frac > 0.75 ? 5 : frac > 0.5 ? 4 : frac > 0.25 ? 3 : p.fuel > 0 ? 2 : 1;
  if (ringIs(st, 'light')) r += 1;
  r += perk(st, 'nightsight');
  if (st.mode === 'lantern') r += 2;
  if (p.fx.blaze > 0) r += 2;
  return Math.min(r, 8);
}

function burnRate(st) {
  let r = 1;
  if (perk(st, 'frugal')) r *= 0.7;
  if (st.cls === 'mage') r *= 0.8;
  if (st.mode === 'lantern') r *= 0.6;
  return r;
}

export function hungerState(st) {
  const f = st.p.food;
  return f <= 0 ? 'Starving' : f < 150 ? 'Hungry' : null;
}

// ------------------------------------------------------------------ map helpers

export const tile = (st, x, y) => (inside(x, y) ? st.f.t[idx(x, y)] : '#');
export const monAt = (st, x, y) => st.mons.find((m) => m.x === x && m.y === y && m.hp > 0);
export const itemsAt = (st, x, y) => st.f.items.filter((it) => it.x === x && it.y === y);
export const trapAt = (st, x, y) => st.f.traps.find((t) => t.x === x && t.y === y);
export const brazierAt = (st, x, y) => st.f.braziers.find((b) => b.x === x && b.y === y);
const isShop = (st, x, y) => st.f.shop && st.f.shop.x === x && st.f.shop.y === y;
const opaqueFn = (st) => (x, y) => !inside(x, y) || OPAQUE.has(st.f.t[idx(x, y)]);

function walkable(st, x, y) {
  if (!inside(x, y)) return false;
  return PASSABLE.has(st.f.t[idx(x, y)]) && !isShop(st, x, y);
}

// ------------------------------------------------------------------ light and sight

const cache = new WeakMap();

/** Recompute light and sight, and remember what the player can see. */
export function refresh(st) {
  const f = st.f;
  const n = W * H;
  const light = new Float32Array(n);
  const bright = new Uint8Array(n);
  const inFov = new Uint8Array(n);
  const vis = new Uint8Array(n);
  const d2 = new Float32Array(n).fill(9999);
  const opaque = opaqueFn(st);
  const R = torchRadius(st);
  const px = st.p.x; const py = st.p.y;
  fov(W, H, opaque, px, py, 13, (x, y, dd) => {
    const i = idx(x, y);
    inFov[i] = 1; d2[i] = dd;
    const d = Math.sqrt(dd);
    if (d <= R + 0.5) {
      light[i] = Math.max(light[i], 1 - 0.75 * (d / (R + 1)) ** 2);
      if (d <= R - 1.5) bright[i] = 1;
    }
  });
  const ambient = new Float32Array(n);
  const glow = (ox, oy, rad, peak, isBright) => {
    fov(W, H, opaque, ox, oy, rad, (x, y, dd) => {
      const i = idx(x, y);
      const l = peak - 0.1 * Math.sqrt(dd);
      light[i] = Math.max(light[i], l);
      ambient[i] = Math.max(ambient[i], l);
      if (isBright) bright[i] = 1;
    });
  };
  for (const b of f.braziers) if (b.lit) glow(b.x, b.y, 4, 0.95, true);
  for (const m of st.mons) if (m.hp > 0 && MONSTERS[m.kind].tags.includes('glow')) glow(m.x, m.y, 2, 0.7, false);
  for (const i of f.lit) { light[i] = Math.max(light[i], 0.65); ambient[i] = Math.max(ambient[i], 0.65); bright[i] = 1; }
  for (let i = 0; i < n; i++) {
    if (inFov[i] && (light[i] > 0.04 || d2[i] <= 2)) {
      vis[i] = 1;
      f.seen[i] = 1;
    }
  }
  const v = { light, ambient, bright, inFov, vis, d2, R };
  cache.set(st, v);
  return v;
}

export function view(st) { return cache.get(st) || refresh(st); }

/** Can the player see this monster right now (light, closeness or Sight potion)? */
export function canSeeMon(st, m) {
  if (m.hp <= 0) return false;
  if (st.p.fx.sight > 0) return true;
  const v = view(st);
  const i = idx(m.x, m.y);
  return !!v.vis[i];
}

// ------------------------------------------------------------------ messages

function say(st, ev, text, c = 'info') {
  st.log.push({ text, c, turn: st.turn });
  if (st.log.length > 40) st.log.shift();
  ev.push({ t: 'msg', text, c });
}

// ------------------------------------------------------------------ items

export function itemName(st, it) {
  if (!it) return '';
  const e = it.e ? ` +${it.e}` : '';
  switch (it.k) {
    case 'melee': return MELEE[it.id].name + e;
    case 'ranged': return RANGED[it.id].name + e;
    case 'armor': return ARMORS[it.id].name + e;
    case 'ring': return RINGS[it.id].name;
    case 'potion': {
      const base = st.known.potion[it.id] ? POTIONS[it.id].name : `${POTION_LOOKS[st.looks.potion[it.id]][0]} Potion`;
      return it.n > 1 ? `${base} x${it.n}` : base;
    }
    case 'scroll': {
      const base = st.known.scroll[it.id] ? SCROLLS[it.id].name : `Scroll "${scrollLabel(...st.looks.scroll[it.id])}"`;
      return it.n > 1 ? `${base} x${it.n}` : base;
    }
    case 'arrows': return `${it.n} Arrows`;
    case 'gold': return `${it.n} Gold`;
    default: {
      const base = SUPPLIES[it.id].name;
      return it.n > 1 ? `${base} x${it.n}` : base;
    }
  }
}

export function itemText(st, it) {
  switch (it.k) {
    case 'melee': { const m = MELEE[it.id]; const e = it.e || 0; return `Melee weapon. Damage ${m.dmg[0] + e}-${m.dmg[1] + e}.${m.acc > 0 ? ' Accurate.' : m.acc < 0 ? ' Heavy (less accurate).' : ''}${m.sneak ? ' Great for sneak attacks.' : ''}`; }
    case 'ranged': { const r = RANGED[it.id]; const e = it.e || 0; return `Bow. Damage ${r.dmg[0] + e}-${r.dmg[1] + e}, range ${r.range}. Needs arrows.`; }
    case 'armor': return `Armour ${ARMORS[it.id].armor + (it.e || 0)}. Soaks up damage from every hit.`;
    case 'ring': return RINGS[it.id].text;
    case 'potion': return st.known.potion[it.id] ? POTIONS[it.id].text : 'An unknown potion. Drink it to find out what it does.';
    case 'scroll': return st.known.scroll[it.id] ? SCROLLS[it.id].text : 'An unknown scroll. Read it to find out what it does.';
    case 'arrows': return 'Ammunition for bows.';
    case 'gold': return 'Shiny.';
    default: return SUPPLIES[it.id].text;
  }
}

/** The icon frame for an item: { spr: [c, r], tint } */
export function itemIcon(st, it) {
  switch (it.k) {
    case 'melee': return { spr: MELEE[it.id].spr, tint: MELEE[it.id].tint };
    case 'ranged': return { spr: RANGED[it.id].spr, tint: RANGED[it.id].tint };
    case 'armor': return { spr: ARMORS[it.id].spr, tint: ARMORS[it.id].tint };
    case 'ring': return { spr: [0, 2], tint: RINGS[it.id].tint };
    case 'potion': return { spr: [7, 0], tint: POTION_LOOKS[st.looks.potion[it.id]][1] };
    case 'scroll': return { spr: [6, 2] };
    case 'arrows': return { spr: [8, 2] };
    case 'gold': return { spr: [5, 2] };
    default: return { spr: SUPPLIES[it.id].spr };
  }
}

export const isEquip = (it) => ['melee', 'ranged', 'armor', 'ring'].includes(it.k);
const stackable = (it) => ['potion', 'scroll', 'food', 'oil', 'torch'].includes(it.k);

export function itemValue(it) {
  switch (it.k) {
    case 'melee': return MELEE[it.id].price + (it.e || 0) * 30;
    case 'ranged': return RANGED[it.id].price + (it.e || 0) * 30;
    case 'armor': return ARMORS[it.id].price + (it.e || 0) * 30;
    case 'ring': return RINGS[it.id].price;
    case 'potion': return POTIONS[it.id].price;
    case 'scroll': return SCROLLS[it.id].price;
    case 'arrows': return Math.ceil(it.n * 1.5);
    case 'gold': return it.n;
    default: return SUPPLIES[it.id].price;
  }
}

/** Put an item in the bag (stacking where possible). Returns false if there is no room. */
export function addToBag(st, it) {
  const p = st.p;
  if (it.k === 'gold') { const n = Math.round(it.n * (perk(st, 'scavenger') ? 1.5 : 1)); p.gold += n; st.stats.gold += n; return true; }
  if (it.k === 'arrows') { p.arrows += it.n; return true; }
  if (stackable(it)) {
    const same = p.inv.find((o) => o.k === it.k && o.id === it.id);
    if (same) { same.n = (same.n || 1) + (it.n || 1); return true; }
  }
  if (p.inv.length >= BAG_SIZE) return false;
  p.inv.push({ ...it });
  return true;
}

function takeOne(st, i) {
  const it = st.p.inv[i];
  if ((it.n || 1) > 1) { it.n -= 1; return { ...it, n: 1 }; }
  st.p.inv.splice(i, 1);
  return it;
}

function pickUpHere(st, ev, { auto = true } = {}) {
  const here = itemsAt(st, st.p.x, st.p.y);
  let got = 0;
  for (const it of here) {
    if (auto && it.left) continue;
    if (addToBag(st, it.item)) {
      st.f.items.splice(st.f.items.indexOf(it), 1);
      got++;
      say(st, ev, it.item.k === 'gold' ? `You pick up ${it.item.n} gold.` : `You pick up: ${itemName(st, it.item)}.`, 'good');
      ev.push({ t: 'pickup', x: st.p.x, y: st.p.y, k: it.item.k });
    } else {
      it.left = true;
      say(st, ev, `Your bag is full. ${itemName(st, it.item)} stays on the floor.`, 'bad');
    }
  }
  return got;
}

// ------------------------------------------------------------------ the turn

/**
 * Do one player action. Returns a list of events for the screen to animate.
 * action.type: move {dx,dy} | wait | search | descend | fire {target} | use {i} | drop {i}
 *   | unequip {slot} | pickup | perk {id} | buy {i} | sell {i}
 */
export function act(st, a) {
  const ev = [];
  if (st.over) return ev;
  if (st.levelUp && a.type !== 'perk') return ev;
  let cost = 0;
  switch (a.type) {
    case 'move': cost = doMove(st, a.dx, a.dy, ev); break;
    case 'wait': cost = 10; passiveSearch(st, ev, 2); break;
    case 'search': cost = 10; search(st, ev); break;
    case 'pickup': if (pickUpHere(st, ev, { auto: false })) cost = 10; break;
    case 'descend': return descend(st, ev);
    case 'fire': cost = fire(st, a.target, ev); break;
    case 'use': cost = useItem(st, a.i, ev); break;
    case 'drop': cost = dropItem(st, a.i, ev); break;
    case 'unequip': cost = unequip(st, a.slot, ev); break;
    case 'perk': choosePerk(st, a.id, ev); break;
    case 'buy': buy(st, a.i, ev); break;
    case 'sell': sell(st, a.i, ev); break;
    default: break;
  }
  if (cost > 0 && !st.over) endTurn(st, cost, ev);
  refresh(st);
  return ev;
}

function doMove(st, dx, dy, ev) {
  const p = st.p;
  const nx = p.x + dx; const ny = p.y + dy;
  if (!inside(nx, ny)) return 0;
  const m = monAt(st, nx, ny);
  if (m) { attackMon(st, m, ev); return 10; }
  if (isShop(st, nx, ny)) { ev.push({ t: 'shop' }); return 0; }
  const c = tile(st, nx, ny);
  if (c === '#' || c === 'S') {
    if (c === 'S' && chance(st.rng, 0.25 * searchSkill(st))) { revealSecret(st, nx, ny, ev); return 10; }
    ev.push({ t: 'bump', x: nx, y: ny });
    return 0;
  }
  if (c === 'B') return useBrazier(st, brazierAt(st, nx, ny), ev) ? 10 : 0;
  if (c === '+') { st.f.t[idx(nx, ny)] = "'"; ev.push({ t: 'door', x: nx, y: ny }); }
  const from = [p.x, p.y];
  p.x = nx; p.y = ny;
  ev.push({ t: 'move', id: 'p', x: nx, y: ny, from });
  stepOn(st, ev);
  return 10;
}

function stepOn(st, ev) {
  const p = st.p;
  const trap = trapAt(st, p.x, p.y);
  if (trap) {
    let p0 = trap.found ? 0.35 : 1;
    if (perk(st, 'lightfoot')) p0 *= 0.4;
    if (chance(st.rng, p0)) springTrap(st, trap, ev);
    else if (trap.found) say(st, ev, `You step carefully over the ${TRAPS[trap.type].name.toLowerCase()}.`);
  }
  if (st.over) return;
  pickUpHere(st, ev);
  if (tile(st, p.x, p.y) === '>') say(st, ev, st.depth >= BOSS_DEPTH - 1 ? 'Stairs down. A cold wind rises from below...' : 'Stairs down. Tap Descend when you are ready.', 'info');
  passiveSearch(st, ev, 1);
}

function searchSkill(st) {
  return (st.cls === 'rogue' ? 2 : 1) * (perk(st, 'lightfoot') ? 1.6 : 1);
}

function revealSecret(st, x, y, ev) {
  st.f.t[idx(x, y)] = '+';
  st.stats.secrets++;
  say(st, ev, 'You found a secret door!', 'good');
  ev.push({ t: 'secret', x, y });
}

function passiveSearch(st, ev, mult) {
  const p = st.p;
  const s = searchSkill(st) * mult;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = p.x + dx; const y = p.y + dy;
      if (tile(st, x, y) === 'S' && chance(st.rng, 0.05 * s)) revealSecret(st, x, y, ev);
    }
  }
  for (const t of st.f.traps) {
    if (t.found) continue;
    if (Math.abs(t.x - p.x) <= 1 && Math.abs(t.y - p.y) <= 1 && !(t.x === p.x && t.y === p.y) && chance(st.rng, 0.12 * s)) {
      t.found = true;
      say(st, ev, `You spot a ${TRAPS[t.type].name.toLowerCase()}.`, 'good');
      ev.push({ t: 'trapFound', x: t.x, y: t.y });
    }
  }
}

function search(st, ev) {
  const p = st.p;
  const s = searchSkill(st);
  let found = 0;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const x = p.x + dx; const y = p.y + dy;
      const near = Math.abs(dx) <= 1 && Math.abs(dy) <= 1;
      if (tile(st, x, y) === 'S' && chance(st.rng, (near ? 0.4 : 0.15) * s)) { revealSecret(st, x, y, ev); found++; }
    }
  }
  for (const t of st.f.traps) {
    if (t.found || Math.abs(t.x - p.x) > 2 || Math.abs(t.y - p.y) > 2) continue;
    if (chance(st.rng, 0.5 * s)) { t.found = true; found++; say(st, ev, `You find a ${TRAPS[t.type].name.toLowerCase()}.`, 'good'); ev.push({ t: 'trapFound', x: t.x, y: t.y }); }
  }
  if (!found) say(st, ev, 'You search the walls and floor around you...');
  ev.push({ t: 'search' });
}

function springTrap(st, trap, ev) {
  const p = st.p;
  trap.found = true;
  st.stats.traps++;
  say(st, ev, TRAPS[trap.type].text, 'bad');
  ev.push({ t: 'trap', x: trap.x, y: trap.y, type: trap.type });
  switch (trap.type) {
    case 'spike': hurtPlayer(st, int(st.rng, 2, 4) + Math.floor(st.depth / 2), 'a spike trap', ev); break;
    case 'alarm': alarm(st, 14); break;
    case 'smoke': p.fuel = Math.max(0, p.fuel - 80); break;
    case 'teleport': teleport(st, ev); break;
    case 'dart': p.fx.poison = Math.max(p.fx.poison || 0, 5); hurtPlayer(st, 1, 'a poison dart', ev); break;
    default: break;
  }
}

function alarm(st, radius) {
  for (const m of st.mons) {
    if (m.hp <= 0 || m.disguised || MONSTERS[m.kind].tags.includes('watcher')) continue;
    if (Math.abs(m.x - st.p.x) + Math.abs(m.y - st.p.y) <= radius) {
      m.st = 'hunt'; m.lx = st.p.x; m.ly = st.p.y; m.chase = 20;
    }
  }
}

function teleport(st, ev) {
  const p = st.p;
  const cells = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (tile(st, x, y) !== '.' || monAt(st, x, y) || trapAt(st, x, y) || isShop(st, x, y)) continue;
      if (Math.abs(x - p.x) + Math.abs(y - p.y) < 8) continue;
      cells.push([x, y]);
    }
  }
  // Only land somewhere the stairs can be reached from (never inside a sealed closet).
  const ok = reachable(st.f, st.f.start.x, st.f.start.y, { secrets: false });
  const good = cells.filter(([x, y]) => ok.has(idx(x, y)));
  if (!good.length) return;
  const [x, y] = pick(st.rng, good);
  const from = [p.x, p.y];
  p.x = x; p.y = y;
  ev.push({ t: 'teleport', x, y, from });
  pickUpHere(st, ev);
}

function useBrazier(st, b, ev) {
  const p = st.p;
  if (!b.lit) {
    b.lit = true;
    let gain = 0;
    if (!b.fed) { b.fed = true; gain = Math.min(120, MAX_FUEL - p.fuel); p.fuel += gain; }
    say(st, ev, gain > 0 ? 'You light the brazier and feed your torch from it.' : 'You light the brazier.', 'good');
    ev.push({ t: 'brazier', x: b.x, y: b.y });
    return true;
  }
  if (p.fuel < MAX_FUEL * 0.4) {
    p.fuel = Math.round(MAX_FUEL * 0.4);
    say(st, ev, 'You rekindle your torch at the brazier.', 'good');
    ev.push({ t: 'brazier', x: b.x, y: b.y });
    return true;
  }
  say(st, ev, 'The brazier burns warmly.');
  ev.push({ t: 'bump', x: b.x, y: b.y });
  return false;
}

function descend(st, ev) {
  const p = st.p;
  if (tile(st, p.x, p.y) !== '>') return ev;
  st.turn++;
  enterFloor(st, st.depth + 1);
  if (st.mode === 'lantern') p.hp = Math.min(maxHp(st), p.hp + Math.ceil(maxHp(st) * 0.25));
  p.fx.sight = 0;
  say(st, ev, st.depth >= BOSS_DEPTH ? 'You reach the bottom of the Darkhold. Something stirs in the great hall...' : `You descend to floor ${st.depth}.`, st.depth >= BOSS_DEPTH ? 'bad' : 'info');
  if (SHOP_DEPTHS.includes(st.depth)) say(st, ev, 'You hear a merchant humming somewhere on this floor.', 'good');
  ev.push({ t: 'floor', depth: st.depth });
  refresh(st);
  return ev;
}

// ------------------------------------------------------------------ fighting

function attackMon(st, m, ev) {
  const p = st.p;
  const k = MONSTERS[m.kind];
  if (m.disguised) {
    m.disguised = false; m.st = 'hunt'; m.chase = 20;
    say(st, ev, 'The chest grows teeth. It is a Mimic!', 'bad');
    ev.push({ t: 'reveal', id: m.id });
    return;
  }
  ev.push({ t: 'attack', id: 'p', x: m.x, y: m.y });
  const unaware = m.st !== 'hunt';
  const w = p.eq.melee ? MELEE[p.eq.melee.id] : null;
  const hitP = 0.82 + (w?.acc || 0) + (p.eq.melee?.e || 0) * 0.03 + perk(st, 'hunter') * 0.1 - k.dodge;
  if (!unaware && !chance(st.rng, hitP)) {
    say(st, ev, `You miss ${the(k)}.`);
    ev.push({ t: 'miss', x: m.x, y: m.y });
    wake(st, m);
    return;
  }
  let dmg = roll(st, meleeDmg(st));
  let crit = unaware;
  if (unaware) dmg *= st.cls === 'rogue' ? 3 : 2;
  else if (st.cls === 'rogue' && chance(st.rng, 0.2)) { dmg *= 2; crit = true; say(st, ev, 'You find a weak spot!', 'good'); }
  if (m.kind === 'king') dmg = kingDamage(st, m, dmg, ev);
  dmg = Math.max(1, dmg - int(st.rng, 0, k.armor));
  if (unaware) say(st, ev, `Sneak attack! You hit ${the(k)} for ${dmg}.`, 'good');
  damageMon(st, m, dmg, ev, crit);
}

// The Hollow King is only really hurt while he stands in brazier (or Dawn) light.
export function kingLit(st, m) {
  const i = idx(m.x, m.y);
  return st.f.braziers.some((b) => b.lit && (b.x - m.x) ** 2 + (b.y - m.y) ** 2 <= 16.25 && los(opaqueFn(st), b.x, b.y, m.x, m.y)) || st.f.lit.includes(i) || st.p.fx.blaze > 0;
}

function kingDamage(st, m, dmg, ev) {
  if (kingLit(st, m)) return Math.round(dmg * 1.5);
  if (ev && !st._kingHint) { st._kingHint = true; say(st, ev, 'Your blow barely hurts him in the dark. Light the braziers!', 'bad'); }
  return Math.max(1, Math.round(dmg * 0.4));
}

function wake(st, m) {
  if (m.disguised) return;
  if (MONSTERS[m.kind].tags.includes('watcher')) { m.st = 'hunt'; return; }
  m.st = 'hunt'; m.lx = st.p.x; m.ly = st.p.y; m.chase = Math.max(m.chase, Math.round(st.tune.persist));
}

function damageMon(st, m, dmg, ev, crit = false) {
  const k = MONSTERS[m.kind];
  m.hp -= dmg;
  ev.push({ t: 'dmg', target: m.id, x: m.x, y: m.y, n: dmg, crit });
  wake(st, m);
  if (m.hp <= 0) { killMon(st, m, ev); return; }
  if (k.tags.includes('split') && m.hp >= 2) {
    const spot = DIRS4.map(([dx, dy]) => [m.x + dx, m.y + dy]).find(([x, y]) => walkable(st, x, y) && !monAt(st, x, y) && !(x === st.p.x && y === st.p.y));
    if (spot) {
      const half = Math.floor(m.hp / 2);
      m.hp -= half;
      const c = spawn(st, m.kind, spot[0], spot[1], { hunt: true });
      c.hp = half; c.maxHp = Math.max(half, 1); c.small = true;
      m.maxHp = Math.max(m.hp, 1);
      st.mons.push(c);
      say(st, ev, `${The(k)} splits in two!`, 'bad');
      ev.push({ t: 'split', id: c.id, x: c.x, y: c.y, from: [m.x, m.y] });
    }
  }
}

function killMon(st, m, ev) {
  const k = MONSTERS[m.kind];
  const p = st.p;
  m.hp = 0;
  st.stats.kills++;
  ev.push({ t: 'die', id: m.id, x: m.x, y: m.y });
  say(st, ev, `${The(k)} dies.`, 'good');
  if (m.gold > 0) { st.f.items.push({ x: m.x, y: m.y, item: makeItem('gold', 'gold', { n: m.gold }) }); say(st, ev, 'It drops the gold it stole.', 'good'); }
  if (k.tags.includes('glow')) { const g = Math.min(60, MAX_FUEL - p.fuel); p.fuel += g; if (g > 0) say(st, ev, 'You catch its flame on your torch.', 'good'); }
  if (perk(st, 'vampire')) p.hp = Math.min(maxHp(st), p.hp + 2);
  gainXp(st, m.small ? 1 : k.xp, ev);
  st.mons = st.mons.filter((o) => o.hp > 0);
  if (m.kind === 'king') {
    st.over = 'won';
    say(st, ev, 'The Hollow King crumbles to dust. Dawn light pours into the Darkhold!', 'good');
    ev.push({ t: 'won' });
  }
}

function gainXp(st, n, ev) {
  const p = st.p;
  p.xp += n;
  while (p.lvl < MAX_LEVEL && p.xp >= XP_FOR[p.lvl + 1]) {
    p.lvl++;
    const c = CLASSES[st.cls];
    p.hp = Math.min(maxHp(st), p.hp + c.hpPerLvl + 2);
    p.pendingPerks++;
    say(st, ev, `You reach level ${p.lvl}!`, 'good');
    ev.push({ t: 'level', lvl: p.lvl });
  }
  if (p.pendingPerks > 0 && !st.levelUp) offerPerks(st);
}

function offerPerks(st) {
  const p = st.p;
  const pool = Object.keys(PERKS).filter((id) => perk(st, id) < PERKS[id].max
    && !(id === 'marksman' && !p.eq.ranged && st.cls !== 'mage'));
  shuffle(st.rng, pool);
  st.levelUp = { choices: pool.slice(0, 3) };
}

function choosePerk(st, id, ev) {
  if (!st.levelUp || !st.levelUp.choices.includes(id)) return;
  const p = st.p;
  const before = maxHp(st);
  p.perks[id] = perk(st, id) + 1;
  p.hp += Math.max(0, maxHp(st) - before);
  p.pendingPerks = Math.max(0, p.pendingPerks - 1);
  st.levelUp = null;
  say(st, ev, `New perk: ${PERKS[id].name}.`, 'good');
  if (p.pendingPerks > 0) offerPerks(st);
}

function hurtPlayer(st, dmg, cause, ev, { gentle = false } = {}) {
  const p = st.p;
  if (gentle) dmg = Math.min(dmg, p.hp - 1);
  if (dmg <= 0) return;
  p.hp -= dmg;
  ev.push({ t: 'dmg', target: 'p', x: p.x, y: p.y, n: dmg });
  if (p.hp > 0 && p.hp <= maxHp(st) * 0.25 && perk(st, 'secondwind') && !p.secondWind) {
    p.secondWind = true;
    p.hp = Math.min(maxHp(st), p.hp + Math.ceil(maxHp(st) * 0.4));
    say(st, ev, 'Second wind! You catch your breath.', 'good');
  }
  if (p.hp <= 0) {
    p.hp = 0;
    st.over = 'dead';
    st.killedBy = cause;
    say(st, ev, `You were slain by ${cause}.`, 'bad');
    ev.push({ t: 'dead' });
  }
}

function monHitsPlayer(st, m, ev, { ranged = false } = {}) {
  const p = st.p;
  const k = MONSTERS[m.kind];
  const dodge = perk(st, 'nimble') * 0.1;
  ev.push({ t: ranged ? 'shot' : 'attack', id: m.id, x: p.x, y: p.y, fx: m.x, fy: m.y, kind: 'arrow', hostile: true });
  if (!chance(st.rng, k.acc - dodge - (ranged ? 0.05 : 0))) {
    say(st, ev, `${The(k)} misses you.`);
    ev.push({ t: 'miss', x: p.x, y: p.y });
    return;
  }
  if (!ranged && st.cls === 'knight' && chance(st.rng, 0.15)) {
    say(st, ev, `You block ${the(k)} with your shield.`, 'good');
    ev.push({ t: 'block', x: p.x, y: p.y });
    return;
  }
  let dmg = roll(st, ranged ? k.shot : k.dmg) + Math.floor((m.vet || 0) / 2);
  if (m.kind === 'king' && m.hp < m.maxHp / 2) dmg += 2;
  dmg -= int(st.rng, 0, armorTotal(st));
  if (dmg <= 0) {
    say(st, ev, `Your armour turns ${the(k)}'s blow.`);
    ev.push({ t: 'block', x: p.x, y: p.y });
    return;
  }
  say(st, ev, `${The(k)} ${ranged ? 'shoots' : 'hits'} you for ${dmg}.`, 'bad');
  hurtPlayer(st, dmg, `a ${k.name}`.replace('a The', 'the').replace(/^a ([AEIOU])/, 'an $1'), ev);
  if (st.over) return;
  if (k.tags.includes('chill')) { p.fuel = Math.max(0, p.fuel - 25); say(st, ev, 'Its icy touch makes your torch gutter.', 'bad'); }
  if (k.tags.includes('poison') && chance(st.rng, 0.6)) { p.fx.poison = Math.max(p.fx.poison || 0, 4); say(st, ev, 'You are poisoned!', 'bad'); }
  if (k.tags.includes('thief') && p.gold > 0 && !m.gold) {
    const n = Math.min(p.gold, 10 + st.depth * 4);
    p.gold -= n; m.gold = n; m.st = 'flee';
    say(st, ev, `${The(k)} snatches ${n} gold and vanishes!`, 'bad');
    blinkAway(st, m, ev);
  }
}

function blinkAway(st, m, ev) {
  const cells = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (walkable(st, x, y) && !monAt(st, x, y) && Math.abs(x - st.p.x) + Math.abs(y - st.p.y) >= 10) cells.push([x, y]);
  }
  if (!cells.length) return;
  const [x, y] = pick(st.rng, cells);
  ev.push({ t: 'blink', id: m.id, x, y, from: [m.x, m.y] });
  m.x = x; m.y = y;
}

/** Visible monsters that the Fire button can hit right now (nearest first). */
export function targets(st) {
  const ra = rangedAttack(st);
  if (!ra) return [];
  const p = st.p;
  const opaque = opaqueFn(st);
  return st.mons.filter((m) => !m.disguised && canSeeMon(st, m) && view(st).inFov[idx(m.x, m.y)]
    && (m.x - p.x) ** 2 + (m.y - p.y) ** 2 <= (ra.range + 0.5) ** 2 && los(opaque, p.x, p.y, m.x, m.y))
    .sort((a, b) => ((a.x - p.x) ** 2 + (a.y - p.y) ** 2) - ((b.x - p.x) ** 2 + (b.y - p.y) ** 2));
}

function fire(st, targetId, ev) {
  const p = st.p;
  const ra = rangedAttack(st);
  if (!ra) { say(st, ev, fireBlocked(st) || 'You have nothing to shoot with.', 'bad'); return 0; }
  const ts = targets(st);
  let m = ts.find((t) => t.id === targetId) || (targetId == null ? ts[0] : null);
  if (!m) { say(st, ev, 'No target in range.', 'bad'); return 0; }
  // The shot stops at the first monster in the way.
  for (const [x, y] of line(p.x, p.y, m.x, m.y)) {
    const o = monAt(st, x, y);
    if (o && !o.disguised) { m = o; break; }
  }
  if (ra.kind === 'arrow') p.arrows--; else p.mana -= 2;
  ev.push({ t: 'shot', id: 'p', fx: p.x, fy: p.y, x: m.x, y: m.y, kind: ra.kind });
  const k = MONSTERS[m.kind];
  const unaware = m.st !== 'hunt';
  if (!unaware && !chance(st.rng, 0.85 + perk(st, 'hunter') * 0.1 - k.dodge)) {
    say(st, ev, `Your ${ra.kind === 'fire' ? 'firebolt' : 'arrow'} misses ${the(k)}.`);
    ev.push({ t: 'miss', x: m.x, y: m.y });
    wake(st, m);
    return 10;
  }
  let dmg = roll(st, ra.dmg);
  if (unaware) dmg *= st.cls === 'rogue' ? 2 : 1.5;
  dmg = Math.round(dmg);
  if (m.kind === 'king') dmg = kingDamage(st, m, dmg, ev);
  dmg = Math.max(1, dmg - int(st.rng, 0, ra.kind === 'fire' ? 0 : k.armor));
  say(st, ev, `Your ${ra.kind === 'fire' ? 'firebolt' : 'arrow'} hits ${the(k)} for ${dmg}.`, 'good');
  damageMon(st, m, dmg, ev, unaware);
  return 10;
}

// ------------------------------------------------------------------ using items

function useItem(st, i, ev) {
  const p = st.p;
  const it = p.inv[i];
  if (!it) return 0;
  if (isEquip(it)) return equip(st, i, ev);
  switch (it.k) {
    case 'potion': { takeOne(st, i); drink(st, it.id, ev); return 10; }
    case 'scroll': { takeOne(st, i); read(st, it.id, ev); return 10; }
    case 'food': {
      takeOne(st, i);
      p.food = Math.min(MAX_FOOD, p.food + SUPPLIES[it.id].food);
      say(st, ev, it.id === 'apple' ? 'Crunchy. You feel a little less hungry.' : 'You eat the ration. Delicious!', 'good');
      ev.push({ t: 'eat' });
      return 10;
    }
    case 'oil': case 'torch': {
      takeOne(st, i);
      p.fuel = Math.min(MAX_FUEL, p.fuel + SUPPLIES[it.id].fuel);
      say(st, ev, it.k === 'oil' ? 'You pour oil on your torch. It flares up.' : 'You light a fresh torch.', 'good');
      ev.push({ t: 'fuel' });
      return 10;
    }
    default: return 0;
  }
}

function equip(st, i, ev) {
  const p = st.p;
  const it = p.inv[i];
  const slot = it.k;
  const old = p.eq[slot];
  const hpBefore = maxHp(st);
  p.inv.splice(i, 1);
  p.eq[slot] = it;
  if (old) p.inv.splice(i, 0, old);
  if (slot === 'ring') {
    const diff = maxHp(st) - hpBefore;
    if (diff > 0) p.hp += diff;
    p.hp = Math.min(p.hp, maxHp(st));
  }
  say(st, ev, `You ${slot === 'armor' ? 'put on' : slot === 'ring' ? 'slip on' : 'wield'} the ${itemName(st, it)}.`, 'good');
  ev.push({ t: 'equip' });
  return 10;
}

function unequip(st, slot, ev) {
  const p = st.p;
  const it = p.eq[slot];
  if (!it) return 0;
  if (p.inv.length >= BAG_SIZE) { say(st, ev, 'Your bag is full.', 'bad'); return 0; }
  p.eq[slot] = null;
  p.inv.push(it);
  p.hp = Math.min(p.hp, maxHp(st));
  say(st, ev, `You take off the ${itemName(st, it)}.`);
  return 10;
}

function dropItem(st, i, ev) {
  const p = st.p;
  const it = p.inv[i];
  if (!it) return 0;
  p.inv.splice(i, 1);
  st.f.items.push({ x: p.x, y: p.y, item: it, left: true });
  say(st, ev, `You drop the ${itemName(st, it)}.`);
  return 10;
}

function identify(st, kind, id) {
  if (st.known[kind][id]) return false;
  st.known[kind][id] = true;
  return true;
}

function drink(st, id, ev) {
  const p = st.p;
  const wasKnown = st.known.potion[id];
  identify(st, 'potion', id);
  st.stats.potions++;
  ev.push({ t: 'drink', id });
  const name = POTIONS[id].name;
  if (!wasKnown) say(st, ev, `It was a ${name}!`, POTIONS[id].good ? 'good' : 'bad');
  switch (id) {
    case 'healing': {
      const n = Math.round(Math.max(10, maxHp(st) * 0.5) * (perk(st, 'alchemist') ? 1.5 : 1));
      p.hp = Math.min(maxHp(st), p.hp + n);
      p.fx.poison = 0;
      say(st, ev, 'Warmth spreads through you. Your wounds close.', 'good');
      break;
    }
    case 'restore': p.hpBonus = (p.hpBonus || 0) + 4; p.hp = maxHp(st); p.fx.poison = 0; say(st, ev, 'You feel fully restored, and hardier.', 'good'); break;
    case 'strength': p.str++; say(st, ev, 'Your arms bulge with new strength.', 'good'); break;
    case 'sight': p.fx.sight = 60; say(st, ev, 'You sense every creature on this floor.', 'good'); break;
    case 'flame': p.fuel = MAX_FUEL; p.fx.blaze = 40; say(st, ev, 'Your torch roars into a blazing flame!', 'good'); break;
    case 'haste': p.fx.haste = 15; say(st, ev, 'Everything around you slows down.', 'good'); break;
    case 'poison': p.fx.poison = Math.max(p.fx.poison || 0, 6); say(st, ev, 'You feel sick.', 'bad'); break;
    case 'shadow': p.fuel = Math.max(0, p.fuel - 150); say(st, ev, 'Darkness pours out of the bottle. Your torch dims!', 'bad'); break;
    default: break;
  }
}

function read(st, id, ev) {
  const p = st.p;
  const wasKnown = st.known.scroll[id];
  identify(st, 'scroll', id);
  st.stats.scrolls++;
  ev.push({ t: 'read', id });
  if (!wasKnown) say(st, ev, `It was a ${SCROLLS[id].name}!`, SCROLLS[id].good ? 'good' : 'bad');
  const f = st.f;
  switch (id) {
    case 'mapping': {
      for (let i = 0; i < W * H; i++) {
        if (f.t[i] === 'S') f.t[i] = '+';
        if (f.t[i] !== '#') f.seen[i] = 1;
      }
      for (const t of f.traps) t.found = true;
      say(st, ev, 'A map of the floor burns itself into your mind.', 'good');
      ev.push({ t: 'mapped' });
      break;
    }
    case 'teleport': teleport(st, ev); break;
    case 'identify': {
      const unknown = p.inv.filter((it) => (it.k === 'potion' || it.k === 'scroll') && !st.known[it.k][it.id]);
      if (unknown.length) {
        const it = pick(st.rng, unknown);
        identify(st, it.k, it.id);
        say(st, ev, `You now know: ${itemName(st, { ...it, n: 1 })}.`, 'good');
      } else {
        const rest = Object.keys(POTIONS).filter((k) => !st.known.potion[k]);
        if (rest.length) { const k = pick(st.rng, rest); identify(st, 'potion', k); say(st, ev, `You learn to recognise the ${POTIONS[k].name}.`, 'good'); } else say(st, ev, 'You already know everything it could teach.');
      }
      break;
    }
    case 'enchant': {
      const it = p.eq.melee || p.eq.armor;
      if (it) { it.e = (it.e || 0) + 1; say(st, ev, `Your ${itemName(st, { ...it, e: 0 })} glows. It is now +${it.e}.`, 'good'); } else say(st, ev, 'You feel a tingle, but nothing happens.');
      break;
    }
    case 'light': {
      const v = view(st);
      for (let i = 0; i < W * H; i++) if (v.inFov[i] && v.d2[i] <= 36 && !f.lit.includes(i)) f.lit.push(i);
      say(st, ev, 'A warm dawn light fills the area and stays.', 'good');
      ev.push({ t: 'dawn' });
      break;
    }
    case 'fear': {
      let n = 0;
      for (const m of st.mons) if (Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 8 && m.kind !== 'king') { m.fx.scared = 12; n++; }
      say(st, ev, n ? 'An awful wail rings out. Monsters flee from you!' : 'An awful wail rings out, but nothing is near.', 'good');
      break;
    }
    case 'summon': {
      let n = 0;
      for (const [dx, dy] of shuffle(st.rng, [...DIRS4])) {
        if (n >= 2) break;
        const x = p.x + dx; const y = p.y + dy;
        if (!walkable(st, x, y) || monAt(st, x, y)) continue;
        let kind = rollMonster(st.rng, Math.max(1, st.depth));
        if (['mimic', 'watcher'].includes(kind)) kind = 'skeleton';
        st.mons.push(spawn(st, kind, x, y, { hunt: true }));
        n++;
      }
      say(st, ev, n ? 'Monsters appear in a puff of smoke!' : 'Smoke swirls, but nothing appears.', 'bad');
      ev.push({ t: 'flash' });
      break;
    }
    case 'noise': alarm(st, 99); say(st, ev, 'BOOM! The whole floor heard that.', 'bad'); ev.push({ t: 'flash' }); break;
    default: break;
  }
}

// ------------------------------------------------------------------ the shop

export const shopPrice = (st, it) => Math.ceil(itemValue(it) * 1.0);
export const sellPrice = (st, it) => Math.max(1, Math.floor(itemValue(it) * (it.k === 'potion' && !st.known.potion[it.id] ? 0.2 : it.k === 'scroll' && !st.known.scroll[it.id] ? 0.2 : 0.4)));
export function shopNear(st) {
  const s = st.f.shop;
  return !!s && Math.abs(s.x - st.p.x) + Math.abs(s.y - st.p.y) === 1;
}

function buy(st, i, ev) {
  const s = st.f.shop;
  if (!s || !shopNear(st)) return;
  const row = s.stock[i];
  if (!row || row.sold) return;
  const price = shopPrice(st, row.item);
  if (st.p.gold < price) { say(st, ev, 'You cannot afford that.', 'bad'); return; }
  if (!addToBag(st, row.item)) { say(st, ev, 'Your bag is full.', 'bad'); return; }
  st.p.gold -= price;
  row.sold = true;
  if (row.item.k === 'potion' || row.item.k === 'scroll') identify(st, row.item.k, row.item.id);
  say(st, ev, `You buy the ${itemName(st, row.item)} for ${price} gold.`, 'good');
  ev.push({ t: 'buy' });
}

function sell(st, i, ev) {
  if (!shopNear(st)) return;
  const it = st.p.inv[i];
  if (!it) return;
  const one = takeOne(st, i);
  const price = sellPrice(st, one);
  st.p.gold += price;
  say(st, ev, `You sell the ${itemName(st, one)} for ${price} gold.`, 'good');
  ev.push({ t: 'sell' });
}

// ------------------------------------------------------------------ end of turn

function endTurn(st, cost, ev) {
  const p = st.p;
  const hasted = p.fx.haste > 0;
  const dt = (hasted ? cost / 2 : cost) / 10; // in turns
  st.time += dt * 10;
  st.turn++;
  st.floorTurns += dt;

  // Torch, hunger, healing, effects.
  p.fuelAcc += burnRate(st) * dt;
  while (p.fuelAcc >= 1) { p.fuelAcc -= 1; if (p.fuel > 0) { p.fuel--; if (p.fuel === 100) say(st, ev, 'Your torch is burning low. Find oil, a torch or a brazier.', 'bad'); if (p.fuel === 0) say(st, ev, 'Your torch sputters out! Only embers remain.', 'bad'); } }
  p.foodAcc += (st.mode === 'lantern' ? 0.5 : 1) * dt;
  while (p.foodAcc >= 1) {
    p.foodAcc -= 1;
    if (p.food > 0) { p.food--; if (p.food === 150) say(st, ev, 'You are getting hungry.', 'bad'); if (p.food === 0) say(st, ev, 'You are starving! Eat something soon.', 'bad'); }
  }
  const regenEvery = (st.mode === 'lantern' ? 6 : 14) / (ringIs(st, 'regen') ? 3 : 1);
  if (p.food > 0 && !(p.fx.poison > 0)) {
    p.regenAcc += dt / regenEvery;
    while (p.regenAcc >= 1) { p.regenAcc -= 1; if (p.hp < maxHp(st)) p.hp++; }
  } else if (p.food <= 0) {
    p.regenAcc += dt / 5;
    while (p.regenAcc >= 1 && !st.over) { p.regenAcc -= 1; hurtPlayer(st, 1, 'starvation', ev, { gentle: st.mode === 'lantern' }); }
  }
  if (st.cls === 'mage') {
    p.manaAcc += dt / 4;
    while (p.manaAcc >= 1) { p.manaAcc -= 1; p.mana = Math.min(manaMax(st), p.mana + 1); }
  }
  if (p.fx.poison > 0 && !st.over) {
    p.fx.poison -= dt;
    hurtPlayer(st, 1, 'poison', ev, { gentle: true });
    if (p.fx.poison <= 0) say(st, ev, 'The poison wears off.');
  }
  for (const k of ['haste', 'sight', 'blaze']) {
    if (p.fx[k] > 0) {
      p.fx[k] -= dt;
      if (p.fx[k] <= 0) { p.fx[k] = 0; say(st, ev, { haste: 'You slow down to normal speed.', sight: 'Your sense of monsters fades.', blaze: 'Your torch settles down.' }[k]); }
    }
  }
  if (st.over) return;

  // Monsters.
  refresh(st);
  const ctx = monsterContext(st);
  for (const m of [...st.mons]) {
    if (m.hp <= 0) continue;
    const k = MONSTERS[m.kind];
    const speed = k.tags.includes('fast') ? 20 : k.tags.includes('slow') ? 5 : 10;
    m.energy += speed * dt;
    for (const key of Object.keys(m.fx)) if (m.fx[key] > 0) m.fx[key] -= dt;
    while (m.energy >= 10 && m.hp > 0 && !st.over) {
      m.energy -= 10;
      monsterAct(st, m, ctx, ev);
    }
  }
  st.mons = st.mons.filter((m) => m.hp > 0);

  // Now and then something new wanders in from the dark.
  if (!st.f.boss && st.floorTurns > 220 && chance(st.rng, 0.006) && st.mons.length < 3 + st.depth) {
    const v = view(st);
    const cells = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (walkable(st, x, y) && !v.inFov[i] && !monAt(st, x, y) && Math.abs(x - p.x) + Math.abs(y - p.y) > 12) cells.push([x, y]);
    }
    const ok = reachable(st.f, p.x, p.y);
    const good = cells.filter(([x, y]) => ok.has(idx(x, y)));
    if (good.length) {
      let kind = rollMonster(st.rng, st.depth);
      if (['mimic', 'watcher'].includes(kind)) kind = 'rat';
      const [x, y] = pick(st.rng, good);
      st.mons.push(spawn(st, kind, x, y));
    }
  }
}

// Distance from the player over walkable ground (one map shared by every chasing monster).
function monsterContext(st) {
  const dist = new Int16Array(W * H).fill(-1);
  const q = [[st.p.x, st.p.y]];
  dist[idx(st.p.x, st.p.y)] = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const [x, y] = q[qi];
    const d = dist[idx(x, y)];
    if (d > 40) continue;
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx; const ny = y + dy;
      if (!walkable(st, nx, ny) || dist[idx(nx, ny)] >= 0) continue;
      dist[idx(nx, ny)] = d + 1;
      q.push([nx, ny]);
    }
  }
  return { dist, toTarget: new Map() };
}

function distFrom(st, ctx, tx, ty) {
  const key = idx(tx, ty);
  if (ctx.toTarget.has(key)) return ctx.toTarget.get(key);
  const dist = new Int16Array(W * H).fill(-1);
  const q = [[tx, ty]];
  dist[key] = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const [x, y] = q[qi];
    const d = dist[idx(x, y)];
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx; const ny = y + dy;
      if (!walkable(st, nx, ny) || dist[idx(nx, ny)] >= 0) continue;
      dist[idx(nx, ny)] = d + 1;
      q.push([nx, ny]);
    }
  }
  ctx.toTarget.set(key, dist);
  return dist;
}

function noticeRange(st) {
  return Math.max(2, torchRadius(st) + 3 + st.tune.notice - (ringIs(st, 'stealth') ? 2 : 0));
}

function monCanStand(st, m, x, y) {
  if (!inside(x, y)) return false;
  if (x === st.p.x && y === st.p.y) return false;
  if (monAt(st, x, y)) return false;
  if (MONSTERS[m.kind].tags.includes('phase')) return x > 0 && y > 0 && x < W - 1 && y < H - 1 && !isShop(st, x, y);
  return walkable(st, x, y);
}

function stepTo(st, m, x, y, ev) {
  const from = [m.x, m.y];
  if (tile(st, x, y) === '+') st.f.t[idx(x, y)] = "'";
  m.x = x; m.y = y;
  ev.push({ t: 'move', id: m.id, x, y, from });
}

function monsterAct(st, m, ctx, ev) {
  const k = MONSTERS[m.kind];
  const p = st.p;
  const tags = k.tags;
  const v = view(st);
  const i = idx(m.x, m.y);
  const dx = p.x - m.x; const dy = p.y - m.y;
  const manhattan = Math.abs(dx) + Math.abs(dy);
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (m.disguised) return;
  const sees = !!v.inFov[i] && dist <= noticeRange(st) + (tags.includes('watcher') ? 2 : 0);

  if (m.st === 'sleep') {
    if (dist > 8) return;
    let pw = 0.12 * st.tune.wake * (1 - dist / 9);
    if (sees) pw *= 2;
    if (ringIs(st, 'stealth')) pw *= 0.5;
    if (m.kind === 'king') pw = dist <= 6 || (sees && dist <= 8) ? 1 : 0;
    if (chance(st.rng, pw)) {
      m.st = sees ? 'hunt' : 'wander';
      if (sees) { m.lx = p.x; m.ly = p.y; m.chase = Math.round(st.tune.persist); }
      if (m.kind === 'king') { say(st, ev, 'The Hollow King rises from his throne!', 'bad'); ev.push({ t: 'flash' }); }
      else if (canSeeMon(st, m)) say(st, ev, `${The(k)} wakes up!`, 'bad');
    }
    return;
  }

  if (tags.includes('watcher')) {
    m.cd = Math.max(0, (m.cd || 0) - 1);
    if (manhattan === 1) { monHitsPlayer(st, m, ev); return; }
    if (sees && m.cd <= 0) {
      m.cd = 25;
      alarm(st, 12);
      say(st, ev, 'The Watcher shrieks! Monsters come running.', 'bad');
      ev.push({ t: 'shriek', id: m.id, x: m.x, y: m.y });
    }
    return;
  }

  if (sees && m.st !== 'flee') {
    if (m.st !== 'hunt' && chance(st.rng, st.tune.alert)) {
      for (const o of st.mons) if (o !== m && o.st === 'sleep' && Math.abs(o.x - m.x) + Math.abs(o.y - m.y) <= 5) o.st = 'wander';
    }
    m.st = 'hunt'; m.lx = p.x; m.ly = p.y; m.chase = Math.round(st.tune.persist);
  } else if (m.st === 'hunt') {
    m.chase--;
    if (m.chase <= 0) { m.st = 'wander'; m.tx = m.lx; m.ty = m.ly; }
  }

  // The Hollow King snuffs out the light every so often.
  if (m.kind === 'king') {
    m.cd = (m.cd || 0) + 1;
    const every = m.hp < m.maxHp / 2 ? 6 : 9;
    if (m.cd >= every) {
      m.cd = 0;
      let any = false;
      for (const b of st.f.braziers) if (b.lit) { b.lit = false; any = true; }
      p.fuel = Math.max(0, p.fuel - 40);
      say(st, ev, any ? 'The Hollow King howls. The braziers go dark!' : 'The Hollow King howls. Your torch shudders.', 'bad');
      ev.push({ t: 'snuff' });
      const shades = st.mons.filter((o) => o.kind === 'shade' && o.hp > 0).length;
      if (shades < 3) {
        const spot = DIRS4.map(([ax, ay]) => [m.x + ax, m.y + ay]).find(([x, y]) => walkable(st, x, y) && !monAt(st, x, y) && !(x === p.x && y === p.y));
        if (spot) st.mons.push(spawn(st, 'shade', spot[0], spot[1], { hunt: true }));
      }
      refresh(st);
      return;
    }
  }

  const bright = (x, y) => tags.includes('fearLight') && v.bright[idx(x, y)];
  const moves = shuffle(st.rng, DIRS4.map(([ax, ay]) => [m.x + ax, m.y + ay])).filter(([x, y]) => monCanStand(st, m, x, y));
  const away = (list) => list.sort((a, b) => ((b[0] - p.x) ** 2 + (b[1] - p.y) ** 2) - ((a[0] - p.x) ** 2 + (a[1] - p.y) ** 2));

  // Scared of light, a scroll, or running off with gold.
  if (bright(m.x, m.y) || m.fx.scared > 0 || m.st === 'flee') {
    const opts = away(moves.filter(([x, y]) => !bright(x, y) || bright(m.x, m.y)));
    const darker = opts.filter(([x, y]) => !bright(x, y));
    const go = darker[0] || opts[0];
    if (go && ((go[0] - p.x) ** 2 + (go[1] - p.y) ** 2 >= dist * dist)) stepTo(st, m, go[0], go[1], ev);
    else if (manhattan === 1 && m.st !== 'flee' && (!bright(m.x, m.y) || chance(st.rng, 0.5))) monHitsPlayer(st, m, ev); // cornered
    if (m.st === 'flee' && dist > 10) m.st = 'wander';
    return;
  }

  if (m.st === 'hunt') {
    if (tags.includes('erratic') && chance(st.rng, 0.35) && moves.length) { const [x, y] = moves[0]; stepTo(st, m, x, y, ev); return; }
    if (tags.includes('archer') && sees) {
      if (manhattan === 1) {
        const back = away(moves.filter(([x, y]) => !bright(x, y)))[0];
        if (back && chance(st.rng, 0.5)) { stepTo(st, m, back[0], back[1], ev); return; }
        monHitsPlayer(st, m, ev); return;
      }
      if (dist <= k.range + 0.5 && los(opaqueFn(st), m.x, m.y, p.x, p.y) && !line(m.x, m.y, p.x, p.y).slice(0, -1).some(([x, y]) => monAt(st, x, y))) {
        if (chance(st.rng, st.tune.fire)) { monHitsPlayer(st, m, ev, { ranged: true }); return; }
        return;
      }
    }
    if (manhattan === 1) { monHitsPlayer(st, m, ev); return; }
    if (chance(st.rng, st.tune.hesitate)) return;
    const tx = sees ? p.x : m.lx; const ty = sees ? p.y : m.ly;
    if (tx == null) { m.st = 'wander'; return; }
    approach(st, m, ctx, tx, ty, moves, bright, ev);
    if (!sees && m.x === m.lx && m.y === m.ly) m.chase = Math.min(m.chase, 2);
    return;
  }

  // Wandering.
  if (tags.includes('erratic') && chance(st.rng, 0.5) && moves.length) { const [x, y] = moves[0]; stepTo(st, m, x, y, ev); return; }
  if (m.tx == null || (m.x === m.tx && m.y === m.ty) || chance(st.rng, 0.02)) {
    const rm = pick(st.rng, st.f.rooms);
    m.tx = int(st.rng, rm.x, rm.x + rm.w - 1); m.ty = int(st.rng, rm.y, rm.y + rm.h - 1);
  }
  if (chance(st.rng, 0.25)) return; // amble
  approach(st, m, ctx, m.tx, m.ty, moves, bright, ev);
}

function approach(st, m, ctx, tx, ty, moves, bright, ev) {
  const phase = MONSTERS[m.kind].tags.includes('phase');
  const ok = moves.filter(([x, y]) => !bright(x, y));
  if (!ok.length) return;
  let best = null;
  if (phase) {
    best = ok.sort((a, b) => (Math.abs(a[0] - tx) + Math.abs(a[1] - ty)) - (Math.abs(b[0] - tx) + Math.abs(b[1] - ty)))[0];
    if (Math.abs(best[0] - tx) + Math.abs(best[1] - ty) >= Math.abs(m.x - tx) + Math.abs(m.y - ty)) best = null;
  } else {
    const dist = tx === st.p.x && ty === st.p.y ? ctx.dist : distFrom(st, ctx, tx, ty);
    const here = dist[idx(m.x, m.y)];
    let bd = here < 0 ? 9999 : here;
    for (const [x, y] of ok) {
      const d = dist[idx(x, y)];
      if (d >= 0 && d < bd) { bd = d; best = [x, y]; }
    }
  }
  if (best) stepTo(st, m, best[0], best[1], ev);
  else if (m.st === 'wander') { m.tx = null; }
}

// ------------------------------------------------------------------ helpers for the screen and bot

/** Shortest known path from the player to (tx, ty), avoiding known traps. Returns [[x,y],...] or null. */
export function pathTo(st, tx, ty, opts = {}) {
  return findPath(st, tx, ty, { ...opts, traps: false }) || findPath(st, tx, ty, { ...opts, traps: true });
}

function findPath(st, tx, ty, { allowMonsterAtEnd = true, ignoreMonsters = false, traps = false } = {}) {
  const f = st.f;
  if (!inside(tx, ty)) return null;
  const known = (x, y) => f.seen[idx(x, y)] && walkable(st, x, y);
  const target = idx(tx, ty);
  const prev = new Map([[idx(st.p.x, st.p.y), -1]]);
  const q = [[st.p.x, st.p.y]];
  for (let qi = 0; qi < q.length; qi++) {
    const [x, y] = q[qi];
    if (idx(x, y) === target) break;
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx; const ny = y + dy;
      const i = idx(nx, ny);
      if (!inside(nx, ny) || prev.has(i)) continue;
      const isTarget = i === target;
      if (!known(nx, ny) && !(isTarget && (brazierAt(st, nx, ny) || isShop(st, nx, ny)))) continue;
      const t = trapAt(st, nx, ny);
      if (t && t.found && !isTarget && !traps) continue;
      const mm = monAt(st, nx, ny);
      if (mm && !ignoreMonsters && canSeeMon(st, mm) && !(isTarget && allowMonsterAtEnd)) continue;
      prev.set(i, idx(x, y));
      if (!isTarget || known(nx, ny)) q.push([nx, ny]);
    }
  }
  if (!prev.has(target)) return null;
  const path = [];
  let c = target;
  while (c !== idx(st.p.x, st.p.y)) { path.unshift([c % W, Math.floor(c / W)]); c = prev.get(c); }
  return path;
}

/** Monsters the player can see right now. */
export function visibleMonsters(st) { return st.mons.filter((m) => canSeeMon(st, m)); }

/** Is any monster that is awake and aware of you in sight? (stops auto-walking) */
export function danger(st) {
  return visibleMonsters(st).some((m) => !m.disguised && m.st === 'hunt' && Math.abs(m.x - st.p.x) + Math.abs(m.y - st.p.y) <= 8);
}

export function score(st) {
  return st.stats.deepest * 100 + st.p.lvl * 25 + st.stats.kills * 5 + st.p.gold + (st.over === 'won' ? 2500 : 0);
}

export function xpProgress(st) {
  const p = st.p;
  if (p.lvl >= MAX_LEVEL) return 1;
  const a = XP_FOR[p.lvl]; const b = XP_FOR[p.lvl + 1];
  return (p.xp - a) / (b - a);
}

/** A JSON-safe copy of the run (for saving). */
export function serialize(st) { return JSON.parse(JSON.stringify(st)); }

export function monsterInfo(st, m) {
  const k = MONSTERS[m.kind];
  const state = m.disguised ? 'A chest' : m.st === 'sleep' ? 'Asleep' : m.st === 'hunt' ? 'Hunting you' : m.st === 'flee' ? 'Fleeing' : 'Wandering';
  return { name: m.disguised ? 'Chest' : k.name, hp: m.hp, maxHp: m.maxHp, dmg: k.dmg, state, desc: m.disguised ? 'A closed chest.' : k.desc };
}

export function nextLevelXp(st) { return st.p.lvl >= MAX_LEVEL ? null : XP_FOR[st.p.lvl + 1]; }

export { next as rngNext };

// The journey: state, walking, talking, chests, puzzles, shops, inns and battle rewards.
// Pure logic (no Phaser) so the tests and the bot can play the whole game.
import { MAPS, LANDMARKS, GATES, tileDef, charAt, chestsOf, stairsOf, leversOf, locksOf, torchesOf, signsOf, npcSpots, indexAt, cond, groundUnder } from './maps.js';
import { CLASSES, ITEMS, GEAR, KEY_ITEMS, SKILLS, AREAS, RARE, SHOPS, INN_PRICE, PARTY_ORDER, itemName } from './data.js';
import { newMember, statsOf, gainXp, canEquip, skillsAt } from './stats.js';
import { makeRng } from './rng.js';

export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export const ENC_RATES = { low: 0.5, normal: 1, high: 1.6 };
export const VERSION = 1;

export function newGame({ difficulty = 'normal', encRate = 'normal', seed = (Date.now() >>> 0) } = {}) {
  const party = [newMember('warrior'), newMember('cleric')];
  return {
    v: VERSION, map: 'bw', x: 4, y: 16, face: 'up',
    party, bag: { herb: 2 }, gear: {}, keys: {}, gold: 30,
    flags: {}, opened: {}, steps: 0, repel: 0, grace: 6,
    lastInn: { map: 'bw', x: 4, y: 16 },
    difficulty, encRate, seed, playMs: 0, battles: 0, wins: 0, steals: 0, wipes: 0, savedAt: 0,
  };
}

export const mapOf = (st) => MAPS[st.map];
export const rngOf = (st) => {
  const r = makeRng(st.seed);
  const wrap = (fn) => (...a) => { const v = fn(...a); st.seed = r.state(); return v; };
  const out = wrap(r);
  out.int = wrap(r.int); out.pick = wrap(r.pick); out.chance = wrap(r.chance); out.range = wrap(r.range); out.weighted = wrap(r.weighted);
  out.state = r.state;
  return out;
};

export const diffMult = (st) => (st.difficulty === 'story' ? 0.72 : 1);
export const avgLevel = (st) => st.party.reduce((s, m) => s + m.lv, 0) / st.party.length;

// ------------------------------------------------------------------ tiles

/** Effective tile info at x,y on the current map, with doors, barriers and gates resolved. */
export function tileInfo(st, x, y, map = mapOf(st)) {
  const ch = charAt(map, x, y);
  if (ch == null) return { ch: null, out: true, walk: map.kind === 'town' };
  const def = tileDef(map, ch);
  const info = { ch, def, walk: !!def.walk };
  if (map.kind === 'world') {
    const gate = GATES[ch];
    if (gate) { info.gate = gate; info.walk = !!st.flags[gate.flag]; info.openCh = info.walk ? gate.open : null; }
    return info;
  }
  if (def.lock) { const i = indexAt(locksOf(map), x, y); info.lock = i; info.walk = !!st.flags[map.locks[i].flag]; }
  if (def.bar) info.walk = barOpen(st, map, def.bar);
  if (def.npc) { const n = npcVisible(st, map, def.npc); info.npc = n ? def.npc : null; info.walk = !n; }
  return info;
}

export function barOpen(st, map, kind) {
  if (kind === 'R') return map.red ? cond(st, map.red) : !!st.flags[map.bar];
  return !st.flags[map.bar];
}

export function npcVisible(st, map, letter) {
  const n = map.npcs?.[letter];
  if (!n) return false;
  if (n.show && !cond(st, n.show)) return false;
  if (n.join && st.party.some((m) => m.cls === n.join)) return false;
  return true;
}

export function walkable(st, x, y) {
  const info = tileInfo(st, x, y);
  if (info.out) return info.walk;
  return info.walk;
}

/** People on the current map: [{ letter, x, y, def }]. */
export function npcsOn(st) {
  const map = mapOf(st);
  if (map.kind === 'world') return [];
  return Object.entries(npcSpots(map)).filter(([l]) => npcVisible(st, map, l)).map(([l, p]) => ({ letter: l, ...p, def: map.npcs[l], ground: groundUnder(map, p.x, p.y) }));
}

// ------------------------------------------------------------------ moving

function encounterArea(st, map) {
  if (map.kind === 'world') {
    const z = map.zones.find((r) => st.x >= r.x0 && st.x <= r.x1 && st.y >= r.y0 && st.y <= r.y1);
    return z ? { area: z.area, rate: map.rate } : null;
  }
  if (map.area) return { area: map.area, rate: map.rate };
  return null;
}

function moveTo(st, mapId, x, y, face = st.face) {
  st.map = mapId; st.x = x; st.y = y; st.face = face;
  st.grace = 4;
}

/** Take one step. Returns { moved, events: [...] }. */
export function step(st, dir, rng = rngOf(st)) {
  const [dx, dy] = DIRS[dir];
  st.face = dir;
  const map = mapOf(st);
  const nx = st.x + dx; const ny = st.y + dy;
  const info = tileInfo(st, nx, ny, map);
  const events = [];
  if (info.out) {
    if (map.kind !== 'town') return { moved: false, events };
    if (map.exitNeed && !cond(st, map.exitNeed.flag)) return { moved: false, events: [{ t: 'blocked', lines: map.exitNeed.lines }] };
    moveTo(st, 'world', map.world[0], map.world[1], dir);
    return { moved: true, events: [{ t: 'map', from: map.id }] };
  }
  if (!info.walk) {
    if (map.kind === 'world' && info.gate) return { moved: false, events: [{ t: 'gate', ch: info.ch }] };
    return { moved: false, events };
  }
  if (map.kind === 'world' && info.def.landmark) {
    const L = LANDMARKS[info.def.landmark];
    if (L.need && !cond(st, L.need)) return { moved: false, events: [{ t: 'blocked', lines: L.locked }] };
    st.x = nx; st.y = ny;
    const first = L.opened && !st.flags[L.opened.flag];
    if (first) st.flags[L.opened.flag] = true;
    moveTo(st, L.to, L.at[0], L.at[1], 'up');
    return { moved: true, events: [{ t: 'map', from: 'world', lines: first ? L.opened.lines : null }] };
  }
  st.x = nx; st.y = ny; st.steps++;
  if (st.repel > 0) st.repel--;
  if (info.def.exit) {
    moveTo(st, 'world', map.world[0], map.world[1], 'down');
    return { moved: true, events: [{ t: 'map', from: map.id }] };
  }
  if (info.def.stairs) {
    const i = indexAt(stairsOf(map), nx, ny);
    const s = map.stairs[i];
    moveTo(st, s.to, s.at[0], s.at[1], dir);
    return { moved: true, events: [{ t: 'map', from: map.id, stairs: true }] };
  }
  if (info.def.secret && !st.flags[`secret_${map.id}_${nx}_${ny}`]) {
    st.flags[`secret_${map.id}_${nx}_${ny}`] = true;
    events.push({ t: 'secret' });
  }
  const enc = encounterArea(st, map);
  if (enc) {
    if (st.grace > 0) st.grace--;
    else if (st.repel <= 0) {
      const p = enc.rate * (ENC_RATES[st.encRate] || 1) * (st.difficulty === 'story' ? 0.85 : 1);
      if (rng.chance(p)) events.push({ t: 'battle', enemies: encounterGroup(st, enc.area, rng), area: enc.area });
    }
  }
  return { moved: true, events };
}

/** The name shown in the header: the map, or the region of the world map you stand in. */
export function placeName(st) {
  const map = mapOf(st);
  if (map.kind !== 'world') return map.name;
  return map.zones.find((r) => st.x >= r.x0 && st.x <= r.x1 && st.y >= r.y0 && st.y <= r.y1)?.name || map.name;
}

/** Pick a group of monsters for an area. Groups grow when you out-level the area, shrink when behind. */
export function encounterGroup(st, area, rng = rngOf(st)) {
  const A = AREAS[area];
  const order = Object.keys(AREAS);
  if (order.indexOf(area) >= order.indexOf(RARE.minArea) && rng.chance(RARE.chance)) return [RARE.id];
  let n = rng.weighted(A.max >= 4 ? [[1, 2], [2, 3], [3, 3], [4, 2]] : [[1, 3], [2, 4], [3, 3]]);
  const gap = avgLevel(st) - A.lv;
  if (gap >= 3) n += 1;
  if (gap >= 6) n += 1;
  if (gap <= -2) n -= 1;
  if (st.difficulty === 'story') n = Math.min(3, n - 1);
  if (st.party.length <= 2) n = Math.min(n, 2); // a small party meets small groups
  n = Math.max(1, Math.min(5, n));
  const out = [];
  for (let i = 0; i < n; i++) out.push(rng.weighted(A.mons));
  return out;
}

/** The tile in front of the player. */
export function facing(st) {
  const [dx, dy] = DIRS[st.face];
  return { x: st.x + dx, y: st.y + dy };
}

export function dirTo(x0, y0, x1, y1) {
  if (x1 > x0) return 'right';
  if (x1 < x0) return 'left';
  if (y1 > y0) return 'down';
  return 'up';
}

/** Shortest path (list of [x,y], not including the start). adjacent: stop next to the target. */
export function findPath(st, tx, ty, { adjacent = false, limit = 4000 } = {}) {
  const map = mapOf(st);
  const W = map.tiles[0].length; const H = map.tiles.length;
  const key = (x, y) => y * W + x;
  const start = key(st.x, st.y);
  const prev = new Map([[start, -1]]);
  const q = [[st.x, st.y]];
  const goal = (x, y) => (adjacent ? Math.abs(x - tx) + Math.abs(y - ty) === 1 : x === tx && y === ty);
  if (goal(st.x, st.y)) return [];
  let n = 0;
  while (q.length && n++ < limit) {
    const [x, y] = q.shift();
    for (const [dx, dy] of Object.values(DIRS)) {
      const nx = x + dx; const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const k = key(nx, ny);
      if (prev.has(k)) continue;
      if (!walkable(st, nx, ny)) continue;
      // Don't route through stairs, exits or landmarks unless they are the goal.
      const d = tileDef(map, map.tiles[ny][nx]);
      const special = d.stairs || d.exit || d.landmark;
      prev.set(k, key(x, y));
      if (goal(nx, ny)) {
        const path = [];
        let c = k;
        while (c !== start) { path.unshift([c % W, Math.floor(c / W)]); c = prev.get(c); }
        return path;
      }
      if (!special) q.push([nx, ny]);
    }
  }
  return null;
}

// ------------------------------------------------------------------ interacting

function resolveTalk(st, talk) {
  if (!talk) return null;
  if (Array.isArray(talk) && typeof talk[0] === 'string') return { lines: talk };
  return talk.find((t) => !t.if || cond(st, t.if)) || null;
}

/** What happens when you use the tile at x,y (A button or tap). */
export function interact(st, x, y) {
  const map = mapOf(st);
  if (map.kind === 'world') return null;
  let info = tileInfo(st, x, y, map);
  if (info.out) return null;
  if (info.def.counter) {
    const nx = x + (x - st.x); const ny = y + (y - st.y);
    const beyond = tileInfo(st, nx, ny, map);
    if (beyond.npc) { info = beyond; x = nx; y = ny; } else return null;
  }
  if (info.npc) {
    const def = map.npcs[info.npc];
    const t = resolveTalk(st, def.talk);
    return { t: 'talk', npc: info.npc, at: { x, y }, def, lines: t?.lines || [], do: t?.do || null };
  }
  const d = info.def;
  if (d.chest) {
    const i = indexAt(chestsOf(map), x, y);
    if (st.opened[`${map.id}:${i}`]) return { t: 'msg', lines: ['The chest is empty.'] };
    return { t: 'chest', idx: i, content: map.chests[i] };
  }
  if (d.lever) {
    const i = indexAt(leversOf(map), x, y);
    const flag = map.levers[i];
    if (st.flags[flag]) return { t: 'msg', lines: ['The lever is already pulled.'] };
    return { t: 'lever', idx: i, flag };
  }
  if (d.lock && !info.walk) {
    const lk = map.locks[info.lock];
    const ok = lk.key ? !!st.keys[lk.key] : cond(st, lk.need);
    return ok ? { t: 'unlock', idx: info.lock, lines: lk.lines } : { t: 'msg', lines: lk.locked };
  }
  if (d.torch) return { t: 'torch', idx: indexAt(torchesOf(map), x, y) };
  if (d.crystal) return { t: 'crystal' };
  if (d.sign) return { t: 'msg', lines: map.signs[indexAt(signsOf(map), x, y)] || ['...'] };
  if (d.bell) {
    return { t: 'msg', lines: st.flags.vesper ? ['The Sun Bell shines, whole again.'] : ['The Sun Bell. Three empty hooks hang where its chimes should be.'] };
  }
  if (info.ch === 'R' || info.ch === 'U') return { t: 'msg', lines: ['A magic wall. A crystal switch must control it.'] };
  return null;
}

export function openChest(st, idx) {
  const map = mapOf(st);
  const c = map.chests[idx];
  const id = `${map.id}:${idx}`;
  if (st.opened[id]) return { text: 'The chest is empty.' };
  if (c.mimic) return { mimic: c.mimic, id };
  st.opened[id] = true;
  if (c.gold) { st.gold += c.gold; return { text: `Found ${c.gold} gold!`, gold: c.gold }; }
  if (c.item) { st.bag[c.item] = (st.bag[c.item] || 0) + (c.n || 1); return { text: c.n > 1 ? `Found ${c.n} ${itemName(c.item)}s!` : `Found a ${itemName(c.item)}!`, item: c.item }; }
  if (c.gear) { st.gear[c.gear] = (st.gear[c.gear] || 0) + 1; return { text: `Found the ${GEAR[c.gear].name}!`, gear: c.gear }; }
  if (c.key) { st.keys[c.key] = true; return { text: `Found the ${KEY_ITEMS[c.key].name}!`, key: c.key }; }
  return { text: 'The chest is empty.' };
}

export function markOpened(st, id) { st.opened[id] = true; }

export function pullLever(st, idx) {
  const map = mapOf(st);
  st.flags[map.levers[idx]] = true;
  const open = map.red && cond(st, map.red);
  return { text: open ? 'Clunk! Somewhere, a red wall sinks into the floor.' : 'Clunk! The lever moves. Something else must still be done.' };
}

export function unlock(st, idx) {
  const map = mapOf(st);
  st.flags[map.locks[idx].flag] = true;
}

/** Light or snuff a brazier and its neighbours (lights-out). Returns { lit: [bool], solved }. */
export function toggleTorch(st, idx) {
  const map = mapOf(st);
  const n = torchesOf(map).length;
  const k = (i) => `${map.torches}_t${i}`;
  if (st.flags[map.red]) return { lit: Array.from({ length: n }, () => true), solved: true, already: true };
  for (const i of [idx - 1, idx, idx + 1]) if (i >= 0 && i < n) st.flags[k(i)] = !st.flags[k(i)];
  const lit = Array.from({ length: n }, (_, i) => !!st.flags[k(i)]);
  const solved = lit.every(Boolean);
  if (solved) st.flags[map.red] = true;
  return { lit, solved };
}

export function torchLit(st, map, i) { return !!st.flags[map.red] || !!st.flags[`${map.torches}_t${i}`]; }

export function toggleCrystal(st) {
  const map = mapOf(st);
  st.flags[map.bar] = !st.flags[map.bar];
  return { on: st.flags[map.bar] };
}

// ------------------------------------------------------------------ story actions

export function join(st, cls) {
  if (st.party.some((m) => m.cls === cls)) return null;
  const lv = Math.max(1, Math.round(avgLevel(st)));
  const m = newMember(cls, lv);
  if (cls === 'mage') { m.eq.w = 'ashstaff'; m.eq.a = 'leather'; }
  if (cls === 'thief') { m.eq.w = 'kris'; m.eq.a = 'leather'; }
  const s = statsOf(m); m.hp = s.hp; m.mp = s.mp;
  st.party.push(m);
  st.party.sort((a, b) => PARTY_ORDER.indexOf(a.cls) - PARTY_ORDER.indexOf(b.cls));
  return m;
}

/** Run an NPC's 'do' action that needs no UI choice. Returns lines to show (or null). */
export function runDo(st, act) {
  const [kind, arg] = act.split(':');
  if (kind === 'quest') { st.flags.quest = true; st.gold += 100; st.bag.herb = (st.bag.herb || 0) + 3; return ['You received 100 gold and 3 Herbs!']; }
  if (kind === 'join') { const m = join(st, arg); return m ? [`${CLASSES[arg].name} the ${CLASSES[arg].title} joins the party!`] : null; }
  if (kind === 'heal') { restoreParty(st); st.lastInn = { map: st.map, x: st.x, y: st.y }; return ['Everyone is fully rested.']; }
  if (kind === 'barrier') { st.flags.barrier = true; st.bag.elixir = (st.bag.elixir || 0) + 1; return ['You received an Elixir!', 'The dark barrier on the frozen sea is gone!']; }
  return null;
}

export function restoreParty(st) {
  for (const m of st.party) { const s = statsOf(m); m.hp = s.hp; m.mp = s.mp; m.st = null; }
}

export function innPrice(id) { return INN_PRICE[id] || 10; }

export function rest(st, price) {
  if (st.gold < price) return false;
  st.gold -= price;
  restoreParty(st);
  st.lastInn = { map: st.map, x: st.x, y: st.y };
  return true;
}

// ------------------------------------------------------------------ battles

/** createBattle options that depend on the save: enemy strength and gold bonus by difficulty. */
export function battleOpts(st) {
  return { diff: diffMult(st), goldMult: st.difficulty === 'story' ? 1.25 : 1 };
}

export function bossSetup(id) {
  const phase2 = id === 'vesper' ? 'unbound' : null;
  return { enemies: [id], boss: true, phase2 };
}

/** Rewards after a won battle. Returns { xp, gold, ups: [{ name, lv, learned }], lines }. */
export function applyWin(st, res, { boss = null } = {}) {
  st.wins++;
  const ups = [];
  for (const m of st.party) {
    for (const u of gainXp(m, res.xp)) ups.push({ name: CLASSES[m.cls].name, ...u });
  }
  st.gold += res.gold;
  const lines = [];
  if (boss) {
    st.flags[boss] = true;
    const map = MAPS[st.map];
    const w = map.bossWin?.[boss];
    if (w?.give) {
      if (w.give.startsWith('gear:')) { const g = w.give.slice(5); st.gear[g] = (st.gear[g] || 0) + 1; } else st.keys[w.give] = true;
    }
    if (w?.lines) lines.push(...w.lines);
  }
  return { ups, lines };
}

/** The whole party fell: wake up at the last inn. Normal: lose half your gold. */
export function applyWipe(st) {
  st.wipes++;
  const lost = st.difficulty === 'story' ? 0 : Math.floor(st.gold / 2);
  st.gold -= lost;
  restoreParty(st);
  moveTo(st, st.lastInn.map, st.lastInn.x, st.lastInn.y, 'down');
  st.grace = 6;
  return { lost };
}

// ------------------------------------------------------------------ menus

export function useItemField(st, id, targetIdx) {
  const it = ITEMS[id];
  if (!it || !(st.bag[id] > 0)) return { ok: false, text: 'You have none.' };
  if (it.battleOnly) return { ok: false, text: 'Only in battle.' };
  const m = st.party[targetIdx];
  const s = m ? statsOf(m) : null;
  let text = '';
  if (it.use === 'repel') { st.repel = it.amount; text = 'A calm scent surrounds you. No battles for a while.'; }
  else if (it.use === 'warp') {
    const L = st.lastInn;
    moveTo(st, L.map, L.x, L.y, 'down');
    text = `You fly back to ${MAPS[L.map].name}!`;
  } else if (it.use === 'revive') {
    if (!m || m.hp > 0) return { ok: false, text: 'Only for a fallen hero.' };
    m.hp = Math.max(1, Math.round(s.hp * it.frac)); text = `${CLASSES[m.cls].name} is back on their feet!`;
  } else {
    if (!m || m.hp <= 0) return { ok: false, text: 'A fallen hero needs a Life Leaf or the inn.' };
    if (it.use === 'heal') { if (m.hp >= s.hp) return { ok: false, text: 'HP is already full.' }; const b = m.hp; m.hp = Math.min(s.hp, m.hp + it.amount); text = `${CLASSES[m.cls].name} recovers ${m.hp - b} HP.`; }
    if (it.use === 'mp') { if (m.mp >= s.mp) return { ok: false, text: 'MP is already full.' }; const b = m.mp; m.mp = Math.min(s.mp, m.mp + it.amount); text = `${CLASSES[m.cls].name} recovers ${m.mp - b} MP.`; }
    if (it.use === 'full') { m.hp = s.hp; m.mp = s.mp; text = `${CLASSES[m.cls].name} is fully restored!`; }
    if (it.use === 'cure') { if (!m.st || !it.cures.includes(m.st)) return { ok: false, text: 'Nothing to cure.' }; m.st = null; text = `${CLASSES[m.cls].name} feels better.`; }
  }
  st.bag[id]--;
  if (st.bag[id] <= 0) delete st.bag[id];
  return { ok: true, text };
}

/** Cast a healing spell outside battle. */
export function castField(st, casterIdx, skill, targetIdx) {
  const c = st.party[casterIdx];
  const sk = SKILLS[skill];
  if (!sk?.field || !skillsAt(c.cls, c.lv).includes(skill)) return { ok: false, text: 'Can\'t use that here.' };
  if (c.hp <= 0) return { ok: false, text: 'A fallen hero can\'t cast.' };
  if (c.mp < sk.mp) return { ok: false, text: 'Not enough MP.' };
  const cs = statsOf(c);
  const targets = sk.target === 'allies' ? st.party.filter((m) => m.hp > 0) : [st.party[targetIdx]].filter(Boolean);
  if (!targets.length) return { ok: false, text: 'No one to help.' };
  if (sk.kind === 'heal') {
    if (targets.every((m) => m.hp <= 0 || m.hp >= statsOf(m).hp)) return { ok: false, text: targets.some((m) => m.hp <= 0) ? 'A fallen hero needs Raise.' : 'HP is already full.' };
    c.mp -= sk.mp;
    for (const m of targets) { if (m.hp <= 0) continue; const s = statsOf(m); m.hp = Math.min(s.hp, m.hp + Math.round(sk.power + cs.mag * sk.scale)); }
    return { ok: true, text: sk.target === 'allies' ? 'The party is healed.' : `${CLASSES[targets[0].cls].name} is healed.` };
  }
  if (sk.kind === 'cure') {
    const m = targets[0];
    if (!m.st) return { ok: false, text: 'Nothing to cure.' };
    c.mp -= sk.mp; m.st = null; return { ok: true, text: `${CLASSES[m.cls].name} feels better.` };
  }
  if (sk.kind === 'revive') {
    const m = targets[0];
    if (m.hp > 0) return { ok: false, text: 'Only for a fallen hero.' };
    c.mp -= sk.mp; m.hp = Math.max(1, Math.round(statsOf(m).hp * sk.frac)); return { ok: true, text: `${CLASSES[m.cls].name} is back on their feet!` };
  }
  return { ok: false, text: 'Can\'t use that here.' };
}

export function equip(st, idx, id) {
  const m = st.party[idx];
  const g = GEAR[id];
  if (!g || !canEquip(m.cls, id) || !(st.gear[id] > 0)) return false;
  const old = m.eq[g.slot];
  st.gear[id]--;
  if (!st.gear[id]) delete st.gear[id];
  if (old) st.gear[old] = (st.gear[old] || 0) + 1;
  m.eq[g.slot] = id;
  clampHpMp(m);
  return true;
}

export function unequip(st, idx, slot) {
  const m = st.party[idx];
  const old = m.eq[slot];
  if (!old || slot !== 'c') return false; // weapons and armour are swapped, never removed
  st.gear[old] = (st.gear[old] || 0) + 1;
  m.eq[slot] = null;
  clampHpMp(m);
  return true;
}

function clampHpMp(m) {
  const s = statsOf(m);
  m.hp = Math.min(m.hp, s.hp); m.mp = Math.min(m.mp, s.mp);
}

/** Stat changes if member idx equipped gear id: { atk: +3, ... } */
export function gearDelta(st, idx, id) {
  const m = st.party[idx];
  const g = GEAR[id];
  const before = statsOf(m);
  const after = statsOf({ ...m, eq: { ...m.eq, [g.slot]: id } });
  const out = {};
  for (const k of ['atk', 'def', 'mag', 'spd', 'hp', 'mp']) if (after[k] !== before[k]) out[k] = after[k] - before[k];
  return out;
}

export function shopStock(id) { return SHOPS[id].items; }
export const priceOf = (id) => (ITEMS[id] || GEAR[id]).price;
export const sellPrice = (id) => Math.floor(priceOf(id) / 2);

export function buy(st, id, n = 1) {
  const cost = priceOf(id) * n;
  if (st.gold < cost) return false;
  st.gold -= cost;
  if (ITEMS[id]) st.bag[id] = (st.bag[id] || 0) + n; else st.gear[id] = (st.gear[id] || 0) + n;
  return true;
}

export function sell(st, id) {
  const store = ITEMS[id] ? st.bag : st.gear;
  if (!(store[id] > 0) || !priceOf(id)) return false;
  store[id]--;
  if (!store[id]) delete store[id];
  st.gold += sellPrice(id);
  return true;
}

/** The best gear a member could wear from what is owned (used by the bot and the 'Best' button). */
export function bestGear(st, idx) {
  const m = st.party[idx];
  const score = (id) => { const g = GEAR[id]; return (g.atk || 0) * (m.cls === 'mage' ? 0.3 : 1) + (g.def || 0) + (g.mag || 0) * (m.cls === 'mage' || m.cls === 'cleric' ? 1.4 : 0.1) + (g.spd || 0) * 0.5 + (g.mp || 0) * 0.2 + (g.ward ? 6 : 0) + (g.luck ? 4 : 0); };
  const out = {};
  for (const slot of ['w', 'a', 'c']) {
    let best = m.eq[slot]; let bs = best ? score(best) : -1;
    for (const id of Object.keys(st.gear)) {
      if (GEAR[id].slot !== slot || !canEquip(m.cls, id)) continue;
      if (score(id) > bs) { best = id; bs = score(id); }
    }
    if (best && best !== m.eq[slot]) out[slot] = best;
  }
  return out;
}

export function autoEquip(st) {
  for (let i = 0; i < st.party.length; i++) for (const id of Object.values(bestGear(st, i))) equip(st, i, id);
}

/** Current goal text for the menu (guides first-time players). */
export function goal(st) {
  const f = st.flags;
  if (!f.quest) return 'Talk to Elder Bram by the Sun Bell in the town square.';
  if (!f.stonehide) return st.party.some((m) => m.cls === 'thief') ? 'Find the Earth Chime deep in the Mole Cave.' : 'Explore the Mole Cave, north of Brightwater.';
  if (!st.party.some((m) => m.cls === 'mage')) return 'Cross the mended east bridge to Ferrow, the port town.';
  if (!f.galewing) return 'Climb the Wind Tower, east of Ferrow, for the Sky Chime.';
  if (!f.pyrescorp) return 'Head north through the pass to Emberfall, then the Ember Cave.';
  if (!f.barrier) return 'Take the three Chimes to Sage Elra in Frosthollow, west of the desert.';
  if (!f.vesper) return 'Cross the frozen sea north of Frosthollow and storm Nightspire.';
  return 'The sun shines again. Thank you for playing!';
}

export const chimesHeld = (st) => ['chime1', 'chime2', 'chime3'].filter((k) => st.keys[k]).length;

/** Count of all chests and how many are open (for the treasure trophy). */
export function chestCounts(st) {
  let total = 0; let open = 0;
  for (const m of Object.values(MAPS)) {
    if (m.kind === 'world') continue;
    chestsOf(m).forEach((_, i) => { total++; if (st.opened[`${m.id}:${i}`]) open++; });
  }
  return { total, open };
}

export { MAPS };

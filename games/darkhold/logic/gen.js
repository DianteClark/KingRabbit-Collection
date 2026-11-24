// Floor generation: rooms and corridors, doors, secret doors and closets, traps, braziers, loot,
// monsters and (on some floors) a shop. A floor depends only on the run seed and its depth, so a
// daily run gives everyone the same dungeon. Nothing here depends on the difficulty setting.
import { makeRng, int, chance, pick, shuffle, weighted, hash } from './rng.js';
import {
  MONSTERS, MELEE, RANGED, ARMORS, RINGS, POTIONS, SCROLLS, BOSS_DEPTH, SHOP_DEPTHS,
} from './data.js';

export const W = 32;
export const H = 32;

// Tile chars: '#' rock, '.' floor, '+' closed door, "'" open door, 'S' hidden secret door,
// '>' stairs down, 'B' brazier (blocks walking, not sight).
export const PASSABLE = new Set(['.', '+', "'", '>']);
export const OPAQUE = new Set(['#', '+', 'S']);

const idx = (x, y) => y * W + x;
const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const DIRS4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export function floorSeed(runSeed, depth) { return hash(`darkhold:${runSeed}:${depth}`); }

/** Every cell reachable from (sx, sy). secrets: treat hidden secret doors as passable. */
export function reachable(f, sx, sy, { secrets = false, blockers = true } = {}) {
  const blocked = new Set();
  if (blockers && f.shop) blocked.add(idx(f.shop.x, f.shop.y));
  const seen = new Set([idx(sx, sy)]);
  const q = [[sx, sy]];
  for (let qi = 0; qi < q.length; qi++) {
    const [x, y] = q[qi];
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx; const ny = y + dy;
      if (!inside(nx, ny)) continue;
      const i = idx(nx, ny);
      if (seen.has(i) || blocked.has(i)) continue;
      const c = f.t[i];
      if (!(PASSABLE.has(c) || (secrets && c === 'S'))) continue;
      seen.add(i);
      q.push([nx, ny]);
    }
  }
  return seen;
}

function bfsDist(f, sx, sy) {
  const dist = new Map([[idx(sx, sy), 0]]);
  const q = [[sx, sy]];
  for (let qi = 0; qi < q.length; qi++) {
    const [x, y] = q[qi];
    const d = dist.get(idx(x, y));
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx; const ny = y + dy;
      if (!inside(nx, ny)) continue;
      const i = idx(nx, ny);
      if (dist.has(i) || !PASSABLE.has(f.t[i])) continue;
      dist.set(i, d + 1);
      q.push([nx, ny]);
    }
  }
  return dist;
}

// ------------------------------------------------------------------ items

export function makeItem(k, id, extra = {}) { return { k, id, ...extra }; }

function byDepth(table, depth) {
  return Object.entries(table).filter(([, d]) => d.depth <= depth + 1).map(([id, d]) => [id, 1 + Math.max(0, 3 - Math.abs(depth - d.depth - 1))]);
}

/** A random item suited to a depth (never gold). */
export function rollItem(r, depth) {
  const kind = weighted(r, [
    ['potion', 26], ['scroll', 20], ['food', 9], ['oil', 13], ['torch', 3], ['arrows', 6],
    ['melee', 7], ['ranged', 3], ['armor', 6], ['ring', 3 + (depth > 4 ? 2 : 0)],
  ]);
  switch (kind) {
    case 'potion': return makeItem('potion', weighted(r, [['healing', 30], ['restore', 6], ['strength', 7], ['sight', 9], ['flame', 12], ['haste', 8], ['poison', 9], ['shadow', 7]]), { n: 1 });
    case 'scroll': return makeItem('scroll', weighted(r, [['mapping', 14], ['teleport', 11], ['identify', 12], ['enchant', 10], ['light', 11], ['fear', 9], ['summon', 6], ['noise', 6]]), { n: 1 });
    case 'food': return makeItem('food', chance(r, 0.6) ? 'ration' : 'apple', { n: 1 });
    case 'oil': return makeItem('oil', 'oil', { n: 1 });
    case 'torch': return makeItem('torch', 'torch', { n: 1 });
    case 'arrows': return makeItem('arrows', 'arrows', { n: int(r, 6, 12) });
    case 'melee': return makeItem('melee', weighted(r, byDepth(MELEE, depth).filter(([id]) => id !== 'staff')), { e: enchantRoll(r, depth) });
    case 'ranged': return makeItem('ranged', weighted(r, byDepth(RANGED, depth)), { e: enchantRoll(r, depth) });
    case 'armor': return makeItem('armor', weighted(r, byDepth(ARMORS, depth)), { e: enchantRoll(r, depth) });
    default: return makeItem('ring', pick(r, Object.keys(RINGS)));
  }
}

function enchantRoll(r, depth) {
  if (chance(r, 0.12 + depth * 0.03)) return depth >= 6 && chance(r, 0.4) ? 2 : 1;
  return 0;
}

function shopStock(r, depth) {
  const stock = [
    makeItem('potion', 'healing', { n: 1 }), makeItem('potion', 'healing', { n: 1 }),
    makeItem('oil', 'oil', { n: 1 }), makeItem('oil', 'oil', { n: 1 }), makeItem('torch', 'torch', { n: 1 }),
    makeItem('food', 'ration', { n: 1 }), makeItem('arrows', 'arrows', { n: 12 }),
    makeItem('scroll', pick(r, ['mapping', 'enchant', 'teleport']), { n: 1 }),
  ];
  const gear = Object.entries({ ...MELEE }).filter(([id, d]) => id !== 'staff' && d.depth >= depth - 2 && d.depth <= depth + 2);
  if (gear.length) stock.push(makeItem('melee', pick(r, gear)[0], { e: depth >= 6 ? 1 : 0 }));
  const arm = Object.entries(ARMORS).filter(([, d]) => d.depth >= depth - 2 && d.depth <= depth + 1);
  if (arm.length) stock.push(makeItem('armor', pick(r, arm)[0], { e: 0 }));
  stock.push(makeItem('ring', pick(r, Object.keys(RINGS))));
  return stock;
}

// ------------------------------------------------------------------ monsters

export function rollMonster(r, depth) {
  const list = Object.entries(MONSTERS).filter(([, m]) => m.w > 0 && depth >= m.depth[0] && depth <= m.depth[1]);
  return weighted(r, list.map(([id, m]) => [id, m.w]));
}

// ------------------------------------------------------------------ floors

export function generateFloor(runSeed, depth) {
  const r = makeRng(floorSeed(runSeed, depth));
  if (depth >= BOSS_DEPTH) return bossFloor(r, depth);
  for (let attempt = 0; attempt < 60; attempt++) {
    const f = tryFloor(r, depth);
    if (f) return f;
  }
  throw new Error('could not generate floor');
}

function tryFloor(r, depth) {
  const t = new Array(W * H).fill('#');
  const roomOf = new Array(W * H).fill(-1);
  const rooms = [];
  const target = int(r, 7, 10);
  for (let tries = 0; tries < 300 && rooms.length < target; tries++) {
    const rw = int(r, 4, 8); const rh = int(r, 4, 6);
    const x = int(r, 1, W - rw - 1); const y = int(r, 1, H - rh - 1);
    if (rooms.some((o) => x < o.x + o.w + 2 && x + rw + 2 > o.x && y < o.y + o.h + 2 && y + rh + 2 > o.y)) continue;
    rooms.push({ x, y, w: rw, h: rh });
  }
  if (rooms.length < 6) return null;
  rooms.forEach((rm, k) => {
    for (let y = rm.y; y < rm.y + rm.h; y++) for (let x = rm.x; x < rm.x + rm.w; x++) { t[idx(x, y)] = '.'; roomOf[idx(x, y)] = k; }
  });
  const centre = (rm) => [rm.x + Math.floor(rm.w / 2), rm.y + Math.floor(rm.h / 2)];
  const carve = (a, b) => {
    let [x, y] = centre(a); const [tx, ty] = centre(b);
    const hFirst = chance(r, 0.5);
    const stepX = () => { while (x !== tx) { x += Math.sign(tx - x); t[idx(x, y)] = '.'; } };
    const stepY = () => { while (y !== ty) { y += Math.sign(ty - y); t[idx(x, y)] = '.'; } };
    if (hFirst) { stepX(); stepY(); } else { stepY(); stepX(); }
  };
  // Join rooms with a minimum spanning tree, then add a loop or two.
  const joined = [0];
  const dist = (a, b) => { const [ax, ay] = centre(a); const [bx, by] = centre(b); return Math.abs(ax - bx) + Math.abs(ay - by); };
  while (joined.length < rooms.length) {
    let best = null;
    for (const a of joined) {
      for (let b = 0; b < rooms.length; b++) {
        if (joined.includes(b)) continue;
        const d = dist(rooms[a], rooms[b]);
        if (!best || d < best.d) best = { a, b, d };
      }
    }
    carve(rooms[best.a], rooms[best.b]);
    joined.push(best.b);
  }
  const loops = int(r, 1, 2);
  for (let k = 0; k < loops; k++) {
    const a = int(r, 0, rooms.length - 1); const b = int(r, 0, rooms.length - 1);
    if (a !== b && dist(rooms[a], rooms[b]) < 20) carve(rooms[a], rooms[b]);
  }

  const f = { depth, w: W, h: H, t, rooms, braziers: [], traps: [], items: [], monsters: [], deco: [], shop: null, lit: [], boss: false };

  // Doors where a corridor meets a room through a gap in its wall.
  const doorSpots = [];
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = idx(x, y);
      if (t[i] !== '.' || roomOf[i] !== -1) continue;
      for (const [dx, dy] of DIRS4) {
        if (roomOf[idx(x + dx, y + dy)] < 0) continue;
        const [px, py] = [dy, dx]; // perpendicular
        if (t[idx(x + px, y + py)] === '#' && t[idx(x - px, y - py)] === '#' && t[idx(x - dx, y - dy)] === '.') { doorSpots.push(i); break; }
      }
    }
  }
  for (const i of doorSpots) if (chance(r, 0.55)) t[i] = '+';

  // Start in one room, stairs in the room furthest away.
  const startRoom = int(r, 0, rooms.length - 1);
  const [sx, sy] = centre(rooms[startRoom]);
  f.start = { x: sx, y: sy };
  f.startRoom = startRoom;
  const d0 = bfsDist(f, sx, sy);
  let far = null;
  rooms.forEach((rm, k) => {
    if (k === startRoom) return;
    const d = d0.get(idx(...centre(rm)));
    if (d === undefined) return;
    if (!far || d > far.d) far = { k, d };
  });
  if (!far || far.d < 12) return null;
  const sr = rooms[far.k];
  f.stairs = { x: int(r, sr.x, sr.x + sr.w - 1), y: int(r, sr.y, sr.y + sr.h - 1) };
  t[idx(f.stairs.x, f.stairs.y)] = '>';
  f.stairsRoom = far.k;

  // Every room must be reachable before secrets go in.
  const all = reachable(f, sx, sy);
  for (let i = 0; i < W * H; i++) if (PASSABLE.has(t[i]) && !all.has(i)) return null;

  // Secret shortcut doors: only where the floor stays connected without them.
  const floorCount = () => t.reduce((n, c) => n + (PASSABLE.has(c) ? 1 : 0), 0);
  if (depth >= 2) {
    let made = 0;
    for (const i of shuffle(r, [...doorSpots])) {
      if (made >= (depth >= 6 ? 2 : 1)) break;
      if (!chance(r, 0.5)) continue;
      const old = t[i];
      t[i] = 'S';
      if (reachable(f, sx, sy).size === floorCount()) made++;
      else t[i] = old;
    }
  }

  const used = new Set([idx(sx, sy), idx(f.stairs.x, f.stairs.y)]);
  const roomCells = (k, inner = false) => {
    const rm = rooms[k]; const out = [];
    for (let y = rm.y + (inner ? 1 : 0); y < rm.y + rm.h - (inner ? 1 : 0); y++) {
      for (let x = rm.x + (inner ? 1 : 0); x < rm.x + rm.w - (inner ? 1 : 0); x++) out.push([x, y]);
    }
    return out;
  };
  const openAround = (x, y) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (t[idx(x + dx, y + dy)] !== '.') return false;
    return true;
  };

  // Secret closet with treasure.
  if (depth >= 2 && chance(r, 0.75)) secretCloset(r, f, used, depth);

  // Braziers.
  const nB = depth === 1 ? 2 : int(r, 1, 3);
  const bRooms = shuffle(r, rooms.map((_, k) => k).filter((k) => k !== startRoom || depth === 1));
  if (depth === 1) { bRooms.splice(bRooms.indexOf(startRoom), 1); bRooms.unshift(startRoom); }
  for (const k of bRooms) {
    if (f.braziers.length >= nB) break;
    const spots = shuffle(r, roomCells(k, true).filter(([x, y]) => openAround(x, y) && !used.has(idx(x, y))));
    if (!spots.length) continue;
    const [x, y] = spots[0];
    t[idx(x, y)] = 'B';
    used.add(idx(x, y));
    f.braziers.push({ x, y, lit: depth === 1 && k === startRoom, fed: depth === 1 && k === startRoom });
  }

  // Shop.
  if (SHOP_DEPTHS.includes(depth)) {
    const cands = shuffle(r, rooms.map((_, k) => k).filter((k) => k !== startRoom && k !== far.k && rooms[k].w >= 4 && rooms[k].h >= 4));
    for (const k of cands) {
      const spots = roomCells(k, true).filter(([x, y]) => openAround(x, y) && !used.has(idx(x, y)));
      if (!spots.length) continue;
      const [x, y] = spots.sort((a, b) => a[1] - b[1])[0];
      f.shop = { x, y, room: k, stock: shopStock(r, depth).map((item) => ({ item, sold: false })) };
      used.add(idx(x, y));
      break;
    }
  }

  // Traps (corridors and rooms, never right next to the start).
  const nT = depth === 1 ? 1 : Math.min(2 + Math.floor(depth / 3), 5);
  const trapTypes = [['spike', 4], ['alarm', 2], ['smoke', 3], ['teleport', 2], ['dart', depth >= 3 ? 3 : 0]];
  const floorCells = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (t[idx(x, y)] === '.') floorCells.push([x, y]);
  const startD = bfsDist(f, sx, sy);
  const shopIdx = f.shop ? idx(f.shop.x, f.shop.y) : -1;
  const far6 = floorCells.filter(([x, y]) => (startD.get(idx(x, y)) ?? 0) >= 6 && idx(x, y) !== shopIdx);
  for (const [x, y] of shuffle(r, [...far6])) {
    if (f.traps.length >= nT) break;
    const i = idx(x, y);
    if (used.has(i)) continue;
    if (f.shop && rooms[f.shop.room] && roomOf[i] === f.shop.room) continue;
    used.add(i);
    f.traps.push({ x, y, type: weighted(r, trapTypes), found: false });
  }

  // Loot in rooms.
  const roomFloor = floorCells.filter(([x, y]) => roomOf[idx(x, y)] >= 0 && roomOf[idx(x, y)] !== startRoom && !used.has(idx(x, y)));
  shuffle(r, roomFloor);
  let li = 0;
  const place = (item) => { while (li < roomFloor.length && used.has(idx(...roomFloor[li]))) li++; if (li >= roomFloor.length) return; const [x, y] = roomFloor[li++]; used.add(idx(x, y)); f.items.push({ x, y, item }); };
  const nI = int(r, 4, 6);
  for (let k = 0; k < nI; k++) place(rollItem(r, depth));
  if (!f.items.some((it) => it.item.k === 'oil' || it.item.k === 'torch')) place(makeItem('oil', 'oil', { n: 1 }));
  if (depth % 2 === 0 && !f.items.some((it) => it.item.k === 'food')) place(makeItem('food', 'ration', { n: 1 }));
  const nG = int(r, 2, 4);
  for (let k = 0; k < nG; k++) place(makeItem('gold', 'gold', { n: int(r, 4, 12) + depth * 3 }));

  // Monsters away from the start.
  const nM = 4 + depth;
  const spawnable = floorCells.filter(([x, y]) => (startD.get(idx(x, y)) ?? 0) >= 8 && idx(x, y) !== shopIdx && !(f.shop && roomOf[idx(x, y)] === f.shop.room));
  shuffle(r, spawnable);
  const taken = new Set([shopIdx]);
  let mimics = 0;
  for (const [x, y] of spawnable) {
    if (f.monsters.length >= nM) break;
    const i = idx(x, y);
    if (taken.has(i)) continue;
    let kind = rollMonster(r, depth);
    const room = roomOf[i] >= 0;
    if ((kind === 'mimic' || kind === 'watcher') && !room) continue;
    if (kind === 'mimic') { if (mimics >= 1) continue; mimics++; }
    taken.add(i);
    const m = MONSTERS[kind];
    const asleep = m.tags.includes('sleeper') || (m.tags.includes('wander') && chance(r, 0.3));
    f.monsters.push({ kind, x, y, asleep, disguised: kind === 'mimic' });
  }

  // A few cracks and pebbles.
  for (const [x, y] of floorCells) {
    if (used.has(idx(x, y)) || !chance(r, 0.05)) continue;
    f.deco.push({ x, y, f: int(r, 0, 2) });
  }
  return f;
}

function secretCloset(r, f, used, depth) {
  const t = f.t;
  for (let tries = 0; tries < 80; tries++) {
    const cw = int(r, 2, 3); const ch = int(r, 2, 3);
    const x0 = int(r, 2, W - cw - 2); const y0 = int(r, 2, H - ch - 2);
    let solid = true;
    for (let y = y0 - 1; y <= y0 + ch && solid; y++) for (let x = x0 - 1; x <= x0 + cw && solid; x++) if (t[idx(x, y)] !== '#') solid = false;
    if (!solid) continue;
    // A ring cell (not a corner) whose far side is ordinary floor becomes the secret door.
    const options = [];
    for (let x = x0; x < x0 + cw; x++) { options.push([x, y0 - 1, 0, -1]); options.push([x, y0 + ch, 0, 1]); }
    for (let y = y0; y < y0 + ch; y++) { options.push([x0 - 1, y, -1, 0]); options.push([x0 + cw, y, 1, 0]); }
    const ok = options.filter(([x, y, dx, dy]) => inside(x + dx, y + dy) && t[idx(x + dx, y + dy)] === '.'
      && t[idx(x + dy, y + dx)] === '#' && t[idx(x - dy, y - dx)] === '#');
    if (!ok.length) continue;
    const [dxp, dyp] = pick(r, ok);
    for (let y = y0; y < y0 + ch; y++) for (let x = x0; x < x0 + cw; x++) t[idx(x, y)] = '.';
    t[idx(dxp, dyp)] = 'S';
    f.closet = { x: x0, y: y0, w: cw, h: ch };
    const cells = [];
    for (let y = y0; y < y0 + ch; y++) for (let x = x0; x < x0 + cw; x++) cells.push([x, y]);
    shuffle(r, cells);
    const loot = [rollItem(r, depth + 1), makeItem('gold', 'gold', { n: int(r, 15, 30) + depth * 5 })];
    if (chance(r, 0.5)) loot.push(rollItem(r, depth + 1));
    loot.forEach((item, k) => { const [x, y] = cells[k]; used.add(idx(x, y)); f.items.push({ x, y, item }); });
    return true;
  }
  return false;
}

function bossFloor(r, depth) {
  const t = new Array(W * H).fill('#');
  const set = (x, y, c) => { t[idx(x, y)] = c; };
  const fill = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, '.'); };
  fill(12, 25, 8, 5);              // entry room
  for (let y = 20; y <= 24; y++) set(15, y, '.');
  fill(7, 5, 18, 15);              // the hall
  set(15, 20, '+');
  for (const [x, y] of [[10, 8], [21, 8], [10, 16], [21, 16], [13, 12], [18, 12]]) set(x, y, '#');
  const f = {
    depth, w: W, h: H, t, rooms: [{ x: 12, y: 25, w: 8, h: 5 }, { x: 7, y: 5, w: 18, h: 15 }],
    braziers: [], traps: [], items: [], monsters: [], deco: [], shop: null, lit: [], boss: true,
    start: { x: 15, y: 27 }, startRoom: 0, stairs: null, stairsRoom: 1,
  };
  for (const [x, y] of [[8, 6], [23, 6], [8, 18], [23, 18]]) { set(x, y, 'B'); f.braziers.push({ x, y, lit: false, fed: false }); }
  f.items.push({ x: 13, y: 26, item: makeItem('oil', 'oil', { n: 1 }) });
  f.items.push({ x: 18, y: 26, item: makeItem('food', 'ration', { n: 1 }) });
  f.items.push({ x: 13, y: 28, item: makeItem('potion', 'healing', { n: 1 }) });
  f.items.push({ x: 18, y: 28, item: rollItem(r, depth) });
  f.monsters.push({ kind: 'king', x: 15, y: 9, asleep: true, disguised: false });
  f.monsters.push({ kind: 'shade', x: 9, y: 10, asleep: false, disguised: false });
  f.monsters.push({ kind: 'shade', x: 22, y: 14, asleep: false, disguised: false });
  for (let k = 0; k < 14; k++) {
    const x = int(r, 7, 24); const y = int(r, 5, 19);
    if (t[idx(x, y)] === '.') f.deco.push({ x, y, f: int(r, 0, 2) });
  }
  return f;
}

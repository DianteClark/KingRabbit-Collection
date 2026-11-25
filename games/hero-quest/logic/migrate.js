// Saves from older layouts. v1 had tall 11 x 13 rooms; v2 has wide 17 x 11 rooms with the same
// room grid, so most flags still mean the same thing. Chests and cracked walls inside a room
// are found again by what they hold; you restart at the beginning of the area you were in.
// Never throws: anything unreadable becomes a fresh adventure.
import { ROOMS, START } from './data.js';
import { VERSION, newState } from './game.js';
import { chestFlag, cellFlag } from './world.js';

// v1 positions -> what they were (taken from the v1 room data)
const V1_CHESTS = {
  'chest:ow:1,0:4,1': ['ow:1,0', 'gems20'], 'chest:in:cave:5,5': ['in:cave', 'heart'],
  'chest:d1:0,2:5,5': ['d1:0,2', 'key'], 'chest:d1:2,1:5,5': ['d1:2,1', 'boomerang'],
  'chest:d1:1,1:5,6': ['d1:1,1', 'gems20'], 'chest:d1:0,1:2,5': ['d1:0,1', 'bigkey'],
  'chest:d2:0,2:5,6': ['d2:0,2', 'key'], 'chest:d2:0,1:5,5': ['d2:0,1', 'bombs'],
  'chest:d2:2,1:5,6': ['d2:2,1', 'key'], 'chest:d2:2,2:5,6': ['d2:2,2', 'bigkey'],
  'chest:d3:0,2:5,6': ['d3:0,2', 'key'], 'chest:d3:2,2:5,2': ['d3:2,2', 'key'],
  'chest:d3:0,1:5,6': ['d3:0,1', 'bigkey'], 'chest:d3:2,1:3,3': ['d3:2,1', 'gems50'],
};
const V1_CELLS = { 'cell:ow:2,2:4,10': 'ow:2,2', 'cell:ow:2,0:5,4': 'ow:2,0', 'cell:d3:2,1:3,4': 'd3:2,1' };
// flags that don't depend on positions inside a room
const KEEP = /^(boss|hc|seen|bought|trig|door):/;

const cellsWith = (r, ch) => {
  const out = [];
  r.map.forEach((row, y) => [...row].forEach((c, x) => { if (c === ch) out.push([x, y]); }));
  return out;
};

/** Where an area starts: a dungeon's entrance, otherwise the village outside the elder's house. */
export function areaStart(roomId) {
  const area = String(roomId || '').split(':')[0];
  if (/^d\d$/.test(area)) {
    for (const r of Object.values(ROOMS)) {
      const w = r.warps.find((o) => o.to.startsWith(`${area}:`));
      if (w) return { room: w.to, x: w.tx, y: w.ty, dir: w.dir };
    }
  }
  return { room: 'ow:0,2', x: 3, y: 6, dir: 'down' };
}

/** Bring any saved state up to the current version, or return null if there's nothing usable. */
export function migrate(saved) {
  if (!saved || typeof saved !== 'object') return null;
  if (saved.v === VERSION) {
    // a current save with a broken respawn point still loads, at the start of its area
    const r = ROOMS[saved.respawn?.room];
    if (!r || !r.map[saved.respawn.y]?.[saved.respawn.x]) saved.respawn = areaStart(saved.respawn?.room);
    saved.flags ||= {}; saved.items ||= { sword: false, boomerang: false, bombs: false };
    saved.keys ||= { d1: 0, d2: 0, d3: 0 }; saved.bigKeys ||= {};
    return saved;
  }
  try {
    const s = newState();
    const num = (v, d) => (Number.isFinite(v) ? v : d);
    s.maxHp = Math.max(6, Math.min(20, num(saved.maxHp, 6)));
    s.hp = Math.max(1, Math.min(s.maxHp, num(saved.hp, s.maxHp)));
    for (const k of ['gems', 'potions', 'bombs', 'deaths', 'time', 'kills']) s[k] = Math.max(0, num(saved[k], 0));
    Object.assign(s.items, saved.items || {});
    for (const d of ['d1', 'd2', 'd3']) {
      s.keys[d] = Math.max(0, num(saved.keys?.[d], 0));
      s.bigKeys[d] = !!saved.bigKeys?.[d];
    }
    s.selected = saved.selected ?? null;
    s.done = !!saved.done;
    const flags = saved.flags || {};
    for (const [f, v] of Object.entries(flags)) {
      if (!v) continue;
      if (KEEP.test(f)) s.flags[f] = true;
      else if (V1_CHESTS[f]) {
        const [rid, item] = V1_CHESTS[f];
        const r = ROOMS[rid];
        const spot = r && cellsWith(r, 'C').find(([x, y]) => r.chests[`${x},${y}`]?.item === item);
        if (spot) s.flags[chestFlag(r, ...spot)] = true;
      } else if (V1_CELLS[f]) {
        const r = ROOMS[V1_CELLS[f]];
        for (const [x, y] of cellsWith(r, 'c')) { const cf = cellFlag(r, x, y); if (cf.startsWith('cell:')) s.flags[cf] = true; }
      }
    }
    // the elder hands over the sword even in a save from before you met him
    if (s.items.sword && !s.flags['seen:in:elder']) s.flags['seen:in:elder'] = true;
    const from = saved.respawn?.room;
    s.respawn = s.items.sword ? areaStart(from) : { ...START };
    s.migrated = saved.v ?? 0;
    return s;
  } catch {
    return null;
  }
}

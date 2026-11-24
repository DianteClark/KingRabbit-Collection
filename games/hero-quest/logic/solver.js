// Can the adventure be finished, whatever order you do things in? Used by the tests.
//
// The solver walks the maps cell by cell (enemies are assumed beatable, blocks assumed pushable
// out of the way - their puzzles are checked separately by solvePuzzle). It repeatedly takes
// every "safe" step it can (open chests, bomb cracked walls, hit crystals, solve switch rooms,
// beat bosses) and branches on the only choice that can go wrong: which locked door a small
// key is spent on. Every branch must still reach the Hollow Crown, so no key order soft-locks.
import { ROOMS, START } from './data.js';
import { COLS, ROWS, TILE, SIDE_DELTA, OPPOSITE, DOOR_CELL, BOOMERANG } from './constants.js';
import { WALKABLE, FLYOVER } from './tiles.js';
import { neighbour, cellFlag, chestFlag, trigFlag, cellOpen, sideOf } from './world.js';

const BOSS_NEEDS = { slimeKing: [], golemKing: [], hollowKing: ['boomerang'] };

export function initialInv() {
  return { items: { sword: true }, keys: { d1: 0, d2: 0, d3: 0 }, bigKeys: {}, flags: {}, bombs: false };
}

const npcAt = (r, x, y) => r.npcs.some((n) => n.x === x && n.y === y);

/** Walkable for the solver (enemies gone, blocks ignored). */
export function walk(r, x, y, flags) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
  if (npcAt(r, x, y)) return false;
  return cellOpen(r, x, y, flags, { clear: true, sealed: false });
}

/** Every cell you can stand on: Set of "room|x,y". */
export function reachable(flags, start = START) {
  const seen = new Set();
  const q = [[start.room, start.x, start.y]];
  const key = (id, x, y) => `${id}|${x},${y}`;
  seen.add(key(start.room, start.x, start.y));
  while (q.length) {
    const [id, x, y] = q.pop();
    const r = ROOMS[id];
    const push = (nid, nx, ny) => {
      const k = key(nid, nx, ny);
      if (seen.has(k)) return;
      if (!walk(ROOMS[nid], nx, ny, flags)) return;
      seen.add(k); q.push([nid, nx, ny]);
    };
    for (const [side, [dx, dy]] of Object.entries(SIDE_DELTA)) {
      const nx = x + dx; const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS) { push(id, nx, ny); continue; }
      const n = neighbour(r, side);
      if (n) push(n.id, (nx + COLS) % COLS, (ny + ROWS) % ROWS);
      else if (r.exits[side]) { const e = r.exits[side]; push(e.to, e.tx, e.ty); }
    }
    const w = r.warps.find((o) => o.x === x && o.y === y);
    if (w) push(w.to, w.tx, w.ty);
  }
  return seen;
}

function cellsOf(seen, id) {
  const out = [];
  for (const k of seen) {
    const [rid, xy] = k.split('|');
    if (rid === id) out.push(xy.split(',').map(Number));
  }
  return out;
}

const adjReach = (seen, id, x, y) => [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => seen.has(`${id}|${x + dx},${y + dy}`));

/** Can the boomerang (or the sword, from next to it) reach the crystal at cx, cy? */
function crystalReachable(r, seen, cx, cy, flags, hasBoomerang) {
  if (adjReach(seen, r.id, cx, cy)) return true;
  if (!hasBoomerang) return false;
  for (const [x, y] of cellsOf(seen, r.id)) {
    for (let a = 0; a < 8; a++) {
      const vx = Math.round(Math.cos((a * Math.PI) / 4)); const vy = Math.round(Math.sin((a * Math.PI) / 4));
      const len = Math.hypot(vx, vy);
      for (let d = 4; d <= BOOMERANG.range; d += 4) {
        const px = x * TILE + 8 + (vx / len) * d; const py = y * TILE + 8 + (vy / len) * d;
        const tx = Math.floor(px / TILE); const ty = Math.floor(py / TILE);
        if (tx === cx && ty === cy) return true;
        const c = r.map[ty]?.[tx];
        if (c === undefined) break;
        if (!(WALKABLE.has(c) || FLYOVER.has(c) || c === 'P' || cellOpen(r, tx, ty, flags, { clear: true }))) break;
      }
    }
  }
  return false;
}

/**
 * Do every safe action until nothing changes. Returns the list of locked doors you could spend
 * a key on next (the branching choice).
 */
function settle(st, log) {
  for (let guard = 0; guard < 500; guard++) {
    const seen = reachable(st.flags);
    let changed = false;
    const lockable = [];
    for (const r of Object.values(ROOMS)) {
      const here = cellsOf(seen, r.id);
      if (!here.length) continue;
      // beat bosses / clear rooms (enemies are always beatable with what the room needs)
      if (r.boss && !st.flags[`boss:${r.area}`]) {
        const kind = r.enemies[0][0];
        if (BOSS_NEEDS[kind].every((it) => st.items[it])) {
          st.flags[`boss:${r.area}`] = true; st.flags[`hc:${r.area}`] = true; st.hearts = (st.hearts || 0) + 1;
          log.push(`beat ${kind}`); changed = true;
        }
      }
      if (r.on.clear && r.enemies.length && !st.flags[trigFlag(r, 'clear')]) { st.flags[trigFlag(r, 'clear')] = true; changed = true; }
      if (r.on.switch && !st.flags[trigFlag(r, 'switch')]) {
        const sol = solvePuzzle(r, st.flags);
        if (sol.ok) {
          st.flags[trigFlag(r, 'switch')] = true;
          if (r.on.switch.door) { const [x, y] = DOOR_CELL[r.on.switch.door]; st.flags[cellFlag(r, x, y)] = true; }
          log.push(`solved ${r.id}`); changed = true;
        }
      }
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const c = r.map[y][x];
          if (c === 'X' && r.on.crystal && !st.flags[trigFlag(r, 'crystal')] && crystalReachable(r, seen, x, y, st.flags, st.items.boomerang)) {
            st.flags[trigFlag(r, 'crystal')] = true; log.push(`crystal ${r.id}`); changed = true;
          }
          if (c === 'C' && !st.flags[chestFlag(r, x, y)] && adjReach(seen, r.id, x, y)) {
            const spec = r.chests[`${x},${y}`];
            if (spec.hidden && !st.flags[trigFlag(r, spec.hidden)]) continue;
            st.flags[chestFlag(r, x, y)] = true;
            gain(st, spec.item, r.area);
            log.push(`chest ${r.id} ${spec.item}`); changed = true;
          }
          if (c === 'c' && st.items.bombs && !st.flags[cellFlag(r, x, y)] && (adjReach(seen, r.id, x, y) || seen.has(`${r.id}|${x},${y}`))) {
            st.flags[cellFlag(r, x, y)] = true; log.push(`bomb ${r.id}`); changed = true;
          }
          if (c === 'K' && st.bigKeys[r.area] && !st.flags[cellFlag(r, x, y)] && adjReach(seen, r.id, x, y)) {
            st.flags[cellFlag(r, x, y)] = true; changed = true;
          }
          if (c === 'k' && !st.flags[cellFlag(r, x, y)] && adjReach(seen, r.id, x, y)) {
            lockable.push({ room: r.id, x, y, flag: cellFlag(r, x, y), area: r.area });
          }
        }
      }
    }
    if (!changed) {
      const uniq = [...new Map(lockable.map((d) => [d.flag, d])).values()];
      return uniq.filter((d) => st.keys[d.area] > 0);
    }
  }
  throw new Error('solver did not settle');
}

function gain(st, item, area) {
  if (item === 'key') st.keys[area]++;
  else if (item === 'bigkey') st.bigKeys[area] = true;
  else if (item === 'boomerang' || item === 'bombs') st.items[item] = true;
  else if (item === 'heart') st.hearts = (st.hearts || 0) + 1;
}

const clone = (st) => JSON.parse(JSON.stringify(st));

/**
 * Explore every order of spending keys. Returns { ok, branches, deadEnds: [log], best }.
 * ok means every branch reaches the end (no soft-lock), and the best branch opens every chest.
 */
export function solveGame() {
  const deadEnds = []; let branches = 0; let best = null;
  const root = initialInv();
  const visit = (st, log) => {
    const doors = settle(st, log);
    if (!doors.length) {
      branches++;
      if (!st.flags['boss:d3']) deadEnds.push(log);
      if (!best || Object.keys(st.flags).length > Object.keys(best.flags).length) best = st;
      return;
    }
    for (const d of doors) {
      const s2 = clone(st);
      s2.keys[d.area]--; s2.flags[d.flag] = true;
      visit(s2, [...log, `key ${d.room} ${d.x},${d.y}`]);
    }
  };
  visit(root, []);
  return { ok: deadEnds.length === 0 && branches > 0, branches, deadEnds, best };
}

/** All chests in the game, as flag names. */
export function allChests() {
  const out = [];
  for (const r of Object.values(ROOMS)) {
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (r.map[y][x] === 'C') out.push(chestFlag(r, x, y));
  }
  return out;
}

// ------------------------------------------------------------------ push-block puzzles

/**
 * Sokoban search for a switch room: from every open doorway, can blocks be pushed so that every
 * switch is covered, with the reward (door or chest) then within reach?
 */
export function solvePuzzle(r, flags = {}) {
  const switches = []; const blocks0 = []; const starts = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = r.map[y][x];
      if (c === 'x') switches.push([x, y]);
      if (c === 'P') blocks0.push([x, y]);
      if (sideOf(x, y) && walk(r, x, y, flags) && (c !== 's')) starts.push([x, y]);
    }
  }
  const floor = (x, y) => {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
    if (npcAt(r, x, y)) return false;
    const c = r.map[y][x];
    return c === '.' || c === ',' || c === ':' || c === 'x' || c === 'P' || (c === 'W' && flags[trigFlag(r, 'crystal')]);
  };
  const blockFloor = (x, y) => floor(x, y) && !sideOf(x, y);
  const results = [];
  for (const s of starts) results.push(search(s));
  return { ok: results.length > 0 && results.every((x) => x.ok), results };

  function search(start) {
    const bkey = (bs) => bs.map(([x, y]) => `${x},${y}`).sort().join(';');
    const playerRegion = (bs, px, py) => {
      const occ = new Set(bs.map(([x, y]) => `${x},${y}`));
      const seen = new Set([`${px},${py}`]); const q = [[px, py]];
      while (q.length) {
        const [x, y] = q.pop();
        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          const nx = x + dx; const ny = y + dy; const k = `${nx},${ny}`;
          if (seen.has(k) || occ.has(k)) continue;
          if (!(floor(nx, ny) || (nx === start[0] && ny === start[1]))) continue;
          seen.add(k); q.push([nx, ny]);
        }
      }
      return seen;
    };
    const canon = (region) => [...region].sort()[0];
    const startState = { bs: blocks0, p: start };
    const visited = new Set();
    const q = [startState];
    let expanded = 0;
    while (q.length && expanded < 200000) {
      const st = q.shift(); expanded++;
      const region = playerRegion(st.bs, st.p[0], st.p[1]);
      const k = `${bkey(st.bs)}|${canon(region)}`;
      if (visited.has(k)) continue;
      visited.add(k);
      const covered = switches.every(([x, y]) => st.bs.some(([bx, by]) => bx === x && by === y));
      if (covered && rewardReachable(region, st.bs)) return { ok: true, states: visited.size };
      st.bs.forEach(([bx, by], i) => {
        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          const px = bx - dx; const py = by - dy; const tx = bx + dx; const ty = by + dy;
          if (!region.has(`${px},${py}`)) continue;
          if (!blockFloor(tx, ty) || st.bs.some(([ox, oy]) => ox === tx && oy === ty)) continue;
          const bs = st.bs.map((b, j) => (j === i ? [tx, ty] : b));
          q.push({ bs, p: [bx, by] });
        }
      });
    }
    return { ok: false, states: visited.size };
  }

  function rewardReachable(region) {
    const act = r.on.switch;
    if (act.door) {
      const [x, y] = DOOR_CELL[act.door];
      const [dx, dy] = SIDE_DELTA[OPPOSITE[act.door]];
      return region.has(`${x + dx},${y + dy}`);
    }
    if (act.chest) {
      for (const [xy, spec] of Object.entries(r.chests)) {
        if (spec.hidden !== 'switch') continue;
        const [x, y] = xy.split(',').map(Number);
        if (![[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => region.has(`${x + dx},${y + dy}`))) return false;
      }
    }
    return true;
  }
}

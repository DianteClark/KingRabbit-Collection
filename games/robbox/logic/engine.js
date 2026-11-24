// Robbox world rules: the grid, the robot and what each command does to them.
// Pure functions, no Phaser, so node tests can run every level.
//
// Level definition:
//   map:    rows of tile chars (see TILE_CHARS)
//   height: optional rows of digits 0-3 (same size as map), default 0
//   paint:  optional rows of 'b' (blue), 'o' (orange) or '.' for the colour under each tile
//   start:  [x, y, 'N'|'E'|'S'|'W']
//
// Tile chars:
//   .  nothing (fall off)        o  floor          #  wall block
//   L  lamp (Action lights it)   X  crate pad      C  crate on floor
//   K  gear key on floor         D  locked gate (a gear opens it)
//   ^ > v <  conveyor belts      A B  teleporter pairs (two of each letter)

export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W
export const DIR_NAMES = ['N', 'E', 'S', 'W'];
export const MAX_HEIGHT = 3;

/** Commands. A program cell is { op, cond } where cond is null, 'b' or 'o'. */
export const OPS = {
  F: { name: 'Move', blurb: 'Move one tile forward on the same level.' },
  L: { name: 'Turn left', blurb: 'Turn 90 degrees to the left.' },
  R: { name: 'Turn right', blurb: 'Turn 90 degrees to the right.' },
  J: { name: 'Jump', blurb: 'Hop forward one level up, or any number down.' },
  A: { name: 'Action', blurb: 'Light a lamp, or pick up / put down a crate.' },
  1: { name: 'Call F1', blurb: 'Run everything in F1, then carry on.' },
  2: { name: 'Call F2', blurb: 'Run everything in F2, then carry on.' },
};

export const FAIL = {
  fell: 'Fell off the edge!',
  wall: 'Bumped into a wall!',
  crate: 'Bumped into a crate!',
  ledgeUp: 'Bumped a ledge! Use Jump to climb up.',
  ledgeDown: 'Move can\'t go down a ledge. Use Jump.',
  tooHigh: 'Too high! Jump only climbs one level.',
  locked: 'The gate is locked. Find a gear first.',
  ended: 'Out of moves: the program ended before the job was done.',
  long: 'Too many steps (is it looping forever?)',
  deep: 'Too many calls inside calls.',
};

const CONV = { '^': 0, '>': 1, v: 2, '<': 3 };

export function parseLevel(def) {
  const rows = def.map;
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const cells = [];
  const crates = [];
  const keys = [];
  const lamps = [];
  const pads = [];
  const teles = {};
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x] ?? '.';
      const i = y * w + x;
      const hgt = def.height ? Number(def.height[y]?.[x] ?? 0) || 0 : 0;
      const p = def.paint ? def.paint[y]?.[x] : '.';
      const cell = { t: 'floor', h: hgt, paint: p === 'b' || p === 'o' ? p : null };
      switch (ch) {
        case '.': case ' ': cell.t = 'void'; break;
        case '#': cell.t = 'wall'; break;
        case 'L': cell.t = 'lamp'; lamps.push(i); break;
        case 'X': cell.t = 'pad'; pads.push(i); break;
        case 'C': crates.push(i); break;
        case 'K': keys.push(i); break;
        case 'D': cell.t = 'gate'; break;
        case 'A': case 'B': cell.t = 'tele'; cell.pair = ch; (teles[ch] ||= []).push(i); break;
        case 'o': break;
        default:
          if (ch in CONV) { cell.t = 'conv'; cell.dir = CONV[ch]; } else throw new Error(`Unknown tile '${ch}' in ${def.id}`);
      }
      cells.push(cell);
    }
  }
  for (const [k, list] of Object.entries(teles)) {
    if (list.length !== 2) throw new Error(`Teleporter ${k} in ${def.id} needs exactly 2 pads`);
    cells[list[0]].to = list[1];
    cells[list[1]].to = list[0];
  }
  const [sx, sy, sd] = def.start;
  return {
    id: def.id, w, h, cells, crates, keys, lamps, pads,
    start: { x: sx, y: sy, d: DIR_NAMES.indexOf(sd) },
  };
}

export function initState(lv) {
  return {
    x: lv.start.x, y: lv.start.y, d: lv.start.d,
    lit: [], // lamp indices that are on
    crates: [...lv.crates], // where crates sit
    keys: [...lv.keys], // gears still lying on the map
    opened: [], // gates that have been opened
    gears: 0, // gears carried
    carrying: false,
  };
}

export const cloneState = (s) => ({ ...s, lit: [...s.lit], crates: [...s.crates], keys: [...s.keys], opened: [...s.opened] });

const idx = (lv, x, y) => y * lv.w + x;
const inside = (lv, x, y) => x >= 0 && y >= 0 && x < lv.w && y < lv.h;
export const cellAt = (lv, x, y) => (inside(lv, x, y) ? lv.cells[idx(lv, x, y)] : null);

/** Height the robot stands at on a tile. */
export const heightAt = (lv, x, y) => cellAt(lv, x, y)?.h ?? 0;

/** Colour of the tile under the robot (for conditional commands). */
export const paintUnder = (lv, s) => cellAt(lv, s.x, s.y)?.paint ?? null;

export function isWon(lv, s) {
  if (s.lit.length < lv.lamps.length) return false;
  for (const p of lv.pads) if (!s.crates.includes(p)) return false;
  return !s.carrying;
}

export function goalCounts(lv, s) {
  return {
    lamps: s.lit.length, lampsTotal: lv.lamps.length,
    crates: lv.pads.filter((p) => s.crates.includes(p)).length, cratesTotal: lv.pads.length,
  };
}

/**
 * Do one basic command (F L R J A). Returns { state, path, events, fail }.
 *   path:   robot positions in order, each { x, y, h, how } with how = walk | jump | hop | slide | tele | fall | bump
 *   events: [{ type: 'light'|'unlight'|'pick'|'drop'|'gear'|'gate'|'nothing', at }]
 *   fail:   a key of FAIL, or null
 */
export function act(lv, state, op) {
  const s = cloneState(state);
  const path = [];
  const events = [];
  const out = (fail = null) => ({ state: s, path, events, fail });

  if (op === 'L') { s.d = (s.d + 3) % 4; return out(); }
  if (op === 'R') { s.d = (s.d + 1) % 4; return out(); }

  if (op === 'A') {
    const here = idx(lv, s.x, s.y);
    const cell = lv.cells[here];
    if (cell.t === 'lamp') {
      const on = s.lit.includes(here);
      s.lit = on ? s.lit.filter((i) => i !== here) : [...s.lit, here];
      events.push({ type: on ? 'unlight' : 'light', at: here });
      return out();
    }
    const [dx, dy] = DIRS[s.d];
    const fx = s.x + dx; const fy = s.y + dy;
    const front = cellAt(lv, fx, fy);
    const fi = idx(lv, fx, fy);
    const reach = front && Math.abs(front.h - cell.h) <= 1;
    if (s.carrying) {
      const free = reach && (front.t === 'floor' || front.t === 'pad') && !s.crates.includes(fi) && !s.keys.includes(fi);
      if (free) { s.carrying = false; s.crates.push(fi); events.push({ type: 'drop', at: fi }); return out(); }
    } else if (reach && s.crates.includes(fi)) {
      s.carrying = true; s.crates = s.crates.filter((i) => i !== fi); events.push({ type: 'pick', at: fi }); return out();
    }
    events.push({ type: 'nothing', at: here });
    return out();
  }

  if (op !== 'F' && op !== 'J') throw new Error(`Not a basic command: ${op}`);
  const [dx, dy] = DIRS[s.d];
  const nx = s.x + dx; const ny = s.y + dy;
  const cur = heightAt(lv, s.x, s.y);
  const t = cellAt(lv, nx, ny);
  const how = op === 'F' ? 'walk' : 'jump';
  if (!t || t.t === 'void') { path.push({ x: nx, y: ny, h: cur, how: 'fall' }); s.x = nx; s.y = ny; return out('fell'); }
  const ti = idx(lv, nx, ny);
  const bump = (why) => { path.push({ x: nx, y: ny, h: cur, how: 'bump' }); return out(why); };
  if (t.t === 'wall') return bump('wall');
  if (s.crates.includes(ti)) return bump('crate');
  if (op === 'F') {
    if (t.h > cur) return bump('ledgeUp');
    if (t.h < cur) return bump('ledgeDown');
  } else {
    if (t.h === cur) { path.push({ x: s.x, y: s.y, h: cur, how: 'hop' }); return out(); }
    if (t.h > cur + 1) return bump('tooHigh');
  }
  if (t.t === 'gate' && !s.opened.includes(ti)) {
    if (s.gears < 1) return bump('locked');
    s.gears--; s.opened.push(ti); events.push({ type: 'gate', at: ti });
  }
  s.x = nx; s.y = ny;
  path.push({ x: nx, y: ny, h: t.h, how });
  const fail = arrive(lv, s, path, events);
  return out(fail);
}

/** Things that happen when the robot lands on a tile: gears, conveyors, teleporters. */
function arrive(lv, s, path, events) {
  const seen = new Set();
  for (let guard = 0; guard < 64; guard++) {
    const i = idx(lv, s.x, s.y);
    const cell = lv.cells[i];
    if (s.keys.includes(i)) { s.keys = s.keys.filter((k) => k !== i); s.gears++; events.push({ type: 'gear', at: i }); }
    if (cell.t === 'tele' && !seen.has(`t${i}`)) {
      seen.add(`t${i}`); seen.add(`t${cell.to}`);
      if (s.crates.includes(cell.to)) return null; // blocked exit: stay put
      s.x = cell.to % lv.w; s.y = Math.floor(cell.to / lv.w);
      path.push({ x: s.x, y: s.y, h: lv.cells[cell.to].h, how: 'tele' });
      continue;
    }
    if (cell.t === 'conv') {
      if (seen.has(`c${i}`)) return null; // a loop of belts: stop
      seen.add(`c${i}`);
      const [dx, dy] = DIRS[cell.dir];
      const nx = s.x + dx; const ny = s.y + dy;
      const t = cellAt(lv, nx, ny);
      if (!t || t.t === 'void') { path.push({ x: nx, y: ny, h: cell.h, how: 'fall' }); s.x = nx; s.y = ny; return 'fell'; }
      const ti = idx(lv, nx, ny);
      if (t.t === 'wall' || t.h > cell.h || s.crates.includes(ti) || (t.t === 'gate' && !s.opened.includes(ti))) return null;
      s.x = nx; s.y = ny;
      path.push({ x: nx, y: ny, h: t.h, how: 'slide' });
      continue;
    }
    return null;
  }
  return null;
}

// ---------------------------------------------------------------- programs

export const SLOTS = ['main', 'f1', 'f2'];
export const SLOT_NAMES = { main: 'MAIN', f1: 'F1', f2: 'F2' };
export const STEP_LIMIT = 500;
export const DEPTH_LIMIT = 64;

/** Parse 'F F b:R 1' into [{ op, cond }]. */
export function parseCode(str) {
  if (!str) return [];
  return str.trim().split(/\s+/).filter(Boolean).map((tok) => {
    const m = tok.match(/^(?:([bo]):)?([FLRJA12])$/);
    if (!m) throw new Error(`Bad command '${tok}'`);
    return { op: m[2], cond: m[1] || null };
  });
}
export const codeString = (cells) => cells.map((c) => (c.cond ? `${c.cond}:${c.op}` : c.op)).join(' ');

export function programFrom({ main = '', f1 = '', f2 = '' }) {
  return { main: parseCode(main), f1: parseCode(f1), f2: parseCode(f2) };
}

export const programLength = (p) => SLOTS.reduce((n, k) => n + (p[k]?.length || 0), 0);

/** True when a function can end up calling itself (directly, or F1 -> F2 -> F1). */
export function hasLoop(p) {
  const calls = (slot) => new Set((p[slot] || []).filter((c) => c.op === '1' || c.op === '2').map((c) => (c.op === '1' ? 'f1' : 'f2')));
  const c1 = calls('f1'); const c2 = calls('f2');
  return c1.has('f1') || c2.has('f2') || (c1.has('f2') && c2.has('f1'));
}

/** A run of a program on a level. Call stepRun() until run.done. */
export function createRun(lv, program) {
  return {
    lv, program, state: initState(lv), stack: [{ slot: 'main', pc: 0 }], steps: 0, done: false, won: false, fail: null,
  };
}

/**
 * Run one instruction (a call counts as one). Returns
 *   { slot, index, op, cond, skipped, path, events, fail, won }   or null if the run is already over.
 */
export function stepRun(run) {
  if (run.done) return null;
  const { lv, program } = run;
  // Drop finished frames.
  while (run.stack.length && run.stack.at(-1).pc >= program[run.stack.at(-1).slot].length) run.stack.pop();
  if (!run.stack.length) return finish(run, { fail: 'ended' });
  if (run.steps >= STEP_LIMIT) return finish(run, { fail: 'long' });
  const frame = run.stack.at(-1);
  const cell = program[frame.slot][frame.pc];
  const info = { slot: frame.slot, index: frame.pc, op: cell.op, cond: cell.cond, skipped: false, path: [], events: [], fail: null, won: false };
  frame.pc++;
  run.steps++;
  if (cell.cond && paintUnder(lv, run.state) !== cell.cond) {
    info.skipped = true;
  } else if (cell.op === '1' || cell.op === '2') {
    const slot = cell.op === '1' ? 'f1' : 'f2';
    // Tail call: a call that is the last command needs no return, so loops can run forever.
    while (run.stack.length && run.stack.at(-1).pc >= program[run.stack.at(-1).slot].length) run.stack.pop();
    if (run.stack.length >= DEPTH_LIMIT) { info.fail = 'deep'; return finish(run, info); }
    run.stack.push({ slot, pc: 0 });
  } else {
    const r = act(lv, run.state, cell.op);
    run.state = r.state;
    info.path = r.path;
    info.events = r.events;
    if (r.fail) { info.fail = r.fail; return finish(run, info); }
  }
  if (isWon(lv, run.state)) { info.won = true; run.done = true; run.won = true; return info; }
  // Peek: if nothing is left to run, the run ends with this step.
  while (run.stack.length && run.stack.at(-1).pc >= program[run.stack.at(-1).slot].length) run.stack.pop();
  if (!run.stack.length) { info.fail = 'ended'; return finish(run, info); }
  return info;
}

function finish(run, info) {
  run.done = true;
  run.fail = info.fail;
  return { slot: null, index: -1, op: null, cond: null, skipped: false, path: [], events: [], won: false, ...info };
}

/** Run a whole program. Returns { won, fail, steps, state }. */
export function runProgram(lv, program) {
  const run = createRun(lv, program);
  while (!run.done) stepRun(run);
  return { won: run.won, fail: run.fail, steps: run.steps, state: run.state };
}

// ---------------------------------------------------------------- stars

/** Stars for a solved level: 3 at or under the target length, 2 a little over, 1 otherwise. */
export function starsFor(length, target) {
  if (length <= target) return 3;
  if (length <= target + Math.max(2, Math.ceil(target * 0.3))) return 2;
  return 1;
}

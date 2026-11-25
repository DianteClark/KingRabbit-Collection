// Campaign maps, the wave generator and the daily map maker. Pure logic (node-testable).
//
// Every map is 11 cells wide and 15 tall. Cell letters:
//   .  sand: you can build here (on maze maps enemies can also walk here)
//   #  road: enemies walk here (path maps only), no building
//   S  where enemies come in (top row)      B  your base (bottom row)
//   r  rocks (nothing walks or builds)      o  oasis palms (no building, decoration)
//   w  water (no building; flyers cross it)
import { ENEMIES } from './data.js';
import { makeRng } from './rng.js';

export const COLS = 11;
export const ROWS = 15;

/** Turn a list of waypoint polylines into rows of map letters. */
export function buildRows({ kind = 'path', paths = [], spawns, base, deco = [] }) {
  const g = Array.from({ length: ROWS }, () => Array(COLS).fill('.'));
  for (const line of paths) {
    for (let i = 1; i < line.length; i++) {
      let [x, y] = line[i - 1];
      const [x2, y2] = line[i];
      const dx = Math.sign(x2 - x); const dy = Math.sign(y2 - y);
      g[y][x] = '#';
      while (x !== x2 || y !== y2) { x += dx; y += dy; g[y][x] = '#'; }
    }
  }
  for (const [ch, x, y] of deco) g[y][x] = ch;
  const sp = spawns || paths.map((p) => p[0]);
  for (const [x, y] of sp) g[y][x] = 'S';
  const b = base || paths[0][paths[0].length - 1];
  g[b[1]][b[0]] = 'B';
  if (kind === 'maze') for (const row of g) for (let x = 0; x < COLS; x++) if (row[x] === '#') row[x] = '.';
  return g.map((r) => r.join(''));
}

const R = (x, y) => ['r', x, y];
const O = (x, y) => ['o', x, y];
const W = (x, y) => ['w', x, y];

// roster: wave number (0-based) at which each enemy type first shows up on this map.
// bosses: { waveIndex: type }.
const DEFS = [
  {
    id: 'outpost', name: 'Outpost Road', waves: 10, funds: 220,
    paths: [[[5, 0], [5, 2], [2, 2], [2, 6], [8, 6], [8, 10], [5, 10], [5, 14]]],
    deco: [O(0, 0), O(10, 13), R(10, 1), O(0, 12), R(6, 13)],
    roster: { rifle: 0, raider: 3 },
    brief: 'Red raiders are probing our outpost. Build guns along the road and hold.',
    tip: 'Towers fire at anything in their circle. Corners of the road are the best spots.',
  },
  {
    id: 'creek', name: 'Dry Creek', waves: 12, funds: 220, power: 1.15,
    paths: [[[1, 0], [1, 4], [9, 4], [9, 7], [1, 7], [1, 11], [9, 11], [9, 14]]],
    deco: [O(10, 0), R(5, 2), O(0, 14), R(4, 13), W(5, 9), W(6, 9)],
    roster: { rifle: 0, raider: 2, tank: 5 },
    brief: 'Tanks are coming. Their armour shrugs off small bullets.',
    tip: 'Cannons hurt tanks and hit whole groups. Upgrade your best towers.',
  },
  {
    id: 'twin', name: 'Twin Dunes', waves: 12, funds: 240, power: 1.15, merges: 1,
    paths: [[[1, 0], [1, 5], [5, 5]], [[9, 0], [9, 5], [5, 5], [5, 9], [2, 9], [2, 12], [5, 12], [5, 14]]],
    base: [5, 14],
    deco: [O(5, 1), R(4, 2), R(6, 2), O(9, 13), R(8, 9)],
    roster: { rifle: 0, raider: 1, drone: 4, tank: 7 },
    brief: 'Two columns, and drones in the sky. Drones fly straight at the base.',
    tip: 'Only Machine Guns, Anti-Air, Tar and Snipers can hit flyers.',
  },
  {
    id: 'flats', name: 'Open Flats', kind: 'maze', waves: 12, funds: 260,
    spawns: [[5, 0]], base: [5, 14],
    deco: [R(0, 7), R(10, 7), R(1, 7), R(9, 7)],
    roster: { rifle: 0, raider: 2, tank: 4, drone: 8 },
    brief: 'No roads here: the enemy walks straight at you, and your towers make the walls.',
    tip: 'Build a winding wall so they walk past your guns longer. You can never fully block the way.',
  },
  {
    id: 'shieldwall', name: 'Shield Wall', waves: 14, funds: 240, power: 1.25,
    paths: [[[9, 0], [9, 3], [1, 3], [1, 6], [6, 6], [6, 9], [2, 9], [2, 12], [8, 12], [8, 14]]],
    deco: [O(0, 0), R(4, 1), O(10, 10), R(4, 14), W(9, 8), W(10, 8)],
    roster: { rifle: 0, raider: 2, shield: 3, tank: 6, drone: 9 },
    brief: 'Shield troopers. Their blue shield soaks damage, then recharges.',
    tip: 'Keep shields busy with steady fire, then finish them before they recover.',
  },
  {
    id: 'hospital', name: 'Field Hospital', waves: 14, funds: 250, power: 1.25,
    paths: [[[3, 0], [3, 4], [7, 4], [7, 1], [9, 1], [9, 8], [4, 8], [4, 11], [1, 11], [1, 13], [6, 13], [6, 14]]],
    deco: [O(0, 2), R(5, 2), O(10, 12), R(8, 13), O(0, 7)],
    roster: { rifle: 0, raider: 1, medic: 3, shield: 5, tank: 7, drone: 9 },
    brief: 'Medic trucks repair the units around them.',
    tip: 'Snipers aim for the strongest. Set a tower to Strong to pick off medics first.',
  },
  {
    id: 'behemoth', name: 'Behemoth Pass', waves: 15, funds: 280, power: 1.25,
    paths: [[[5, 0], [5, 1], [1, 1], [1, 13], [4, 13], [4, 4], [7, 4], [7, 13], [9, 13], [9, 14]]],
    deco: [O(9, 0), R(10, 5), O(10, 9), R(2, 0), O(3, 14)],
    roster: { rifle: 0, raider: 1, tank: 2, drone: 5, shield: 6, medic: 8, heavy: 11 },
    bosses: { 14: 'behemoth' },
    brief: 'Scouts report a Behemoth, a rolling fortress, at the end of this push.',
    tip: 'Bosses cost 10 lives if they get through. Save up and upgrade before the last wave.',
  },
  {
    id: 'labyrinth', name: 'The Labyrinth', kind: 'maze', waves: 15, funds: 340, power: 0.9,
    spawns: [[5, 0]], base: [5, 14],
    deco: [R(0, 4), R(1, 4), R(2, 4), R(8, 4), R(9, 4), R(10, 4), R(3, 9), R(4, 9), R(6, 9), R(7, 9), O(0, 13), O(10, 13)],
    roster: { rifle: 0, raider: 1, tank: 3, shield: 5, drone: 7, medic: 9, heavy: 12 },
    brief: 'Rock walls and open sand. Shape the maze around them.',
    tip: 'The dotted line shows the route enemies will take. Watch it change as you build.',
  },
  {
    id: 'hairpins', name: 'Hairpins', waves: 15, funds: 260,
    paths: [[[1, 0], [1, 12], [3, 12], [3, 2], [5, 2], [5, 12], [7, 12], [7, 2], [9, 2], [9, 14]]],
    deco: [O(0, 14), O(10, 0), R(4, 14), R(8, 14)],
    roster: { rifle: 0, raider: 0, tank: 2, drone: 4, shield: 5, medic: 7, heavy: 9 },
    power: 1.25,
    brief: 'A long winding road. Big waves are coming, so make every tower count.',
    tip: 'A tower between two roads covers both. Artillery reaches almost anywhere.',
  },
  {
    id: 'skyraid', name: 'Sky Raid', waves: 15, funds: 280,
    paths: [[[9, 0], [9, 5], [2, 5], [2, 10], [8, 10], [8, 14]]],
    deco: [W(4, 1), W(5, 1), W(4, 2), W(5, 2), O(0, 13), R(10, 12), O(6, 7)],
    roster: { drone: 0, rifle: 0, raider: 2, shield: 4, tank: 6, medic: 8 },
    bosses: { 14: 'gunship' },
    airHeavy: true,
    brief: 'The sky is full of drones, and a Gunship leads them.',
    tip: 'Anti-Air towers only hit flyers, but they hit hard. Put them near the base.',
  },
  {
    id: 'canyon', name: 'Split Canyon', waves: 16, funds: 300, merges: 1,
    paths: [[[1, 0], [1, 9], [4, 9], [4, 12], [5, 12]], [[9, 0], [9, 6], [6, 6], [6, 12], [5, 12], [5, 14]]],
    base: [5, 14],
    deco: [O(5, 0), R(5, 4), R(3, 6), R(8, 10), O(0, 14), O(10, 14)],
    roster: { rifle: 0, raider: 1, tank: 2, shield: 4, drone: 6, medic: 8, heavy: 10 },
    bosses: { 15: 'behemoth' },
    brief: 'Two canyons, one base. Split your defence, or hold the meeting point.',
    tip: 'Towers at the junction cover both columns.',
  },
  {
    id: 'stormmaze', name: 'Sandstorm Maze', kind: 'maze', waves: 16, funds: 420, power: 0.75,
    spawns: [[2, 0], [8, 0]], base: [5, 14],
    deco: [R(5, 0), R(5, 1), R(5, 2), R(0, 10), R(1, 10), R(9, 10), R(10, 10), O(0, 0), O(10, 0)],
    roster: { rifle: 0, raider: 1, tank: 3, drone: 5, shield: 6, medic: 8, heavy: 10 },
    bosses: { 15: 'gunship' },
    brief: 'Two gates and open sand. Build a maze that serves both.',
    tip: 'Flyers ignore your maze. Keep some Anti-Air near the base.',
  },
  {
    id: 'ironcolumn', name: 'Iron Column', waves: 18, funds: 320,
    paths: [[[5, 0], [5, 3], [9, 3], [9, 7], [1, 7], [1, 11], [6, 11], [6, 14]]],
    deco: [O(0, 0), R(2, 2), R(8, 1), O(10, 13), R(9, 12), W(4, 9), W(5, 9)],
    roster: { rifle: 0, tank: 1, raider: 2, heavy: 4, shield: 6, medic: 7, drone: 9 },
    bosses: { 17: 'behemoth' },
    armorHeavy: true,
    brief: 'An armoured column. Bullets will not stop it.',
    tip: 'AP Rounds and Marksman ignore armour. Cannons are good too.',
  },
  {
    id: 'longmarch', name: 'Long March', waves: 20, funds: 340, power: 1.1,
    paths: [[[10, 0], [10, 2], [1, 2], [1, 5], [9, 5], [9, 8], [1, 8], [1, 11], [9, 11], [9, 13], [5, 13], [5, 14]]],
    deco: [O(0, 0), R(5, 0), O(4, 14), R(10, 7), O(10, 14)],
    roster: { rifle: 0, raider: 1, tank: 2, drone: 3, shield: 5, medic: 6, heavy: 8 },
    bosses: { 9: 'gunship', 19: 'behemoth' },
    brief: 'Twenty waves and both bosses. This is the big one before their den.',
    tip: 'Depots pay every wave. Build them early, not late.',
  },
  {
    id: 'den', name: "Scorpion's Den", kind: 'maze', waves: 20, funds: 480, power: 0.7,
    spawns: [[1, 0], [5, 0], [9, 0]], base: [5, 14],
    deco: [R(3, 0), R(7, 0), R(0, 6), R(10, 6), R(4, 11), R(6, 11), O(0, 14), O(10, 14)],
    roster: { rifle: 0, raider: 1, tank: 2, drone: 3, shield: 4, medic: 6, heavy: 8 },
    bosses: { 9: 'behemoth', 14: 'gunship', 19: 'behemoth' },
    brief: 'Their home base. Three gates, every unit they have, and three bosses.',
    tip: 'Use everything: mazes, slows, snipers, artillery and your support powers.',
  },
];

export const CAMPAIGN = DEFS.map((d, i) => ({ kind: 'path', power: 1, ...d, tier: i, rows: buildRows(d) }));
export const mapById = (id) => CAMPAIGN.find((m) => m.id === id);

// ---------------------------------------------------------------- waves

const COST = { rifle: 1, raider: 1, tank: 3.5, drone: 1.6, shield: 1.8, medic: 2.5, heavy: 8 };
const GAP = { rifle: 0.9, raider: 0.7, tank: 1.8, drone: 1.2, shield: 1.1, medic: 2.2, heavy: 3, behemoth: 0, gunship: 0 };

/** Health multiplier for wave w (0-based) on a map of this tier. */
export function hpCurve(w, tier, total = Infinity) {
  let m = (1 + 0.11 * w + 0.006 * w * w) * (1 + 0.06 * tier);
  if (w >= total) m *= 1.07 ** (w - total + 1); // endless keeps getting tougher
  return m;
}

/**
 * The groups of wave w (0-based) for a map: [{ type, n, gap, delay, hp }].
 * mods: { hp, count, air } multipliers from hard mode, adaptive scaling or the daily modifiers.
 */
export function waveGroups(def, w, mods = {}) {
  const hpMul = (mods.hp || 1) * hpCurve(w, def.tier || 0, mods.endless ? def.waves : Infinity);
  const roster = Object.entries(def.roster).filter(([, at]) => at <= w).map(([t]) => t);
  const budget = (8 + 2.2 * w) * (1 + 0.05 * (def.tier || 0)) * (def.power || 1) * (mods.count || 1);
  const groups = [];
  let delay = 0;
  const add = (type, share) => {
    const n = Math.max(1, Math.min(40, Math.round((budget * share) / COST[type])));
    groups.push({ type, n, gap: GAP[type], delay, hp: Math.round(ENEMIES[type].hp * hpMul) });
    delay += n * GAP[type] + 2;
  };
  let boss = def.bosses?.[w];
  if (!boss && mods.endless && w >= def.waves && (w + 1) % 10 === 0) boss = (w / 10) % 2 < 1 ? 'behemoth' : 'gunship';
  if (boss) {
    add(roster[(w + 1) % roster.length], 0.5);
    groups.push({ type: boss, n: 1, gap: 0, delay, hp: Math.round(ENEMIES[boss].hp * hpMul * (boss === 'gunship' ? 0.42 : 0.55)) });
    delay += 3;
    add(roster[(w + 2) % roster.length], 0.35);
    return groups;
  }
  const fresh = Object.entries(def.roster).find(([, at]) => at === w && w > 0);
  let a; let b;
  if (fresh) { a = fresh[0]; b = 'rifle' in def.roster ? 'rifle' : roster[0]; } else {
    a = roster[(w * 3) % roster.length];
    b = roster[(w * 7 + 3) % roster.length];
  }
  // Air-themed maps keep drones coming; armour maps keep tanks coming.
  if (def.airHeavy && w % 2 === 1) b = 'drone';
  if (def.armorHeavy && w % 2 === 0 && roster.includes('tank')) b = 'tank';
  if (mods.air && roster.length > 1 && w % 2 === 0) b = 'drone';
  if (a === b) add(a, 1); else { add(a, 0.6); add(b, 0.4); }
  return groups;
}

/** Short text for the "next wave" preview, e.g. "8 Rifleman, 3 Tank". */
export function waveSummary(groups) {
  const n = {};
  for (const g of groups) n[g.type] = (n[g.type] || 0) + g.n;
  return Object.entries(n).map(([t, k]) => `${k} ${ENEMIES[t].name}`).join(', ');
}

// ---------------------------------------------------------------- daily map

export const DAILY_MODS = [
  { id: 'fast', name: 'Haste', desc: 'Enemies move 20% faster.' },
  { id: 'armor', name: 'Plated', desc: 'Every enemy has +2 armour.' },
  { id: 'air', name: 'Air Raid', desc: 'Extra drones in every other wave.' },
  { id: 'rich', name: 'War Chest', desc: '+150 starting funds.' },
  { id: 'poor', name: 'Lean Times', desc: 'Kills pay 25% less.' },
  { id: 'pricey', name: 'Tariffs', desc: 'Towers cost 15% more.' },
  { id: 'horde', name: 'Horde', desc: '30% more enemies, each a bit weaker.' },
  { id: 'fragile', name: 'Glass Base', desc: 'Only 10 lives.' },
];

/** The daily challenge: a map made from the day's seed plus two modifiers. */
export function dailyMap(seed) {
  const rng = makeRng(seed);
  const maze = rng.next() < 0.4;
  let def;
  if (maze) {
    const spawns = rng.next() < 0.5 ? [[5, 0]] : [[2, 0], [8, 0]];
    const deco = [];
    for (let k = 0; k < 14; k++) {
      const x = rng.int(COLS); const y = 2 + rng.int(ROWS - 4);
      if (y === ROWS - 1) continue;
      deco.push(['r', x, y]);
    }
    def = { kind: 'maze', spawns, base: [5, 14], deco };
    // Rocks must never cut the gates off from the base: drop any that do.
    for (;;) {
      const rows = buildRows(def);
      if (mazeOpen(rows)) break;
      def.deco.pop();
    }
  } else {
    def = { kind: 'path', paths: [randomPath(rng)], deco: [] };
    const rows = buildRows(def);
    for (let k = 0; k < 6; k++) {
      const x = rng.int(COLS); const y = rng.int(ROWS);
      if (rows[y][x] === '.') def.deco.push([rng.next() < 0.5 ? 'r' : 'o', x, y]);
    }
  }
  const mods = [];
  const pool = DAILY_MODS.map((m) => m.id);
  while (mods.length < 2) {
    const m = pool[rng.int(pool.length)];
    if (mods.includes(m) || (m === 'rich' && mods.includes('poor')) || (m === 'poor' && mods.includes('rich'))) continue;
    mods.push(m);
  }
  return {
    id: 'daily', name: 'Daily Siege', waves: 15, funds: 300 + (mods.includes('rich') ? 150 : 0), tier: 6,
    roster: { rifle: 0, raider: 1, tank: 2, drone: 3, shield: 4, medic: 6, heavy: 9 },
    bosses: { 14: rng.next() < 0.5 ? 'behemoth' : 'gunship' },
    ...def, rows: buildRows(def), mods,
  };
}

function mazeOpen(rows) {
  const seen = new Set();
  const q = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (rows[y][x] === 'B') { q.push([x, y]); seen.add(`${x},${y}`); }
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || seen.has(`${nx},${ny}`)) continue;
      if (!'.S'.includes(rows[ny][nx])) continue;
      seen.add(`${nx},${ny}`); q.push([nx, ny]);
    }
  }
  for (let x = 0; x < COLS; x++) if (rows[0][x] === 'S' && !seen.has(`${x},0`)) return false;
  return true;
}

/** A winding road from the top to the bottom: horizontal runs every 3 rows, never touching itself. */
function randomPath(rng) {
  let x = 1 + rng.int(COLS - 2);
  const pts = [[x, 0]];
  let y = 0;
  while (y < ROWS - 4) {
    y += 2 + rng.int(2);
    if (y > ROWS - 3) y = ROWS - 3;
    pts.push([x, y]);
    let nx;
    do { nx = 1 + rng.int(COLS - 2); } while (Math.abs(nx - x) < 3);
    x = nx;
    pts.push([x, y]);
  }
  pts.push([x, ROWS - 1]);
  return pts;
}

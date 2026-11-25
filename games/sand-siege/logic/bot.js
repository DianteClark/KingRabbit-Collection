// A simple computer player used by the tests to prove every map can be won. It only uses the same
// actions a player has (build, upgrade, call waves) and peeks at the next waves like the preview does.
import { TOWERS, towerStats } from './data.js';
import { COLS, ROWS } from './maps.js';
import * as S from './sim.js';

const VALUE = { mg: 1, cannon: 1.6, aa: 1, slow: 0, sniper: 0.9, arty: 1.5, bank: 0 };

function dps(type, level, branch) {
  const st = towerStats(type, level, branch);
  if (!st.dmg || st.pulse) return 0;
  return (st.dmg * (st.shots || 1)) / st.rate * VALUE[type];
}

/** Cells a ground unit visits, following a distance field. */
function followRoute(dist, sx, sy) {
  const out = [];
  let x = sx; let y = sy;
  for (let g = 0; g < COLS * ROWS && dist[y * COLS + x] > 0; g++) {
    out.push([x, y]);
    const here = dist[y * COLS + x];
    let moved = false;
    for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1]]) {
      const nx = x + dx; const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      if (dist[ny * COLS + nx] === here - 1) { x = nx; y = ny; moved = true; break; }
    }
    if (!moved) break;
  }
  out.push([x, y]);
  return out;
}

function airLine(s) {
  const [bx, by] = S.baseCell(s);
  const pts = [];
  for (const [sx] of S.spawns(s)) {
    for (let k = 0; k <= 30; k++) pts.push([sx + 0.5 + (bx - sx) * (k / 30), -0.5 + (by + 1) * (k / 30)]);
  }
  return pts;
}

function cover(cells, x, y, range, minRange = 0) {
  let n = 0;
  for (const [cx, cy] of cells) {
    const d = Math.hypot(cx + 0.5 - (x + 0.5), cy + 0.5 - (y + 0.5));
    if (d <= range && d >= minRange) n++;
  }
  return n;
}
function coverPts(pts, x, y, range) {
  let n = 0;
  for (const [px, py] of pts) if (Math.hypot(px - x - 0.5, py - y - 0.5) <= range) n++;
  return n;
}

/**
 * Make a bot. opts.early: call waves early when the defence looks comfortable.
 * Returns tick(s), to call before every step.
 */
export function makeBot({ early = false, think = 0.5, mix } = {}) {
  let next = 0;
  const plan = mix || ['mg', 'cannon', 'mg', 'slow', 'sniper', 'cannon', 'arty', 'mg', 'cannon', 'sniper', 'arty'];
  let built = 0;
  return function tick(s) {
    if (s.t < next) return;
    next = s.t + think;
    // Air in the next two waves and nothing much that hits it: build Anti-Air.
    const upcoming = [s.wave, s.wave + 1].flatMap((w) => (S.moreWaves(s) || !s.totalWaves ? S.groupsFor(s, w) : []));
    const airHp = upcoming.filter((g) => g.type === 'drone' || g.type === 'gunship').reduce((a, g) => a + g.n * g.hp, 0);
    const airPower = s.towers.filter((t) => TOWERS[t.type].air && t.type !== 'slow').reduce((a, t) => a + dps(t.type, t.level, t.branch) * (t.type === 'aa' ? 1.5 : 0.6), 0);
    const needAir = airHp > 0 && airPower * 25 < airHp;

    const options = [];
    const maze = s.kind === 'maze';
    const routeCells = [];
    for (const sp of S.spawns(s)) routeCells.push(...S.route(s, sp));
    const air = airLine(s);
    const typeWanted = needAir ? 'aa' : plan[built % plan.length];
    const cost = S.towerCost(s, typeWanted);
    if (s.funds >= cost) {
      const st = towerStats(typeWanted, 0);
      let best = null;
      // On maze maps, follow a serpentine wall plan: rows of towers with a gap at alternating ends.
      const cands = [];
      if (maze && s.towers.length >= 4) {
        for (const [x, y] of mazePlan(s)) { if (S.canPlace(s, x, y).ok) cands.push([x, y]); if (cands.length >= 6) break; }
      }
      if (!cands.length) for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) cands.push([x, y]);
      for (const [x, y] of cands) {
        {
          if (!S.canPlace(s, x, y).ok) continue;
          let cells = routeCells; let gain = 0;
          if (maze) {
            const d = previewDist(s, x, y);
            cells = [];
            let len = 0;
            for (const [sx, sy] of S.spawns(s)) { const r = followRoute(d, sx, sy); cells.push(...r); len = Math.max(len, r.length); }
            gain = len - S.longestRoute(s);
          }
          let v = (st.ground ? cover(cells, x, y, st.range, st.minRange) : 0) + (st.air ? coverPts(air, x, y, st.range) * (typeWanted === 'aa' ? 1 : 0.3) : 0);
          if (typeWanted === 'slow') v = cover(cells, x, y, st.range);
          v += gain * 1.5;
          if (!best || v > best.v) best = { x, y, v };
        }
      }
      if (best && best.v > 0) options.push({ kind: 'build', type: typeWanted, x: best.x, y: best.y, score: 1.15 });
    }
    // Upgrades: best damage gained per fund.
    for (const t of s.towers) {
      if (t.level >= 3 || TOWERS[t.type].money) continue;
      const br = t.type === 'mg' ? 1 : t.type === 'slow' ? 0 : t.type === 'sniper' ? 0 : t.type === 'aa' ? 0 : 0;
      const price = S.upgradePrice(s, t, br);
      if (price == null || s.funds < price) continue;
      const gainD = dps(t.type, t.level + 1, t.level + 1 === 3 ? br : null) - dps(t.type, t.level, t.branch);
      const base = dps(t.type, 0, null) / TOWERS[t.type].cost;
      const ratio = base > 0 ? (gainD / price) / base : 0.8;
      if (needAir && t.type !== 'aa' && t.type !== 'mg') continue;
      options.push({ kind: 'up', id: t.id, br, score: ratio });
    }
    options.sort((a, b) => b.score - a.score);
    const o = options[0];
    if (!o && s.wave === 0) { S.callWave(s); return; }
    if (o) {
      if (o.kind === 'build') { if (S.build(s, o.type, o.x, o.y).ok && o.type === typeWanted && !needAir) built++; } else S.upgrade(s, o.id, o.br);
    }
    if (early && S.canCall(s) && s.enemies.length === 0 && s.lives >= s.maxLives - 1 && s.wave > 2) S.callWave(s);
  };
}

/** Wall cells for a serpentine maze, nearest the base first. */
export function mazePlan(s) {
  const out = [];
  const walls = [11, 8, 5, 2];
  walls.forEach((y, k) => {
    const gapLeft = k % 2 === 1;
    const xs = [];
    for (let x = 0; x < COLS; x++) if (gapLeft ? x > 0 : x < COLS - 1) xs.push(x);
    // Start from the middle so each new tower is close to the route.
    xs.sort((a, b) => Math.abs(a - 5) - Math.abs(b - 5));
    for (const x of xs) if (s.rows[y][x] === '.') out.push([x, y]);
  });
  return out;
}

/** Distance field as if a tower stood on (x, y). */
function previewDist(s, x, y) {
  const d = new Int16Array(COLS * ROWS).fill(-1);
  const q = [];
  const blocked = new Set(s.towers.map((t) => t.y * COLS + t.x));
  blocked.add(y * COLS + x);
  for (let yy = 0; yy < ROWS; yy++) for (let xx = 0; xx < COLS; xx++) if (s.rows[yy][xx] === 'B') { d[yy * COLS + xx] = 0; q.push(xx, yy); }
  for (let h = 0; h < q.length; h += 2) {
    const cx = q[h]; const cy = q[h + 1]; const k = d[cy * COLS + cx];
    for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1]]) {
      const nx = cx + dx; const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const i = ny * COLS + nx;
      if (d[i] >= 0 || blocked.has(i) || !'.SB'.includes(s.rows[ny][nx])) continue;
      d[i] = k + 1; q.push(nx, ny);
    }
  }
  return d;
}

/** Play a whole game with the bot. Returns the final state. */
export function playOut(s, opts = {}) {
  const tick = makeBot(opts);
  S.runUntilOver(s, { maxT: opts.maxT || 4000, onTick: tick });
  return s;
}

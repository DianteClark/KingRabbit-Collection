// Sea Battle (classic Battleship rules): 10x10 grids, fleet of Carrier 5, Battleship 4, Cruiser 3,
// Submarine 3, Destroyer 2. Ships lie straight, may touch but never overlap. Take turns calling
// one shot; announce hits, misses and "you sank my ___". Sink the whole fleet to win.

export const N = 10;
export const FLEET = [5, 4, 3, 3, 2];
export const NAMES = ['Carrier', 'Battleship', 'Cruiser', 'Submarine', 'Destroyer'];

export function shipCells(bow, len, horizontal) {
  const r = Math.floor(bow / N); const c = bow % N;
  if (horizontal ? c + len > N : r + len > N) return null;
  return Array.from({ length: len }, (_, k) => (horizontal ? bow + k : bow + k * N));
}

/** Can ship k of fleet move to these cells without overlapping the others? */
export function fits(fleet, k, cells) {
  if (!cells) return false;
  const taken = new Set(fleet.flatMap((s, j) => (j === k ? [] : s.cells)));
  return cells.every((c) => !taken.has(c));
}

/** Random fleet: [{ name, cells: [i...], horizontal, hits: 0 }] */
export function randomFleet(rng = Math.random) {
  const ships = [];
  FLEET.forEach((len, k) => {
    for (;;) {
      const horizontal = rng() < 0.5;
      const cells = shipCells(Math.floor(rng() * N * N), len, horizontal);
      if (cells && fits(ships, -1, cells)) { ships.push({ name: NAMES[k], cells, horizontal, hits: 0 }); return; }
    }
  });
  return ships;
}

/** Fire at cell. shots: Map cell -> 'hit'|'miss'. Returns { result: 'miss'|'hit'|'sunk', ship } */
export function fire(fleet, shots, cell) {
  const ship = fleet.find((s) => s.cells.includes(cell));
  if (!ship) { shots.set(cell, 'miss'); return { result: 'miss' }; }
  shots.set(cell, 'hit');
  ship.hits++;
  return { result: ship.hits === ship.cells.length ? 'sunk' : 'hit', ship };
}

export const allSunk = (fleet) => fleet.every((s) => s.hits === s.cells.length);

/**
 * CPU targeting: chase unsunk hits along their line; otherwise hunt on a checkerboard
 * pattern, preferring cells where the longest remaining ship could fit.
 * `sunkCells` are cells of ships already sunk (their hits are no longer chased).
 */
// follow: chance of chasing a hit properly; checker / density: chance of a smart hunt shot.
export const LEVELS = {
  easy: { follow: 0.5, checker: 0, density: 0 },
  normal: { follow: 1, checker: 1, density: 0 },
  hard: { follow: 1, checker: 0, density: 1 },
};

export function cpuTarget(shots, sunkCells, remaining, rng = Math.random, level = 'hard', cfg = LEVELS[level]) {
  const free = (i) => i >= 0 && i < N * N && !shots.has(i);
  const openHits = [...shots].filter(([i, v]) => v === 'hit' && !sunkCells.has(i)).map(([i]) => i);
  const unshot = [];
  for (let i = 0; i < N * N; i++) if (!shots.has(i)) unshot.push(i);
  // Easy: random shots; only follows up on a hit half the time and never reads a ship's direction.
  if (rng() > cfg.follow || (!openHits.length && rng() > cfg.checker + cfg.density)) {
    if (openHits.length && rng() < 0.5) {
      const h = openHits[Math.floor(rng() * openHits.length)];
      const around = [h - N, h + N, h % N > 0 ? h - 1 : -1, h % N < N - 1 ? h + 1 : -1].filter(free);
      if (around.length) return around[Math.floor(rng() * around.length)];
    }
    return unshot[Math.floor(rng() * unshot.length)];
  }
  if (openHits.length && cfg.density && rng() < cfg.density) {
    // Hard: of all the ways the remaining ships could lie over the unsunk hits, which free square
    // is covered most often?
    const hitSet = new Set(openHits);
    const scores = new Array(N * N).fill(0);
    for (const len of remaining) {
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        for (const horizontal of [true, false]) {
          if (horizontal ? c + len > N : r + len > N) continue;
          const cells = Array.from({ length: len }, (_, k) => (horizontal ? r * N + c + k : (r + k) * N + c));
          if (!cells.every((x) => free(x) || hitSet.has(x))) continue;
          const covered = cells.filter((x) => hitSet.has(x)).length;
          if (!covered) continue;
          for (const x of cells) if (free(x)) scores[x] += covered * covered;
        }
      }
    }
    let best = 0; let picks = [];
    for (let i = 0; i < N * N; i++) {
      if (scores[i] > best) { best = scores[i]; picks = [i]; } else if (best && scores[i] === best) picks.push(i);
    }
    if (picks.length) return picks[Math.floor(rng() * picks.length)];
  }
  if (openHits.length) {
    const cands = [];
    const hitSet = new Set(openHits);
    // Lines of 2+ touching hits show which way a ship lies: shoot at the open ends of those lines.
    for (const h of openHits) {
      for (const step of [1, N]) {
        const sameLine = (a, b) => step === N || Math.floor(a / N) === Math.floor(b / N);
        if (hitSet.has(h - step) && sameLine(h, h - step)) continue;          // not the start of a run
        let end = h;
        while (hitSet.has(end + step) && sameLine(end, end + step)) end += step;
        if (end === h) continue;                                                // single hit
        const before = h - step; const after = end + step;
        if (free(before) && sameLine(h, before)) cands.push(before);
        if (free(after) && sameLine(end, after)) cands.push(after);
      }
    }
    if (!cands.length) {
      for (const h of openHits) {
        const r = Math.floor(h / N); const c = h % N;
        if (r > 0 && free(h - N)) cands.push(h - N);
        if (r < N - 1 && free(h + N)) cands.push(h + N);
        if (c > 0 && free(h - 1)) cands.push(h - 1);
        if (c < N - 1 && free(h + 1)) cands.push(h + 1);
      }
    }
    if (cands.length) return cands[Math.floor(rng() * cands.length)];
  }
  // Normal: hunt on a checkerboard pattern (every ship must cover one of these squares).
  if (rng() * (cfg.checker + cfg.density) < cfg.checker) {
    const checker = unshot.filter((i) => (Math.floor(i / N) + (i % N)) % 2 === 0);
    const pool = checker.length ? checker : unshot;
    return pool[Math.floor(rng() * pool.length)];
  }
  // Hard hunt: score each free cell by how many placements of the remaining ships cover it.
  const longest = Math.max(...remaining, 2);
  const scores = new Array(N * N).fill(0);
  for (const len of remaining) {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      for (const horizontal of [true, false]) {
        const cells = [];
        for (let k = 0; k < len; k++) {
          const rr = horizontal ? r : r + k; const cc = horizontal ? c + k : c;
          if (rr >= N || cc >= N) { cells.length = 0; break; }
          cells.push(rr * N + cc);
        }
        if (cells.length === len && cells.every(free)) for (const x of cells) scores[x]++;
      }
    }
  }
  let best = -1; let picks = [];
  for (let i = 0; i < N * N; i++) {
    if (!free(i)) continue;
    const parity = (Math.floor(i / N) + (i % N)) % Math.min(longest, 2) === 0 ? 1.2 : 1;
    const v = scores[i] * parity;
    if (v > best) { best = v; picks = [i]; } else if (v === best) picks.push(i);
  }
  if (!picks.length) {
    for (let i = 0; i < N * N; i++) if (!shots.has(i)) picks.push(i);
  }
  return picks[Math.floor(rng() * picks.length)];
}


// Sea Battle: 10x10 grids, fleet of 5, 4, 3, 3, 2. Ships may not touch, even diagonally.
// You and the CPU take turns firing; a hit doesn't give an extra shot.

export const N = 10;
export const FLEET = [5, 4, 3, 3, 2];

/** Random fleet: [{ cells: [i...], horizontal, hits: 0 }] */
export function randomFleet(rng = Math.random) {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const taken = new Set();
    const ships = [];
    let ok = true;
    for (const len of FLEET) {
      let placed = false;
      for (let t = 0; t < 200 && !placed; t++) {
        const horizontal = rng() < 0.5;
        const r = Math.floor(rng() * (horizontal ? N : N - len + 1));
        const c = Math.floor(rng() * (horizontal ? N - len + 1 : N));
        const cells = Array.from({ length: len }, (_, k) => (horizontal ? r * N + c + k : (r + k) * N + c));
        if (cells.some((x) => taken.has(x))) continue;
        ships.push({ cells, horizontal, hits: 0 });
        for (const x of cells) {
          const xr = Math.floor(x / N); const xc = x % N;
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            const rr = xr + dr; const cc = xc + dc;
            if (rr >= 0 && rr < N && cc >= 0 && cc < N) taken.add(rr * N + cc);
          }
        }
        placed = true;
      }
      if (!placed) { ok = false; break; }
    }
    if (ok) return ships;
  }
  throw new Error('could not place fleet');
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
 * `sunkCells` are cells of ships already sunk (their neighbours are known to be empty).
 */
export function cpuTarget(shots, sunkCells, remaining, rng = Math.random) {
  const free = (i) => i >= 0 && i < N * N && !shots.has(i) && !nearSunk(i, sunkCells);
  const openHits = [...shots].filter(([i, v]) => v === 'hit' && !sunkCells.has(i)).map(([i]) => i);
  if (openHits.length) {
    const cands = [];
    if (openHits.length >= 2) {
      const horizontal = Math.floor(openHits[0] / N) === Math.floor(openHits[1] / N);
      const line = openHits.sort((a, b) => a - b);
      const step = horizontal ? 1 : N;
      const before = line[0] - step; const after = line[line.length - 1] + step;
      if (free(before) && (!horizontal || Math.floor(before / N) === Math.floor(line[0] / N))) cands.push(before);
      if (free(after) && (!horizontal || Math.floor(after / N) === Math.floor(line[0] / N))) cands.push(after);
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
  // Hunt: score each free cell by how many placements of the remaining ships cover it.
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

function nearSunk(i, sunkCells) {
  const r = Math.floor(i / N); const c = i % N;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const rr = r + dr; const cc = c + dc;
    if (rr >= 0 && rr < N && cc >= 0 && cc < N && sunkCells.has(rr * N + cc)) return true;
  }
  return false;
}

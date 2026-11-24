// Sector maps: beacons in rows from the bottom (start) to the top (exit), linked to their
// neighbours. The Hegemony fleet sweeps up from the bottom a little with every jump.
import { int, next, pick, shuffle } from './rng.js';
import { SECTOR_COUNT } from './data.js';

export const FLEET_SPEED = { normal: 0.7, cruise: 0.55 };
export const FLEET_START = -0.6;

/**
 * Make a sector map. Beacons have x, y in 0..1 (y = 0 bottom), a row, links and a type:
 * start, exit, fight, event, store, empty, flagship.
 */
export function generateSector(rng, sector) {
  const final = sector >= SECTOR_COUNT;
  const rows = final ? 4 : 6;
  const beacons = [];
  const add = (row, x, type) => {
    const b = { id: beacons.length, row, x, y: row / (rows - 1), type, links: [], visited: false };
    beacons.push(b);
    return b;
  };
  add(0, 0.5 + (next(rng) - 0.5) * 0.3, 'start');
  for (let row = 1; row < rows - 1; row++) {
    const n = final ? 2 : int(rng, 2, 3);
    const xs = [];
    for (let k = 0; k < n; k++) xs.push((k + 0.5) / n + (next(rng) - 0.5) * (0.5 / n));
    for (const x of xs) add(row, Math.max(0.08, Math.min(0.92, x)), 'fight');
  }
  if (final) add(rows - 1, 0.5, 'flagship');
  else {
    // The exit, plus a side beacon on the top row.
    const ex = next(rng) < 0.5 ? 0.3 : 0.7;
    add(rows - 1, ex, 'exit');
    add(rows - 1, 1 - ex, 'fight');
  }
  // Small vertical jitter so rows don't look ruled.
  for (const b of beacons) if (b.type !== 'start' && b.type !== 'exit' && b.type !== 'flagship') b.y = Math.max(0.02, Math.min(0.98, b.y + (next(rng) - 0.5) * 0.06));

  const byRow = (r) => beacons.filter((b) => b.row === r);
  const link = (a, b) => { if (a !== b && !a.links.includes(b.id)) { a.links.push(b.id); b.links.push(a.id); } };
  for (let row = 0; row < rows - 1; row++) {
    const here = byRow(row); const up = byRow(row + 1);
    // Everyone above gets the nearest below; everyone below gets the nearest above.
    for (const u of up) link(u, here.reduce((a, b) => (Math.abs(b.x - u.x) < Math.abs(a.x - u.x) ? b : a)));
    for (const h of here) link(h, up.reduce((a, b) => (Math.abs(b.x - h.x) < Math.abs(a.x - h.x) ? b : a)));
    // A few extra diagonals.
    for (const h of here) for (const u of up) if (Math.abs(h.x - u.x) < 0.42 && next(rng) < 0.45) link(h, u);
    // Some sideways links within a row.
    const sorted = [...here].sort((a, b) => a.x - b.x);
    for (let k = 0; k + 1 < sorted.length; k++) if (row > 0 && next(rng) < 0.35) link(sorted[k], sorted[k + 1]);
  }
  const topRow = byRow(rows - 1);
  if (topRow.length > 1) link(topRow[0], topRow[1]);

  // Contents.
  const open = beacons.filter((b) => b.type === 'fight' && b.row > 0);
  shuffle(rng, open);
  const stores = final ? 1 : sector >= 3 && next(rng) < 0.5 ? 2 : 1;
  // Keep stores off the first row so there's something to see first.
  const storeSpots = open.filter((b) => b.row >= 2).slice(0, stores);
  for (const b of storeSpots) b.type = 'store';
  for (const b of open) {
    if (b.type !== 'fight') continue;
    const r = next(rng);
    b.type = final ? (r < 0.6 ? 'fight' : 'event') : r < 0.44 ? 'fight' : r < 0.86 ? 'event' : 'empty';
  }
  for (const b of beacons) if (b.type === 'store' || b.type === 'exit' || b.type === 'start' || b.type === 'flagship') b.known = true;
  return { sector, rows, beacons, final };
}

/** Beacons the fleet has swept over. */
export const overrun = (map, fleet, b) => b.row < fleet;

/** Shortest number of jumps between two beacons. */
export function distance(map, from, to) {
  const seen = new Map([[from, 0]]);
  const q = [from];
  while (q.length) {
    const x = q.shift();
    if (x === to) return seen.get(x);
    for (const y of map.beacons[x].links) if (!seen.has(y)) { seen.set(y, seen.get(x) + 1); q.push(y); }
  }
  return Infinity;
}

export const exitBeacon = (map) => map.beacons.find((b) => b.type === 'exit' || b.type === 'flagship');

export { pick };

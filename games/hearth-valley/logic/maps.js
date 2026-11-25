// The three outdoor maps of Hearth Valley (farm, town, woods) and the generated mine floors.
// Tiles: '.' grass, ',' grass (other look), '=' path, '#' plaza, '~' water, 'T' woods (solid),
// 'X' cliff (solid), ':' mine floor, '|' fence (solid), '-' fence (solid), 's' sand.
// Buildings sit on top of the tiles and block their footprint; their door is the bottom middle.

function grid(w, h, fill = '.') { return Array.from({ length: h }, () => Array(w).fill(fill)); }
function rect(g, x, y, w, h, ch) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j] && i >= 0 && i < g[j].length) g[j][i] = ch; }
function border(g, ch = 'T') {
  const h = g.length; const w = g[0].length;
  rect(g, 0, 0, w, 1, ch); rect(g, 0, h - 1, w, 1, ch); rect(g, 0, 0, 1, h, ch); rect(g, w - 1, 0, 1, h, ch);
}
const rows = (g) => g.map((r) => r.join(''));

// ---------------------------------------------------------------- farm (24 x 28)
function farm() {
  const g = grid(24, 28);
  border(g);
  rect(g, 11, 0, 2, 8, '=');        // road north to the woods
  rect(g, 4, 6, 7, 1, '=');          // from the front door
  rect(g, 4, 7, 20, 1, '=');         // road east to town
  rect(g, 13, 19, 1, 8, '|');        // pen fence with a gate
  rect(g, 13, 21, 1, 2, '.');
  rect(g, 1, 27, 22, 1, 'T');
  rect(g, 16, 20, 6, 5, '~');        // pond
  rect(g, 17, 25, 4, 1, '~');
  return {
    id: 'farm', name: 'Hearth Farm', tiles: rows(g), outdoor: true, farm: true, music: 'farm',
    buildings: [
      { id: 'house', kind: 'house', look: 'house_red', x: 2, y: 2, w: 5, h: 4, name: 'Your House' },
      { id: 'coop', kind: 'coop', look: 'house_purple', x: 1, y: 19, w: 5, h: 4, name: 'Coop' },
      { id: 'barn', kind: 'barn', look: 'house_green', x: 7, y: 19, w: 5, h: 4, name: 'Barn' },
    ],
    fixtures: [
      { id: 'mailbox', x: 7, y: 5 },
      { id: 'bin', x: 9, y: 5 },
      { id: 'trough_coop', x: 1, y: 23, home: 'coop' },
      { id: 'trough_barn', x: 12, y: 23, home: 'barn' },
    ],
    pens: { coop: [1, 23, 5, 4], barn: [7, 23, 6, 4] },
    fishing: 'pond',
    till: [1, 8, 22, 11],          // area where debris starts (x, y, w, h)
  };
}

// ---------------------------------------------------------------- town (26 x 24)
function town() {
  const g = grid(26, 24);
  border(g);
  rect(g, 0, 7, 25, 2, '=');         // main street, west exit to the farm
  rect(g, 1, 5, 24, 1, '=');         // in front of the shops
  rect(g, 4, 6, 1, 1, '='); rect(g, 12, 6, 1, 1, '='); rect(g, 20, 6, 1, 1, '=');
  rect(g, 8, 9, 10, 6, '#');         // the square
  rect(g, 1, 15, 24, 1, '=');
  rect(g, 4, 9, 1, 2, '='); rect(g, 20, 9, 1, 2, '=');
  rect(g, 1, 19, 24, 2, '~');        // river
  rect(g, 1, 21, 24, 2, 's');
  for (const [x, y] of [[1, 10], [1, 12], [24, 10], [24, 12], [7, 17], [17, 17], [23, 17]]) g[y][x] = 'T';
  return {
    id: 'town', name: 'Emberbrook', tiles: rows(g), outdoor: true, music: 'town',
    buildings: [
      { id: 'market', kind: 'shop', shop: 'market', look: 'house_red', x: 2, y: 1, w: 5, h: 4, name: "Tess's Market" },
      { id: 'hall', kind: 'hall', look: 'hall', x: 9, y: 1, w: 7, h: 4, name: 'Town Hall' },
      { id: 'forge', kind: 'shop', shop: 'forge', look: 'house_purple', x: 18, y: 1, w: 5, h: 4, name: "Bram's Forge" },
      { id: 'ranch', kind: 'shop', shop: 'ranch', look: 'house_green', x: 2, y: 10, w: 5, h: 4, name: "Wren's Ranch" },
      { id: 'cottage', kind: 'cottage', look: 'house_blue', x: 18, y: 10, w: 5, h: 4, name: 'Riverside Cottage' },
    ],
    fixtures: [{ id: 'board', x: 14, y: 5 }],
    fishing: 'river',
  };
}

// ---------------------------------------------------------------- woods (22 x 24)
function woods() {
  const g = grid(22, 24);
  border(g);
  rect(g, 1, 1, 20, 2, 'X');         // cliff with the mine entrance
  rect(g, 10, 3, 2, 21, '=');        // trail south to the farm
  rect(g, 12, 8, 7, 5, '~');         // lake
  rect(g, 13, 13, 5, 1, '~');
  for (const [x, y, w, h] of [[1, 3, 3, 3], [18, 3, 3, 4], [1, 17, 2, 6], [19, 16, 2, 7], [5, 20, 3, 3], [14, 19, 3, 2]]) rect(g, x, y, w, h, 'T');
  return {
    id: 'woods', name: 'Whisperwood', tiles: rows(g), outdoor: true, music: 'woods',
    buildings: [],
    fixtures: [{ id: 'cave', x: 10, y: 2 }],
    fishing: 'lake',
  };
}

export const MAPS = { farm: farm(), town: town(), woods: woods() };

/** Where you arrive when you walk off the edge of a map (null = blocked). */
export function exitFrom(mapId, x, y) {
  if (mapId === 'farm') {
    if (y < 0 && (x === 11 || x === 12)) return { map: 'woods', x: x - 1, y: 22, face: 'up' };
    if (x > 23 && y === 7) return { map: 'town', x: 1, y: 7, face: 'right' };
  }
  if (mapId === 'town' && x < 0 && (y === 7 || y === 8)) return { map: 'farm', x: 22, y: 7, face: 'left' };
  if (mapId === 'woods' && y > 23 && (x === 10 || x === 11)) return { map: 'farm', x: x + 1, y: 1, face: 'down' };
  return null;
}

export const SOLID_TILES = new Set(['T', 'X', '~', '|', '-']);
export const FARM_HOME = { map: 'farm', x: 4, y: 6, face: 'down' }; // just outside the front door
export const MINE_EXIT = { map: 'woods', x: 10, y: 3, face: 'down' };

export function tileAt(map, x, y) {
  const r = map.tiles[y];
  return r ? r[x] : undefined;
}

export function buildingAt(map, x, y) {
  return (map.buildings || []).find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) || null;
}
export const doorOf = (b) => ({ x: b.x + Math.floor(b.w / 2), y: b.y + b.h - 1 });

// ---------------------------------------------------------------- mine floors
export const MINE_W = 11;
export const MINE_H = 13;
export const MINE_FLOORS = 20;
export const CHECKPOINTS = [1, 5, 10, 15, 20];

/**
 * A mine floor from a seed: { tiles, rocks: [{x,y,kind,hp}], slimes: [...], up: {x,y}, ladder: {x,y} hidden under a rock }.
 * kind: stone | copper | iron | gold | gem
 */
export function mineFloor(floor, rnd) {
  const g = grid(MINE_W, MINE_H, ':');
  border(g, 'X');
  // a few pillars
  const pillars = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < pillars; i++) {
    const x = 2 + Math.floor(rnd() * (MINE_W - 4)); const y = 3 + Math.floor(rnd() * (MINE_H - 5));
    g[y][x] = 'X';
  }
  const up = { x: 1 + Math.floor(rnd() * (MINE_W - 2)), y: 1 };
  g[up.y][up.x] = ':';
  const taken = new Set([`${up.x},${up.y}`, `${up.x},${up.y + 1}`]);
  const free = [];
  for (let y = 1; y < MINE_H - 1; y++) for (let x = 1; x < MINE_W - 1; x++) if (g[y][x] === ':' && !taken.has(`${x},${y}`)) free.push([x, y]);
  // shuffle
  for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [free[i], free[j]] = [free[j], free[i]]; }
  const rest = floor % 5 === 0;
  const nRocks = rest ? 10 : 16 + Math.floor(rnd() * 8);
  const rocks = [];
  for (let i = 0; i < nRocks && free.length; i++) {
    const [x, y] = free.pop();
    rocks.push({ x, y, kind: rockKind(floor, rnd) });
  }
  for (const r of rocks) r.hp = ROCK_HP[r.kind];
  const slimes = [];
  const nSlimes = rest ? 0 : Math.min(4, 1 + Math.floor(floor / 5) + (rnd() < 0.5 ? 1 : 0));
  for (let i = 0; i < nSlimes && free.length; i++) {
    const [x, y] = free.pop();
    if (Math.abs(x - up.x) + Math.abs(y - up.y) < 4) { free.unshift([x, y]); continue; }
    const kind = floor >= 14 ? 'red' : floor >= 7 ? (rnd() < 0.6 ? 'blue' : 'green') : 'green';
    slimes.push({ id: i, x, y, kind, hp: SLIME[kind].hp });
  }
  // the ladder down hides under one of the rocks (not on the bottom floor)
  const ladderRock = floor < MINE_FLOORS && rocks.length ? rocks[Math.floor(rnd() * rocks.length)] : null;
  const chest = (floor === 10 || floor === 20) && free.length ? (() => { const [x, y] = free.pop(); return { x, y }; })() : null;
  return { floor, tiles: rows(g), rocks, slimes, up, ladder: ladderRock ? { x: ladderRock.x, y: ladderRock.y } : null, chest };
}

export const ROCK_HP = { stone: 1, copper: 2, iron: 3, gold: 4, gem: 3 };
export const SLIME = {
  green: { hp: 3, dmg: 5 },
  blue: { hp: 6, dmg: 8 },
  red: { hp: 9, dmg: 12 },
};

function rockKind(floor, rnd) {
  const r = rnd();
  if (floor >= 8 && r < 0.03 + floor * 0.002) return 'gem';
  if (floor >= 12 && r < 0.2) return 'gold';
  if (floor >= 5 && r < 0.36) return 'iron';
  if (r < (floor >= 5 ? 0.5 : 0.35)) return 'copper';
  return 'stone';
}

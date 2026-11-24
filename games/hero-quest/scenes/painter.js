// Paints the still parts of a room (ground, walls, doors, furniture, chests) into a canvas.
// Moving things (player, enemies, blocks, torches' flames) are Phaser sprites on top.
// Outdoor tiles come from the LAS tileset; dungeon floors and wall rims are drawn in the same
// pixel style so walls join up cleanly in any shape.
import { TILE, COLS, ROWS } from '../logic/constants.js';
import { trigFlag } from '../logic/world.js';
import { ITEM } from '../art.js';

const OUTDOOR = new Set(['village', 'field', 'forest', 'mountain']);

export const THEMES = {
  moss: { floor: '#3d3a2c', floor2: '#47432f', speck: '#2f2c22', rim: '#c07a3f', rimHi: '#e8a35e', face: '#7a4a2a', top: '#0d0a0b' },
  lab: { floor: '#3b3947', floor2: '#433f50', speck: '#2e2c38', rim: '#9a8f86', rimHi: '#cfc4b6', face: '#5d5650', top: '#0b0a0d' },
  keep: { floor: '#3a2740', floor2: '#43304a', speck: '#2a1c30', rim: '#bc4a9b', rimHi: '#e57fc6', face: '#6e2f5e', top: '#0c080d' },
  cave: { floor: '#3d3a2c', floor2: '#47432f', speck: '#2f2c22', rim: '#c07a3f', rimHi: '#e8a35e', face: '#7a4a2a', top: '#0d0a0b' },
  house: { floor: '#7a5236', floor2: '#6d482f', speck: '#5a3b26', rim: '#a0714a', rimHi: '#d39b62', face: '#5a3b26', top: '#1c1618' },
};

const ROOF = { green: 29, purple: 32, red: 35, blue: 38 };

export function paintRoom(ctx, imgs, game) {
  const r = game.room;
  const W = COLS * TILE; const H = ROWS * TILE;
  ctx.clearRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = false;
  const tile = (img, c, rr, x, y, w = 1, h = 1) => ctx.drawImage(img, c * TILE, rr * TILE, w * TILE, h * TILE, x * TILE, y * TILE, w * TILE, h * TILE);
  const las = (c, rr, x, y, w, h) => tile(imgs.las, c, rr, x, y, w, h);
  const ch = (x, y) => (x < 0 || y < 0 || x >= COLS || y >= ROWS ? null : game.cell(x, y));
  const hash = (x, y) => ((x * 73856093) ^ (y * 19349663) ^ (r.gx * 83492791) ^ (r.gy * 2971)) >>> 0;
  const outdoor = OUTDOOR.has(r.theme);
  const T = THEMES[r.theme] || THEMES.moss;
  const fill = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

  // ------------------------------------------------------------- ground
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (outdoor) {
        if (r.theme === 'mountain') las(2, 5, x, y); else las(1, 2, x, y);
      } else floorTile(x, y);
    }
  }

  function floorTile(x, y) {
    const px = x * TILE; const py = y * TILE;
    const h = hash(x, y);
    if (r.theme === 'house') {
      fill(px, py, TILE, TILE, T.floor);
      for (let k = 0; k < 4; k++) fill(px, py + k * 4 + 3, TILE, 1, T.speck);
      fill(px + ((h % 3) * 5 + (y % 2) * 7) % 16, py, 1, TILE, T.speck);
      return;
    }
    fill(px, py, TILE, TILE, (x + y) % 2 ? T.floor : T.floor2);
    // flagstone joints
    fill(px, py + 15, TILE, 1, T.speck); fill(px + 15, py, 1, TILE, T.speck);
    if (h % 5 === 0) { fill(px + 3 + (h % 9), py + 4 + (h % 7), 2, 1, T.speck); }
    if (h % 7 === 1) { fill(px + 9, py + 10, 1, 1, T.speck); fill(px + 4, py + 6, 1, 1, T.speck); }
  }

  // ------------------------------------------------------------- paths (9-slice from the sand pad)
  const isPath = (x, y) => { const c = ch(x, y); return c === ':' || (c === null); };
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (ch(x, y) !== ':') continue;
      if (!outdoor) { fill(x * TILE + 1, y * TILE + 1, 14, 14, T.floor2); continue; }
      const n = isPath(x, y - 1); const s = isPath(x, y + 1); const w = isPath(x - 1, y); const e = isPath(x + 1, y);
      let c; let rr;
      if (!w && !e) { c = 9; rr = n && s ? 2 : !n ? 1 : 3; } else if (!n && !s) { c = !w ? 10 : !e ? 12 : 11; rr = 0; } else { c = !w ? 10 : !e ? 12 : 11; rr = !n ? 1 : !s ? 3 : 2; }
      las(c, rr, x, y);
    }
  }

  // ------------------------------------------------------------- water
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = ch(x, y);
      const bridged = c === 'W' && game.flags[trigFlag(r, 'crystal')];
      if (c !== 'w' && !(c === 'W' && !bridged)) continue;
      const px = x * TILE; const py = y * TILE;
      fill(px, py, TILE, TILE, '#2a5cc4');
      fill(px + ((hash(x, y) % 9) + 2), py + 5 + (hash(x, y) % 6), 4, 1, '#4f86e0');
      const wet = (a, b) => { const k = ch(a, b); return k === 'w' || k === 'W' || k === null; };
      if (!wet(x, y - 1)) { fill(px, py, TILE, 2, '#9fd0f5'); fill(px, py + 2, TILE, 1, '#4f86e0'); }
      if (!wet(x, y + 1)) fill(px, py + 14, TILE, 2, '#1d3f8a');
      if (!wet(x - 1, y)) fill(px, py, 2, TILE, '#6fa6ea');
      if (!wet(x + 1, y)) fill(px + 14, py, 2, TILE, '#6fa6ea');
    }
  }

  // ------------------------------------------------------------- walls / cliffs
  const wallLike = (x, y) => { const c = ch(x, y); return c === null || c === '#'; };
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = ch(x, y);
      if (c !== '#' && !(c === 'c' && !game.passable(x, y, 'player'))) continue;
      if (outdoor) {
        const top = !wallLike(x, y - 1);
        las(hash(x, y) % 4, top ? 8 : 9, x, y);
        if (c === 'c') las(1, 4, x, y);
        continue;
      }
      if (r.theme === 'house' && y <= 1) {
        // back wall: plaster with a wood beam on top
        if (y === 0) { fill(x * TILE, 0, TILE, TILE, T.top); fill(x * TILE, 12, TILE, 4, '#6d482f'); fill(x * TILE, 12, TILE, 1, '#a0714a'); } else las(9, 64, x, y);
        continue;
      }
      paintWall(x, y, c === 'c');
    }
  }

  function paintWall(x, y, cracked) {
    const px = x * TILE; const py = y * TILE;
    const open = (a, b) => !wallLike(a, b) && !(ch(a, b) === 'c' && !game.passable(a, b, 'player'));
    fill(px, py, TILE, TILE, T.top);
    // a brick face where the wall meets the floor below it gives the room some height
    if (open(x, y + 1)) {
      fill(px, py + 6, TILE, 10, T.face);
      for (let k = 0; k < 2; k++) {
        fill(px, py + 6 + k * 5, TILE, 1, T.top);
        const off = (k + x) % 2 ? 4 : 10;
        fill(px + off, py + 6 + k * 5, 1, 5, T.top);
      }
      fill(px, py + 5, TILE, 2, T.rim); fill(px, py + 5, TILE, 1, T.rimHi);
    }
    if (open(x, y - 1)) { fill(px, py, TILE, 3, T.rim); fill(px, py + 2, TILE, 1, T.rimHi); }
    if (open(x - 1, y)) { fill(px, py, 3, TILE, T.rim); fill(px + 2, py, 1, TILE, T.rimHi); }
    if (open(x + 1, y)) { fill(px + 13, py, 3, TILE, T.rim); fill(px + 13, py, 1, TILE, T.rimHi); }
    // inner corners
    if (open(x - 1, y - 1) && !open(x - 1, y) && !open(x, y - 1)) fill(px, py, 3, 3, T.rim);
    if (open(x + 1, y - 1) && !open(x + 1, y) && !open(x, y - 1)) fill(px + 13, py, 3, 3, T.rim);
    if (open(x - 1, y + 1) && !open(x - 1, y) && !open(x, y + 1)) fill(px, py + 13, 3, 3, T.rim);
    if (open(x + 1, y + 1) && !open(x + 1, y) && !open(x, y + 1)) fill(px + 13, py + 13, 3, 3, T.rim);
    if (cracked) {
      ctx.fillStyle = '#000';
      const pts = [[4, 6], [5, 7], [6, 8], [7, 8], [8, 9], [9, 10], [9, 11], [10, 12], [7, 9], [6, 10], [5, 11], [11, 9], [12, 8]];
      for (const [a, b] of pts) ctx.fillRect(px + a, py + b, 1, 1);
      ctx.fillStyle = T.rimHi; ctx.fillRect(px + 5, py + 6, 1, 1); ctx.fillRect(px + 10, py + 11, 1, 1);
    }
  }

  // ------------------------------------------------------------- doors on dungeon edges
  if (!outdoor) {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = ch(x, y);
        const edge = y === 0 || x === 0 || y === ROWS - 1 || x === COLS - 1;
        if (!edge || c === '#' || c === null) continue;
        if (r.theme === 'house' && c === 'D') { fill(x * TILE + 2, y * TILE + 2, 12, 12, '#4e282e'); fill(x * TILE + 3, y * TILE + 3, 10, 10, '#a13d3b'); continue; }
        paintDoor(x, y, c);
      }
    }
  }

  function paintDoor(x, y, c) {
    const px = x * TILE; const py = y * TILE;
    const vertical = y === 0 || y === ROWS - 1; // door in the top or bottom wall
    const open = c === '.' || c === 'D' || game.passable(x, y, 'player');
    fill(px, py, TILE, TILE, '#050404');
    // posts
    if (vertical) { fill(px, py, 2, TILE, T.rim); fill(px + 14, py, 2, TILE, T.rim); } else { fill(px, py, TILE, 2, T.rim); fill(px, py + 14, TILE, 2, T.rim); }
    if (open) {
      fill(px + 2, py + 2, 12, 12, '#0a0808');
      return;
    }
    if (c === 'k') {
      fill(px + 2, py + 2, 12, 12, '#7a4a2a');
      for (let k = 0; k < 3; k++) fill(px + 2 + k * 4, py + 2, 1, 12, '#5a3420');
      fill(px + 5, py + 5, 6, 6, '#e3d245'); fill(px + 7, py + 6, 2, 2, '#1c1618'); fill(px + 7, py + 8, 2, 2, '#1c1618');
    } else if (c === 'K') {
      // the boss door: red with a gold frame and a big lock
      fill(px, py, TILE, TILE, '#e3d245');
      fill(px + 1, py + 1, 14, 14, '#4e282e');
      fill(px + 2, py + 2, 12, 12, '#a13d3b');
      fill(px + 2, py + 7, 12, 1, '#4e282e');
      fill(px + 4, py + 3, 8, 3, '#e3d245'); fill(px + 5, py + 4, 6, 1, '#a13d3b');
      fill(px + 3, py + 6, 10, 7, '#e3d245'); fill(px + 7, py + 8, 2, 2, '#1c1618'); fill(px + 7, py + 10, 2, 2, '#1c1618');
    } else if (c === 's' || c === 'z') {
      fill(px + 2, py + 2, 12, 12, '#2e2c38');
      for (let k = 0; k < 4; k++) {
        if (vertical) { fill(px + 3 + k * 3, py + 2, 2, 12, '#9a8f86'); fill(px + 3 + k * 3, py + 2, 1, 12, '#cfc4b6'); } else { fill(px + 2, py + 3 + k * 3, 12, 2, '#9a8f86'); fill(px + 2, py + 3 + k * 3, 12, 1, '#cfc4b6'); }
      }
    } else if (c === 'c') paintWall(x, y, true);
  }

  // ------------------------------------------------------------- objects
  const fences = (x, y) => ch(x, y) === 'f';
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = ch(x, y);
      const h = hash(x, y);
      switch (c) {
        case ',':
          if (outdoor) {
            if (r.theme === 'mountain') las(2, 4, x, y); else { const opts = [[13, 0], [14, 0], [19, 2], [18, 2]]; const [a, b] = opts[h % opts.length]; las(a, b, x, y); }
          } else { fill(x * TILE + 4, y * TILE + 9, 3, 1, T.speck); fill(x * TILE + 9, y * TILE + 5, 2, 1, T.speck); }
          break;
        case 'T': las(18 + ((x + y) % 2 ? 1 : 0), (y % 2), x, y); break;
        case 'Y': las(16, 0, x, y, 2, 2); break;
        case 'b': las(16, 2, x, y); break;
        case 'r': las(15, 1, x, y); break;
        case 'c':
          if (outdoor && !game.passable(x, y, 'player') && !wallLike(x, y - 1)) { las(15, 1, x, y); crackOverlay(x, y); } else if (outdoor && game.passable(x, y, 'player')) {
            if (wallLike(x, y - 1)) las(0, 4, x, y);
          }
          break;
        case 'e': las(0, 4, x, y); break;
        case '=': las(9, 0, x, y); break;
        case 'W': if (game.flags[trigFlag(r, 'crystal')]) las(9, 0, x, y); break;
        case 'f': las(fences(x - 1, y) && fences(x + 1, y) ? 7 : fences(x + 1, y) ? 6 : fences(x - 1, y) ? 8 : 7, 1, x, y); break;
        case 'v': las(13, 2, x, y); break;
        case 'g': las(13 + (h % 3), 3, x, y); break;
        case '~': if (r.theme === 'moss' || r.theme === 'cave') las(6, 46, x, y); else las(7, 46, x, y); break;
        case 't': fill(x * TILE + 3, y * TILE + 9, 10, 6, '#1c1618'); break; // flame sprite sits on top
        case 'o': tile(imgs.items, ITEM.pot[0], ITEM.pot[1], x, y); break;
        case 'x': {
          const pressed = game.flags[trigFlag(r, 'switch')];
          const px = x * TILE; const py = y * TILE;
          fill(px + 2, py + 2, 12, 12, '#0d0a0b');
          fill(px + 3, py + 3, 10, 10, pressed ? T.face : T.rim);
          if (!pressed) { fill(px + 3, py + 3, 10, 2, T.rimHi); fill(px + 3, py + 11, 10, 2, T.face); }
          fill(px + 6, py + 6, 4, 4, pressed ? T.rim : T.rimHi);
          break;
        }
        case 'X': {
          const px = x * TILE; const py = y * TILE;
          fill(px + 3, py + 11, 10, 4, '#0d0a0b'); fill(px + 4, py + 11, 8, 3, '#9a8f86'); fill(px + 4, py + 11, 8, 1, '#cfc4b6');
          const lit = game.flags[trigFlag(r, 'crystal')];
          ctx.drawImage(imgs.items, ITEM.orb[0] * TILE, ITEM.orb[1] * TILE, TILE, TILE, px, py - 3, TILE, TILE);
          if (lit) tintTile(imgs.items, ITEM.orb[0], ITEM.orb[1], x, y - 3 / TILE, 'rgba(240,150,40,0.7)');
          break;
        }
        case 'C': {
          const chest = game.chestAt(x, y);
          if (!chest) break;
          if (!chest.visible) {
            fill(x * TILE + 3, y * TILE + 5, 10, 7, 'rgba(4,3,3,0.35)');
            fill(x * TILE + 4, y * TILE + 6, 8, 5, 'rgba(249,245,239,0.08)');
          } else las(chest.open ? 13 : 14, 1, x, y);
          break;
        }
        case 'l': if (r.theme === 'lab') tile(imgs.lab, 10, 5, x, y); else las(3, 64, x, y); break;
        case 'q': las(5, ch(x, y - 1) === 'q' ? 64 : 63, x, y); break;
        case 'm': las(8, 66, x, y); break;
        case 'F': las(0, 68, x, y); break;
        case '_': las(0, 66, x, y); break;
        default: break;
      }
    }
  }

  // houses
  for (const hs of r.houses) {
    const row = ROOF[hs.roof] ?? 29;
    las(0, row, hs.x, hs.y, 5, 3);
    las(0, 41, hs.x, hs.y + 3, 5, 1);
  }

  function crackOverlay(x, y) {
    ctx.fillStyle = '#1c1618';
    const pts = [[7, 3], [7, 4], [8, 5], [8, 6], [7, 7], [6, 8], [6, 9], [9, 7], [10, 8], [5, 10]];
    for (const [a, b] of pts) ctx.fillRect(x * TILE + a, y * TILE + b, 1, 1);
  }

  function tintTile(img, c, rr, x, y, color) {
    const tmp = imgs.tmp || (imgs.tmp = Object.assign(document.createElement('canvas'), { width: TILE, height: TILE }));
    const t = tmp.getContext('2d');
    t.clearRect(0, 0, TILE, TILE);
    t.drawImage(img, c * TILE, rr * TILE, TILE, TILE, 0, 0, TILE, TILE);
    t.globalCompositeOperation = 'source-atop';
    t.fillStyle = color; t.fillRect(0, 0, TILE, TILE);
    t.globalCompositeOperation = 'source-over';
    ctx.drawImage(tmp, x * TILE, y * TILE);
  }
}

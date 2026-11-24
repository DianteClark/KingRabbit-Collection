// Art: Pocket Pets by Aleksandr Makarov (pets, handheld cases, icons, screen effects) and the
// RAS Overworld characters by Aleksandr Makarov (tamers on the map). Map tiles and buildings are
// drawn in code (tiles.js) to match. Textures are built once in Boot (pets recoloured per type,
// characters cut out and outlined) and also turned into data URLs for the HTML panels.
import pets from '../../shared/assets/pocketpets/PocketPets-v.1.1/Pets/pets-sheet.png?url';
import cases from '../../shared/assets/pocketpets/PocketPets-v.1.1/Cases/cases-sheet.png?url';
import icons from '../../shared/assets/pocketpets/PocketPets-v.1.1/Icons/small-icons-sheet.png?url';
import bigicons from '../../shared/assets/pocketpets/PocketPets-v.1.1/Icons/big-icons-sheet.png?url';
import screen from '../../shared/assets/pocketpets/PocketPets-v.1.1/Screen-effects/screen-sheet.png?url';
import fade from '../../shared/assets/pocketpets/PocketPets-v.1.1/Screen-effects/fade-in-sheet.png?url';
import chars from '../../shared/assets/mas-mini-retro/RAS-Overworld-v.1.0/CharactersSpriteSheet.png?url';
import { SPECIES } from './logic/data.js';
import { TYPE_INFO } from './logic/types.js';
import { TILE_ART, TILE_COLORS, ITEM_ART, ITEM_COLORS } from './tiles.js';
import { LEADERS } from './logic/world.js';

export const SHEETS = { pets, cases, icons, bigicons, screen, fade, chars };

// Small icons (10x10) by name: [col, row] in small-icons-sheet.
export const ICON = {
  food: [0, 0], sleep: [4, 0], skull: [9, 1], heart: [0, 2], halfHeart: [1, 2], emptyHeart: [2, 2],
  left: [3, 2], right: [4, 2], trophy: [9, 2], crown: [4, 3], sound: [7, 3], cross: [8, 3], check: [9, 3], clock: [8, 4],
};
// Case colours in cases-sheet (80x80 each): index = row * 3 + col.
export const CASE = { blue: 0, silver: 1, green: 2, orange: 3, red: 4, pink: 5 };
export const TYPE_CASE = { flame: 'red', tide: 'blue', leaf: 'green', spark: 'orange', stone: 'silver', plain: 'pink' };

const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Data URLs for HTML panels: pets[sp], items[id], chars[row]. */
export const URLS = { pets: {}, items: {}, faces: {}, icons: {} };

/** Frame count of a pet texture (adults have 7 moods: 0-1 happy, 2-3 calm, 4-5 cross, 6 asleep). */
export const petFrames = (sp) => (SPECIES[sp].stage === 'adult' ? 7 : 1);
export const PET_MOOD = { idle: [0, 2], happy: [1, 1], hurt: [4, 5], faint: [6, 6] };

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
/** 2D context that is read back with getImageData (kept on the CPU, no GPU stalls). */
const ctx2d = (c) => c.getContext('2d', { willReadFrequently: true });

/** Colours for a species: [light, dark], from its type. */
export function petColors(sp) {
  const t = SPECIES[sp].type;
  return [rgb(TYPE_INFO[t].light), rgb(TYPE_INFO[t].dark)];
}

function buildPets(scene) {
  const src = scene.textures.get('pets').getSourceImage();
  const tmp = canvas(200, 120);
  const tctx = ctx2d(tmp);
  tctx.drawImage(src, 0, 0);
  const all = tctx.getImageData(0, 0, 200, 120);
  for (const [sp, def] of Object.entries(SPECIES)) {
    const n = petFrames(sp);
    const cols = def.stage === 'adult' ? [3, 4, 5, 6, 7, 8, 9] : [def.stage === 'baby' ? 2 : 1];
    const key = `pet_${sp}`;
    if (scene.textures.exists(key)) continue;
    const work = canvas(20 * n, 20);
    const wctx = ctx2d(work);
    const img = wctx.createImageData(20 * n, 20);
    const [light, dark] = petColors(sp);
    cols.forEach((col, f) => {
      for (let y = 0; y < 20; y++) {
        for (let x = 0; x < 20; x++) {
          const si = ((def.row * 20 + y) * 200 + col * 20 + x) * 4;
          const a = all.data[si + 3];
          if (!a) continue;
          const lum = all.data[si] + all.data[si + 1] + all.data[si + 2];
          const c = lum > 380 ? light : dark;
          const di = (y * 20 * n + f * 20 + x) * 4;
          img.data[di] = c[0]; img.data[di + 1] = c[1]; img.data[di + 2] = c[2]; img.data[di + 3] = 255;
        }
      }
    });
    wctx.putImageData(img, 0, 0);
    const tex = scene.textures.createCanvas(key, 20 * n, 20);
    tex.getContext().drawImage(work, 0, 0);
    tex.refresh();
    for (let f = 0; f < n; f++) tex.add(f, 0, f * 20, 0, 20, 20);
    const one = canvas(20, 20);
    one.getContext('2d').drawImage(work, 0, 0, 20, 20, 0, 0, 20, 20);
    URLS.pets[sp] = one.toDataURL();
  }
  // Silhouette for unseen dex entries.
  const sil = canvas(20, 20);
  URLS.unknown = sil.toDataURL();
}

function buildChars(scene) {
  if (scene.textures.exists('chars2')) return;
  const src = scene.textures.get('chars').getSourceImage();
  const w = 160; const h = src.height;
  const tmp = canvas(w, h);
  const tctx = ctx2d(tmp);
  tctx.drawImage(src, 0, 0);
  const d = tctx.getImageData(0, 0, w, h);
  const px = d.data;
  for (let i = 0; i < px.length; i += 4) if (px[i] < 6 && px[i + 1] < 6 && px[i + 2] < 6) px[i + 3] = 0;
  // The sheet only has side views. Columns 6-9 get made-up front and back views (6 front, 7 front
  // walking, 8 back, 9 back walking): the side view is mirrored round its middle, then the front gets
  // a small face and the back has its skin painted over with the hair or hood colour.
  for (let r = 0; r < 11; r++) {
    for (let k = 0; k < 4; k++) {
      const col = k % 2 ? 2 : 1;
      const cell = viewFrom(px, w, r, col, k < 2 ? 'front' : 'back');
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const di = (((r + 1) * 16 + y) * w + (6 + k) * 16 + x) * 4;
        for (let c = 0; c < 4; c++) px[di + c] = cell[(y * 16 + x) * 4 + c];
      }
    }
  }
  const out = new Uint8ClampedArray(px);
  const ink = rgb('#1c1618');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (px[i + 3]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || (nx >> 4) !== (x >> 4) || (ny >> 4) !== (y >> 4)) continue;
        if (px[(ny * w + nx) * 4 + 3]) { out[i] = ink[0]; out[i + 1] = ink[1]; out[i + 2] = ink[2]; out[i + 3] = 255; break; }
      }
    }
  }
  tctx.putImageData(new ImageData(out, w, h), 0, 0);
  const tex = scene.textures.createCanvas('chars2', w, h);
  tex.getContext().drawImage(tmp, 0, 0);
  tex.refresh();
  for (let r = 0; r < 11; r++) {
    for (let c = 0; c < 10; c++) tex.add(`c${r}_${c}`, 0, c * 16, (r + 1) * 16, 16, 16);
    const face = canvas(16, 16);
    face.getContext('2d').drawImage(tmp, 0, (r + 1) * 16, 16, 16, 0, 0, 16, 16);
    URLS.faces[r] = face.toDataURL();
  }
}

const SKIN = [[240, 212, 114], [249, 245, 239]];
const isSkin = (d, i) => SKIN.some(([r, g, b]) => d[i] === r && d[i + 1] === g && d[i + 2] === b);

/** A front or back view (16x16 RGBA) made from the side view at row r, column col. */
function viewFrom(px, w, r, col, kind) {
  const at = (x, y) => (((r + 1) * 16 + y) * w + col * 16 + x) * 4;
  let minX = 16; let maxX = -1;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (px[at(x, y) + 3]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
  const cx = Math.floor((minX + maxX) / 2);
  const out = new Uint8ClampedArray(16 * 16 * 4);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const sx = cx + (x >= 8 ? x - 7 : 8 - x);
      if (sx < 0 || sx > 15) continue;
      const si = at(sx, y); const di = (y * 16 + x) * 4;
      for (let c = 0; c < 4; c++) out[di + c] = px[si + c];
    }
  }
  let top = 0;
  while (top < 15 && ![...Array(16).keys()].some((x) => out[(top * 16 + x) * 4 + 3])) top++;
  const set = (x, y, [rr, gg, bb]) => { const i = (y * 16 + x) * 4; out[i] = rr; out[i + 1] = gg; out[i + 2] = bb; out[i + 3] = 255; };
  if (kind === 'front') {
    for (let y = top + 3; y < top + 6; y++) for (let x = 6; x < 10; x++) set(x, y, SKIN[0]);
    set(6, top + 4, [28, 22, 24]); set(9, top + 4, [28, 22, 24]);
  } else {
    // Most common non-skin colour on the head = hair or hood.
    const count = new Map();
    for (let y = 0; y < 7; y++) for (let x = 0; x < 16; x++) {
      const i = at(x, y);
      if (!px[i + 3] || isSkin(px, i)) continue;
      const k = `${px[i]},${px[i + 1]},${px[i + 2]}`;
      count.set(k, (count.get(k) || 0) + 1);
    }
    const hair = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0].split(',').map(Number) || [28, 22, 24];
    for (let y = 0; y < 9; y++) for (let x = 0; x < 16; x++) { const i = (y * 16 + x) * 4; if (out[i + 3] && isSkin(out, i)) set(x, y, hair); }
  }
  return out;
}

function paint(ctx, rows, ox, oy, colors) {
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      const ch = r[x];
      if (ch === '.') continue;
      ctx.fillStyle = colors[ch];
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  });
}

/** Tile frames: one per map letter ('~' also '~1'), plus 'r_cave' for rocks in caves. */
function buildTiles(scene) {
  if (scene.textures.exists('tiles')) return;
  const names = [];
  for (const [ch, a] of Object.entries(TILE_ART)) {
    names.push([ch, a.base, a.art]);
    if (a.frames) names.push([`${ch}1`, a.frames[1], a.art]);
  }
  names.push(['r_cave', TILE_ART[';'].base, TILE_ART.r.art]);
  names.push(['sign', null, TILE_ART.s.art]);
  names.push(['tallTop', null, TILE_ART[','].base.map((r, y) => (y < 9 ? '.'.repeat(16) : r))]);
  const tex = scene.textures.createCanvas('tiles', names.length * 16, 16);
  const ctx = tex.getContext();
  names.forEach(([name, base, art], i) => {
    if (base) paint(ctx, base, i * 16, 0, TILE_COLORS);
    if (art) paint(ctx, art, i * 16, 0, TILE_COLORS);
  });
  tex.refresh();
  names.forEach(([name], i) => tex.add(name, 0, i * 16, 0, 16, 16));
}

function buildItems(scene) {
  if (scene.textures.exists('items')) return;
  const ids = Object.keys(ITEM_ART);
  const tex = scene.textures.createCanvas('items', ids.length * 12, 12);
  const ctx = tex.getContext();
  ids.forEach((id, i) => {
    paint(ctx, ITEM_ART[id], i * 12, 0, ITEM_COLORS);
    const one = canvas(12, 12);
    paint(one.getContext('2d'), ITEM_ART[id], 0, 0, ITEM_COLORS);
    URLS.items[id] = one.toDataURL();
  });
  tex.refresh();
  ids.forEach((id, i) => tex.add(id, 0, i * 12, 0, 12, 12));
}

function buildIcons(scene) {
  const tex = scene.textures.get('icons');
  for (const [name, [c, r]] of Object.entries(ICON)) {
    if (!tex.has(name)) tex.add(name, 0, c * 10, r * 10, 10, 10);
  }
  const src = tex.getSourceImage();
  for (const [name, [c, r]] of Object.entries(ICON)) {
    const one = canvas(10, 10);
    one.getContext('2d').drawImage(src, c * 10, r * 10, 10, 10, 0, 0, 10, 10);
    URLS.icons[name] = one.toDataURL();
  }
  const cs = scene.textures.get('cases');
  for (let i = 0; i < 6; i++) if (!cs.has(`case${i}`)) cs.add(`case${i}`, 0, (i % 3) * 80, Math.floor(i / 3) * 80, 80, 80);
  const sc = scene.textures.get('screen');
  if (!sc.has('dots')) { sc.add('dots', 0, 0, 0, 40, 40); sc.add('plain', 0, 40, 0, 40, 40); }
  const fd = scene.textures.get('fade');
  for (let i = 0; i < 8; i++) if (!fd.has(`f${i}`)) fd.add(`f${i}`, 0, (i % 4) * 20, Math.floor(i / 4) * 40, 20, 40);
}

// ---------------------------------------------------------------- buildings

const BUILD_STYLE = {
  home: { roof: '#c0583a', wall: '#f0e0c0' },
  lab: { roof: '#6c7ca8', wall: '#e8e8f0' },
  house: { roof: '#7a5a9a', wall: '#f0e0c0' },
  clinic: { roof: '#d84848', wall: '#f9f5ef', sign: 'cross' },
  shop: { roof: '#3a6cc0', wall: '#f0e0c0', sign: 'coin' },
  hall: { roof: '#8a8478', wall: '#d2cbb8', sign: 'badge' },
  tower: { roof: '#e3d245', wall: '#cfc6b2', sign: 'crown' },
};

function shade(hex, f) {
  const [r, g, b] = rgb(hex);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

/** Draw a building into a new texture and return its key. */
export function buildingTexture(scene, mapId, i, b) {
  const key = `bld_${mapId}_${i}`;
  if (scene.textures.exists(key)) return key;
  const W = b.w * 16; const H = b.h * 16;
  const tex = scene.textures.createCanvas(key, W, H);
  const ctx = tex.getContext();
  const st = { ...BUILD_STYLE[b.kind] };
  if (b.kind === 'hall' && b.leader) st.roof = TYPE_INFO[LEADERS[b.leader].type].color;
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const roofH = b.kind === 'tower' ? Math.round(H * 0.3) : Math.round(H * (b.h >= 4 ? 0.45 : 0.5));
  // walls
  R(1, roofH - 2, W - 2, H - roofH + 1, '#1c1618');
  R(2, roofH - 1, W - 4, H - roofH - 1, st.wall);
  R(2, H - 4, W - 4, 3, shade(st.wall, 0.8));
  // stone courses on halls and the tower
  if (b.kind === 'hall' || b.kind === 'tower') for (let y = roofH + 4; y < H - 4; y += 5) R(2, y, W - 4, 1, shade(st.wall, 0.85));
  // roof
  R(0, 1, W, roofH, '#1c1618');
  R(1, 2, W - 2, roofH - 2, st.roof);
  for (let y = 5; y < roofH - 2; y += 4) R(1, y, W - 2, 1, shade(st.roof, 0.78));
  R(1, 2, W - 2, 1, shade(st.roof, 1.25));
  R(0, roofH - 1, W, 2, shade(st.roof, 0.55));
  if (b.kind === 'tower') { // battlements
    for (let x = 0; x < W; x += 6) R(x, 0, 4, 3, '#1c1618');
    for (let x = 1; x < W; x += 6) R(x, 0, 2, 2, shade(st.roof, 1.1));
  }
  // door
  const dx = Math.floor(b.w / 2) * 16 + 4; const dy = H - 13;
  R(dx - 1, dy - 1, 10, 13, '#1c1618');
  R(dx, dy, 8, 12, '#6b4428');
  R(dx + 1, dy + 1, 6, 1, '#8a5a34');
  R(dx + 6, dy + 6, 1, 1, '#e3d245');
  // windows
  const wy = Math.max(roofH + 2, H - 13);
  for (let tx = 0; tx < b.w; tx++) {
    if (tx === Math.floor(b.w / 2)) continue;
    const wx = tx * 16 + 4;
    R(wx - 1, wy - 1, 10, 9, '#1c1618');
    R(wx, wy, 8, 7, '#7fb2ec');
    R(wx + 3, wy, 1, 7, '#1c1618'); R(wx, wy + 3, 8, 1, '#1c1618');
    R(wx + 1, wy + 1, 1, 1, '#d8ecff');
  }
  // sign above the door
  if (st.sign) {
    const sx = Math.floor(b.w / 2) * 16 + 1; const sy = Math.max(roofH - 9, 3);
    R(sx, sy, 14, 10, '#1c1618');
    R(sx + 1, sy + 1, 12, 8, '#f9f5ef');
    if (st.sign === 'cross') { R(sx + 6, sy + 2, 2, 6, '#d84848'); R(sx + 4, sy + 4, 6, 2, '#d84848'); }
    if (st.sign === 'coin') { R(sx + 5, sy + 2, 4, 6, '#e3d245'); R(sx + 4, sy + 3, 6, 4, '#e3d245'); R(sx + 6, sy + 3, 2, 4, '#b08a1a'); }
    if (st.sign === 'badge') {
      const c = b.leader ? TYPE_INFO[LEADERS[b.leader].type].color : '#8a8478';
      R(sx + 6, sy + 2, 2, 6, c); R(sx + 5, sy + 3, 4, 4, c); R(sx + 4, sy + 4, 6, 2, c);
    }
    if (st.sign === 'crown') { R(sx + 3, sy + 4, 8, 4, '#e3d245'); R(sx + 3, sy + 2, 2, 2, '#e3d245'); R(sx + 6, sy + 2, 2, 2, '#e3d245'); R(sx + 9, sy + 2, 2, 2, '#e3d245'); }
  }
  tex.refresh();
  return key;
}

export function buildTextures(scene) {
  buildPets(scene);
  buildChars(scene);
  buildTiles(scene);
  buildItems(scene);
  buildIcons(scene);
}

// Sprite sheet layout of SportSeries Soccer (by Aleksandr Makarov), measured from AllSprites.png.
// The sheet is layered: a HEAD block, a BODY block (5 skin tones) and a SHIRT block (7 kit
// colours), each 8 rows (directions) per variant, 16x16 cells, column 0 holds the direction arrows.
// A player is drawn by stacking body + shirt + head; we bake that into one canvas texture per
// kit/skin and recolour the shirt layer so any team colour works.

import spritesUrl from '../../shared/assets/soccer/SportSeries-Soccer-test-asset/AllSprites.png?url';
import fieldUrl from '../../shared/assets/soccer/SportSeries-Soccer-test-asset/TestField.png?url';

export const URLS = { sprites: spritesUrl, field: fieldUrl };

export const CELL = 16;
const HEAD_Y = 16;
const BODY_Y = 672;
const SHIRT_Y = 1328;
export const SKINS = 5;
const COLS = 47;

export { ANIM, dirIndex } from './logic/frames.js';

// Pieces of TestField.png: a clean 64x64 grass tile (the stripes repeat every 64 px) and the goals.
export const FIELD = {
  grass: [24, 176, 64, 64],
  goalTop: [192, 16, 96, 32],      // its bottom edge sits on the goal line
  goalBottom: [192, 608, 96, 32],  // goal line runs 16 px down from its top
};

const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const shade = ([r, g, b], k) => [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v * k))));

let sheetCanvas = null;
function sheetPixels(scene) {
  if (sheetCanvas) return sheetCanvas;
  const img = scene.textures.get('sprites').getSourceImage();
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  sheetCanvas = { canvas: c, ctx: g, data: g.getImageData(0, 0, img.width, img.height) };
  return sheetCanvas;
}

const emptyCache = new Map();
function cellEmpty(px, x0, y0) {
  const key = x0 * 10000 + y0;
  if (emptyCache.has(key)) return emptyCache.get(key);
  const v = scanEmpty(px, x0, y0);
  emptyCache.set(key, v);
  return v;
}

function scanEmpty(px, x0, y0) {
  const { data } = px;
  for (let y = y0; y < y0 + CELL; y++) {
    for (let x = x0; x < x0 + CELL; x++) if (data.data[(y * data.width + x) * 4 + 3] > 0) return false;
  }
  return true;
}

// Some animations are missing for some directions; borrow the nearest direction that has them.
const NEAR = [[0], [1, 0, 2], [2, 1, 3, 0], [3, 4, 2], [4], [5, 4, 6], [6, 7, 5, 0], [7, 0, 6]];

/**
 * Build (once) a texture for a kit and skin tone. Frames are named `${dir}_${col}`.
 * Returns the texture key.
 */
export function kitTexture(scene, shirt, shorts, skin) {
  const key = `kit-${shirt}-${shorts}-${skin}`;
  if (scene.textures.exists(key)) return key;
  const px = sheetPixels(scene);
  const tex = scene.textures.createCanvas(key, COLS * CELL, 8 * CELL);
  const ctx = tex.getContext();
  // Recoloured shirt layer (template = the red kit, block 0).
  const sh = document.createElement('canvas');
  sh.width = COLS * CELL; sh.height = 8 * CELL;
  const sctx = sh.getContext('2d');
  sctx.drawImage(px.canvas, 0, SHIRT_Y, COLS * CELL, 8 * CELL, 0, 0, COLS * CELL, 8 * CELL);
  const id = sctx.getImageData(0, 0, sh.width, sh.height);
  const S = hexRgb(shirt); const T = hexRgb(shorts); const T2 = shade(T, 1.15);
  for (let i = 0; i < id.data.length; i += 4) {
    if (id.data[i + 3] === 0) continue;
    const r = id.data[i]; const g = id.data[i + 1]; const b = id.data[i + 2];
    let to = null;
    if (r === 0xdf && g === 0x3e && b === 0x23) to = S;
    else if (r === 0xda && g === 0xe0 && b === 0xea) to = T;
    else if (r === 0xff && g === 0xff && b === 0xff) to = T2;
    if (to) { id.data[i] = to[0]; id.data[i + 1] = to[1]; id.data[i + 2] = to[2]; }
  }
  sctx.putImageData(id, 0, 0);

  const bodyY = BODY_Y + skin * 8 * CELL;
  const headY = HEAD_Y + skin * 8 * CELL;
  for (let d = 0; d < 8; d++) {
    for (let c = 1; c < COLS; c++) {
      // Missing frame: borrow from a nearby direction, then from facing down, else stand idle.
      let src = -1;
      for (const n of [...NEAR[d], 0]) {
        if (!cellEmpty(px, c * CELL, bodyY + n * CELL)) { src = n; break; }
      }
      const sx = src < 0 ? CELL : c * CELL;
      if (src < 0) src = d;
      const dx = c * CELL; const dy = d * CELL;
      ctx.drawImage(px.canvas, sx, bodyY + src * CELL, CELL, CELL, dx, dy, CELL, CELL);
      ctx.drawImage(sh, sx, src * CELL, CELL, CELL, dx, dy, CELL, CELL);
      ctx.drawImage(px.canvas, sx, headY + src * CELL, CELL, CELL, dx, dy, CELL, CELL);
      tex.add(`${d}_${c}`, 0, dx, dy, CELL, CELL);
    }
  }
  tex.refresh();
  return key;
}

/** Grass tile and goal frames cut from the test field; ball drawn as a tiny pixel sprite. */
export function buildFieldTextures(scene, goalW) {
  if (scene.textures.exists('grassTile')) return;
  const img = scene.textures.get('field').getSourceImage();
  const [gx, gy, gw, gh] = FIELD.grass;
  const grass = scene.textures.createCanvas('grassTile', gw, gh);
  grass.getContext().drawImage(img, gx, gy, gw, gh, 0, 0, gw, gh);
  grass.refresh();

  // Goals are 96 px wide in the art; rebuild them at our width: 16 px ends + repeated middle.
  const total = goalW + 8;
  for (const [key, [x, y, w, h]] of [['goalTop', FIELD.goalTop], ['goalBottom', FIELD.goalBottom]]) {
    const t = scene.textures.createCanvas(key, total, h);
    const g = t.getContext();
    g.drawImage(img, x, y, 16, h, 0, 0, 16, h);
    g.drawImage(img, x + w - 16, y, 16, h, total - 16, 0, 16, h);
    for (let dx = 16; dx < total - 16; dx += 32) {
      const piece = Math.min(32, total - 16 - dx);
      g.drawImage(img, x + 32, y, piece, h, dx, 0, piece, h);
    }
    // The art draws grass around the frame; clear the pixels that are plain grass.
    const id = g.getImageData(0, 0, total, h);
    for (let i = 0; i < id.data.length; i += 4) {
      const r = id.data[i]; const gg = id.data[i + 1]; const b = id.data[i + 2];
      if ((r === 0x59 && gg === 0xc1 && b === 0x35) || (r === 0x9c && gg === 0xdb && b === 0x43)) id.data[i + 3] = 0;
    }
    g.putImageData(id, 0, 0);
    t.refresh();
  }

  // Ball: 5x5 pixel ball with an outline and a couple of dark patches, plus its shadow.
  const B = [
    '.kkk.',
    'kwwdk',
    'kwddk',
    'kwwwk',
    '.kkk.',
  ];
  const col = { k: '#060608', w: '#f9f5ef', d: '#5a4e44' };
  const ball = scene.textures.createCanvas('ball', 5, 5);
  const bg = ball.getContext();
  B.forEach((row, y) => [...row].forEach((ch, x) => { if (col[ch]) { bg.fillStyle = col[ch]; bg.fillRect(x, y, 1, 1); } }));
  ball.refresh();
}

// Paints a stage's static tiles into canvases. Walls are auto-tiled from the MegaBoy tileset's
// 24x24 nine-slice blocks (each 8x8 tile picks the edge or corner piece its neighbours call for).
import { TILE, T } from '../logic/constants.js';

const SOLIDISH = new Set([T.SOLID, T.SOLID2, T.CRACK, T.CONVL, T.CONVR, T.DOOR]);

/** A copy of the tileset multiplied by a colour (for the dark power plant and the fortress). */
export function darkenedTiles(src, color) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'multiply';
  x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(src, 0, 0);
  return c;
}

/** Which of the 3x3 pieces a cell uses, from its four neighbours. */
export function pieceFor(up, down, left, right) {
  const row = !up ? 0 : !down ? 2 : 1;
  const col = !left ? 0 : !right ? 2 : 1;
  return [col, row];
}

function wallAt(lv, cx, cy) {
  if (cx < 0 || cx >= lv.cols || cy >= lv.rows) return true;
  if (cy < 0) cy = 0;
  return SOLIDISH.has(lv.at(cx, cy));
}

/**
 * Paint columns [c0, c1) of the level into ctx (x = 0 is column c0).
 * imgs: { tiles (tileset or a darkened copy), raw (tileset), spike (canvas), oneway (canvas) }
 */
export function paintChunk(ctx, lv, theme, imgs, c0, c1) {
  ctx.clearRect(0, 0, (c1 - c0) * TILE, lv.rows * TILE);
  ctx.imageSmoothingEnabled = false;
  const bx = theme.block; const by = 8;
  for (let cy = 0; cy < lv.rows; cy++) {
    for (let cx = c0; cx < c1; cx++) {
      const t = lv.at(cx, cy);
      const dx = (cx - c0) * TILE; const dy = cy * TILE;
      if (t === T.SOLID || t === T.SOLID2 || t === T.CRACK) {
        const up = wallAt(lv, cx, cy - 1); const down = wallAt(lv, cx, cy + 1);
        const left = wallAt(lv, cx - 1, cy); const right = wallAt(lv, cx + 1, cy);
        const [pc, pr] = pieceFor(up, down, left, right);
        // deep inside a wall the plain panel reads calmer than rows of rivets
        const deep = up && down && left && right && wallAt(lv, cx - 1, cy - 1) && wallAt(lv, cx + 1, cy + 1);
        const variant = t === T.CRACK ? 48 : t === T.SOLID2 || deep ? 24 : 0;
        ctx.drawImage(imgs.tiles, bx + variant + pc * 8, by + pr * 8, 8, 8, dx, dy, 8, 8);
      } else if (t === T.CONVL || t === T.CONVR) {
        ctx.fillStyle = '#1c1618'; ctx.fillRect(dx, dy, 8, 8);
        ctx.fillStyle = '#5d5650'; ctx.fillRect(dx, dy + 1, 8, 5);
        ctx.fillStyle = '#9a9aa8'; ctx.fillRect(dx, dy + 1, 8, 1);
        ctx.fillStyle = '#040303'; ctx.fillRect(dx, dy + 6, 8, 2);
        ctx.fillStyle = '#8a8079';
        ctx.fillRect(dx + 3, dy + 6, 2, 2);
      } else if (t === T.LADDER) {
        // ladders are two tiles wide: the left tile draws the left half, the right tile the right half
        const leftL = lv.at(cx - 1, cy) === T.LADDER;
        const rightL = lv.at(cx + 1, cy) === T.LADDER;
        if (leftL || rightL) ctx.drawImage(imgs.raw, leftL ? 368 : 360, 8, 8, 8, dx, dy, 8, 8);
        else ctx.drawImage(imgs.raw, 360, 8, 4, 8, dx, dy, 4, 8), ctx.drawImage(imgs.raw, 372, 8, 4, 8, dx + 4, dy, 4, 8);
      } else if (t === T.SPIKE) {
        ctx.drawImage(imgs.spike, dx, dy);
      } else if (t === T.SPIKED) {
        ctx.save(); ctx.translate(dx, dy + 8); ctx.scale(1, -1); ctx.drawImage(imgs.spike, 0, 0); ctx.restore();
      } else if (t === T.ONEWAY) {
        ctx.drawImage(imgs.oneway, dx, dy);
      }
    }
  }
}

/** A repeating background tile for a theme (drawn behind the stage with parallax). */
export function paintBackground(ctx, theme, raw, w, h) {
  ctx.imageSmoothingEnabled = false;
  if (theme.sky) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, theme.bg); g.addColorStop(1, theme.bg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // pixel clouds
    ctx.fillStyle = 'rgba(249,245,239,0.85)';
    const cloud = (x, y, s) => { for (const [ox, oy, r] of [[0, 0, 6], [7, -3, 7], [15, 0, 6], [7, 2, 6]]) ctx.fillRect(x + ox * s - r * s, y + oy * s - r * s / 2, r * 2 * s, r * s); };
    cloud(30, 24, 1); cloud(110, 44, 0.8); cloud(150, 16, 0.6);
    // far hills
    ctx.fillStyle = 'rgba(71,65,107,0.35)';
    for (let x = 0; x < w; x++) { const y = h - 22 - Math.round(8 * Math.sin(x / 13) + 5 * Math.sin(x / 5.3)); ctx.fillRect(x, y, 1, h - y); }
    return;
  }
  ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, w, h);
  // the tileset's ornament panels, faded into the dark
  ctx.globalAlpha = 0.3;
  for (let x = 0; x < w; x += 80) ctx.drawImage(raw, theme.orn, 48, 80, 100, x, 10, 80, 100);
  ctx.globalAlpha = 1;
  // pipes
  ctx.fillStyle = 'rgba(4,3,3,0.35)';
  for (const x of [20, 96, 140]) ctx.fillRect(x, 0, 6, h);
  ctx.fillStyle = theme.deco; ctx.globalAlpha = 0.18;
  for (const x of [21, 97, 141]) ctx.fillRect(x, 0, 2, h);
  ctx.globalAlpha = 1;
}

// Art by Aleksandr Makarov: RAS Overworld (tiles, heroes, people, items), packed into one small
// atlas by tools/pack_art.py, and the MAS Darkness Pack creatures, recoloured here per monster.
import atlasUrl from './assets/atlas.png?url';
import ATLAS from './assets/atlas.json';
import creUrl from '../../shared/assets/mas-mini-retro/MAS-Darkness-Pack-1.0/MonsterPack/Creatures.png?url';
import { MONSTERS, BIG_SPRITES, PALS } from './logic/data.js';

export const SHEETS = { atlas: atlasUrl, cre: creUrl };

// The creature sheet's five shades, light to dark.
const SRC_SHADES = [[243, 228, 210], [227, 191, 143], [185, 132, 143], [124, 89, 152], [59, 65, 120]];
const OUTLINE = [28, 22, 24];
const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Data URLs for the HTML panels. */
export const URLS = { frames: {} };

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

let TEX = null;

export function buildTextures(scene) {
  const T = scene.textures;
  TEX = T;
  const tex = T.get('atlas');
  for (const [name, [x, y, w, h]] of Object.entries(ATLAS)) if (!tex.has(name)) tex.add(name, 0, x, y, w, h);
  buildMonsters(scene);
}

function buildMonsters(scene) {
  const src = scene.textures.get('cre').getSourceImage();
  const all = canvas(src.width, src.height);
  const actx = all.getContext('2d', { willReadFrequently: true });
  actx.drawImage(src, 0, 0);
  for (const [id, d] of Object.entries(MONSTERS)) {
    const key = `m_${id}`;
    if (scene.textures.exists(key)) continue;
    const [sx, sy, w, h] = typeof d.spr === 'string' ? BIG_SPRITES[d.spr] : [d.spr[0] * 16, d.spr[1] * 16, 16, 16];
    const pad = 1;
    const c = canvas(w + pad * 2, h + pad * 2);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const srcData = actx.getImageData(sx, sy, w, h).data;
    const img = ctx.createImageData(w + pad * 2, h + pad * 2);
    const ramp = PALS[d.pal] ? PALS[d.pal].map(rgb) : null;
    const W = w + pad * 2;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const si = (y * w + x) * 4;
        if (!srcData[si + 3]) continue;
        let col = [srcData[si], srcData[si + 1], srcData[si + 2]];
        if (ramp) {
          const k = SRC_SHADES.findIndex(([r, g, b]) => r === col[0] && g === col[1] && b === col[2]);
          if (k >= 0) col = ramp[k];
        }
        const di = ((y + pad) * W + x + pad) * 4;
        img.data[di] = col[0]; img.data[di + 1] = col[1]; img.data[di + 2] = col[2]; img.data[di + 3] = 255;
      }
    }
    // Ink outline so every monster reads on any backdrop.
    const out = new Uint8ClampedArray(img.data);
    const H = h + pad * 2;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (img.data[i + 3]) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx; const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (img.data[(ny * W + nx) * 4 + 3]) { out[i] = OUTLINE[0]; out[i + 1] = OUTLINE[1]; out[i + 2] = OUTLINE[2]; out[i + 3] = 255; break; }
        }
      }
    }
    ctx.putImageData(new ImageData(out, W, H), 0, 0);
    // The canvas is CPU-backed (willReadFrequently), so uploading it never stalls the GPU.
    scene.textures.addCanvas(key, c);
  }
}

/** A data URL for an atlas frame (cached), for HTML panels. */
export function frameUrl(name) {
  if (URLS.frames[name]) return URLS.frames[name];
  const f = ATLAS[name];
  if (!f || !TEX) return '';
  const src = TEX.get('atlas').getSourceImage();
  const c = canvas(f[2], f[3]);
  c.getContext('2d').drawImage(src, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
  URLS.frames[name] = c.toDataURL();
  return URLS.frames[name];
}

/** Map sprite frame for a hero or person: row r, facing, mid-step. Side views face right. */
export function personFrame(r, face, stepping = false) {
  if (face === 'down') return `c${r}_${stepping ? 7 : 6}`;
  if (face === 'up') return `c${r}_${stepping ? 9 : 8}`;
  return `c${r}_${stepping ? 2 : 1}`;
}

export const hasFrame = (name) => !!ATLAS[name];

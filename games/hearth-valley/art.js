// Art: one packed atlas (assets/atlas.png, built by tools/pack.py) cut from the LAS Adventure Pack
// and LAS Alchemist Lab by Aleksandr Makarov (iknowkingrabbit), plus small sprites drawn to match.
import atlasUrl from './assets/atlas.png?url';
import { FRAMES } from './frames.js';
import { addFrames } from '../../shared/core/ui.js';

export { FRAMES };
export const ATLAS = 'hv';
export const ATLAS_URL = atlasUrl;

export function buildFrames(scene) { addFrames(scene, ATLAS, FRAMES); }

const urls = {};
/** A data URL for one frame (for the HTML panels), scaled up crisp. */
export function iconUrl(scene, name, scale = 2) {
  const k = `${name}@${scale}`;
  if (urls[k]) return urls[k];
  const f = FRAMES[name];
  if (!f) return '';
  const src = scene.textures.get(ATLAS).getSourceImage();
  const c = document.createElement('canvas');
  c.width = f[2] * scale; c.height = f[3] * scale;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, f[0], f[1], f[2], f[3], 0, 0, f[2] * scale, f[3] * scale);
  urls[k] = c.toDataURL();
  return urls[k];
}

// Art: the packed atlas (atlas/survivors.png, built by tools/build_atlas.py from Aleksandr
// Makarov's RAS Overworld pack) plus a few tiny textures drawn at boot.
import atlasUrl from './atlas/survivors.png?url';
import ATLAS from './atlas/survivors.json';
import { addFrames } from '../../shared/core/ui.js';

export const KEY = 'surv';

export function preloadArt(scene) { scene.load.image(KEY, atlasUrl); }

export function setupArt(scene) {
  addFrames(scene, KEY, ATLAS);
  // The floor as its own texture so a TileSprite can repeat it.
  if (!scene.textures.exists('surv-floor')) {
    const [x, y, w, h] = ATLAS.floor;
    const t = scene.textures.createCanvas('surv-floor', w, h);
    t.context.drawImage(scene.textures.get(KEY).getSourceImage(), x, y, w, h, 0, 0, w, h);
    t.refresh();
  }
  // A soft dot for sparks and a ring for blasts.
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0xffffff).fillRect(0, 0, 3, 3);
  g.generateTexture('surv-dot', 3, 3);
  g.destroy();
}

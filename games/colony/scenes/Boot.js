import Phaser from 'phaser';
import atlasUrl from '../atlas/colony.png?url';
import FRAMES from '../atlas/colony.json';

// One 10 KB sheet packed from the MAS Overworld and MAS Roguelike art by Aleksandr Makarov
// (see atlas/pack.py). Every 8x8 piece becomes a named frame on the 'co' texture.
export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.load.image('co', atlasUrl);
  }

  create() {
    const tex = this.textures.get('co');
    for (const [name, [x, y]] of Object.entries(FRAMES)) if (!tex.has(name)) tex.add(name, 0, x, y, 8, 8);
    const make = (key, w, h, draw) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      draw(g); g.generateTexture(key, w, h); g.destroy();
    };
    make('zstock', 8, 8, (g) => {
      g.fillStyle(0xe3d245, 0.18).fillRect(0, 0, 8, 8);
      g.fillStyle(0xe3d245, 0.7);
      for (let k = 0; k < 8; k += 3) { g.fillRect(k, 0, 2, 1); g.fillRect(0, k, 1, 2); }
    });
    make('dot', 2, 2, (g) => g.fillStyle(0xffffff).fillRect(0, 0, 2, 2));
    make('glow', 48, 48, (g) => { for (let r = 24; r > 0; r -= 3) g.fillStyle(0xd88038, 0.06).fillCircle(24, 24, r); });
    make('sel', 12, 12, (g) => {
      g.fillStyle(0xe3d245);
      for (const [x, y, w, h] of [[0, 0, 4, 1], [0, 0, 1, 4], [8, 0, 4, 1], [11, 0, 1, 4], [0, 11, 4, 1], [0, 8, 1, 4], [8, 11, 4, 1], [11, 8, 1, 4]]) g.fillRect(x, y, w, h);
    });
    this.scene.start('Title');
  }
}

const cache = new Map();
/** A data URL of one atlas frame, scaled up, for HTML panels. */
export function frameURL(game, frame, scale = 4) {
  const key = `${frame}@${scale}`;
  if (cache.has(key)) return cache.get(key);
  const src = game.textures.get('co').getSourceImage();
  const xy = FRAMES[frame];
  if (!xy) return '';
  const c = document.createElement('canvas');
  c.width = 8 * scale; c.height = 8 * scale;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, xy[0], xy[1], 8, 8, 0, 0, 8 * scale, 8 * scale);
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

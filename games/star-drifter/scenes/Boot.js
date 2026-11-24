import Phaser from 'phaser';
import { SHEETS, GRIDS } from '../frames.js';
import { SPECIES } from '../logic/data.js';

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    for (const [key, url] of Object.entries(SHEETS)) this.load.image(key, url);
  }

  create() {
    // 8px grids under an 8px title strip: frames named 'col,row'.
    for (const [key, [cols, rows]] of Object.entries(GRIDS)) {
      const tex = this.textures.get(key);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) tex.add(`${c},${r}`, 0, c * 8, 8 + r * 8, 8, 8);
    }
    // Crew walk cycles (columns 1-4) for every sprite row any species uses.
    const rows = new Set(Object.values(SPECIES).flatMap((s) => s.sprites));
    for (const y of rows) {
      const r = (y - 8) / 8;
      this.anims.create({ key: `walk:${y}`, frames: [1, 2, 3, 4].map((c) => ({ key: 'ch', frame: `${c},${r}` })), frameRate: 8, repeat: -1 });
      this.anims.create({ key: `idle:${y}`, frames: [0, 1].map((c) => ({ key: 'ch', frame: `${c},${r}` })), frameRate: 2, repeat: -1 });
    }
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('gallery')) {
      import('./Gallery.js').then((m) => this.scene.add('Gallery', m.Gallery, true));
      return;
    }
    this.scene.start('Menu');
  }
}

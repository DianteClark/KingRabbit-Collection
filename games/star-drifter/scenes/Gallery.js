import Phaser from 'phaser';
import { GRIDS, ART } from '../frames.js';
import { text } from '../../../shared/core/ui.js';

/** Dev-only sprite check (?gallery): every sheet with frame names, plus the named ART icons. */
export class Gallery extends Phaser.Scene {
  constructor() { super('Gallery'); }
  create() {
    const which = new URLSearchParams(window.location.search).get('gallery') || 'art';
    if (which === 'art') {
      Object.entries(ART).forEach(([name, ref], i) => {
        const [key, f] = ref.split(':');
        const x = 20 + (i % 4) * 88; const y = 30 + Math.floor(i / 4) * 52;
        this.add.image(x, y, key, f).setScale(4);
        text(this, x + 20, y, name, { origin: [0, 0.5] });
      });
      return;
    }
    const [cols, rows] = GRIDS[which];
    const s = which === 'ts' ? 2 : 4;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      this.add.image(10 + c * (8 * s + 4) + 4 * s, 10 + r * (8 * s + 4) + 4 * s, which, `${c},${r}`).setScale(s);
    }
  }
}

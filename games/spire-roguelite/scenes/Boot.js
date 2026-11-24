import Phaser from 'phaser';
import { SHEETS, GRIDS, CREATURE_SHEETS, CREATURE_ROWS, BOSS_SHEETS, ANIMS } from '../frames.js';

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    for (const [key, url] of Object.entries(SHEETS)) this.load.image(key, url);
  }

  create() {
    // 16px / 32px icon grids: frames named 'col,row'
    for (const [key, [size, cols, rows]] of Object.entries(GRIDS)) {
      const tex = this.textures.get(key);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) tex.add(`${c},${r}`, 0, c * size, r * size, size, size);
    }
    // Creatures: frames named 'row:index'
    const addUnit = (key, rows, size, offset, cols) => {
      const tex = this.textures.get(key);
      for (const row of rows) {
        for (let i = 0; i < cols - offset; i++) tex.add(`${row}:${i}`, 0, (i + offset) * size, row, size, size);
        for (const [name, idx] of Object.entries(ANIMS)) {
          this.anims.create({
            key: `${key}:${row}:${name}`,
            frames: idx.map((i) => ({ key, frame: `${row}:${i}` })),
            frameRate: name === 'idle' ? 5 : 10,
            repeat: name === 'idle' ? -1 : 0,
          });
        }
      }
    };
    for (const key of CREATURE_SHEETS) {
      const cols = Math.floor(this.textures.get(key).getSourceImage().width / 16);
      addUnit(key, CREATURE_ROWS, 16, 0, cols);
    }
    for (const [key, b] of Object.entries(BOSS_SHEETS)) addUnit(key, b.rows, 24, b.offset, b.cols);

    if (new URLSearchParams(window.location.search).has('gallery')) { this.scene.start('Gallery'); return; }
    this.scene.start('Menu');
  }
}

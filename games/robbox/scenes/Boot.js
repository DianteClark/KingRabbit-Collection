import Phaser from 'phaser';
import { SHEETS, makeIcons } from '../frames.js';

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    for (const [key, url] of Object.entries(SHEETS)) this.load.image(key, url);
  }

  create() {
    makeIcons(this);
    this.scene.start('Menu');
  }
}

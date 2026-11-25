import Phaser from 'phaser';
import { SHEETS, buildTextures } from '../art.js';

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    for (const [key, url] of Object.entries(SHEETS)) this.load.image(key, url);
  }

  create() {
    buildTextures(this);
    this.scene.start('Title');
  }
}

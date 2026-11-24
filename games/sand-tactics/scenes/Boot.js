import Phaser from 'phaser';
import { SHEETS, makeNeutralSheet } from '../frames.js';

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    for (const [key, url] of Object.entries(SHEETS)) this.load.image(key, url);
  }

  create() {
    makeNeutralSheet(this);
    this.scene.start('Menu');
  }
}

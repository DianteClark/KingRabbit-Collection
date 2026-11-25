import Phaser from 'phaser';
import { ATLAS, ATLAS_URL, buildFrames } from '../art.js';

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() { this.load.image(ATLAS, ATLAS_URL); }

  create() {
    buildFrames(this);
    this.scene.start('Title');
  }
}

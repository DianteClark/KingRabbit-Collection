import Phaser from 'phaser';
import { atlasUrl, KEY, addAtlasFrames } from '../frames.js';

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() { this.load.image(KEY, atlasUrl); }

  create() {
    addAtlasFrames(this);
    this.scene.start('Menu');
  }
}

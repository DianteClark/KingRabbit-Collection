import Phaser from 'phaser';
import { preloadArt, setupArt, carTexture } from '../art.js';
import { startTrophies } from '../trophies.js';
import { save } from '../save.js';

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() { preloadArt(this); }

  create() {
    setupArt(this);
    startTrophies();
    carTexture(this, save.get('car'), save.get('colour'));
    this.scene.start('Title');
  }
}

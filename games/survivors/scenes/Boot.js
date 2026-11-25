import Phaser from 'phaser';
import { preloadArt, setupArt } from '../art.js';
import { startTrophies } from '../trophies.js';

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() { preloadArt(this); }
  create() {
    setupArt(this);
    startTrophies();
    this.scene.start('Title');
  }
}

import Phaser from 'phaser';
import { loadArt } from '../art.js';

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() { loadArt(this); }

  create() { this.scene.start('Menu'); }
}

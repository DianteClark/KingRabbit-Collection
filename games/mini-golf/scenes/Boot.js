import Phaser from 'phaser';
import { SHEETS, makeTextures, addSheetFrames } from '../art.js';
import { bootProgress, save } from '../save.js';
import { newRound } from './flow.js';
import { HOLES, DAILY_HOLES } from '../logic/holes.js';
import { simulate } from '../logic/physics.js';

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    for (const [key, url] of Object.entries(SHEETS)) this.load.image(key, url);
  }

  create() {
    addSheetFrames(this);
    makeTextures(this);
    bootProgress();
    // handy in the browser console and for automated checks
    window.__golfDebug = { save, newRound, HOLES, DAILY_HOLES };
    window.__golfSim = simulate;
    this.scene.start('Menu');
  }
}

import Phaser from 'phaser';
import { addFrames } from '../../../shared/core/ui.js';
import { SHEET_FILES, FRAMES } from '../frames.js';

// Only the FunPack game sheets are bundled into the published game.
const urls = import.meta.glob('../../../shared/assets/mas-mini-retro/MASFunPack-v.1.2/AllGames/*.png', {
  eager: true, query: '?url', import: 'default',
});
const urlFor = (file) => {
  const key = Object.keys(urls).find((k) => k.endsWith(`/${file}.png`));
  return urls[key];
};

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    for (const [key, file] of Object.entries(SHEET_FILES)) this.load.image(key, urlFor(file));
  }

  create() {
    for (const [key, frames] of Object.entries(FRAMES)) addFrames(this, key, frames);
    this.scene.start('Menu');
  }
}

/** 'sheet:frame' -> [sheet, frame] */
export const frameRef = (ref) => ref.split(':');

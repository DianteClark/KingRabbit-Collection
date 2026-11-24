import Phaser from 'phaser';
import { addFrames } from '../../../shared/core/ui.js';
// Only these sheets get bundled into the published game.
import tttSheet from '../../../shared/assets/mas-mini-retro/MASFunPack-v.1.2/AllGames/TicTacToeSpriteSheet.png';
import reversiSheet from '../../../shared/assets/mas-mini-retro/MASFunPack-v.1.2/AllGames/ReversiSpriteSheet.png';
import yachtSheet from '../../../shared/assets/mas-mini-retro/MASFunPack-v.1.2/AllGames/YachtSpriteSheet.png';

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.load.image('ttt', tttSheet);
    this.load.image('reversi', reversiSheet);
    this.load.image('yacht', yachtSheet);
  }

  create() {
    // Rectangles measured from the MASFunPack sheets: [x, y, w, h]
    addFrames(this, 'ttt', { x: [33, 17, 14, 14], o: [17, 17, 14, 14] });
    addFrames(this, 'reversi', { dark: [24, 16, 8, 8], light: [32, 16, 8, 8], cell: [40, 16, 8, 8] });
    addFrames(this, 'yacht', {
      d1: [18, 42, 12, 12], d2: [34, 42, 12, 12],
      d3: [18, 58, 12, 12], d4: [34, 58, 12, 12],
      d5: [18, 74, 12, 12], d6: [34, 74, 12, 12],
      hold: [25, 17, 14, 14],
    });
    this.scene.start('Menu');
  }
}

import Phaser from 'phaser';
import { PALETTE } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { go, modal, shadowTitle, setBackground } from './common.js';
import { save } from '../save.js';

export class Menu extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    setBackground(this, PALETTE.night);
    shadowTitle(this, WIDTH / 2, 92, 'GAME NIGHT');
    text(this, WIDTH / 2, 136, 'Pick a table', { color: PALETTE.lavender });

    const ttt = save.get('ttt');
    const rev = save.get('reversi');
    const best = save.get('yachtBest');

    this.gameButton(232, 'Tic-Tac-Toe', this.add.image(0, 0, 'ttt', 'x').setScale(2),
      `W ${ttt.w}  D ${ttt.d}  L ${ttt.l}`, () => this.chooseMode('TicTacToe'));
    this.gameButton(352, 'Reversi', this.add.image(0, 0, 'reversi', 'dark').setScale(4),
      `W ${rev.w}  D ${rev.d}  L ${rev.l}`, () => this.chooseMode('Reversi'));
    this.gameButton(472, 'Yacht Dice', this.add.image(0, 0, 'yacht', 'd5').setScale(2.5),
      best ? `Best score ${best}` : 'No score yet', () => go(this, 'Yacht'));

    button(this, WIDTH / 2, 590, 220, 44, '< All Games', () => { window.location.href = '../'; }, {
      fill: PALETTE.indigo, color: PALETTE.cream,
    });
  }

  gameButton(y, label, icon, sub, onTap) {
    button(this, WIDTH / 2, y, 280, 72, label, onTap, { fill: PALETTE.cream, icon, size: 16 });
    text(this, WIDTH / 2, y + 50, sub, { color: PALETTE.lavender });
  }

  chooseMode(sceneKey) {
    const m = modal(this, 'Play vs', [], [
      ['Computer', () => go(this, sceneKey, { mode: 'cpu' })],
      ['2 Players', () => go(this, sceneKey, { mode: 'pvp' })],
      ['Cancel', () => m.destroy()],
    ]);
  }
}

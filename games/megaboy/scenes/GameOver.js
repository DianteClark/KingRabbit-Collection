import Phaser from 'phaser';
import { PALETTE } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { LANDSCAPE } from '../../../shared/core/boot.js';
import { STAGES } from '../logic/stages.js';
import { loadProgress, go, header, escBack, guardTaps } from './common.js';
import { skillLabel } from '../adaptive.js';

const { WIDTH } = LANDSCAPE;

export class GameOver extends Phaser.Scene {
  constructor() { super('GameOver'); }

  init(data) { this.stageId = data?.stage || 'foundry'; this.cp = data?.cp ?? -1; }

  create() {
    this._leaving = false;
    guardTaps(this);
    this.cameras.main.setBackgroundColor(PALETTE.night).fadeIn(300);
    header(this, () => go(this, 'Select'));
    escBack(this, () => go(this, 'Select'));
    const p = loadProgress();
    text(this, WIDTH / 2, 70, 'GAME OVER', { size: 32, color: PALETTE.red });
    this.add.sprite(WIDTH / 2, 150, 'hero-buster', 16).setScale(3).setOrigin(0.5, 20 / 24);
    text(this, WIDTH / 2, 186, `${STAGES[this.stageId].name}: continue with ${p.lives} lives`, { color: PALETTE.cream });
    text(this, WIDTH / 2, 210, this.cp >= 0 ? 'You will start from the checkpoint.' : 'You will start from the beginning.', { color: PALETTE.lavender });
    text(this, WIDTH / 2, 234, `Enemies eased off a little (pace ${skillLabel()}/10).`, { color: PALETTE.lavender });
    button(this, WIDTH / 2 - 116, 296, 206, 50, 'Continue', () => go(this, 'Stage', { stage: this.stageId, cp: this.cp }), { fill: PALETTE.gold, size: 32 });
    button(this, WIDTH / 2 + 116, 296, 206, 50, 'Stage Select', () => go(this, 'Select'), { fill: PALETTE.lavender });
  }
}

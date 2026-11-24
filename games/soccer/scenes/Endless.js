import Phaser from 'phaser';
import { PALETTE } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { WIDTH, HEIGHT } from './common.js';
import { header, go, setBackground } from './common.js';
import { save } from '../save.js';
import { kitTexture } from '../sprites.js';
import { endlessOpponent, endlessSkill } from '../logic/cup.js';
import { getSkill } from '../adaptive.js';
import { matchData } from '../flow.js';

/** Endless ladder: wins in a row against gradually stronger teams. */
export class Endless extends Phaser.Scene {
  constructor() { super('Endless'); }

  create(data = {}) {
    setBackground(this, PALETTE.night);
    header(this, 'Endless', () => go(this, 'Menu'));
    const streak = (save.get('endless') || {}).streak || 0;
    const best = save.get('endlessBest') || 0;

    // Left: your run. Right: the next opponent. Kick off underneath.
    panel(this, 16, 58, 236, 212);
    if (data.ended) {
      text(this, 134, 100, 'Run over!', { size: 32, color: PALETTE.orange });
      text(this, 134, 140, `You won ${data.streak} in a row`, { color: PALETTE.cream });
    } else {
      text(this, 134, 100, `${streak}`, { size: 32, color: PALETTE.gold });
      text(this, 134, 140, streak === 1 ? 'win in a row' : 'wins in a row', { color: PALETTE.cream });
    }
    text(this, 134, 172, `Best: ${best}`, { color: PALETTE.lavender });
    ['A bit easier than a', 'normal match; every win', 'sharpens the next team.'].forEach((l, i) => text(this, 134, 206 + i * 20, l, { color: PALETTE.lavender }));

    const opp = endlessOpponent(streak);
    panel(this, 268, 58, 356, 212);
    text(this, 446, 80, `Match ${streak + 1}`, { color: PALETTE.lavender });
    this.add.image(446, 134, kitTexture(this, opp.shirt, opp.shorts, streak % 5), '0_1').setScale(4);
    text(this, 446, 192, opp.name, { size: 32, color: PALETTE.cream });
    text(this, 446, 230, `CPU level ${Math.round(endlessSkill(getSkill(), streak) * 9) + 1}/10`, { color: PALETTE.lavender });

    button(this, WIDTH / 2, 316, 240, 56, data.ended ? 'New run' : 'Kick off!', () => go(this, 'MatchScene', matchData('endless')), { size: 32, fill: PALETTE.gold });
  }
}

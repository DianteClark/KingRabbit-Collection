import Phaser from 'phaser';
import { PALETTE } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { header, go, setBackground, starRow } from './common.js';
import { save } from '../save.js';
import { kitTexture } from '../sprites.js';
import { stars } from '../logic/teams.js';
import { endlessOpponent } from '../logic/cup.js';
import { matchData } from '../flow.js';

/** Endless ladder: wins in a row against gradually stronger teams. */
export class Endless extends Phaser.Scene {
  constructor() { super('Endless'); }

  create(data = {}) {
    setBackground(this, PALETTE.night);
    header(this, 'Endless', () => go(this, 'Menu'));
    const streak = (save.get('endless') || {}).streak || 0;
    const best = save.get('endlessBest') || 0;

    panel(this, 20, 84, 320, 120);
    if (data.ended) {
      text(this, WIDTH / 2, 114, 'Run over!', { size: 32, color: PALETTE.orange });
      text(this, WIDTH / 2, 150, `You won ${data.streak} in a row`, { color: PALETTE.cream });
    } else {
      text(this, WIDTH / 2, 114, `${streak}`, { size: 32, color: PALETTE.gold });
      text(this, WIDTH / 2, 150, streak === 1 ? 'win in a row' : 'wins in a row', { color: PALETTE.cream });
    }
    text(this, WIDTH / 2, 180, `Best: ${best}`, { color: PALETTE.lavender });

    const opp = endlessOpponent(streak);
    text(this, WIDTH / 2, 236, `Match ${streak + 1}`, { color: PALETTE.lavender });
    panel(this, 20, 256, 320, 170);
    this.add.image(WIDTH / 2, 312, kitTexture(this, opp.shirt, opp.shorts, streak % 5), '0_1').setScale(4);
    text(this, WIDTH / 2, 364, opp.name, { size: 32, color: PALETTE.cream });
    starRow(this, WIDTH / 2, 398, stars(opp));

    button(this, WIDTH / 2, 480, 240, 60, data.ended ? 'New run' : 'Kick off!', () => go(this, 'MatchScene', matchData('endless')), { size: 32, fill: PALETTE.gold });
    const lines = ['A bit easier than a normal', 'match, but every win makes', 'the next team sharper.'];
    lines.forEach((l, i) => text(this, WIDTH / 2, 546 + i * 24, l, { color: PALETTE.lavender }));
  }
}

import Phaser from 'phaser';
import { PALETTE } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { WIDTH, HEIGHT } from './common.js';
import { header, go, setBackground, kitChip, starRow } from './common.js';
import { save } from '../save.js';
import { kitTexture } from '../sprites.js';
import { PLAYER_TEAM, TEAMS, stars } from '../logic/teams.js';
import { matchData, matchSkill } from '../flow.js';

/** Quick Match: choose an opponent and kick off. */
export class Pick extends Phaser.Scene {
  constructor() { super('Pick'); }

  create() {
    setBackground(this, PALETTE.night);
    header(this, 'Quick Match', () => go(this, 'Menu'));
    this.idx = Math.max(0, TEAMS.findIndex((t) => t.id === save.get('opponent')));

    // You on the left, the opponent picker on the right, kick off underneath.
    panel(this, 16, 58, 236, 212);
    text(this, 134, 80, 'You', { color: PALETTE.lavender });
    this.add.image(134, 136, kitTexture(this, PLAYER_TEAM.shirt, PLAYER_TEAM.shorts, 1), '0_1').setScale(4);
    text(this, 134, 192, PLAYER_TEAM.name, { size: 32, color: PALETTE.cream });
    kitChip(this, 134, 226, PLAYER_TEAM, 1.4);
    text(this, 134, 252, 'Changes ends at half time', { color: PALETTE.lavender });

    text(this, 284, 160, 'VS', { size: 32, color: PALETTE.gold });

    panel(this, 316, 58, 308, 212);
    text(this, 470, 80, 'Opponent', { color: PALETTE.lavender });
    this.card = this.add.container(0, 0);
    button(this, 350, 160, 44, 64, '<', () => this.cycle(-1), { size: 32 });
    button(this, 590, 160, 44, 64, '>', () => this.cycle(1), { size: 32 });
    this.show();

    button(this, 470, 316, 240, 56, 'Kick off!', () => {
      go(this, 'MatchScene', matchData('quick', TEAMS[this.idx].id));
    }, { size: 32, fill: PALETTE.gold });
    text(this, 170, 306, 'More stars =', { color: PALETTE.lavender });
    text(this, 170, 328, 'a stronger team', { color: PALETTE.lavender });
  }

  cycle(d) {
    this.idx = (this.idx + d + TEAMS.length) % TEAMS.length;
    save.set('opponent', TEAMS[this.idx].id);
    this.show();
  }

  show() {
    const t = TEAMS[this.idx];
    this.card.removeAll(true);
    this.card.add(this.add.image(470, 130, kitTexture(this, t.shirt, t.shorts, this.idx % 5), '0_1').setScale(4));
    this.card.add(text(this, 470, 186, t.name, { size: 32, color: PALETTE.cream }));
    this.card.add(starRow(this, 470, 220, stars(t)));
    this.card.add(text(this, 470, 246, `CPU level ${Math.round(matchSkill('quick', t) * 9) + 1}/10`, { color: PALETTE.lavender }));
  }
}

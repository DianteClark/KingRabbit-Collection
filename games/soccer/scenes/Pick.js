import Phaser from 'phaser';
import { PALETTE } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
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

    panel(this, 20, 80, 320, 130);
    text(this, WIDTH / 2, 102, 'You', { color: PALETTE.lavender });
    kitChip(this, 60, 140, PLAYER_TEAM, 2);
    this.add.image(300, 140, kitTexture(this, PLAYER_TEAM.shirt, PLAYER_TEAM.shorts, 1), '0_1').setScale(3);
    text(this, WIDTH / 2, 132, PLAYER_TEAM.name, { size: 32, color: PALETTE.cream });
    text(this, WIDTH / 2, 170, 'Always attacks upward', { color: PALETTE.lavender });

    text(this, WIDTH / 2, 236, 'VS', { size: 32, color: PALETTE.gold });

    panel(this, 20, 262, 320, 198);
    text(this, WIDTH / 2, 284, 'Opponent', { color: PALETTE.lavender });
    this.card = this.add.container(0, 0);
    button(this, 52, 360, 52, 64, '<', () => this.cycle(-1), { size: 32 });
    button(this, WIDTH - 52, 360, 52, 64, '>', () => this.cycle(1), { size: 32 });
    this.show();

    button(this, WIDTH / 2, 520, 240, 60, 'Kick off!', () => {
      go(this, 'MatchScene', matchData('quick', TEAMS[this.idx].id));
    }, { size: 32, fill: PALETTE.gold });
    text(this, WIDTH / 2, 584, 'More stars = a stronger team', { color: PALETTE.lavender });
  }

  cycle(d) {
    this.idx = (this.idx + d + TEAMS.length) % TEAMS.length;
    save.set('opponent', TEAMS[this.idx].id);
    this.show();
  }

  show() {
    const t = TEAMS[this.idx];
    this.card.removeAll(true);
    this.card.add(this.add.image(WIDTH / 2, 340, kitTexture(this, t.shirt, t.shorts, this.idx % 5), '0_1').setScale(4));
    this.card.add(text(this, WIDTH / 2, 394, t.name, { size: 32, color: PALETTE.cream }));
    this.card.add(starRow(this, WIDTH / 2, 422, stars(t)));
    this.card.add(text(this, WIDTH / 2, 440, `CPU level ${Math.round(matchSkill('quick', t) * 9) + 1}/10`, { color: PALETTE.lavender }));
  }
}

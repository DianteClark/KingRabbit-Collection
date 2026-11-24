import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { isMuted, setMuted } from '../../../shared/core/sfx.js';
import { go, modal, shadowTitle, setBackground, openHowTo } from './common.js';
import { save } from '../save.js';
import { skillLabel, resetSkill } from '../adaptive.js';
import { kitTexture } from '../sprites.js';
import { PLAYER_TEAM, TEAMS, teamById } from '../logic/teams.js';
import { ROUND_NAMES, opponentOf } from '../logic/cup.js';

const LENGTH_LABEL = { short: 'Short', normal: 'Normal', long: 'Long' };
const NEXT_LENGTH = { short: 'normal', normal: 'long', long: 'short' };

export class Menu extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    setBackground(this, PALETTE.night);
    this.drawPitchStrip();
    shadowTitle(this, WIDTH / 2, 40, 'POCKET');
    shadowTitle(this, WIDTH / 2, 76, 'SOCCER');
    button(this, WIDTH - 34, 34, 52, 40, '?', () => openHowTo(this), { size: 32, fill: PALETTE.gold });

    const cup = save.get('cup');
    let cupSub = `Cups won: ${save.get('cupsWon') || 0}`;
    if (cup && cup.alive && !cup.champion) {
      const opp = teamById(opponentOf(cup));
      cupSub = `${ROUND_NAMES[cup.round]} vs ${opp ? opp.short : '?'}`;
    }
    const streak = (save.get('endless') || {}).streak || 0;
    const best = save.get('endlessBest') || 0;
    this.modeButton(250, 'Quick Match', 'Pick any opponent', () => go(this, 'Pick'));
    this.modeButton(326, 'Cup', cupSub, () => go(this, 'Cup'));
    this.modeButton(402, 'Endless', streak ? `Run: ${streak} wins  Best ${best}` : `Best run: ${best} wins`, () => go(this, 'Endless'));

    const r = save.get('record') || { w: 0, d: 0, l: 0 };
    text(this, WIDTH / 2, 462, `W${r.w} D${r.d} L${r.l}   CPU level ${skillLabel()}/10`, { color: PALETTE.lavender });

    this.lengthBtn = button(this, 106, 508, 176, 40, '', () => {
      save.set('length', NEXT_LENGTH[save.get('length')] || 'normal');
      this.syncLength();
    }, { fill: PALETTE.indigo, color: PALETTE.cream });
    this.syncLength();
    button(this, 268, 508, 132, 40, 'Reset CPU', () => {
      const m = modal(this, 'Reset CPU?', ['Put the computer back', 'to level ' + 4 + ' of 10?'], [
        ['Reset', () => { resetSkill(); m.destroy(); this.scene.restart(); }],
        ['Cancel', () => m.destroy()],
      ]);
    }, { fill: PALETTE.indigo, color: PALETTE.cream });

    button(this, 140, 600, 200, 40, '< All Games', () => { window.location.href = '../'; }, {
      fill: PALETTE.indigo, color: PALETTE.cream,
    });
    this.soundBtn = button(this, WIDTH - 52, 600, 88, 40, '', () => { setMuted(!isMuted()); this.syncSound(); });
    this.syncSound();
  }

  /** Strip of real pitch art with two players chasing the ball, as a title picture. */
  drawPitchStrip() {
    const y = 160;
    this.add.tileSprite(WIDTH / 2, y, WIDTH, 72, 'grassTile').setTileScale(2);
    this.add.rectangle(WIDTH / 2, y - 37, WIDTH, 4, hex(PALETTE.ink));
    this.add.rectangle(WIDTH / 2, y + 37, WIDTH, 4, hex(PALETTE.ink));
    const blue = kitTexture(this, PLAYER_TEAM.shirt, PLAYER_TEAM.shorts, 0);
    const red = kitTexture(this, TEAMS[0].shirt, TEAMS[0].shorts, 3);
    const p1 = this.add.image(0, y + 6, blue, '2_8').setScale(3);
    const p2 = this.add.image(0, y + 6, red, '2_8').setScale(3);
    const ball = this.add.image(0, y + 22, 'ball').setScale(3);
    let t = 0;
    this.events.on('update', (_, dt) => {
      t += dt / 1000;
      const x = ((t * 70) % (WIDTH + 160)) - 80;
      const f = 8 + (Math.floor(t * 10) % 4);
      p1.setPosition(x, y + 6).setFrame(`2_${f}`);
      p2.setPosition(x - 46, y + 6).setFrame(`2_${f}`);
      ball.setPosition(x + 22, y + 20 - Math.abs(Math.sin(t * 7)) * 6);
    });
  }

  modeButton(y, label, sub, fn) {
    const b = button(this, WIDTH / 2, y, 280, 64, '', fn, { fill: PALETTE.cream });
    b.face.add(text(this, 0, -11, label, { size: 32, color: PALETTE.night }));
    b.face.add(text(this, 0, 17, sub, { color: PALETTE.indigo }));
    return b;
  }

  syncLength() {
    this.lengthBtn.setLabel(`Length: ${LENGTH_LABEL[save.get('length')] || 'Normal'}`);
  }

  syncSound() {
    this.soundBtn.setLabel(isMuted() ? 'Muted' : 'Sound');
    this.soundBtn.body.setFillStyle(hex(isMuted() ? PALETTE.indigo : PALETTE.leaf));
    this.soundBtn.label.setColor(PALETTE.cream);
  }
}

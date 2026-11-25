import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { WIDTH, HEIGHT } from './common.js';
import { isMuted, setMuted } from '../../../shared/core/sfx.js';
import { go, modal, shadowTitle, setBackground, openHowTo } from './common.js';
import { save } from '../save.js';
import { skillLabel, resetSkill } from '../adaptive.js';
import { kitTexture } from '../sprites.js';
import { PLAYER_TEAM, TEAMS, teamById } from '../logic/teams.js';
import { ROUND_NAMES, opponentOf } from '../logic/cup.js';
import { settleUnfinished, matchData, dailyOpponent } from '../flow.js';

const LENGTH_LABEL = { short: 'Short', normal: 'Normal', long: 'Long' };
const NEXT_LENGTH = { short: 'normal', normal: 'long', long: 'short' };

export class Menu extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    // A Cup or Endless match left without the pause menu counts as quitting it.
    const left = settleUnfinished();
    setBackground(this, PALETTE.night);
    // Left column: title, animated strip, record, settings. Right column: the three modes.
    shadowTitle(this, 164, 34, 'POCKET');
    shadowTitle(this, 164, 70, 'SOCCER');
    this.drawPitchStrip();
    button(this, WIDTH - 30, 26, 44, 38, '?', () => openHowTo(this), { size: 32, fill: PALETTE.gold });

    const cup = save.get('cup');
    let cupSub = `Cups won: ${save.get('cupsWon') || 0}`;
    if (cup && cup.alive && !cup.champion) {
      const opp = teamById(opponentOf(cup));
      cupSub = `${ROUND_NAMES[cup.round]} vs ${opp ? opp.short : '?'}`;
    }
    const streak = (save.get('endless') || {}).streak || 0;
    const best = save.get('endlessBest') || 0;
    this.modeButton(84, 'Quick Match', 'Pick any opponent', () => go(this, 'Pick'));
    this.modeButton(152, 'Cup', cupSub, () => go(this, 'Cup'));
    this.modeButton(220, 'Endless', streak ? `Run: ${streak} wins  Best ${best}` : `Best run: ${best} wins`, () => go(this, 'Endless'));
    const dOpp = dailyOpponent();
    this.modeButton(288, 'Daily Match', `Today: ${dOpp.name}`, () => go(this, 'MatchScene', matchData('daily')));

    const r = save.get('record') || { w: 0, d: 0, l: 0 };
    text(this, 164, 222, `W${r.w} D${r.d} L${r.l}   CPU level ${skillLabel()}/10`, { color: PALETTE.lavender });

    this.lengthBtn = button(this, 90, 266, 160, 40, '', () => {
      save.set('length', NEXT_LENGTH[save.get('length')] || 'normal');
      this.syncLength();
    }, { fill: PALETTE.indigo, color: PALETTE.cream });
    this.syncLength();
    button(this, 246, 266, 132, 40, 'Reset CPU', () => {
      const m = modal(this, 'Reset CPU?', ['Put the computer back', 'to level ' + 4 + ' of 10?'], [
        ['Reset', () => { resetSkill(); m.destroy(); this.scene.restart(); }],
        ['Cancel', () => m.destroy()],
      ]);
    }, { fill: PALETTE.indigo, color: PALETTE.cream });

    button(this, 110, 322, 200, 40, '< All Games', () => { window.location.href = '../'; }, {
      fill: PALETTE.indigo, color: PALETTE.cream,
    });
    this.soundBtn = button(this, 266, 322, 92, 40, '', () => { setMuted(!isMuted()); this.syncSound(); });
    this.syncSound();
    if (left) {
      const what = left.data.mode === 'cup' ? 'Cup' : 'Endless';
      const after = left.data.mode === 'cup' ? 'You are out of the cup.' : `Your run ended at ${left.res.streak} wins.`;
      const m = modal(this, 'Match lost', [`You left your ${what} match`, 'before the end, so it', 'counts as a 3-0 defeat.', after], [
        ['OK', () => { m.destroy(); this.scene.restart(); }],
      ]);
    }
  }

  /** Strip of real pitch art with two players chasing the ball, as a title picture. */
  drawPitchStrip() {
    const y = 150;
    this.stripW = 328;
    this.add.tileSprite(164, y, this.stripW, 72, 'grassTile').setTileScale(2);
    this.add.rectangle(164, y - 37, this.stripW, 4, hex(PALETTE.ink));
    this.add.rectangle(164, y + 37, this.stripW, 4, hex(PALETTE.ink));
    const blue = kitTexture(this, PLAYER_TEAM.shirt, PLAYER_TEAM.shorts, 0);
    const red = kitTexture(this, TEAMS[0].shirt, TEAMS[0].shorts, 3);
    const p1 = this.add.image(0, y + 6, blue, '2_8').setScale(3);
    const p2 = this.add.image(0, y + 6, red, '2_8').setScale(3);
    const ball = this.add.image(0, y + 22, 'ball').setScale(3);
    // Keep the runners inside the strip.
    const shape = this.make.graphics({ add: false });
    shape.fillStyle(0xffffff).fillRect(0, y - 35, this.stripW, 70);
    const mask = shape.createGeometryMask();
    [p1, p2, ball].forEach((o) => o.setMask(mask));
    this.stripT = 0;
    this.strip = { p1, p2, ball, y };
  }

  update(_, dt) {
    const { p1, p2, ball, y } = this.strip;
    const t = (this.stripT += dt / 1000);
    const x = ((t * 70) % (this.stripW + 120)) - 40;
    const f = 8 + (Math.floor(t * 10) % 4);
    p1.setPosition(Math.round(x), y + 6).setFrame(`2_${f}`);
    p2.setPosition(Math.round(x - 46), y + 6).setFrame(`2_${f}`);
    ball.setPosition(Math.round(x + 22), Math.round(y + 20 - Math.abs(Math.sin(t * 7)) * 6));
  }

  modeButton(y, label, sub, fn) {
    const b = button(this, 484, y, 272, 60, '', fn, { fill: PALETTE.cream });
    b.face.add(text(this, 0, -9, label, { size: 32, color: PALETTE.night }));
    b.face.add(text(this, 0, 15, sub, { color: PALETTE.indigo }));
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

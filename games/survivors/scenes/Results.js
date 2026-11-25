import Phaser from 'phaser';
import { PALETTE } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { WIDTH, M, header, go, setBackground } from './common.js';
import { KEY } from '../art.js';
import { CHARACTERS, WEAPONS, PASSIVES, EVOLUTIONS } from '../logic/data.js';
import { fmtClock } from '../logic/waves.js';
import { meta } from '../save.js';

/** After a run: what happened and what next. */
export class Results extends Phaser.Scene {
  constructor() { super('Results'); }
  init(data) { this.r = data || {}; }

  create() {
    setBackground(this, PALETTE.night);
    const r = this.r;
    header(this, r.daily ? 'Daily result' : 'Results', () => go(this, 'Title'));
    panel(this, M, 64, 360, 280);
    const big = r.slayer ? 'Victory!' : r.won ? 'You saw the dawn!' : r.quit ? 'Run abandoned' : 'You fell...';
    text(this, M + 180, 92, big, { size: 32, color: r.won ? PALETTE.gold : PALETTE.cream });
    this.add.image(M + 40, 92, KEY, `h_${r.hero}_${r.won ? 0 : 'dead'}`).setScale(2);
    const rows = [
      ['Time survived', fmtClock(r.time)],
      ['Monsters defeated', String(r.kills)],
      ['Level reached', String(r.level)],
      ['Coins earned', String(r.coins)],
    ];
    if (r.daily) rows.push(['Daily score', `${r.score}${r.dailyRes?.isBest ? '  (best!)' : ''}`]);
    rows.forEach(([a, b], i) => {
      const y = 130 + i * 26;
      text(this, M + 24, y, a, { color: PALETTE.lavender, origin: [0, 0.5] });
      text(this, M + 336, y, b, { color: PALETTE.cream, origin: [1, 0.5] });
    });
    // the build
    const icons = [
      ...Object.keys(r.build?.weapons || {}).map((id) => (r.build.evolved[id] ? EVOLUTIONS[r.build.evolved[id]].icon : WEAPONS[id].icon)),
      ...Object.keys(r.build?.passives || {}).map((id) => PASSIVES[id].icon),
    ];
    text(this, M + 24, 268, 'Build', { color: PALETTE.lavender, origin: [0, 0.5] });
    icons.slice(0, 12).forEach((ic, i) => this.add.image(M + 36 + i * 27, 300, KEY, ic).setScale(1.5));

    panel(this, 392, 64, 232, 280);
    const x = 508;
    text(this, x, 92, CHARACTERS[r.hero]?.name || '', { color: PALETTE.gold });
    text(this, x, 116, `Bank: ${meta().coins} coins`, { color: PALETTE.lavender });
    const btns = [
      [r.daily ? 'Try again' : 'Play again', () => go(this, 'Game', { hero: r.hero, easy: r.easy, daily: r.daily, seed: r.seed }), PALETTE.gold],
      ['Heroes & Shop', () => go(this, 'Shop'), PALETTE.lavender],
      ['Menu', () => go(this, 'Title'), PALETTE.lavender],
    ];
    btns.forEach(([label, fn, fill], i) => button(this, x, 168 + i * 54, 200, 44, label, fn, { fill }));
  }
}

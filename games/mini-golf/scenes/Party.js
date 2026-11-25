import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { sfx } from '../../../shared/core/sfx.js';
import { WIDTH, header, go, setBackground, fit } from './common.js';
import { COURSES } from '../logic/holes.js';
import { courseUnlocked } from '../save.js';
import { BALL_COLORS } from '../art.js';
import { startPlay } from './flow.js';

/** Pass-and-play setup: how many players and which course. */
export class Party extends Phaser.Scene {
  constructor() { super('Party'); }

  init() { this.players = this.players || 2; this.course = this.course ?? 0; }

  create() {
    setBackground(this, '#2f4527');
    window.__golfParty = this;
    header(this, 'Pass & play', () => go(this, 'Menu'));
    text(this, WIDTH / 2, 76, 'Share one phone. Everyone plays\neach hole in turn. Lowest total wins.', { color: PALETTE.lavender, wrap: 320 });

    text(this, WIDTH / 2, 138, 'Players', { size: 32, color: PALETTE.gold });
    this.countBtns = [2, 3, 4].map((n, i) => button(this, 90 + i * 90, 186, 76, 48, `${n}`, () => { this.players = n; this.sync(); }, { size: 32 }));
    this.balls = this.add.container(0, 0);

    text(this, WIDTH / 2, 290, 'Course', { size: 32, color: PALETTE.gold });
    this.courseBtns = COURSES.map((c, i) => {
      const open = courseUnlocked(i);
      const b = button(this, WIDTH / 2, 340 + i * 56, 280, 46, open ? c.name : `${c.name} (locked)`, () => { if (open) { this.course = i; this.sync(); } else sfx('error'); }, { fill: PALETTE.lavender });
      fit(b.label, 260);
      if (!open) b.setAlpha(0.5);
      return b;
    });
    if (!courseUnlocked(this.course)) this.course = 0;
    button(this, WIDTH / 2, 560, 280, 52, 'Tee off!', () => { sfx('select'); startPlay(this, { mode: 'party', course: this.course, players: this.players }); }, { fill: PALETTE.gold, silent: true });
    this.sync();
  }

  sync() {
    this.countBtns.forEach((b, i) => b.body.setFillStyle(hex(i + 2 === this.players ? PALETTE.gold : PALETTE.lavender)));
    this.courseBtns.forEach((b, i) => { if (courseUnlocked(i)) b.body.setFillStyle(hex(i === this.course ? PALETTE.gold : PALETTE.lavender)); });
    this.balls.removeAll(true);
    for (let i = 0; i < this.players; i++) {
      const x = WIDTH / 2 + (i - (this.players - 1) / 2) * 76;
      this.balls.add(this.add.image(x - 22, 240, `ball${i}`).setScale(1.5));
      this.balls.add(text(this, x + 6, 240, `P${i + 1}`, { color: BALL_COLORS[i] }));
    }
  }
}

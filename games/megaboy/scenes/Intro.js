import Phaser from 'phaser';
import { PALETTE } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { LANDSCAPE } from '../../../shared/core/boot.js';
import { save } from '../save.js';
import { ROBOT_BOSSES } from '../logic/bosses.js';
import { go, header, escBack, guardTaps } from './common.js';
import { playMusic } from '../music.js';

const { WIDTH } = LANDSCAPE;

// A short story before the first stage select. Tap to go on, or skip.
const PAGES = [
  'Six worker robots kept the city running:\nthe foundry, the cryo lab, the jungle dome,\nthe power plant, the deep mine and the sky port.',
  'Last night Doctor Null rewired them all\nand hid in his fortress at the edge of town.',
  'MegaBoy was built to help, not to fight.\nBut every robot he beats can lend him its power.',
  'Beat all six. Then storm the fortress.',
];

export class Intro extends Phaser.Scene {
  constructor() { super('Intro'); }

  create() {
    this._leaving = false;
    guardTaps(this);
    this.cameras.main.setBackgroundColor(PALETTE.night).fadeIn(300);
    playMusic('select');
    save.set('seenIntro', true);
    header(this, () => this.done());
    escBack(this, () => this.done());
    // the six bosses in a row, lit one by one
    this.bosses = ROBOT_BOSSES.map((k, i) => this.add.sprite(120 + i * 80, 112, `boss-${k}`).setScale(3).play(`boss-${k}-idle`).setAlpha(0.2).setTint(0x47416b));
    this.hero = this.add.sprite(WIDTH / 2, 120, 'hero-buster').setScale(3).play('hero-buster-idle').setVisible(false);
    this.body = text(this, WIDTH / 2, 222, '', { color: PALETTE.cream });
    this.more = text(this, WIDTH / 2, 286, 'Tap to continue', { color: PALETTE.lavender });
    button(this, WIDTH - 80, 330, 128, 40, 'Skip', () => this.done(), { fill: PALETTE.lavender });
    this.page = -1;
    this.next();
    this.input.on('pointerup', (p) => { if (p.y > 60 && !(p.x > WIDTH - 150 && p.y > 305) && !document.getElementById('howto')) this.next(); });
    this.input.keyboard?.on('keydown-SPACE', () => this.next());
    this.input.keyboard?.on('keydown-ENTER', () => this.next());
  }

  next() {
    if (this._leaving) return;
    if (this.time.now - (this.lastTap || -999) < 250) return;
    this.lastTap = this.time.now;
    this.page++;
    if (this.page >= PAGES.length) { this.done(); return; }
    this.body.setText(PAGES[this.page]).setAlpha(0);
    this.tweens.add({ targets: this.body, alpha: 1, duration: 300 });
    if (this.page === 0) this.bosses.forEach((b, i) => this.time.delayedCall(200 + i * 160, () => { b.setAlpha(1).clearTint(); }));
    if (this.page === 1) this.bosses.forEach((b) => b.setTint(0xff8080));
    if (this.page === 2) { this.bosses.forEach((b) => b.setVisible(false)); this.hero.setVisible(true); }
    if (this.page === 3) { this.bosses.forEach((b) => b.setVisible(true).setAlpha(0.35)); this.hero.setScale(3).setY(170); this.more.setText('Tap to start'); }
  }

  done() { go(this, 'Select'); }
}

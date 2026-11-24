import Phaser from 'phaser';
import { PALETTE } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { LANDSCAPE } from '../../../shared/core/boot.js';
import { ROBOT_BOSSES } from '../logic/bosses.js';
import { loadProgress, go, guardTaps } from './common.js';
import { fmtTime } from './Title.js';
import { playMusic, jingle } from '../music.js';

const { WIDTH } = LANDSCAPE;

const STORY = [
  'The Null Engine fell apart in a shower of bolts,',
  'and Doctor Null ran off into the night.',
  '',
  'MegaBoy carried the six robots home and set',
  'their wiring right, one by one.',
  '',
  'By morning the foundry hummed again,',
  'and the city never knew how close it came.',
];

export class Ending extends Phaser.Scene {
  constructor() { super('Ending'); }

  create() {
    this._leaving = false;
    guardTaps(this);
    this.cameras.main.setBackgroundColor(PALETTE.night).fadeIn(800, 249, 245, 239);
    playMusic('ending');
    jingle('clear');
    const p = loadProgress();
    // left: the hero and the six robots, friends again; stats and buttons
    const L = 150; const R = 446;
    text(this, L, 30, 'THE END', { size: 32, color: PALETTE.gold });
    this.add.sprite(L, 116, 'hero-buster').setScale(3).setOrigin(0.5, 20 / 24).play('hero-buster-idle');
    ROBOT_BOSSES.forEach((k, i) => this.add.sprite(L - 100 + i * 40, 160, `boss-${k}`).setOrigin(0.5, 20 / 24).setScale(2).setFlipX(i >= 3).play(`boss-${k}-idle`));
    text(this, L, 188, `Time ${fmtTime(p.time)}   Lives lost ${p.deaths}`, { color: PALETTE.sand });
    text(this, L, 210, `Energy Tanks found ${p.found.length}`, { color: PALETTE.sand });
    button(this, L, 262, 220, 44, 'Stage Select', () => go(this, 'Select'), { fill: PALETTE.gold });
    button(this, L, 314, 220, 40, 'Title screen', () => go(this, 'Title'), { fill: PALETTE.lavender });
    const lines = STORY.map((l, i) => text(this, R, 40 + i * 26, l, { color: PALETTE.cream }).setAlpha(0));
    lines.forEach((t, i) => this.tweens.add({ targets: t, alpha: 1, delay: 500 + i * 380, duration: 500 }));
    text(this, R, 274, 'Thanks for playing!', { color: PALETTE.gold });
    text(this, R, 304, 'Art: Aleksandr Makarov', { color: PALETTE.lavender });
  }
}

import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { showHowTo } from '../../../shared/core/howto.js';
import { RULES } from '../rules.js';
import { store } from '../store.js';
import * as S from '../logic/sim.js';

export class Title extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    this.cameras.main.setBackgroundColor(PALETTE.night);
    // A little street scene: HQ with squad cars out front.
    const g = this.add.graphics();
    g.fillStyle(0x45405a).fillRect(0, 150, WIDTH, 120);
    g.fillStyle(0x4a4858).fillRect(0, 270, WIDTH, 48);
    g.fillStyle(0xb9b6c9, 0.7);
    for (let x = 0; x < WIDTH; x += 18) g.fillRect(x, 293, 9, 2);
    this.add.image(WIDTH / 2, 268, 'b:PoliceStation').setOrigin(0.5, 1).setScale(4);
    this.add.image(64, 268, 'b:C13').setOrigin(0.5, 1).setScale(3);
    this.add.image(300, 268, 'b:R30').setOrigin(0.5, 1).setScale(3);
    this.cars = [0, 1, 2].map((k) => this.add.image(-40 - k * 90, 306, 'car:SmallCar1-R').setScale(4));
    this.light = this.add.graphics();
    text(this, WIDTH / 2, 64, 'City Chief', { size: 32, color: PALETTE.gold });
    text(this, WIDTH / 2, 104, 'You run the police force of Tiny Town.\nKeep the streets safe and the mayor happy.', { color: PALETTE.cream, wrap: 320 });

    const run = store.get('run');
    const best = store.get('best') || {};
    let y = run && !run.over ? 330 : 372;
    if (run && !run.over) {
      button(this, WIDTH / 2, y, 260, 50, `Continue (Day ${run.day}, ${S.MODES[run.mode].label})`, () => this.start(run), { fill: PALETTE.gold });
      y += 60;
    }
    button(this, WIDTH / 2, y, 260, 50, 'New career', () => this.start(S.newGame('career')), { fill: run && !run.over ? PALETTE.lavender : PALETTE.gold });
    text(this, WIDTH / 2, y + 42, `Can be fired. Last ${S.CAREER_DAYS} days to earn the city's respect.`, { color: PALETTE.lavender, wrap: 330 });
    y += 80;
    button(this, WIDTH / 2, y, 260, 50, 'Endless', () => this.start(S.newGame('endless')));
    text(this, WIDTH / 2, y + 42, 'Gentler city, never fired. Just watch it grow.', { color: PALETTE.lavender, wrap: 330 });
    y += 82;
    button(this, 100, y, 150, 44, 'How to play', () => showHowTo(RULES), { fill: PALETTE.cream });
    button(this, 260, y, 150, 44, 'Games', () => { window.location.href = '../'; }, { fill: PALETTE.cream });
    if (best.career || best.endless) text(this, WIDTH / 2, y + 36, `Longest career: ${best.career || 0} days   Endless: ${best.endless || 0} days`, { color: PALETTE.lavender });
    text(this, WIDTH / 2, 628, 'Art: Aleksandr Makarov (BAS Town)', { color: PALETTE.lavender }).setAlpha(0.6);
  }

  update(time, ms) {
    this.light.clear();
    for (const c of this.cars) {
      c.x += ms * 0.09;
      if (c.x > WIDTH + 60) c.x -= WIDTH + 280;
      const b = Math.floor(time / 160) % 2;
      this.light.fillStyle(b ? 0xff3030 : 0x3060ff).fillRect(c.x - 4, c.y - 14, 4, 3);
      this.light.fillStyle(b ? 0x3060ff : 0xff3030).fillRect(c.x, c.y - 14, 4, 3);
    }
  }

  start(state) {
    if (state !== store.get('run')) store.set('run', state);
    this.scene.start('City', { state });
  }
}

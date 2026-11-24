import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { LANDSCAPE } from '../../../shared/core/boot.js';
import { isMuted, setMuted } from '../../../shared/core/sfx.js';
import { save } from '../save.js';
import { newProgress, robotsBeaten } from '../logic/progress.js';
import { resetSkill } from '../adaptive.js';
import { loadProgress, storeProgress, hasGame, go, openHelp, guardTaps } from './common.js';
import { playMusic } from '../music.js';

const { WIDTH, HEIGHT } = LANDSCAPE;

export const fmtTime = (sec) => {
  const s = Math.floor(sec || 0);
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s % 60).padStart(2, '0')}s`;
};

export class Title extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    this._leaving = false;
    guardTaps(this);
    this.cameras.main.setBackgroundColor(PALETTE.night).fadeIn(200);
    document.body.style.background = PALETTE.night;
    playMusic('title');
    const L = 180; const R = 470;
    this.diorama();
    const t = (y, str) => { text(this, L, y + 4, str, { size: 32, color: PALETTE.red }); return text(this, L, y, str, { size: 32, color: PALETTE.gold }); };
    t(36, 'MEGABOY');
    t(74, 'RUN');
    text(this, L, 112, 'six robots, one fortress', { color: PALETTE.lavender });
    text(this, L, 336, 'Art by Aleksandr Makarov', { color: PALETTE.lavender });
    button(this, WIDTH - 30, 26, 48, 40, '?', () => openHelp(), { size: 32, fill: PALETTE.gold });

    const p = hasGame() ? loadProgress() : null;
    if (p) {
      button(this, R, 92, 250, 52, 'Continue', () => this.cont(), { fill: PALETTE.gold, size: 32 });
      const status = p.done ? 'Doctor Null beaten!' : p.fort ? 'Fortress core next' : `${robotsBeaten(p)} of 6 bosses beaten`;
      text(this, R, 134, status, { color: PALETTE.cream });
      button(this, R, 184, 250, 44, 'New Game', () => this.confirmNew(), { fill: PALETTE.lavender });
    } else {
      button(this, R, 110, 250, 56, 'Start', () => this.newGame(), { fill: PALETTE.gold, size: 32 });
    }
    const fin = save.get('finishes') || 0;
    if (fin) text(this, R, 228, `Finished ${fin}x   best ${fmtTime(save.get('bestTime'))}`, { color: PALETTE.sand });
    button(this, R - 56, 284, 138, 42, '< All Games', () => { window.location.href = '../'; }, { fill: PALETTE.indigo, color: PALETTE.cream });
    this.soundBtn = button(this, R + 76, 284, 110, 42, '', () => { setMuted(!isMuted()); this.syncSound(); });
    this.syncSound();
    this.input.keyboard?.on('keydown-ENTER', () => { if (!this.modalOpen) { if (p) this.cont(); else this.newGame(); } });
  }

  syncSound() { this.soundBtn.setLabel(isMuted() ? 'Sound off' : 'Sound on'); }

  cont() { go(this, 'Select'); }

  newGame() {
    storeProgress(newProgress());
    resetSkill();
    save.set('seen', []);
    go(this, 'Intro');
  }

  confirmNew() {
    if (this.modalOpen) return;
    this.modalOpen = true;
    const c = this.add.container(0, 0).setDepth(50);
    c.add(this.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.65).setOrigin(0).setInteractive());
    c.add(panel(this, WIDTH / 2 - 170, 60, 340, 240));
    c.add(text(this, WIDTH / 2, 100, 'Start over?', { size: 32, color: PALETTE.gold }));
    c.add(text(this, WIDTH / 2, 150, 'Beaten bosses, weapons and\nEnergy Tanks will be lost.', { color: PALETTE.cream }));
    c.add(button(this, WIDTH / 2, 210, 210, 44, 'Start over', () => this.newGame(), { fill: PALETTE.gold }));
    c.add(button(this, WIDTH / 2, 262, 210, 40, 'Cancel', () => { c.destroy(); this.modalOpen = false; }, { fill: PALETTE.lavender }));
  }

  /** A strip of the foundry with MegaBoy running and a robot boss waiting. */
  diorama() {
    const g = this.add.container(28, 150).setScale(3);
    const raw = 'tileset';
    const tex = this.textures.get(raw);
    const piece = (name, x, y) => { if (!tex.has(name)) tex.add(name, 0, x, y, 8, 8); return name; };
    for (let x = 0; x < 12; x++) {
      g.add(this.add.image(x * 8, 40, raw, piece(`tt-${x === 0 ? 0 : x === 11 ? 2 : 1}`, 288 + (x === 0 ? 0 : x === 11 ? 16 : 8), 8)).setOrigin(0));
      g.add(this.add.image(x * 8, 48, raw, piece(`tm-${x === 0 ? 0 : x === 11 ? 2 : 1}`, 288 + 24 + (x === 0 ? 0 : x === 11 ? 16 : 8), 24)).setOrigin(0));
    }
    const hero = this.add.sprite(26, 40, 'hero-buster').setOrigin(0.5, 20 / 24).play('hero-buster-runShoot');
    const boss = this.add.sprite(78, 40, 'boss-ember').setOrigin(0.5, 20 / 24).setFlipX(true).play('boss-ember-idle');
    const shot = this.add.image(38, 35, 'sh-pellet');
    g.add([hero, boss, shot]);
    this.tweens.add({ targets: shot, x: 70, duration: 600, repeat: -1, onRepeat: () => { shot.x = 38; } });
    this.tweens.add({ targets: hero, x: 32, yoyo: true, repeat: -1, duration: 900 });
    this.add.rectangle(28, 150 + 168, 288, 3, hex(PALETTE.ink)).setOrigin(0);
  }
}

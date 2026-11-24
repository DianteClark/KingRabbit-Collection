import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel, fadeTo } from '../../../shared/core/ui.js';
import { WIDTH, HEIGHT } from '../../../shared/core/boot.js';
import { isMuted, setMuted } from '../../../shared/core/sfx.js';
import { showHowTo } from '../../../shared/core/howto.js';
import { RULES } from '../rules.js';
import { save } from '../save.js';
import { DUNGEONS } from '../logic/constants.js';

export const fmtTime = (sec) => {
  const s = Math.floor(sec || 0);
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s % 60).padStart(2, '0')}s`;
};

export class Title extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    this.cameras.main.setBackgroundColor(PALETTE.night).fadeIn(200);
    document.body.style.background = PALETTE.night;
    this.diorama(214);
    const t = (y, s) => { text(this, WIDTH / 2, y + 4, s, { size: 32, color: PALETTE.red }); return text(this, WIDTH / 2, y, s, { size: 32, color: PALETTE.gold }); };
    t(52, 'HOLLOW');
    t(92, 'CROWN');
    text(this, WIDTH / 2, 130, 'a pocket sword-and-dungeon quest', { color: PALETTE.lavender });
    button(this, WIDTH - 34, 34, 52, 40, '?', () => showHowTo(RULES), { size: 32, fill: PALETTE.gold });

    const g = save.get('game');
    let y = 330;
    if (g && g.v === 1) {
      const done = DUNGEONS.filter((d) => g.flags[`boss:${d}`]).length;
      button(this, WIDTH / 2, y, 240, 52, 'Continue', () => this.start(false), { fill: PALETTE.gold, size: 32 });
      text(this, WIDTH / 2, y + 42, `${g.maxHp / 2} hearts   ${done}/3 dungeons   ${fmtTime(g.time)}`, { color: PALETTE.cream });
      y += 92;
      button(this, WIDTH / 2, y, 240, 44, 'New Game', () => this.confirmNew(), { fill: PALETTE.lavender });
      y += 60;
    } else {
      button(this, WIDTH / 2, y, 240, 56, 'Start', () => this.start(true), { fill: PALETTE.gold, size: 32 });
      y += 92;
    }
    const fin = save.get('finishes') || 0;
    if (fin) text(this, WIDTH / 2, y - 6, `Crown recovered ${fin}x   best ${fmtTime(save.get('bestTime'))}`, { color: PALETTE.sand });

    button(this, 128, 600, 200, 40, '< All Games', () => { window.location.href = '../'; }, { fill: PALETTE.indigo, color: PALETTE.cream });
    this.soundBtn = button(this, WIDTH - 54, 600, 92, 40, '', () => { setMuted(!isMuted()); this.syncSound(); });
    this.syncSound();
    text(this, WIDTH / 2, 556, 'Art by Aleksandr Makarov', { color: PALETTE.lavender });
  }

  syncSound() { this.soundBtn.setLabel(isMuted() ? 'Sound off' : 'Sound on'); }

  start(fresh) {
    fadeTo(this, () => this.scene.start('Play', { fresh }));
  }

  confirmNew() {
    const c = this.add.container(0, 0).setDepth(50);
    c.add(this.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.65).setOrigin(0).setInteractive());
    c.add(panel(this, 30, 200, 300, 240));
    c.add(text(this, WIDTH / 2, 240, 'Start over?', { size: 32, color: PALETTE.gold }));
    c.add(text(this, WIDTH / 2, 292, 'Your current adventure\nwill be lost.', { color: PALETTE.cream }));
    c.add(button(this, WIDTH / 2, 352, 200, 44, 'Start over', () => { save.set('game', null); this.start(true); }, { fill: PALETTE.gold }));
    c.add(button(this, WIDTH / 2, 406, 200, 40, 'Cancel', () => c.destroy(), { fill: PALETTE.lavender }));
  }

  /** A little strip of the vale: grass, trees, a house, the hero and a slime. */
  diorama(y) {
    const top = y - 64;
    const g = this.add.container(0, top).setScale(2);
    const tile = (c, r, x, yy, w = 1, h = 1) => {
      const key = `t${c}_${r}_${w}_${h}`;
      const tex = this.textures.get('tileset');
      if (!tex.has(key)) tex.add(key, 0, c * 16, r * 16, w * 16, h * 16);
      const im = this.add.image(x * 16, yy * 16, 'tileset', key).setOrigin(0);
      g.add(im);
      return im;
    };
    for (let x = 0; x < 12; x++) for (let yy = 0; yy < 4; yy++) tile(1, 2, x, yy);
    for (let x = 0; x < 12; x++) tile(18 + (x % 2), 0, x, 0);
    tile(0, 35, 7, 0, 5, 3); tile(0, 41, 7, 3, 5, 1);
    tile(16, 0, 0, 1, 2, 2);
    tile(13, 0, 3, 3); tile(14, 0, 5, 2); tile(19, 2, 2, 2);
    tile(10, 0, 3, 1); tile(11, 0, 4, 1); tile(12, 0, 5, 1);
    const hero = this.add.sprite(88, 46, 'A-Walk-Right').setOrigin(0.5, 23 / 32).play('A-Walk-Right');
    const slime = this.add.sprite(150, 54, 'GreenSlime-WalkLeft').setOrigin(0.5, 13 / 16).play('GreenSlime-WalkLeft');
    g.add([hero, slime]);
    this.tweens.add({ targets: hero, x: 112, yoyo: true, repeat: -1, duration: 1800, onYoyo: () => hero.play('A-Walk-Left'), onRepeat: () => hero.play('A-Walk-Right') });
    this.tweens.add({ targets: slime, x: 128, yoyo: true, repeat: -1, duration: 1400 });
    this.add.rectangle(WIDTH / 2, top, WIDTH, 4, hex(PALETTE.ink)).setOrigin(0.5, 1);
    this.add.rectangle(WIDTH / 2, top + 128, WIDTH, 4, hex(PALETTE.ink)).setOrigin(0.5, 0);
  }
}

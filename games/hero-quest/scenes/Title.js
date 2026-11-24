import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel, fadeTo } from '../../../shared/core/ui.js';
import { LANDSCAPE } from '../../../shared/core/boot.js';

const { WIDTH, HEIGHT } = LANDSCAPE;
import { isMuted, setMuted } from '../../../shared/core/sfx.js';
import { showHowTo } from '../../../shared/core/howto.js';
import { RULES } from '../rules.js';
import { save } from '../save.js';
import { DUNGEONS } from '../logic/constants.js';
import { stopMusic } from '../music.js';

export const fmtTime = (sec) => {
  const s = Math.floor(sec || 0);
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s % 60).padStart(2, '0')}s`;
};

export class Title extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    this.cameras.main.setBackgroundColor(PALETTE.night).fadeIn(200);
    stopMusic();
    document.body.style.background = PALETTE.night;
    // Landscape: title and a strip of the vale on the left, the menu on the right.
    const L = 176; const R = 480;
    this.diorama(196);
    const t = (y, str) => { text(this, L, y + 4, str, { size: 32, color: PALETTE.red }); return text(this, L, y, str, { size: 32, color: PALETTE.gold }); };
    t(30, 'HOLLOW');
    t(68, 'CROWN');
    text(this, L, 104, 'a pocket sword-and-dungeon quest', { color: PALETTE.lavender });
    text(this, L, 290, 'Three dungeons stand between\nyou and the stolen Crown.', { color: PALETTE.lavender });
    text(this, L, 336, 'Art by Aleksandr Makarov', { color: PALETTE.lavender });
    button(this, WIDTH - 30, 26, 44, 40, '?', () => showHowTo(RULES), { size: 32, fill: PALETTE.gold });

    const g = save.get('game');
    let y = 110;
    if (g && g.v === 1) {
      const done = DUNGEONS.filter((d) => g.flags[`boss:${d}`]).length;
      button(this, R, y, 240, 52, 'Continue', () => this.start(false), { fill: PALETTE.gold, size: 32 });
      text(this, R, y + 42, `${g.maxHp / 2} hearts   ${done}/3 dungeons   ${fmtTime(g.time)}`, { color: PALETTE.cream });
      y += 92;
      button(this, R, y, 240, 44, 'New Game', () => this.confirmNew(), { fill: PALETTE.lavender });
    } else {
      button(this, R, y + 20, 240, 56, 'Start', () => this.start(true), { fill: PALETTE.gold, size: 32 });
      y += 92;
    }
    const fin = save.get('finishes') || 0;
    if (fin) text(this, R, y + 46, `Crown recovered ${fin}x   best ${fmtTime(save.get('bestTime'))}`, { color: PALETTE.sand });

    button(this, R - 54, 316, 172, 40, '< All Games', () => { window.location.href = '../'; }, { fill: PALETTE.indigo, color: PALETTE.cream });
    this.soundBtn = button(this, R + 88, 316, 100, 40, '', () => { setMuted(!isMuted()); this.syncSound(); });
    this.syncSound();
  }

  syncSound() { this.soundBtn.setLabel(isMuted() ? 'Sound off' : 'Sound on'); }

  start(fresh) {
    fadeTo(this, () => this.scene.start('Play', { fresh }));
  }

  confirmNew() {
    const c = this.add.container(0, 0).setDepth(50);
    c.add(this.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.65).setOrigin(0).setInteractive());
    c.add(panel(this, WIDTH / 2 - 160, 50, 320, 260));
    c.add(text(this, WIDTH / 2, 90, 'Start over?', { size: 32, color: PALETTE.gold }));
    c.add(text(this, WIDTH / 2, 142, 'Your current adventure\nwill be lost.', { color: PALETTE.cream }));
    c.add(button(this, WIDTH / 2, 206, 200, 44, 'Start over', () => { save.set('game', null); this.start(true); }, { fill: PALETTE.gold }));
    c.add(button(this, WIDTH / 2, 262, 200, 40, 'Cancel', () => c.destroy(), { fill: PALETTE.lavender }));
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
    for (let x = 0; x < 11; x++) for (let yy = 0; yy < 4; yy++) tile(1, 2, x, yy);
    for (let x = 0; x < 11; x++) tile(18 + (x % 2), 0, x, 0);
    tile(0, 35, 6, 0, 5, 3); tile(0, 41, 6, 3, 5, 1);
    tile(16, 0, 0, 1, 2, 2);
    tile(13, 0, 3, 3); tile(14, 0, 5, 2); tile(19, 2, 2, 2);
    tile(14, 0, 4, 1); tile(18, 2, 5, 3); tile(16, 3, 2, 3);
    const hero = this.add.sprite(88, 46, 'A-Walk-Right').setOrigin(0.5, 23 / 32).play('A-Walk-Right');
    const slime = this.add.sprite(150, 54, 'GreenSlime-WalkLeft').setOrigin(0.5, 13 / 16).play('GreenSlime-WalkLeft');
    g.add([hero, slime]);
    this.tweens.add({ targets: hero, x: 112, yoyo: true, repeat: -1, duration: 1800, onYoyo: () => hero.play('A-Walk-Left'), onRepeat: () => hero.play('A-Walk-Right') });
    this.tweens.add({ targets: slime, x: 128, yoyo: true, repeat: -1, duration: 1400 });
    this.add.rectangle(0, top, 352, 4, hex(PALETTE.ink)).setOrigin(0, 1);
    this.add.rectangle(0, top + 128, 352, 4, hex(PALETTE.ink)).setOrigin(0, 0);
    this.add.rectangle(352, top - 4, 4, 136, hex(PALETTE.ink)).setOrigin(0, 0);
  }
}

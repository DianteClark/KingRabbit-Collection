import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { WIDTH, HEIGHT, go, store, persist, shadowTitle, fmtTime, openHowTo } from './common.js';
import { closeAll } from './panels.js';
import { CLASSES } from '../logic/data.js';
import { chestCounts } from '../logic/game.js';
import { playMusic, jingle } from '../music.js';
import { save } from '../save.js';
import { checkTrophies } from '../trophies.js';

const PAGES = [
  ['Vesper\'s dark melts away like frost in the morning.', 'The three Chimes ring together, all on their own.'],
  ['Far to the south, in Brightwater, the Sun Bell answers.', 'Its song rolls over the hills, the sea and the snow.'],
  ['And for the first time in many nights...', 'the sun rises.'],
  ['Ash, Sola, Kit and Wren walk home through a golden morning.', 'Brightwater will sing of them for a hundred years.'],
];

export class Ending extends Phaser.Scene {
  constructor() { super('Ending'); }

  create() {
    closeAll();
    this.__leaving = false;
    const st = store.state;
    this.cameras.main.setBackgroundColor('#120f22').fadeIn(600);
    playMusic('ending');
    jingle('chime');
    if (st) {
      st.flags.vesper = true;
      persist();
      save.set('cleared', (save.get('cleared') || 0) + 1);
      const best = save.get('bestTime');
      if (!best || st.playMs < best) save.set('bestTime', st.playMs);
      checkTrophies(st);
    }
    // Sky that brightens page by page, a sun that rises over the hill.
    this.sky = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x120f22).setOrigin(0);
    this.sun = this.add.circle(WIDTH / 2, 420, 60, 0xe3d245);
    this.add.rectangle(0, 380, WIDTH, 260, hex('#2f4a2c')).setOrigin(0);
    for (let x = 0; x < WIDTH; x += 32) this.add.image(x, 372, 'atlas', 'grass').setOrigin(0).setScale(2);
    ['warrior', 'cleric', 'thief', 'mage'].forEach((cls, i) => {
      const img = this.add.image(72 + i * 72, 352, 'atlas', `c${CLASSES[cls].ch}_6`).setScale(4);
      this.tweens.add({ targets: img, y: 348, duration: 400 + i * 50, yoyo: true, repeat: -1, ease: 'Stepped' });
    });
    this.add.image(WIDTH / 2, 470, 'atlas', 'bell').setScale(4);
    this.lines = [text(this, WIDTH / 2, 110, '', { color: PALETTE.cream, wrap: WIDTH - 40 }).setDepth(20), text(this, WIDTH / 2, 170, '', { color: PALETTE.cream, wrap: WIDTH - 40 }).setDepth(20)];
    this.hint = text(this, WIDTH / 2, 600, 'Tap to continue', { color: PALETTE.lavender });
    this.tweens.add({ targets: this.hint, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
    button(this, WIDTH - 30, 30, 48, 40, '?', () => openHowTo(this), { size: 32, fill: PALETTE.gold }).setDepth(30);
    // Skip straight to the credits.
    button(this, 30, 30, 48, 40, '<', () => { if (this.page < PAGES.length) { this.page = PAGES.length - 1; this.next(); } else go(this, 'Title'); }, { size: 32, fill: PALETTE.cream }).setDepth(30);
    this.page = -1;
    this.lastTap = 0;
    this.input.on('pointerup', (p) => { if (p.y > 60 && this.page < PAGES.length && Date.now() - this.lastTap > 350) { this.lastTap = Date.now(); this.next(); } });
    this.next();
  }

  next() {
    this.page++;
    if (this.page < PAGES.length) {
      const [a, b] = PAGES[this.page];
      this.lines[0].setText(a); this.lines[1].setText(b);
      const k = (this.page + 1) / PAGES.length;
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0x120f22), Phaser.Display.Color.ValueToColor(0x7fb2ec), 1, k);
        this.sky.setFillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      this.tweens.add({ targets: this.sun, y: 420 - k * 130, duration: 900, ease: 'Sine.out' });
      for (const t of this.lines) { t.setAlpha(0); this.tweens.add({ targets: t, alpha: 1, duration: 500 }); }
      return;
    }
    if (this.page === PAGES.length) { this.credits(); return; }
  }

  credits() {
    const st = store.state;
    this.lines.forEach((t) => t.setVisible(false));
    this.hint.setVisible(false);
    this.add.rectangle(WIDTH / 2, 214, WIDTH - 24, 332, hex(PALETTE.night), 0.94).setStrokeStyle(3, hex(PALETTE.cream)).setDepth(10);
    shadowTitle(this, WIDTH / 2, 76, 'THE END').setDepth(11);
    this.children.list.filter((o) => o.type === 'Text' && o.y < 90 && o.y > 70).forEach((t) => t.setDepth(11));
    const c = st ? chestCounts(st) : { open: 0, total: 0 };
    const rows = [
      'Pixel Quest',
      st ? `Time: ${fmtTime(st.playMs || 0)}   Level ${Math.max(...st.party.map((m) => m.lv))}` : '',
      st ? `Battles won: ${st.wins}   Chests: ${c.open}/${c.total}` : '',
      st ? `Difficulty: ${st.difficulty === 'story' ? 'Story' : 'Normal'}` : '',
      '',
      'Art: Aleksandr Makarov',
      '(RAS Overworld, MAS Roguelike,',
      'MAS Darkness Pack)',
      'Font: BoldPixels by YukiPixels',
      'Story, music and code: original',
    ];
    rows.forEach((r, i) => text(this, WIDTH / 2, 116 + i * 26, r, { color: i === 0 ? PALETTE.gold : i >= 5 ? PALETTE.lavender : PALETTE.cream }).setDepth(11));
    button(this, WIDTH / 2, 600, 260, 48, 'Back to title', () => go(this, 'Title'), { fill: PALETTE.gold }).setDepth(30);
  }
}

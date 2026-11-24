import Phaser from 'phaser';
import { PALETTE, hex, text, button, panel, WIDTH, DARK, go, setBackground, helpButton, backButton, creature } from './common.js';
import { save, getRecords, saveRun } from '../save.js';
import { CLASSES } from '../logic/data.js';
import { newRun } from '../logic/game.js';
import { getSkill } from '../adaptive.js';
import { fx } from '../music.js';

const MODES = {
  normal: 'The full challenge. Your torch burns fast and monsters hit hard.',
  lantern: 'Easier: a brighter, longer-lasting light, more healing, slower hunger and two healing potions.',
};

export class ClassSelect extends Phaser.Scene {
  constructor() { super('ClassSelect'); }

  init(data) { this.daily = data?.daily || null; }

  create() {
    setBackground(this, DARK.void);
    this.cls = save.get('lastCls') in CLASSES ? save.get('lastCls') : 'knight';
    this.mode = this.daily ? 'normal' : (save.get('lastMode') === 'lantern' ? 'lantern' : 'normal');
    backButton(this, () => go(this, 'Title'));
    helpButton(this);
    text(this, WIDTH / 2, 26, this.daily ? 'Daily Run' : 'Choose your hero', { color: PALETTE.gold });

    this.cards = Object.entries(CLASSES).map(([id, c], i) => {
      const y = 58 + i * 122;
      const con = this.add.container(0, 0);
      const frame = this.add.graphics();
      con.add(frame);
      con.add(this.add.rectangle(46, y + 56, 64, 64, hex(DARK.navy)).setStrokeStyle(2, hex(DARK.blue)));
      con.add(creature(this, 46, y + 56, c.spr, 3));
      con.add(text(this, 90, y + 14, c.name, { color: PALETTE.gold, origin: [0, 0] }));
      con.add(text(this, 90 + 80, y + 14, `${c.hp} HP`, { color: DARK.rose, origin: [0, 0] }));
      con.add(text(this, 90, y + 38, c.blurb, { color: PALETTE.cream, origin: [0, 0], wrap: 252, align: 'left' }));
      const hit = this.add.zone(WIDTH / 2, y + 56, 344, 114).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => { if (this.cls !== id) { this.cls = id; fx('select'); this.syncCards(); } });
      con.add(hit);
      con.frame = frame; con.y0 = y; con.id = id;
      return con;
    });

    if (this.daily) {
      const r = getRecords();
      const best = r.today && r.today.date === this.daily ? `Your best today: ${r.today.bestScore}${r.today.won ? ' (won!)' : ''}` : 'No tries yet today.';
      panel(this, 8, 430, WIDTH - 16, 104, { fill: DARK.navy, inner: DARK.blue });
      text(this, WIDTH / 2, 452, `Dungeon of ${this.daily}`, { color: PALETTE.gold });
      text(this, WIDTH / 2, 486, 'The same floors for everyone today.\nNormal rules.', { color: PALETTE.cream });
      text(this, WIDTH / 2, 520, best, { color: DARK.rose });
    } else {
      this.modeBtns = ['normal', 'lantern'].map((m, i) => button(this, 96 + i * 168, 452, 156, 44, m === 'normal' ? 'Normal' : 'Lantern', () => { this.mode = m; this.syncMode(); }));
      this.modeText = text(this, WIDTH / 2, 500, '', { color: PALETTE.cream, wrap: 330 }).setOrigin(0.5, 0);
      this.syncMode();
    }
    this.startBtn = button(this, WIDTH / 2, 598, 300, 50, 'Enter the Darkhold', () => this.begin(), { fill: PALETTE.gold });
    this.syncCards();
  }

  syncCards() {
    for (const c of this.cards) {
      const on = c.id === this.cls;
      c.frame.clear();
      c.frame.fillStyle(hex(PALETTE.ink)).fillRect(8, c.y0, WIDTH - 16, 114);
      c.frame.fillStyle(hex(on ? PALETTE.gold : DARK.blue)).fillRect(11, c.y0 + 3, WIDTH - 22, 108);
      c.frame.fillStyle(hex(on ? '#2d2440' : DARK.navy)).fillRect(14, c.y0 + 6, WIDTH - 28, 102);
    }
  }

  syncMode() {
    this.modeBtns.forEach((b, i) => {
      const on = (i === 0 ? 'normal' : 'lantern') === this.mode;
      b.body.setFillStyle(hex(on ? PALETTE.gold : PALETTE.indigo));
      b.label.setColor(on ? PALETTE.night : PALETTE.cream);
    });
    this.modeText.setText(MODES[this.mode]);
  }

  begin() {
    if (this._started) return;
    this._started = true;
    save.set('lastCls', this.cls);
    if (!this.daily) save.set('lastMode', this.mode);
    const skill = this.daily ? 0.5 : getSkill(this.mode);
    const run = newRun({ cls: this.cls, mode: this.mode, daily: this.daily, skill });
    saveRun(run);
    fx('stairs');
    go(this, 'Play', { run, fresh: true });
  }
}

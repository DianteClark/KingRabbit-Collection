import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { go, modal, shadowTitle, setBackground } from './common.js';
import { save, getRecord, getBest, getLevel, setLevel, LEVEL_NAMES } from '../save.js';
import { isMuted, setMuted } from '../../../shared/core/sfx.js';
import { CATEGORIES, TABLES } from '../tables.js';
import { frameRef } from './Boot.js';

const TILE_W = 156;
const TILE_H = 96;
const GRID_TOP = 168;

export class Menu extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    setBackground(this, PALETTE.night);
    shadowTitle(this, WIDTH / 2, 44, 'GAME NIGHT');

    // Category tabs
    this.tab = save.get('tab') || 'board';
    this.tabButtons = CATEGORIES.map((c, i) => button(this, 48 + i * 88, 104, 82, 40, c.name, () => this.showTab(c.id)));

    this.grid = this.add.container(0, 0);
    this.showTab(this.tab);

    button(this, WIDTH / 2, 612, 200, 40, '< All Games', () => { window.location.href = '../'; }, {
      fill: PALETTE.indigo, color: PALETTE.cream,
    });
    this.soundBtn = button(this, WIDTH - 40, 612, 64, 40, '', () => { setMuted(!isMuted()); this.syncSound(); });
    this.syncSound();
  }

  syncSound() {
    this.soundBtn.setLabel(isMuted() ? 'Mute' : 'Sound');
    this.soundBtn.body.setFillStyle(hex(isMuted() ? PALETTE.indigo : PALETTE.leaf));
    this.soundBtn.label.setColor(PALETTE.cream);
  }

  showTab(id) {
    this.tab = id;
    save.set('tab', id);
    CATEGORIES.forEach((c, i) => {
      const on = c.id === id;
      this.tabButtons[i].body.setFillStyle(hex(on ? PALETTE.gold : PALETTE.indigo));
      this.tabButtons[i].label.setColor(on ? PALETTE.night : PALETTE.cream);
    });

    this.grid.removeAll(true);
    TABLES.filter((t) => t.cat === id).forEach((t, i) => {
      const x = 24 + (i % 2) * (TILE_W + 16) + TILE_W / 2;
      const y = GRID_TOP + Math.floor(i / 2) * (TILE_H + 8) + TILE_H / 2;
      this.grid.add(this.tile(x, y, t));
    });
  }

  tile(x, y, t) {
    const ready = Boolean(t.scene);
    const [sheet, frame] = frameRef(t.icon[0]);
    const c = button(this, x, y, TILE_W, TILE_H, '', () => this.open(t), { fill: ready ? PALETTE.cream : PALETTE.indigo });
    const icon = this.add.image(0, -18, sheet, frame).setScale(t.icon[1]).setAlpha(ready ? 1 : 0.4);
    c.face.add([
      icon,
      text(this, 0, 14, t.name, { color: ready ? PALETTE.night : PALETTE.lavender }),
      text(this, 0, 34, ready ? this.subtitle(t) : 'Coming soon', { color: ready ? PALETTE.indigo : PALETTE.lavender }),
    ]);
    return c;
  }

  subtitle(t) {
    if (t.score === 'record') {
      const r = getRecord(t.id);
      return t.modes.includes('cpu') ? `W${r.w} D${r.d} L${r.l}` : `Won ${r.w}`;
    }
    const b = getBest(t.id);
    return b ? `Best ${b}` : 'No score yet';
  }

  open(t) {
    if (!t.scene) return;
    const start = (mode) => {
      if (mode === 'pvp' || !t.levels) { go(this, t.scene, { mode }); return; }
      this.pickLevel(t, (level) => go(this, t.scene, { mode, level }));
    };
    if (t.modes.length === 1) { start(t.modes[0]); return; }
    const m = modal(this, t.name, [], [
      ['vs Computer', () => { m.destroy(); start('cpu'); }],
      ['2 Players', () => start('pvp')],
      ['Cancel', () => m.destroy()],
    ]);
  }

  pickLevel(t, done) {
    const last = getLevel(t.id);
    const choose = (lv) => { setLevel(t.id, lv); done(lv); };
    const m = modal(this, 'Difficulty', [`${t.name}  (last: ${LEVEL_NAMES[last]})`], [
      ['Easy', () => choose('easy'), PALETTE.leaf, PALETTE.cream],
      ['Normal', () => choose('normal'), PALETTE.gold],
      ['Hard', () => choose('hard'), PALETTE.red, PALETTE.cream],
      ['Cancel', () => m.destroy()],
    ]);
  }
}

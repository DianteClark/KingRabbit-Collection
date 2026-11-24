import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { go, modal, shadowTitle, setBackground } from './common.js';
import { save, getRecord, getBest } from '../save.js';
import { skillLabel, resetSkill } from '../adaptive.js';
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
      this.fitSub(ready ? this.subtitle(t) : ['Coming soon'], ready),
    ]);
    return c;
  }

  /** The first of the subtitle options that fits inside the tile. */
  fitSub(options, ready) {
    const t = text(this, 0, 34, '', { color: ready ? PALETTE.indigo : PALETTE.lavender });
    for (const o of options) { t.setText(o); if (t.width <= TILE_W - 12) break; }
    return t;
  }

  /** Subtitle options, longest first (long records drop the CPU level, then squeeze). */
  subtitle(t) {
    if (t.score === 'record') {
      const r = getRecord(t.id);
      if (!t.modes.includes('cpu')) return [`Won ${r.w}`];
      const lv = skillLabel(t.id);
      return [`W${r.w} L${r.l}  CPU ${lv}`, `W${r.w} L${r.l} CPU${lv}`, `W${r.w} L${r.l}`];
    }
    const b = getBest(t.id);
    if (t.modes.includes('cpu') && t.id === 'yacht') {
      return [`Best ${b}  CPU ${skillLabel(t.id)}`, `Best ${b} CPU${skillLabel(t.id)}`, `Best ${b}`];
    }
    return [b ? `Best ${b}` : 'No score yet'];
  }

  open(t) {
    if (!t.scene) return;
    const label = { solo: 'Solo', cpu: 'vs Computer', pvp: '2 Players' };
    if (!t.levels && t.modes.length === 1) { go(this, t.scene, { mode: t.modes[0] }); return; }
    const lines = t.levels ? [`CPU level ${skillLabel(t.id)}/10`, 'It adapts as you win or lose'] : [];
    const buttons = t.modes.map((mode) => [t.modes.length === 1 ? 'Play' : label[mode], () => { m.destroy(); go(this, t.scene, { mode }); }]);
    if (t.levels) {
      buttons.push(['Reset CPU level', () => {
        m.destroy(); resetSkill(t.id); this.showTab(this.tab);
        this.open(t);
      }, PALETTE.indigo, PALETTE.cream]);
    }
    buttons.push(['Cancel', () => m.destroy()]);
    const m = modal(this, t.name, lines, buttons);
  }
}

import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { sfx } from '../../../shared/core/sfx.js';
import { header, go, setBackground, statBar, modal } from './common.js';
import { save } from '../save.js';
import { carTexture, headingFrame, PAINT_HEX } from '../art.js';
import { MODELS, COLOURS, modelById } from '../logic/car.js';
import { carUnlocked } from '../logic/cup.js';
import { CUPS } from '../logic/tracks.js';

export class Garage extends Phaser.Scene {
  constructor() { super('Garage'); }

  create() {
    setBackground(this, PALETTE.night);
    header(this, 'Garage', () => go(this, 'Title'));
    panel(this, 14, 54, 290, 296);
    this.preview = this.add.image(158, 118, carTexture(this, save.get('car'), save.get('colour')), '0').setScale(5);
    this.nameText = text(this, 158, 186, '', { size: 32, color: PALETTE.gold });
    this.statsBox = this.add.container(0, 0);
    this.carBtns = [];
    const prog = save.get('progress');
    MODELS.forEach((m, i) => {
      const x = 398 + (i % 2) * 152; const y = 82 + Math.floor(i / 2) * 52;
      const open = carUnlocked(prog, m.id);
      const b = button(this, x, y, 144, 44, open ? m.name : 'Locked', () => this.pickCar(m, open), {
        fill: PALETTE.lavender, color: open ? PALETTE.night : PALETTE.indigo,
      });
      b.model = m; b.open = open;
      this.carBtns.push(b);
    });
    text(this, 474, 232, 'Paint', { color: PALETTE.lavender });
    this.swatches = COLOURS.map((c, i) => {
      const x = 370 + (i % 4) * 70; const y = 268 + Math.floor(i / 4) * 52;
      const b = button(this, x, y, 60, 44, '', () => this.pickColour(c.id), { fill: PAINT_HEX[c.id], silent: true });
      b.colour = c.id;
      return b;
    });
    this.t = 0;
    this.sync();
  }

  pickCar(m, open) {
    if (!open) {
      sfx('error');
      const cup = CUPS.find((c) => c.id === m.unlock);
      modal(this, m.name, ['Locked.', `Win the ${cup.name} to unlock it.`], [['OK', null]]);
      return;
    }
    save.set('car', m.id);
    this.sync();
  }

  pickColour(id) {
    sfx('select');
    save.set('colour', id);
    this.sync();
  }

  sync() {
    const m = modelById(save.get('car'));
    this.preview.setTexture(carTexture(this, m.id, save.get('colour')), headingFrame(this.t));
    this.nameText.setText(m.name);
    this.statsBox.removeAll(true);
    const s = m.stats;
    [['Speed', s.speed], ['Accel', s.accel], ['Grip', s.grip], ['Drift', s.drift]].forEach(([l, n], i) => {
      this.statsBox.add(statBar(this, 64, 224 + i * 30, l, n));
    });
    for (const b of this.carBtns) b.body.setFillStyle(hex(b.model.id === m.id ? PALETTE.gold : PALETTE.lavender));
    for (const b of this.swatches) b.face.list[0].setFillStyle(hex(b.colour === save.get('colour') ? PALETTE.gold : PALETTE.night));
  }

  update(_, dt) {
    this.t += dt / 1000 * 0.9;
    this.preview.setFrame(headingFrame(-this.t));
  }
}

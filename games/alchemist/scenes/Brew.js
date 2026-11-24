import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { sfx } from '../../../shared/core/sfx.js';
import { WIDTH, HEIGHT, go, setBackground, store, persist, header, statBar, toast, once, starRow } from './common.js';
import { showTip, showBook, anyOpen, closeAll } from './panels.js';
import * as G from '../logic/game.js';
import { INGREDIENTS, ING_ORDER, POTIONS, ELEMENTS, EL_INFO } from '../logic/data.js';
import { stirZone, needleAt, stirHit, STIR } from '../logic/brew.js';
import { playMusic, bubble, jingle } from '../music.js';

const GRID_TOP = 366;
const CELL_W = 68;
const CELL_H = 52;
const COLS = 5;
const ROWS = 4;
const BAR_X = 40;
const BAR_W = 280;

export class Brew extends Phaser.Scene {
  constructor() { super('Brew'); }

  create() {
    closeAll();
    this.input.enabled = true;
    this.s = store.s;
    if (!this.s) { this.scene.start('Title'); return; }
    setBackground(this, PALETTE.night);
    playMusic('shop');
    this.pot = [];
    this.page = 0;
    this.game2 = null;
    // the brewing corner
    const g = this.add.graphics();
    g.fillStyle(0x3a2a3e).fillRect(0, 86, WIDTH, 200);
    g.fillStyle(0x5e3a26).fillRect(0, 230, WIDTH, 56);
    for (let x = 0; x < WIDTH; x += 40) g.fillStyle(0x4a2c1e).fillRect(x, 230, 3, 56);
    this.add.image(20, 230, 'lab', 'books').setOrigin(0, 1).setScale(3);
    this.add.image(300, 230, 'lab', 'tableDistill').setOrigin(0.5, 1).setScale(3).setCrop(0, 0, 32, 26);
    this.add.image(WIDTH / 2, 248, 'shadow').setScale(4).setAlpha(0.5);
    this.cauldron = this.add.image(WIDTH / 2, 252, 'lab', 'cauldron').setOrigin(0.5, 1).setScale(4);
    this.smoke = this.add.sprite(WIDTH / 2, 126, 'smoke').play('smoke').setScale(2.5).setAlpha(0.6).setTint(0xd8a0f0);
    header(this, 'Cauldron', () => this.back());
    this.bar = statBar(this);
    this.potLayer = this.add.container(0, 0);
    this.gridLayer = this.add.container(0, 0);
    this.add.rectangle(0, 286, WIDTH, HEIGHT - 286, hex('#2b2238')).setOrigin(0).setDepth(-1);
    this.clearBtn = button(this, 60, 604, 104, 48, 'Clear', () => { if (this.busy()) return; this.pot = []; sfx('tap'); this.redraw(); });
    button(this, 170, 604, 100, 48, 'Book', () => { if (!this.busy()) showBook(this.s); }, { fill: PALETTE.cream });
    this.brewBtn = button(this, 286, 604, 132, 48, 'Brew!', () => this.startBrew(), { fill: PALETTE.gold });
    this.redraw();
    if (!this.s.tut.brewTip) {
      this.s.tut.brewTip = true; persist();
      this.time.delayedCall(250, () => showTip('Brewing', `<p class="al-p">Tap 2 or 3 ingredients to put them in the pot. The coloured dots are their elements: <b style="color:${EL_INFO.fire.color}">Fire</b>, <b style="color:${EL_INFO.water.color}">Water</b>, <b style="color:${EL_INFO.earth.color}">Earth</b>, <b style="color:${EL_INFO.air.color}">Air</b> and <b style="color:${EL_INFO.life.color}">Life</b>.</p>
        <p class="al-p">One strong element makes a pure potion: two Rose Petals (Life) make a Healing Salve. Two strong elements make a pair potion.</p>
        <p class="al-p">Then stir: tap STIR when the needle is in the green. Gold is perfect.</p>`));
    }
  }

  busy() { return anyOpen() || !!this.game2; }

  back() { if (this.game2) return; persist(); go(this, 'Shop'); }

  owned() {
    return ING_ORDER.filter((id) => (this.s.inv[id] || 0) > 0 || this.pot.includes(id));
  }

  redraw() {
    const s = this.s;
    this.bar.update(s, `Shelf ${G.shelfCount(s)}/${G.shelfCap(s)}`);
    // pot slots
    this.potLayer.removeAll(true);
    for (let i = 0; i < 3; i++) {
      const x = 120 + i * 60; const y = 306;
      const box = this.add.rectangle(x, y, 52, 52, hex('#4a3850')).setStrokeStyle(3, hex(i < this.pot.length ? PALETTE.gold : PALETTE.ink));
      this.potLayer.add(box);
      if (i < this.pot.length) {
        const id = this.pot[i];
        this.potLayer.add(this.add.image(x, y, 'ing', INGREDIENTS[id].icon).setScale(2));
        box.setInteractive({ useHandCursor: true });
        box.on('pointerup', () => { if (this.busy()) return; this.pot.splice(i, 1); sfx('tap'); this.redraw(); });
      } else this.potLayer.add(text(this, x, y, '+', { size: 32, color: '#6a5a78' }));
    }
    // preview
    let msg = 'Tap 2 or 3 ingredients below';
    let color = PALETTE.lavender;
    const els = {};
    for (const id of this.pot) for (const [e, v] of Object.entries(INGREDIENTS[id].el)) els[e] = (els[e] || 0) + v;
    const all = [];
    for (const e of ELEMENTS) for (let k = 0; k < (els[e] || 0); k++) all.push(e);
    all.forEach((e, k) => this.potLayer.add(this.add.image(WIDTH / 2 - (all.length * 11) / 2 + k * 11, 338, `dot_${e}`).setScale(2).setOrigin(0, 0.5)));
    if (this.pot.length >= 2) {
      const p = G.preview(s, this.pot);
      if (p.known) { msg = `Makes: ${POTIONS[p.potion].name}`; color = PALETTE.gold; } else { msg = 'Something new! Brew to find out.'; color = '#a8e070'; }
      if (p.potent) msg += '  Potent!';
    }
    this.potLayer.add(text(this, WIDTH / 2, this.pot.length ? 356 : 342, msg, { color }));
    const can = G.canBrew(s, this.pot);
    this.brewBtn.setEnabled(this.pot.length >= 2);
    this.clearBtn.setEnabled(this.pot.length > 0);
    this.canMsg = can.ok ? null : can.why;
    this.drawGrid();
  }

  drawGrid() {
    const s = this.s;
    this.gridLayer.removeAll(true);
    const ids = this.owned();
    const per = COLS * ROWS;
    let cells;
    if (ids.length <= per) { cells = ids; this.page = 0; } else if (this.page === 0) cells = [...ids.slice(0, per - 1), '_more'];
    else cells = ['_back', ...ids.slice(per - 1)];
    if (!ids.length) {
      this.gridLayer.add(text(this, WIDTH / 2, GRID_TOP + 80, 'No ingredients!\nGather some in the garden\nor buy them at the market.', { color: PALETTE.lavender }));
      return;
    }
    cells.forEach((id, i) => {
      const col = i % COLS; const row = Math.floor(i / COLS);
      const x = 10 + CELL_W / 2 + col * CELL_W; const y = GRID_TOP + 26 + row * CELL_H;
      const inPot = this.pot.filter((p) => p === id).length;
      const left = id.startsWith('_') ? 1 : (s.inv[id] || 0) - inPot;
      const bg = this.add.rectangle(x, y, CELL_W - 6, CELL_H - 6, hex(left > 0 ? '#4a3850' : '#2e2438')).setStrokeStyle(3, hex(PALETTE.ink));
      this.gridLayer.add(bg);
      if (id === '_more' || id === '_back') {
        this.gridLayer.add(text(this, x, y, id === '_more' ? 'More' : 'Back', { color: PALETTE.gold }));
      } else {
        const ing = INGREDIENTS[id];
        this.gridLayer.add(this.add.image(x - 12, y - 5, 'ing', ing.icon).setScale(2).setAlpha(left > 0 ? 1 : 0.35));
        this.gridLayer.add(text(this, x + 28, y - 8, String(left), { origin: [1, 0.5], color: left > 0 ? PALETTE.cream : '#6a5a78' }));
        let dx = 0;
        const dots = [];
        for (const e of ELEMENTS) for (let k = 0; k < (ing.el[e] || 0); k++) dots.push(e);
        const start = x - (dots.length * 9) / 2;
        for (const e of dots) { this.gridLayer.add(this.add.image(start + dx, y + 17, `dot_${e}`).setScale(1.6).setOrigin(0, 0.5)); dx += 9; }
      }
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerup', () => this.tapCell(id));
    });
  }

  tapCell(id) {
    if (this.busy()) return;
    if (id === '_more') { this.page = 1; sfx('tap'); this.drawGrid(); return; }
    if (id === '_back') { this.page = 0; sfx('tap'); this.drawGrid(); return; }
    const have = (this.s.inv[id] || 0) - this.pot.filter((p) => p === id).length;
    if (have <= 0) { sfx('error'); toast(this, `No more ${INGREDIENTS[id].name}.`, 470); return; }
    if (this.pot.length >= 3) { sfx('error'); toast(this, 'The pot holds 3 ingredients at most.', 470); return; }
    this.pot.push(id);
    sfx('select');
    bubble(2);
    this.tweens.add({ targets: this.cauldron, scaleY: 4.2, duration: 80, yoyo: true });
    this.redraw();
  }

  // ---------------------------------------------------------------- stirring minigame

  startBrew() {
    if (this.busy() || !once(this, 400)) return;
    const can = G.canBrew(this.s, this.pot);
    if (!can.ok) { sfx('error'); toast(this, can.why, 470); return; }
    const cd = G.cauldron(this.s);
    const c = this.add.container(0, 0).setDepth(9000);
    c.add(this.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.7).setOrigin(0).setInteractive());
    c.add(panel(this, 14, 170, WIDTH - 28, 330));
    const title = text(this, WIDTH / 2, 202, 'Stir! 1 of 3', { size: 32, color: PALETTE.gold });
    const help = text(this, WIDTH / 2, 240, 'Tap STIR when the needle is in the green.', { color: PALETTE.cream, wrap: 300 });
    const barG = this.add.graphics();
    const needle = this.add.rectangle(BAR_X, 300, 6, 48, 0xffffff).setStrokeStyle(2, hex(PALETTE.ink));
    const marks = this.add.container(0, 0);
    const result = text(this, WIDTH / 2, 348, '', { size: 32, color: PALETTE.cream });
    c.add([title, help, barG, needle, marks, result]);
    const stir = button(this, WIDTH / 2, 440, 220, 64, 'STIR', () => this.stirTap(), { size: 32, fill: PALETTE.gold, silent: true });
    c.add(stir);
    this.game2 = {
      c, title, barG, needle, marks, result, stir,
      round: 0, hits: [], seed: Math.floor(Math.random() * 5), t0: this.time.now, pause: false,
      period: 1.2 / cd.speed, zoneScale: cd.zone, ids: [...this.pot],
    };
    this.drawZone();
    this.drawMarks();
    sfx('select');
  }

  drawZone() {
    const m = this.game2;
    const z = stirZone(m.round, m.zoneScale, m.seed);
    m.zone = z;
    const g = m.barG;
    g.clear();
    g.fillStyle(hex(PALETTE.ink)).fillRect(BAR_X - 4, 280, BAR_W + 8, 40);
    g.fillStyle(0x6a2a2a).fillRect(BAR_X, 284, BAR_W, 32);
    const gx = BAR_X + (z.centre - z.good) * BAR_W;
    g.fillStyle(0x5fa040).fillRect(Math.max(BAR_X, gx), 284, Math.min(BAR_W, z.good * 2 * BAR_W), 32);
    g.fillStyle(hex(PALETTE.gold)).fillRect(BAR_X + (z.centre - z.perfect) * BAR_W, 284, z.perfect * 2 * BAR_W, 32);
  }

  drawMarks() {
    const m = this.game2;
    m.marks.removeAll(true);
    for (let i = 0; i < STIR.rounds; i++) {
      const h = m.hits[i];
      const col = h === undefined ? 0x4a3850 : h === 2 ? hex(PALETTE.gold) : h === 1 ? 0x5fa040 : 0xa13d3b;
      m.marks.add(this.add.circle(WIDTH / 2 - 40 + i * 40, 384, 12, col).setStrokeStyle(3, hex(PALETTE.ink)));
    }
  }

  update(time) {
    const m = this.game2;
    if (!m || m.pause || m.finished) return;
    const pos = needleAt((time - m.t0) / 1000, m.period);
    m.pos = pos;
    m.needle.setX(BAR_X + pos * BAR_W);
  }

  stirTap() {
    const m = this.game2;
    if (!m || m.pause || m.finished) return;
    const hit = stirHit(m.pos ?? 0, m.zone);
    m.hits.push(hit);
    m.pause = true;
    bubble(hit === 2 ? 5 : 3);
    sfx(hit ? 'hit' : 'error');
    m.result.setText(hit === 2 ? 'Perfect!' : hit === 1 ? 'Good' : 'Missed!').setColor(hit === 2 ? PALETTE.gold : hit === 1 ? '#a8e070' : '#ff9a8a');
    this.tweens.add({ targets: this.smoke, scale: 3, duration: 150, yoyo: true });
    this.drawMarks();
    this.time.delayedCall(650, () => {
      if (!this.game2) return;
      m.round += 1;
      m.result.setText('');
      if (m.round >= STIR.rounds) { this.finishBrew(); return; }
      m.title.setText(`Stir! ${m.round + 1} of 3`);
      this.drawZone();
      m.t0 = this.time.now - Math.random() * m.period * 1000;
      m.pause = false;
    });
  }

  finishBrew() {
    const m = this.game2;
    m.finished = true;
    const total = m.hits.reduce((a, b) => a + b, 0);
    const r = G.brew(this.s, m.ids, total);
    m.c.destroy();
    if (!r.ok) { this.game2 = null; toast(this, r.why || 'That did not work.', 470); this.redraw(); return; }
    persist();
    this.pot = [];
    this.showResult(r);
  }

  showResult(r) {
    const p = POTIONS[r.potion];
    const c = this.add.container(0, 0).setDepth(9000);
    c.add(this.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.7).setOrigin(0).setInteractive());
    c.add(panel(this, 24, 150, WIDTH - 48, 340));
    const sludge = r.potion === 'sludge';
    c.add(text(this, WIDTH / 2, 184, sludge ? 'Oops!' : r.isNew ? 'New recipe!' : 'Brewed!', { size: 32, color: sludge ? '#ff9a8a' : PALETTE.gold }));
    const img = this.add.image(WIDTH / 2, 262, `potion_${r.potion}`).setScale(5);
    c.add(img);
    this.tweens.add({ targets: img, y: 254, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    c.add(text(this, WIDTH / 2, 324, p.name, { color: PALETTE.cream }));
    c.add(starRow(this, WIDTH / 2 - 24, 352, r.stars, 3));
    const lines = [];
    lines.push(r.n ? `${r.n} on your shelf.` : 'No room on your shelf!');
    if (r.potent && !sludge) lines.push('Potent brew: +1 star!');
    if (r.isNew && !sludge) lines.push(p.use);
    if (sludge) lines.push('The elements fought each other. Try a different mix.');
    c.add(text(this, WIDTH / 2, 380, lines.join('\n'), { color: PALETTE.lavender, wrap: 280 }).setOrigin(0.5, 0));
    let done = false;
    c.add(button(this, WIDTH / 2, 462, 200, 48, sludge ? 'Oh well' : 'Lovely!', () => {
      if (done) return;
      done = true;
      c.destroy();
      this.game2 = null;
      this.redraw();
      if (!this.s.tut.firstBrew && this.s.day === 1) {
        this.s.tut.firstBrew = true; persist();
        toast(this, 'When you are ready, go back to the shop and open it.', 470);
      }
    }, { fill: PALETTE.gold }));
    if (r.isNew && !sludge) jingle('recipe'); else if (sludge) sfx('lose'); else sfx('power');
    this.game2 = { finished: true, c };
  }
}


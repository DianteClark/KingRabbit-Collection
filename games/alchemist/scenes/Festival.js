import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { sfx } from '../../../shared/core/sfx.js';
import { WIDTH, HEIGHT, go, setBackground, store, persist, header, statBar, once, starRow } from './common.js';
import { showShelf, showConfirm, anyOpen, closeAll } from './panels.js';
import * as G from '../logic/game.js';
import { FESTIVAL, POTIONS } from '../logic/data.js';
import { noteBest } from '../save.js';
import { playMusic, jingle } from '../music.js';

const PANEL_Y = 380;
const VEX_POTIONS = ['fire', 'life', 'forge'];

export class Festival extends Phaser.Scene {
  constructor() { super('Festival'); }

  create() {
    closeAll();
    this.input.enabled = true;
    this.s = store.s;
    if (!this.s || (this.s.phase !== 'festival' && this.s.phase !== 'over')) { this.scene.start(this.s ? 'Shop' : 'Title'); return; }
    if (this.s.phase === 'over') { this.scene.start('Ending'); return; }
    setBackground(this, '#2a2036');
    playMusic('festival');
    this.drawStage();
    header(this, 'Festival', () => { persist(); go(this, 'Title'); });
    this.bar = statBar(this);
    this.ui = this.add.container(0, 0).setDepth(100);
    this.showRound();
  }

  drawStage() {
    const g = this.add.graphics();
    g.fillStyle(0x3a2e4a).fillRect(0, 86, WIDTH, 120);
    for (let y = 206; y < PANEL_Y; y += 32) for (let x = 0; x < WIDTH; x += 32) this.add.image(x, y, 'lab', 'grass').setOrigin(0).setScale(2);
    // bunting
    const cols = [0xe3d245, 0xa13d3b, 0x8a8fc4, 0x6c8c50, 0xd88038];
    g.lineStyle(2, 0x1c1618).lineBetween(0, 100, WIDTH, 112);
    for (let i = 0; i < 18; i++) {
      const x = i * 20 + 4; const y = 100 + (i * 20 / WIDTH) * 12;
      g.fillStyle(cols[i % cols.length]).fillTriangle(x, y, x + 16, y + 1, x + 8, y + 16);
    }
    // stage
    g.fillStyle(0x1c1618).fillRect(20, 226, WIDTH - 40, 80);
    g.fillStyle(0x8a5a36).fillRect(24, 230, WIDTH - 48, 72);
    for (let x = 24; x < WIDTH - 24; x += 36) g.fillStyle(0x6a3e26).fillRect(x, 230, 3, 72);
    // judge, you and Vex
    this.add.sprite(WIDTH / 2, 236, 'npcs', 8).setOrigin(0.5, 1).setScale(4).play('npc2');
    text(this, WIDTH / 2, 132, 'Elder Rowan', { color: PALETTE.cream });
    this.add.sprite(76, 300, 'alchemist', '0_0').setOrigin(0.5, 1).setScale(4).play('alch-idle');
    text(this, 76, 318, 'You', { color: PALETTE.gold });
    this.add.sprite(WIDTH - 76, 300, 'npcs', 12).setOrigin(0.5, 1).setScale(4).play('npc3');
    text(this, WIDTH - 76, 318, 'Madame Vex', { color: '#e0a0f0' });
    // crowd
    for (let i = 0; i < 7; i++) {
      const row = [0, 1, 4, 5][i % 4];
      this.add.sprite(30 + i * 50, PANEL_Y - 2, 'npcs', row * 4).setOrigin(0.5, 1).setScale(3).play(`npc${row}`).setTint([0xffffff, 0xd8c8f0, 0xf0d8c8][i % 3]);
    }
    this.add.rectangle(0, PANEL_Y, WIDTH, HEIGHT - PANEL_Y, hex('#2b2238')).setOrigin(0);
    this.add.rectangle(0, PANEL_Y, WIDTH, 3, hex(PALETTE.ink)).setOrigin(0);
    this.shows = this.add.container(0, 0).setDepth(20);
  }

  btn(x, y, w, h, label, fn, opts) {
    const b = button(this, x, y, w, h, label, () => { if (anyOpen() || !once(this, 300)) return; fn(); }, opts);
    this.ui.add(b);
    return b;
  }

  scores() {
    const f = this.s.festival;
    const you = f.scores.reduce((a, b) => a + b, 0);
    const vex = f.rival.slice(0, f.scores.length).reduce((a, b) => a + b, 0);
    return { you, vex };
  }

  showRound() {
    const s = this.s;
    const f = s.festival;
    this.ui.removeAll(true);
    const sc = this.scores();
    this.bar.update(s, `You ${sc.you}  Vex ${sc.vex}`);
    const r = FESTIVAL[f.round];
    this.ui.add(text(this, WIDTH / 2, PANEL_Y + 26, r.label, { size: f.round === 2 ? 16 : 32, color: PALETTE.gold }));
    this.ui.add(text(this, WIDTH / 2, PANEL_Y + 66, `"${r.text}"`, { color: PALETTE.cream, wrap: 320 }));
    this.ui.add(text(this, WIDTH / 2, PANEL_Y + 104, 'Points: 10 for fitting the theme, 5 per star, plus the potion\'s value.', { color: PALETTE.lavender, wrap: 320 }));
    this.btn(WIDTH / 2, 584, 280, 52, 'Choose a potion', () => this.choose(), { fill: PALETTE.gold });
    if (!G.shelfCount(s)) this.btn(WIDTH / 2, 528, 280, 40, 'Enter nothing', () => this.enter(null), { fill: PALETTE.lavender });
  }

  choose() {
    const s = this.s;
    if (!G.shelfCount(s)) {
      showConfirm('No potions', 'Your shelves are empty. Enter nothing this round?', 'Enter nothing', () => this.enter(null));
      return;
    }
    showShelf(s, { mode: 'festival', round: s.festival.round, onPick: (key) => this.enter(key) });
  }

  enter(key) {
    const s = this.s;
    const round = s.festival.round;
    const res = G.enterFestival(s, key);
    if (!res) return;
    persist();
    this.ui.removeAll(true);
    this.shows.removeAll(true);
    // your potion and Vex's go up on the stage
    if (res.potion) {
      const img = this.add.image(76, 196, `potion_${res.potion}`).setScale(4).setAlpha(0);
      this.shows.add(img);
      this.tweens.add({ targets: img, alpha: 1, y: 176, duration: 400 });
      this.shows.add(starRow(this, 60, 212, res.stars, 2));
    }
    const vp = VEX_POTIONS[round];
    const vimg = this.add.image(WIDTH - 76, 196, `potion_${vp}`).setScale(4).setAlpha(0);
    this.shows.add(vimg);
    this.tweens.add({ targets: vimg, alpha: 1, y: 176, duration: 400, delay: 500 });
    sfx('select');
    const you = text(this, 90, PANEL_Y + 60, '0', { size: 32, color: PALETTE.gold });
    const vex = text(this, WIDTH - 90, PANEL_Y + 60, '0', { size: 32, color: '#e0a0f0' });
    this.ui.add([
      text(this, 90, PANEL_Y + 24, 'You', { color: PALETTE.cream }),
      text(this, WIDTH - 90, PANEL_Y + 24, 'Madame Vex', { color: PALETTE.cream }),
      you, vex,
    ]);
    const say = res.potion ? (res.match ? `A fine ${POTIONS[res.potion].name}!` : `A ${POTIONS[res.potion].name}... not quite the theme.`) : 'Nothing to show? Oh dear.';
    this.ui.add(text(this, WIDTH / 2, PANEL_Y + 108, `Rowan: "${say}"`, { color: PALETTE.lavender, wrap: 320 }));
    this.countUp(you, res.score, 0);
    this.countUp(vex, res.rival, 600);
    this.time.delayedCall(1500, () => {
      const sc = this.scores();
      this.bar.update(s, `You ${sc.you}  Vex ${sc.vex}`);
      sfx(res.score >= res.rival ? 'coin' : 'thud');
      if (res.done) this.btn(WIDTH / 2, 584, 280, 52, 'Hear the verdict', () => this.verdict(), { fill: PALETTE.gold });
      else this.btn(WIDTH / 2, 584, 280, 52, 'Next round', () => { this.shows.removeAll(true); this.showRound(); }, { fill: PALETTE.gold });
    });
  }

  countUp(t, to, delay) {
    const o = { v: 0 };
    this.tweens.add({ targets: o, v: to, delay, duration: 700, onUpdate: () => t.setText(String(Math.round(o.v))) });
  }

  verdict() {
    noteBest(this.s);
    if (this.s.result?.kind === 'win') jingle('fanfare');
    go(this, 'Ending');
  }
}

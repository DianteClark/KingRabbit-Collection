import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { header, go, setBackground, toast } from './common.js';
import { endGame } from './boardkit.js';
import { N, randomFleet, fire, allSunk, cpuTarget } from '../logic/seabattle.js';

const BIG = 32;      // enemy grid cell
const SMALL = 16;    // your grid cell during battle
const BIG_LEFT = (WIDTH - BIG * N) / 2;
const BIG_TOP = 120;
const SMALL_LEFT = (WIDTH - SMALL * N) / 2;
const SMALL_TOP = 472;

export class SeaBattle extends Phaser.Scene {
  constructor() { super('SeaBattle'); }

  init() { this.mode = 'cpu'; }

  create() {
    setBackground(this, PALETTE.indigo);
    header(this, 'Sea Battle', () => go(this, 'Menu'));
    this.status = text(this, WIDTH / 2, 88, '', { color: PALETTE.cream });
    this.layer = this.add.container(0, 0);
    this.input.on('pointerup', (p) => this.tap(p.x, p.y));
    this.setup();
  }

  // ---------- setup: shuffle your fleet, then start ----------
  setup() {
    this.phase = 'setup';
    this.myFleet = randomFleet();
    this.layer.removeAll(true);
    this.status.setText('Your fleet. Shuffle until you like it.');
    this.drawGrid(BIG_LEFT, BIG_TOP, BIG, this.myFleet, new Map(), true, 'grey');
    this.layer.add(button(this, WIDTH / 2 - 80, 492, 140, 48, 'Shuffle', () => this.setup()));
    this.layer.add(button(this, WIDTH / 2 + 80, 492, 140, 48, 'Battle!', () => this.start(), { fill: PALETTE.gold }));
    this.layer.add(text(this, WIDTH / 2, 560, 'Ships: 5, 4, 3, 3, 2 - they never touch', { color: PALETTE.lavender }));
  }

  start() {
    this.phase = 'battle';
    this.enemyFleet = randomFleet();
    this.myShots = new Map();     // my shots on the enemy
    this.cpuShots = new Map();    // CPU's shots on me
    this.cpuSunk = new Set();
    this.busy = false;
    this.over = false;
    this.redraw();
    this.status.setText('Tap the top grid to fire');
  }

  // ---------- drawing ----------
  drawGrid(left, top, cell, fleet, shots, showShips, style, sunkOnly = false) {
    const s = cell / 8;
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.ink)).fillRect(left - 4, top - 4, cell * N + 8, cell * N + 8);
    g.fillStyle(hex(PALETTE.cream)).fillRect(left - 2, top - 2, cell * N + 4, cell * N + 4);
    this.layer.add(g);
    for (let i = 0; i < N * N; i++) {
      const x = left + (i % N) * cell + cell / 2; const y = top + Math.floor(i / N) * cell + cell / 2;
      this.layer.add(this.add.image(x, y, 'seabattle', 'water').setScale(s));
    }
    for (const ship of fleet) {
      const sunk = ship.hits === ship.cells.length;
      if (!showShips && !(sunkOnly && sunk)) continue;
      const suffix = style === 'red' || sunk ? 'R' : '';
      ship.cells.forEach((c, k) => {
        const part = k === 0 ? 'bow' : k === ship.cells.length - 1 ? 'stern' : 'mid';
        const x = left + (c % N) * cell + cell / 2; const y = top + Math.floor(c / N) * cell + cell / 2;
        const img = this.add.image(x, y, 'seabattle', part + suffix).setScale(s);
        if (ship.horizontal) img.setAngle(-90);
        this.layer.add(img);
      });
    }
    for (const [c, v] of shots) {
      const x = left + (c % N) * cell + cell / 2; const y = top + Math.floor(c / N) * cell + cell / 2;
      this.layer.add(this.add.image(x, y, 'seabattle', v === 'hit' ? 'hit' : 'miss').setScale(s));
    }
  }

  redraw() {
    this.layer.removeAll(true);
    this.drawGrid(BIG_LEFT, BIG_TOP, BIG, this.enemyFleet, this.myShots, false, 'red', true);
    this.drawGrid(SMALL_LEFT, SMALL_TOP, SMALL, this.myFleet, this.cpuShots, true, 'grey');
    const left = (f) => f.filter((s) => s.hits < s.cells.length).length;
    this.layer.add(text(this, WIDTH / 2, BIG_TOP + BIG * N + 14, `Enemy ships left ${left(this.enemyFleet)}   Yours ${left(this.myFleet)}`, { color: PALETTE.lavender }));
  }

  boom(x, y, scale) {
    const img = this.add.image(x, y, 'seabattle', 'boom1').setScale(scale).setDepth(30);
    const frames = ['boom1', 'boom2', 'boom3', 'boom4'];
    frames.forEach((f, k) => this.time.delayedCall(k * 70, () => img.setFrame(f)));
    this.time.delayedCall(frames.length * 70, () => img.destroy());
  }

  // ---------- play ----------
  tap(x, y) {
    if (this.phase !== 'battle' || this.busy || this.over) return;
    const c = Math.floor((x - BIG_LEFT) / BIG); const r = Math.floor((y - BIG_TOP) / BIG);
    if (c < 0 || c >= N || r < 0 || r >= N) return;
    const cell = r * N + c;
    if (this.myShots.has(cell)) return;
    const res = fire(this.enemyFleet, this.myShots, cell);
    this.redraw();
    if (res.result !== 'miss') { this.boom(BIG_LEFT + c * BIG + BIG / 2, BIG_TOP + r * BIG + BIG / 2, 4); this.cameras.main.shake(90, 0.004); }
    this.status.setText(res.result === 'sunk' ? 'You sank a ship!' : res.result === 'hit' ? 'Hit!' : 'Miss');
    if (allSunk(this.enemyFleet)) { this.finish(true); return; }
    this.busy = true;
    this.time.delayedCall(750, () => this.cpuFire());
  }

  cpuFire() {
    const remaining = this.myFleet.filter((s) => s.hits < s.cells.length).map((s) => s.cells.length);
    const cell = cpuTarget(this.cpuShots, this.cpuSunk, remaining);
    const res = fire(this.myFleet, this.cpuShots, cell);
    if (res.result === 'sunk') res.ship.cells.forEach((c) => this.cpuSunk.add(c));
    this.redraw();
    if (res.result !== 'miss') this.boom(SMALL_LEFT + (cell % N) * SMALL + SMALL / 2, SMALL_TOP + Math.floor(cell / N) * SMALL + SMALL / 2, 2);
    const msg = { miss: 'CPU missed. Your turn', hit: 'CPU hit your ship! Your turn', sunk: 'CPU sank your ship! Your turn' }[res.result];
    this.status.setText(msg);
    if (allSunk(this.myFleet)) { this.finish(false); return; }
    this.busy = false;
  }

  finish(won) {
    this.over = true;
    // Reveal the enemy fleet.
    this.layer.removeAll(true);
    this.drawGrid(BIG_LEFT, BIG_TOP, BIG, this.enemyFleet, this.myShots, true, 'red');
    this.drawGrid(SMALL_LEFT, SMALL_TOP, SMALL, this.myFleet, this.cpuShots, true, 'grey');
    if (won) toast(this, 'Enemy fleet destroyed!', 440);
    endGame(this, {
      id: 'seabattle', mode: 'cpu', title: won ? 'Victory!' : 'Fleet lost',
      lines: [`You fired ${this.myShots.size} shots`], outcome: won ? 'w' : 'l', onAgain: () => this.setup(),
    });
  }
}

import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { header, go, setBackground, toast } from './common.js';
import { endGame } from './boardkit.js';
import { N, randomFleet, fire, allSunk, cpuTarget, shipCells, fits } from '../logic/seabattle.js';

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

  // ---------- setup: place your fleet ----------
  setup() {
    this.phase = 'setup';
    this.myFleet = randomFleet();
    this.selectedShip = 0;
    this.drawSetup();
  }

  drawSetup() {
    this.layer.removeAll(true);
    const ship = this.myFleet[this.selectedShip];
    this.status.setText(ship ? `${ship.name} (${ship.cells.length}): tap a square to move it` : 'Tap a ship to move it');
    this.drawGrid(BIG_LEFT, BIG_TOP, BIG, this.myFleet, new Map(), true, 'grey');
    if (ship) {
      const g = this.add.graphics();
      const xs = ship.cells.map((c) => c % N); const ys = ship.cells.map((c) => Math.floor(c / N));
      g.lineStyle(3, hex(PALETTE.gold)).strokeRect(BIG_LEFT + Math.min(...xs) * BIG, BIG_TOP + Math.min(...ys) * BIG, (Math.max(...xs) - Math.min(...xs) + 1) * BIG, (Math.max(...ys) - Math.min(...ys) + 1) * BIG);
      this.layer.add(g);
    }
    this.layer.add(button(this, 66, 492, 104, 48, 'Rotate', () => this.rotateShip()));
    this.layer.add(button(this, WIDTH / 2, 492, 104, 48, 'Shuffle', () => { this.myFleet = randomFleet(); this.drawSetup(); }));
    this.layer.add(button(this, WIDTH - 66, 492, 104, 48, 'Battle!', () => this.start(), { fill: PALETTE.gold }));
    this.layer.add(text(this, WIDTH / 2, 548, 'Tap a ship to pick it, then tap where its', { color: PALETTE.lavender }));
    this.layer.add(text(this, WIDTH / 2, 570, 'front should go. Ships may touch.', { color: PALETTE.lavender }));
  }

  setupTap(cell) {
    const owner = this.myFleet.findIndex((sh) => sh.cells.includes(cell));
    if (owner >= 0 && owner !== this.selectedShip) { this.selectedShip = owner; this.drawSetup(); return; }
    const ship = this.myFleet[this.selectedShip];
    if (!ship) return;
    const cells = shipCells(cell, ship.cells.length, ship.horizontal);
    if (fits(this.myFleet, this.selectedShip, cells)) ship.cells = cells;
    else toast(this, "It won't fit there", 600);
    this.drawSetup();
  }

  rotateShip() {
    const ship = this.myFleet[this.selectedShip];
    if (!ship) return;
    const cells = shipCells(ship.cells[0], ship.cells.length, !ship.horizontal);
    if (fits(this.myFleet, this.selectedShip, cells)) { ship.cells = cells; ship.horizontal = !ship.horizontal; }
    else toast(this, 'No room to rotate here', 600);
    this.drawSetup();
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
    const c = Math.floor((x - BIG_LEFT) / BIG); const r = Math.floor((y - BIG_TOP) / BIG);
    if (c < 0 || c >= N || r < 0 || r >= N) return;
    const cell = r * N + c;
    if (this.phase === 'setup') { this.setupTap(cell); return; }
    if (this.phase !== 'battle' || this.busy || this.over) return;
    if (this.myShots.has(cell)) return;
    const res = fire(this.enemyFleet, this.myShots, cell);
    this.redraw();
    if (res.result !== 'miss') { this.boom(BIG_LEFT + c * BIG + BIG / 2, BIG_TOP + r * BIG + BIG / 2, 4); this.cameras.main.shake(90, 0.004); }
    this.status.setText(res.result === 'sunk' ? `You sank their ${res.ship.name}!` : res.result === 'hit' ? 'Hit!' : 'Miss');
    if (res.result === 'sunk') toast(this, `${res.ship.name} sunk!`, 440);
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
    const msg = { miss: 'CPU missed. Your turn', hit: 'CPU hit your ship! Your turn', sunk: `CPU sank your ${res.ship?.name}!` }[res.result];
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

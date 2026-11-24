import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { header, go, setBackground, modal, swipeArea, toast, holdButton } from './common.js';
import { sfx } from '../../../shared/core/sfx.js';
import { getBest, submitBest } from '../save.js';
import { W, H, newGame, spawn, move, cycle, fall, hardDrop, lock, resolveOnce, fallDelay } from '../logic/columns.js';

const CELL = 24;
const LEFT = 28;
const TOP = 84;

export class SixBall extends Phaser.Scene {
  constructor() { super('SixBall'); }

  init() { this.mode = 'solo'; }

  create() {
    setBackground(this, PALETTE.ink);
    header(this, 'Six Ball', () => go(this, 'Menu'));

    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.indigo)).fillRect(LEFT - 6, TOP - 6, W * CELL + 12, H * CELL + 12);
    g.fillStyle(hex(PALETTE.ink)).fillRect(LEFT - 3, TOP - 3, W * CELL + 6, H * CELL + 6);
    g.fillStyle(hex(PALETTE.night)).fillRect(LEFT, TOP, W * CELL, H * CELL);
    for (let x = 1; x < W; x++) g.fillStyle(hex(PALETTE.ink)).fillRect(LEFT + x * CELL, TOP, 1, H * CELL);

    // Side panel
    const px = LEFT + W * CELL + 24;
    const panelW = WIDTH - px - 14;
    g.fillStyle(hex(PALETTE.indigo)).fillRect(px, TOP - 6, panelW, 96);
    g.fillStyle(hex(PALETTE.ink)).fillRect(px + 3, TOP - 3, panelW - 6, 90);
    text(this, px + panelW / 2, TOP + 8, 'Next', { color: PALETTE.cream });
    this.nextImgs = [0, 1, 2].map((k) => this.add.image(px + panelW / 2, TOP + 32 + k * 18, 'sixball', 'g1').setScale(2));
    this.scoreText = text(this, px + panelW / 2, TOP + 124, '', { color: PALETTE.cream, align: 'center' });
    this.levelText = text(this, px + panelW / 2, TOP + 184, '', { color: PALETTE.gold, align: 'center' });
    this.bestText = text(this, px + panelW / 2, TOP + 244, '', { color: PALETTE.lavender, align: 'center' });
    text(this, px + panelW / 2, TOP + 360, 'Tap the well\nto turn gems.\nSwipe to move\nor drop.', { color: PALETTE.lavender, align: 'center' });

    this.cells = this.add.container(0, 0);
    this.ghostLayer = this.add.container(0, 0);
    this.pieceLayer = this.add.container(0, 0);

    // Controls
    const by = 580;
    // Hold < or > to keep sliding (after a short pause, like a keyboard).
    this.holdL = holdButton(this, 52, by, 76, 56, '<', { size: 32 });
    this.holdR = holdButton(this, 220, by, 76, 56, '>', { size: 32 });
    this.repeat = 0;
    button(this, 136, by, 76, 56, 'Turn', () => this.act('cycle'));
    button(this, 306, by, 76, 56, 'Drop', () => this.act('drop'), { fill: PALETTE.gold });
    swipeArea(this, { x: LEFT, y: TOP, w: W * CELL, h: H * CELL }, {
      onSwipe: (d) => this.act(d === 'down' ? 'drop' : d === 'up' ? 'cycle' : d),
      onTap: () => this.act('cycle'),
    });

    this.start();
  }

  start() {
    this.g = newGame();
    this.resolving = false;
    spawn(this.g);
    this.redraw();
    this.schedule();
  }

  schedule() {
    this.timer?.remove();
    this.timer = this.time.addEvent({ delay: fallDelay(this.g.level), loop: true, callback: () => this.tick() });
  }

  tick() {
    if (this.g.over || this.resolving || !this.g.piece) return;
    if (!fall(this.g)) this.land();
    this.drawPiece();
  }

  update(_, ms) {
    if (!this.g || this.g.over || this.resolving) return;
    for (const [btn, dir] of [[this.holdL, 'left'], [this.holdR, 'right']]) {
      if (btn.wasPressed()) { this.act(dir); this.repeat = -170; continue; }
      if (btn.isDown) {
        this.repeat += ms;
        if (this.repeat >= 70) { this.repeat = 0; this.act(dir); }
      }
    }
  }

  act(a) {
    if (this.g.over || this.resolving || !this.g.piece) return;
    if (a === 'left') { if (move(this.g, -1)) sfx('move'); }
    else if (a === 'right') { if (move(this.g, 1)) sfx('move'); }
    else if (a === 'cycle') { cycle(this.g); sfx('flip'); }
    else if (a === 'drop') { this.g.score += hardDrop(this.g); this.land(); }
    this.drawPiece();
  }

  land() {
    lock(this.g);
    sfx('place');
    this.redraw();
    if (this.g.over) { this.gameOver(); return; }
    this.resolving = true;
    this.chain(1);
  }

  chain(n) {
    const levelBefore = this.g.level;
    const hit = resolveOnce(this.g, n);
    if (!hit.size) {
      this.resolving = false;
      spawn(this.g);
      this.redraw();
      if (this.g.over) this.gameOver();
      return;
    }
    // Flash the cleared cells, then show the settled grid.
    const flash = this.add.graphics().setDepth(20);
    for (const i of hit) flash.fillStyle(0xffffff, 0.85).fillRect(LEFT + (i % W) * CELL, TOP + Math.floor(i / W) * CELL, CELL, CELL);
    sfx(n > 1 ? 'coin' : 'capture');
    if (n > 1) toast(this, `Chain x${n}!`, TOP + 160);
    if (this.g.level > levelBefore) { toast(this, `Level ${this.g.level}!`, TOP + 200); sfx('power'); this.schedule(); }
    this.time.delayedCall(180, () => { flash.destroy(); this.redraw(); this.time.delayedCall(120, () => this.chain(n + 1)); });
  }

  redraw() {
    this.cells.removeAll(true);
    this.g.grid.forEach((v, i) => {
      if (!v) return;
      this.cells.add(this.add.image(LEFT + (i % W) * CELL + CELL / 2, TOP + Math.floor(i / W) * CELL + CELL / 2, 'sixball', `g${v}`).setScale(3));
    });
    this.g.next.forEach((v, k) => this.nextImgs[k].setFrame(`g${v}`));
    this.scoreText.setText(`Score\n${this.g.score}`);
    this.levelText.setText(`Level\n${this.g.level}`);
    this.bestText.setText(`Best\n${Math.max(getBest('sixball'), this.g.score)}`);
    this.drawPiece();
  }

  drawPiece() {
    this.pieceLayer.removeAll(true);
    this.ghostLayer.removeAll(true);
    const p = this.g.piece;
    if (!p) return;
    // Faint outline of where the stack will land.
    const y0 = p.y;
    while (fall(this.g));
    const landY = p.y;
    p.y = y0;
    if (landY > y0) {
      const gg = this.add.graphics();
      for (let k = 0; k < 3; k++) {
        const y = landY - (2 - k);
        if (y < 0) continue;
        gg.lineStyle(2, 0xffffff, 0.35).strokeRect(LEFT + p.x * CELL + 3, TOP + y * CELL + 3, CELL - 6, CELL - 6);
      }
      this.ghostLayer.add(gg);
    }
    p.gems.forEach((v, k) => {
      const y = p.y - (2 - k);
      if (y < 0) return;
      this.pieceLayer.add(this.add.image(LEFT + p.x * CELL + CELL / 2, TOP + y * CELL + CELL / 2, 'sixball', `g${v}`).setScale(3));
    });
    this.scoreText.setText(`Score\n${this.g.score}`);
  }

  gameOver() {
    this.timer?.remove();
    sfx('lose');
    const isBest = submitBest('sixball', this.g.score);
    this.time.delayedCall(500, () => {
      const m = modal(this, isBest ? 'New best!' : 'Game over', [`Score ${this.g.score}`, `Level ${this.g.level}`], [
        ['Play again', () => { m.destroy(); this.start(); }],
        ['Menu', () => go(this, 'Menu')],
      ]);
    });
  }
}

// Draws a board (logic/board.js), takes swipes and tap-tap swaps, and animates the steps the
// logic returns. Shared by battles and riddle stones.
import { Phaser, PALETTE, hex, sfx, GEM_COLORS, gemFrame, outlined } from './common.js';
import { SIZE, adjacent, idx, xy } from '../logic/board.js';

const OVERLAY = { h: 'ov_h', v: 'ov_v', bomb: 'ov_bomb' };

export class BoardView {
  /**
   * @param scene  Phaser scene
   * @param board  board object (logic/board.js); the view reads it on sync()
   * @param opts   { x, y, cell }
   */
  constructor(scene, board, { x, y, cell = 42, depth = 10 } = {}) {
    this.scene = scene;
    this.board = board;
    this.x0 = x; this.y0 = y; this.cell = cell;
    this.size = cell * SIZE;
    this.enabled = false;
    this.onSwap = null;
    this.onTapBlocked = null; // tapped while not allowed (e.g. the monster's turn)
    this.selected = -1;
    this.drag = null;
    this.sprites = new Map();
    this.speed = 1;

    const g = scene.add.graphics().setDepth(depth - 1);
    g.fillStyle(hex(PALETTE.ink)).fillRect(x - 5, y - 5, this.size + 10, this.size + 10);
    g.fillStyle(hex(PALETTE.indigo)).fillRect(x - 3, y - 3, this.size + 6, this.size + 6);
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        g.fillStyle((r + c) % 2 ? 0x241c2c : 0x2c2338).fillRect(x + c * cell, y + r * cell, cell, cell);
      }
    }
    this.bg = g;
    this.layer = scene.add.container(0, 0).setDepth(depth);
    const mask = scene.make.graphics({ add: false });
    mask.fillStyle(0xffffff).fillRect(x, y, this.size, this.size);
    this.layer.setMask(mask.createGeometryMask());
    this.fx = scene.add.container(0, 0).setDepth(depth + 2);
    this.selBox = scene.add.rectangle(0, 0, cell, cell).setStrokeStyle(3, hex(PALETTE.gold)).setDepth(depth + 1).setVisible(false);
    this.hintTweens = [];

    this.zone = scene.add.zone(x, y, this.size, this.size).setOrigin(0).setInteractive().setDepth(depth + 3);
    this.zone.on('pointerdown', (p) => this.down(p));
    const onMove = (p) => this.move(p);
    const onUp = (p) => this.up(p);
    scene.input.on('pointermove', onMove);
    scene.input.on('pointerup', onUp);
    scene.events.once('shutdown', () => { scene.input.off('pointermove', onMove); scene.input.off('pointerup', onUp); });
    this.sync();
  }

  pos(i) {
    const [cx, cy] = xy(i);
    return [this.x0 + cx * this.cell + this.cell / 2, this.y0 + cy * this.cell + this.cell / 2];
  }

  cellAt(px, py) {
    const cx = Math.floor((px - this.x0) / this.cell);
    const cy = Math.floor((py - this.y0) / this.cell);
    if (cx < 0 || cy < 0 || cx >= SIZE || cy >= SIZE) return -1;
    return idx(cx, cy);
  }

  makeSprite(cell, i, yOff = 0) {
    const [px, py] = this.pos(i);
    const c = this.scene.add.container(px, py + yOff);
    const scale = Math.floor((this.cell - 1) / 8);
    const img = this.scene.add.image(0, 0, 'gq', gemFrame(cell.c)).setScale(scale);
    c.add(img);
    c.gem = img;
    if (cell.s && OVERLAY[cell.s]) {
      const ov = this.scene.add.image(0, 0, 'gq', OVERLAY[cell.s]).setScale(scale).setAlpha(0.9);
      c.add(ov);
      this.scene.tweens.add({ targets: ov, alpha: 0.45, duration: 500, yoyo: true, repeat: -1 });
    }
    if (cell.c === 6) {
      // Star gems shimmer through the gem colours.
      let k = 0;
      c.shimmer = this.scene.time.addEvent({ delay: 220, loop: true, callback: () => { if (img.active) img.setTint(hex(GEM_COLORS[k++ % 4])); } });
      c.once('destroy', () => c.shimmer.remove());
    }
    c.cellId = cell.id;
    this.layer.add(c);
    this.sprites.set(cell.id, c);
    return c;
  }

  /** Rebuild every gem from the board. */
  sync(board = this.board) {
    this.board = board;
    for (const s of this.sprites.values()) s.destroy();
    this.sprites.clear();
    board.cells.forEach((cell, i) => { if (cell) this.makeSprite(cell, i); });
    this.select(-1);
  }

  /** Make sure every gem is where the board says (after animations). */
  reconcile() {
    const want = new Map();
    this.board.cells.forEach((cell, i) => { if (cell) want.set(cell.id, { cell, i }); });
    let ok = want.size === this.sprites.size;
    if (ok) {
      for (const [id, { i }] of want) {
        const s = this.sprites.get(id);
        const [px, py] = this.pos(i);
        if (!s || Math.abs(s.x - px) > 1 || Math.abs(s.y - py) > 1) { ok = false; break; }
      }
    }
    if (!ok) this.sync();
  }

  // ---------------------------------------------------------------- input

  setEnabled(on) {
    this.enabled = on;
    if (!on) { this.select(-1); this.drag = null; }
  }

  down(p) {
    const i = this.cellAt(p.x, p.y);
    if (i < 0) return;
    if (!this.enabled) { this.onTapBlocked?.(); return; }
    this.drag = { i, x: p.x, y: p.y, id: p.id };
  }

  move(p) {
    const d = this.drag;
    if (!d || p.id !== d.id || !p.isDown) return;
    const dx = p.x - d.x; const dy = p.y - d.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < this.cell * 0.32) return;
    this.drag = null;
    const [cx, cy] = xy(d.i);
    let nx = cx; let ny = cy;
    if (Math.abs(dx) > Math.abs(dy)) nx += Math.sign(dx); else ny += Math.sign(dy);
    if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) return;
    this.select(-1);
    this.trySwap(d.i, idx(nx, ny));
  }

  up(p) {
    const d = this.drag;
    if (!d || p.id !== d.id) return;
    this.drag = null;
    if (!this.enabled) return;
    const i = d.i;
    if (!this.board.cells[i]) { this.select(-1); return; }
    if (this.selected < 0) { this.select(i); sfx('select'); return; }
    if (this.selected === i) { this.select(-1); return; }
    if (adjacent(this.selected, i)) {
      const a = this.selected;
      this.select(-1);
      this.trySwap(a, i);
      return;
    }
    this.select(i);
    sfx('select');
  }

  select(i) {
    this.selected = i;
    if (i < 0 || !this.selBox) { this.selBox?.setVisible(false); return; }
    const [px, py] = this.pos(i);
    this.selBox.setPosition(px, py).setVisible(true);
  }

  trySwap(a, b) {
    if (!this.enabled || !this.board.cells[a] || !this.board.cells[b]) return;
    this.clearHint();
    this.onSwap?.(a, b);
  }

  // ---------------------------------------------------------------- hints

  hint(a, b) {
    this.clearHint();
    for (const i of [a, b]) {
      const s = this.sprites.get(this.board.cells[i]?.id);
      if (!s) continue;
      this.hintTweens.push(this.scene.tweens.add({ targets: s, scale: 1.18, duration: 320, yoyo: true, repeat: -1 }));
    }
  }

  clearHint() {
    for (const t of this.hintTweens) { t.stop(); t.targets.forEach((s) => s.setScale?.(1)); }
    this.hintTweens = [];
  }

  // ---------------------------------------------------------------- animation

  wait(ms) { return new Promise((res) => this.scene.time.delayedCall(ms / this.speed, res)); }

  tween(cfg) {
    return new Promise((res) => {
      if (!cfg.targets || (Array.isArray(cfg.targets) && !cfg.targets.length)) { res(); return; }
      this.scene.tweens.add({ ...cfg, duration: cfg.duration / this.speed, onComplete: res });
    });
  }

  /** Animate a list of steps from logic/board.js. */
  async play(steps) {
    this.clearHint();
    for (const st of steps) {
      if (!this.scene.sys.isActive() && !this.scene.sys.isPaused()) return;
      if (st.t === 'swap') await this.playSwap(st);
      else if (st.t === 'clear') await this.playClear(st);
      else if (st.t === 'fall') await this.playFall(st);
      else if (st.t === 'shuffle') await this.playShuffle(st);
    }
    this.reconcile();
  }

  async playSwap({ a, b, ida, idb, back }) {
    const sa = this.sprites.get(ida); const sb = this.sprites.get(idb);
    const [ax, ay] = this.pos(a); const [bx, by] = this.pos(b);
    sfx('move');
    await Promise.all([
      this.tween({ targets: sa, x: bx, y: by, duration: 140 }),
      this.tween({ targets: sb, x: ax, y: ay, duration: 140 }),
    ]);
    if (back) {
      sfx('error');
      await Promise.all([
        this.tween({ targets: sa, x: ax, y: ay, duration: 140 }),
        this.tween({ targets: sb, x: bx, y: by, duration: 140 }),
      ]);
    }
  }

  async playClear({ cells, made, blasts, chain }) {
    for (const b of blasts) this.blastFx(b);
    if (blasts.length) sfx(blasts.some((b) => b.s === 'star' || b.s === 'bomb') ? 'boom' : 'smallBoom');
    else sfx(chain > 1 ? 'coin' : 'capture');
    const gone = [];
    for (const c of cells) {
      const s = this.sprites.get(c.id);
      if (!s) continue;
      this.sprites.delete(c.id);
      gone.push(s);
      this.sparks(s.x, s.y, c.c);
    }
    if (chain >= 2) {
      const [px, py] = this.pos(cells[0]?.i ?? 27);
      const t = outlined(this.scene, Math.max(this.x0 + 50, Math.min(this.x0 + this.size - 50, px)), py, `Chain x${chain}`, { color: PALETTE.gold }).setDepth(80);
      this.scene.tweens.add({ targets: t, y: py - 30, alpha: 0, delay: 350, duration: 400, onComplete: () => t.destroy() });
    }
    await this.tween({ targets: gone, scale: 1.3, alpha: 0, duration: 170 });
    gone.forEach((s) => s.destroy());
    for (const m of made) {
      const old = this.sprites.get(m.id);
      if (old) old.destroy();
      const s = this.makeSprite(m, m.i);
      s.setScale(0.2);
      this.tween({ targets: s, scale: 1, duration: 200, ease: 'Back.easeOut' });
    }
    if (made.length) sfx('power');
    await this.wait(made.length ? 120 : 40);
  }

  async playFall({ moves, spawns }) {
    const jobs = [];
    let longest = 0;
    for (const m of moves) {
      const s = this.sprites.get(m.id);
      if (!s) continue;
      const [px, py] = this.pos(m.to);
      const rows = Math.round((py - s.y) / this.cell);
      longest = Math.max(longest, rows);
      jobs.push(this.tween({ targets: s, x: px, y: py, duration: 90 + rows * 45, ease: 'Quad.easeIn' }));
    }
    for (const sp of spawns) {
      const s = this.makeSprite(sp, sp.to, -sp.drop * this.cell);
      const [, py] = this.pos(sp.to);
      longest = Math.max(longest, sp.drop);
      jobs.push(this.tween({ targets: s, y: py, duration: 90 + sp.drop * 45, ease: 'Quad.easeIn' }));
    }
    await Promise.all(jobs);
    if (jobs.length) sfx('place');
  }

  async playShuffle({ cells }) {
    const all = [...this.sprites.values()];
    await this.tween({ targets: all, alpha: 0, scale: 0.4, duration: 220 });
    for (const s of all) s.destroy();
    this.sprites.clear();
    const fresh = [];
    cells.forEach((cell) => { if (cell) { const s = this.makeSprite(cell, cell.i); s.setAlpha(0).setScale(0.4); fresh.push(s); } });
    sfx('flip');
    await this.tween({ targets: fresh, alpha: 1, scale: 1, duration: 260 });
  }

  /** Gems changed colour (skills). cells: [{ i, id, c, s }] */
  async playConvert(cells) {
    for (const c of cells) {
      const old = this.sprites.get(c.id);
      if (old) old.destroy();
      const s = this.makeSprite({ id: c.id, c: c.c, s: c.s }, c.i);
      s.setScale(1.5);
      this.tween({ targets: s, scale: 1, duration: 250, ease: 'Back.easeOut' });
      this.sparks(s.x, s.y, c.c, 2);
    }
    sfx('power');
    await this.wait(cells.length ? 320 : 0);
  }

  sparks(x, y, c, n = 3) {
    const color = hex(GEM_COLORS[c] ?? PALETTE.cream);
    for (let k = 0; k < n; k++) {
      const r = this.scene.add.rectangle(x, y, 5, 5, color).setDepth(30);
      this.fx.add(r);
      const a = Math.random() * Math.PI * 2;
      const d = 14 + Math.random() * 16;
      this.scene.tweens.add({ targets: r, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, duration: 300 / this.speed, onComplete: () => r.destroy() });
    }
  }

  blastFx({ i, s }) {
    const [px, py] = this.pos(i);
    let g;
    if (s === 'h') g = this.scene.add.rectangle(this.x0 + this.size / 2, py, this.size, this.cell * 0.6, 0xffffff, 0.8);
    else if (s === 'v') g = this.scene.add.rectangle(px, this.y0 + this.size / 2, this.cell * 0.6, this.size, 0xffffff, 0.8);
    else if (s === 'bomb') g = this.scene.add.rectangle(px, py, this.cell * 3, this.cell * 3, 0xffd070, 0.7);
    else g = this.scene.add.circle(px, py, this.cell * 2, 0xffffff, 0.7);
    g.setDepth(31);
    this.fx.add(g);
    this.scene.cameras.main.shake(120, 0.004);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 320 / this.speed, onComplete: () => g.destroy() });
  }

  destroy() {
    for (const s of this.sprites.values()) s.destroy();
    this.layer.destroy(); this.fx.destroy(); this.bg.destroy(); this.zone.destroy(); this.selBox.destroy();
  }
}

export { Phaser };

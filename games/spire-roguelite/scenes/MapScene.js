import Phaser from 'phaser';
import { PALETTE, hex, text, button, WIDTH, HEIGHT, route, go, setBackground, icon, unit, toast, sfx, topBar, relicRow, runMenu, dragScroll, modal, overlayOpened } from './common.js';
import { ROWS, NODE_TYPES } from '../logic/map.js';
import { availableNodes, travel, actInfo, HEROES } from '../logic/run.js';
import { ENEMIES } from '../logic/enemies.js';
import { recordRun, saveRun } from '../save.js';

export const ACT_COLORS = [
  { bg: '#24311f', ground: '#2e3d27', tint: 0xffffff, dots: '#3c4f33' },
  { bg: '#1f2633', ground: '#283142', tint: 0x9fb4d8, dots: '#35405a' },
  { bg: '#311d1d', ground: '#3d2523', tint: 0xd89060, dots: '#552f2a' },
];

const VIEW_TOP = 88;
const ROW_H = 50;
const TOP_PAD = 70;
const NODE_ICON = {
  fight: ['sk:14,1', 2], elite: ['bld:4,6', 1], event: ['sk:2,1', 2], rest: ['img:campfire', 2],
  shop: ['bld:0,3', 1], treasure: ['img:chest', 2],
};

export const nodeX = (n) => 36 + n.col * 48 + n.jx;
export const nodeY = (n) => TOP_PAD + (ROWS - n.row) * ROW_H + n.jy;

export class MapScene extends Phaser.Scene {
  constructor() { super('Map'); }

  init(data) { this.run = data.run; this.leaving = false; }

  create() {
    const run = this.run;
    const colors = ACT_COLORS[(run.act - 1) % 3];
    setBackground(this, colors.bg);
    this.content = this.add.container(0, 0);
    const contentH = TOP_PAD + ROWS * ROW_H + 70;
    this.drawGround(colors, contentH);
    this.drawPaths();
    this.drawNodes();

    // Fixed UI on top.
    this.add.rectangle(0, 44, WIDTH, VIEW_TOP - 44, hex(PALETTE.night), 0.95).setOrigin(0).setDepth(39);
    this.bar = topBar(this, run, { onDeck: () => this.showDeck(), onMenu: () => runMenu(this, run, { onAbandon: () => this.abandon() }) });
    const many = run.relics.length > 10;
    relicRow(this, run, 20, 66, many ? { scale: 1, gap: 20, maxW: WIDTH - 24 } : { scale: 2, gap: 34 });

    button(this, WIDTH - 40, HEIGHT - 24, 64, 32, 'Key', () => this.showKey(), { fill: PALETTE.sand }).setDepth(40);
    const scroller = dragScroll(this, this.content, VIEW_TOP, HEIGHT, contentH);
    this.scroller = scroller;
    // Start with the current row in view.
    const cur = run.pos !== null && run.pos !== undefined ? run.map.nodes[run.pos] : null;
    const focusY = cur ? nodeY(cur) : nodeY({ row: 0, jy: 0 });
    scroller.scrollTo(Math.max(0, focusY - (HEIGHT - VIEW_TOP) / 2 - VIEW_TOP + 120));

    const title = run.mode === 'endless' && run.loop ? `${actInfo(run).name} +${run.loop}` : actInfo(run).name;
    this.content.add(text(this, WIDTH / 2, 14, title, { color: PALETTE.gold }));
    this.content.add(text(this, WIDTH / 2, 34, `Act ${run.act}${run.mode === 'endless' ? ` - loop ${run.loop + 1}` : ' of 3'} - Floor ${run.floor}`, { color: PALETTE.lavender }));
    if (!run.path?.length && run.act === 1 && run.loop === 0) {
      this.time.delayedCall(400, () => toast(this, 'Tap a glowing room to begin', HEIGHT - 64));
    }
  }

  drawGround(colors, h) {
    const g = this.add.graphics();
    g.fillStyle(hex(colors.ground)).fillRect(0, 0, WIDTH, h);
    const rnd = new Phaser.Math.RandomDataGenerator([String(this.run.seed), String(this.run.act), String(this.run.loop)]);
    g.fillStyle(hex(colors.dots));
    for (let i = 0; i < 120; i++) g.fillRect(rnd.between(0, WIDTH), rnd.between(0, h), 4, 4);
    this.content.add(g);
    // Trees along the edges and between columns.
    const trees = ['1,0', '1,3', '1,6'];
    const nodes = this.run.map.nodes;
    for (let i = 0; i < 46; i++) {
      const x = rnd.between(4, WIDTH - 4);
      const y = rnd.between(60, h - 10);
      if (nodes.some((n) => Math.abs(nodeX(n) - x) < 26 && Math.abs(nodeY(n) - y) < 26)) continue;
      const t = this.add.image(x, y, 'trees', rnd.pick(trees)).setScale(2).setTint(colors.tint).setAlpha(0.8);
      this.content.add(t);
    }
  }

  drawPaths() {
    const run = this.run;
    const g = this.add.graphics();
    const path = run.path || [];
    const walked = new Set();
    for (let i = 1; i < path.length; i++) walked.add(`${path[i - 1]}>${path[i]}`);
    for (const n of run.map.nodes) {
      for (const id of n.next) {
        const m = run.map.nodes[id];
        const done = walked.has(`${n.id}>${id}`);
        const x1 = nodeX(n); const y1 = nodeY(n);
        const x2 = m.type === 'boss' ? WIDTH / 2 : nodeX(m); const y2 = m.type === 'boss' ? nodeY(m) + 40 : nodeY(m);
        const len = Math.hypot(x2 - x1, y2 - y1);
        const steps = Math.floor(len / 9);
        g.fillStyle(hex(done ? PALETTE.gold : PALETTE.cream), done ? 1 : 0.35);
        for (let s = 2; s < steps - 1; s++) {
          const t = s / steps;
          g.fillRect(Math.round(x1 + (x2 - x1) * t) - 2, Math.round(y1 + (y2 - y1) * t) - 2, 4, 4);
        }
      }
    }
    this.content.add(g);
  }

  drawNodes() {
    const run = this.run;
    const avail = new Set(availableNodes(run));
    const visited = new Set(run.path || []);
    for (const n of run.map.nodes) {
      if (n.type === 'boss') { this.drawBoss(n, avail.has(n.id)); continue; }
      const x = nodeX(n); const y = nodeY(n);
      const can = avail.has(n.id);
      const ring = this.add.circle(x, y, 20, hex(PALETTE.ink), 0.55).setStrokeStyle(2, hex(can ? PALETTE.gold : PALETTE.ink));
      const [ref, sc] = NODE_ICON[n.type];
      const ic = icon(this, x, y, ref, sc);
      if (visited.has(n.id)) { ic.setAlpha(0.45); ring.setFillStyle(hex(PALETTE.gold), 0.25); }
      else if (!can && run.pos !== null && run.pos !== undefined && n.row <= run.map.nodes[run.pos].row) ic.setAlpha(0.35);
      this.content.add([ring, ic]);
      if (can) {
        this.tweens.add({ targets: ring, scale: 1.18, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: ic, scale: sc * 1.12, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      const zone = this.add.zone(x, y, 46, 46).setInteractive({ useHandCursor: true });
      zone.on('pointerup', () => this.tapNode(n, can));
      this.content.add(zone);
      if (run.pos === n.id) {
        const hero = unit(this, x + 14, y + 6, HEROES[run.hero].sprite, 2);
        this.content.add(hero);
      }
    }
  }

  drawBoss(n, can) {
    const run = this.run;
    const d = ENEMIES[run.bossId];
    const y = nodeY(n);
    const frame = this.add.rectangle(WIDTH / 2, y + 8, 132, 96, hex(PALETTE.wine), 0.8).setStrokeStyle(3, hex(can ? PALETTE.gold : PALETTE.ink));
    const s = unit(this, WIDTH / 2, y + 44, d.sprite, 3);
    const label = text(this, WIDTH / 2, y - 52, `Boss: ${d.name}`, { color: PALETTE.orange });
    this.content.add([frame, s, label]);
    if (can) this.tweens.add({ targets: frame, alpha: 0.6, duration: 500, yoyo: true, repeat: -1 });
    const zone = this.add.zone(WIDTH / 2, y + 8, 132, 96).setInteractive({ useHandCursor: true });
    zone.on('pointerup', () => this.tapNode(n, can));
    this.content.add(zone);
  }

  tapNode(n, can) {
    if (this.scroller.moved || this.leaving) return;
    const t = NODE_TYPES[n.type];
    if (!can) { toast(this, `${t.name}: ${t.desc}`, HEIGHT - 64, PALETTE.cream); return; }
    this.leaving = true;
    sfx(n.type === 'boss' || n.type === 'elite' ? 'thud' : 'move');
    travel(this.run, n.id);
    route(this, this.run);
  }

  /** Legend: what each room icon means. */
  showKey() {
    sfx('select');
    const c = this.add.container(0, 0).setDepth(100);
    overlayOpened(this, c);
    c.add(this.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.7).setOrigin(0).setInteractive());
    const types = ['fight', 'elite', 'event', 'rest', 'shop', 'treasure', 'boss'];
    const top = 92;
    const h = types.length * 58 + 96;
    c.add(this.add.rectangle(14, top, WIDTH - 28, h, hex(PALETTE.indigo)).setOrigin(0).setStrokeStyle(3, hex(PALETTE.lavender)));
    c.add(text(this, WIDTH / 2, top + 20, 'Map key', { color: PALETTE.gold }));
    types.forEach((t, i) => {
      const y = top + 62 + i * 58;
      if (t === 'boss') c.add(text(this, 44, y, 'Boss', { color: PALETTE.orange }));
      else { const [ref, sc] = NODE_ICON[t]; c.add(icon(this, 44, y, ref, sc)); }
      c.add(text(this, 80, y - 10, NODE_TYPES[t].name, { origin: [0, 0.5], color: PALETTE.sand }));
      c.add(text(this, 80, y + 10, NODE_TYPES[t].desc, { origin: [0, 0.5], wrap: WIDTH - 110, align: 'left' }).setOrigin(0, 0.3));
    });
    c.add(button(this, WIDTH / 2, top + h - 28, 160, 36, 'Close', () => c.destroy(), { fill: PALETTE.lavender }));
  }

  showDeck() {
    this.scene.launch('Deck', { cards: this.run.deck, title: 'Your deck', from: 'Map' });
    this.scene.pause();
  }

  abandon() {
    this.run.screen = 'dead';
    this.run.abandoned = true;
    saveRun(this.run);
    go(this, 'RunEnd', { run: this.run });
  }
}

export { modal };

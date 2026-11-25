import {
  Phaser, PALETTE, hex, text, button, WIDTH, HEIGHT, go, setBackground, header, icon, unit, unitSize, modal, info, toast, sfx, outlined, tapCooldown,
} from './common.js';
import { getProgress, setProgress, getBattle, setBattle, abandonBattle, seen, markSeen } from '../save.js';
import { HEROES, GEAR, gearText } from '../logic/heroes.js';
import { REGIONS, ENEMIES, enemyStats, battleReward, findNode } from '../logic/world.js';
import { SKILLS } from '../logic/skills.js';
import { PUZZLES } from '../logic/puzzle.js';
import * as PR from '../logic/progress.js';
import { MAP_ART } from '../art.js';
import { makeRng, int } from '../logic/rng.js';

// Where each node sits on a region page (main battles 1-8 wind upward).
const MAIN_POS = [[70, 530], [170, 505], [268, 468], [190, 418], [90, 372], [160, 312], [266, 262], [180, 168]];
const SIDE_POS = { q0: [306, 392], q1: [58, 250], puzzle: [306, 548], town: [44, 448] };
const MAP_TOP = 86;
const MAP_BOTTOM = 572;

export class WorldMap extends Phaser.Scene {
  constructor() { super('WorldMap'); }

  init(data) {
    this.p = getProgress();
    const next = PR.nextBattle(this.p);
    this.region = data?.region ?? (next ? next.region : this.p.region ?? 0);
    this.justWon = data?.justWon;
  }

  create() {
    const reg = REGIONS[this.region];
    setBackground(this, reg.bg);
    header(this, 'World Map', () => go(this, 'Menu'));
    this.drawRegionBar();
    this.drawMap();
    this.drawBottomBar();
    this.p.region = this.region;
    setProgress(this.p);
    this.coachTips();
  }

  drawRegionBar() {
    const reg = REGIONS[this.region];
    this.add.rectangle(0, 44, WIDTH, 42, hex(PALETTE.ink), 0.6).setOrigin(0);
    const won = [1, 2, 3, 4, 5, 6, 7, 8].filter((k) => this.p.cleared[`b${this.region}-${k}`]).length;
    text(this, WIDTH / 2, 65, `${reg.name}  ${won}/8`, { color: PALETTE.sand });
    const prev = button(this, 30, 65, 48, 36, '<', () => this.switchRegion(-1), { fill: PALETTE.lavender });
    const next = button(this, WIDTH - 30, 65, 48, 36, '>', () => this.switchRegion(1), { fill: PALETTE.lavender });
    if (this.region === 0) prev.setEnabled(false);
    if (this.region === REGIONS.length - 1) next.setEnabled(false);
  }

  switchRegion(d) {
    const r = this.region + d;
    if (r < 0 || r >= REGIONS.length) return;
    sfx('flip');
    go(this, 'WorldMap', { region: r });
  }

  drawMap() {
    const reg = REGIONS[this.region];
    const unlocked = PR.regionUnlocked(this.p, this.region);
    const g = this.add.graphics();
    g.fillStyle(hex(reg.ground)).fillRect(0, MAP_TOP, WIDTH, MAP_BOTTOM - MAP_TOP);
    // Scenery (seeded per region so it never moves).
    const rng = makeRng(77 + this.region * 1013);
    const decor = MAP_ART[reg.id];
    const spots = [...MAIN_POS, ...Object.values(SIDE_POS)];
    for (let k = 0; k < 26; k++) {
      const x = int(rng, 10, WIDTH - 10); const y = int(rng, MAP_TOP + 14, MAP_BOTTOM - 10);
      if (spots.some(([sx, sy]) => Math.abs(sx - x) < 40 && Math.abs(sy - y) < 40)) continue;
      const ref = decor[int(rng, 0, decor.length - 1)];
      icon(this, x, y, ref, ref.startsWith('bld') ? 1 : 2).setAlpha(0.55);
    }
    // Paths: main road, then side paths.
    const road = this.add.graphics();
    const line = (a, b, color, w) => { road.lineStyle(w, color, 1).beginPath().moveTo(a[0], a[1]).lineTo(b[0], b[1]).strokePath(); };
    for (let k = 0; k < 7; k++) line(MAIN_POS[k], MAIN_POS[k + 1], hex(PALETTE.ink), 12);
    line(SIDE_POS.puzzle, MAIN_POS[reg.puzzle.after - 1], hex(PALETTE.ink), 6);
    reg.quests.forEach((q, i) => line(SIDE_POS[`q${i}`], MAIN_POS[q.after - 1], hex(PALETTE.ink), 6));
    line(SIDE_POS.town, MAIN_POS[0], hex(PALETTE.ink), 6);
    for (let k = 0; k < 7; k++) line(MAIN_POS[k], MAIN_POS[k + 1], hex(reg.bg), 6);

    this.nodes = [];
    for (const n of PR.nodesOf(this.region)) {
      let pos;
      if (n.kind === 'battle' || n.kind === 'boss') pos = MAIN_POS[n.k - 1];
      else if (n.kind === 'quest') pos = SIDE_POS[`q${reg.quests.findIndex((q) => q.id === n.id)}`];
      else pos = SIDE_POS.puzzle;
      this.drawNode(n, pos);
    }
    this.drawTown(unlocked);
    if (!unlocked) {
      const c = this.add.container(0, 0).setDepth(50);
      c.add(this.add.rectangle(0, MAP_TOP, WIDTH, MAP_BOTTOM - MAP_TOP, hex(PALETTE.ink), 0.7).setOrigin(0).setInteractive());
      c.add(text(this, WIDTH / 2, 320, `Defeat the ${ENEMIES[REGIONS[this.region - 1].battles[7]].name}\nin ${REGIONS[this.region - 1].name}\nto open ${reg.name}.`, { color: PALETTE.cream, wrap: 300 }));
    }
  }

  drawNode(n, [x, y]) {
    const state = PR.nodeState(this.p, n);
    const boss = n.kind === 'boss';
    const r = boss ? 30 : 23;
    const c = this.add.container(x, y).setDepth(10);
    const ring = this.add.circle(0, 0, r, hex(state === 'done' ? PALETTE.leaf : state === 'open' ? PALETTE.gold : PALETTE.indigo)).setStrokeStyle(3, hex(PALETTE.ink));
    const inner = this.add.circle(0, 0, r - 5, 0x4a4560);
    c.add([ring, inner]);
    if (n.kind === 'puzzle') c.add(icon(this, 0, 0, MAP_ART.puzzle, 1));
    else if (n.kind === 'quest') {
      c.add(icon(this, 0, 2, MAP_ART.quest, 2));
    } else {
      const e = ENEMIES[n.enemy];
      const sc = unitSize(e.sprite) === 24 ? 2 : 2;
      const u = unit(this, 0, unitSize(e.sprite) === 24 ? 22 : 16, e.sprite, sc, true);
      c.add(u);
    }
    if (state === 'locked') { c.setAlpha(0.55); inner.setFillStyle(hex(PALETTE.ink)); }
    if (state === 'done') {
      // A small green tick.
      const t = this.add.graphics();
      t.fillStyle(hex(PALETTE.ink)).fillCircle(r - 6, -r + 6, 9);
      t.fillStyle(hex(PALETTE.leaf)).fillCircle(r - 6, -r + 6, 7);
      t.lineStyle(3, 0xf9f5ef).beginPath().moveTo(r - 10, -r + 6).lineTo(r - 7, -r + 9).lineTo(r - 2, -r + 2).strokePath();
      c.add(t);
    }
    if (state === 'open') {
      this.tweens.add({ targets: ring, scale: 1.12, duration: 500, yoyo: true, repeat: -1 });
      if (n.kind === 'quest' || n.kind === 'puzzle') c.add(outlined(this, 0, -r - 8, '!', { color: PALETTE.gold }));
    }
    const hit = this.add.zone(0, 0, Math.max(48, r * 2 + 4), Math.max(48, r * 2 + 4)).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => this.tapNode(n, state));
    c.add(hit);
    if (n.id === this.justWon) {
      const t = outlined(this, x, y - r - 14, 'Won!', { color: PALETTE.gold }).setDepth(30);
      this.tweens.add({ targets: t, y: t.y - 16, alpha: 0, delay: 900, duration: 500, onComplete: () => t.destroy() });
    }
    this.nodes.push({ n, c, state });
  }

  drawTown(unlocked) {
    const [x, y] = SIDE_POS.town;
    const c = this.add.container(x, y).setDepth(10);
    c.add(this.add.circle(0, 0, 25, hex(PALETTE.sand)).setStrokeStyle(3, hex(PALETTE.ink)));
    c.add(icon(this, 0, -2, MAP_ART.town, 1.25));
    c.add(outlined(this, 0, 32, 'Shop', { color: PALETTE.sand }));
    const hit = this.add.zone(0, 0, 54, 54).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => { if (unlocked) { sfx('select'); go(this, 'Shop', { region: this.region }); } });
    c.add(hit);
  }

  drawBottomBar() {
    const y = MAP_BOTTOM;
    this.add.rectangle(0, y, WIDTH, HEIGHT - y, hex(PALETTE.ink)).setOrigin(0);
    const id = this.p.active;
    const h = this.p.heroes[id];
    unit(this, 28, y + 52, HEROES[id].sprite, 3);
    text(this, 54, y + 22, `${HEROES[id].name}  Lv ${h.lvl}`, { origin: [0, 0.5] });
    text(this, 54, y + 46, `${this.p.gold} gold`, { origin: [0, 0.5], color: PALETTE.gold });
    button(this, 284, y + 34, 132, 44, 'Heroes', () => go(this, 'Heroes', { from: 'WorldMap', region: this.region }), { fill: PALETTE.lavender });
  }

  // ------------------------------------------------------------------ taps

  tapNode(n, state) {
    if (this._modals) return;
    if (state === 'locked') {
      sfx('error');
      const msg = n.kind === 'battle' || n.kind === 'boss' ? 'Win the battle before this one first.' : `Opens after battle ${n.after}.`;
      toast(this, msg, 330, PALETTE.cream);
      return;
    }
    sfx('select');
    if (n.kind === 'puzzle') { this.puzzlePopup(n, state); return; }
    this.battlePopup(n, state);
  }

  battlePopup(n, state) {
    const e = enemyStats(n.enemy, n.p);
    const rew = battleReward(n.p, { boss: n.kind === 'boss', elite: e.elite, quest: n.kind === 'quest' });
    const hero = this.p.heroes[this.p.active];
    const lines = [];
    if (n.kind === 'quest') lines.push(n.quest.text, '');
    lines.push(`HP ${e.maxHp}, skulls hit for ${e.skull}.`, `Skills: ${e.skills.map((s) => SKILLS[s].name).join(', ')}.`);
    if (n.kind === 'quest') {
      const it = GEAR[n.quest.reward];
      lines.push(state === 'done' ? 'Quest done (reward taken).' : `Reward: ${it.name} (${gearText(n.quest.reward)}).`);
    }
    lines.push(state === 'done' ? `Won before: replays pay ${Math.round(rew.xp * 0.6)} XP.` : `Win: ${rew.xp} XP and ${rew.gold} gold.`);
    const title = n.kind === 'quest' ? n.quest.name : `${e.name}  Lv ${e.level}${n.kind === 'boss' ? '  BOSS' : ''}`;
    modal(this, title, lines.join('\n'), [
      [`Fight as ${HEROES[this.p.active].name} Lv ${hero.lvl}`, (close) => { close(); this.startBattle(n.id); }],
      ['Change hero', (close) => { close(); go(this, 'Heroes', { from: 'WorldMap', region: this.region }); }, PALETTE.lavender],
      ['Close', (close) => close(), PALETTE.indigo, PALETTE.cream],
    ], { width: 330, art: { make: (x, y) => unit(this, x, y + 32, e.sprite, unitSize(e.sprite) === 24 ? 3 : 4, true) } });
  }

  startBattle(nodeId) {
    const cur = getBattle();
    const begin = () => {
      this.p = getProgress();
      const { battle, ctx } = PR.campaignBattle(this.p, nodeId, (Math.random() * 2 ** 31) >>> 0);
      setBattle({ battle, ctx });
      go(this, 'Battle', { battle, ctx });
    };
    if (!cur) { begin(); return; }
    if (cur.ctx.mode === 'campaign' && cur.ctx.node === nodeId) { go(this, 'Battle', cur); return; }
    modal(this, 'Battle in progress', 'You left a battle unfinished. Go back to it, or give it up (it counts as a loss)?', [
      ['Resume it', (close) => { close(); go(this, 'Battle', cur); }],
      ['Give it up', (close) => { close(); abandonBattle(); begin(); }, PALETTE.red, PALETTE.cream],
      ['Cancel', (close) => close(), PALETTE.lavender],
    ]);
  }

  puzzlePopup(n, state) {
    const P = PUZZLES[n.puzzle];
    modal(this, P.name, `A riddle stone. Clear every gem from the board in ${P.moves} moves. No new gems fall in.\n\n${state === 'done' ? 'Solved! You can play it again for fun.' : 'Reward: 100 gold.'}`, [
      ['Solve it', (close) => { close(); go(this, 'Puzzle', { id: n.puzzle, region: this.region }); }],
      ['Close', (close) => close(), PALETTE.lavender],
    ], { art: { make: (x, y) => icon(this, x, y, MAP_ART.puzzle, 2) } });
  }

  coachTips() {
    const p = this.p;
    if (!PR.regionUnlocked(p, this.region)) return;
    let msg = null; let key = null;
    if (!Object.keys(p.cleared).length) { key = 'map-start'; msg = 'Tap the glowing battle at the bottom to begin your quest!'; }
    else if (p.cleared['b0-1'] && !seen('map-shop') && p.gold >= 80) { key = 'map-shop'; msg = 'You have gold! The shop (house, left) sells gear. Equip it on the Heroes screen.'; }
    else if (p.cleared['b0-2'] && !p.cleared.p1 && !seen('map-puzzle')) { key = 'map-puzzle'; msg = 'A riddle stone opened (right). Puzzles pay gold.'; }
    else if (p.cleared['b0-3'] && !seen('map-quest')) { key = 'map-quest'; msg = 'A side quest (chest) opened. Quests give unique gear.'; }
    else if (p.heroes.mage && p.cleared['b0-1'] && !seen('map-heroes')) { key = 'map-heroes'; msg = 'The Mage fights too. Switch heroes on the Heroes screen. Heroes who sit out still get half the XP.'; }
    if (!msg || (key !== 'map-start' && seen(key))) return;
    if (key !== 'map-start') markSeen(key);
    const c = this.add.container(0, 0).setDepth(45);
    const bg = this.add.rectangle(WIDTH / 2, MAP_TOP + 34, WIDTH - 16, 56, hex(PALETTE.night), 0.94).setStrokeStyle(3, hex(PALETTE.gold)).setInteractive();
    bg.on('pointerup', () => c.destroy());
    c.add([bg, text(this, WIDTH / 2, MAP_TOP + 34, msg, { wrap: WIDTH - 40 })]);
  }
}

import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { isMuted, setMuted, sfx } from '../../../shared/core/sfx.js';
import {
  WIDTH, HEIGHT, go, modal, shadowTitle, setBackground, store, openHowTo, header, fit,
} from './common.js';
import { save, loadBattle, clearBattle, campaign, getRecord, saveBattle } from '../save.js';
import { skillLabel, resetSkill } from '../adaptive.js';
import { CAMPAIGN, SKIRMISH, mapById } from '../logic/maps.js';
import { parseMap, newGame } from '../logic/game.js';
import { frame, sprite, unitRef, buildingRef, TILE, setRef } from '../frames.js';

const MINI = {
  sand: 0xd88038, dunes: 0xf0b050, oasis: 0x6c8c50, mesa: 0x6b3a35, water: 0x2a8a8a, road: 0x777777,
};
const OWNER = { '-1': 0xcfc6b8, 0: 0x5b8fd8, 1: 0xd0453f };

export class Menu extends Phaser.Scene {
  constructor() { super('Menu'); }

  init(data) { this.view = data?.view || 'main'; this.brief = data?.brief || null; }

  create() {
    setBackground(this, PALETTE.night);
    window.__sandMenu = this;
    if (this.view === 'campaign') this.campaignView();
    else if (this.view === 'skirmish' || this.view === 'versus') this.mapsView(this.view);
    else this.mainView();
  }

  // ---------- Main ----------

  mainView() {
    this.diorama(70);
    shadowTitle(this, WIDTH / 2, 34, 'SAND TACTICS');
    button(this, WIDTH - 26, 34, 40, 36, '?', () => openHowTo(this), { size: 32, fill: PALETTE.gold });

    const saved = loadBattle();
    let y = 236;
    if (saved && !saved.over) {
      const label = saved.mode === 'campaign' ? `Continue: ${saved.name}` : `Continue: ${saved.name} (${saved.mode === 'versus' ? '2P' : 'vs CPU'})`;
      fit(button(this, WIDTH / 2, y, 300, 46, label, () => this.resume(saved), { fill: PALETTE.gold }).label, 270);
      text(this, WIDTH / 2, y + 34, `Day ${saved.day}`, { color: PALETTE.lavender });
      y += 70;
    } else y += 20;
    const c = campaign();
    const done = Math.min(c.unlocked, CAMPAIGN.length);
    button(this, WIDTH / 2, y, 300, 46, `Campaign  (${done}/${CAMPAIGN.length})`, () => go(this, 'Menu', { view: 'campaign' }), { fill: saved ? PALETTE.lavender : PALETTE.gold });
    button(this, WIDTH / 2, y + 58, 300, 46, 'Skirmish vs CPU', () => go(this, 'Menu', { view: 'skirmish' }), { fill: PALETTE.lavender });
    button(this, WIDTH / 2, y + 116, 300, 46, '2 Players (one phone)', () => go(this, 'Menu', { view: 'versus' }), { fill: PALETTE.lavender });

    text(this, WIDTH / 2, 566, 'Art: Aleksandr Makarov', { color: PALETTE.indigo });
    button(this, 86, 612, 156, 40, '< All Games', () => { window.location.href = '../'; }, { fill: PALETTE.indigo, color: PALETTE.cream });
    this.lvlBtn = button(this, 226, 612, 108, 40, `CPU Lv ${skillLabel()}`, () => this.levelInfo(), { fill: PALETTE.indigo, color: PALETTE.cream });
    this.soundBtn = button(this, 320, 612, 68, 40, '', () => { setMuted(!isMuted()); this.syncSound(); });
    this.syncSound();
  }

  diorama(top) {
    const h = 128;
    const rt = this.add.renderTexture(0, top, WIDTH / 2, h / 2).setOrigin(0).setScale(2);
    let seed = 9;
    const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
    for (let y = 0; y < h / 2; y += 8) {
      for (let x = 0; x < WIDTH / 2; x += 8) {
        const [k, f] = frame(this, ['tiles', ...TILE.sand[Math.floor(rnd() * TILE.sand.length)], 8, 8]);
        rt.drawFrame(k, f, x, y);
        if (rnd() < 0.08) { const [k2, f2] = frame(this, ['tiles', ...TILE.sandDecal[0], 8, 8]); rt.drawFrame(k2, f2, x, y); }
      }
    }
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.ink)).fillRect(0, top - 4, WIDTH, 4).fillRect(0, top + h, WIDTH, 4);
    sprite(this, 50, top + 76, buildingRef('hq', 0), 2).setOrigin(0.5, 1);
    sprite(this, 312, top + 76, buildingRef('factory', 1), 2).setOrigin(0.5, 1);
    sprite(this, 180, top + 44, buildingRef('city', -1), 2).setOrigin(0.5, 1);
    sprite(this, 110, top + 98, unitRef('tank', 0, 'right'), 3);
    sprite(this, 150, top + 110, unitRef('arty', 0, 'right'), 2);
    sprite(this, 250, top + 100, unitRef('heavy', 1, 'left'), 2);
    const drone = sprite(this, 230, top + 40, unitRef('drone', 1, 'left'), 2);
    this.tweens.add({ targets: drone, y: drone.y - 6, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.InOut' });
    const feet = [
      sprite(this, 80, top + 112, unitRef('inf', 0), 2), sprite(this, 66, top + 118, unitRef('inf', 0), 2),
      sprite(this, 290, top + 116, unitRef('hinf', 1), 2).setFlipX(true), sprite(this, 304, top + 108, unitRef('inf', 1), 2).setFlipX(true),
    ];
    const arts = ['inf', 'inf', 'hinf', 'inf']; const sides = [0, 0, 1, 1];
    let i = 0;
    this.time.addEvent({ delay: 220, loop: true, callback: () => { i++; feet.forEach((f, k) => setRef(this, f, unitRef(arts[k], sides[k], 'right', 'idle', i + k))); } });
  }

  syncSound() {
    this.soundBtn.setLabel(isMuted() ? 'Mute' : 'Sound');
    this.soundBtn.body.setFillStyle(hex(isMuted() ? PALETTE.indigo : PALETTE.leaf));
    this.soundBtn.label.setColor(PALETTE.cream);
  }

  levelInfo() {
    modal(this, 'CPU level', [
      `The computer plays at level ${skillLabel()} of 10.`,
      'It rises when you win and falls when you lose, so battles stay close. Only its decisions change, never its funds or units.',
    ], [['OK', null], ['Reset to start', () => { resetSkill(); this.lvlBtn.setLabel(`CPU Lv ${skillLabel()}`); }]]);
  }

  resume(saved) {
    store.start = { state: saved, fresh: false };
    sfx('select');
    go(this, 'Battle');
  }

  // ---------- Campaign ----------

  campaignView() {
    header(this, 'Campaign', () => go(this, 'Menu'));
    const c = campaign();
    const cardH = 58;
    CAMPAIGN.forEach((m, i) => {
      const y = 56 + i * (cardH + 6);
      const locked = i > c.unlocked;
      const best = c.best[m.id];
      const cont = this.add.container(0, 0).setAlpha(locked ? 0.5 : 1);
      cont.add(panel(this, 14, y, WIDTH - 28, cardH, { fill: PALETTE.night, inner: best ? PALETTE.leaf : locked ? PALETTE.indigo : PALETTE.gold }));
      cont.add(text(this, 28, y + 18, `${i + 1}. ${m.name}`, { origin: [0, 0.5], color: locked ? PALETTE.lavender : PALETTE.cream }));
      const status = locked ? 'Locked' : best ? `Won on day ${best}` : 'New';
      cont.add(text(this, WIDTH - 28, y + 18, status, { origin: [1, 0.5], color: best ? PALETTE.leaf : locked ? PALETTE.lavender : PALETTE.gold }));
      const sub = locked ? `Win mission ${i} to unlock` : `${m.rows[0].length}x${m.rows.length}  ${'*'.repeat(Math.ceil((i + 1) / 2))}  ${m.survive ? 'Hold out' : 'Rout or take HQ'}`;
      cont.add(text(this, 28, y + 40, sub, { origin: [0, 0.5], color: PALETTE.lavender }));
      const z = this.add.zone(14, y, WIDTH - 28, cardH).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => {
        if (locked) { sfx('error'); return; }
        sfx('tap');
        this.briefing(m);
      });
    });
    if (this.brief) {
      const m = CAMPAIGN.find((x) => x.id === this.brief);
      if (m) this.time.delayedCall(200, () => this.briefing(m));
    }
  }

  briefing(m) {
    const saved = loadBattle();
    const lines = [m.brief];
    if (m.survive) lines.push({ text: `Objective: hold out until day ${m.survive.days + 1}, or rout the enemy.`, color: PALETTE.gold });
    else lines.push({ text: 'Objective: capture the enemy HQ or destroy all enemy units.', color: PALETTE.gold });
    if (saved && !saved.over) lines.push({ text: 'This replaces your battle in progress.', color: PALETTE.orange });
    modal(this, m.name, lines, [['Start', () => this.start(m, 'campaign')], ['Back', null]], { row: true });
  }

  // ---------- Skirmish / 2 players ----------

  mapsView(kind) {
    header(this, kind === 'versus' ? '2 Players' : 'Skirmish', () => go(this, 'Menu'));
    text(this, WIDTH / 2, 62, kind === 'versus' ? 'Pass the phone between turns.' : `You are Blue and move first. CPU level ${skillLabel()}.`, { color: PALETTE.lavender });
    const cardH = 118;
    SKIRMISH.forEach((m, i) => {
      const y = 82 + i * (cardH + 8);
      panel(this, 14, y, WIDTH - 28, cardH, { fill: PALETTE.night, inner: PALETTE.sand });
      this.miniMap(m, 26, y + 10, cardH - 20);
      text(this, 110, y + 22, m.name, { origin: [0, 0.5], color: PALETTE.gold });
      text(this, 110, y + 48, m.desc, { origin: [0, 0.5], color: PALETTE.cream, wrap: 220, align: 'left' });
      if (kind === 'skirmish') {
        const r = getRecord(m.id);
        text(this, 110, y + 96, r.w + r.l ? `Won ${r.w}, lost ${r.l}` : 'Not played yet', { origin: [0, 0.5], color: r.w ? PALETTE.leaf : PALETTE.lavender });
      }
      const z = this.add.zone(14, y, WIDTH - 28, cardH).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => {
        sfx('tap');
        const saved = loadBattle();
        const lines = [kind === 'versus' ? 'Blue moves first. Hand the phone over when you end your turn.' : 'Capture the CPU\'s HQ or destroy all its units.'];
        lines.push({ text: `Starting funds ${m.funds[0]}. Every building pays 1000 a day.`, color: PALETTE.lavender });
        if (saved && !saved.over) lines.push({ text: 'This replaces your battle in progress.', color: PALETTE.orange });
        modal(this, m.name, lines, [['Start', () => this.start(m, kind)], ['Back', null]], { row: true });
      });
    });
  }

  miniMap(def, x, y, maxH) {
    const m = parseMap(def);
    const cell = Math.max(2, Math.min(6, Math.floor(maxH / m.h)));
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.ink)).fillRect(x - 2, y - 2, m.w * cell + 4, m.h * cell + 4);
    for (let yy = 0; yy < m.h; yy++) {
      for (let xx = 0; xx < m.w; xx++) {
        const t = m.terrain[yy * m.w + xx];
        g.fillStyle(MINI[t] ?? 0xd88038).fillRect(x + xx * cell, y + yy * cell, cell, cell);
      }
    }
    for (const p of m.props) {
      g.fillStyle(OWNER[p.owner]).fillRect(x + p.x * cell, y + p.y * cell, cell, cell);
      if (p.kind === 'hq') g.lineStyle(1, 0xffffff).strokeRect(x + p.x * cell - 0.5, y + p.y * cell - 0.5, cell + 1, cell + 1);
    }
  }

  start(def, kind) {
    clearBattle();
    const controllers = kind === 'versus' ? ['human', 'human'] : ['human', 'cpu'];
    const state = newGame(def, { seed: (Date.now() & 0xffffff) >>> 0, controllers, mode: kind, missionId: kind === 'campaign' ? def.id : null });
    saveBattle(state);
    store.start = { state, fresh: true };
    sfx('power');
    go(this, 'Battle');
  }
}

export { mapById };

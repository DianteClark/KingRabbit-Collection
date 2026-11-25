import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { isMuted, setMuted, sfx } from '../../../shared/core/sfx.js';
import { hasTrophy, dailySeed, profile, playedDailyToday } from '../../../shared/core/trophies.js';
import {
  WIDTH, HEIGHT, go, modal, shadowTitle, setBackground, store, openHowTo, header, fit, tapZone, stars, toast, howToOpen,
} from './common.js';
import {
  loadGame, clearGame, campaign, cleared, isUnlocked, powersUnlocked, totalStars, saveGame,
} from '../save.js';
import { hpScale, hpLabel, resetSkill } from '../adaptive.js';
import { CAMPAIGN, dailyMap, DAILY_MODS, COLS, ROWS } from '../logic/maps.js';
import { newGame, deserialize, serialize } from '../logic/sim.js';
import { POWERS } from '../logic/data.js';
import { TROPHIES, GAME_ID } from '../logic/awards.js';
import { img, footFrame, vehFrame, TILE, tile } from '../frames.js';

const MINI = { '.': 0xd88038, '#': 0xf0d472, S: 0xd0453f, B: 0x5b8fd8, r: 0x6b3a35, o: 0x6c8c50, w: 0x2a8a8a };

export class Menu extends Phaser.Scene {
  constructor() { super('Menu'); }

  init(data) { this.view = data?.view || 'main'; this.brief = data?.brief || null; }

  create() {
    setBackground(this, PALETTE.night);
    window.__siegeMenu = this;
    window.__siegeData = { CAMPAIGN, dailyMap };
    if (this.view === 'campaign') this.campaignView();
    else if (this.view === 'trophies') this.trophyView();
    else this.mainView();
  }

  modalOpen() { return howToOpen() || this.children.list.some((c) => c.depth >= 100 && c.active); }

  // ---------------------------------------------------------------- main

  mainView() {
    this.diorama(72);
    shadowTitle(this, WIDTH / 2, 34, 'SAND SIEGE');
    button(this, WIDTH - 28, 34, 44, 40, '?', () => openHowTo(this), { size: 32, fill: PALETTE.gold });

    const saved = deserialize(loadGame());
    let y = 244;
    if (saved && !saved.over) {
      const where = saved.mode === 'daily' ? 'Daily Siege' : saved.name;
      const b = button(this, WIDTH / 2, y, 300, 46, `Continue: ${where}`, () => this.resume(saved), { fill: PALETTE.gold });
      fit(b.label, 270);
      const sub = saved.mode === 'endless' ? `Endless, wave ${saved.wave}` : `Wave ${saved.wave}/${saved.totalWaves}${saved.hard ? ', Hard' : ''}`;
      text(this, WIDTH / 2, y + 34, `${sub}, ${saved.lives} lives`, { color: PALETTE.lavender });
      y += 70;
    } else y += 16;
    const done = cleared();
    button(this, WIDTH / 2, y, 300, 46, `Campaign  ${done}/${CAMPAIGN.length}`, () => go(this, 'Menu', { view: 'campaign' }), { fill: saved && !saved.over ? PALETTE.lavender : PALETTE.gold });
    const today = playedDailyToday(GAME_ID);
    button(this, WIDTH / 2, y + 58, 300, 46, today ? 'Daily Siege  (played)' : 'Daily Siege  (new!)', () => this.dailyInfo(), { fill: PALETTE.lavender });
    const got = TROPHIES.filter((t) => hasTrophy(GAME_ID, t.id)).length;
    button(this, WIDTH / 2, y + 116, 300, 46, `Trophies  ${got}/${TROPHIES.length}`, () => go(this, 'Menu', { view: 'trophies' }), { fill: PALETTE.lavender });

    text(this, WIDTH / 2, 530, `Stars ${totalStars()}/${CAMPAIGN.length * 3}`, { color: PALETTE.gold });
    text(this, WIDTH / 2, 562, 'Art: Aleksandr Makarov', { color: PALETTE.lavender });
    button(this, 80, 614, 144, 40, '< All Games', () => { window.location.href = '../'; }, { fill: PALETTE.indigo, color: PALETTE.cream });
    this.lvlBtn = button(this, 210, 614, 104, 40, `HP ${hpLabel()}`, () => this.levelInfo(), { fill: PALETTE.indigo, color: PALETTE.cream });
    this.soundBtn = button(this, 312, 614, 80, 40, '', () => { setMuted(!isMuted()); this.syncSound(); });
    this.syncSound();
  }

  syncSound() {
    this.soundBtn.setLabel(isMuted() ? 'Muted' : 'Sound');
    this.soundBtn.body.setFillStyle(hex(isMuted() ? PALETTE.indigo : PALETTE.leaf));
    this.soundBtn.label.setColor(PALETTE.cream);
  }

  levelInfo() {
    modal(this, 'Enemy health', [
      `On Normal campaign maps, enemies have ${hpLabel()} of their standard health for you.`,
      'It creeps up when you win and eases off when you lose, between 88% and 112%. Nothing else changes.',
    ], [['OK', null], ['Reset to 100%', () => { resetSkill(); this.lvlBtn.setLabel(`HP ${hpLabel()}`); }]]);
  }

  diorama(top) {
    const h = 132;
    const rt = this.add.renderTexture(0, top, WIDTH / 2, h / 2).setOrigin(0).setScale(2);
    let seed = 7;
    const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
    for (let y = 0; y < h / 2; y += 8) {
      for (let x = 0; x < WIDTH / 2; x += 8) {
        const band = y >= 24 && y < 40;
        const t = band ? TILE.dunesFill[Math.floor(rnd() * 4)] : TILE.sand[Math.floor(rnd() * TILE.sand.length)];
        rt.drawFrame('atlas', tile(...t), x, y);
        if (!band && rnd() < 0.07) rt.drawFrame('atlas', tile(...TILE.sandDecal[0]), x, y);
      }
    }
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.ink)).fillRect(0, top - 4, WIDTH, 4).fillRect(0, top + h, WIDTH, 4);
    img(this, 330, top + 82, 'bl_b_0', 2);
    img(this, 70, top + 30, 'hinf_b_8', 2); img(this, 84, top + 38, 'hinf_b_8', 2);
    const cannon = img(this, 170, top + 108, vehFrame('tank', 'b', 'u'), 2);
    img(this, 250, top + 28, 'bs_b_4', 2);
    const walkers = [
      { o: img(this, -20, top + 66, footFrame('inf', 'r', 'walk', 0), 2), foot: 'inf', v: 22 },
      { o: img(this, -60, top + 70, footFrame('hinf', 'r', 'walk', 1), 2), foot: 'hinf', v: 22 },
      { o: img(this, -120, top + 66, vehFrame('tank', 'r', 'r'), 2), v: 14 },
      { o: img(this, -200, top + 30, vehFrame('drone', 'r', 'r'), 1), v: 30 },
    ];
    const tracer = this.add.graphics();
    let f = 0;
    this.time.addEvent({
      delay: 120, loop: true, callback: () => {
        f++;
        tracer.clear();
        for (const w of walkers) {
          w.o.x += w.v * 0.12;
          if (w.o.x > 300) w.o.x = -30 - Math.random() * 60;
          if (w.foot) w.o.setFrame(footFrame(w.foot, 'r', 'walk', f));
        }
        const tgt = walkers[f % 3].o;
        if (tgt.x > 20 && tgt.x < 280 && f % 3 === 0) {
          tracer.lineStyle(2, 0xfff3a0, 0.9).lineBetween(90, top + 34, tgt.x, tgt.y);
          cannon.setFrame(vehFrame('tank', 'b', tgt.x < 150 ? 'ul' : tgt.x > 190 ? 'ur' : 'u'));
        }
      },
    });
  }

  resume(saved) {
    store.start = { state: saved, fresh: false };
    sfx('select');
    go(this, 'Play');
  }

  // ---------------------------------------------------------------- daily

  dailyInfo() {
    const seed = dailySeed(GAME_ID);
    const def = dailyMap(seed);
    const p = profile();
    const d = p.daily?.[GAME_ID];
    const day = new Date();
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    const best = d?.best?.[key];
    const lines = [{ text: 'A new map and two twists every day. Hold 15 waves; score 100 a wave, +25 a life if you win.', color: PALETTE.cream }];
    for (const m of def.mods) {
      const mod = DAILY_MODS.find((x) => x.id === m);
      lines.push({ text: `${mod.name}: ${mod.desc}`, color: PALETTE.orange });
    }
    lines.push({ text: best != null ? `Today's best: ${best}   Streak: ${d.streak || 0}` : 'Not played yet today.', color: PALETTE.gold });
    const saved = deserialize(loadGame());
    if (saved && !saved.over) lines.push({ text: 'This replaces your game in progress.', color: PALETTE.orange });
    modal(this, 'Daily Siege', lines, [['Play', () => this.start(def, 'daily')], ['Back', null]], {
      row: true, extra: 98, content: (c, y) => c.add(this.miniMap(def.rows, WIDTH / 2 - 33, y + 4, 6)),
    });
  }

  miniMap(rows, x, y, cell) {
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.ink)).fillRect(x - 2, y - 2, COLS * cell + 4, ROWS * cell + 4);
    for (let yy = 0; yy < ROWS; yy++) {
      for (let xx = 0; xx < COLS; xx++) g.fillStyle(MINI[rows[yy][xx]] ?? 0xd88038).fillRect(x + xx * cell, y + yy * cell, cell, cell);
    }
    return g;
  }

  // ---------------------------------------------------------------- campaign

  campaignView() {
    header(this, 'Campaign', () => go(this, 'Menu'));
    const c = campaign();
    const tw = 108; const th = 104; const gap = 8;
    const left = Math.round((WIDTH - (tw * 3 + gap * 2)) / 2);
    CAMPAIGN.forEach((m, i) => {
      const x = left + (i % 3) * (tw + gap);
      const y = 52 + Math.floor(i / 3) * (th + gap);
      const locked = !isUnlocked(i);
      const st = c.stars[m.id] || 0;
      const cont = this.add.container(0, 0).setAlpha(locked ? 0.45 : 1);
      cont.add(panel(this, x, y, tw, th, { fill: PALETTE.night, inner: st ? PALETTE.leaf : locked ? PALETTE.indigo : PALETTE.gold }));
      cont.add(text(this, x + 12, y + 18, `${i + 1}`, { origin: [0, 0.5], color: PALETTE.gold }));
      if (m.kind === 'maze') cont.add(text(this, x + tw - 10, y + 18, 'Maze', { origin: [1, 0.5], color: PALETTE.lavender }));
      cont.add(text(this, x + tw / 2, y + 52, m.name, { color: locked ? PALETTE.lavender : PALETTE.cream, wrap: tw - 14 }));
      if (locked) cont.add(text(this, x + tw / 2, y + 86, 'Locked', { color: PALETTE.lavender }));
      else if (st) cont.add(stars(this, x + tw / 2, y + 86, st, 7, 18));
      else cont.add(text(this, x + tw / 2, y + 86, 'New', { color: PALETTE.gold }));
      if (c.hard[m.id] != null) cont.add(this.add.rectangle(x + tw - 12, y + th - 12, 10, 10, hex(PALETTE.red)).setStrokeStyle(2, hex(PALETTE.ink)));
      const z = this.add.zone(x, y, tw, th).setOrigin(0).setInteractive({ useHandCursor: true });
      tapZone(z, () => {
        if (this.modalOpen()) return;
        if (locked) { sfx('error'); toast(this, `Win map ${i} to unlock`, HEIGHT - 40); return; }
        sfx('tap');
        this.briefing(i);
      });
    });
    if (this.brief) {
      const i = CAMPAIGN.findIndex((x) => x.id === this.brief);
      if (i >= 0 && isUnlocked(i)) this.time.delayedCall(220, () => this.briefing(i));
    }
  }

  briefing(i) {
    const m = CAMPAIGN[i];
    const c = campaign();
    const won = !!c.stars[m.id];
    const saved = deserialize(loadGame());
    const lines = [m.brief, { text: `Tip: ${m.tip}`, color: PALETTE.gold }];
    lines.push({ text: `${m.waves} waves${m.bosses ? ', boss' : ''}. ${m.kind === 'maze' ? 'Maze map: your towers make the walls.' : ''}`, color: PALETTE.lavender });
    if (saved && !saved.over) lines.push({ text: 'Starting replaces your game in progress.', color: PALETTE.orange });
    const hardLabel = won ? `Hard${c.hard[m.id] != null ? ` (won, ${c.hard[m.id]} lives)` : ''}` : 'Hard (win first)';
    const endLabel = won ? `Endless${c.endless[m.id] ? ` (best ${c.endless[m.id]})` : ''}` : 'Endless (win first)';
    const md = modal(this, m.name, lines, [
      ['Play', () => this.start(m, 'campaign')],
      [hardLabel, () => this.start(m, 'campaign', true), won ? PALETTE.orange : PALETTE.indigo, won ? PALETTE.night : PALETTE.lavender],
      [endLabel, () => this.start(m, 'endless'), won ? PALETTE.lavender : PALETTE.indigo, won ? PALETTE.night : PALETTE.lavender],
      ['Back', null, PALETTE.cream],
    ], { extra: 96, content: (cc, y) => cc.add(this.miniMap(m.rows, WIDTH / 2 - 33, y + 2, 6)) });
    if (!won) {
      // The locked buttons stay visible but only explain themselves.
      const btns = md.list.filter((o) => o.setEnabled);
      for (const b of [btns[1], btns[2]]) {
        b.removeAllListeners('pointerup');
        b.on('pointerup', () => { b.face.y = 0; sfx('error'); toast(this, 'Win this map first', b.y - 34, PALETTE.gold, 900, 110); });
      }
    }
  }

  start(def, mode, hard = false) {
    clearGame();
    const normal = mode === 'campaign' && !hard;
    const state = newGame(def, { mode, hard, hpScale: normal ? hpScale() : 1, powers: powersUnlocked() });
    saveGame(serialize(state));
    store.start = { state, fresh: true };
    sfx('power');
    go(this, 'Play');
  }

  // ---------------------------------------------------------------- trophies

  trophyView() {
    header(this, 'Trophies', () => go(this, 'Menu'));
    const color = { bronze: PALETTE.orange, silver: '#b9b6c9', gold: PALETTE.gold };
    // Two columns of big tiles (each well over 40px tall, so easy to tap).
    const tw = 164; const th = 62; const gap = 8;
    const left = Math.round((WIDTH - (tw * 2 + gap)) / 2);
    TROPHIES.forEach((t, i) => {
      const x = left + (i % 2) * (tw + gap);
      const y = 52 + Math.floor(i / 2) * (th + 6);
      const got = hasTrophy(GAME_ID, t.id);
      const hidden = t.secret && !got;
      this.add.rectangle(x, y, tw, th, hex(got ? PALETTE.indigo : PALETTE.ink)).setOrigin(0).setAlpha(got ? 1 : 0.75)
        .setStrokeStyle(2, hex(got ? color[t.tier] : PALETTE.night));
      this.add.rectangle(x + 14, y + 18, 14, 14, hex(color[t.tier])).setStrokeStyle(2, hex(PALETTE.ink)).setAlpha(got ? 1 : 0.35);
      text(this, x + 28, y + 18, got ? 'Earned' : t.tier[0].toUpperCase() + t.tier.slice(1), { origin: [0, 0.5], color: got ? PALETTE.gold : PALETTE.lavender });
      const name = text(this, x + 8, y + 44, hidden ? 'Secret' : t.name, { origin: [0, 0.5], color: got ? PALETTE.cream : PALETTE.lavender });
      fit(name, tw - 14);
      const z = this.add.zone(x, y, tw, th).setOrigin(0).setInteractive();
      tapZone(z, () => {
        if (this.modalOpen()) return;
        sfx('tap');
        const tierName = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' }[t.tier];
        modal(this, hidden ? 'Secret trophy' : t.name, [
          hidden ? 'Keep playing to find out how to earn it.' : t.desc,
          { text: `${tierName}${got ? ', earned!' : ''}`, color: color[t.tier] },
        ], [['OK', null]]);
      });
    });
    text(this, WIDTH / 2, 52 + Math.ceil(TROPHIES.length / 2) * (th + 6) + 10, 'Tap a trophy to see how to get it.', { color: PALETTE.lavender });
  }
}

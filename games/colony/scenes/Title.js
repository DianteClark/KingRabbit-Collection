import Phaser from 'phaser';
import { PALETTE } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { showHowTo } from '../../../shared/core/howto.js';
import { sfx } from '../../../shared/core/sfx.js';
import { playedDailyToday, profile } from '../../../shared/core/trophies.js';
import { RULES } from '../rules.js';
import { store } from '../store.js';
import * as S from '../logic/sim.js';
import { DAILY_DAYS, TPD, SEASONS, DAYS_PER_SEASON } from '../logic/data.js';
import { startProgress, getSkill, skillLabel, todaySeed, todayKey, ID } from '../progress.js';
import { showNewGame, confirm, closeAll, blocking } from './panels.js';
import { playMusic } from '../music.js';

const runLabel = (raw) => {
  const day = Math.floor(raw.t / TPD) + 1;
  const cal = day - 1 + (raw.day0 || 0);
  const se = SEASONS[Math.floor(cal / DAYS_PER_SEASON) % 4].name;
  const pop = raw.mobs.filter((m) => m.kind === 'settler' && !m.dead).length;
  return `${raw.mode === 'peaceful' ? 'Peaceful' : 'Standard'}, day ${day} (${se}), ${pop} settler${pop === 1 ? '' : 's'}`;
};

export class Title extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    startProgress();
    this.busy = false;
    this.cameras.main.setBackgroundColor(PALETTE.night);
    this.scenery();
    text(this, WIDTH / 2, 40, 'Colony', { size: 32, color: PALETTE.gold });
    text(this, WIDTH / 2, 76, 'Three settlers, one wild valley.\nKeep them alive for two years.', { color: PALETTE.cream, wrap: 330 });

    const raw = store.get('run');
    const live = raw && !raw.result ? raw : null;
    let y = 300;
    if (live) {
      button(this, WIDTH / 2, y, 280, 48, 'Continue', () => this.continueRun(), { fill: PALETTE.gold });
      text(this, WIDTH / 2, y + 36, runLabel(live), { color: PALETTE.lavender });
      y += 76;
    }
    button(this, WIDTH / 2, y, 280, 48, 'New colony', () => this.newColony(), { fill: live ? PALETTE.lavender : PALETTE.gold });
    text(this, WIDTH / 2, y + 36, 'Standard or Peaceful', { color: PALETTE.lavender });
    y += 76;
    const d = store.get('daily');
    const dailyLive = d && d.day === todayKey() && d.run && !d.run.result;
    const done = playedDailyToday(ID);
    const best = profile().daily?.[ID]?.best?.[todayKey()];
    button(this, WIDTH / 2, y, 280, 48, dailyLive ? 'Continue daily' : 'Daily challenge', () => this.daily(), { fill: PALETTE.lavender });
    const sc = S.DAILY_SCENARIOS[todaySeed() % S.DAILY_SCENARIOS.length];
    text(this, WIDTH / 2, y + 36, done ? `${sc.name}. Today's best: ${best}` : `Today: ${sc.name}`, { color: PALETTE.lavender });
    y = Math.max(y + 88, 572);
    button(this, 100, y, 160, 44, 'How to play', () => { if (!blocking()) showHowTo(RULES); }, { fill: PALETTE.cream });
    button(this, 266, y, 140, 44, 'Games', () => { if (!blocking()) window.location.href = '../'; }, { fill: PALETTE.cream });
    text(this, WIDTH / 2, 622, 'Art: Aleksandr Makarov (MAS packs)', { color: PALETTE.lavender }).setAlpha(0.75);
    this.events.once('shutdown', () => closeAll());
    playMusic('calm');
    window.__title = this;
  }

  /** A little camp: grass, trees, a fire and settlers wandering. */
  scenery() {
    const y0 = 112; const rows = 6; const sc = 4; const ts = 8 * sc;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 12; c++) {
        const h = (r * 31 + c * 17) % 11;
        this.add.image(c * ts, y0 + r * ts * 0.75, 'co', `su:g${h < 6 ? 0 : h % 4}`).setOrigin(0).setScale(sc, sc * 0.75);
      }
    }
    for (const [x, f] of [[8, 'su:tree1'], [44, 'su:tree0'], [300, 'su:tree0'], [332, 'su:tree1'], [270, 'su:tree1']]) this.add.image(x, y0 + 10, 'co', f).setOrigin(0).setScale(sc);
    for (const [x, f] of [[20, 'su:tree0'], [318, 'su:bushB']]) this.add.image(x, y0 + 100, 'co', f).setOrigin(0).setScale(sc);
    this.add.image(WIDTH / 2, y0 + 92, 'co', 'campfire').setScale(sc);
    this.flame = this.add.image(WIDTH / 2, y0 + 84, 'co', 'fire0').setScale(sc);
    this.add.image(WIDTH / 2 - 60, y0 + 110, 'co', 'bed').setScale(sc);
    this.add.image(WIDTH / 2 + 60, y0 + 110, 'co', 'i:wood').setScale(sc);
    this.walkers = [3, 7, 10].map((look, k) => {
      const img = this.add.image(60 + k * 110, y0 + 60 + (k % 2) * 40, 'co', `c${look}:0`).setScale(sc);
      img.look = look; img.vx = k % 2 ? -0.35 : 0.35; img.t = k * 200;
      return img;
    });
    this.sheep = this.add.image(250, y0 + 124, 'co', 'a:sheep').setScale(sc);
    this.add.rectangle(0, y0 + rows * ts * 0.75, WIDTH, 4, 0x040303).setOrigin(0);
    this.add.rectangle(0, y0 - 4, WIDTH, 4, 0x040303).setOrigin(0);
  }

  update(time, ms) {
    this.flame?.setFrame(`fire${Math.floor(time / 180) % 2}`);
    for (const w of this.walkers || []) {
      w.t += ms;
      w.x += w.vx * ms * 0.06;
      if (w.x < 30 || w.x > WIDTH - 30) w.vx *= -1;
      w.setFlipX(w.vx < 0);
      w.setFrame(`c${w.look}:${Math.floor(w.t / 160) % 4}`);
    }
    if (this.sheep) this.sheep.y += Math.sin(time / 300) * 0.05;
  }

  continueRun() {
    if (this.busy || blocking()) return;
    let s = null;
    try { s = S.deserialize(store.get('run')); } catch (e) { console.warn('save unreadable', e); }
    if (!s) { store.set('run', null); this.scene.restart(); return; }
    this.go(s, 'run');
  }

  newColony() {
    if (this.busy || blocking()) return;
    const pick = () => showNewGame((mode) => {
      const s = S.newGame(mode, { skill: getSkill(mode) });
      if (store.get('guided')) s.tut = null;
      store.set('run', S.serialize(s));
      this.go(s, 'run');
    }, { standard: skillLabel('standard') });
    const old = store.get('run');
    if (old && !old.result) confirm({ title: 'Start over?', text: 'This replaces the colony you have now.', yes: 'New colony', onYes: pick, danger: true });
    else pick();
  }

  daily() {
    if (this.busy || blocking()) return;
    const d = store.get('daily');
    if (d && d.day === todayKey() && d.run && !d.run.result) {
      const s = S.deserialize(d.run);
      if (s) { this.go(s, 'daily'); return; }
    }
    const begin = () => {
      const s = S.newGame('daily', { seed: todaySeed() });
      s.tut = store.get('guided') ? null : 0;
      store.set('daily', { day: todayKey(), run: S.serialize(s) });
      this.go(s, 'daily');
    };
    if (d && d.day === todayKey() && d.run?.result) {
      confirm({ title: 'Try again?', text: `You already played today. Your best score counts; another go starts the same map from day 1.`, yes: 'Play again', onYes: begin });
    } else begin();
  }

  go(s, slot) {
    if (this.busy) return;
    this.busy = true;
    sfx('select');
    this.cameras.main.fadeOut(150, 28, 22, 24);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Play', { state: s, slot }));
  }
}

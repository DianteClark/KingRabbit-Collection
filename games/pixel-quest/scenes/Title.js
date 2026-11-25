import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { isMuted, setMuted, sfx } from '../../../shared/core/sfx.js';
import { dailySeed, playedDailyToday, profile, today } from '../../../shared/core/trophies.js';
import { WIDTH, go, modal, shadowTitle, setBackground, store, openHowTo, fmtTime, busyUi } from './common.js';
import { closeAll } from './panels.js';
import { readSave, latestSave, clearSaves, writeSave } from '../save.js';
import { newGame, chimesHeld } from '../logic/game.js';
import { CLASSES, PARTY_ORDER } from '../logic/data.js';
import { playMusic, syncVolume } from '../music.js';
import { GAME, checkTrophies } from '../trophies.js';

export class Title extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    closeAll();
    this.__leaving = false;
    setBackground(this, '#120f22');
    playMusic('title');
    window.__pq = { scene: this };

    // Night sky with twinkling stars, a dark sun and the four heroes on a hill.
    for (let i = 0; i < 46; i++) {
      const s = this.add.rectangle(Phaser.Math.Between(4, WIDTH - 4), Phaser.Math.Between(60, 300), 2, 2, 0xf9f5ef, Phaser.Math.FloatBetween(0.3, 1));
      this.tweens.add({ targets: s, alpha: 0.15, duration: Phaser.Math.Between(500, 1400), yoyo: true, repeat: -1, delay: Phaser.Math.Between(0, 1200) });
    }
    this.add.circle(WIDTH / 2, 292, 70, 0x47416b);
    this.add.circle(WIDTH / 2, 292, 62, 0x2e2a52);
    this.add.rectangle(0, 286, WIDTH, 60, hex('#2f4a2c')).setOrigin(0);
    for (let x = 0; x < WIDTH; x += 32) this.add.image(x, 278, 'atlas', 'grass').setOrigin(0).setScale(2);
    PARTY_ORDER.forEach((cls, i) => {
      const x = 72 + i * 72;
      const img = this.add.image(x, 258, 'atlas', `c${CLASSES[cls].ch}_6`).setScale(4);
      this.tweens.add({ targets: img, y: 254, duration: 380 + i * 40, yoyo: true, repeat: -1, ease: 'Stepped' });
    });
    this.add.image(WIDTH / 2, 196, 'atlas', 'bell').setScale(3).setAlpha(0.9);

    shadowTitle(this, WIDTH / 2, 66, 'PIXEL QUEST');
    text(this, WIDTH / 2, 104, 'Bring back the dawn', { color: PALETTE.lavender });
    button(this, WIDTH - 30, 30, 48, 40, '?', () => openHowTo(this), { size: 32, fill: PALETTE.gold });

    const saved = latestSave();
    let y = 360;
    if (saved?.party?.length) {
      const lv = Math.max(...saved.party.map((m) => m.lv));
      button(this, WIDTH / 2, y, 300, 52, `Continue  Lv ${lv}  ${fmtTime(saved.playMs || 0)}`, () => this.resume(saved), { fill: PALETTE.gold });
      y += 62;
      button(this, 92, y, 144, 46, 'New game', () => this.askNew(true), { fill: PALETTE.lavender });
      const both = readSave('auto') && readSave('slot');
      button(this, 268, y, 144, 46, 'Load', () => this.loadMenu(), { fill: PALETTE.lavender }).setEnabled(!!both);
    } else {
      button(this, WIDTH / 2, y, 300, 52, 'New game', () => this.askNew(false), { fill: PALETTE.gold });
    }
    y += 58;
    const best = profile().daily?.[GAME]?.best?.[today()];
    button(this, WIDTH / 2, y, 300, 46, playedDailyToday(GAME) ? `Daily Arena  (best ${best})` : 'Daily Arena  (new today!)', () => this.daily(), { fill: PALETTE.orange, color: PALETTE.night });
    if (saved?.flags?.vesper) text(this, WIDTH / 2, y + 40, 'You brought back the dawn!', { color: PALETTE.gold });

    text(this, WIDTH / 2, 574, 'Art by Aleksandr Makarov', { color: PALETTE.lavender });
    button(this, 92, 614, 168, 42, '< All Games', () => { if (!busyUi(this)) window.location.href = '../'; }, { fill: PALETTE.indigo, color: PALETTE.cream });
    this.soundBtn = button(this, 274, 614, 152, 42, '', () => { setMuted(!isMuted()); syncVolume(); this.syncSound(); });
    this.syncSound();
    if (saved) checkTrophies(saved);
  }

  syncSound() {
    this.soundBtn.setLabel(isMuted() ? 'Sound off' : 'Sound on');
    this.soundBtn.body.setFillStyle(hex(isMuted() ? PALETTE.indigo : PALETTE.leaf));
    this.soundBtn.label.setColor(PALETTE.cream);
  }

  askNew(hasSave) {
    if (busyUi(this)) return;
    const pick = () => modal(this, 'Difficulty', [
      'Story: gentler monsters and more gold. Great for enjoying the adventure.',
      'Normal: the full classic challenge.',
      { text: 'You can change it later in Options.', color: PALETTE.lavender },
    ], [
      ['Story', () => this.start('story'), PALETTE.leaf, PALETTE.cream],
      ['Normal', () => this.start('normal'), PALETTE.gold],
      ['Back', null, PALETTE.indigo, PALETTE.cream],
    ]);
    if (!hasSave) { pick(); return; }
    modal(this, 'New game?', ['Starting over replaces your saved journey.'], [['Start over', pick, PALETTE.red, PALETTE.cream], ['Back', null]]);
  }

  loadMenu() {
    if (busyUi(this)) return;
    const a = readSave('auto'); const s = readSave('slot');
    const label = (g, what) => `${what}: Lv ${Math.max(...g.party.map((m) => m.lv))}, ${chimesHeld(g)} chimes`;
    modal(this, 'Load', ['Pick a save to continue from.'], [
      [label(s, 'Saved'), () => this.resume(s)],
      [label(a, 'Auto'), () => this.resume(a), PALETTE.lavender],
      ['Back', null, PALETTE.indigo, PALETTE.cream],
    ]);
  }

  start(difficulty) {
    clearSaves();
    const st = newGame({ difficulty });
    if (difficulty === 'story') st.everStory = true;
    writeSave(st);
    store.state = st;
    sfx('power');
    go(this, 'World', { intro: true });
  }

  resume(saved) {
    if (busyUi(this)) return;
    store.state = saved;
    go(this, 'World', {});
  }

  daily() {
    if (busyUi(this)) return;
    const p = profile().daily?.[GAME];
    modal(this, 'Daily Arena', [
      'A ready-made party of four fights five waves of monsters. Wave 3 and wave 5 are bosses.',
      'Between waves, everyone gets back a quarter of their HP.',
      { text: `Today's best: ${p?.best?.[today()] ?? 'none yet'}  -  Streak: ${p?.streak || 0}`, color: PALETTE.sand },
    ], [
      ['Fight!', () => { store.daily = { seed: dailySeed(GAME) }; go(this, 'Battle', { daily: true }); }, PALETTE.orange],
      ['Back', null, PALETTE.indigo, PALETTE.cream],
    ]);
  }
}


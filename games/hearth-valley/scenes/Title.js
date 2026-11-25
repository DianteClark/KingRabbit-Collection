import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { isMuted, setMuted, sfx } from '../../../shared/core/sfx.js';
import { registerTrophies, recordPlay, registerDaily, profile, today } from '../../../shared/core/trophies.js';
import { WIDTH, go, modal, shadowTitle, setBackground, store, openHowTo, img, fmt, GAME_ID, fit } from './common.js';
import { loadGame, clearGame, saveGame } from '../save.js';
import { newGame, dateText } from '../logic/game.js';
import { TROPHIES, BUNDLES } from '../logic/data.js';
import { closeAll, usePanelScene } from './panels.js';
import { playMusic, musicOn, setMusicOn } from '../music.js';

let recorded = false;

export class Title extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    closeAll();
    usePanelScene(this);
    if (!recorded) {
      recorded = true;
      registerTrophies(GAME_ID, TROPHIES);
      registerDaily(GAME_ID, { title: 'Daily Derby', desc: '60 seconds of fishing, the same fish for everyone today' });
      recordPlay(GAME_ID);
    }
    setBackground(this, '#2f5a2c');
    // a little farm scene
    for (let y = 0; y < 640; y += 32) for (let x = 0; x < WIDTH; x += 32) this.add.image(x, y, 'hv', ((x * 7 + y * 3) % 11) ? 'grass0' : 'grassb0').setOrigin(0).setScale(2);
    for (let x = 0; x < WIDTH; x += 32) { this.add.image(x, 0, 'hv', 'forest0').setOrigin(0).setScale(2); this.add.image(x, 32, 'hv', 'forest0').setOrigin(0).setScale(2); }
    this.add.image(WIDTH / 2, 150, 'hv', 'house_red').setScale(2);
    const soil = [[86, 250], [118, 250], [150, 250], [210, 250], [242, 250], [274, 250]];
    soil.forEach(([x, y], i) => {
      img(this, x, y, i % 2 ? 'soilWet' : 'soil');
      img(this, x, y + 2, ['cropGrown', 'cropYoung', 'cropGrown', 'cropSprout', 'cropGrown', 'cropYoung'][i]);
      if (i % 2 === 0) img(this, x, y - 12, ['i_radish', 'i_cabbage', 'i_strawberry'][i / 2]);
    });
    const hen = img(this, 300, 210, 'chicken0');
    this.time.addEvent({ delay: 400, loop: true, callback: () => hen.setFrame(hen.frame.name === 'chicken0' ? 'chicken1' : 'chicken0') });
    const farmer = img(this, 180, 214, 'pIdleDown0');
    let f = 0;
    this.time.addEvent({ delay: 220, loop: true, callback: () => { f = (f + 1) % 4; farmer.setFrame(`pIdleDown${f}`); } });
    this.add.rectangle(0, 286, WIDTH, 354, hex(PALETTE.night), 0.92).setOrigin(0);
    this.add.rectangle(0, 286, WIDTH, 3, hex(PALETTE.ink)).setOrigin(0);
    this.add.rectangle(WIDTH / 2, 74, 300, 70, hex(PALETTE.night), 0.85).setStrokeStyle(3, hex(PALETTE.ink));
    shadowTitle(this, WIDTH / 2, 62, 'HEARTH VALLEY');
    text(this, WIDTH / 2, 94, 'Farm, fish and make friends', { color: PALETTE.cream });
    button(this, WIDTH - 26, 26, 44, 40, '?', () => openHowTo(this), { size: 32, fill: PALETTE.gold });

    const saved = loadGame();
    let y = 322;
    if (saved && saved.v) {
      const label = `Continue: Year ${saved.year}, ${dateText(saved)}`;
      const b = button(this, WIDTH / 2, y, 316, 50, label, () => this.resume(saved), { fill: PALETTE.gold });
      fit(b.label, 290);
      y += 40;
      text(this, WIDTH / 2, y, `${fmt(saved.gold)}g, town hall ${saved.hallRestored ? 'restored!' : `${saved.bundlesDone.length}/${BUNDLES.length} bundles`}`, { color: PALETTE.sand });
      y += 38;
      button(this, WIDTH / 2, y, 316, 44, 'New farm', () => modal(this, 'Start a new farm?', ['This replaces your saved farm, animals and friendships.'], [['Start over', () => this.start()], ['Back', null]]), { fill: PALETTE.lavender });
    } else {
      button(this, WIDTH / 2, y, 316, 54, 'Start a new farm', () => this.start(), { fill: PALETTE.gold });
      y += 40;
    }
    y += 58;
    const d = profile().daily?.[GAME_ID];
    const best = d?.best?.[today()];
    button(this, WIDTH / 2, y, 316, 46, best != null ? `Daily Derby (today: ${best} pts)` : 'Daily Derby: today\'s fishing contest', () => go(this, 'Fish', { mode: 'daily' }), { fill: '#5fa0d8' });
    y += 34;
    if (d?.streak) text(this, WIDTH / 2, y, `Streak: ${d.streak} day${d.streak === 1 ? '' : 's'}`, { color: PALETTE.lavender });

    text(this, WIDTH / 2, 566, 'Art by Aleksandr Makarov', { color: PALETTE.lavender });
    button(this, 82, 610, 148, 44, '< All Games', () => { window.location.href = '../'; }, { fill: PALETTE.indigo, color: PALETTE.cream });
    this.musicBtn = button(this, 210, 610, 92, 44, '', () => { setMusicOn(!musicOn()); this.syncSound(); });
    this.soundBtn = button(this, 308, 610, 88, 44, '', () => { setMuted(!isMuted()); this.syncSound(); });
    this.syncSound();
    playMusic('title');
    window.__hvTitle = this;
  }

  syncSound() {
    this.musicBtn.setLabel(musicOn() ? 'Music' : 'No music');
    this.musicBtn.body.setFillStyle(hex(musicOn() ? PALETTE.leaf : PALETTE.indigo));
    this.musicBtn.label.setColor(PALETTE.cream);
    fit(this.musicBtn.label, 82);
    this.soundBtn.setLabel(isMuted() ? 'Muted' : 'Sound');
    this.soundBtn.body.setFillStyle(hex(isMuted() ? PALETTE.indigo : PALETTE.leaf));
    this.soundBtn.label.setColor(PALETTE.cream);
  }

  start() {
    if (this.starting) return;
    this.starting = true;
    clearGame();
    const state = newGame();
    saveGame(state);
    store.state = state;
    sfx('power');
    go(this, 'World', { intro: true });
  }

  resume(saved) {
    if (this.starting) return;
    this.starting = true;
    store.state = saved;
    go(this, 'World', {});
  }
}

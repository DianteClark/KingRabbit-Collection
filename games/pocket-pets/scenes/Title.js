import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { isMuted, setMuted, sfx } from '../../../shared/core/sfx.js';
import { WIDTH, HEIGHT, go, modal, shadowTitle, setBackground, store, openHowTo, petImage, setPetFrame, LCD } from './common.js';
import { loadGame, clearGame, saveGame } from '../save.js';
import { skillLabel, resetSkill } from '../adaptive.js';
import { newGame, dexCounts } from '../logic/game.js';
import { SPECIES } from '../logic/data.js';
import { CASE, TYPE_CASE } from '../art.js';
import { closeAll } from './panels.js';

const SHOWCASE = ['blazquill', 'octorrent', 'bloomhorn', 'voltfox', 'granitroot', 'whiskar', 'bogtoad', 'mossmew', 'crestwing', 'voltopus'];

export class Title extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    closeAll();
    setBackground(this, PALETTE.night);
    shadowTitle(this, WIDTH / 2, 40, 'POCKET PETS');
    text(this, WIDTH / 2, 76, 'Catch, train and battle', { color: PALETTE.lavender });
    button(this, WIDTH - 26, 40, 40, 36, '?', () => openHowTo(this), { size: 32, fill: PALETTE.gold });

    // A handheld case with a pet living on its screen. Tap it to see another pet.
    this.showIdx = Math.floor(Math.random() * SHOWCASE.length);
    const cx = WIDTH / 2; const cy = 214;
    this.caseImg = this.add.image(cx, cy, 'cases', 'case0').setScale(2.5);
    const sx = cx + (39 - 40) * 2.5; const sy = cy + (39 - 40) * 2.5;
    this.add.rectangle(sx, sy, 39 * 2.5, 38 * 2.5, hex(LCD.light));
    this.add.tileSprite(sx, sy, 39, 38, 'screen', 'dots').setScale(2.5).setAlpha(0.35);
    this.pet = petImage(this, sx, sy + 4, SHOWCASE[this.showIdx], 4);
    this.petName = text(this, cx, cy + 128, '', { color: PALETTE.cream });
    this.showPet();
    let frame = 0;
    this.time.addEvent({ delay: 520, loop: true, callback: () => { frame = frame ? 0 : 2; setPetFrame(this.pet, SHOWCASE[this.showIdx], frame); } });
    this.tweens.add({ targets: this.pet, y: this.pet.y - 3, duration: 520, yoyo: true, repeat: -1, ease: 'Stepped' });
    const zone = this.add.zone(cx, cy, 200, 200).setInteractive({ useHandCursor: true });
    zone.on('pointerup', () => { sfx('select'); this.showIdx = (this.showIdx + 1) % SHOWCASE.length; this.showPet(); setPetFrame(this.pet, SHOWCASE[this.showIdx], 1); });

    const saved = loadGame();
    let y = 386;
    if (saved && saved.party?.length) {
      const c = dexCounts(saved);
      button(this, WIDTH / 2, y, 300, 52, `Continue  (${saved.badges.length} badge${saved.badges.length === 1 ? '' : 's'}, ${c.caught} caught)`, () => this.resume(saved), { fill: PALETTE.gold });
      y += 64;
      button(this, WIDTH / 2, y, 300, 44, 'New journey', () => modal(this, 'New journey?', ['This replaces your saved journey, pets and badges.'], [['Start over', () => this.start()], ['Back', null]]), { fill: PALETTE.lavender });
    } else {
      button(this, WIDTH / 2, y, 300, 52, 'Start your journey', () => this.start(), { fill: PALETTE.gold });
    }
    y += 60;
    if (saved?.champion) text(this, WIDTH / 2, y, 'Champion! Fill the PetDex to finish it all.', { color: PALETTE.gold });

    button(this, 92, 614, 168, 40, '< All Games', () => { window.location.href = '../'; }, { fill: PALETTE.indigo, color: PALETTE.cream });
    this.lvlBtn = button(this, 228, 614, 96, 40, `Foe Lv ${skillLabel()}`, () => this.levelInfo(), { fill: PALETTE.indigo, color: PALETTE.cream });
    this.soundBtn = button(this, 318, 614, 72, 40, '', () => { setMuted(!isMuted()); this.syncSound(); });
    this.syncSound();
    text(this, WIDTH / 2, 572, 'Art by Aleksandr Makarov', { color: PALETTE.lavender });
  }

  showPet() {
    const sp = SHOWCASE[this.showIdx];
    setPetFrame(this.pet, sp, 0);
    this.caseImg.setFrame(`case${CASE[TYPE_CASE[SPECIES[sp].type]]}`);
    this.petName.setText(SPECIES[sp].name);
  }

  syncSound() {
    this.soundBtn.setLabel(isMuted() ? 'Mute' : 'Sound');
    this.soundBtn.body.setFillStyle(hex(isMuted() ? PALETTE.indigo : PALETTE.leaf));
    this.soundBtn.label.setColor(PALETTE.cream);
  }

  levelInfo() {
    modal(this, 'Tamer Level', [
      `Computer tamers play at level ${skillLabel()} of 10.`,
      'It rises when you beat them and falls when you lose, so battles stay close. Only their decisions change, never their pets or levels.',
    ], [['OK', null], ['Reset to start', () => { resetSkill(); this.lvlBtn.setLabel(`Foe Lv ${skillLabel()}`); }]]);
  }

  start() {
    clearGame();
    const state = newGame();
    saveGame(state);
    store.state = state;
    sfx('power');
    go(this, 'World', { intro: true });
  }

  resume(saved) {
    store.state = saved;
    go(this, 'World', {});
  }
}

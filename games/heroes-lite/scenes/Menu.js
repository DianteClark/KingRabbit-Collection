import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { isMuted, setMuted, sfx } from '../../../shared/core/sfx.js';
import { WIDTH, go, modal, shadowTitle, setBackground, store, openHowTo } from './common.js';
import { save, loadGame, clearGame, getRecord, saveGame } from '../save.js';
import { skillLabel, resetSkill } from '../adaptive.js';
import { SCENARIOS } from '../logic/scenarios.js';
import { FACTIONS, CREATURES } from '../logic/data.js';
import { newGame } from '../logic/game.js';
import { sprite, townFrame, unitFrame, heroFrame, groundFrame } from '../frames.js';

export class Menu extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    this.leaving = false;
    setBackground(this, PALETTE.night);
    // Little diorama: grass, a town, a hero and some troops.
    for (let x = 0; x < WIDTH; x += 32) for (let y = 76; y < 188; y += 32) sprite(this, x + 16, y + 16, groundFrame('grass')).setAlpha(0.9);
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.night)).fillRect(0, 76, WIDTH, 4).fillRect(0, 184, WIDTH, 4);
    sprite(this, 108, 120, townFrame('castle', 3), 1.5);
    sprite(this, 264, 120, townFrame('necro', 2), 1.5);
    const hero = sprite(this, 180, 160, heroFrame('heroC', true), 2);
    this.tweens.addCounter({ from: 0, to: 3, duration: 600, repeat: -1, onUpdate: (tw) => {
      const i = Math.floor(tw.getValue()) % 4;
      hero.setTexture(...this.frameOf(heroFrame('heroC', true, i)));
    } });
    sprite(this, 36, 166, unitFrame(CREATURES.pikeman.sprite), 2);
    sprite(this, 60, 168, unitFrame(CREATURES.archer.sprite), 2);
    sprite(this, 324, 166, unitFrame(CREATURES.skeleton.sprite), 2).setFlipX(true);
    sprite(this, 300, 168, unitFrame(CREATURES.vampire.sprite), 2).setFlipX(true);
    shadowTitle(this, WIDTH / 2, 36, 'HEROES LITE');
    button(this, WIDTH - 26, 36, 40, 36, '?', () => openHowTo(this), { size: 32, fill: PALETTE.gold });

    const saved = loadGame();
    let y = 214;
    if (saved && !saved.over) {
      button(this, WIDTH / 2, y, 300, 44, `Continue: ${saved.name}, day ${saved.day}`, () => this.resume(saved), { fill: PALETTE.gold });
      y += 52;
    }
    this.faction = save.get('faction') || 'castle';
    this.facBtn = button(this, WIDTH / 2, y, 300, 40, '', () => {
      this.faction = this.faction === 'castle' ? 'necro' : 'castle';
      save.set('faction', this.faction);
      this.syncFaction();
      sfx('select');
    }, { fill: PALETTE.indigo, color: PALETTE.cream });
    this.syncFaction();
    y += 30;

    const cardH = saved && !saved.over ? 64 : 72;
    SCENARIOS.forEach((s, i) => this.card(WIDTH / 2, y + 8 + cardH / 2 + i * (cardH + 6), s, cardH, saved));

    button(this, 92, 614, 168, 40, '< All Games', () => { window.location.href = '../'; }, { fill: PALETTE.indigo, color: PALETTE.cream });
    this.lvlBtn = button(this, 228, 614, 96, 40, `Foe Lv ${skillLabel()}`, () => this.levelInfo(), { fill: PALETTE.indigo, color: PALETTE.cream });
    this.soundBtn = button(this, 318, 614, 72, 40, '', () => { setMuted(!isMuted()); this.syncSound(); });
    this.syncSound();
  }

  frameOf(ref) {
    const [key, x, y, w, h] = ref;
    const name = `${x}_${y}_${w}_${h}`;
    const tex = this.textures.get(key);
    if (!tex.has(name)) tex.add(name, 0, x, y, w, h);
    return [key, name];
  }

  syncFaction() { this.facBtn.setLabel(`Play as: ${FACTIONS[this.faction].name}  (tap to switch)`); }

  syncSound() {
    this.soundBtn.setLabel(isMuted() ? 'Mute' : 'Sound');
    this.soundBtn.body.setFillStyle(hex(isMuted() ? PALETTE.indigo : PALETTE.leaf));
    this.soundBtn.label.setColor(PALETTE.cream);
  }

  card(x, y, s, h, saved) {
    const w = 330;
    const c = this.add.container(0, 0);
    c.add(panel(this, x - w / 2, y - h / 2, w, h, { fill: PALETTE.night, inner: s.endless ? PALETTE.red : PALETTE.lavender }));
    c.add(text(this, x - w / 2 + 14, y - h / 2 + 18, s.name, { origin: [0, 0.5], color: PALETTE.gold }));
    const rec = getRecord(s.id);
    let right = s.endless ? `Best: ${(save.get('best') || {}).endless || 0} days` : `${s.size}`;
    if (!s.endless && rec.w) right = `Won ${rec.w}x`;
    c.add(text(this, x + w / 2 - 14, y - h / 2 + 18, right, { origin: [1, 0.5], color: rec.w ? PALETTE.leaf : PALETTE.lavender }));
    const stars = s.endless ? 'Survive the waves' : `${'*'.repeat(s.difficulty)} ${s.goal}`;
    c.add(text(this, x - w / 2 + 14, y + h / 2 - 20, stars, { origin: [0, 0.5], color: PALETTE.cream }));
    const zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerup', () => {
      sfx('tap');
      const lines = [s.desc];
      if (saved && !saved.over) lines.push({ text: 'This replaces your game in progress.', color: PALETTE.orange });
      modal(this, s.name, lines, [['Start', () => this.start(s)], ['Back', null]]);
    });
  }

  levelInfo() {
    modal(this, 'Enemy Level', [
      `The computer plays at level ${skillLabel()} of 10.`,
      'It rises when you win and falls when you lose, so games stay close. Only its decisions change, never its gold or troops.',
    ], [['OK', null], ['Reset to start', () => { resetSkill(); this.lvlBtn.setLabel(`Foe Lv ${skillLabel()}`); }]]);
  }

  start(s) {
    if (this.leaving) return;
    this.leaving = true;
    clearGame();
    const state = newGame(s, { faction: this.faction });
    saveGame(state);
    store.state = state;
    sfx('power');
    go(this, 'Adventure', { fresh: true });
  }

  resume(saved) {
    if (this.leaving) return;
    this.leaving = true;
    store.state = saved;
    go(this, 'Adventure', {});
  }
}

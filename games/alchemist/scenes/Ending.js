import Phaser from 'phaser';
import { PALETTE } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { sfx } from '../../../shared/core/sfx.js';
import { WIDTH, go, setBackground, store, persist, header, once } from './common.js';
import { anyOpen, closeAll } from './panels.js';
import * as G from '../logic/game.js';
import { RECIPE_ORDER } from '../logic/data.js';
import { newGame } from '../logic/game.js';
import { getSkill } from '../adaptive.js';
import { saveRun, noteBest } from '../save.js';
import { playMusic, jingle } from '../music.js';

export class Ending extends Phaser.Scene {
  constructor() { super('Ending'); }

  create() {
    closeAll();
    this.input.enabled = true;
    const s = store.s;
    if (!s || !s.result) { this.scene.start('Title'); return; }
    noteBest(s);
    const kind = s.result.kind;
    setBackground(this, kind === 'broke' ? '#1c1618' : '#2a2036');
    playMusic(kind === 'win' ? 'festival' : 'night');
    header(this, kind === 'broke' ? 'Closed' : 'The Festival', () => go(this, 'Title'));
    const title = { win: 'Champion!', second: 'Runner-up', broke: 'Shop closed' }[kind];
    text(this, WIDTH / 2, 96, title, { size: 32, color: kind === 'broke' ? '#ff9a8a' : PALETTE.gold });
    if (kind === 'win') {
      this.add.sprite(WIDTH / 2 - 40, 230, 'alchemist', '0_0').setOrigin(0.5, 1).setScale(5).play('alch-idle');
      const cup = this.add.image(WIDTH / 2 + 40, 196, 'potion_philosopher').setScale(5);
      this.tweens.add({ targets: cup, y: 186, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      jingle('fanfare');
      for (let i = 0; i < 24; i++) {
        const c = this.add.rectangle(Math.random() * WIDTH, -10 - Math.random() * 200, 4, 6, [0xe3d245, 0xa13d3b, 0x8a8fc4, 0x6c8c50][i % 4]);
        this.tweens.add({ targets: c, y: 660, x: c.x + (Math.random() * 60 - 30), duration: 2500 + Math.random() * 2000, repeat: -1, delay: Math.random() * 1500 });
      }
    } else if (kind === 'second') {
      this.add.sprite(WIDTH / 2 - 40, 230, 'alchemist', '0_0').setOrigin(0.5, 1).setScale(5).play('alch-idle');
      this.add.sprite(WIDTH / 2 + 50, 230, 'npcs', 12).setOrigin(0.5, 1).setScale(5).play('npc3');
    } else {
      this.add.image(WIDTH / 2, 248, 'labHouse').setOrigin(0.5, 1).setScale(1.25).setTint(0x8080a0);
      jingle('sad');
    }
    const story = {
      win: `Elder Rowan hands you the Golden Flask. "${s.festival?.total ?? s.result.you} points to Madame Vex's ${s.festival?.vexTotal ?? s.result.vex}! Hazel's shop has a worthy new alchemist."`,
      second: `Madame Vex wins with ${s.result.vex} points to your ${s.result.you}. "Not bad, darling. Not good enough." But the town loves your little shop.`,
      broke: `Three nights in debt, and the landlord has locked the door on day ${s.result.day}. Maybe a fresh start, and fairer prices, will do the trick.`,
    }[kind];
    text(this, WIDTH / 2, 262, story, { color: PALETTE.cream, wrap: 316 }).setOrigin(0.5, 0);
    const lines = [
      `Days open: ${s.day}`,
      `Potions sold: ${s.stats.sold}   Coins: ${s.coins}`,
      `Reputation: ${s.rep}   Recipes: ${RECIPE_ORDER.filter((id) => s.known[id]).length} of ${RECIPE_ORDER.length}`,
    ];
    text(this, WIDTH / 2, 404, lines.join('\n'), { color: PALETTE.lavender, wrap: 330 }).setOrigin(0.5, 0);
    if (kind === 'broke') {
      button(this, WIDTH / 2, 534, 280, 52, 'Try again', () => this.restart(), { fill: PALETTE.gold });
    } else {
      button(this, WIDTH / 2, 534, 280, 52, 'Keep the shop open', () => this.endless(), { fill: PALETTE.gold });
      text(this, WIDTH / 2, 572, 'Endless mode: no more story, just your shop.', { color: PALETTE.lavender });
    }
    button(this, WIDTH / 2, 610, 280, 44, 'Back to the title', () => go(this, 'Title'), { fill: PALETTE.cream });
  }

  endless() {
    if (anyOpen() || !once(this, 600)) return;
    const s = store.s;
    if (!G.goEndless(s)) return;
    s.skill = getSkill();
    persist();
    sfx('power');
    go(this, 'Shop', { from: 'night' });
  }

  restart() {
    if (anyOpen() || !once(this, 600)) return;
    const state = newGame();
    state.skill = getSkill();
    state.tut = { ...store.s.tut, intro: false };
    saveRun(state);
    store.s = state;
    sfx('power');
    go(this, 'Shop', { intro: true });
  }
}

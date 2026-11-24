import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { isMuted, setMuted, sfx } from '../../../shared/core/sfx.js';
import { WIDTH, HEIGHT, go, setBackground, store, openHowTo, once, closeAll } from './common.js';
import { showConfirm, showTip, anyOpen } from './panels.js';
import { loadRun, saveRun, save } from '../save.js';
import { skillLabel, resetSkill, getSkill } from '../adaptive.js';
import { newGame } from '../logic/game.js';
import { playMusic, musicOn, setMusicOn, syncVolume } from '../music.js';

export class Title extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    closeAll();
    this.input.enabled = true;
    setBackground(this, '#2a2036');
    playMusic('shop');
    // a night sky, the shop on a grassy hill
    const g = this.add.graphics();
    g.fillStyle(0x2a2036).fillRect(0, 0, WIDTH, 300);
    g.fillStyle(0x3a2e4a).fillRect(0, 200, WIDTH, 100);
    for (let i = 0; i < 40; i++) g.fillStyle(0xf9f5ef, Math.random() * 0.6 + 0.2).fillRect(Math.floor(Math.random() * WIDTH), Math.floor(Math.random() * 190) + 60, 2, 2);
    g.fillStyle(0x4c7a3a).fillRect(0, 300, WIDTH, 40);
    g.fillStyle(0x3a5c2c).fillRect(0, 316, WIDTH, HEIGHT - 316);
    this.add.image(WIDTH / 2, 312, 'labHouse').setOrigin(0.5, 1).setScale(2);
    // chimney smoke (the chimney is at the right of the building)
    this.add.sprite(WIDTH / 2 + 66, 112, 'smoke').play('smoke').setScale(2).setAlpha(0.8);
    this.add.sprite(WIDTH / 2 - 120, 300, 'alchemist', '0_0').setOrigin(0.5, 1).setScale(3).play('alch-idle');
    this.add.image(WIDTH / 2 + 120, 300, 'lab', 'barrel').setOrigin(0.5, 1).setScale(3);

    text(this, WIDTH / 2, 36, "Alchemist's", { size: 32, color: PALETTE.cream });
    text(this, WIDTH / 2, 74, 'Shop', { size: 32, color: PALETTE.gold });
    button(this, 30, 26, 48, 40, '<', () => { if (!anyOpen()) window.location.href = '../'; }, { size: 32, fill: PALETTE.cream });
    button(this, WIDTH - 30, 26, 48, 40, '?', () => openHowTo(this), { size: 32, fill: PALETTE.gold });

    const run = loadRun();
    let y = 352;
    if (run && run.phase !== 'over') {
      button(this, WIDTH / 2, y, 280, 52, `Continue (Day ${run.day})`, () => this.resume(run), { fill: PALETTE.gold });
      y += 62;
      button(this, WIDTH / 2, y, 280, 46, 'New shop', () => {
        if (anyOpen()) return;
        showConfirm('New shop?', 'This replaces your saved shop, coins and recipes.', 'Start over', () => this.start());
      });
      y += 56;
    } else {
      button(this, WIDTH / 2, y, 280, 52, run ? 'Open a new shop' : 'Open the shop', () => this.start(), { fill: PALETTE.gold });
      y += 62;
      if (run?.result) text(this, WIDTH / 2, y - 6, run.result.kind === 'broke' ? `Last shop closed on day ${run.result.day}.` : run.result.kind === 'win' ? 'Festival champion!' : 'Runner-up at the festival.', { color: PALETTE.lavender });
      y += 40;
    }
    const best = save.get('best') || {};
    if (best.days) text(this, WIDTH / 2, y + 4, `Best: ${best.days} days${best.wins ? `, ${best.wins} festival win${best.wins === 1 ? '' : 's'}` : ''}`, { color: PALETTE.lavender });

    this.soundBtn = button(this, 66, 560, 110, 44, '', () => { setMuted(!isMuted()); syncVolume(); this.syncSound(); });
    this.musicBtn = button(this, 180, 560, 106, 44, '', () => { setMusicOn(!musicOn()); this.syncSound(); });
    this.lvlBtn = button(this, 294, 560, 110, 44, `Picky ${skillLabel()}`, () => this.levelInfo(), { fill: PALETTE.indigo, color: PALETTE.cream });
    this.syncSound();
    text(this, WIDTH / 2, 614, 'Art by Aleksandr Makarov', { color: PALETTE.lavender });
  }

  syncSound() {
    for (const [b, on, label] of [[this.soundBtn, !isMuted(), 'Sound'], [this.musicBtn, musicOn(), 'Music']]) {
      b.setLabel(`${label} ${on ? 'on' : 'off'}`);
      b.body.setFillStyle(hex(on ? PALETTE.leaf : PALETTE.indigo));
      b.label.setColor(PALETTE.cream);
    }
  }

  levelInfo() {
    if (anyOpen()) return;
    showTip('Picky customers', `<p class="al-p">Customers are at pickiness level ${skillLabel()} of 10.</p>
      <p class="al-p">When most of your customers leave happy, they start asking for stronger potions, haggle harder, and Madame Vex brews better festival potions. When many leave unhappy, they ease off. Prices, rent and ingredients never change.</p>`, null, {
      btn: 'OK', extra: [{ label: 'Reset level', fn: () => { resetSkill(); this.lvlBtn.setLabel(`Picky ${skillLabel()}`); } }],
    });
  }

  start() {
    if (!once(this, 600)) return;
    const state = newGame();
    state.skill = getSkill();
    saveRun(state);
    store.s = state;
    sfx('power');
    go(this, 'Shop', { intro: true });
  }

  resume(run) {
    if (anyOpen() || !once(this, 600)) return;
    store.s = run;
    run.skill = getSkill();
    if (run.phase === 'festival') go(this, 'Festival');
    else go(this, 'Shop');
  }
}

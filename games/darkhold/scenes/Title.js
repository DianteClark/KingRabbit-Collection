import Phaser from 'phaser';
import { PALETTE, hex, text, button, WIDTH, HEIGHT, DARK, go, setBackground, modal, helpButton, creature, outlined } from './common.js';
import { isMuted, setMuted } from '../../../shared/core/sfx.js';
import { loadRun, getRecords, recordRun } from '../save.js';
import { CLASSES } from '../logic/data.js';
import { playMusic, musicOn, setMusicOn, syncVolume } from '../music.js';

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export class Title extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    setBackground(this, DARK.void);
    playMusic('title');
    // A pool of torchlight with the three heroes, and eyes in the dark around it.
    const glow = this.add.image(WIDTH / 2, 250, 'glow').setScale(5.5).setAlpha(0.9);
    this.tweens.add({ targets: glow, scale: 5.8, alpha: 1, duration: 260, yoyo: true, repeat: -1, ease: 'Stepped' });
    const g = this.add.graphics();
    g.fillStyle(hex(DARK.navy)).fillRect(0, 300, WIDTH, 10);
    for (let x = 0; x < WIDTH; x += 16) g.fillStyle(hex(x % 32 ? DARK.blue : DARK.navy)).fillRect(x, 300, 14, 6);
    const ids = Object.keys(CLASSES);
    ids.forEach((id, i) => {
      const s = creature(this, 110 + i * 70, 272, CLASSES[id].spr, 3);
      this.tweens.add({ targets: s, y: 270, duration: 500, yoyo: true, repeat: -1, ease: 'Stepped', delay: i * 170 });
    });
    for (const [x, y] of [[34, 210], [320, 180], [300, 330], [48, 340]]) {
      const eyes = this.add.graphics({ x, y });
      eyes.fillStyle(hex(DARK.sand)).fillRect(0, 0, 4, 2).fillRect(10, 0, 4, 2);
      eyes.setAlpha(0);
      this.tweens.add({ targets: eyes, alpha: 1, duration: 200, yoyo: true, hold: 1200, repeat: -1, repeatDelay: Phaser.Math.Between(1500, 4000), delay: Phaser.Math.Between(0, 2000) });
    }

    text(this, WIDTH / 2, 92 + 4, 'DARKHOLD', { size: 32, color: DARK.blood });
    text(this, WIDTH / 2, 92, 'DARKHOLD', { size: 32, color: PALETTE.gold });
    text(this, WIDTH / 2, 132, 'A dungeon crawl by torchlight', { color: DARK.rose });

    const run = loadRun();
    let y = 360;
    if (run) {
      const label = `Continue: ${CLASSES[run.cls].name}, floor ${run.depth}`;
      button(this, WIDTH / 2, y, 300, 46, label, () => go(this, 'Play', { run }), { fill: PALETTE.gold });
      y += 56;
    }
    button(this, WIDTH / 2, y, 300, 46, 'New Run', () => this.startNew(run, null), { fill: run ? PALETTE.lavender : PALETTE.gold });
    y += 56;
    button(this, WIDTH / 2, y, 300, 46, 'Daily Run', () => this.startNew(run, todayStr()), { fill: PALETTE.lavender });
    y += 56;
    button(this, WIDTH / 2, y, 300, 42, 'Records', () => this.showRecords(), { fill: PALETTE.indigo, color: PALETTE.cream });

    button(this, 66, 612, 120, 40, '< Games', () => { window.location.href = '../'; }, { fill: PALETTE.indigo, color: PALETTE.cream });
    this.soundBtn = button(this, 186, 612, 108, 40, '', () => { setMuted(!isMuted()); syncVolume(); this.syncToggles(); });
    this.musicBtn = button(this, 298, 612, 108, 40, '', () => { setMusicOn(!musicOn()); this.syncToggles(); });
    this.syncToggles();
    helpButton(this);
    text(this, WIDTH / 2, HEIGHT - 52, 'Art: Aleksandr Makarov', { color: DARK.blue });
  }

  syncToggles() {
    for (const [b, on, label] of [[this.soundBtn, !isMuted(), 'Sound'], [this.musicBtn, musicOn(), 'Music']]) {
      b.setLabel(`${label} ${on ? 'on' : 'off'}`);
      b.body.setFillStyle(hex(on ? PALETTE.leaf : PALETTE.indigo));
      b.label.setColor(PALETTE.cream);
    }
  }

  startNew(existing, daily) {
    if (!existing) { go(this, 'ClassSelect', { daily }); return; }
    const m = modal(this, 'Start a new run?', 'Your current run will end and count as a loss.', [
      ['Start new run', () => { m.destroy(); existing.over = 'dead'; existing.killedBy = 'giving up'; recordRun(existing); go(this, 'ClassSelect', { daily }); }, PALETTE.red, PALETTE.cream],
      ['Cancel', () => m.destroy()],
    ]);
  }

  showRecords() {
    const r = getRecords();
    const line = (name, m) => `${name}: ${m.runs} runs, ${m.wins} wins\n  deepest floor ${m.bestDepth}, best score ${m.bestScore}`;
    const lines = [
      line('Normal', r.normal),
      line('Lantern', r.lantern),
      line('Daily', r.daily),
      '',
      `Wins: Knight ${r.winsBy.knight}, Rogue ${r.winsBy.rogue}, Mage ${r.winsBy.mage}`,
    ];
    const t = todayStr();
    if (r.today && r.today.date === t) lines.push(`Today's daily: best ${r.today.bestScore}${r.today.won ? ' (won!)' : `, floor ${r.today.bestDepth}`}`);
    if (r.last) lines.push('', `Last run: ${CLASSES[r.last.cls]?.name ?? ''} ${r.last.won ? 'won!' : `fell on floor ${r.last.depth}`}`);
    const m = modal(this, 'Records', lines.join('\n'), [['Close', () => m.destroy(), PALETTE.lavender]], { width: 340 });
    void outlined;
  }
}

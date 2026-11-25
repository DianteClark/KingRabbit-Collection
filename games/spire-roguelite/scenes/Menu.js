import Phaser from 'phaser';
import { PALETTE, hex, text, button, WIDTH, go, route, setBackground, modal, icon, unit, helpButton, sfx } from './common.js';
import { isMuted, setMuted } from '../../../shared/core/sfx.js';
import { loadRun, getRecords, recordRun, saveRun } from '../save.js';
import { HEROES, newRun } from '../logic/run.js';
import { todaySeed, today } from '../trophies.js';

export class Menu extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    setBackground(this, PALETTE.night);
    // Night sky with a lonely spire.
    const g = this.add.graphics();
    g.fillStyle(hex('#241c2c')).fillRect(0, 140, WIDTH, 220);
    g.fillStyle(hex('#2f2638')).fillRect(0, 300, WIDTH, 60);
    for (let i = 0; i < 40; i++) {
      g.fillStyle(0xf9f5ef, Phaser.Math.FloatBetween(0.2, 0.7)).fillRect(Phaser.Math.Between(0, WIDTH), Phaser.Math.Between(4, 300), 2, 2);
    }
    this.add.image(WIDTH / 2, 236, 'b64', '1,1').setScale(3);
    text(this, WIDTH / 2, 64 + 4, 'SPIRE', { size: 32, color: PALETTE.red });
    text(this, WIDTH / 2, 64, 'SPIRE', { size: 32, color: PALETTE.gold });
    text(this, WIDTH / 2, 102 + 4, 'ROGUELITE', { size: 32, color: PALETTE.red });
    text(this, WIDTH / 2, 102, 'ROGUELITE', { size: 32, color: PALETTE.gold });

    Object.values(HEROES).forEach((h, i) => unit(this, 100 + i * 80, 352, h.sprite, 3));

    const run = loadRun();
    let y = 396;
    if (run) {
      const label = `Continue: ${HEROES[run.hero].name}${run.daily ? ' (Daily)' : run.mode === 'endless' ? ' (Endless)' : ''}, floor ${run.floor}`;
      button(this, WIDTH / 2, y, 300, 46, label, () => route(this, run), { fill: PALETTE.gold });
      y += 56;
    }
    button(this, WIDTH / 2, y, 300, 46, 'New Run', () => this.startNew('normal', run), { fill: run ? PALETTE.lavender : PALETTE.gold });
    y += 56;
    button(this, WIDTH / 2 - 77, y, 146, 46, 'Endless', () => this.startNew('endless', run), { fill: PALETTE.lavender });
    button(this, WIDTH / 2 + 77, y, 146, 46, 'Daily Climb', () => this.startNew('daily', run), { fill: PALETTE.lavender });
    y += 56;
    button(this, WIDTH / 2, y, 300, 40, 'Records', () => this.showRecords(), { fill: PALETTE.indigo, color: PALETTE.cream });

    button(this, 92, 612, 168, 40, '< All Games', () => { window.location.href = '../'; }, { fill: PALETTE.indigo, color: PALETTE.cream });
    this.soundBtn = button(this, 276, 612, 120, 40, '', () => { setMuted(!isMuted()); this.syncSound(); });
    this.syncSound();
    helpButton(this);
  }

  syncSound() {
    this.soundBtn.setLabel(isMuted() ? 'Sound off' : 'Sound on');
    this.soundBtn.body.setFillStyle(hex(isMuted() ? PALETTE.indigo : PALETTE.leaf));
    this.soundBtn.label.setColor(PALETTE.cream);
  }

  startNew(mode, existing) {
    const begin = () => (mode === 'daily' ? this.startDaily() : go(this, 'HeroSelect', { mode }));
    if (!existing) { begin(); return; }
    const m = modal(this, 'Start a new run?', 'Your current run will end and count as a loss.', [
      ['Start new run', () => { m.destroy(); recordRun(existing); begin(); }, PALETTE.red, PALETTE.cream],
      ['Cancel', () => m.destroy()],
    ]);
  }

  /** Daily Climb: today's seed picks the hero and builds the spire, the same for everyone. */
  startDaily() {
    const seed = todaySeed();
    const heroes = Object.keys(HEROES);
    const hero = heroes[seed % heroes.length];
    const m = modal(this, 'Daily Climb', `Today everyone climbs the same spire as the ${HEROES[hero].name}.\nOne Normal run; your best score today counts.`, [
      ['Begin', () => {
        m.destroy();
        sfx('power');
        const r = newRun({ hero, mode: 'normal', seed });
        r.daily = today();
        saveRun(r);
        route(this, r);
      }, PALETTE.gold],
      ['Cancel', () => m.destroy()],
    ]);
  }

  showRecords() {
    sfx('select');
    const r = getRecords();
    const wins = Object.entries(HEROES).map(([id, h]) => `${h.name}: ${r.wins[id] || 0}`).join('   ');
    const lines = [
      `Runs played: ${r.runs}`,
      `Wins - ${wins}`,
      '',
      `Normal best: floor ${r.bestFloor.normal}, score ${r.bestScore.normal}`,
      `Endless best: floor ${r.bestFloor.endless}, score ${r.bestScore.endless}`,
    ];
    if (r.last) lines.push('', `Last run: ${HEROES[r.last.hero]?.name ?? ''} ${r.last.won ? 'won' : 'fell'} on floor ${r.last.floor} (score ${r.last.score})`);
    const m = modal(this, 'Records', lines.join('\n'), [['Close', () => m.destroy(), PALETTE.lavender]], { width: 340 });
  }
}

export { icon };

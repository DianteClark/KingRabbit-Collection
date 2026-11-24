import Phaser from 'phaser';
import { PALETTE, hex, text, button, WIDTH, HEIGHT, go, setBackground, unit, sfx, showCards, relicRow } from './common.js';
import { HEROES } from '../logic/run.js';
import { ENEMIES } from '../logic/enemies.js';
import { recordRun, getRecords } from '../save.js';

export class RunEnd extends Phaser.Scene {
  constructor() { super('RunEnd'); }

  init(data) { this.run = data.run; }

  create() {
    const run = this.run;
    const won = run.screen === 'victory';
    setBackground(this, won ? '#1f2a1c' : '#2a1618');
    // Record once (the run is cleared from the save, so a reload goes to the menu).
    const res = recordRun(run);
    const rec = getRecords();
    const title = won ? 'VICTORY!' : run.abandoned ? 'Run abandoned' : 'DEFEATED';
    text(this, WIDTH / 2, 58 + 4, title, { size: 32, color: won ? PALETTE.leaf : PALETTE.wine });
    text(this, WIDTH / 2, 58, title, { size: 32, color: won ? PALETTE.gold : PALETTE.orange });
    const h = HEROES[run.hero];
    this.add.ellipse(WIDTH / 2, 166, 80, 14, hex(PALETTE.ink), 0.4);
    const hero = unit(this, WIDTH / 2, 168, h.sprite, 5);
    if (!won) { hero.anims.stop(); hero.setFrame(`${hero.animBase.split(':')[1]}:18`); }
    if (won) this.time.addEvent({ delay: 900, loop: true, callback: () => this.tweens.add({ targets: hero, y: 150, duration: 150, yoyo: true }) });
    if (won) sfx('win');

    const s = res.summary;
    const lines = [
      `${h.name} - ${run.mode === 'endless' ? 'Endless' : 'Normal'} mode`,
      won ? 'You conquered the Spire!' : `Fell on floor ${run.floor} (Act ${run.act}${run.loop ? `, loop ${run.loop + 1}` : ''})`,
      '',
      `Floors climbed: ${run.stats.floors}`,
      `Enemies defeated: ${run.stats.kills}`,
      `Elites: ${run.stats.elites}   Bosses: ${run.stats.bosses}`,
      `Gold earned: ${run.stats.gold}`,
      `Deck: ${run.deck.length} cards   Relics: ${run.relics.length}`,
    ];
    text(this, WIDTH / 2, 196, lines.join('\n'), { color: PALETTE.cream }).setOrigin(0.5, 0);
    text(this, WIDTH / 2, 400, `Score ${s.score}`, { size: 32, color: PALETTE.gold });
    const best = rec.bestScore[run.mode];
    text(this, WIDTH / 2, 434, res.newBestScore ? 'New best score!' : `Best ${best}`, { color: res.newBestScore ? '#9be36b' : PALETTE.lavender });
    relicRow(this, run, 24, 470, { scale: 2, gap: 34 });

    button(this, WIDTH / 2, 540, 280, 44, 'View final deck', () => showCards(this, run.deck, 'Final deck'), { fill: PALETTE.lavender });
    button(this, WIDTH / 2, 596, 280, 46, 'Main menu', () => go(this, 'Menu'), { fill: PALETTE.gold });
    void ENEMIES;
  }
}

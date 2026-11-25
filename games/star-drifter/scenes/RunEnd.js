import { PALETTE, hex, text, button, WIDTH, HEIGHT, go, setBackground, helpButton, sfx, Phaser, outlined } from './common.js';
import { recordRun } from '../save.js';
import { SHIPS } from '../logic/data.js';
import * as P from './panels.js';
import { earn, stat, daily } from '../trophies.js';

export class RunEnd extends Phaser.Scene {
  constructor() { super('RunEnd'); }

  init(data) { this.run = data.run; }

  create() {
    const run = this.run;
    const won = run.screen === 'victory';
    setBackground(this, won ? '#14201a' : '#1c1014');
    P.closeAll();
    // Record once (the scene can be re-entered from a save that already ended).
    const fresh = !run.recorded;
    const res = run.recorded ? run.recorded : recordRun(run);
    run.recorded = res;
    if (fresh) this.trophies(run, res.summary, won);
    const s = res.summary;
    const g = this.add.graphics();
    for (let i = 0; i < 80; i++) g.fillStyle(0xf9f5ef, Phaser.Math.FloatBetween(0.1, 0.6)).fillRect(Phaser.Math.Between(0, WIDTH), Phaser.Math.Between(0, HEIGHT), 1, 1);
    outlined(this, WIDTH / 2, 80, won ? 'VICTORY!' : 'SHIP LOST', { size: 32, color: won ? PALETTE.gold : PALETTE.red });
    const story = won
      ? `The Iron Verdict burns. The ${run.ship.name} drifts free, and the Hegemony fleet scatters without its flagship.`
      : `${run.deathCause || 'Your ship was destroyed.'} The ${run.ship.name} made it to sector ${run.sector}.`;
    text(this, WIDTH / 2, 150, story, { wrap: 320, color: PALETTE.cream });
    const lines = [
      `Mode: ${run.daily ? 'Daily Run' : run.mode === 'cruise' ? 'Cruise' : 'Normal'}`,
      `Sector reached: ${s.sector}`,
      `Ships defeated: ${s.wins}`,
      `Jumps: ${s.jumps}`,
      `Scrap collected: ${s.scrap}`,
      `Crew lost: ${s.crewLost}`,
      '',
      `Score: ${s.score}${res.newBest ? '  (new best!)' : ''}`,
    ];
    text(this, WIDTH / 2, 320, lines.join('\n'), { color: PALETTE.sand });
    if (res.unlocked) {
      text(this, WIDTH / 2, 448, `New ship unlocked: the ${SHIPS[res.unlocked].name}!`, { color: PALETTE.gold, wrap: 320 });
    }
    sfx(won ? 'win' : 'lose');
    button(this, WIDTH / 2, 520, 260, 50, 'Main menu', () => go(this, 'Menu'), { fill: PALETTE.gold });
    button(this, WIDTH / 2, 584, 260, 44, '< All Games', () => { window.location.href = '../'; }, { fill: PALETTE.indigo, color: PALETTE.cream });
    helpButton(this);
    void hex;
  }

  trophies(run, s, won) {
    stat('runs');
    stat('jumps', s.jumps);
    if (won) {
      earn('victory');
      if (run.mode === 'normal') earn('normal-win');
      if (run.shipId === 'corvid') earn('corvid-win');
      if (!s.crewLost) earn('all-hands');
    }
    if (run.daily) { earn('daily'); daily(s.score, run.daily); }
  }
}

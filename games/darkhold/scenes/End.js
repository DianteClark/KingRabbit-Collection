import Phaser from 'phaser';
import { PALETTE, hex, text, button, WIDTH, DARK, go, setBackground, helpButton, backButton, creature } from './common.js';
import { CLASSES } from '../logic/data.js';
import { playMusic } from '../music.js';
import { todayStr } from './Title.js';

/** Death recap or victory screen. The run was already recorded by the Play scene. */
export class End extends Phaser.Scene {
  constructor() { super('End'); }

  init(data) { this.run = data.run; this.result = data.result; }

  create() {
    const st = this.run;
    const won = st.over === 'won';
    setBackground(this, won ? '#1d1a10' : '#140a0e');
    playMusic(won ? 'title' : null);
    backButton(this, () => go(this, 'Title'));
    helpButton(this);
    const title = won ? 'VICTORY!' : st.abandoned ? 'RUN ABANDONED' : 'YOU DIED';
    text(this, WIDTH / 2, 82 + 4, title, { size: 32, color: won ? DARK.flame : '#4e1a20' });
    text(this, WIDTH / 2, 82, title, { size: 32, color: won ? PALETTE.gold : PALETTE.red });

    const glow = this.add.image(WIDTH / 2, 168, 'glow').setScale(won ? 3 : 1.6).setAlpha(won ? 1 : 0.4);
    if (won) this.tweens.add({ targets: glow, scale: 3.3, duration: 300, yoyo: true, repeat: -1, ease: 'Stepped' });
    const hero = creature(this, WIDTH / 2, 166, CLASSES[st.cls].spr, 4);
    if (!won) hero.setAngle(90).setTint(0x7a6a8a);
    else this.tweens.add({ targets: hero, y: 152, duration: 180, yoyo: true, repeat: -1, repeatDelay: 700 });

    const mode = st.daily ? `Daily run ${st.daily}` : st.mode === 'lantern' ? 'Lantern mode' : 'Normal mode';
    const where = st.depth >= 11 ? 'in the great hall' : `on floor ${st.depth}`;
    const cause = won ? 'You defeated the Hollow King!' : st.abandoned ? `You gave up ${where}.` : `Slain by ${st.killedBy} ${where}.`;
    const lines = [
      `${CLASSES[st.cls].name}, ${mode}`,
      cause,
      '',
      `Level ${st.p.lvl}   Kills ${st.stats.kills}   Turns ${st.turn}`,
      `Gold ${st.p.gold}   Secrets found ${st.stats.secrets}`,
      `Potions drunk ${st.stats.potions}   Scrolls read ${st.stats.scrolls}`,
    ];
    text(this, WIDTH / 2, 214, lines.join('\n'), { color: PALETTE.cream, wrap: WIDTH - 30 }).setOrigin(0.5, 0);

    const r = this.result;
    text(this, WIDTH / 2, 392, `Score ${r.score}`, { size: 32, color: PALETTE.gold });
    const modeRec = r.records[st.daily ? 'daily' : st.mode];
    const best = st.daily
      ? (r.newDaily ? 'Your best daily score today!' : `Today's best: ${r.records.today?.bestScore ?? r.score}`)
      : (r.newBest ? 'New best score!' : `Best: ${modeRec.bestScore}`);
    text(this, WIDTH / 2, 426, best, { color: r.newBest || r.newDaily ? '#9be36b' : PALETTE.lavender });

    // The last few things that happened.
    const last = st.log.slice(-3).map((l) => l.text).join('\n');
    const lt = text(this, WIDTH / 2, 452, last, { color: DARK.purple, wrap: WIDTH - 30 }).setOrigin(0.5, 0);
    const lineCount = () => lt.getWrappedText().length;
    if (lineCount() > 3) lt.setText(st.log.slice(-2).map((l) => l.text).join('\n'));
    if (lineCount() > 3) lt.setText(st.log[st.log.length - 1]?.text || '');

    button(this, WIDTH / 2, 556, 280, 46, st.daily ? 'Try the daily again' : 'New run', () => go(this, 'ClassSelect', { daily: st.daily ? todayStr() : null }), { fill: PALETTE.gold });
    button(this, WIDTH / 2, 610, 280, 42, 'Title screen', () => go(this, 'Title'), { fill: PALETTE.lavender });
    void hex;
  }
}

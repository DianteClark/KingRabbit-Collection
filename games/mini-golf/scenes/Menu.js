import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { isMuted, setMuted, sfx } from '../../../shared/core/sfx.js';
import { dailySeed, profile, today } from '../../../shared/core/trophies.js';
import { WIDTH, go, shadowTitle, setBackground, openHowTo, fit, header } from './common.js';
import { HOLES, COURSES, dailyHole, holeById } from '../logic/holes.js';
import { save, totalStars, GAME_ID } from '../save.js';
import { startPlay } from './flow.js';

export class Menu extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    setBackground(this, '#2f4527');
    window.__golfMenu = this;
    header(this, '', () => { window.location.href = '../'; });
    shadowTitle(this, WIDTH / 2, 30, 'MINI GOLF');
    text(this, WIDTH / 2, 66, 'Calm putting, one thumb', { color: PALETTE.sand });
    this.diorama(92);

    const round = save.get('round');
    const items = [];
    if (round && holeById(round.holes?.[round.hi])) {
      items.push([describe(round), () => go(this, 'Play', { resume: true }), PALETTE.gold]);
    }
    items.push(['Play courses', () => go(this, 'Courses', {}), round ? PALETTE.lavender : PALETTE.gold]);
    items.push(['Pass & play', () => go(this, 'Party', {}), PALETTE.lavender]);
    const daily = dailyHole(dailySeed(GAME_ID));
    const best = this.dailyBest();
    items.push([best != null ? `Daily hole  (best ${best})` : 'Daily hole  (new today)', () => startPlay(this, { mode: 'daily', holes: [daily.id] }), PALETTE.sand]);
    items.push(['How to play', () => openHowTo(this), PALETTE.indigo, PALETTE.cream]);
    const top = items.length === 5 ? 282 : 300;
    items.forEach(([label, fn, fill, color], i) => {
      const b = button(this, WIDTH / 2, top + i * 54, 290, 46, label, () => { sfx('select'); fn(); }, { fill, color: color || PALETTE.night, silent: true });
      fit(b.label, 266);
    });

    const done = HOLES.filter((h) => save.get('best')[h.id] != null).length;
    text(this, WIDTH / 2, 548, `Holes ${done}/${HOLES.length}    Stars ${totalStars()}/${HOLES.length * 3}`, { color: PALETTE.cream });
    text(this, WIDTH / 2, 572, 'Art: Aleksandr Makarov', { color: PALETTE.lavender });
    button(this, 96, 612, 168, 44, '< All Games', () => { window.location.href = '../'; }, { fill: PALETTE.indigo, color: PALETTE.cream });
    this.soundBtn = button(this, 270, 612, 140, 44, '', () => { setMuted(!isMuted()); this.syncSound(); sfx('tap'); }, { silent: true });
    this.syncSound();
  }

  dailyBest() {
    try { return profile().daily[GAME_ID]?.best?.[today()] ?? null; } catch { return null; }
  }

  syncSound() {
    this.soundBtn.setLabel(isMuted() ? 'Sound off' : 'Sound on');
    this.soundBtn.body.setFillStyle(hex(isMuted() ? PALETTE.indigo : PALETTE.leaf));
    this.soundBtn.label.setColor(PALETTE.cream);
  }

  /** A tiny green: a ball rolls up, curls round and drops into the cup, over and over. */
  diorama(top) {
    const g = this.add.graphics();
    const x0 = 30; const w = WIDTH - 60; const h = 150;
    g.fillStyle(hex(PALETTE.ink)).fillRect(x0 - 8, top - 8, w + 16, h + 16);
    g.fillStyle(hex(PALETTE.orange)).fillRect(x0 - 6, top - 6, w + 12, h + 12);
    g.fillStyle(hex(PALETTE.leaf)).fillRect(x0, top, w, h);
    for (let k = 0; k < h; k += 20) g.fillStyle(0x5f7d46).fillRect(x0, top + k, w, 10);
    g.fillStyle(hex(PALETTE.sand)).fillEllipse(x0 + 70, top + 100, 70, 34);
    g.fillStyle(0x3d5a8c).fillEllipse(x0 + 220, top + 110, 60, 30);
    g.fillStyle(0xa13d3b).fillCircle(x0 + 150, top + 80, 9).fillStyle(0xf9f5ef).fillCircle(x0 + 150, top + 80, 4);
    const cup = { x: x0 + w - 50, y: top + 40 };
    g.fillStyle(hex(PALETTE.ink)).fillCircle(cup.x, cup.y, 7);
    this.add.image(cup.x, cup.y - 15, 'pole');
    const flag = this.add.triangle(cup.x + 1, cup.y - 30, 0, 0, 16, 5, 0, 10, hex(PALETTE.red)).setOrigin(0, 0);
    this.tweens.add({ targets: flag, scaleX: 0.75, yoyo: true, repeat: -1, duration: 500 });
    for (const [tx, ty, f] of [[x0 - 4, top + 150, 'tree0'], [x0 + w + 4, top + 150, 'tree1'], [x0 + w + 4, top + 4, 'tree2'], [x0 - 4, top + 6, 'tree4']]) {
      this.add.image(tx, ty - 6, 'trees', f).setScale(2);
    }
    const ball = this.add.image(x0 + 30, top + 130, 'ball0');
    const path = new Phaser.Curves.Spline([x0 + 30, top + 130, x0 + 120, top + 120, x0 + 200, top + 60, x0 + w - 20, top + 70, cup.x, cup.y]);
    const state = { t: 0 };
    const roll = () => {
      state.t = 0; ball.setScale(1).setAlpha(1);
      this.tweens.add({
        targets: state, t: 1, duration: 2600, ease: 'Quad.easeOut',
        onUpdate: () => { const p = path.getPoint(state.t); ball.setPosition(p.x, p.y); },
        onComplete: () => { this.tweens.add({ targets: ball, scale: 0.3, alpha: 0, duration: 200, onComplete: () => this.time.delayedCall(900, roll) }); },
      });
    };
    roll();
  }
}

function describe(round) {
  if (round.mode === 'daily') return 'Continue daily hole';
  if (round.mode === 'practice') return `Continue hole ${round.holes[round.hi]}`;
  const c = COURSES[round.course]?.name || '';
  const who = round.mode === 'party' ? `${round.players.length}P ` : '';
  return `Continue ${who}${c} ${round.hi + 1}/${round.holes.length}`;
}

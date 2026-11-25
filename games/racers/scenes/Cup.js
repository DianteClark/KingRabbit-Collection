import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { sfx } from '../../../shared/core/sfx.js';
import { header, go, setBackground, card, modal, WIDTH } from './common.js';
import { save } from '../save.js';
import { CUPS, trackById } from '../logic/tracks.js';
import { MODELS } from '../logic/car.js';
import { newCup, cupOver, nextTrack, table, cupUnlocked, finishCup, ordinal, carUnlocked } from '../logic/cup.js';
import { award } from '../trophies.js';

const MOOD = { day: 'Sunny', night: 'Night', rain: 'Rain' };

/** Choose a cup, see the standings between races, and the final table. */
export class Cup extends Phaser.Scene {
  constructor() { super('Cup'); }

  create() {
    setBackground(this, PALETTE.night);
    const cup = save.get('cup');
    if (!cup) this.choose();
    else if (cupOver(cup)) this.final(cup);
    else this.standings(cup);
  }

  choose() {
    header(this, 'Cups', () => go(this, 'Title'));
    const prog = save.get('progress');
    CUPS.forEach((c, i) => {
      const x = 113 + i * 207; const y = 200;
      const open = cupUnlocked(prog, i);
      const best = (prog.cups || [])[i];
      const k = card(this, x, y, 196, 262, () => {
        if (!open) {
          modal(this, 'Locked', [`Finish the ${CUPS[i - 1].name}`, 'in the top three first.'], [['OK', null]]);
          return;
        }
        save.set('cup', newCup(i));
        go(this, 'RaceScene', { mode: 'cup', trackId: c.tracks[0] });
      }, { fill: open ? PALETTE.indigo : '#2b2342' });
      k.add(text(this, 0, -106, c.name, { color: PALETTE.gold }));
      c.tracks.forEach((id, j) => {
        const tr = trackById(id);
        k.add(text(this, 0, -70 + j * 36, tr.name, { color: open ? PALETTE.cream : PALETTE.lavender }));
        k.add(text(this, 0, -52 + j * 36, MOOD[tr.mood] + (tr.reverse ? ' (reverse)' : ''), { color: PALETTE.lavender }));
      });
      const prize = MODELS.find((m) => m.unlock === c.id);
      let line = open ? (best ? `Best: ${ordinal(best)}` : 'Not finished yet') : 'Locked';
      if (best === 1) line = 'Champion!';
      k.add(text(this, 0, 82, line, { color: best === 1 ? PALETTE.gold : PALETTE.cream }));
      k.add(text(this, 0, 106, `Win: ${prize.name}`, { color: carUnlocked(prog, prize.id) ? PALETTE.leaf : PALETTE.lavender }));
    });
  }

  standings(cup) {
    header(this, CUPS[cup.cup].name, () => go(this, 'Title'));
    this.table(cup, 'Standings');
    const tr = trackById(nextTrack(cup));
    panel(this, 352, 58, 272, 290);
    text(this, 488, 86, `Race ${cup.race + 1} of 4`, { color: PALETTE.lavender });
    text(this, 488, 118, tr.name, { size: 32, color: PALETTE.gold });
    text(this, 488, 150, MOOD[tr.mood] + (tr.reverse ? ', reversed' : ''), { color: PALETTE.cream });
    text(this, 488, 182, 'Points: 10 8 6 5 4 3', { color: PALETTE.lavender });
    button(this, 488, 240, 220, 50, cup.race === 0 ? 'Start' : 'Next race', () => go(this, 'RaceScene', { mode: 'cup', trackId: tr.id }), { fill: PALETTE.gold, size: 32 });
    button(this, 488, 306, 220, 42, 'Give up cup', () => {
      modal(this, 'Give up?', ['Your points in this cup', 'will be lost.'], [
        ['Give up', () => { save.set('cup', null); this.scene.restart(); }],
        ['Keep racing', null],
      ]);
    }, { fill: PALETTE.lavender });
  }

  table(cup, title) {
    panel(this, 16, 58, 326, 290);
    text(this, 179, 82, title, { color: PALETTE.gold });
    const rows = table(cup);
    rows.forEach((r, i) => {
      const y = 116 + i * 36;
      const me = r.name === 'You';
      if (me) this.add.rectangle(179, y, 304, 30, hex(PALETTE.gold), 0.25);
      text(this, 44, y, ordinal(r.place), { color: me ? PALETTE.gold : PALETTE.lavender, origin: [0, 0.5] });
      text(this, 100, y, r.name, { color: me ? PALETTE.gold : PALETTE.cream, origin: [0, 0.5] });
      text(this, 316, y, `${r.points}`, { color: me ? PALETTE.gold : PALETTE.cream, origin: [1, 0.5] });
    });
  }

  final(cup) {
    const rows = table(cup);
    const place = rows.find((r) => r.name === 'You').place;
    header(this, CUPS[cup.cup].name, () => this.done());
    this.table(cup, 'Final table');
    panel(this, 352, 58, 272, 290);
    // Record the result once (the cup stays saved until you tap Done, so a reload shows it again).
    let res = null;
    if (!cup.recorded) {
      res = finishCup(save.get('progress'), cup.cup, place);
      save.set('progress', res.progress);
      save.set('cup', { ...cup, recorded: true, newCar: res.newCar?.id || null, newCup: res.newCup?.id || null });
      if (place === 1) {
        award(['cup-sunny', 'cup-moon', 'cup-champ'][cup.cup]);
        if (cup.history.every((o) => o[0] === 'You')) award('sweep');
        if (MODELS.every((m) => carUnlocked(res.progress, m.id))) award('garage');
      }
      sfx(place <= 3 ? 'win' : 'lose');
    }
    const c = save.get('cup');
    const title = place === 1 ? 'Champion!' : `${ordinal(place)} place`;
    text(this, 488, 92, title, { size: 32, color: place <= 3 ? PALETTE.gold : PALETTE.cream });
    const lines = [];
    const W = PALETTE.cream; const G = PALETTE.gold;
    if (place === 1) lines.push(['You won the cup!', W]);
    else if (place <= 3) lines.push(['On the podium!', W]);
    else if (cup.cup < 2) lines.push(['Top three opens the', W], ['next cup. Try again!', W]);
    else lines.push(['So close. Try again!', W]);
    const newCar = MODELS.find((m) => m.id === c.newCar);
    const nextCup = CUPS.find((x) => x.id === c.newCup);
    if (newCar) lines.push(['New car in the garage:', W], [newCar.name, G]);
    if (nextCup) lines.push(['Now open:', W], [nextCup.name, G]);
    lines.forEach(([l, col], i) => text(this, 488, 136 + i * 24, l, { color: col }));
    if (place === 1) this.confetti();
    button(this, 488, 306, 220, 46, 'Done', () => this.done(), { fill: PALETTE.gold, size: 32 });
  }

  done() {
    if (this.leaving) return;
    if (save.get('cup')?.recorded) save.set('cup', null);
    go(this, 'Cup');
  }

  confetti() {
    const cols = [PALETTE.gold, PALETTE.red, PALETTE.lavender, PALETTE.leaf, PALETTE.cream];
    for (let i = 0; i < 40; i++) {
      const r = this.add.rectangle(Math.random() * WIDTH, -10 - Math.random() * 200, 4, 4, hex(cols[i % cols.length])).setDepth(40);
      this.tweens.add({ targets: r, y: 380, x: r.x + (Math.random() - 0.5) * 80, duration: 2000 + Math.random() * 1500, repeat: -1 });
    }
  }
}

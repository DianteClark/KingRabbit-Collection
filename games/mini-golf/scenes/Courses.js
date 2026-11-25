import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { sfx } from '../../../shared/core/sfx.js';
import { WIDTH, header, go, setBackground, fit, tapZone, starRow, toast } from './common.js';
import { COURSES, holesOf, coursePar } from '../logic/holes.js';
import { courseUnlocked, holeUnlocked, starsOf, bestFor, courseStars, roundBest, save } from '../save.js';
import { startPlay } from './flow.js';

/** Course select: a tab per course, a "Play round" button and the nine holes for practice. */
export class Courses extends Phaser.Scene {
  constructor() { super('Courses'); }

  init(data) {
    let c = data?.course;
    if (c == null) {
      const r = save.get('round');
      c = 0;
      for (let i = COURSES.length - 1; i >= 0; i--) if (courseUnlocked(i)) { c = i; break; }
      if (r && r.course >= 0 && courseUnlocked(r.course)) c = r.course;
    }
    this.course = c;
  }

  create() {
    setBackground(this, '#2f4527');
    window.__golfCourses = this;
    header(this, 'Courses', () => go(this, 'Menu'));
    this.page = this.add.container(0, 0);
    this.tabs = COURSES.map((c, i) => {
      const open = courseUnlocked(i);
      const b = button(this, 66 + i * 114, 80, 104, 44, open ? `${i + 1}. ${c.name.split(' ')[0]}` : '', () => this.show(i), { fill: PALETTE.lavender });
      fit(b.label, 92);
      if (!open) b.face.add(this.add.image(0, 0, 'lock').setTint(hex(PALETTE.indigo)));
      return b;
    });
    this.show(this.course);
  }

  show(ci) {
    this.course = ci;
    this.page.removeAll(true);
    this.tabs.forEach((b, i) => b.body.setFillStyle(hex(i === ci ? PALETTE.gold : courseUnlocked(i) ? PALETTE.lavender : PALETTE.indigo)));
    const c = COURSES[ci];
    const open = courseUnlocked(ci);
    this.page.add(fit(text(this, WIDTH / 2, 128, c.name, { size: 32, color: PALETTE.gold }), WIDTH - 20));
    if (!open) {
      this.page.add(this.add.image(WIDTH / 2, 260, 'lock').setScale(3).setTint(hex(PALETTE.lavender)));
      this.page.add(text(this, WIDTH / 2, 330, `Hole every hole of ${COURSES[ci - 1].name}\nto open ${c.name}.`, { color: PALETTE.cream, wrap: 300 }));
      this.page.add(text(this, WIDTH / 2, 380, c.blurb, { color: PALETTE.lavender }));
      return;
    }
    const holes = holesOf(ci);
    this.page.add(fit(text(this, WIDTH / 2, 160, `${c.blurb}   Stars ${courseStars(ci)}/${holes.length * 3}`, { color: PALETTE.lavender }), WIDTH - 20));
    const play = button(this, WIDTH / 2, 204, 300, 48, 'Play 9-hole round', () => { sfx('select'); startPlay(this, { mode: 'round', course: ci }); }, { fill: PALETTE.gold, silent: true });
    this.page.add(play);
    holes.forEach((h, k) => this.page.add(this.card(h, 64 + (k % 3) * 116, 288 + Math.floor(k / 3) * 104)));
    const best = roundBest(ci);
    this.page.add(text(this, WIDTH / 2, 600, best == null ? `Par ${coursePar(ci)}.  Tap a hole to practise it.` : `Best round ${best}  (par ${coursePar(ci)})`, { color: PALETTE.cream }));
  }

  card(h, x, y) {
    const c = this.add.container(x, y);
    const open = holeUnlocked(h);
    const best = bestFor(h.id);
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.ink)).fillRect(-54, -46 + 4, 108, 92);
    g.fillStyle(hex(best != null ? PALETTE.leaf : open ? PALETTE.lavender : PALETTE.indigo)).fillRect(-54, -48, 108, 92);
    g.fillStyle(hex(PALETTE.night)).fillRect(-51, -45, 102, 86);
    c.add(g);
    c.add(text(this, 0, -32, `Hole ${h.index + 1}`, { color: open ? PALETTE.gold : PALETTE.lavender }));
    if (open) {
      c.add(fit(text(this, 0, -12, h.name, { color: PALETTE.cream }), 96));
      c.add(starRow(this, 0, 10, starsOf(h), { scale: 0.75, gap: 28 }));
      c.add(fit(text(this, 0, 30, best == null ? `Par ${h.par}` : `Par ${h.par} Best ${best}`, { color: PALETTE.lavender }), 96));
    } else c.add(this.add.image(0, 8, 'lock').setTint(0x8a8fc4));
    c.setSize(108, 92);
    c.setInteractive({ useHandCursor: open });
    tapZone(c, () => {
      if (!open) { sfx('error'); toast(this, 'Hole the hole before it to practise this one.', 560); return; }
      sfx('select');
      startPlay(this, { mode: 'practice', course: h.course, holes: [h.id] });
    });
    return c;
  }
}

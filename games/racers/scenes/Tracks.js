import Phaser from 'phaser';
import { PALETTE } from '../../../shared/core/palette.js';
import { text } from '../../../shared/core/ui.js';
import { header, go, setBackground, card, modal } from './common.js';
import { save } from '../save.js';
import { TRACKS, CUPS } from '../logic/tracks.js';
import { trackUnlocked, fmtTime, ordinal } from '../logic/cup.js';

const MOOD = { day: 'Sunny', night: 'Night', rain: 'Rain' };
const FILL = { day: PALETTE.indigo, night: '#2b2342', rain: '#34466a' };

/** Pick a track for Quick Race or Time Trial. */
export class Tracks extends Phaser.Scene {
  constructor() { super('Tracks'); }

  init(data) { this.mode = data.mode || 'quick'; }

  create() {
    setBackground(this, PALETTE.night);
    header(this, this.mode === 'tt' ? 'Time Trial' : 'Quick Race', () => go(this, 'Title'));
    const prog = save.get('progress');
    const best = save.get('best') || {};
    TRACKS.forEach((tr, i) => {
      const x = 86 + (i % 4) * 156; const y = 104 + Math.floor(i / 4) * 92;
      const open = trackUnlocked(prog, tr.id);
      const c = card(this, x, y, 148, 84, () => {
        if (!open) {
          const need = CUPS[tr.cup - 1];
          modal(this, 'Locked', [`Finish the ${need.name}`, 'in the top three to race here.'], [['OK', null]]);
          return;
        }
        go(this, 'RaceScene', { mode: this.mode, trackId: tr.id });
      }, { fill: FILL[tr.mood] });
      c.add(text(this, 0, -22, tr.name, { color: open ? PALETTE.cream : PALETTE.lavender }));
      c.add(text(this, 0, 0, `${MOOD[tr.mood]}${tr.reverse ? ' (reverse)' : ''}`, { color: PALETTE.lavender }));
      const b = best[tr.id] || {};
      let third;
      if (!open) third = 'Locked';
      else if (this.mode === 'tt') third = b.ttLap != null ? `Lap ${fmtTime(b.ttLap)}` : 'No time yet';
      else third = b.place ? `Best: ${ordinal(b.place)}` : 'Not raced yet';
      c.add(text(this, 0, 22, third, { color: open ? PALETTE.gold : PALETTE.lavender }));
    });
  }
}

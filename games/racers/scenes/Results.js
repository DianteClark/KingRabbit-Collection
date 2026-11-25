import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { header, go, setBackground } from './common.js';
import { trackById } from '../logic/tracks.js';
import { fmtTime, ordinal, POINTS } from '../logic/cup.js';
import { modelById } from '../logic/car.js';

/** After a race: the finishing order (or your lap times when racing alone) and what next. */
export class Results extends Phaser.Scene {
  constructor() { super('Results'); }

  init(data) { this.r = data || {}; }

  create() {
    setBackground(this, PALETTE.night);
    const r = this.r;
    const solo = r.mode === 'tt' || r.mode === 'daily';
    const home = r.mode === 'cup' ? 'Cup' : 'Title';
    header(this, r.mode === 'daily' ? 'Daily result' : solo ? 'Time Trial' : 'Results', () => go(this, home));
    panel(this, 16, 58, 360, 290);
    text(this, 196, 80, trackById(r.trackId).name, { color: PALETTE.gold });
    if (solo) this.laps(r); else this.order(r);

    // right column
    panel(this, 388, 58, 236, 290);
    const x = 506;
    if (!solo) {
      const big = r.place === 1 ? 'You win!' : `${ordinal(r.place)} place`;
      text(this, x, 92, big, { size: 32, color: r.place <= 3 ? PALETTE.gold : PALETTE.cream });
      text(this, x, 124, r.mode === 'cup' ? `+${POINTS[r.place - 1]} points` : r.place === 1 ? 'Fastest in town!' : r.place <= 3 ? 'On the podium' : 'Keep at it!', { color: PALETTE.lavender });
    } else {
      text(this, x, 92, fmtTime(r.total), { size: 32, color: PALETTE.gold });
      let line = r.newBestLap ? 'New best lap!' : `Best lap ${fmtTime(r.prevBestLap)}`;
      if (r.mode === 'daily' && r.daily) line = r.daily.isBest ? "Today's best!" : `Today's best ${fmtTime(r.daily.best)}`;
      text(this, x, 124, line, { color: r.newBestLap || r.daily?.isBest ? PALETTE.leaf : PALETTE.lavender });
      if (r.mode === 'daily' && r.daily) text(this, x, 148, `Streak: ${r.daily.streak} day${r.daily.streak === 1 ? '' : 's'}`, { color: PALETTE.lavender });
    }
    const btns = [];
    if (r.mode === 'cup') btns.push(['Continue', () => go(this, 'Cup'), PALETTE.gold]);
    else {
      btns.push([solo ? 'Try again' : 'Race again', () => go(this, 'RaceScene', { mode: r.mode, trackId: r.trackId }), PALETTE.gold]);
      if (r.mode !== 'daily') btns.push(['Tracks', () => go(this, 'Tracks', { mode: r.mode }), PALETTE.lavender]);
      btns.push(['Menu', () => go(this, 'Title'), PALETTE.lavender]);
    }
    btns.forEach(([label, fn, fill], i) => button(this, x, 196 + i * 52, 200, 44, label, fn, { fill }));
  }

  order(r) {
    const rows = r.rows || [];
    const win = rows[0]?.time ?? 0;
    rows.forEach((row, i) => {
      const y = 112 + i * 36;
      const me = row.human;
      if (me) this.add.rectangle(196, y, 336, 30, hex(PALETTE.gold), 0.25);
      const c = me ? PALETTE.gold : PALETTE.cream;
      text(this, 40, y, ordinal(row.place), { color: me ? PALETTE.gold : PALETTE.lavender, origin: [0, 0.5] });
      text(this, 96, y, row.name, { color: c, origin: [0, 0.5] });
      const t = i === 0 ? fmtTime(row.time) : `+${(row.time - win).toFixed(2)}`;
      text(this, 356, y, t, { color: c, origin: [1, 0.5] });
    });
  }

  laps(r) {
    (r.laps || []).forEach((t, i) => {
      const y = 116 + i * 34;
      const best = t === r.bestLap;
      text(this, 48, y, `Lap ${i + 1}`, { color: PALETTE.lavender, origin: [0, 0.5] });
      text(this, 340, y, fmtTime(t), { color: best ? PALETTE.leaf : PALETTE.cream, origin: [1, 0.5] });
    });
    const y = 116 + (r.laps || []).length * 34 + 10;
    this.add.rectangle(196, y - 12, 300, 2, hex(PALETTE.lavender));
    text(this, 48, y + 8, 'Total', { color: PALETTE.gold, origin: [0, 0.5] });
    text(this, 340, y + 8, fmtTime(r.total), { color: PALETTE.gold, origin: [1, 0.5] });
    const line = r.mode === 'tt' ? 'Your best lap comes back as a ghost.' : `Today's car: ${modelById(r.model).name}`;
    text(this, 196, y + 52, line, { color: PALETTE.lavender });
  }
}

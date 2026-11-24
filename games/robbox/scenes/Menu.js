import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { isMuted, setMuted, sfx } from '../../../shared/core/sfx.js';
import { WIDTH, go, shadowTitle, setBackground, openHowTo, fit } from './common.js';
import { sprite, setRef, robotRef, ART, convRef } from '../frames.js';
import { LEVELS } from '../logic/levels.js';
import { totalStars, nextLevelIndex, isSolved } from '../save.js';

export class Menu extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    setBackground(this, PALETTE.night);
    window.__robboxMenu = this;
    shadowTitle(this, WIDTH / 2, 44, 'ROBBOX');
    text(this, WIDTH / 2, 82, 'Program the robot. Light the lab.', { color: PALETTE.lavender });
    button(this, WIDTH - 30, 30, 48, 40, '?', () => openHowTo(this), { size: 32, fill: PALETTE.gold });
    this.diorama(118);

    const i = nextLevelIndex();
    const lv = LEVELS[i];
    const started = LEVELS.some((l) => isSolved(l));
    const allDone = LEVELS.every((l) => isSolved(l));
    const label = allDone ? 'Play again' : started ? `Continue  ${lv.id} ${lv.name}` : 'Start';
    const play = button(this, WIDTH / 2, 330, 300, 52, label, () => { sfx('select'); go(this, 'Play', { index: allDone ? 0 : i }); }, { fill: PALETTE.gold });
    fit(play.label, 270);
    button(this, WIDTH / 2, 396, 300, 48, 'Levels', () => go(this, 'Levels', { world: lv.world }), { fill: PALETTE.lavender });

    const stars = totalStars();
    const solved = LEVELS.filter((l) => isSolved(l)).length;
    text(this, WIDTH / 2, 448, `Solved ${solved} of ${LEVELS.length}    Stars ${stars} of ${LEVELS.length * 3}`, { color: PALETTE.cream });

    text(this, WIDTH / 2, 560, 'Art: Aleksandr Makarov', { color: PALETTE.lavender });
    button(this, 96, 608, 168, 44, '< All Games', () => { window.location.href = '../'; }, { fill: PALETTE.indigo, color: PALETTE.cream });
    this.soundBtn = button(this, 270, 608, 140, 44, '', () => { setMuted(!isMuted()); this.syncSound(); sfx('tap'); });
    this.syncSound();
  }

  syncSound() {
    this.soundBtn.setLabel(isMuted() ? 'Sound off' : 'Sound on');
    this.soundBtn.body.setFillStyle(hex(isMuted() ? PALETTE.indigo : PALETTE.leaf));
    this.soundBtn.label.setColor(PALETTE.cream);
  }

  /** A little lab strip: the robot walks along, lighting lamps. */
  diorama(top) {
    const cols = 9; const C = 32; const ox = WIDTH / 2 - (cols * C) / 2;
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.ink)).fillRect(0, top, WIDTH, 2).fillRect(0, top + 156, WIDTH, 2);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < cols; c++) {
        const x = ox + c * C + C / 2; const y = top + 30 + r * C + C / 2;
        g.fillStyle(0x2b2540).fillRect(x - 15, y - 15 + 28, 30, 6);
        let ref = ART.floor;
        if (r === 1 && c === 3) ref = ART.floorBlue;
        if (r === 0 && c === 6) ref = ART.floorOrange;
        if (r === 2) ref = convRef(1, 0);
        const img = sprite(this, x, y, ref);
        if (r === 2) this.belt = [...(this.belt || []), img];
      }
    }
    this.lamps = [2, 5, 8].map((c) => sprite(this, ox + c * C + C / 2, top + 30 + C + C / 2, ART.lamp).setTint(0x55556a));
    this.crate = sprite(this, ox + 7 * C + C / 2, top + 30 + C / 2, ART.crate);
    const bot = sprite(this, ox + C / 2, top + 30 + C + C / 2 - 6, robotRef(1));
    let k = 0; let x = 0;
    this.time.addEvent({
      delay: 140, loop: true, callback: () => {
        k++;
        this.belt.forEach((b) => setRef(this, b, convRef(1, k)));
        setRef(this, bot, robotRef(1, 'walk', k));
        x += 4;
        if (x > cols * C) { x = 0; this.lamps.forEach((l) => l.setTint(0x55556a)); }
        bot.x = ox + C / 2 + x;
        const col = Math.floor((bot.x - ox) / C);
        this.lamps.forEach((l, li) => { if (col === [2, 5, 8][li] && l.tintTopLeft !== 0xffffff) l.clearTint(); });
      },
    });
  }
}

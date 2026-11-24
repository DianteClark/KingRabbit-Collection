import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { sfx } from '../../../shared/core/sfx.js';
import { header, go, setBackground, kitChip, modal } from './common.js';
import { save } from '../save.js';
import { PLAYER_TEAM, teamById } from '../logic/teams.js';
import { newCup, opponentOf, ROUND_NAMES } from '../logic/cup.js';
import { matchData } from '../flow.js';

/** Cup run: the bracket, last round's results and the next tie. */
export class Cup extends Phaser.Scene {
  constructor() { super('Cup'); }

  create() {
    setBackground(this, PALETTE.night);
    header(this, 'Cup', () => go(this, 'Menu'));
    const cup = save.get('cup');
    if (!cup) { this.intro(); return; }
    this.bracket(cup);
    if (cup.champion === PLAYER_TEAM.id) {
      text(this, WIDTH / 2, 500, 'CHAMPIONS!', { size: 32, color: PALETTE.gold });
      text(this, WIDTH / 2, 526, `Cups won: ${save.get('cupsWon') || 0}`, { color: PALETTE.cream });
      button(this, WIDTH / 2, 584, 240, 52, 'New cup', () => this.start(), { fill: PALETTE.gold });
      sfx('win');
    } else if (!cup.alive) {
      text(this, WIDTH / 2, 500, `Out in the ${ROUND_NAMES[cup.round]}`, { color: PALETTE.orange });
      text(this, WIDTH / 2, 526, 'Your cup run is over', { color: PALETTE.cream });
      button(this, WIDTH / 2, 584, 240, 52, 'New cup', () => this.start(), { fill: PALETTE.gold });
    } else {
      const opp = teamById(opponentOf(cup));
      text(this, WIDTH / 2, 498, `${ROUND_NAMES[cup.round]}: you vs ${opp.name}`, { color: PALETTE.cream });
      button(this, WIDTH / 2, 546, 260, 52, `Play ${ROUND_NAMES[cup.round]}`, () => go(this, 'MatchScene', matchData('cup', opp.id)), { fill: PALETTE.gold });
      button(this, WIDTH / 2, 608, 200, 36, 'Abandon run', () => {
        const m = modal(this, 'Abandon?', ['Start the cup again', 'from the quarter-finals?'], [
          ['Yes, new cup', () => { m.destroy(); this.start(); }],
          ['Keep playing', () => m.destroy()],
        ]);
      }, { fill: PALETTE.indigo, color: PALETTE.cream });
    }
  }

  intro() {
    panel(this, 20, 90, 320, 250);
    const lines = ['Eight teams, one trophy.', '', 'Quarter-final, semi-final', 'and final. Draws go to', 'a penalty shoot-out.', '', 'Lose once and the run', 'is over.'];
    lines.forEach((l, i) => text(this, WIDTH / 2, 120 + i * 26, l, { color: PALETTE.cream }));
    text(this, WIDTH / 2, 380, `Cups won: ${save.get('cupsWon') || 0}`, { color: PALETTE.gold });
    button(this, WIDTH / 2, 460, 240, 60, 'Start cup', () => this.start(), { size: 32, fill: PALETTE.gold });
  }

  start() {
    save.set('cup', newCup(Date.now() & 0x7fffffff));
    save.set('cupRuns', (save.get('cupRuns') || 0) + 1);
    this.scene.restart();
  }

  /** Each round as a column of ties; your team highlighted, losers dimmed. */
  bracket(cup) {
    const colX = [62, 180, 298];
    const top = 86;
    const rowsH = 368;
    ['QF', 'SF', 'Final'].forEach((n, r) => text(this, colX[r], top, n, { color: r === cup.round && cup.alive && !cup.champion ? PALETTE.gold : PALETTE.lavender }));
    for (let r = 0; r < 3; r++) {
      const list = cup.rounds[r];
      if (!list) {
        // Slots still to be decided
        const n = 8 >> r;
        for (let i = 0; i < n; i++) {
          const y = top + 30 + (rowsH / n) * (i + 0.5);
          this.add.rectangle(colX[r], y, 108, 24, hex(PALETTE.ink)).setAlpha(0.6);
          text(this, colX[r], y, '?', { color: PALETTE.indigo });
        }
        continue;
      }
      const n = list.length;
      const nextRound = cup.rounds[r + 1] || (cup.champion ? [cup.champion] : null);
      list.forEach((id, i) => {
        const y = top + 30 + (rowsH / n) * (i + 0.5);
        const t = teamById(id);
        const mine = id === PLAYER_TEAM.id;
        const lost = nextRound ? !nextRound.includes(id) : (!cup.alive && mine && r === cup.round);
        const g = this.add.graphics();
        g.fillStyle(hex(mine ? PALETTE.indigo : PALETTE.ink), 1).fillRect(colX[r] - 54, y - 12, 108, 24);
        if (mine) g.lineStyle(2, hex(PALETTE.gold)).strokeRect(colX[r] - 54, y - 12, 108, 24);
        const c = this.add.container(0, 0, [g]);
        c.add(kitChip(this, colX[r] - 40, y, t));
        c.add(text(this, colX[r] + 8, y, t.short, { color: mine ? PALETTE.gold : PALETTE.cream }));
        // Score of this tie, from the results list.
        const res = cup.results[r];
        if (res && i % 2 === 0) {
          const line = res[i / 2];
          if (line) {
            const s = line.a === id ? line.score : [...line.score].reverse();
            const p = line.pens ? (line.a === id ? line.pens : [...line.pens].reverse()) : null;
            const y2 = top + 30 + (rowsH / n) * (i + 1);
            text(this, colX[r], y2, `${s[0]}-${s[1]}${p ? ` (${p[0]}-${p[1]}p)` : ''}`, { color: PALETTE.lavender });
          }
        }
        if (lost) c.setAlpha(0.4);
      });
    }
  }
}

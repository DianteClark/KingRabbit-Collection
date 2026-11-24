import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { WIDTH, HEIGHT } from './common.js';
import { sfx } from '../../../shared/core/sfx.js';
import { header, go, setBackground, kitChip, modal } from './common.js';
import { save } from '../save.js';
import { PLAYER_TEAM, teamById } from '../logic/teams.js';
import { newCup, opponentOf, ROUND_NAMES } from '../logic/cup.js';
import { matchData } from '../flow.js';

/** Cup run: the bracket, last round's results and the next tie. */
// The bracket fills the left; status and buttons sit in a right-hand column centred on RX.
const RX = 528;

export class Cup extends Phaser.Scene {
  constructor() { super('Cup'); }

  create() {
    setBackground(this, PALETTE.night);
    header(this, 'Cup', () => go(this, 'Menu'));
    const cup = save.get('cup');
    if (!cup) { this.intro(); return; }
    this.bracket(cup);
    if (cup.champion === PLAYER_TEAM.id) {
      text(this, RX, 110, 'CHAMPIONS!', { size: 32, color: PALETTE.gold });
      text(this, RX, 146, `Cups won: ${save.get('cupsWon') || 0}`, { color: PALETTE.cream });
      button(this, RX, 230, 196, 56, 'New cup', () => this.start(), { fill: PALETTE.gold });
      sfx('win');
    } else if (!cup.alive) {
      text(this, RX, 110, `Out in the ${ROUND_NAMES[cup.round]}`, { color: PALETTE.orange });
      text(this, RX, 140, 'Your cup run is over', { color: PALETTE.cream });
      button(this, RX, 230, 196, 56, 'New cup', () => this.start(), { fill: PALETTE.gold });
    } else {
      const opp = teamById(opponentOf(cup));
      text(this, RX, 96, ROUND_NAMES[cup.round], { size: 32, color: PALETTE.gold });
      text(this, RX, 132, `you vs ${opp.name}`, { color: PALETTE.cream });
      button(this, RX, 214, 196, 56, 'Play',  () => go(this, 'MatchScene', matchData('cup', opp.id)), { fill: PALETTE.gold });
      button(this, RX, 300, 196, 40, 'Abandon run', () => {
        const m = modal(this, 'Abandon?', ['Start the cup again', 'from the quarter-finals?'], [
          ['Yes, new cup', () => { m.destroy(); this.start(); }],
          ['Keep playing', () => m.destroy()],
        ]);
      }, { fill: PALETTE.indigo, color: PALETTE.cream });
    }
  }

  intro() {
    panel(this, 16, 58, 400, 286);
    const lines = ['Eight teams, one trophy.', '', 'Quarter-final, semi-final', 'and final. Draws go to', 'a penalty shoot-out.', '', 'Lose once and the run', 'is over.'];
    lines.forEach((l, i) => text(this, 216, 96 + i * 28, l, { color: PALETTE.cream }));
    text(this, RX, 110, `Cups won: ${save.get('cupsWon') || 0}`, { color: PALETTE.gold });
    button(this, RX, 214, 196, 60, 'Start cup', () => this.start(), { size: 32, fill: PALETTE.gold });
  }

  start() {
    if (this.leaving) return;
    this.leaving = true;
    save.set('cup', newCup(Date.now() & 0x7fffffff));
    save.set('cupRuns', (save.get('cupRuns') || 0) + 1);
    this.scene.restart();
  }

  /** Each round as a column of ties; your team highlighted, losers dimmed. */
  bracket(cup) {
    const colX = [72, 200, 328];
    const top = 56;
    const rowsH = 284;
    ['QF', 'SF', 'Final'].forEach((n, r) => text(this, colX[r], top + 2, n, { color: r === cup.round && cup.alive && !cup.champion ? PALETTE.gold : PALETTE.lavender }));
    for (let r = 0; r < 3; r++) {
      const list = cup.rounds[r];
      if (!list) {
        // Slots still to be decided
        const n = 8 >> r;
        for (let i = 0; i < n; i++) {
          const y = top + 16 + (rowsH / n) * (i + 0.5);
          this.add.rectangle(colX[r], y, 108, 24, hex(PALETTE.ink)).setAlpha(0.6);
          text(this, colX[r], y, '?', { color: PALETTE.lavender });
        }
        continue;
      }
      const n = list.length;
      const nextRound = cup.rounds[r + 1] || (cup.champion ? [cup.champion] : null);
      list.forEach((id, i) => {
        const y = top + 16 + (rowsH / n) * (i + 0.5);
        const t = teamById(id);
        const mine = id === PLAYER_TEAM.id;
        const lost = nextRound ? !nextRound.includes(id) : (!cup.alive && mine && r === cup.round);
        const g = this.add.graphics();
        g.fillStyle(hex(mine ? PALETTE.indigo : PALETTE.ink), 1).fillRect(colX[r] - 54, y - 12, 108, 24);
        if (mine) g.lineStyle(2, hex(PALETTE.gold)).strokeRect(colX[r] - 54, y - 12, 108, 24);
        const c = this.add.container(0, 0, [g]);
        c.add(kitChip(this, colX[r] - 40, y, t));
        c.add(text(this, colX[r] - 4, y, t.short, { color: mine ? PALETTE.gold : PALETTE.cream }));
        // This team's goals in the tie, at the right of its box ("P" = won the shoot-out).
        const line = (cup.results[r] || []).find((l) => l.a === id || l.b === id);
        if (line) {
          const mineA = line.a === id;
          const g = line.score[mineA ? 0 : 1];
          const pw = line.pens && line.pens[mineA ? 0 : 1] > line.pens[mineA ? 1 : 0];
          c.add(text(this, colX[r] + 48, y, `${g}${pw ? 'P' : ''}`, { color: PALETTE.gold, origin: [1, 0.5] }));
        }
        if (lost) c.setAlpha(0.4);
      });
    }
  }
}

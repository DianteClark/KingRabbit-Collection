import { PALETTE, hex, text, button, WIDTH, HEIGHT, go, route, setBackground, helpButton, sfx, Phaser, icon, modal } from './common.js';
import { isMuted, setMuted } from '../../../shared/core/sfx.js';
import { loadRun, saveRun, getRecords, recordRun, isUnlocked, getSkill } from '../save.js';
import { newRun, sectorName, SHIPS } from '../logic/run.js';
import { makeShip } from '../logic/ship.js';
import { skillLabel } from '../logic/adaptive.js';
import { drawHull, drawRooms, HULL_COLORS } from './shipview.js';
import * as P from './panels.js';

export class Menu extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    setBackground(this, PALETTE.night);
    P.closeAll();
    this.stars();
    text(this, WIDTH / 2, 70 + 4, 'STAR DRIFTER', { size: 32, color: PALETTE.wine });
    text(this, WIDTH / 2, 70, 'STAR DRIFTER', { size: 32, color: PALETTE.gold });
    text(this, WIDTH / 2, 110, 'Outrun the Hegemony fleet.\nTake down its flagship.', { color: PALETTE.lavender });

    // The Wayfarer cruising across the title.
    const ship = makeShip(SHIPS.wayfarer);
    const cell = 12;
    const sx = Math.round((WIDTH - ship.w * cell) / 2) - 8;
    const sy = 190;
    const g = this.add.graphics();
    drawHull(g, ship, sx, sy, cell, HULL_COLORS.player, 1);
    drawRooms(g, ship, sx, sy, cell, HULL_COLORS.player);
    const flame = this.add.graphics();
    this.tweens.addCounter({ from: 0, to: 1, duration: 300, repeat: -1, yoyo: true, onUpdate: (tw) => {
      flame.clear();
      const v = tw.getValue();
      flame.fillStyle(hex(PALETTE.orange)).fillRect(sx - 30 - v * 6, sy + 6, 10 + v * 6, 6);
      flame.fillStyle(hex(PALETTE.gold)).fillRect(sx - 22 - v * 3, sy + 7, 6, 4);
      flame.fillStyle(hex(PALETTE.orange)).fillRect(sx - 30 - v * 6, sy + 25, 10 + v * 6, 6);
      flame.fillStyle(hex(PALETTE.gold)).fillRect(sx - 22 - v * 3, sy + 26, 6, 4);
    } });
    this.tweens.add({ targets: [g, flame], y: 4, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const run = loadRun();
    this.run = run;
    let y = 300;
    if (run) {
      const where = run.screen === 'combat' ? 'in a fight' : `sector ${run.sector}`;
      button(this, WIDTH / 2, y, 300, 50, 'Continue', () => route(this, run), { fill: PALETTE.gold });
      text(this, WIDTH / 2, y + 38, `${run.ship.name}, ${run.mode === 'cruise' ? 'Cruise' : 'Normal'}, ${where}: ${sectorName(run)}`, { color: PALETTE.lavender, wrap: 330 });
      y += 76;
    }
    button(this, WIDTH / 2, y, 300, 50, 'New run', () => this.newRun(), { fill: run ? PALETTE.lavender : PALETTE.gold });
    y += 62;
    button(this, WIDTH / 2, y, 300, 46, 'Records', () => this.records(), { fill: PALETTE.indigo, color: PALETTE.cream });

    text(this, WIDTH / 2, 560, 'Art: MAS Space Roguelike by Aleksandr Makarov', { color: PALETTE.lavender, wrap: 340 });
    button(this, 92, 610, 168, 44, '< All Games', () => { window.location.href = '../'; }, { fill: PALETTE.indigo, color: PALETTE.cream });
    this.soundBtn = button(this, 268, 610, 128, 44, '', () => { setMuted(!isMuted()); this.syncSound(); });
    this.syncSound();
    helpButton(this);
  }

  stars() {
    const g = this.add.graphics();
    for (let i = 0; i < 90; i++) {
      g.fillStyle(0xf9f5ef, Phaser.Math.FloatBetween(0.15, 0.8)).fillRect(Phaser.Math.Between(0, WIDTH), Phaser.Math.Between(0, HEIGHT), Math.random() < 0.15 ? 2 : 1, Math.random() < 0.15 ? 2 : 1);
    }
    // A distant planet.
    g.fillStyle(hex(PALETTE.plum), 0.5).fillCircle(300, 150, 34);
    g.fillStyle(hex(PALETTE.wine), 0.6).fillCircle(310, 158, 30);
  }

  syncSound() {
    this.soundBtn.setLabel(isMuted() ? 'Sound off' : 'Sound on');
    this.soundBtn.body.setFillStyle(hex(isMuted() ? PALETTE.indigo : PALETTE.leaf));
    this.soundBtn.label.setColor(PALETTE.cream);
  }

  newRun() {
    if (P.anyOpen() || this._leaving) return;
    P.showNewRun({
      unlocked: isUnlocked,
      existing: !!this.run,
      onStart: (ship, mode) => {
        if (this.run) recordRun(this.run);
        const run = newRun({ ship, mode, seed: Date.now() % 2147483647, skill: getSkill(mode) });
        saveRun(run);
        route(this, run);
      },
    });
  }

  records() {
    if (P.anyOpen()) return;
    sfx('select');
    P.showRecords(getRecords(), { normal: skillLabel(getSkill('normal')), cruise: skillLabel(getSkill('cruise')) });
  }
}

export { modal, icon };

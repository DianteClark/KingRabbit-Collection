import Phaser from 'phaser';
import { PALETTE } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { WIDTH } from '../../../shared/core/boot.js';
import { showHowTo } from '../../../shared/core/howto.js';
import { sfx } from '../../../shared/core/sfx.js';
import { RULES } from '../rules.js';
import { store } from '../store.js';
import * as S from '../logic/sim.js';
import { SCENARIOS } from '../logic/defs.js';
import { showScenarios, confirm, closeAll, blocking } from './panels.js';

export class Title extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    this.cameras.main.setBackgroundColor(PALETTE.night);
    this.busy = false;
    // A little street: houses and shops on grass, a road with cars.
    const g = this.add.graphics();
    g.fillStyle(0x6daa2c).fillRect(0, 150, WIDTH, 112);
    g.fillStyle(0x4e4a4e).fillRect(0, 262, WIDTH, 32);
    g.fillStyle(0xdeeed6).fillRect(0, 262, WIDTH, 2).fillRect(0, 292, WIDTH, 2);
    for (let x = 4; x < WIDTH; x += 24) g.fillRect(x, 277, 12, 2);
    g.fillStyle(0x6daa2c).fillRect(0, 294, WIDTH, 26);
    const row = [['res', 41], ['com', 13], ['res', 8], ['com', 33], ['res', 52]];
    let x = 4;
    for (const [sheet, i] of row) {
      const img = this.add.image(x, 262, sheet, String(i)).setOrigin(0, 1).setScale(2);
      x += img.displayWidth + 8;
    }
    for (let k = 0; k < 7; k++) this.add.image(12 + k * 52, 316, 'trees', `t${k % 5}`).setOrigin(0.5, 1).setScale(2);
    this.cars = [0, 1, 2, 3].map((k) => this.add.image(-40 - k * 110, k % 2 ? 270 : 286, 'veh', `car${(k * 2) % 9}${k % 2 ? 'L' : 'R'}`).setScale(2));
    this.cars.forEach((c, k) => { c.dir = k % 2 ? -1 : 1; if (c.dir < 0) c.x = WIDTH + 40 + k * 90; });
    text(this, WIDTH / 2, 48, 'Tiny Town Builder', { size: 32, color: PALETTE.gold });
    text(this, WIDTH / 2, 92, 'Zone, build and grow a little city.\nKeep the lights on and the people happy.', { color: PALETTE.cream, wrap: 330 });

    let raw = store.get('run');
    let run = null;
    if (raw) {
      try { run = { mode: raw.mode, t: raw.t, pop: raw.pop, result: raw.result }; } catch { raw = null; }
    }
    let y = 352;
    if (run) {
      const d = `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Math.floor(run.t) % 12]} Y${Math.floor(run.t / 12) + 1}`;
      const name = run.mode === 'sandbox' ? 'Sandbox' : SCENARIOS[run.mode]?.name || 'City';
      button(this, WIDTH / 2, y, 280, 48, 'Continue', () => this.continueRun(), { fill: PALETTE.gold });
      const tag = run.result?.over ? (run.result.won ? ' (won)' : ' (lost)') : '';
      text(this, WIDTH / 2, y + 36, `${name}${tag}, ${d}, ${(run.pop || 0).toLocaleString('en-US')} people`, { color: PALETTE.lavender });
      y += 74;
    }
    button(this, WIDTH / 2, y, 280, 48, 'New Sandbox', () => this.startNew('sandbox'), { fill: run ? PALETTE.lavender : PALETTE.gold });
    text(this, WIDTH / 2, y + 36, 'Build freely. No goals, no way to lose.', { color: PALETTE.lavender });
    y += 74;
    button(this, WIDTH / 2, y, 280, 48, 'Scenarios', () => { if (!blocking()) showScenarios((id) => this.startNew(id, true), store.get('best') || {}); });
    const won = Object.keys(store.get('best') || {}).length;
    text(this, WIDTH / 2, y + 36, `Reach a goal in time. Won ${won} of ${Object.keys(SCENARIOS).length}.`, { color: PALETTE.lavender });
    y = Math.max(y + 82, 580);
    button(this, 100, y, 160, 44, 'How to play', () => { if (!blocking()) showHowTo(RULES); }, { fill: PALETTE.cream });
    button(this, 266, y, 140, 44, 'Games', () => { window.location.href = '../'; }, { fill: PALETTE.cream });
    text(this, WIDTH / 2, 624, 'Art: Aleksandr Makarov (Tiny Tile Town)', { color: PALETTE.lavender }).setAlpha(0.7);
    this.events.once('shutdown', () => closeAll());
    window.__title = this;
  }

  update(_, ms) {
    for (const c of this.cars) {
      c.x += ms * 0.06 * c.dir;
      if (c.dir > 0 && c.x > WIDTH + 40) c.x = -40 - Math.random() * 120;
      if (c.dir < 0 && c.x < -40) c.x = WIDTH + 40 + Math.random() * 120;
    }
  }

  continueRun() {
    if (this.busy || blocking()) return;
    let s = null;
    try { s = S.deserialize(store.get('run')); } catch (e) { console.warn('save unreadable', e); }
    if (!s) { store.set('run', null); this.scene.restart(); return; }
    this.go(s);
  }

  startNew(mode, fromPanel = false) {
    if (this.busy || (!fromPanel && blocking())) return;
    const begin = () => {
      const s = S.newGame(mode);
      if (store.get('guided') && mode === 'sandbox') s.tut = null; // the guide shows once; How to play has the rest
      if (mode !== 'sandbox') s.tut = store.get('guided') ? null : 0;
      store.set('run', S.serialize(s));
      this.go(s);
    };
    const old = store.get('run');
    if (old && !(old.result?.over && !old.result.keepGoing) && (old.t > 0 || old.blds?.length)) {
      confirm({ title: 'Start over?', text: 'This replaces the city you are building now.', yes: 'Start new', onYes: begin, danger: true });
    } else begin();
  }

  go(s) {
    if (this.busy) return;
    this.busy = true;
    sfx('select');
    this.cameras.main.fadeOut(150, 28, 22, 24);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Game', { state: s }));
  }
}


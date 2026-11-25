import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { isMuted, setMuted } from '../../../shared/core/sfx.js';
import { dailySeed, playedDailyToday, profile } from '../../../shared/core/trophies.js';
import { WIDTH, go, setBackground, shadowTitle, openHowTo, modal } from './common.js';
import { save } from '../save.js';
import { skillLabel, resetSkill } from '../adaptive.js';
import { carTexture } from '../art.js';
import { modelById } from '../logic/car.js';
import { CUPS, trackById } from '../logic/tracks.js';
import { dailyConfig, fmtTime, newCup, nextTrack } from '../logic/cup.js';
import { GAME_ID, TROPHIES } from '../trophies.js';

export class Title extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    setBackground(this, PALETTE.night);
    button(this, 34, 28, 52, 40, '<', () => { this.input.enabled = false; window.location.href = '../'; }, { size: 32, fill: PALETTE.cream });
    button(this, WIDTH - 34, 28, 52, 40, '?', () => openHowTo(this), { size: 32, fill: PALETTE.gold });
    shadowTitle(this, WIDTH / 2, 26, 'TINY TOWN RACERS');

    this.drawStrip();
    const m = modelById(save.get('car'));
    text(this, 160, 164, `Your car: ${m.name}`, { color: PALETTE.cream });
    button(this, 160, 200, 200, 42, 'Garage', () => go(this, 'Garage'), { fill: PALETTE.lavender });
    this.gasBtn = button(this, 92, 254, 152, 42, '', () => { save.set('autoGas', !save.get('autoGas')); this.syncGas(); }, { fill: PALETTE.indigo, color: PALETTE.cream });
    this.soundBtn = button(this, 236, 254, 120, 42, '', () => { setMuted(!isMuted()); this.syncSound(); });
    this.syncGas(); this.syncSound();
    const prof = profile().games[GAME_ID];
    const got = prof ? Object.keys(prof.trophies || {}).length : 0;
    text(this, 160, 298, `Trophies ${got}/${TROPHIES.length}`, { color: PALETTE.lavender });
    button(this, 160, 334, 200, 40, `Rivals level ${skillLabel()}/10`, () => {
      modal(this, 'Rivals level', ['They adapt to how you do.', 'Put them back to the start?'], [
        ['Reset', () => { resetSkill(); this.scene.restart(); }],
        ['Cancel', null],
      ]);
    }, { fill: PALETTE.indigo, color: PALETTE.cream });

    // modes
    const cup = save.get('cup');
    const prog = save.get('progress') || { cups: [] };
    let cupSub;
    if (cup) cupSub = `${CUPS[cup.cup].name}: race ${cup.race + 1} of 4`;
    else {
      const won = (prog.cups || []).filter((p) => p === 1).length;
      cupSub = won ? `Cups won: ${won} of 3` : 'Four races for points';
    }
    const first = !save.get('races');
    const startFirst = () => {
      // first time: straight into race 1 of the Sunny Cup
      if (!save.get('cup')) save.set('cup', newCup(0));
      go(this, 'RaceScene', { mode: 'cup', trackId: nextTrack(save.get('cup')) });
    };
    const cupBtn = this.modeButton(88, first ? 'Start racing!' : 'Cup', first ? 'Sunny Cup, race 1' : cupSub, first ? startFirst : () => go(this, 'Cup'), first ? PALETTE.gold : PALETTE.cream);
    this.modeButton(154, 'Quick Race', 'Any open track', () => go(this, 'Tracks', { mode: 'quick' }));
    this.modeButton(220, 'Time Trial', 'Race your ghost', () => go(this, 'Tracks', { mode: 'tt' }));
    const daily = dailyConfig(dailySeed(GAME_ID));
    const best = this.dailyBest();
    const dsub = `${trackById(daily.trackId).name}${best != null ? '  ' + fmtTime(best) : playedDailyToday(GAME_ID) ? '' : '  New!'}`;
    this.modeButton(286, 'Daily', dsub, () => go(this, 'RaceScene', { mode: 'daily', trackId: daily.trackId, model: daily.model, colour: daily.colour }));
    if (first) this.tweens.add({ targets: cupBtn, scale: 1.04, yoyo: true, repeat: -1, duration: 500 });
  }

  dailyBest() {
    const d = profile().daily?.[GAME_ID];
    if (!d) return null;
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return d.best?.[key] ?? null;
  }

  modeButton(y, label, sub, fn, fill = PALETTE.cream) {
    const b = button(this, 484, y, 280, 60, '', fn, { fill });
    b.face.add(text(this, 0, -10, label, { size: 32, color: PALETTE.night }));
    b.face.add(text(this, 0, 17, sub, { color: PALETTE.indigo }));
    return b;
  }

  /** A strip of road with your car and two rivals looping past. */
  drawStrip() {
    const x0 = 20; const w = 280; const y = 106;
    const g = this.add.graphics();
    g.fillStyle(hex('#6daa2c')).fillRect(x0, y - 44, w, 88);
    g.fillStyle(hex('#4e4a4e')).fillRect(x0, y - 28, w, 56);
    g.fillStyle(hex('#deeed6')).fillRect(x0, y - 26, w, 2).fillRect(x0, y + 24, w, 2);
    for (let x = x0; x < x0 + w; x += 20) g.fillRect(x, y - 1, 10, 2);
    g.fillStyle(hex(PALETTE.ink)).fillRect(x0 - 3, y - 47, w + 6, 3).fillRect(x0 - 3, y + 44, w + 6, 3);
    g.fillRect(x0 - 3, y - 47, 3, 94).fillRect(x0 + w, y - 47, 3, 94);
    const mine = carTexture(this, save.get('car'), save.get('colour'));
    const r1 = carTexture(this, 'rally', save.get('colour') === 'white' ? 'orange' : 'white');
    const r2 = carTexture(this, 'buggy', save.get('colour') === 'yellow' ? 'green' : 'yellow');
    const shape = this.make.graphics({ add: false });
    shape.fillStyle(0xffffff).fillRect(x0, y - 44, w, 88);
    const mask = shape.createGeometryMask();
    this.stripCars = [
      { s: this.add.image(0, y + 12, mine, '0').setScale(2), off: 0, speed: 120, lane: 12 },
      { s: this.add.image(0, y - 12, r1, '0').setScale(2), off: 90, speed: 112, lane: -12 },
      { s: this.add.image(0, y + 12, r2, '0').setScale(2), off: 210, speed: 104, lane: 12 },
    ];
    this.stripCars.forEach((c) => c.s.setMask(mask));
    this.strip = { x0, w, y, t: 0 };
  }

  update(_, dt) {
    const st = this.strip;
    st.t += dt / 1000;
    for (const c of this.stripCars) {
      const x = st.x0 - 30 + ((st.t * c.speed + c.off) % (st.w + 60));
      const wob = Math.sin(st.t * 2 + c.off) * 4;
      c.s.setPosition(Math.round(x), Math.round(st.y + c.lane + wob));
      c.s.setFrame(Math.abs(Math.cos(st.t * 2 + c.off)) > 0.8 ? (wob > 0 ? '1' : '15') : '0');
    }
  }

  syncGas() { this.gasBtn.setLabel(save.get('autoGas') ? 'Gas: Auto' : 'Gas: Button'); }

  syncSound() {
    this.soundBtn.setLabel(isMuted() ? 'Muted' : 'Sound');
    this.soundBtn.body.setFillStyle(hex(isMuted() ? PALETTE.indigo : PALETTE.leaf));
    this.soundBtn.label.setColor(PALETTE.cream);
  }
}

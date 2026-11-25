import Phaser from 'phaser';
import { PALETTE } from '../../../shared/core/palette.js';
import { sfx } from '../../../shared/core/sfx.js';
import { dailySeed, reportDaily } from '../../../shared/core/trophies.js';
import { Race } from '../logic/race.js';
import { newDriver, drive } from '../logic/ai.js';
import { DT, speedOf } from '../logic/car.js';
import { rivalsFor, table, addRace, packGhost, unpackGhost, ghostAt, dailyConfig } from '../logic/cup.js';
import { carTexture, trackTexture, headingFrame, headlightTexture } from '../art.js';
import { save } from '../save.js';
import { getSkill, reportRace } from '../adaptive.js';
import { award, stat, GAME_ID } from '../trophies.js';
import { engineStart, engineStop, engineUpdate, sound } from '../sound.js';
import { freshScreen } from './common.js';

const ZOOM = 2;

/** The race world: track picture, cars, skid marks, camera. Controls and HUD live in Hud. */
export class RaceScene extends Phaser.Scene {
  constructor() { super('RaceScene'); }

  init(data) {
    this.data0 = data;
    this.paused = false;
    this.acc = 0;
    this.finishedAt = null;
    this.leavingRace = false;
  }

  create() {
    freshScreen(this);
    const d = this.data0;
    let model = d.model || save.get('car');
    let colour = d.colour || save.get('colour');
    if (d.mode === 'daily') { const c = dailyConfig(dailySeed(GAME_ID)); model = c.model; colour = c.colour; d.trackId = c.trackId; }
    this.model = model; this.colour = colour;
    const solo = d.mode === 'tt' || d.mode === 'daily';
    let rivals = []; let grid = 5;
    if (!solo) {
      const cup = d.mode === 'cup' ? save.get('cup') : null;
      rivals = rivalsFor(getSkill(), { cup: cup ? cup.cup : 0, avoidColour: colour });
      if (cup && cup.race > 0) {
        // grid by the cup table: the leader starts on pole
        const order = table(cup).map((r) => r.name);
        grid = order.indexOf('You');
        rivals = order.filter((n) => n !== 'You').map((n) => rivals.find((r) => r.name === n));
      } else {
        rivals = [...rivals].sort((a, b) => b.skill - a.skill);   // quickest at the front, you at the back
      }
    }
    this.race = new Race({ trackId: d.trackId, player: { model, colour }, rivals, grid: solo ? 0 : grid, record: solo });
    const race = this.race;
    window.__race = race;

    const t = race.t;
    document.body.style.background = PALETTE.night;
    const cam = this.cameras.main;
    cam.setBackgroundColor(PALETTE.night);
    cam.setZoom(ZOOM);
    cam.setBounds(0, 0, t.W, t.H);
    cam.roundPixels = true;
    cam.fadeIn(250);

    this.add.image(0, 0, trackTexture(this, race)).setOrigin(0).setDepth(-10);
    this.skids = this.add.renderTexture(0, 0, t.W, t.H).setOrigin(0).setDepth(-5);
    this.fx = this.add.graphics().setDepth(5);
    this.night = race.def.mood === 'night';
    if (this.night) headlightTexture(this);

    // ghost of your best lap (Time Trial; the daily has its own best)
    this.ghostFrames = null;
    if (d.mode === 'tt') {
      const b = (save.get('best') || {})[d.trackId];
      if (b && b.ghost) {
        this.ghostFrames = unpackGhost(b.ghost);
        this.ghost = this.add.image(0, 0, carTexture(this, b.gm || model, b.gc || 'white'), '0').setAlpha(0.45).setDepth(8).setVisible(false);
      }
    }

    this.sprites = race.cars.map((c) => {
      const shadow = this.add.image(0, 0, carTexture(this, c.model, c.colour), '0').setTint(0x000000).setAlpha(0.3).setDepth(9);
      const s = this.add.image(0, 0, carTexture(this, c.model, c.colour), '0').setDepth(c.human ? 11 : 10);
      const lamp = this.night ? this.add.image(0, 0, 'headlight').setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(12) : null;
      return { car: c, s, shadow, lamp };
    });
    this.puffs = [];
    this.camPos = { x: race.player.x, y: race.player.y };
    cam.centerOn(this.camPos.x, this.camPos.y);
    this.draw();

    engineStart();
    this.events.once('shutdown', () => { engineStop(); window.__race = null; });
    this.events.on('pause', () => engineUpdate(0, false, false, false));
    this.scene.launch('Hud', { raceScene: this });
    this.hud = this.scene.get('Hud');
    window.__racer = this;
  }

  update(_, dtMs) {
    if (this.paused || this.leavingRace) { engineUpdate(0, false, false, false); return; }
    this.acc += Math.min(0.1, dtMs / 1000);
    const race = this.race;
    let n = 0;
    // Debug hooks for automated play-testing: window.__racer.autopilot = true drives your car
    // with the computer's brain; .turbo = k runs k times faster.
    const turbo = this.turbo || 1;
    if (turbo > 1) this.acc += DT * (turbo - 1) * Math.min(6, dtMs / 16.7);
    while (this.acc >= DT && n < 6 * turbo) {
      this.acc -= DT; n++;
      let input = this.hud?.readInput ? this.hud.readInput() : {};
      if (this.autopilot && !race.player.finished) {
        this.pilot ||= newDriver(race.t, race.line, race.player, { skill: 1, seed: 5 });
        input = drive(race.t, race.line, this.pilot, race.player, race.cars, race.time);
      }
      const ev = race.step(input);
      if (ev.length) this.handle(ev);
    }
    if (n >= 6 * turbo) this.acc = 0;
    this.draw();
    const p = race.player;
    engineUpdate(Math.min(1.3, speedOf(p) / p.p.top), p.drifting, p.boostT > 0 || p.padT > 0, true);
    if (this.finishedAt != null && this.time.now - this.finishedAt > 2200) this.toResults();
  }

  handle(events) {
    const p = this.race.player;
    for (const e of events) {
      const mine = e.car === p;
      switch (e.type) {
        case 'count': sound('count'); this.hud.countdown(e.n); break;
        case 'go': sound('go'); this.hud.countdown(0); break;
        case 'wall': if (mine) { sfx('thud'); if (e.impact > 60) this.cameras.main.shake(120, 0.004); } break;
        case 'boost': if (mine) { sound('boost'); this.race.stats.boostsUsed = (this.race.stats.boostsUsed || 0) + 1; if (stat('boosts') >= 50) award('boost-50'); } break;
        case 'pad': if (mine) sound('pad'); break;
        case 'driftEnd': if (mine && e.t >= 3) award('drift-3'); break;
        case 'respawn': if (mine) this.hud.toast('Back on the road'); break;
        case 'lap':
          if (mine) {
            sound('lap');
            this.hud.lapBanner(e.lap, e.time);
            if (this.race.stats.cleanLap) award('clean-lap');
          }
          break;
        case 'finish':
          if (mine) this.playerFinished(e.place);
          break;
        default:
      }
    }
    if (p.wrongT >= 5) award('wrong-way');
  }

  playerFinished(place) {
    if (this.finishedAt != null) return;
    this.finishedAt = this.time.now;
    const race = this.race; const d = this.data0;
    const solo = d.mode === 'tt' || d.mode === 'daily';
    sfx(solo || place <= 3 ? 'win' : 'lose');
    this.hud.finishBanner(solo ? 'FINISH!' : place === 1 ? 'YOU WIN!' : `${['', '1st', '2nd', '3rd', '4th', '5th', '6th'][place]} place`);
    this.summary = this.settle(place);
  }

  /** Save everything about the finished race straight away (so leaving early still counts). */
  settle(place) {
    const race = this.race; const d = this.data0; const p = race.player;
    const solo = d.mode === 'tt' || d.mode === 'daily';
    const rows = race.results();
    const out = { mode: d.mode, trackId: d.trackId, rows, place, total: p.finishTime, laps: p.lapTimes.slice(), model: this.model, colour: this.colour };
    save.set('races', (save.get('races') || 0) + 1);
    stat('races');
    award('first-finish');
    const best = { ...(save.get('best') || {}) };
    const b = { ...(best[d.trackId] || {}) };
    if (!solo) {
      if (place <= 3) award('podium');
      if (place === 1) {
        award('first-win'); stat('wins');
        save.set('wins', (save.get('wins') || 0) + 1);
        if (race.stats.minPosLap2 >= race.cars.length) award('comeback');
      }
      b.place = b.place ? Math.min(b.place, place) : place;
      const winner = rows[0]; const me = rows.find((r) => r.human);
      const gap = place === 1 ? (rows[1]?.time ?? me.time) - me.time : me.time - winner.time;
      out.skillBefore = getSkill();
      reportRace(place, Math.min(1, Math.abs(gap) / 8));
      if (d.mode === 'cup') {
        const cup = save.get('cup');
        if (cup) save.set('cup', addRace(cup, rows.map((r) => r.name)));
      }
    }
    // laps: best lap and the ghost (Time Trial keeps the ghost; the daily only its best time)
    const laps = race.record ? race.record.laps : [];
    const fastest = Math.min(...p.lapTimes);
    out.bestLap = fastest;
    out.prevBestLap = b.lap ?? null;
    if (b.lap == null || fastest < b.lap) {
      b.lap = fastest;
      out.newBestLap = true;
      if (d.mode === 'tt') {
        const lap = laps.reduce((m, l) => (!m || l.time < m.time ? l : m), null);
        if (lap) { b.ghost = packGhost(lap.frames); b.gm = this.model; b.gc = this.colour; }
        if (out.prevBestLap != null) award('ghost');
      }
    }
    if (d.mode === 'tt') b.tt = b.tt == null ? p.finishTime : Math.min(b.tt, p.finishTime);
    best[d.trackId] = b;
    save.set('best', best);
    if (d.mode === 'daily') {
      out.daily = reportDaily(GAME_ID, Math.round(p.finishTime * 100) / 100, { lower: true });
      award('daily');
    }
    return out;
  }

  toResults() {
    if (this.leavingRace) return;
    this.leavingRace = true;
    this.hud.leave('Results', this.summary);
  }

  // ------------------------------------------------------------------ drawing

  draw() {
    const race = this.race;
    const fx = this.fx; fx.clear();
    for (const sp of this.sprites) {
      const c = sp.car;
      const x = Math.round(c.x); const y = Math.round(c.y);
      const f = headingFrame(c.h);
      sp.s.setPosition(x, y).setFrame(f);
      sp.shadow.setPosition(x + 1, y + 2).setFrame(f);
      const blink = c.ghostT > 0 && Math.floor(c.ghostT * 10) % 2 === 0;
      sp.s.setAlpha(blink ? 0.4 : 1);
      if (sp.lamp) sp.lamp.setPosition(x + Math.cos(c.h) * 6, y + Math.sin(c.h) * 6).setRotation(c.h);
      // skid marks from the rear wheels while sliding
      const slide = c.drifting || (Math.abs(-c.vx * Math.sin(c.h) + c.vy * Math.cos(c.h)) > 35);
      if (slide && race.running) {
        const bx = c.x - Math.cos(c.h) * 6; const by = c.y - Math.sin(c.h) * 6;
        const sx = -Math.sin(c.h) * 3; const sy = Math.cos(c.h) * 3;
        this.skids.fill(0x140c1c, 0.28, Math.round(bx + sx), Math.round(by + sy), 1, 1);
        this.skids.fill(0x140c1c, 0.28, Math.round(bx - sx), Math.round(by - sy), 1, 1);
        if (Math.random() < 0.3) this.puff(bx, by, 0xdeeed6);
      }
      // boost flame
      if (c.boostT > 0 || c.padT > 0) {
        const bx = c.x - Math.cos(c.h) * 9; const by = c.y - Math.sin(c.h) * 9;
        fx.fillStyle(Math.random() < 0.5 ? 0xe3d245 : 0xd88038, 1).fillRect(Math.round(bx) - 1, Math.round(by) - 1, 2 + (Math.random() < 0.5 ? 1 : 0), 2);
        fx.fillStyle(0xd88038, 1).fillRect(Math.round(bx - Math.cos(c.h) * 3), Math.round(by - Math.sin(c.h) * 3), 1, 1);
      }
    }
    // smoke puffs
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const pf = this.puffs[i];
      pf.life -= 1 / 60;
      if (pf.life <= 0) { this.puffs.splice(i, 1); continue; }
      fx.fillStyle(pf.col, pf.life * 0.6).fillRect(Math.round(pf.x), Math.round(pf.y), 2, 2);
      pf.y -= 0.15;
    }
    // ghost
    if (this.ghost) {
      const p = race.player;
      const g = race.running && !p.finished && p.lap >= 0 ? ghostAt(this.ghostFrames, race.time - p.lapStart) : null;
      this.ghost.setVisible(!!g);
      if (g) this.ghost.setPosition(Math.round(g.x), Math.round(g.y)).setFrame(headingFrame(g.h));
    }
    // camera: lead a little in the direction of travel (less up/down: the view is short), and
    // keep the car a touch above centre, clear of the thumb controls at the bottom
    const p = race.player;
    const ox = Math.max(-56, Math.min(56, p.vx * 0.4));
    const oy = Math.max(-26, Math.min(26, p.vy * 0.22));
    const tx = p.x + ox; const ty = p.y + oy + 12;
    this.camPos.x += (tx - this.camPos.x) * 0.12;
    this.camPos.y += (ty - this.camPos.y) * 0.12;
    this.cameras.main.centerOn(Math.round(this.camPos.x), Math.round(this.camPos.y));
  }

  puff(x, y, col) {
    if (this.puffs.length > 60) return;
    this.puffs.push({ x: x + (Math.random() - 0.5) * 3, y: y + (Math.random() - 0.5) * 3, life: 0.5, col });
  }
}


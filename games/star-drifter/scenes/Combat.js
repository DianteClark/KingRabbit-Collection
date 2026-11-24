import {
  PALETTE, hex, text, button, WIDTH, HEIGHT, go, route, setBackground, helpButton, sfx, Phaser, icon, modal, outlined, toast,
  floatText, blocked, hullBar, openHowTo,
} from './common.js';
import * as R from '../logic/run.js';
import * as C from '../logic/combat.js';
import {
  eff, usable, power, freePower, addPower, removePower, setWeapon, weaponBlock, setDrone, droneBlock, shieldMax, orderMove,
  roomOf, capacity, occupancy, crewInRoom, skillLevel,
} from '../logic/ship.js';
import { SYSTEMS, WEAPONS, DRONES, SPECIES, MAN_SKILL } from '../logic/data.js';
import { saveRun, save, setSkill, tipSeen, markTip } from '../save.js';
import { drawHull, drawRooms, roomRect, colorsFor } from './shipview.js';
import { ART } from '../frames.js';
import * as P from './panels.js';

const CELL = 22;
const ENEMY_Y = 104;
const PLAYER_Y = 282;
const BAND_Y = 226;
const SYS_Y = 420;
const DETAIL_Y = 474;
const WEAP_Y = 534;
const CREW_Y = 606;
const POWER_SYS = ['shields', 'engines', 'oxygen', 'medbay', 'drones', 'piloting', 'sensors'];
const SHORT = { shields: 'Shld', engines: 'Eng', oxygen: 'O2', medbay: 'Med', drones: 'Drone', piloting: 'Pilot', sensors: 'Sens', weapons: 'Weap', teleporter: 'Tele' };

export class Combat extends Phaser.Scene {
  constructor() { super('Combat'); }

  init(data) {
    this.run = data.run;
    this.c = this.run.combat;
    this.c.ships[0] = this.run.ship;
    this.paused = this.c.t > 0.5; // resumed from a save: start paused
    this.speed = 1;
    this.focus = null;
    this.ending = false;
    this.saveT = 0;
    this._overlays = 0;
    this._overlayClosedAt = undefined;
    this.shieldFlash = [0, 0];
    this._lastToast = null;
    this.crewSprites = new Map();
    this.tut = null;
  }

  create() {
    setBackground(this, '#0c0a10');
    P.closeAll();
    const c = this.c;
    c.autoCrew = save.get('autoCrew') !== false;
    this.stars();
    const [p, e] = c.ships;
    this.ex = Math.round((WIDTH - e.w * CELL) / 2) + 14;
    this.px = Math.round((WIDTH - p.w * CELL) / 2) - 14;
    this.ey = ENEMY_Y + Math.round((4 - e.h) * CELL / 2);
    this.py = PLAYER_Y;
    // Static ship art
    this.enemyG = this.add.graphics();
    this.enemyHull = drawHull(this.enemyG, e, this.ex, this.ey, CELL, colorsFor(e, 'enemy'), -1);
    drawRooms(this.enemyG, e, this.ex, this.ey, CELL, colorsFor(e, 'enemy'));
    this.playerG = this.add.graphics();
    this.playerHull = drawHull(this.playerG, p, this.px, this.py, CELL, colorsFor(p, 'player'), 1);
    drawRooms(this.playerG, p, this.px, this.py, CELL, colorsFor(p, 'player'));
    this.roomFx = this.add.graphics();
    this.sysIcons = [this.roomIcons(p, this.px, this.py), this.roomIcons(e, this.ex, this.ey)];
    this.overG = this.add.graphics().setDepth(5);
    this.crewLayer = this.add.container(0, 0).setDepth(6);
    this.shotG = this.add.graphics().setDepth(8);
    this.shieldG = this.add.graphics().setDepth(7);
    this.engineG = this.add.graphics().setDepth(1);

    this.topBar();
    this.enemyInfo();
    this.band();
    this.playerInfo();
    this.panel();
    this.input.on('pointerup', (ptr, over) => this.onTap(ptr, over));
    this.visHandler = () => { if (document.hidden) { this.paused = true; saveRun(this.run); this.syncBand(); } };
    document.addEventListener('visibilitychange', this.visHandler);
    window.addEventListener('pagehide', this.visHandler);
    this.events.once('shutdown', () => {
      document.removeEventListener('visibilitychange', this.visHandler);
      window.removeEventListener('pagehide', this.visHandler);
    });
    this.redraw(0);
    if (this.run.fight.tutorial && !tipSeen('combat')) this.startTutorial();
    else if (shieldMax(this.c.ships[1]) > 0 && !tipSeen('shields')) {
      markTip('shields');
      this.paused = true;
      const m = modal(this, 'Enemy shields', 'This ship has shields (the blue dots by its hull bar). Each layer stops one laser shot, then recharges.\n\nAim all your weapons at the same room so they fire close together, or hit the Shields room to knock them out.', [['Got it', () => { m.destroy(); this.paused = false; this.syncBand(); }]]);
    }
    else if (this.paused) this.banner('Paused. Tap Play to continue.');
    else if (this.run.fight.final) this.banner('The Iron Verdict! No running now.');
    else if (this.run.fight.fleet) this.banner('A Hegemony warship! Jump away when you can.');
  }

  // ------------------------------------------------------------ static layout

  stars() {
    const g = this.add.graphics();
    for (let i = 0; i < 70; i++) g.fillStyle(0xf9f5ef, Phaser.Math.FloatBetween(0.1, 0.5)).fillRect(Phaser.Math.Between(0, WIDTH), Phaser.Math.Between(40, 390), 1, 1);
  }

  roomIcons(ship, x0, y0) {
    const out = new Map();
    for (const r of ship.rooms) {
      if (!r.sys) continue;
      const q = roomRect(r, x0, y0, CELL);
      const art = ART[r.sys];
      if (!art) continue;
      const img = icon(this, q.x + q.w / 2, q.y + q.h / 2, art, 2).setAlpha(0.85).setDepth(4);
      if (!ship.sys[r.sys]) img.setAlpha(0.18);
      out.set(r.id, img);
    }
    return out;
  }

  topBar() {
    this.add.rectangle(0, 0, WIDTH, 40, hex(PALETTE.ink)).setOrigin(0).setDepth(40);
    const menu = button(this, 24, 20, 40, 34, '', () => this.menu(), { fill: PALETTE.lavender }).setDepth(41);
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.night));
    for (let i = 0; i < 3; i++) g.fillRect(-8, -7 + i * 6, 16, 3);
    menu.face.add(g);
    text(this, 52, 20, 'Hull', { origin: [0, 0.5], color: PALETTE.lavender }).setDepth(41);
    this.hull = hullBar(this, 92, 20, 104, 20, 41);
    this.add.image(212, 20, 'f2', '0,7').setScale(2).setDepth(41);
    this.misT = text(this, 221, 20, '', { origin: [0, 0.5] }).setDepth(41);
    this.add.image(262, 20, 'it', '3,2').setScale(2).setDepth(41);
    this.partT = text(this, 271, 20, '', { origin: [0, 0.5] }).setDepth(41);
    helpButton(this, WIDTH - 22, 20, () => { this.paused = true; this.syncBand(); });
  }

  enemyInfo() {
    const e = this.c.ships[1];
    this.add.rectangle(0, 40, WIDTH, 50, hex(PALETTE.night), 0.75).setOrigin(0);
    this.eName = text(this, 8, 54, e.name, { origin: [0, 0.5], color: PALETTE.orange });
    this.eDodge = text(this, WIDTH - 8, 54, '', { origin: [1, 0.5], color: PALETTE.lavender });
    this.eHull = hullBar(this, 8, 76, 110, 16, 2);
    this.eShieldG = this.add.graphics();
    this.eWeapG = this.add.graphics();
    this.eFlee = text(this, 196, 54, '', { origin: [0.5, 0.5], color: PALETTE.orange }).setDepth(3);
  }

  band() {
    this.add.rectangle(0, BAND_Y - 22, WIDTH, 44, hex(PALETTE.ink), 0.6).setOrigin(0);
    this.pauseBtn = button(this, 34, BAND_Y, 60, 38, '', () => this.togglePause(), { fill: PALETTE.gold }).setDepth(20);
    this.pauseIcon = this.add.graphics();
    this.pauseBtn.face.add(this.pauseIcon);
    this.speedBtn = button(this, 98, BAND_Y, 56, 38, '1x', () => this.toggleSpeed(), { fill: PALETTE.lavender }).setDepth(20);
    this.autoBtn = button(this, 162, BAND_Y, 60, 38, 'Auto', () => this.toggleAuto(), { fill: PALETTE.leaf, color: PALETTE.cream }).setDepth(20);
    this.ftlBg = this.add.rectangle(200, BAND_Y + 14, 154, 6, hex(PALETTE.night)).setOrigin(0, 0.5).setDepth(20);
    this.ftlFill = this.add.rectangle(200, BAND_Y + 14, 0, 6, hex(PALETTE.lavender)).setOrigin(0, 0.5).setDepth(20);
    this.jumpBtn = button(this, 277, BAND_Y - 4, 154, 30, 'Jump drive', () => this.jumpAway(), { fill: PALETTE.indigo, color: PALETTE.cream }).setDepth(20);
    this.syncBand();
  }

  playerInfo() {
    this.pShieldG = this.add.graphics();
    this.pDodge = text(this, 8, 262, '', { origin: [0, 0.5], color: PALETTE.lavender });
    this.pAir = text(this, WIDTH - 8, 262, '', { origin: [1, 0.5], color: PALETTE.lavender });
  }

  panel() {
    this.add.rectangle(0, 390, WIDTH, HEIGHT - 390, hex(PALETTE.ink)).setOrigin(0);
    this.add.rectangle(0, 390, WIDTH, 2, hex(PALETTE.indigo)).setOrigin(0);
    this.panelG = this.add.graphics();
    // Reactor
    icon(this, 22, SYS_Y - 12, ART.power, 2);
    this.reactorT = text(this, 22, SYS_Y + 12, '', { color: PALETTE.gold });
    // System columns
    const p = this.c.ships[0];
    const cols = POWER_SYS.filter((id) => p.sys[id]);
    this.sysCols = cols.map((id, i) => {
      const x = 66 + i * 44;
      const ic = icon(this, x, SYS_Y - 14, ART[id], 2);
      return { id, x, ic };
    });
    // Detail row
    this.minusBtn = button(this, 26, DETAIL_Y, 44, 40, '-', () => this.powerStep(-1), { fill: PALETTE.lavender }).setDepth(20);
    this.plusBtn = button(this, WIDTH - 26, DETAIL_Y, 44, 40, '+', () => this.powerStep(1), { fill: PALETTE.gold }).setDepth(20);
    this.detailT = text(this, WIDTH / 2, DETAIL_Y, '', { wrap: 260, color: PALETTE.cream });
    // Weapon cards
    this.weapCards = [];
    for (let i = 0; i < 4; i++) {
      const x = 4 + i * 89;
      const name = text(this, x + 43, WEAP_Y - 20, '', { color: PALETTE.cream });
      const st = text(this, x + 43, WEAP_Y + 20, '', { color: PALETTE.lavender });
      this.weapCards.push({ x, name, st });
    }
    // Crew cards
    this.crewCards = [];
    for (let i = 0; i < 6; i++) {
      const x = 4 + i * 59;
      const spr = this.add.image(x + 28, CREW_Y - 15, 'ch', '0,18').setScale(2).setVisible(false);
      const name = text(this, x + 28, CREW_Y + 4, '', { color: PALETTE.cream });
      this.crewCards.push({ x, spr, name });
    }
  }

  // ------------------------------------------------------------ loop

  update(time, delta) {
    if (this.ending) { this.redraw(delta / 1000); return; }
    const c = this.c;
    const live = !this.paused && !blocked(this) && !this.tutHold();
    if (live) {
      const dt = Math.min(0.1, delta / 1000) * this.speed;
      C.step(c, dt);
      this.saveT += delta;
      if (this.saveT > 2000) { this.saveT = 0; saveRun(this.run); }
    }
    this.drainFx();
    this.redraw(delta / 1000);
    if (c.result && !this.ending) this.finish();
  }

  tutHold() { return this.tut && this.tut.step < 3; }

  drainFx() {
    const c = this.c;
    if (!c.fx.length) return;
    const list = c.fx.splice(0);
    for (const f of list) this.playFx(f);
  }

  roomCenter(i, roomId) {
    const ship = this.c.ships[i];
    const r = ship.rooms[roomId];
    const q = roomRect(r, i === 0 ? this.px : this.ex, i === 0 ? this.py : this.ey, CELL);
    return { x: q.x + q.w / 2, y: q.y + q.h / 2, q };
  }

  playFx(f) {
    switch (f.k) {
      case 'fire': sfx(f.ship === 0 ? 'shoot' : 'card'); break;
      case 'hit': {
        const { x, y, q } = this.roomCenter(f.ship, f.room);
        this.flashRect(q, 0xf9f5ef);
        floatText(this, x, y - 6, `-${f.dmg}`, f.ship === 0 ? PALETTE.orange : PALETTE.gold);
        sfx('smallBoom');
        if (f.ship === 0) this.cameras.main.shake(120, 0.006);
        break;
      }
      case 'miss': { const { x, y } = this.roomCenter(f.ship, f.room); floatText(this, x, y - 6, 'MISS', PALETTE.lavender); sfx('flip'); break; }
      case 'shield': { this.shieldFlash = this.shieldFlash || [0, 0]; this.shieldFlash[f.ship] = 1; sfx('bounce'); break; }
      case 'ion': { const { x, y, q } = this.roomCenter(f.ship, f.room); this.flashRect(q, 0x6fa8dc); floatText(this, x, y - 6, 'ION', '#8fc4f0'); sfx('hit'); break; }
      case 'beam': {
        const pts = f.rooms.map((r) => this.roomCenter(f.ship, r));
        const g = this.add.graphics().setDepth(9);
        g.lineStyle(4, f.blocked ? 0x8a8fc4 : 0xd88038, 0.9);
        g.beginPath(); g.moveTo(pts[0].x, pts[0].y); for (const pt of pts.slice(1)) g.lineTo(pt.x, pt.y); g.strokePath();
        this.tweens.add({ targets: g, alpha: 0, duration: 500, onComplete: () => g.destroy() });
        if (f.blocked) { this.shieldFlash = this.shieldFlash || [0, 0]; this.shieldFlash[f.ship] = 1; }
        sfx('shoot');
        break;
      }
      case 'intercept': sfx('hit'); break;
      case 'launch': sfx('power'); break;
      case 'board': {
        if (!tipSeen('boarders')) { markTip('boarders'); this.time.delayedCall(1200, () => this.toastOnce('Boarders! Your crew will fight them. Send more crew to that room to help.')); }
        const { x, y } = this.roomCenter(0, f.room);
        floatText(this, x, y - 10, 'BOARDERS!', PALETTE.orange);
        this.toastOnce('Enemy boarders on your ship!');
        sfx('thud');
        break;
      }
      case 'death': {
        const ship = f.ship;
        const { x, y } = this.roomCenter(ship, f.room);
        floatText(this, x, y - 12, f.side === 'player' ? `${f.name} died` : 'Killed', f.side === 'player' ? PALETTE.red : PALETTE.gold);
        if (f.side === 'player') sfx('lose');
        break;
      }
      case 'sabotage': sfx('error'); break;
      case 'fleeing': this.toastOnce('The enemy is charging its jump drive! Finish it fast.'); break;
      case 'patch': sfx('place'); break;
      default: break;
    }
  }

  flashRect(q, color) {
    const r = this.add.rectangle(q.x + q.w / 2, q.y + q.h / 2, q.w, q.h, color, 0.8).setDepth(9);
    this.tweens.add({ targets: r, alpha: 0, duration: 350, onComplete: () => r.destroy() });
  }

  // ------------------------------------------------------------ drawing

  redraw(dt) {
    const c = this.c;
    const [p, e] = c.ships;
    this.hull.set(p.hull, p.maxHull);
    this.misT.setText(String(p.missiles));
    this.partT.setText(String(p.droneParts));
    this.eHull.set(e.hull, e.maxHull);
    this.eDodge.setText(`Dodge ${C.evasion(c, 1)}%`);
    this.pDodge.setText(`Dodge ${C.evasion(c, 0)}%`);
    const air = Math.round(p.rooms.reduce((a, r) => a + r.o2, 0) / p.rooms.length);
    this.pAir.setText(`Air ${air}%`).setColor(air < 40 ? PALETTE.orange : PALETTE.lavender);
    this.eFlee.setText(c.enemyFleeing ? `Jumping ${Math.round(c.ftl[1] * 100)}%` : '');
    this.drawShieldPips(this.eShieldG, e, 128, 76);
    this.drawShieldPips(this.pShieldG, p, 120, 262);
    this.drawEnemyWeapons();
    this.drawRoomsState();
    this.drawCrew(dt);
    this.drawShots();
    this.drawShields(dt);
    this.drawEngines();
    this.drawPanel();
    this.syncBand();
  }

  drawShieldPips(g, ship, x, y) {
    g.clear();
    const max = shieldMax(ship);
    const lvl = ship.sys.shields ? Math.floor(ship.sys.shields.level / 2) : 0;
    for (let i = 0; i < lvl; i++) {
      const cx = x + i * 16;
      g.fillStyle(hex(PALETTE.ink)).fillCircle(cx, y, 7);
      if (i < ship.shield.layers) g.fillStyle(0x6fa8dc).fillCircle(cx, y, 5);
      else if (i < max) {
        g.fillStyle(hex(PALETTE.indigo)).fillCircle(cx, y, 5);
        if (i === ship.shield.layers) g.fillStyle(0x6fa8dc, 0.8).fillRect(cx - 5, y + 4, Math.round(10 * ship.shield.charge), 2);
      } else g.fillStyle(hex(PALETTE.red), 0.6).fillCircle(cx, y, 3);
    }
  }

  drawEnemyWeapons() {
    const g = this.eWeapG;
    g.clear();
    const p = this.c.ships[0]; const e = this.c.ships[1];
    const sens = usable(p, 'sensors');
    const x0 = 200;
    if (sens < 2) return;
    e.weapons.forEach((w, i) => {
      const x = x0 + i * 30;
      g.fillStyle(hex(PALETTE.lavender)).fillRect(x - 1, 71, 28, 10);
      g.fillStyle(hex(PALETTE.ink)).fillRect(x, 72, 26, 8);
      g.fillStyle(w.on ? (w.charge >= 1 ? hex(PALETTE.red) : hex(PALETTE.orange)) : hex(PALETTE.indigo)).fillRect(x + 1, 73, Math.round(24 * (w.on ? w.charge : 0)), 6);
    });
  }

  drawRoomsState() {
    const g = this.roomFx;
    g.clear();
    const t = this.time.now / 1000;
    for (let i = 0; i < 2; i++) {
      const ship = this.c.ships[i];
      const x0 = i === 0 ? this.px : this.ex; const y0 = i === 0 ? this.py : this.ey;
      for (const r of ship.rooms) {
        const q = roomRect(r, x0, y0, CELL);
        if (!ship.crewless && r.o2 < 60) g.fillStyle(hex(PALETTE.red), (60 - r.o2) / 60 * 0.45).fillRect(q.x + 2, q.y + 2, q.w - 4, q.h - 4);
        if (r.fire > 0) {
          const n = Math.max(1, Math.round((r.fire / 100) * r.w * r.h * 2));
          for (let k = 0; k < n; k++) {
            const fx = q.x + 4 + ((k * 13 + Math.floor(t * 6) * 7) % Math.max(1, q.w - 10));
            const fy = q.y + q.h - 6 - ((k * 7) % Math.max(1, q.h - 10));
            g.fillStyle(hex(PALETTE.orange)).fillRect(fx, fy - 2, 5, 6);
            g.fillStyle(hex(PALETTE.gold)).fillRect(fx + 1, fy - (Math.floor(t * 8 + k) % 2 ? 4 : 1), 3, 3);
          }
        }
        if (r.breach > 0) {
          g.fillStyle(hex(PALETTE.ink)).fillRect(q.x + q.w / 2 - 6, q.y + 3, 12, 4);
          g.fillStyle(0x8fc4f0, 0.8).fillRect(q.x + q.w / 2 - 4, q.y + 4, 8, 2);
        }
        // System state: damage (red), ion (blue), repair progress.
        const s = r.sys && ship.sys[r.sys];
        const img = this.sysIcons[i].get(r.id);
        if (img && s) {
          img.setTint(s.dmg >= s.level ? 0xa13d3b : s.ion > 0 ? 0x6fa8dc : s.dmg > 0 ? 0xd88038 : 0xffffff);
          if (s.dmg > 0) {
            g.fillStyle(hex(PALETTE.red)).fillRect(q.x + 3, q.y + 3, 6, 6);
            if (s.rep > 0) g.fillStyle(hex(PALETTE.leaf)).fillRect(q.x + 3, q.y + q.h - 5, Math.round((q.w - 6) * s.rep), 2);
          }
        }
      }
    }
    // Targets and selections.
    const og = this.overG;
    og.clear();
    const p = this.c.ships[0];
    p.weapons.forEach((w, i) => {
      if (w.target === null || w.target === undefined || !w.on) return;
      const { x, y } = this.roomCenter(1, w.target);
      const off = (i % 2) * 8 - 4;
      og.lineStyle(2, hex(this.focus?.kind === 'weapon' && this.focus.i === i ? PALETTE.gold : PALETTE.red), 1);
      og.strokeCircle(x + off, y + off, 7);
      og.lineBetween(x + off - 10, y + off, x + off - 4, y + off);
      og.lineBetween(x + off + 4, y + off, x + off + 10, y + off);
    });
    if (this.focus?.kind === 'weapon') {
      // Every enemy room glows to say "aim here".
      og.lineStyle(2, hex(PALETTE.gold), 0.5 + 0.3 * Math.sin(this.time.now / 150));
      for (const r of this.c.ships[1].rooms) { const q = roomRect(r, this.ex, this.ey, CELL); og.strokeRect(q.x + 1, q.y + 1, q.w - 2, q.h - 2); }
    }
    if (this.focus?.kind === 'crew') {
      og.lineStyle(2, hex(PALETTE.leaf), 0.5 + 0.3 * Math.sin(this.time.now / 150));
      for (const r of p.rooms) { const q = roomRect(r, this.px, this.py, CELL); og.strokeRect(q.x + 1, q.y + 1, q.w - 2, q.h - 2); }
    }
    if (this.focus?.kind === 'room') {
      const q = roomRect(this.c.ships[this.focus.ship].rooms[this.focus.id], this.focus.ship === 0 ? this.px : this.ex, this.focus.ship === 0 ? this.py : this.ey, CELL);
      og.lineStyle(2, hex(PALETTE.cream)).strokeRect(q.x, q.y, q.w, q.h);
    }
  }

  crewPos(i, cr) {
    const ship = this.c.ships[i];
    const x0 = i === 0 ? this.px : this.ex; const y0 = i === 0 ? this.py : this.ey;
    const slot = (roomId, who) => {
      const r = ship.rooms[roomId];
      const here = ship.crew.filter((o) => o.hp > 0 && o.room === roomId && !o.path.length);
      let k = Math.max(0, here.indexOf(who));
      const cells = r.w * r.h;
      k %= cells;
      const cx = x0 + (r.x + (k % r.w) + 0.5) * CELL;
      const cy = y0 + (r.y + Math.floor(k / r.w) + 0.5) * CELL;
      return { x: cx, y: cy };
    };
    if (!cr.path.length) return slot(cr.room, cr);
    const a = this.roomCenter(i, cr.room); const b = this.roomCenter(i, cr.path[0]);
    return { x: a.x + (b.x - a.x) * cr.prog, y: a.y + (b.y - a.y) * cr.prog };
  }

  drawCrew() {
    const c = this.c;
    const seen = new Set();
    const showEnemy = usable(c.ships[0], 'sensors') >= 1;
    for (let i = 0; i < 2; i++) {
      for (const cr of c.ships[i].crew) {
        if (cr.hp <= 0) continue;
        if (i === 1 && !showEnemy) continue;
        const key = `${cr.side}:${cr.id}`;
        seen.add(key);
        let o = this.crewSprites.get(key);
        if (!o) {
          const spr = this.add.sprite(0, 0, 'ch', `0,${(cr.sprite - 8) / 8}`).setScale(2);
          if (cr.side === 'enemy') spr.setTint(0xffb0a0);
          const bar = this.add.rectangle(0, 0, 14, 3, hex(PALETTE.leaf)).setOrigin(0, 0.5);
          const ring = this.add.rectangle(0, 0, 20, 20).setStrokeStyle(2, hex(PALETTE.gold)).setVisible(false);
          this.crewLayer.add([ring, spr, bar]);
          o = { spr, bar, ring, moving: null };
          this.crewSprites.set(key, o);
        }
        const pos = this.crewPos(i, cr);
        o.spr.setPosition(Math.round(pos.x), Math.round(pos.y));
        o.spr.setFlipX(i === 1 || (cr.path.length && this.roomCenter(i, cr.path[0]).x < this.roomCenter(i, cr.room).x));
        const moving = cr.path.length > 0;
        if (moving !== o.moving) {
          o.moving = moving;
          if (moving) o.spr.play(`walk:${cr.sprite}`); else { o.spr.stop(); o.spr.setFrame(`0,${(cr.sprite - 8) / 8}`); }
        }
        const f = cr.hp / cr.maxHp;
        o.bar.setPosition(Math.round(pos.x) - 7, Math.round(pos.y) - 11).setSize(Math.max(1, Math.round(14 * f)), 3)
          .setFillStyle(hex(cr.side === 'enemy' ? PALETTE.red : f > 0.5 ? PALETTE.leaf : PALETTE.orange));
        o.ring.setPosition(Math.round(pos.x), Math.round(pos.y)).setVisible(this.focus?.kind === 'crew' && this.focus.id === cr.id && cr.side === 'player');
      }
    }
    for (const [k, o] of this.crewSprites) if (!seen.has(k)) { o.spr.destroy(); o.bar.destroy(); o.ring.destroy(); this.crewSprites.delete(k); }
  }

  drawShots() {
    const g = this.shotG;
    g.clear();
    for (const sh of this.c.shots) {
      if (sh.t < 0 || sh.type === 'beam') continue;
      const from = sh.from === 0
        ? { x: this.playerHull.left + this.playerHull.W + 10, y: this.py + 20 }
        : { x: this.enemyHull.left - 10, y: this.ey + 30 };
      const to = this.roomCenter(1 - sh.from, sh.room);
      const t = Math.min(1, sh.t / sh.travel);
      // Arc out to the side so shots don't fly straight through our own hull.
      const mx = sh.from === 0 ? WIDTH - 18 : 18;
      const my = (from.y + to.y) / 2;
      const x = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * mx + t * t * to.x;
      const y = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * my + t * t * to.y;
      const col = sh.type === 'missile' ? hex(PALETTE.orange) : sh.type === 'ion' ? 0x6fa8dc : sh.drone ? hex(PALETTE.leaf) : sh.from === 0 ? hex(PALETTE.gold) : hex(PALETTE.red);
      const s = sh.type === 'missile' ? 5 : 4;
      g.fillStyle(hex(PALETTE.ink)).fillRect(Math.round(x) - s / 2 - 1, Math.round(y) - s / 2 - 1, s + 2, s + 2);
      g.fillStyle(col).fillRect(Math.round(x) - s / 2, Math.round(y) - s / 2, s, s);
    }
  }

  drawShields(dt) {
    const g = this.shieldG;
    g.clear();
    this.shieldFlash = this.shieldFlash || [0, 0];
    for (let i = 0; i < 2; i++) {
      const ship = this.c.ships[i];
      const h = i === 0 ? this.playerHull : this.enemyHull;
      const flash = this.shieldFlash[i];
      this.shieldFlash[i] = Math.max(0, flash - dt * 2.5);
      if (ship.shield.layers <= 0 && flash <= 0) continue;
      const a = 0.12 + 0.08 * ship.shield.layers + flash * 0.5;
      g.lineStyle(2 + (flash > 0 ? 2 : 0), 0x6fa8dc, Math.min(1, a + 0.3));
      g.fillStyle(0x6fa8dc, Math.min(0.35, a * 0.4));
      const cx = h.left + h.W / 2 + (i === 0 ? 10 : -10); const cy = h.top + h.H / 2;
      g.fillEllipse(cx, cy, h.W + 40, h.H + 20);
      g.strokeEllipse(cx, cy, h.W + 40, h.H + 20);
    }
  }

  drawEngines() {
    const g = this.engineG;
    g.clear();
    const t = this.time.now / 90;
    for (let i = 0; i < 2; i++) {
      const ship = this.c.ships[i];
      if (eff(ship, 'engines') < 1) continue;
      const h = i === 0 ? this.playerHull : this.enemyHull;
      const len = 6 + (Math.floor(t) % 3) * 3;
      const x = i === 0 ? h.backX - len : h.backX + 8;
      for (const fy of [h.top + h.H * 0.2, h.top + h.H * 0.58]) {
        g.fillStyle(hex(PALETTE.orange)).fillRect(x, fy + 2, len, h.H * 0.22 - 4);
        g.fillStyle(hex(PALETTE.gold)).fillRect(i === 0 ? x + len - 4 : x, fy + 4, 4, h.H * 0.22 - 8);
      }
    }
  }

  drawPanel() {
    const g = this.panelG;
    g.clear();
    const p = this.c.ships[0];
    const free = freePower(p);
    this.reactorT.setText(String(free));
    // Reactor bar (vertical)
    const used = p.reactor - free;
    for (let k = 0; k < Math.min(p.reactor, 25); k++) {
      const col = Math.floor(k / 13); const row = k % 13;
      g.fillStyle(k < used ? hex(PALETTE.indigo) : hex(PALETTE.gold)).fillRect(38 + col * 4, SYS_Y + 22 - row * 3, 3, 2);
    }
    // System columns
    for (const col of this.sysCols) {
      const s = p.sys[col.id];
      const sel = this.focus?.kind === 'sys' && this.focus.id === col.id;
      g.fillStyle(hex(sel ? PALETTE.gold : PALETTE.indigo)).fillRect(col.x - 21, SYS_Y - 30, 42, 56);
      g.fillStyle(hex(PALETTE.night)).fillRect(col.x - 19, SYS_Y - 28, 38, 52);
      const pw = SYSTEMS[col.id].power ? power(p, col.id) : usable(p, col.id);
      for (let k = 0; k < s.level; k++) {
        const px = col.x - 16 + (k % 4) * 8; const py = SYS_Y + 2 + Math.floor(k / 4) * 9;
        let c = hex(PALETTE.ink);
        if (k >= s.level - s.dmg) c = hex(PALETTE.red);
        else if (k >= s.level - s.dmg - s.ion) c = 0x6fa8dc;
        else if (k < pw) c = hex(PALETTE.leaf);
        else c = hex(PALETTE.wine);
        g.fillStyle(c).fillRect(px, py, 7, 7);
      }
      col.ic.setTint(s.dmg >= s.level ? 0xa13d3b : s.dmg > 0 ? 0xd88038 : 0xffffff);
    }
    // Weapon cards
    for (let i = 0; i < 4; i++) {
      const card = this.weapCards[i];
      const w = p.weapons[i];
      const x = card.x;
      if (!w) { card.name.setText(''); card.st.setText(''); g.fillStyle(hex(PALETTE.night)).fillRect(x, WEAP_Y - 34, 86, 66); continue; }
      const d = WEAPONS[w.id];
      const sel = this.focus?.kind === 'weapon' && this.focus.i === i;
      g.fillStyle(hex(sel ? PALETTE.gold : w.on ? PALETTE.lavender : PALETTE.indigo)).fillRect(x, WEAP_Y - 34, 86, 66);
      g.fillStyle(hex(w.on ? '#2b2640' : PALETTE.night)).fillRect(x + 3, WEAP_Y - 31, 80, 60);
      card.name.setText(d.short).setColor(w.on ? PALETTE.cream : PALETTE.lavender);
      // Charge bar
      g.fillStyle(hex(PALETTE.ink)).fillRect(x + 8, WEAP_Y - 6, 70, 8);
      const ready = w.on && w.charge >= 1;
      g.fillStyle(ready ? hex(PALETTE.leaf) : hex(PALETTE.gold)).fillRect(x + 9, WEAP_Y - 5, Math.round(68 * w.charge), 6);
      // Power pips
      for (let k = 0; k < d.power; k++) g.fillStyle(w.on ? hex(PALETTE.leaf) : hex(PALETTE.wine)).fillRect(x + 8 + k * 9, WEAP_Y + 6, 7, 5);
      let st = '';
      if (!w.on) st = 'Off';
      else if (d.type === 'missile' && p.missiles < 1) st = 'No ammo';
      else if (w.target === null || w.target === undefined) st = ready ? 'Aim!' : 'No target';
      else st = ready ? 'Firing' : 'Aimed';
      card.st.setText(st).setColor(st === 'Aim!' ? PALETTE.gold : st === 'No ammo' ? PALETTE.orange : PALETTE.lavender);
    }
    // Crew cards
    const crew = p.crew.filter((x) => x.side === 'player' && x.hp > 0);
    for (let i = 0; i < 6; i++) {
      const card = this.crewCards[i];
      const cr = crew[i];
      if (!cr) { card.spr.setVisible(false); card.name.setText(''); continue; }
      const sel = this.focus?.kind === 'crew' && this.focus.id === cr.id;
      g.fillStyle(hex(sel ? PALETTE.leaf : PALETTE.indigo)).fillRect(card.x, CREW_Y - 30, 56, 56);
      g.fillStyle(hex(PALETTE.night)).fillRect(card.x + 2, CREW_Y - 28, 52, 52);
      card.spr.setVisible(true).setFrame(`0,${(cr.sprite - 8) / 8}`);
      card.name.setText(cr.name.slice(0, 5));
      const f = cr.hp / cr.maxHp;
      g.fillStyle(hex(PALETTE.ink)).fillRect(card.x + 6, CREW_Y + 16, 44, 6);
      g.fillStyle(hex(f > 0.5 ? PALETTE.leaf : f > 0.25 ? PALETTE.orange : PALETTE.red)).fillRect(card.x + 7, CREW_Y + 17, Math.round(42 * f), 4);
      // What they're doing: a small dot.
      const room = p.rooms[cr.room];
      const busy = cr.path.length ? PALETTE.lavender : room.fire > 0 ? PALETTE.orange : room.breach > 0 ? '#8fc4f0' : (room.sys && p.sys[room.sys]?.dmg) ? PALETTE.red : room.sys && MAN_SKILL[room.sys] ? PALETTE.gold : null;
      if (busy) g.fillStyle(hex(busy)).fillRect(card.x + 46, CREW_Y - 25, 6, 6);
    }
    this.refreshDetail();
  }

  syncBand() {
    if (!this.pauseIcon) return;
    const g = this.pauseIcon;
    g.clear();
    g.fillStyle(hex(PALETTE.night));
    if (this.paused) g.fillTriangle(-6, -9, -6, 9, 9, 0);
    else { g.fillRect(-8, -9, 6, 18); g.fillRect(2, -9, 6, 18); }
    // While paused the Play button pulses so it's obvious time is frozen.
    const pulse = this.paused && !this.ending ? 0.5 + 0.5 * Math.sin(this.time.now / 180) : 1;
    this.pauseBtn.body.setFillStyle(hex(PALETTE.gold), 0.55 + 0.45 * pulse);
    this.speedBtn.setLabel(`${this.speed}x`);
    this.autoBtn.body.setFillStyle(hex(this.c.autofire ? PALETTE.leaf : PALETTE.indigo));
    const c = this.c;
    const f = c.ftl[0];
    this.ftlFill.width = Math.round(154 * f);
    const can = c.canFlee && f >= 1;
    this.jumpBtn.setLabel(!c.canFlee ? 'No escape' : can ? 'JUMP AWAY' : `Jump drive ${Math.round(f * 100)}%`);
    this.jumpBtn.setEnabled(can);
    this.jumpBtn.body.setFillStyle(hex(can ? PALETTE.orange : PALETTE.indigo));
  }

  // ------------------------------------------------------------ detail row

  refreshDetail() {
    const p = this.c.ships[0];
    const f = this.focus;
    let msg = 'Tap a weapon, then an enemy room to aim. Tap a system to move power.';
    let minus = false; let plus = false;
    if (f?.kind === 'sys') {
      const s = p.sys[f.id];
      const d = SYSTEMS[f.id];
      if (f.id === 'drones') {
        const names = p.drones.map((dr) => `${DRONES[dr.id].short} ${dr.on ? 'on' : 'off'}`).join(', ') || 'no drones fitted';
        msg = `Drones: ${names}. ${p.droneParts} part${p.droneParts === 1 ? '' : 's'} left.`;
        minus = p.drones.some((dr) => dr.on);
        plus = p.drones.some((dr, i) => !dr.on && !droneBlock(p, i));
      } else if (!d.power) {
        msg = `${d.name} level ${usable(p, f.id)}/${s.level}. ${f.id === 'piloting' ? (C.evasion(this.c, 0) > 0 ? 'Crewed: dodging.' : 'Needs crew!') : 'No power needed.'}`;
      } else {
        const pw = power(p, f.id);
        let extra = '';
        if (f.id === 'shields') extra = ` = ${Math.floor(pw / 2)} layer${Math.floor(pw / 2) === 1 ? '' : 's'}`;
        if (f.id === 'engines') extra = `, dodge ${C.evasion(this.c, 0)}%`;
        msg = `${d.name}: ${pw}/${s.level} power${extra}${s.dmg ? `, ${s.dmg} broken` : ''}`;
        minus = pw > 0;
        plus = pw < usable(p, f.id) && freePower(p) > 0;
      }
    } else if (f?.kind === 'weapon') {
      const w = p.weapons[f.i];
      if (!w) { this.focus = null; return; }
      const d = WEAPONS[w.id];
      const block = weaponBlock(p, f.i);
      msg = w.on ? `${d.name}: tap an enemy room to aim.${d.type === 'missile' ? ` Missiles: ${p.missiles}.` : ''}` : `${d.name} is off. ${block || 'Tap + to power it.'}`;
      minus = w.on;
      plus = !w.on && !block;
    } else if (f?.kind === 'crew') {
      const cr = p.crew.find((x) => x.id === f.id && x.hp > 0);
      if (!cr) { this.focus = null; return; }
      const best = Object.entries(cr.xp).filter(([k]) => skillLevel(cr, k) > 0).map(([k]) => k).slice(0, 1).join(', ');
      msg = `${cr.name}, ${SPECIES[cr.species].name} ${Math.ceil(cr.hp)}/${cr.maxHp}${best ? `, good at ${best}` : ''}. Tap a room to send them.`;
    } else if (f?.kind === 'room') {
      const ship = this.c.ships[f.ship];
      const r = ship.rooms[f.id];
      const s = r.sys && ship.sys[r.sys];
      const name = P.roomName(ship, r);
      const bits = [];
      if (s) bits.push(`level ${s.level}${s.dmg ? `, ${s.dmg} broken` : ''}`);
      if (r.fire > 0) bits.push('on fire');
      if (r.breach > 0) bits.push('hull breach');
      if (!ship.crewless) bits.push(`air ${Math.round(r.o2)}%`);
      msg = `${f.ship === 1 ? 'Enemy ' : ''}${name}: ${bits.join(', ')}.`;
    }
    if (this.detailT.text !== msg) this.detailT.setText(msg);
    this.minusBtn.setEnabled(minus).setVisible(f?.kind === 'sys' || f?.kind === 'weapon');
    this.plusBtn.setEnabled(plus).setVisible(f?.kind === 'sys' || f?.kind === 'weapon');
  }

  powerStep(dir) {
    if (this.ending || blocked(this)) return;
    const p = this.c.ships[0];
    const f = this.focus;
    let ok = false;
    if (f?.kind === 'sys') {
      if (f.id === 'drones') {
        if (dir > 0) { const i = p.drones.findIndex((d, k) => !d.on && !droneBlock(p, k)); ok = i >= 0 && setDrone(p, i, true); } else { const i = p.drones.map((d) => d.on).lastIndexOf(true); ok = i >= 0 && setDrone(p, i, false); }
      } else ok = dir > 0 ? addPower(p, f.id) : removePower(p, f.id);
    } else if (f?.kind === 'weapon') ok = setWeapon(p, f.i, dir > 0);
    sfx(ok ? (dir > 0 ? 'power' : 'tap') : 'error');
    if (ok) saveRun(this.run);
  }

  // ------------------------------------------------------------ taps

  onTap(ptr, over) {
    if (this.ending || blocked(this)) return;
    if (over && over.length) return; // a button handled it
    const x = ptr.x; const y = ptr.y;
    const p = this.c.ships[0];
    // Enemy rooms
    const er = this.roomAt(1, x, y);
    if (er !== null) { this.tapEnemyRoom(er); return; }
    const pr = this.roomAt(0, x, y);
    if (pr !== null) { this.tapPlayerRoom(pr, x, y); return; }
    // System columns
    if (y > SYS_Y - 32 && y < SYS_Y + 28) {
      const col = this.sysCols.find((cc) => Math.abs(cc.x - x) <= 22);
      if (col) { sfx('select'); this.focus = this.focus?.kind === 'sys' && this.focus.id === col.id ? null : { kind: 'sys', id: col.id }; return; }
      if (x < 48) { sfx('tap'); this.toastOnce(`Reactor: ${freePower(p)} of ${p.reactor} power free. Upgrade it on the map (Ship).`); return; }
    }
    // Weapon cards
    if (y > WEAP_Y - 36 && y < WEAP_Y + 34) {
      const i = Math.floor((x - 4) / 89);
      if (i >= 0 && i < 4 && p.weapons[i]) { this.tapWeapon(i); return; }
    }
    // Crew cards
    if (y > CREW_Y - 32 && y < CREW_Y + 28) {
      const i = Math.floor((x - 4) / 59);
      const crew = p.crew.filter((c) => c.side === 'player' && c.hp > 0);
      if (i >= 0 && crew[i]) { sfx('select'); this.focus = this.focus?.kind === 'crew' && this.focus.id === crew[i].id ? null : { kind: 'crew', id: crew[i].id }; return; }
    }
    if (y > 240 && y < 392) { this.focus = null; return; }
    if (y > 44 && y < 200 && this.focus?.kind === 'weapon') { this.focus = null; }
  }

  roomAt(i, x, y) {
    const ship = this.c.ships[i];
    const x0 = i === 0 ? this.px : this.ex; const y0 = i === 0 ? this.py : this.ey;
    // A little slack around small rooms makes them easier to hit with a thumb.
    let best = null; let bestD = 1e9;
    for (const r of ship.rooms) {
      const q = roomRect(r, x0, y0, CELL);
      const dx = Math.max(q.x - x, 0, x - (q.x + q.w)); const dy = Math.max(q.y - y, 0, y - (q.y + q.h));
      const d = Math.hypot(dx, dy);
      if (d < bestD) { bestD = d; best = r.id; }
    }
    return bestD <= 10 ? best : null;
  }

  tapWeapon(i) {
    const p = this.c.ships[0];
    const w = p.weapons[i];
    if (!w.on) {
      const block = weaponBlock(p, i);
      if (!block) { setWeapon(p, i, true); sfx('power'); saveRun(this.run); } else { sfx('error'); this.toastOnce(block); }
      this.focus = { kind: 'weapon', i };
      this.tutEvent('weapon');
      return;
    }
    sfx('select');
    this.focus = this.focus?.kind === 'weapon' && this.focus.i === i ? null : { kind: 'weapon', i };
    if (this.focus) this.tutEvent('weapon');
  }

  tapEnemyRoom(roomId) {
    const p = this.c.ships[0];
    if (this.focus?.kind === 'weapon') {
      const w = p.weapons[this.focus.i];
      if (w && w.on) {
        w.target = roomId;
        sfx('place');
        saveRun(this.run);
        this.tutEvent('target');
        // Move on to the next weapon without a target, to make aiming quick.
        const nextI = p.weapons.findIndex((o, k) => k !== this.focus.i && o.on && (o.target === null || o.target === undefined));
        this.focus = nextI >= 0 ? { kind: 'weapon', i: nextI } : null;
        return;
      }
    }
    sfx('tap');
    this.focus = { kind: 'room', ship: 1, id: roomId };
  }

  tapPlayerRoom(roomId, x, y) {
    const p = this.c.ships[0];
    if (this.focus?.kind === 'crew') {
      const cr = p.crew.find((c) => c.id === this.focus.id && c.hp > 0 && c.side === 'player');
      if (cr) {
        if (cr.room === roomId && !cr.path.length) { this.focus = null; return; }
        if (orderMove(p, cr, roomId)) {
          cr.station = roomId;
          sfx('move');
          saveRun(this.run);
          this.focus = null;
        } else {
          sfx('error');
          this.toastOnce(occupancy(p, roomId) >= capacity(p.rooms[roomId]) ? 'That room is full.' : 'Cannot get there.');
        }
        return;
      }
    }
    // Pick the crew member nearest the tap in this room.
    const here = p.crew.filter((c) => c.side === 'player' && c.hp > 0 && (c.room === roomId || c.path[0] === roomId));
    if (here.length) {
      let best = here[0]; let bd = 1e9;
      for (const c of here) { const pos = this.crewPos(0, c); const d = Math.hypot(pos.x - x, pos.y - y); if (d < bd) { bd = d; best = c; } }
      sfx('select');
      this.focus = { kind: 'crew', id: best.id };
      return;
    }
    sfx('tap');
    this.focus = { kind: 'room', ship: 0, id: roomId };
  }

  toastOnce(msg) {
    if (this._lastToast && this._lastToast.active) this._lastToast.destroy();
    this._lastToast = toast(this, msg, 370, PALETTE.sand, Math.min(4000, 900 + msg.length * 35));
  }

  banner(msg) { toast(this, msg, 372, PALETTE.gold, 2400); }

  togglePause() {
    if (this.ending) return;
    if (this.tut && this.tut.step < 3) { sfx('error'); return; }
    this.paused = !this.paused;
    saveRun(this.run);
    this.syncBand();
    if (!this.paused) this.tutEvent('play');
  }

  toggleSpeed() { this.speed = this.speed === 1 ? 2 : 1; this.syncBand(); }

  toggleAuto() {
    const c = this.c;
    c.autofire = !c.autofire;
    this.toastOnce(c.autofire ? 'Auto-fire on: weapons keep firing at their target.' : 'Auto-fire off: each weapon fires once, then waits for a new target.');
    saveRun(this.run);
    this.syncBand();
  }

  jumpAway() {
    if (this.ending || blocked(this)) return;
    if (C.jumpAway(this.c)) { sfx('power'); }
  }

  // ------------------------------------------------------------ tutorial

  startTutorial() {
    this.paused = true;
    this.tut = { step: 0, box: null };
    this.tutShow();
  }

  tutShow() {
    const t = this.tut;
    t.box?.destroy();
    const steps = [
      ['Your first fight!', 'The game is paused. Your ship is at the bottom, the enemy at the top. Your crew already stand at their stations.', 300],
      ['Pick a weapon', 'Tap one of your weapon cards (below) to pick it.', 318],
      ['Aim', 'Now tap a room on the enemy ship (top) to aim at it. Their Weapons room (the green rod) is a good target: hit it and they stop shooting.', 318],
      ['Fire away', 'Aim your other weapon too. Weapons fire on their own when charged. Then tap the Play button (left of 1x) to start. You can pause any time.', 318],
    ];
    if (t.step >= steps.length) { this.tut = null; markTip('combat'); return; }
    const [title, body, y] = steps[t.step];
    const c = this.add.container(0, 0).setDepth(95);
    const w = 320;
    const bodyT = text(this, WIDTH / 2, 0, body, { wrap: w - 24 });
    const h = bodyT.height + 50 + (t.step === 0 ? 50 : 0);
    const top = y - h / 2;
    c.add(this.add.rectangle(WIDTH / 2, y, w, h, hex(PALETTE.ink), 0.92).setStrokeStyle(3, hex(PALETTE.gold)));
    c.add(text(this, WIDTH / 2, top + 16, title, { color: PALETTE.gold }));
    bodyT.setOrigin(0.5, 0).setPosition(WIDTH / 2, top + 32);
    c.add(bodyT);
    if (t.step === 0) {
      c.add(button(this, WIDTH / 2, top + h - 28, 140, 40, 'Next', () => { t.step = 1; this.tutShow(); }, { fill: PALETTE.gold }));
    }
    t.box = c;
  }

  tutEvent(kind) {
    const t = this.tut;
    if (!t) return;
    if (t.step === 1 && kind === 'weapon') { t.step = 2; this.tutShow(); }
    else if (t.step === 2 && kind === 'target') { t.step = 3; this.tutShow(); }
    else if (t.step === 3 && kind === 'play') { t.box?.destroy(); this.tut = null; markTip('combat'); this.time.delayedCall(6000, () => { if (!this.ending) this.toastOnce('Tip: tap a crew member, then a room, to move them.'); }); }
  }

  // ------------------------------------------------------------ end

  finish() {
    const c = this.c;
    this.ending = true;
    this.focus = null;
    this.tut?.box?.destroy();
    this.tut = null;
    const out = c.result.outcome;
    let msg = '';
    let color = PALETTE.gold;
    if (out === 'win') {
      msg = c.result.how === 'crew' ? 'Enemy crew defeated!' : 'Enemy destroyed!';
      if (c.result.how === 'destroyed') this.explode(1);
      sfx(c.result.how === 'destroyed' ? 'boom' : 'win');
    } else if (out === 'lose') {
      msg = c.result.how === 'crew' ? 'Your crew is gone...' : 'Your ship breaks apart...';
      color = PALETTE.red;
      if (c.result.how === 'hull') this.explode(0);
      sfx('lose');
    } else if (out === 'fled') { msg = 'Jumped away!'; sfx('power'); this.cameras.main.flash(300, 249, 245, 239); } else { msg = 'The enemy jumped away.'; color = PALETTE.lavender; sfx('flip'); }
    const t = outlined(this, WIDTH / 2, BAND_Y, msg, { size: 32, color, wrap: 340 }).setDepth(96);
    t.setScale(0.6);
    this.tweens.add({ targets: t, scale: 1, duration: 300, ease: 'Back.easeOut' });
    this.time.delayedCall(1700, () => {
      const run = this.run;
      R.finishCombat(run);
      setSkill(run.mode, run.skill);
      saveRun(run);
      route(this, run);
    });
  }

  explode(i) {
    const h = i === 0 ? this.playerHull : this.enemyHull;
    for (let k = 0; k < 9; k++) {
      this.time.delayedCall(k * 90, () => {
        const x = h.left + Math.random() * h.W; const y = h.top + Math.random() * h.H;
        const r = this.add.circle(x, y, 4, hex(k % 2 ? PALETTE.gold : PALETTE.orange)).setDepth(12);
        this.tweens.add({ targets: r, radius: 18, alpha: 0, duration: 450, onComplete: () => r.destroy() });
      });
    }
    this.cameras.main.shake(400, 0.01);
    this.time.delayedCall(500, () => {
      const g = i === 0 ? this.playerG : this.enemyG;
      this.tweens.add({ targets: [g, this.crewLayer].concat([...this.sysIcons[i].values()]), alpha: i === 1 ? 0 : 0.3, duration: 600 });
    });
  }

  // ------------------------------------------------------------ menu

  menu() {
    if (this.ending || this._overlays) return;
    const wasPaused = this.paused;
    this.paused = true;
    this.syncBand();
    saveRun(this.run);
    const auto = () => (this.c.autoCrew ? 'Crew auto-tasks: On' : 'Crew auto-tasks: Off');
    const m = modal(this, 'Paused', 'Your run is saved, even mid-fight.\nCrew auto-tasks: idle crew fix damage, fight fires and boarders, then return to their stations.', [
      ['Resume', () => { m.destroy(); this.paused = wasPaused; this.syncBand(); }],
      [auto(), () => {
        this.c.autoCrew = !this.c.autoCrew;
        save.set('autoCrew', this.c.autoCrew);
        m.destroy();
        this.paused = wasPaused;
        this.syncBand();
        this.toastOnce(auto());
      }, PALETTE.lavender],
      ['Save & quit', () => { m.destroy(); saveRun(this.run); go(this, 'Menu'); }, PALETTE.lavender],
      ['Abandon run', () => {
        m.destroy();
        const sure = modal(this, 'Abandon run?', 'This run will end and count as a loss.', [
          ['Abandon', () => { sure.destroy(); const run = this.run; run.combat = null; run.screen = 'dead'; run.deathCause = 'You abandoned the run.'; saveRun(run); go(this, 'RunEnd', { run }); }, PALETTE.red, PALETTE.cream],
          ['Keep playing', () => { sure.destroy(); this.paused = wasPaused; this.syncBand(); }],
        ]);
      }, PALETTE.red, PALETTE.cream],
    ]);
  }
}

export { openHowTo, crewInRoom, roomOf, eff, shieldMax };

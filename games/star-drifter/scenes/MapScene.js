import { PALETTE, hex, text, button, WIDTH, HEIGHT, go, route, setBackground, helpButton, sfx, Phaser, icon, modal, outlined, toast, blocked, hullBar, tapCooldown } from './common.js';
import * as R from '../logic/run.js';
import { overrun, distance, exitBeacon } from '../logic/sector.js';
import { SECTOR_COUNT } from '../logic/data.js';
import { saveRun, tipSeen, markTip, recordRun } from '../save.js';
import * as P from './panels.js';
import { ART } from '../frames.js';

const MAP_TOP = 126;
const MAP_BOTTOM = 486;
const bx = (b) => Math.round(32 + b.x * 296);
const by = (run, b) => Math.round(MAP_BOTTOM - 14 - b.y * (MAP_BOTTOM - MAP_TOP - 40));

const TYPE_INFO = {
  start: ['Arrival point', 'Where you jumped in.'],
  fight: ['Unknown beacon', 'A ship, an event, or nothing.'],
  event: ['Unknown beacon', 'A ship, an event, or nothing.'],
  empty: ['Unknown beacon', 'A ship, an event, or nothing.'],
  store: ['Store', 'Buy fuel, missiles, repairs, weapons and crew.'],
  exit: ['Exit beacon', 'Jump from here to the next sector.'],
  flagship: ['The Iron Verdict', 'The Hegemony flagship. Destroy it to win.'],
};

/** What charted (revealed) beacons say. */
const REVEALED = {
  fight: ['Charted: hostile ship', 'Scans show an armed ship.'],
  event: ['Charted: signal', 'Something worth a look: an event.'],
  empty: ['Charted: empty space', 'Nothing here but maybe some fuel.'],
};

export class MapScene extends Phaser.Scene {
  constructor() { super('Map'); }

  init(data) { this.run = data.run; this.sel = null; this._overlays = 0; this._overlayClosedAt = undefined; this.jumping = false; }

  create() {
    const run = this.run;
    setBackground(this, '#120e14');
    P.closeAll();
    this.drawSpace();
    this.mapLayer = this.add.container(0, 0);
    this.drawFleet();
    this.drawLinks();
    this.drawBeacons();
    this.topBar();
    this.header();
    this.bottom();
    this.refresh();
    this.input.on('pointerup', (p) => this.tapMap(p));
    // Event / store / reward sheets sit on top of the map (a moment later, so the tap that
    // brought us here can't land on them).
    if (run.screen === 'map') this.tips();
    else this.time.delayedCall(160, () => this.openScreen());
  }

  ctx() {
    return {
      save: () => saveRun(this.run),
      next: () => this.afterSheet(),
      menu: () => this.menu(),
    };
  }

  openScreen() {
    const run = this.run;
    if (run.screen === 'event') P.showEvent(run, this.ctx());
    else if (run.screen === 'store') { const firstVisit = !tipSeen('store'); markTip('store'); P.showStore(run, { ...this.ctx(), firstVisit }); }
    else if (run.screen === 'reward') P.showReward(run, this.ctx());
    else this.tips();
  }

  /** A sheet finished: show the map again, or move on to a fight. */
  afterSheet() {
    const run = this.run;
    if (run.screen === 'map' && !this.revealPending()) { this.refresh(); tapCooldown(this, 300); this.tips(); return; }
    route(this, run);
  }

  /** An event charted the sector: redraw the map to show it. */
  revealPending() {
    return this.run.map.beacons.some((b) => b.known && !b.visited && REVEALED[b.type] && !this.beaconObjs.find((o) => o.b.id === b.id)?.ic);
  }

  tips() {
    const run = this.run;
    if (!tipSeen('map')) {
      markTip('map');
      const m = modal(this, 'The sector map', 'Tap a beacon linked to yours, then tap Jump. Each jump uses 1 fuel.\n\nThe red zone at the bottom is the Hegemony fleet. It moves up after every jump, so keep heading for the EXIT at the top.', [['Got it', () => m.destroy()]]);
      return;
    }
    if (!tipSeen('ship') && run.stats.wins >= 2 && run.scrap >= 25) {
      markTip('ship');
      const m = modal(this, 'Upgrades', 'You have scrap to spend! Tap Ship to upgrade systems. Shields level 4 gives you a second shield layer.', [['Got it', () => m.destroy()]]);
    }
  }

  // ------------------------------------------------------------ drawing

  drawSpace() {
    const g = this.add.graphics();
    const rnd = new Phaser.Math.RandomDataGenerator([String(this.run.seed), String(this.run.sector)]);
    for (let i = 0; i < 110; i++) g.fillStyle(0xf9f5ef, rnd.realInRange(0.1, 0.6)).fillRect(rnd.between(0, WIDTH), rnd.between(44, HEIGHT), 1, 1);
    const tint = [PALETTE.plum, PALETTE.indigo, PALETTE.leaf, PALETTE.orange, PALETTE.red, PALETTE.lavender, PALETTE.wine, PALETTE.red][(this.run.sector - 1) % 8];
    g.fillStyle(hex(tint), 0.18).fillCircle(rnd.between(40, 320), rnd.between(150, 400), rnd.between(60, 110));
    g.fillStyle(hex(tint), 0.12).fillCircle(rnd.between(40, 320), rnd.between(150, 400), rnd.between(40, 90));
  }

  rowY(row) {
    const rows = this.run.map.rows;
    return MAP_BOTTOM - 14 - (row / (rows - 1)) * (MAP_BOTTOM - MAP_TOP - 40);
  }

  drawFleet() {
    const run = this.run;
    this.fleetG = this.add.graphics();
    this.mapLayer.add(this.fleetG);
    this.fleetLabel = outlined(this, WIDTH / 2, MAP_BOTTOM - 8, '', { color: PALETTE.orange });
    this.mapLayer.add(this.fleetLabel);
    this.drawFleetZone();
    void run;
  }

  drawFleetZone() {
    const run = this.run;
    const g = this.fleetG;
    g.clear();
    const now = Math.ceil(run.fleet) - 0.5;
    const nextB = Math.ceil(run.fleet + R.fleetSpeed(run)) - 0.5;
    const yNow = Math.min(MAP_BOTTOM, this.rowY(now));
    const yNext = Math.min(MAP_BOTTOM, this.rowY(nextB));
    if (nextB > now && !R.isFinal(run)) {
      g.fillStyle(hex(PALETTE.red), 0.12).fillRect(0, yNext, WIDTH, Math.max(0, yNow - yNext));
      g.fillStyle(hex(PALETTE.red), 0.5);
      for (let x = 4; x < WIDTH; x += 12) g.fillRect(x, yNext, 6, 2);
    }
    if (now >= 0) {
      g.fillStyle(hex(PALETTE.red), 0.32).fillRect(0, yNow, WIDTH, MAP_BOTTOM - yNow + 6);
      g.fillStyle(hex(PALETTE.red)).fillRect(0, yNow, WIDTH, 3);
    }
    this.fleetLabel.setText(now >= 0 ? 'HEGEMONY FLEET' : '').setY(Math.min(MAP_BOTTOM - 8, yNow + 14));
  }

  drawLinks() {
    const run = this.run;
    const g = this.add.graphics();
    this.mapLayer.add(g);
    const seen = new Set();
    for (const b of run.map.beacons) {
      for (const l of b.links) {
        const key = Math.min(b.id, l) + '-' + Math.max(b.id, l);
        if (seen.has(key)) continue;
        seen.add(key);
        const o = run.map.beacons[l];
        const x1 = bx(b); const y1 = by(run, b); const x2 = bx(o); const y2 = by(run, o);
        const len = Math.hypot(x2 - x1, y2 - y1);
        const steps = Math.floor(len / 8);
        g.fillStyle(0xf9f5ef, 0.28);
        for (let s = 2; s < steps - 1; s++) g.fillRect(Math.round(x1 + ((x2 - x1) * s) / steps) - 1, Math.round(y1 + ((y2 - y1) * s) / steps) - 1, 2, 2);
      }
    }
    this.linkHi = this.add.graphics();
    this.mapLayer.add(this.linkHi);
  }

  drawBeacons() {
    const run = this.run;
    this.beaconObjs = [];
    for (const b of run.map.beacons) {
      const x = bx(b); const y = by(run, b);
      const ring = this.add.circle(x, y, 13, hex(PALETTE.ink), 0.8).setStrokeStyle(3, hex(PALETTE.lavender));
      this.mapLayer.add(ring);
      let ic = null;
      if (b.known && (b.type === 'store')) ic = icon(this, x, y, ART.store, 2);
      else if (b.type === 'exit') ic = icon(this, x, y, ART.exit, 2);
      else if (b.type === 'flagship') { ring.setRadius(17).setFillStyle(hex(PALETTE.wine)); ic = icon(this, x, y, ART.missile, 2); }
      else if (b.known && !b.visited && b.type === 'fight') ic = icon(this, x, y, ART.weapons, 2);
      else if (b.known && !b.visited && b.type === 'event') ic = outlined(this, x, y, '?', { color: PALETTE.sand });
      if (ic) this.mapLayer.add(ic);
      let label = null;
      if (b.type === 'exit') label = outlined(this, x, y - 25, 'EXIT', { color: PALETTE.gold });
      if (b.type === 'flagship') label = outlined(this, x, y - 30, 'FLAGSHIP', { color: PALETTE.orange });
      if (b.known && b.type === 'store') label = outlined(this, x, y - 25, 'STORE', { color: PALETTE.sand });
      if (label) this.mapLayer.add(label);
      this.beaconObjs.push({ b, ring, ic, x, y });
    }
    // You are here.
    this.here = this.add.container(0, 0);
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.ink)).fillTriangle(-9, -8, -9, 8, 11, 0);
    g.fillStyle(hex(PALETTE.lavender)).fillTriangle(-7, -5, -7, 5, 7, 0);
    g.fillStyle(hex(PALETTE.gold)).fillRect(-11, -2, 3, 4);
    this.here.add(g);
    this.mapLayer.add(this.here);
    this.tweens.add({ targets: this.here, scale: 1.15, duration: 500, yoyo: true, repeat: -1 });
    this.pulse = [];
  }

  topBar() {
    const run = this.run;
    this.add.rectangle(0, 0, WIDTH, 44, hex(PALETTE.ink)).setOrigin(0).setDepth(40);
    const menu = button(this, 24, 22, 40, 36, '', () => { if (!blocked(this)) this.menu(); }, { fill: PALETTE.lavender }).setDepth(41);
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.night));
    for (let i = 0; i < 3; i++) g.fillRect(-8, -7 + i * 6, 16, 3);
    menu.face.add(g);
    this.hull = hullBar(this, 50, 22, 96, 20, 41);
    this.add.image(162, 22, 'it', '0,0').setScale(2).setDepth(41);
    this.scrapT = text(this, 172, 22, '', { origin: [0, 0.5], color: PALETTE.gold }).setDepth(41);
    this.add.image(218, 22, 'ts', '2,0').setScale(2).setDepth(41);
    this.fuelT = text(this, 228, 22, '', { origin: [0, 0.5] }).setDepth(41);
    this.add.image(266, 22, 'f2', '0,7').setScale(2).setDepth(41);
    this.misT = text(this, 274, 22, '', { origin: [0, 0.5] }).setDepth(41);
    helpButton(this, WIDTH - 22, 22);
    void run;
  }

  header() {
    const run = this.run;
    this.add.rectangle(0, 44, WIDTH, 52, hex(PALETTE.night), 0.85).setOrigin(0).setDepth(39);
    const name = R.isFinal(run) ? 'Final sector' : `Sector ${run.sector} of ${SECTOR_COUNT - 1}`;
    text(this, WIDTH / 2, 58, `${name}: ${R.sectorName(run)}`, { color: PALETTE.gold }).setDepth(40);
    this.fleetT = text(this, WIDTH / 2, 80, '', { color: PALETTE.lavender }).setDepth(40);
  }

  bottom() {
    this.add.rectangle(0, MAP_BOTTOM + 8, WIDTH, HEIGHT - MAP_BOTTOM - 8, hex(PALETTE.ink), 0.9).setOrigin(0).setDepth(39);
    this.infoTitle = text(this, 14, MAP_BOTTOM + 22, '', { origin: [0, 0.5], color: PALETTE.gold }).setDepth(40);
    this.infoText = text(this, 14, MAP_BOTTOM + 40, '', { origin: [0, 0], wrap: WIDTH - 28, align: 'left' }).setDepth(40);
    this.shipBtn = button(this, 52, 610, 88, 46, 'Ship', () => this.openShip(), { fill: PALETTE.lavender }).setDepth(40);
    this.jumpWide = button(this, 230, 610, 244, 46, 'Jump', () => this.doJump(), { fill: PALETTE.gold }).setDepth(40);
    this.jumpBtn = button(this, 166, 610, 124, 46, 'Jump', () => this.doJump(), { fill: PALETTE.gold }).setDepth(40);
    this.nextBtn = button(this, 296, 610, 116, 46, 'Next sector', () => this.doNext(), { fill: PALETTE.leaf, color: PALETTE.cream }).setDepth(40);
  }

  // ------------------------------------------------------------ state

  refresh() {
    const run = this.run;
    this.hull.set(run.ship.hull, run.ship.maxHull);
    this.scrapT.setText(String(run.scrap));
    this.fuelT.setText(String(run.fuel)).setColor(run.fuel <= 2 ? PALETTE.orange : PALETTE.cream);
    this.misT.setText(String(run.ship.missiles));
    const cur = R.beacon(run);
    this.here.setPosition(bx(cur), by(run, cur));
    const links = new Set(cur.links);
    this.pulse.forEach((t) => t.stop());
    this.pulse = [];
    for (const o of this.beaconObjs) {
      const { b, ring } = o;
      ring.setScale(1);
      const over = overrun(run.map, run.fleet, b) && b.type !== 'flagship';
      let stroke = PALETTE.lavender;
      if (b.visited) stroke = PALETTE.indigo;
      if (over) stroke = PALETTE.red;
      if (links.has(b.id)) stroke = this.sel === b.id ? PALETTE.cream : PALETTE.gold;
      ring.setStrokeStyle(this.sel === b.id ? 4 : 3, hex(stroke));
      ring.setFillStyle(hex(b.type === 'flagship' ? PALETTE.wine : b.visited ? PALETTE.night : PALETTE.ink), b.visited ? 0.9 : 0.8);
      if (links.has(b.id)) this.pulse.push(this.tweens.add({ targets: ring, scale: 1.18, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    }
    // Highlight the selected route.
    this.linkHi.clear();
    if (this.sel !== null) {
      const o = run.map.beacons[this.sel];
      this.linkHi.lineStyle(3, hex(PALETTE.gold), 0.9).lineBetween(bx(cur), by(run, cur), bx(o), by(run, o));
    }
    this.drawFleetZone();
    const rowsAhead = Math.ceil(run.fleet) - 0.5 - cur.row;
    if (R.isFinal(run)) this.fleetT.setText('The fleet is massing behind you.');
    else {
      const gap = cur.row - (Math.ceil(run.fleet) - 0.5);
      const jumps = Math.max(0, Math.ceil((cur.row + 0.5 - run.fleet) / R.fleetSpeed(run)));
      this.fleetT.setText(gap <= 0 ? 'The fleet is on top of you!' : `Fleet reaches this beacon in ${jumps} jump${jumps === 1 ? '' : 's'}`)
        .setColor(jumps <= 1 ? PALETTE.orange : PALETTE.lavender);
    }
    void rowsAhead;
    // Bottom info and buttons.
    const atExit = R.canLeaveSector(run);
    if (this.sel !== null) {
      const b = run.map.beacons[this.sel];
      const [title, desc] = this.describe(b);
      this.infoTitle.setText(title);
      this.infoText.setText(desc);
    } else if (run.note && !atExit) {
      this.infoTitle.setText(run.fuel < 1 ? 'Out of fuel!' : 'Ship\'s log');
      this.infoText.setText(run.fuel < 1 ? `${run.note} Tap Drift to scrape together 1 fuel.` : run.note);
    } else if (atExit) {
      this.infoTitle.setText('Exit beacon');
      this.infoText.setText('Tap Next sector to jump on (the relay gives you 2 fuel), or tap a beacon to keep exploring.');
    } else if (run.fuel < 1) {
      this.infoTitle.setText('Out of fuel!');
      this.infoText.setText('Tap Drift to scrape together 1 fuel. The fleet moves closer while you wait.');
    } else {
      this.infoTitle.setText(TYPE_INFO[cur.type] && cur.type !== 'fight' && cur.type !== 'event' && cur.type !== 'empty' ? TYPE_INFO[cur.type][0] : 'Pick a beacon');
      this.infoText.setText('Tap a gold beacon linked to yours, then tap Jump.');
    }
    const canJump = this.sel !== null && !R.jumpBlock(run, this.sel);
    for (const b of [this.jumpBtn, this.jumpWide]) b.setLabel(run.fuel < 1 ? 'Drift' : 'Jump').setEnabled(run.fuel < 1 ? true : canJump);
    this.nextBtn.setVisible(atExit).setEnabled(atExit);
    this.jumpBtn.setVisible(atExit);
    this.jumpWide.setVisible(!atExit);
    if (!atExit) this.jumpBtn.setEnabled(false); else this.jumpWide.setEnabled(false);
  }

  describe(b) {
    const run = this.run;
    const cur = R.beacon(run);
    const linked = cur.links.includes(b.id);
    const over = overrun(run.map, run.fleet, b) && b.type !== 'flagship';
    const overNext = !over && overrun(run.map, run.fleet + R.fleetSpeed(run), b) && b.type !== 'flagship';
    let [title, desc] = TYPE_INFO[b.type] || TYPE_INFO.fight;
    if (b.known && !b.visited && REVEALED[b.type]) [title, desc] = REVEALED[b.type];
    if (b.visited && !['store', 'exit', 'start', 'flagship'].includes(b.type)) { title = 'Visited beacon'; desc = 'Nothing new here.'; }
    if (b.id === cur.id) { title = 'You are here'; }
    if (over) desc = 'The Hegemony fleet holds this beacon. Jumping here means a hard fight.';
    else if (overNext) desc += ' The fleet will be here after this jump!';
    if (!linked && b.id !== cur.id) {
      const d = distance(run.map, cur.id, b.id);
      desc = `Not linked to your beacon (${d} jumps away). ${desc}`;
    }
    return [title, desc];
  }

  tapMap(p) {
    if (blocked(this) || this._leaving || this.jumping) return;
    if (p.y < MAP_TOP - 6 || p.y > MAP_BOTTOM + 4) return;
    const run = this.run;
    let best = null; let bestD = 30;
    for (const o of this.beaconObjs) {
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      if (d < bestD) { best = o; bestD = d; }
    }
    if (!best) return;
    const b = best.b;
    if (b.id === R.beacon(run).id) { sfx('tap'); this.sel = null; this.refresh(); const [t, d] = this.describe(b); this.infoTitle.setText(t); this.infoText.setText(d); return; }
    sfx('select');
    this.sel = b.id;
    this.refresh();
  }

  doJump() {
    const run = this.run;
    if (blocked(this) || this._leaving || this.jumping) return;
    if (run.fuel < 1) {
      if (!R.drift(run)) return;
      sfx('thud');
      saveRun(run);
      if (run.screen !== 'map') { route(this, run); return; }
      this.refresh();
      return;
    }
    if (this.sel === null || R.jumpBlock(run, this.sel)) return;
    const to = run.map.beacons[this.sel];
    this.jumping = true;
    sfx('power');
    this.tweens.add({
      targets: this.here, x: bx(to), y: by(run, to), duration: 380, ease: 'Sine.easeIn',
      onComplete: () => {
        R.jump(run, to.id);
        this.sel = null;
        saveRun(run);
        if (run.screen === 'map') { this.jumping = false; this.refresh(); return; }
        if (run.screen === 'combat') { sfx('thud'); route(this, run); return; }
        this.jumping = false;
        this.refresh();
        this.openScreen();
      },
    });
  }

  doNext() {
    const run = this.run;
    if (blocked(this) || this._leaving || this.jumping || !R.canLeaveSector(run)) return;
    this.jumping = true;
    sfx('win');
    R.nextSector(run);
    saveRun(run);
    this.cameras.main.flash(250, 249, 245, 239);
    this.time.delayedCall(260, () => route(this, run));
  }

  openShip() {
    if (blocked(this) || this._leaving || this.jumping) return;
    P.showShip(this.run, { save: () => saveRun(this.run), onClose: () => this.refresh() });
  }

  menu() {
    const run = this.run;
    if (this._overlays) return;
    const m = modal(this, 'Paused', `${run.ship.name}, ${run.mode === 'cruise' ? 'Cruise' : 'Normal'}. Sector ${run.sector}.\nYour run is saved automatically.`, [
      ['Resume', () => m.destroy()],
      ['Save & quit', () => { m.destroy(); P.closeAll(); saveRun(run); go(this, 'Menu'); }, PALETTE.lavender],
      ['Abandon run', () => {
        m.destroy();
        const sure = modal(this, 'Abandon run?', 'This run will end and count as a loss.', [
          ['Abandon', () => { sure.destroy(); P.closeAll(); run.screen = 'dead'; run.deathCause = 'You abandoned the run.'; saveRun(run); go(this, 'RunEnd', { run }); }, PALETTE.red, PALETTE.cream],
          ['Keep playing', () => sure.destroy()],
        ], { depth: 120 });
      }, PALETTE.red, PALETTE.cream],
    ], { depth: 120 });
    // Sheets underneath stay put; the modal sits above them by hiding them for a moment.
    if (P.anyOpen()) { document.querySelectorAll('.sd-wrap').forEach((el) => { el.style.display = 'none'; }); m.once('destroy', () => document.querySelectorAll('.sd-wrap').forEach((el) => { el.style.display = ''; })); }
  }
}

export { recordRun, exitBeacon };

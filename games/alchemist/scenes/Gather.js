import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { sfx } from '../../../shared/core/sfx.js';
import { WIDTH, HEIGHT, go, setBackground, store, persist, header, statBar, toast, once } from './common.js';
import { showTip, showConfirm, anyOpen, closeAll } from './panels.js';
import * as G from '../logic/game.js';
import { AREAS, AREA_ORDER, INGREDIENTS } from '../logic/data.js';
import { SPOT_ART } from '../art.js';
import { earn } from '../trophies.js';
import { playMusic } from '../music.js';

const FIELD_TOP = 134;
const FIELD_BOTTOM = 574;

export class Gather extends Phaser.Scene {
  constructor() { super('Gather'); }

  create(data = {}) {
    closeAll();
    this.input.enabled = true;
    this.s = store.s;
    if (!this.s) { this.scene.start('Title'); return; }
    setBackground(this, PALETTE.night);
    this.area = data.area || this.s.lastArea || 'garden';
    if (!this.s.areas[this.area]) this.area = 'garden';
    this.field = this.add.container(0, 0);
    header(this, 'Gathering', () => this.back());
    this.bar = statBar(this);
    this.tabs = [];
    AREA_ORDER.forEach((a, i) => {
      const b = button(this, 62 + i * 118, 110, 112, 40, AREAS[a].name, () => this.pickArea(a));
      this.tabs.push([a, b]);
    });
    // footer
    this.add.rectangle(0, FIELD_BOTTOM, WIDTH, HEIGHT - FIELD_BOTTOM, hex('#2b2238')).setOrigin(0).setDepth(10);
    this.add.rectangle(0, FIELD_BOTTOM, WIDTH, 3, hex(PALETTE.ink)).setOrigin(0).setDepth(10);
    text(this, 14, 594, 'Picks left', { origin: [0, 0.5], color: PALETTE.cream }).setDepth(11);
    this.pips = this.add.container(0, 0).setDepth(11);
    this.add.existing(button(this, 284, 612, 140, 44, 'To the shop', () => this.back(), { fill: PALETTE.gold }).setDepth(11));
    this.drawArea();
    if (!this.s.tut.gatherTip) {
      this.s.tut.gatherTip = true; persist();
      this.time.delayedCall(250, () => showTip('Gathering', `<p class="al-p">Tap a plant to pick one ingredient. The dots under it show how many picks it has left today.</p>
        <p class="al-p">Your basket allows <b>${G.staminaMax(this.s)} picks</b> each morning, so choose well. Everything grows back overnight.</p>`));
    }
  }

  back() { persist(); go(this, 'Shop'); }

  pickArea(a) {
    if (anyOpen() || a === this.area) return;
    const info = G.areaInfo(this.s, a);
    if (!info.open) {
      if (info.can) {
        showConfirm(`Open the ${AREAS[a].name}?`, `It costs ${info.cost} coins (you have ${this.s.coins}).`, `Pay ${info.cost}`, () => {
          if (G.unlockArea(this.s, a).ok) { persist(); sfx('power'); earn(a); this.area = a; this.drawArea(); }
        });
      } else {
        sfx('error');
        toast(this, `The ${AREAS[a].name} is locked. ${info.why}.`, 360);
      }
      return;
    }
    sfx('select');
    this.area = a;
    this.drawArea();
  }

  drawArea() {
    const s = this.s;
    s.lastArea = this.area;
    playMusic(this.area === 'cave' ? 'cave' : 'gather');
    this.field.removeAll(true);
    this.spotViews = {};
    for (const [a, b] of this.tabs) {
      const open = s.areas[a];
      b.body.setFillStyle(hex(a === this.area ? PALETTE.gold : open ? PALETTE.lavender : PALETTE.indigo));
      b.label.setColor(open || a === this.area ? PALETTE.night : PALETTE.lavender);
      if (b.lock) b.lock.destroy();
      if (!open) { b.lock = this.add.image(b.x + 40, b.y, 'lock').setScale(2).setDepth(5); } else b.lock = null;
    }
    this.background(this.area);
    for (const sp of AREAS[this.area].spots) this.drawSpot(sp);
    this.update2();
  }

  background(area) {
    const f = this.field;
    const g = this.add.graphics();
    f.add(g);
    const H = FIELD_BOTTOM - FIELD_TOP;
    if (area === 'garden') {
      for (let y = FIELD_TOP; y < FIELD_BOTTOM; y += 32) for (let x = 0; x < WIDTH; x += 32) f.add(this.add.image(x, y, 'lab', 'grass').setOrigin(0).setScale(2));
      const rnd = new Phaser.Math.RandomDataGenerator(['garden']);
      for (let i = 0; i < 14; i++) f.add(this.add.image(rnd.between(10, WIDTH - 10), rnd.between(FIELD_TOP + 10, FIELD_BOTTOM - 10), 'adv', rnd.pick(['daisy', 'daisies'])).setScale(2));
      // a fence along the top and the shop's back door
      const fg = this.add.graphics();
      fg.fillStyle(0x8a5a36).fillRect(0, FIELD_TOP + 8, WIDTH, 6).fillRect(0, FIELD_TOP + 24, WIDTH, 6);
      for (let x = 6; x < WIDTH; x += 30) fg.fillStyle(0x6a3e26).fillRect(x, FIELD_TOP, 8, 38);
      f.add(fg);
    } else if (area === 'forest') {
      g.fillStyle(0x3e6a34).fillRect(0, FIELD_TOP, WIDTH, H);
      for (let y = FIELD_TOP; y < FIELD_BOTTOM; y += 32) for (let x = 0; x < WIDTH; x += 32) f.add(this.add.image(x, y, 'lab', 'grass').setOrigin(0).setScale(2).setTint(0x7a9a7a));
      for (let x = 0; x < WIDTH; x += 64) f.add(this.add.image(x, FIELD_TOP, 'lab', 'canopy').setOrigin(0).setScale(2));
      const rnd = new Phaser.Math.RandomDataGenerator(['forest']);
      for (const [x, y] of [[20, 330], [340, 250], [150, 420], [330, 420], [10, 500]]) f.add(this.add.image(x, FIELD_TOP + y - 120, 'lab', 'treeBig').setScale(2).setOrigin(0.5, 1));
      for (let i = 0; i < 8; i++) f.add(this.add.image(rnd.between(10, WIDTH - 10), rnd.between(FIELD_TOP + 80, FIELD_BOTTOM - 10), 'adv', 'shrub').setScale(2).setAlpha(0.8));
    } else {
      for (let y = FIELD_TOP; y < FIELD_BOTTOM; y += 64) for (let x = 0; x < WIDTH; x += 64) f.add(this.add.image(x, y, 'lab', 'caveFloor').setOrigin(0).setScale(2));
      for (let x = 0; x < WIDTH; x += 128) f.add(this.add.image(x, FIELD_TOP, 'lab', 'caveWall').setOrigin(0).setScale(2));
      f.add(this.add.image(WIDTH - 20, FIELD_BOTTOM - 4, 'vein').setCrop(0, 0, 96, 96).setOrigin(0.5, 1).setScale(1.2).setAlpha(0.9));
      const rnd = new Phaser.Math.RandomDataGenerator(['cave']);
      for (let i = 0; i < 6; i++) f.add(this.add.image(rnd.between(10, WIDTH - 10), rnd.between(FIELD_TOP + 110, FIELD_BOTTOM - 20), 'lab', 'crystalSpikes').setScale(2).setAlpha(0.7));
    }
  }

  drawSpot(sp) {
    const s = this.s;
    const x = sp.x; const y = FIELD_TOP + 40 + sp.y;
    const [sheet, frame, scale, picked, tint] = SPOT_ART[sp.art];
    const v = { sp };
    if (sp.art === 'pond') {
      const g = this.add.graphics();
      g.fillStyle(hex(PALETTE.ink)).fillEllipse(x, y - 14, 92, 46);
      g.fillStyle(0x3a70c0).fillEllipse(x, y - 14, 86, 40);
      g.fillStyle(0x7ab0f0).fillEllipse(x - 14, y - 20, 30, 8);
      this.field.add(g);
      v.art = this.add.image(x, y - 10, 'lab', 'crystalSpikes').setScale(1.5).setTint(0xb0f0e0).setAlpha(0.8);
    } else {
      this.field.add(this.add.ellipse(x, y, 64, 18, 0x000000, 0.25));
      v.art = this.add.image(x, y, sheet, frame).setOrigin(0.5, 1).setScale(scale);
      if (tint) v.art.setTint(tint);
    }
    v.frames = sp.art === 'pond' ? ['lab', 'crystalSpikes', 'crystalSpikes'] : [sheet, frame, picked];
    this.field.add(v.art);
    v.icon = this.add.image(x, y - 76, 'ing', INGREDIENTS[sp.ing].icon).setScale(2);
    v.iconBg = this.add.circle(x, y - 76, 20, 0xf9f5ef, 0.85).setStrokeStyle(3, hex(PALETTE.ink));
    this.field.add([v.iconBg, v.icon]);
    this.tweens.add({ targets: [v.icon, v.iconBg], y: '-=4', duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: (sp.x * 7) % 500 });
    v.pips = this.add.container(x, y + 12);
    this.field.add(v.pips);
    v.label = text(this, x, y + 30, INGREDIENTS[sp.ing].name, { color: PALETTE.cream });
    v.labelBg = this.add.rectangle(x, y + 30, v.label.width + 10, 22, hex(PALETTE.ink), 0.6);
    this.field.add([v.labelBg, v.label]);
    const zone = this.add.zone(x, y - 40, 92, 120).setInteractive({ useHandCursor: true });
    zone.on('pointerup', () => this.tapSpot(sp.id));
    this.field.add(zone);
    if (sp.guard) {
      const gx = x + (x > 200 ? -56 : 56); const gy = y + 6;
      v.guard = this.add.sprite(gx, gy, sp.guard, '0_0').setOrigin(0.5, 1).setScale(sp.guard === 'golem' ? 2 : 3).play(`${sp.guard}-idle`);
      v.hearts = this.add.container(gx, gy - (sp.guard === 'golem' ? 66 : 56));
      const gz = this.add.zone(gx, gy - 30, 76, 84).setInteractive({ useHandCursor: true });
      gz.on('pointerup', () => this.tapGuard(sp.id));
      this.field.add([v.guard, v.hearts, gz]);
      v.guardZone = gz;
    }
    this.spotViews[sp.id] = v;
  }

  update2() {
    const s = this.s;
    this.bar.update(s, `Basket ${G.staminaMax(s) - s.stamina}/${G.staminaMax(s)}`);
    this.pips.removeAll(true);
    const max = G.staminaMax(s);
    for (let i = 0; i < max; i++) this.pips.add(this.add.image(108 + i * 15, 594, i < s.stamina ? 'pip' : 'pipOff').setScale(3));
    for (const v of Object.values(this.spotViews)) {
      const left = s.spots[v.sp.id] || 0;
      const guarded = s.guards[v.sp.id] > 0;
      v.pips.removeAll(true);
      for (let i = 0; i < v.sp.picks; i++) v.pips.add(this.add.image((i - (v.sp.picks - 1) / 2) * 13, 0, i < left ? 'pip' : 'pipOff').setScale(3));
      v.art.setFrame(left > 0 ? v.frames[1] : v.frames[2]);
      v.icon.setAlpha(left > 0 ? 1 : 0.3);
      v.iconBg.setAlpha(left > 0 ? 0.85 : 0.3);
      if (v.guard) {
        v.guard.setVisible(guarded);
        v.guardZone.input.enabled = guarded;
        v.hearts.removeAll(true);
        if (guarded) for (let i = 0; i < s.guards[v.sp.id]; i++) v.hearts.add(this.add.image((i - (s.guards[v.sp.id] - 1) / 2) * 16, 0, 'rep').setScale(3));
      }
    }
  }

  tapSpot(id) {
    if (anyOpen()) return;
    const s = this.s;
    const v = this.spotViews[id];
    const r = G.gather(s, id);
    if (!r.ok) {
      sfx('error');
      const msg = {
        guarded: `A ${v.sp.guard} guards it! Tap the ${v.sp.guard} to shoo it away.`,
        empty: 'Nothing left here today. It grows back overnight.',
        tired: 'Your basket is full for today. A bigger basket gives more picks.',
        closed: 'Gathering is for the morning.',
      }[r.why] || 'You can\'t pick that.';
      toast(this, msg, 360);
      if (r.why === 'guarded') this.tweens.add({ targets: v.guard, x: v.guard.x + 4, duration: 50, yoyo: true, repeat: 3 });
      return;
    }
    sfx('place');
    if (!s.tut.gathered) s.tut.gathered = true;
    persist();
    // the picked ingredient flies up to the basket
    const fly = this.add.image(v.icon.x, v.icon.y, 'ing', INGREDIENTS[r.ing].icon).setScale(2).setDepth(20);
    this.tweens.add({ targets: fly, x: 110 + (G.staminaMax(s) - 1) * 8, y: 594, scale: 1, alpha: 0.4, duration: 450, ease: 'Sine.easeIn', onComplete: () => fly.destroy() });
    const t = text(this, v.icon.x, v.icon.y - 30, `+1 (${s.inv[r.ing]})`, { color: PALETTE.gold }).setDepth(21);
    this.tweens.add({ targets: t, y: t.y - 24, alpha: 0, duration: 800, onComplete: () => t.destroy() });
    this.tweens.add({ targets: v.art, scaleX: v.art.scaleX * 1.1, scaleY: v.art.scaleY * 0.9, duration: 80, yoyo: true });
    this.update2();
    if (s.stamina === 0) this.time.delayedCall(500, () => toast(this, 'Basket full! Head back and brew.', 360));
  }

  tapGuard(id) {
    if (anyOpen() || !once(this, 180)) return;
    const s = this.s;
    const v = this.spotViews[id];
    const r = G.shoo(s, id);
    if (!r.ok) {
      sfx('error');
      if (r.why === 'tired') toast(this, 'No picks left to shoo it with today.', 360);
      return;
    }
    persist();
    sfx('hit');
    const kind = v.sp.guard;
    if (r.fled) {
      v.guard.play(`${kind}-flee`);
      this.tweens.add({ targets: v.guard, x: -60, duration: 900, onComplete: () => { v.guard.setX(v.guard.x); this.update2(); } });
      toast(this, `The ${kind} runs off! The treasure is yours to pick.`, 360);
      v.hearts.removeAll(true);
      v.guardZone.input.enabled = false;
      sfx('power');
    } else {
      v.guard.play(`${kind}-hit`);
      v.guard.once('animationcomplete', () => { if (v.guard.visible) v.guard.play(`${kind}-idle`); });
      this.update2();
    }
    this.bar.update(s, `Basket ${G.staminaMax(s) - s.stamina}/${G.staminaMax(s)}`);
  }
}

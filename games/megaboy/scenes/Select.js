import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { LANDSCAPE } from '../../../shared/core/boot.js';
import { sfx } from '../../../shared/core/sfx.js';
import { STAGES, ROBOT_STAGES } from '../logic/stages.js';
import { BOSSES } from '../logic/bosses.js';
import { WEAPONS, WEAPON_ORDER } from '../logic/constants.js';
import { fortressStage, suggestion, robotsBeaten } from '../logic/progress.js';
import { loadProgress, go, header, escBack, guardTaps } from './common.js';
import { save } from '../save.js';
import { playMusic } from '../music.js';

const { WIDTH } = LANDSCAPE;
export const CARD = { w: 196, h: 104, xs: [112, 320, 528], ys: [112, 228] };

export class Select extends Phaser.Scene {
  constructor() { super('Select'); }

  create() {
    this._leaving = false;
    guardTaps(this);
    this.cameras.main.setBackgroundColor(PALETTE.night).fadeIn(200);
    document.body.style.background = PALETTE.night;
    playMusic('select');
    const p = loadProgress();
    this.prog = p;
    header(this, () => go(this, 'Title'));
    escBack(this, () => go(this, 'Title'));
    text(this, WIDTH / 2, 26, 'STAGE SELECT', { size: 32, color: PALETTE.gold });
    const tip = suggestion(p);
    ROBOT_STAGES.forEach((id, i) => this.card(id, CARD.xs[i % 3], CARD.ys[Math.floor(i / 3)], p, id === tip && robotsBeaten(p) < 2));

    // bottom strip: lives, E-tanks, weapons, the fortress
    this.add.image(26, 318, 'life').setScale(2);
    text(this, 40, 318, `x${p.lives}`, { origin: [0, 0.5] });
    this.add.image(90, 318, 'etank').setScale(2);
    text(this, 104, 318, `x${p.etanks}`, { origin: [0, 0.5] });
    const owned = WEAPON_ORDER.filter((k) => k !== 'buster' && p.weapons.includes(k));
    owned.forEach((k, i) => this.add.image(154 + i * 24, 318, `icon-${k}`).setScale(2));
    const fort = fortressStage(p);
    const fx = 528;
    if (fort) {
      const b = button(this, fx, 318, CARD.w, 48, fort === 'fort1' ? 'FORTRESS' : 'FORTRESS 2', () => this.pick(fort), { fill: PALETTE.red, color: PALETTE.cream });
      this.tweens.add({ targets: b, scale: 1.04, yoyo: true, repeat: -1, duration: 500 });
    } else {
      text(this, fx, 318, `Fortress: beat ${6 - robotsBeaten(p)} more`, { color: PALETTE.lavender });
    }
    if (!save.get('selectTip') && robotsBeaten(p) === 0) {
      save.set('selectTip', true);
      this.time.delayedCall(400, () => this.tipBox('Pick any stage. FOUNDRY is a good first one.'));
    }
  }

  card(id, x, y, p, suggest) {
    const st = STAGES[id]; const boss = BOSSES[st.boss];
    const beaten = p.beaten.includes(st.boss);
    const c = this.add.container(x, y);
    const bg = this.add.graphics();
    const draw = (down) => {
      bg.clear();
      bg.fillStyle(hex(PALETTE.ink)).fillRect(-CARD.w / 2, -CARD.h / 2 + 4, CARD.w, CARD.h);
      bg.fillStyle(hex(suggest ? PALETTE.gold : beaten ? PALETTE.leaf : PALETTE.lavender)).fillRect(-CARD.w / 2, -CARD.h / 2 + (down ? 3 : 0), CARD.w, CARD.h);
      bg.fillStyle(hex(beaten ? '#26301e' : PALETTE.indigo)).fillRect(-CARD.w / 2 + 4, -CARD.h / 2 + 4 + (down ? 3 : 0), CARD.w - 8, CARD.h - 8);
    };
    draw(false);
    c.add(bg);
    const spr = this.add.sprite(-58, 26, `boss-${st.boss}`).setOrigin(0.5, 20 / 24).setScale(3).play(`boss-${st.boss}-idle`);
    if (beaten) spr.setTint(0x8a8f8a);
    c.add(spr);
    c.add(text(this, 34, -28, boss.name, { size: 16, color: PALETTE.cream }));
    c.add(text(this, 34, -6, st.name, { color: PALETTE.lavender }));
    let status = beaten ? 'CLEAR' : suggest ? 'Try me first' : '';
    if (!beaten && p.weakSeen.includes(st.boss)) status = `Weak: ${WEAPONS[boss.weak].name.split(' ')[0]}`;
    if (status) c.add(text(this, 34, 22, status, { color: beaten ? PALETTE.sand : PALETTE.gold }));
    if (beaten) c.add(this.add.image(34, 40, `icon-${boss.weapon}`).setScale(2));
    c.setSize(CARD.w, CARD.h + 4).setInteractive({ useHandCursor: true });
    let down = false;
    c.on('pointerdown', () => { down = true; draw(true); });
    c.on('pointerout', () => { down = false; draw(false); });
    c.on('pointerup', () => { if (!down) return; down = false; draw(false); this.pick(id); });
  }

  pick(id) {
    if (this._leaving || this.tip) return;
    sfx('select');
    go(this, 'Stage', { stage: id });
  }

  tipBox(msg) {
    const c = this.add.container(0, 0).setDepth(50);
    this.tip = c;
    c.add(this.add.rectangle(0, 0, WIDTH, 360, hex(PALETTE.ink), 0.55).setOrigin(0).setInteractive());
    c.add(panel(this, WIDTH / 2 - 190, 110, 380, 140));
    c.add(text(this, WIDTH / 2, 150, msg, { color: PALETTE.cream, wrap: 340 }));
    c.add(button(this, WIDTH / 2, 210, 140, 42, 'OK', () => { c.destroy(); this.time.delayedCall(50, () => { this.tip = null; }); }, { fill: PALETTE.gold }));
  }
}

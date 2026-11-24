import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { WIDTH, HEIGHT } from './common.js';
import { sfx } from '../../../shared/core/sfx.js';
import { modal, setBackground, openHowTo, go } from './common.js';
import { kitTexture, ANIM } from '../sprites.js';
import { GOAL_W, PEN_D } from '../logic/constants.js';
import { teamById, keeperKits } from '../logic/teams.js';
import {
  newShootout, nextKicker, recordKick, resolveKick, cpuKick, cpuDive, goals,
} from '../logic/penalties.js';
import { applyResult } from '../flow.js';
import { sound } from '../sound.js';

// Drawn at 2x like the match. Goal line at GY, the mouth is GOAL_W * 2 wide.
const S = 2;
const GY = 140;
// The goal and kick play out on the left; the tally, messages and buttons sit in a right column.
const CX = 210;
const RX = 530;
const MOUTH = GOAL_W * S;
const SPOT_Y = GY + PEN_D * S;
const AIM_RANGE = 1.18;   // the sweeping marker goes a little past the posts

/** Penalty shoot-out after a drawn Cup or Endless match. */
export class Penalties extends Phaser.Scene {
  constructor() { super('Penalties'); }

  init({ data, score }) {
    this.matchInfo = data;
    this.score = score;
    this.home = teamById(data.home);
    this.away = teamById(data.away);
    this.so = newShootout(Math.random() < 0.5 ? 0 : 1);
    this.busy = false;
  }

  create() {
    setBackground(this, '#4aa33a');
    this.add.tileSprite(0, 0, WIDTH, HEIGHT, 'grassTile').setOrigin(0).setTileScale(S);
    const g = this.add.graphics();
    g.fillStyle(0xffffff);
    g.fillRect(0, GY, 420, S);                                           // goal line
    g.fillRect(CX - 68 * S, GY, S, 52 * S);                       // box sides
    g.fillRect(CX + 68 * S, GY, S, 52 * S);
    g.fillRect(CX - 40 * S, GY, S, 18 * S);                       // six-yard box
    g.fillRect(CX + 40 * S, GY, S, 18 * S);
    g.fillRect(CX - 40 * S, GY + 18 * S, 80 * S + S, S);
    g.fillRect(CX - S, SPOT_Y - S, S * 2, S * 2);                 // spot
    this.add.image(CX, GY + S, 'goalTop').setOrigin(0.5, 1).setScale(S);

    const [gk0, gk1] = keeperKits(this.home, this.away);
    this.kits = {
      shooter: [kitTexture(this, this.home.shirt, this.home.shorts, 1), kitTexture(this, this.away.shirt, this.away.shorts, 3)],
      keeper: [kitTexture(this, gk0, '#1c1618', 0), kitTexture(this, gk1, '#1c1618', 2)],
    };
    this.keeper = this.add.image(CX, GY + 4, this.kits.keeper[1], '0_36').setOrigin(0.5, 14 / 16).setScale(S);
    this.shooter = this.add.image(CX, SPOT_Y + 26, this.kits.shooter[0], '4_1').setOrigin(0.5, 14 / 16).setScale(S);
    this.ballShadow = this.add.ellipse(CX, SPOT_Y, 10, 4, 0x000000, 0.35);
    this.ball = this.add.image(CX, SPOT_Y - 4, 'ball').setScale(S);
    this.marker = this.add.graphics().setDepth(10);

    // Top bar, then the right column: kick tally, messages, buttons.
    this.add.rectangle(0, 0, WIDTH, 40, hex(PALETTE.night), 0.92).setOrigin(0);
    text(this, CX, 20, 'Penalties', { size: 32, color: PALETTE.cream });
    button(this, WIDTH - 26, 20, 40, 34, '?', () => openHowTo(this), { size: 32, fill: PALETTE.gold });
    this.add.rectangle(420, 40, WIDTH - 420, HEIGHT - 40, hex(PALETTE.ink), 0.6).setOrigin(0);
    this.tally = this.add.graphics();
    this.rows = [0, 1].map((side) => {
      const t = side === 0 ? this.home : this.away;
      text(this, 430, 64 + side * 34, t.short, { color: PALETTE.cream, origin: [0, 0.5] });
      return text(this, WIDTH - 10, 64 + side * 34, '0', { size: 32, color: PALETTE.gold, origin: [1, 0.5] });
    });
    this.sdLabel = text(this, 526, 122, 'Sudden death', { color: PALETTE.orange }).setVisible(false);
    text(this, RX, 148, `Full time ${this.score[0]} - ${this.score[1]}`, { color: PALETTE.cream });
    this.msg = text(this, RX, 188, '', { size: 32, color: PALETTE.gold });
    this.add.rectangle(0, 318, 420, 30, hex(PALETTE.ink), 0.45).setOrigin(0);
    this.help = text(this, CX, 333, '', { color: PALETTE.cream });

    // Controls: one Shoot button when you take a kick, Left / Stay / Right when you keep.
    this.shootBtn = button(this, RX, 270, 180, 72, 'SHOOT', () => this.strike(), { size: 32, fill: PALETTE.red, color: PALETTE.cream });
    this.diveBtns = [-1, 0, 1].map((d, i) => button(this, RX - 68 + i * 68, 270, 64, 72, ['LEFT', 'STAY', 'RIGHT'][i], () => this.pickDive(d), { fill: PALETTE.lavender }));
    // Nothing to press until the first kick is set up.
    this.shootBtn.setVisible(false);
    this.diveBtns.forEach((b) => b.setVisible(false));
    this.input.keyboard?.on('keydown-SPACE', () => this.strike());
    this.input.keyboard?.on('keydown-LEFT', () => this.pickDive(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.pickDive(0));
    this.input.keyboard?.on('keydown-RIGHT', () => this.pickDive(1));
    window.__pens = this;
    this.drawTally();
    this.time.delayedCall(500, () => this.nextKick());
  }

  drawTally() {
    // Five slots per row. In sudden death the window slides to the latest kicks (both rows stay
    // in step); the big number on the right is always the full total.
    const g = this.tally;
    g.clear();
    const longest = Math.max(this.so.kicks[0].length, this.so.kicks[1].length);
    const first = Math.max(0, Math.max(5, longest) - 5);
    this.sdLabel.setVisible(first > 0);
    for (const side of [0, 1]) {
      const kicks = this.so.kicks[side];
      for (let s = 0; s < 5; s++) {
        const i = first + s;
        const x = 482 + s * 22; const y = 64 + side * 34;
        g.fillStyle(hex(PALETTE.ink)).fillCircle(x, y, 10);
        const k = kicks[i];
        const c = k === undefined ? PALETTE.indigo : k ? PALETTE.leaf : PALETTE.red;
        g.fillStyle(hex(c)).fillCircle(x, y, 8);
        if (k === true) g.fillStyle(0xffffff).fillCircle(x, y, 3);
      }
      this.rows[side].setText(String(goals(this.so, side)));
    }
  }

  reset(side) {
    this.tweens.killAll();
    this.ball.setPosition(CX, SPOT_Y - 4).setScale(S).setAlpha(1);
    this.ballShadow.setPosition(CX, SPOT_Y);
    this.keeper.setTexture(this.kits.keeper[1 - side], '0_36').setPosition(CX, GY + 4).setAngle(0);
    this.shooter.setTexture(this.kits.shooter[side], '4_1').setPosition(CX - 8, SPOT_Y + 30);
    this.marker.clear();
  }

  nextKick() {
    if (this.so.done) { this.finish(); return; }
    const side = nextKicker(this.so);
    this.side = side;
    this.reset(side);
    this.busy = false;
    this.dive = 0;
    sound('whistle');
    const team = side === 0 ? this.home : this.away;
    this.msg.setText(`${team.short} to shoot`).setColor(side === 0 ? PALETTE.gold : PALETTE.orange);
    if (side === 0) {
      this.help.setText('Tap SHOOT when the marker is on target');
      this.shootBtn.setVisible(true).setEnabled(true);
      this.diveBtns.forEach((b) => b.setVisible(false));
      this.aimT = Math.random() * 3;
      this.aiming = true;
    } else {
      this.help.setText('Pick a side to dive!');
      this.shootBtn.setVisible(false);
      this.diveBtns.forEach((b) => b.setVisible(true).setEnabled(true));
      this.syncDive();
      this.aiming = false;
      // The CPU runs up after a moment; your choice when the ball is struck counts.
      this.time.delayedCall(1700, () => this.cpuStrike());
    }
  }

  update(_, dms) {
    if (!this.aiming) return;
    this.aimT += dms / 1000;
    this.aim = Math.sin(this.aimT * 2.6) * AIM_RANGE;
    const x = CX + this.aim * MOUTH / 2;
    const m = this.marker;
    m.clear();
    const inside = Math.abs(this.aim) <= 1;
    m.fillStyle(hex(PALETTE.ink)).fillRect(x - 4, GY - 34, 8, 30);
    m.fillStyle(hex(inside ? PALETTE.gold : PALETTE.red)).fillRect(x - 2, GY - 32, 4, 26);
    m.fillStyle(hex(PALETTE.ink)).fillTriangle(x - 8, GY - 40, x + 8, GY - 40, x, GY - 30);
    m.fillStyle(hex(inside ? PALETTE.gold : PALETTE.red)).fillTriangle(x - 6, GY - 39, x + 6, GY - 39, x, GY - 32);
  }

  strike() {
    if (!this.aiming || this.busy || this.side !== 0) return;
    this.aiming = false;
    this.busy = true;
    this.shootBtn.setEnabled(false);
    const aim = this.aim;
    const dive = cpuDive(this.matchInfo.skill ?? 0.5, aim, Math.random);
    this.kick(aim, 0.75, dive, this.matchInfo.skill ?? 0.5);
  }

  pickDive(d) {
    if (this.side !== 1 || this.busy) return;
    this.dive = d;
    sfx('select');
    this.syncDive();
  }

  syncDive() {
    this.diveBtns.forEach((b, i) => {
      const on = i - 1 === this.dive;
      b.body.setFillStyle(hex(on ? PALETTE.gold : PALETTE.lavender));
    });
  }

  cpuStrike() {
    if (this.side !== 1 || this.busy) return;
    this.busy = true;
    this.diveBtns.forEach((b) => b.setEnabled(false));
    const { aim, power } = cpuKick(this.matchInfo.skill ?? 0.5, Math.random);
    this.kick(aim, power, this.dive, 0.5);
  }

  /** Animate run-up, strike, dive and the outcome, then record it. */
  kick(aim, power, dive, keeperSkill) {
    const result = resolveKick({ aim, power, dive, keeper: keeperSkill, rng: Math.random });
    this.help.setText('');
    const sh = this.shooter;
    const kitS = sh.texture.key;
    this.tweens.add({
      targets: sh, x: CX - 2, y: SPOT_Y + 10, duration: 380,
      onUpdate: () => sh.setFrame(`4_${ANIM.run[Math.floor(this.time.now / 90) % 4]}`),
      onComplete: () => {
        sh.setTexture(kitS, `4_${ANIM.kick[2]}`);
        sound('shot');
        const tx = CX + aim * MOUTH / 2;
        const high = result === 'miss' && Math.abs(aim) <= 1;
        let endY = result === 'goal' ? GY - 22 : high ? GY - 70 : GY - 6;
        if (result === 'save') endY = GY - 2;
        this.tweens.add({ targets: this.ball, x: tx, y: endY, scale: high ? S * 0.8 : S, duration: 300, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: this.ballShadow, x: tx, y: result === 'goal' ? GY - 14 : GY, alpha: high ? 0 : 0.35, duration: 300 });
        // Keeper dives
        const k = this.keeper;
        const kx = CX + dive * MOUTH * 0.36;
        k.setFrame(dive === 0 ? `0_${ANIM.catch[1]}` : `${dive > 0 ? 2 : 6}_${ANIM.tackle[2]}`);
        this.tweens.add({ targets: k, x: kx, y: GY + (dive === 0 ? 4 : 0), duration: 260, ease: 'Quad.easeOut' });
        this.time.delayedCall(320, () => this.outcome(result, tx));
      },
    });
  }

  outcome(result, tx) {
    const mine = this.side === 0;
    if (result === 'save') {
      sfx('thud');
      this.tweens.add({ targets: this.ball, x: tx + (tx < CX ? -50 : 50), y: GY + 70, duration: 500, ease: 'Quad.easeOut' });
      this.tweens.add({ targets: this.ballShadow, x: tx + (tx < CX ? -50 : 50), y: GY + 74, duration: 500 });
    } else if (result === 'goal') {
      sfx(mine ? 'goal' : 'lose');
      this.cameras.main.shake(150, 0.006);
    } else sfx('error');
    const label = { goal: 'GOAL!', save: 'SAVED!', miss: 'MISSED!' }[result];
    const good = (result === 'goal') === mine;
    this.msg.setText(label).setColor(good ? PALETTE.gold : PALETTE.orange);
    recordKick(this.so, this.side, result === 'goal');
    this.drawTally();
    this.time.delayedCall(1300, () => this.nextKick());
  }

  finish() {
    const pens = [goals(this.so, 0), goals(this.so, 1)];
    const res = applyResult(this.matchInfo, this.score, pens);
    sfx(res.won ? 'win' : 'lose');
    this.shootBtn.setVisible(false);
    this.diveBtns.forEach((b) => b.setVisible(false));
    const mode = this.matchInfo.mode;
    const lines = [`${pens[0]} - ${pens[1]} on penalties`];
    if (mode === 'cup') {
      const champ = res.cup && res.cup.champion === 'rabbits';
      lines.push(champ ? 'You won the cup!' : res.won ? 'Through to the next round' : 'Knocked out of the cup');
    } else lines.push(res.won ? `${res.streak} in a row!` : `Run over: ${res.streak} wins`);
    const m = modal(this, res.won ? 'You win!' : 'You lose', lines, [
      ['Continue', () => { m.destroy(); go(this, mode === 'cup' ? 'Cup' : 'Endless', res); }],
    ]);
  }
}

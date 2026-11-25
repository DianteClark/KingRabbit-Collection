import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { sfx } from '../../../shared/core/sfx.js';
import { dailySeed, reportDaily } from '../../../shared/core/trophies.js';
import { WIDTH, HEIGHT, header, store, persist, img, fit, flushAwards, GAME_ID, go, modal } from './common.js';
import { ATLAS } from '../art.js';
import * as G from '../logic/game.js';
import * as D from '../logic/data.js';
import { newReel, stepReel, inBar, biteDelay, HOOK_WINDOW } from '../logic/fishing.js';
import { jingle, playMusic, swish } from '../music.js';

const TRACK = { x: 118, top: 150, h: 330, w: 44 };
const DAILY_POOL = ['perch', 'carp', 'sunfish', 'dace', 'trout', 'bass', 'pike', 'eel', 'koi', 'icepip'];

/**
 * The fishing minigame. mode 'normal' (one cast from the World), 'derby' (River Derby festival,
 * timed, over the World) or 'daily' (the Daily Derby from the title screen, seeded).
 */
export class Fish extends Phaser.Scene {
  constructor() { super('Fish'); }

  init(data) {
    this.mode = data.mode || 'normal';
    this.where = data.where || 'pond';
    this.seconds = data.seconds || (this.mode === 'daily' ? 60 : 90);
  }

  create() {
    this.s = store.state;
    this.timed = this.mode !== 'normal';
    this.count = 0; this.score = 0; this.left = this.seconds; this.over = false;
    this.downs = 0;
    if (this.mode === 'daily') {
      this.rnd = G.seeded(dailySeed(GAME_ID));
      this.cameras.main.setBackgroundColor('#2a5cb4');
      for (let y = 0; y < HEIGHT; y += 32) for (let x = 0; x < WIDTH; x += 32) this.add.image(x, y, ATLAS, (x + y) % 96 ? 'water0' : 'water1').setOrigin(0).setScale(2);
      header(this, 'Daily Derby', () => this.quitDaily());
      playMusic('summer');
    } else {
      this.rnd = Math.random;
      this.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.55).setOrigin(0).setInteractive();
    }
    const top = this.mode === 'daily' ? 70 : 60;
    panel(this, 16, top, WIDTH - 32, 500, { fill: '#203a5c', inner: PALETTE.sand, border: PALETTE.ink });
    this.title = text(this, WIDTH / 2, top + 26, this.timed ? '' : 'Fishing', { size: 32, color: PALETTE.gold });
    this.info = text(this, WIDTH / 2, top + 58, '', { color: PALETTE.cream, wrap: WIDTH - 64 });
    // track
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.ink)).fillRect(TRACK.x - 4, TRACK.top - 4, TRACK.w + 8, TRACK.h + 8);
    g.fillStyle(0x5fa0d8).fillRect(TRACK.x, TRACK.top, TRACK.w, TRACK.h);
    g.fillStyle(hex(PALETTE.ink)).fillRect(TRACK.x + TRACK.w + 14, TRACK.top - 4, 20, TRACK.h + 8);
    this.trackParts = [g];
    this.bar = this.add.rectangle(TRACK.x, 0, TRACK.w, 10, 0x6cd84c, 0.85).setOrigin(0, 0).setStrokeStyle(2, 0x2c6a1c);
    this.fishImg = this.add.image(TRACK.x + TRACK.w / 2, 0, ATLAS, 'i_perch').setScale(2);
    this.meter = this.add.rectangle(TRACK.x + TRACK.w + 16, TRACK.top + TRACK.h, 16, 0, 0xe3d245).setOrigin(0, 1);
    this.reelParts = [g, this.bar, this.fishImg, this.meter];
    this.side = text(this, 268, TRACK.top + 40, '', { color: PALETTE.cream, wrap: 140 });
    // bobber for the wait
    this.bobber = this.add.container(WIDTH / 2, 300);
    this.bobber.add([this.add.ellipse(0, 10, 60, 16, 0x3a78c0), this.add.circle(0, 0, 8, 0xf9f5ef).setStrokeStyle(2, hex(PALETTE.ink)), this.add.rectangle(0, -5, 16, 6, 0xd84848)]);
    this.bang = text(this, WIDTH / 2, 230, '!', { size: 32, color: PALETTE.red }).setVisible(false);
    this.stopBtn = button(this, WIDTH / 2, top + 456, 200, 46, this.timed ? 'Give up' : 'Reel in', () => this.cancel(), { fill: PALETTE.lavender });
    this.okBtn = button(this, WIDTH / 2, top + 456, 200, 46, 'Nice!', () => this.finish(), { fill: PALETTE.gold }).setVisible(false);
    this.timerText = text(this, WIDTH / 2, top + 410, '', { color: PALETTE.gold });

    this.input.on('pointerdown', (p) => { if (p.y < top + 430) this.down(); });
    this.input.on('pointerup', () => { this.downs = Math.max(0, this.downs - 1); });
    this.input.on('pointerupoutside', () => { this.downs = Math.max(0, this.downs - 1); });
    this.input.keyboard?.on('keydown-SPACE', () => this.down());
    this.input.keyboard?.on('keyup-SPACE', () => { this.downs = 0; });
    window.__fish = this;
    this.cast();
  }

  holding() { return this.downs > 0; }

  down() {
    this.downs++;
    if (this.phase === 'wait') { this.info.setText('Not yet... wait for the "!"'); return; }
    if (this.phase === 'bite') this.hook();
  }

  cast() {
    this.phase = 'wait';
    this.result = null;
    this.okBtn.setVisible(false);
    this.stopBtn.setVisible(true);
    this.reelParts.forEach((o) => o.setVisible(false));
    this.side.setText('');
    this.bobber.setVisible(true);
    this.bang.setVisible(false);
    let bait = false;
    if (this.mode !== 'daily' && G.has(this.s, 'bait')) { G.take(this.s, 'bait'); bait = true; }
    this.info.setText(bait ? 'Bait on the hook. Wait for the "!" then tap!' : 'Wait for the "!" then tap fast!');
    fit(this.info, WIDTH - 64);
    this.wait = biteDelay(bait || this.mode === 'daily', this.rnd === Math.random ? Math.random : this.rnd);
    swish('water');
    this.tweens.killTweensOf(this.bobber);
    this.bobber.y = 300;
    this.tweens.add({ targets: this.bobber, y: 304, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  hook() {
    this.phase = 'reel';
    sfx('goal');
    this.bang.setVisible(false);
    this.bobber.setVisible(false);
    const id = this.mode === 'daily' ? DAILY_POOL[Math.floor(this.rnd() * DAILY_POOL.length)] : G.rollFish(this.s, this.where, Math.random);
    this.reel = newReel(id, this.mode === 'daily' ? 0 : this.s.tools.rod, Math.random);
    this.reelParts.forEach((o) => o.setVisible(true));
    this.fishImg.setFrame('i_perch').setTint(0x203a5c);
    this.info.setText('Hold to lift the green bar. Keep the fish inside it!');
    fit(this.info, WIDTH - 64);
    this.side.setText(`${D.FISH[id].diff >= 7 ? 'A big one!' : D.FISH[id].diff >= 4 ? 'It\'s fighting!' : 'A nibble!'}`);
  }

  update(t, delta) {
    if (this.__modal?.active || document.getElementById('howto')) return;
    const dt = delta / 1000;
    if (this.timed && !this.over && this.phase !== 'done') {
      this.left -= dt;
      this.timerText.setText(`Time ${Math.max(0, Math.ceil(this.left))}s    Caught ${this.count}${this.mode === 'daily' ? `    ${this.score} pts` : ''}`);
      fit(this.timerText, WIDTH - 60);
      if (this.left <= 0) { this.endTimed(); return; }
    }
    if (this.phase === 'wait') {
      this.wait -= dt;
      if (this.wait <= 0) {
        this.phase = 'bite'; this.biteLeft = HOOK_WINDOW;
        this.bang.setVisible(true);
        sfx('select');
        this.tweens.add({ targets: this.bobber, y: 312, duration: 80, yoyo: true, repeat: 2 });
      }
    } else if (this.phase === 'bite') {
      this.biteLeft -= dt;
      if (this.biteLeft <= 0) this.missed('Too slow! It got away.');
    } else if (this.phase === 'reel') {
      stepReel(this.reel, dt, this.holding(), Math.random);
      const r = this.reel;
      this.bar.setPosition(TRACK.x, TRACK.top + TRACK.h * (1 - r.barY - r.barH)).setSize(TRACK.w, TRACK.h * r.barH);
      this.bar.setFillStyle(inBar(r) ? 0x6cd84c : 0x4a9a3a, 0.85);
      this.fishImg.setPosition(TRACK.x + TRACK.w / 2, TRACK.top + TRACK.h * (1 - r.fishY));
      this.meter.setSize(16, TRACK.h * r.progress).setPosition(TRACK.x + TRACK.w + 16, TRACK.top + TRACK.h);
      this.meter.setFillStyle(r.progress > 0.66 ? 0x6cd84c : r.progress > 0.33 ? 0xe3d245 : 0xd84848);
      if (r.done === 'caught') this.caught(r.fish);
      else if (r.done === 'escaped') this.missed('The fish got away!');
    }
  }

  caught(id) {
    this.phase = 'done';
    jingle('catch');
    this.reelParts.forEach((o) => o.setVisible(false));
    this.fishImg.clearTint();
    const it = D.ITEMS[id];
    this.count++;
    this.score += it.price;
    if (this.mode !== 'daily') { G.caughtFish(this.s, id); persist(); flushAwards(); }
    this.showResult(`You caught a ${it.name}!`, id, `${it.price}g`);
  }

  missed(msg) {
    this.phase = 'done';
    sfx('error');
    this.reelParts.forEach((o) => o.setVisible(false));
    this.bang.setVisible(false);
    this.bobber.setVisible(false);
    this.showResult(msg, null, '');
  }

  showResult(msg, id, sub) {
    this.info.setText(msg);
    fit(this.info, WIDTH - 64);
    this.big?.destroy();
    this.big = id ? img(this, WIDTH / 2, 280, D.ITEMS[id].icon, 6) : null;
    this.side.setText('');
    this.subText?.destroy();
    this.subText = text(this, WIDTH / 2, 360, sub, { color: PALETTE.gold });
    this.stopBtn.setVisible(false);
    if (this.timed) {
      this.time.delayedCall(900, () => { if (this.over) return; this.big?.destroy(); this.subText?.destroy(); this.cast(); });
      this.stopBtn.setVisible(true);
    } else {
      this.okBtn.setLabel(id ? 'Nice!' : 'OK').setVisible(true);
    }
  }

  cancel() {
    if (this.timed) { this.endTimed(true); return; }
    this.finish();
  }

  endTimed(gaveUp = false) {
    if (this.over) return;
    this.over = true;
    this.phase = 'done';
    this.reelParts.forEach((o) => o.setVisible(false));
    this.bobber.setVisible(false); this.bang.setVisible(false);
    this.big?.destroy(); this.subText?.destroy();
    this.stopBtn.setVisible(false);
    this.timerText.setText('');
    if (this.mode === 'daily') {
      const r = reportDaily(GAME_ID, this.score);
      jingle(r.isBest ? 'fanfare' : 'harvest');
      modal(this, gaveUp ? 'Derby over' : 'Time!', [`You caught ${this.count} fish for ${this.score} points.`, `Today's best: ${r.best}. Streak: ${r.streak} day${r.streak === 1 ? '' : 's'}.`, 'Same fish for everyone today. New derby tomorrow!'], [
        ['Try again', () => this.scene.restart({ mode: 'daily' })],
        ['Title screen', () => go(this, 'Title')],
      ]);
      return;
    }
    this.info.setText(`Time! You caught ${this.count} fish.`);
    this.okBtn.setLabel('Done').setVisible(true);
  }

  finish() {
    if (this.closing) return;
    this.closing = true;
    if (this.mode === 'daily') { go(this, 'Title'); return; }
    const world = this.scene.get('World');
    const res = { mode: this.mode, count: this.count };
    this.scene.stop();
    world.scene.resume();
    world.fishDone(res);
  }

  quitDaily() {
    if (this.over) { go(this, 'Title'); return; }
    modal(this, 'Leave the derby?', ['Your catch so far will not be scored.'], [['Leave', () => go(this, 'Title')], ['Keep fishing', null]]);
  }
}

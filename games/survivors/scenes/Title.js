import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { isMuted, setMuted } from '../../../shared/core/sfx.js';
import { dailySeed, profile, dailyBest } from '../../../shared/core/trophies.js';
import { WIDTH, HEIGHT, M, go, setBackground, shadowTitle, openHowTo } from './common.js';
import { meta, setMeta } from '../save.js';
import { KEY } from '../art.js';
import { CHARACTERS } from '../logic/data.js';
import { dailyConfig } from '../logic/meta.js';
import { fmtClock } from '../logic/waves.js';
import { GAME_ID, TROPHIES } from '../trophies.js';

export class Title extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    setBackground(this, PALETTE.night);
    const m = meta();
    this.add.tileSprite(0, 0, WIDTH, HEIGHT, 'surv-floor').setOrigin(0).setAlpha(0.7);
    button(this, M + 26, M + 20, 52, 40, '<', () => { this.input.enabled = false; window.location.href = '../'; }, { size: 32, fill: PALETTE.cream });
    button(this, WIDTH - M - 26, M + 20, 52, 40, '?', () => openHowTo(this), { size: 32, fill: PALETTE.gold });
    shadowTitle(this, WIDTH / 2, M + 18, 'RABBIT SURVIVORS');

    // left: the hero in a ring of monsters
    panel(this, M, 72, 290, 220);
    const hero = CHARACTERS[m.hero] ? m.hero : 'wanderer';
    this.hero = this.add.image(161, 168, KEY, `h_${hero}_0`).setScale(3);
    this.ring = ['bat', 'skeleton', 'slime', 'zombie', 'rat', 'orc'].map((t, i) => this.add.image(0, 0, KEY, `e_${t}_0`).setScale(2).setData('a', (i / 6) * Math.PI * 2).setData('t', t));
    text(this, 161, 236, `${CHARACTERS[hero].name}`, { color: PALETTE.gold });
    const prof = profile().games[GAME_ID];
    const got = prof ? Object.keys(prof.trophies || {}).length : 0;
    text(this, 161, 262, `Best ${fmtClock(m.bestTime)}   Trophies ${got}/${TROPHIES.length}`, { color: PALETTE.lavender });

    // right: modes
    const x = 476;
    const play = this.modeButton(x, 102, m.runs ? 'Play' : 'Start!', `${CHARACTERS[hero].name}${m.easy ? ', Easy' : ''}`, () => go(this, 'Game', { hero, easy: m.easy }), PALETTE.gold);
    if (!m.runs) this.tweens.add({ targets: play, scale: 1.04, yoyo: true, repeat: -1, duration: 500 });
    const daily = dailyConfig(dailySeed(GAME_ID));
    const db = dailyBest(GAME_ID).best;
    this.modeButton(x, 164, 'Daily', db != null ? `Today's best ${db}` : `Today: ${CHARACTERS[daily.hero].name}`, () => go(this, 'Game', { hero: daily.hero, daily: true, seed: daily.seed }));
    this.modeButton(x, 226, 'Heroes & Shop', `${m.coins} coins`, () => go(this, 'Shop'), PALETTE.lavender);
    this.easyBtn = button(this, x - 66, 280, 128, 42, '', () => { const mm = meta(); mm.easy = !mm.easy; setMeta(mm); this.scene.restart(); }, { fill: m.easy ? PALETTE.leaf : PALETTE.indigo, color: PALETTE.cream });
    this.easyBtn.setLabel(m.easy ? 'Easy: On' : 'Easy: Off');
    this.soundBtn = button(this, x + 70, 280, 120, 42, '', () => { setMuted(!isMuted()); this.syncSound(); });
    this.syncSound();
    text(this, WIDTH / 2, HEIGHT - M - 8, 'Art: Aleksandr Makarov', { color: PALETTE.lavender });
  }

  modeButton(x, y, label, sub, fn, fill = PALETTE.cream) {
    const b = button(this, x, y, 268, 54, '', fn, { fill });
    b.face.add(text(this, 0, -9, label, { size: 16, color: PALETTE.night }));
    b.face.add(text(this, 0, 11, sub, { color: PALETTE.indigo }));
    return b;
  }

  syncSound() {
    this.soundBtn.setLabel(isMuted() ? 'Muted' : 'Sound');
    this.soundBtn.body.setFillStyle(hex(isMuted() ? PALETTE.indigo : PALETTE.leaf));
    this.soundBtn.label.setColor(PALETTE.cream);
  }

  update(time) {
    const t = time / 1000;
    this.hero.setFrame(`h_${this.hero.frame.name.split('_')[1]}_${Math.floor(t * 6) % 4}`);
    for (const s of this.ring) {
      const a = s.getData('a') + t * 0.6;
      const r = 70 + Math.sin(t * 2 + s.getData('a')) * 6;
      s.setPosition(Math.round(161 + Math.cos(a) * r), Math.round(160 + Math.sin(a) * r * 0.55));
      s.setFrame(`e_${s.getData('t')}_${Math.floor(t * 5) % 4}`).setFlipX(Math.cos(a) < 0);
    }
  }
}

import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button } from '../../../shared/core/ui.js';
import { isMuted, setMuted, sfx } from '../../../shared/core/sfx.js';
import {
  WIDTH, go, shadowTitle, setBackground, store, openHowTo,
} from './common.js';
import * as P from './panels.js';
import * as G from '../logic/game.js';
import { CIVS } from '../logic/data.js';
import { makeRng } from '../logic/rng.js';
import { save, loadGame, saveGame, clearGame } from '../save.js';
import { getSkill, skillLabel, resetSkill } from '../adaptive.js';
import { drawTerrain, unitFrame, frame } from '../art.js';

export class Menu extends Phaser.Scene {
  constructor() { super('Menu'); }

  init(data) { this.openSetup = data?.setup || null; }

  create() {
    setBackground(this, PALETTE.night);
    window.__pangeaMenu = this;
    this.leaving = false;
    this.diorama(92);
    shadowTitle(this, WIDTH / 2, 36, 'PANGEA');
    text(this, WIDTH / 2, 72, 'Found cities, grow an empire', { color: PALETTE.lavender });
    button(this, WIDTH - 28, 32, 44, 40, '?', () => openHowTo(this), { size: 32, fill: PALETTE.gold });

    const saved = loadGame();
    let y = 296;
    if (saved && !saved.over) {
      const me = saved.civs.find((c) => c.id === saved.cur && c.human) || saved.civs.find((c) => c.human);
      button(this, WIDTH / 2, y, 300, 46, 'Continue', () => this.resume(saved), { fill: PALETTE.gold });
      text(this, WIDTH / 2, y + 34, `${saved.hotseat ? 'Pass and Play, ' : ''}${me?.name || ''}, turn ${saved.turn} of ${saved.maxTurn}`, { color: PALETTE.lavender });
      y += 66;
    } else y += 10;
    if (!(saved && !saved.over)) y = 306;
    const firstTime = !save.get('tutorialDone');
    button(this, WIDTH / 2, y, 300, 46, 'New Game', () => this.setup('solo'), { fill: saved || firstTime ? PALETTE.lavender : PALETTE.gold });
    button(this, WIDTH / 2, y + 56, 300, 46, 'Guided first game', () => this.tutorial(), { fill: firstTime && !saved ? PALETTE.gold : PALETTE.lavender });
    button(this, WIDTH / 2, y + 112, 300, 46, 'Pass and Play', () => this.setup('hotseat'), { fill: PALETTE.lavender });
    const r = save.get('record') || {};
    if (r.w || r.l) text(this, WIDTH / 2, y + 152, `Won ${r.w || 0}, lost ${r.l || 0}. Best score ${r.best || 0}`, { color: PALETTE.lavender });

    text(this, WIDTH / 2, 574, 'Art: Aleksandr Makarov', { color: PALETTE.lavender });
    button(this, 80, 612, 144, 40, '< All Games', () => { window.location.href = '../'; }, { fill: PALETTE.indigo, color: PALETTE.cream });
    this.lvlBtn = button(this, 218, 612, 120, 40, `Rivals Lv ${skillLabel()}`, () => this.levelInfo(), { fill: PALETTE.indigo, color: PALETTE.cream });
    this.soundBtn = button(this, 318, 612, 68, 40, '', () => { setMuted(!isMuted()); this.syncSound(); });
    this.syncSound();
    if (this.openSetup) this.time.delayedCall(250, () => this.setup(this.openSetup));
  }

  syncSound() {
    this.soundBtn.setLabel(isMuted() ? 'Mute' : 'Sound');
    this.soundBtn.body.setFillStyle(hex(isMuted() ? PALETTE.indigo : PALETTE.leaf));
    this.soundBtn.label.setColor(PALETTE.cream);
  }

  /** A little slice of the world: coast, fields, a town, some units. */
  diorama(top) {
    const w = 23; const h = 8;
    const rng = makeRng(7);
    const tiles = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let t = 'grass';
        const coast = y >= 6 || (y === 5 && (x < 4 || x > 17)) || (x === 0 && y > 3);
        if (coast) t = y === 7 ? 'ocean' : 'coast';
        else if (x > 15 && y < 5) t = 'plains';
        else if (x < 5 && y < 3) t = 'tundra';
        let f = null;
        if (t !== 'coast' && t !== 'ocean') {
          if ((x > 17 && y < 3) || (x === 17 && y === 1)) f = 'hills';
          else if (x > 19 && y < 2) f = 'mountain';
          else if (x < 7 && y < 4 && rng() < 0.7) f = 'forest';
          else if (rng() < 0.08) f = 'forest';
        }
        tiles.push({ t, f, r: null, imp: null });
      }
    }
    tiles[5 * w + 12].imp = 'farm'; tiles[5 * w + 13].imp = 'farm'; tiles[2 * w + 18].imp = 'mine';
    tiles[6 * w + 9].r = 'fish'; tiles[3 * w + 16].r = 'horses';
    const rt = this.add.renderTexture(0, top, w * 16, h * 16).setOrigin(0).setScale(1);
    drawTerrain(this, rt, { w, h, tiles });
    rt.setX(Math.floor((WIDTH - w * 16) / 2));
    const ox = rt.x;
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.ink)).fillRect(0, top - 3, WIDTH, 3).fillRect(0, top + h * 16, WIDTH, 3);
    const put = (key, fx, fy, tx, ty, sc = 1) => { const [k, f] = frame(this, key, fx, fy); return this.add.image(ox + tx * 16 + 8, top + ty * 16 + 8, k, f).setScale(sc); };
    put('towns', 16, 16, 11, 4);
    put('towns', 0, 16, 6, 4);
    const civColor = [0x2f8fe0, 0xd8402e];
    const unit = (type, tx, ty, c, flip = false) => {
      this.add.ellipse(ox + tx * 16 + 8, top + ty * 16 + 14, 13, 5, civColor[c]).setStrokeStyle(1, 0x040303);
      const [k, f] = unitFrame(this, type, 0, 0);
      const im = this.add.image(ox + tx * 16 + 8, top + ty * 16 + 8, k, f).setFlipX(flip);
      return { im, type };
    };
    const units = [unit('settler', 9, 3, 0), unit('knight', 13, 2, 0), unit('worker', 12, 5, 0), unit('swordsman', 16, 3, 1, true), unit('catapult', 18, 4, 1, true)];
    let k = 0;
    this.time.addEvent({ delay: 260, loop: true, callback: () => { k++; units.forEach((u, i) => { const [kk, f] = unitFrame(this, u.type, 0, k + i); u.im.setTexture(kk, f); }); } });
    // Leader portraits along the bottom of the diorama.
    const faces = [1, 2, 5, 10, 13];
    faces.forEach((a, i) => {
      const fx = WIDTH / 2 + (i - 2) * 46;
      this.add.rectangle(fx, top + h * 16 + 26, 38, 38, hex(PALETTE.ink));
      const [kk, f] = frame(this, 'avatars', a * 32, 0, 32, 32);
      this.add.image(fx, top + h * 16 + 26, kk, f);
    });
  }

  levelInfo() {
    if (P.anyOpen()) return;
    const p = P.sheet({
      title: 'Rival level', wrap: 'center',
      html: `<p class="pg-p">Computer rivals play at level ${skillLabel()} of 10. It rises when you win and falls when you lose, so games stay close. Only their decisions change, never their gold, production or units.</p>`,
      foot: '<button class="pg-btn gold" data-act="close">OK</button><button class="pg-btn" data-act="reset">Reset to start</button>',
      handlers: { reset: () => { resetSkill(); this.lvlBtn.setLabel(`Rivals Lv ${skillLabel()}`); p.close(true); } },
    });
  }

  resume(saved) {
    if (this.leaving || P.anyOpen()) return;
    this.leaving = true;
    store.start = { state: saved, fresh: false };
    sfx('select');
    go(this, 'World');
  }

  setup(mode) {
    if (P.anyOpen()) return;
    P.showSetup({
      mode,
      skillText: `Rivals play at level ${skillLabel()} of 10 and adapt to how you do.`,
      onStart: (st) => this.confirmReplace(() => this.start(st)),
    });
  }

  confirmReplace(fn) {
    const saved = loadGame();
    if (saved && !saved.over) {
      P.confirm({ title: 'New game?', text: 'This replaces the game you have in progress.', yes: 'Start new', yesCls: 'red', onYes: fn });
    } else fn();
  }

  tutorial() {
    if (P.anyOpen()) return;
    this.confirmReplace(() => {
      const civ = CIVS[Math.floor(Math.random() * CIVS.length)].id;
      this.start({ civ, size: 'small', rivals: 2, length: 150, hot: false, tutorial: true });
    });
  }

  start(st) {
    if (this.leaving) return;
    this.leaving = true;
    clearGame();
    const seed = (Date.now() & 0xffffff) >>> 0;
    const rng = makeRng(seed);
    const skill = st.tutorial ? Math.min(0.12, getSkill()) : getSkill();
    let players;
    if (st.hot) {
      players = st.picks.map((civ) => ({ civ, human: true }));
    } else players = [{ civ: st.civ, human: true }];
    const pool = rng.shuffle(CIVS.map((c) => c.id).filter((id) => !players.some((p) => p.civ === id)));
    const cpus = st.hot ? st.cpus : st.rivals;
    for (let i = 0; i < cpus; i++) players.push({ civ: pool[i], human: false, skill });
    const state = G.newGame(players, { size: st.size, seed, maxTurn: st.length, tutorial: !!st.tutorial });
    if (st.tutorial) state.coach = 0;
    saveGame(state);
    store.start = { state, fresh: true };
    sfx('power');
    go(this, 'World');
  }
}

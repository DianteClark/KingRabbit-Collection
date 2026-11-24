import Phaser from 'phaser';
import { World } from '../logic/game.js';
import { STAGES } from '../logic/stages.js';
import { BOSSES } from '../logic/bosses.js';
import { TILE, VIEW_W, VIEW_H, ZOOM, DT, P, T, WEAPONS } from '../logic/constants.js';
import { winStage, absorbRun, afterGameOver, noteWeak } from '../logic/progress.js';
import { THEMES, PICKUP_FRAMES } from '../art.js';
import { paintChunk, paintBackground, darkenedTiles, pieceFor } from './painter.js';
import { loadProgress, storeProgress } from './common.js';
import { getSkill, report } from '../adaptive.js';
import { tuneFor } from '../logic/tune.js';
import { save } from '../save.js';
import { playMusic, stopMusic, jingle, fx } from '../music.js';

const CHUNK = 64;
// which way each enemy's art looks before flipping
const ART_FACES = { walker: 1, guard: -1, hardhat: 1, hopper: -1, bat: 1, flyer: 1, turret: -1, crawler: -1 };
const BULLET_TEX = { pellet: 'eb', bomb: 'eb-bomb', lance: 'eb-lance', leafOrb: 'eb-leaf', leaf: 'eb-leaf', spark: 'eb-spark', seeker: 'eb-seeker', rang: 'eb-rang', rock: 'eb-rock', orb: 'eb-orb' };
const darkCache = new Map();

export class Stage extends Phaser.Scene {
  constructor() { super('Stage'); }

  init(data) {
    this.stageId = STAGES[data?.stage] ? data.stage : 'foundry';
    this.startCp = data?.cp ?? -1;
    this._leaving = false;
  }

  create() {
    const def = STAGES[this.stageId];
    this.def = def;
    this.prog = loadProgress();
    this.w = new World({
      stage: def, skill: getSkill(), weapons: this.prog.weapons, etanks: this.prog.etanks,
      lives: this.prog.lives, seed: (Date.now() & 0xffff) + 1, found: this.prog.found, cp: this.startCp,
    });
    this.theme = THEMES[def.theme];
    window.__mb = this;
    document.body.style.background = '#000';

    const cam = this.cameras.main;
    cam.setZoom(ZOOM).setRoundPixels(true).setBackgroundColor(this.theme.bg);
    this.buildLevel();
    this.ents = new Map();
    this.player = this.add.sprite(0, 0, 'hero-buster', 0).setOrigin(0.5, 20 / 24).setDepth(50);
    this.beam = this.add.rectangle(0, 0, 4, 14, 0xffffff).setOrigin(0.5, 1).setDepth(51).setVisible(false);
    this.acc = 0;
    this.lastBlink = new Map();
    this.syncCamera();
    this.sync();

    this.scene.launch('Hud', { stage: this });
    this.hud = this.scene.get('Hud');
    // leaving the app: keep finds, and come back to the pause menu rather than straight into danger
    const flush = () => { this.saveFinds(); if (document.hidden) this.hud?.pauseMenu(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);
    this.events.once('shutdown', () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', flush);
      this.scene.stop('Hud');
    });
    playMusic(def.music);
    jingle('ready');
    cam.fadeIn(250);
  }

  // ------------------------------------------------------------------ static level

  buildLevel() {
    const lv = this.w.lv; const theme = this.theme;
    const raw = this.textures.get('tileset').getSourceImage();
    let tilesKey = 'tileset';
    if (theme.darken) {
      tilesKey = `tiles-${this.def.theme}`;
      if (!this.textures.exists(tilesKey)) {
        if (!darkCache.has(tilesKey)) darkCache.set(tilesKey, darkenedTiles(raw, theme.darken));
        this.textures.addCanvas(tilesKey, darkCache.get(tilesKey));
      }
    }
    this.tilesKey = tilesKey;
    this.imgs = {
      tiles: this.textures.get(tilesKey).getSourceImage(), raw,
      spike: this.textures.get('spike-up').getSourceImage(), oneway: this.textures.get('oneway').getSourceImage(),
    };
    // background with parallax
    const bgKey = `bg-${this.def.theme}`;
    if (!this.textures.exists(bgKey)) {
      const t = this.textures.createCanvas(bgKey, 160, 120);
      paintBackground(t.getContext(), theme, raw, 160, 120);
      t.refresh();
    }
    this.bg = this.add.tileSprite(0, 0, Math.ceil(VIEW_W) + 2, VIEW_H, bgKey).setOrigin(0).setDepth(-20);
    // tiles in chunks
    this.chunks = [];
    for (let c0 = 0; c0 < lv.cols; c0 += CHUNK) {
      const c1 = Math.min(lv.cols, c0 + CHUNK);
      const key = `lvl-${this.chunks.length}`;
      if (this.textures.exists(key)) this.textures.remove(key);
      const tex = this.textures.createCanvas(key, (c1 - c0) * TILE, lv.rows * TILE);
      paintChunk(tex.getContext(), lv, theme, this.imgs, c0, c1);
      tex.refresh();
      this.add.image(c0 * TILE, 0, key).setOrigin(0).setDepth(0);
      this.chunks.push({ c0, c1, tex });
    }
    // conveyor belts: scrolling arrows over each run
    this.belts = [];
    for (let cy = 0; cy < lv.rows; cy++) {
      let cx = 0;
      while (cx < lv.cols) {
        const t = lv.at(cx, cy);
        if (t === T.CONVL || t === T.CONVR) {
          let e = cx; while (lv.at(e + 1, cy) === t) e++;
          const ts = this.add.tileSprite(cx * TILE, cy * TILE + 1, (e - cx + 1) * TILE, 5, 'conv').setOrigin(0).setDepth(1);
          if (t === T.CONVL) ts.setFlipX(true);
          this.belts.push({ ts, dir: t === T.CONVR ? 1 : -1 });
          cx = e + 1;
        } else cx++;
      }
    }
    // appearing blocks: one image per cell, the nine-slice piece picked from same-group neighbours
    this.blinkImgs = lv.blinks.map((b) => {
      const same = (dx, dy) => lv.blinks.some((o) => o.group === b.group && o.cx === b.cx + dx && o.cy === b.cy + dy);
      const [pc, pr] = pieceFor(same(0, -1), same(0, 1), same(-1, 0), same(1, 0));
      // appearing blocks are always the bright white riveted ones, so they never pass for walls
      const fname = `blk-${pc}-${pr}`;
      const raw = this.textures.get('tileset');
      if (!raw.has(fname)) raw.add(fname, 0, pc * 8, 8 + pr * 8, 8, 8);
      return this.add.image(b.x, b.y, 'tileset', fname).setOrigin(0).setDepth(2);
    });
    // moving platforms
    this.moverImgs = lv.movers.map(() => this.add.image(0, 0, 'mover').setOrigin(0).setDepth(2));
    // boss shutter
    if (lv.doorCol >= 0) {
      let r0 = 0; while (r0 < lv.rows && lv.tiles[r0 * lv.cols + lv.doorCol] !== T.DOOR) r0++;
      let r1 = r0; while (r1 + 1 < lv.rows && lv.tiles[(r1 + 1) * lv.cols + lv.doorCol] === T.DOOR) r1++;
      this.doorH = (r1 - r0 + 1) * TILE;
      this.door = this.add.tileSprite(lv.doorCol * TILE, r0 * TILE, TILE, this.doorH, 'door').setOrigin(0).setDepth(3);
    }
    // checkpoint flags
    this.flags = lv.checkpoints.map((c, i) => this.add.image(c.x, c.y, 'cp').setOrigin(0, 1).setDepth(1).setTint(i <= this.w.cp ? 0xffffff : 0x8a8fc4));
    // pickup frames on the tileset
    const ts = this.textures.get('tileset');
    for (const [k, fr] of Object.entries(PICKUP_FRAMES)) fr.forEach(([x, y], i) => { if (!ts.has(`pk-${k}-${i}`)) ts.add(`pk-${k}-${i}`, 0, x, y, 8, 8); });
  }

  repaint(cells) {
    for (const ch of this.chunks) {
      if (!cells.some(([x]) => x >= ch.c0 - 1 && x <= ch.c1)) continue;
      paintChunk(ch.tex.getContext(), this.w.lv, this.theme, this.imgs, ch.c0, ch.c1);
      ch.tex.refresh();
    }
  }

  // ------------------------------------------------------------------ loop

  update(time, delta) {
    if (!this.hud?.ready) return;
    this.acc = Math.min(this.acc + delta / 1000, DT * 5);
    while (this.acc >= DT) {
      this.acc -= DT;
      const inp = this.hud.readInput();
      this.w.step(inp);
      this.handleEvents();
      if (this._leaving) return;
    }
    this.syncCamera();
    this.sync();
  }

  syncCamera() {
    const w = this.w;
    this.cameras.main.centerOn(w.camX + VIEW_W / 2, VIEW_H / 2);
    this.bg.setPosition(Math.floor(w.camX), 0);
    this.bg.tilePositionX = Math.floor(w.camX * 0.5);
  }

  /** Make the sprites match the simulation. */
  sync() {
    const w = this.w; const lv = w.lv; const now = this.time.now;
    const seen = new Set();
    const want = (id, make) => { seen.add(id); let s = this.ents.get(id); if (!s) { s = make(); this.ents.set(id, s); } return s; };
    // dynamic tiles
    for (const b of this.belts) b.ts.tilePositionX -= b.dir * 0.4;
    lv.blinks.forEach((b, i) => {
      const on = lv.blinkOn(b, w.time);
      this.blinkImgs[i].setVisible(on);
      const k = b.group;
      if (on && !this.lastBlink.get(k) && b.x > w.camX && b.x < w.camX + VIEW_W) fx('appear');
      this.lastBlink.set(k, on);
    });
    lv.movers.forEach((m, i) => { const r = lv.moverRect(m, w.time); this.moverImgs[i].setPosition(Math.round(r.x), Math.round(r.y)); });
    if (this.door) {
      const opening = w.mode === 'door' && w.modeT < 0.5;
      const k = lv.doorOpen ? 0 : opening ? 1 - w.modeT / 0.5 : 1;
      this.door.setVisible(k > 0).setSize(TILE, Math.max(1, Math.round(this.doorH * k)));
    }
    this.flags.forEach((f, i) => { if (i <= w.cp && !f.raised) { f.raised = true; f.clearTint(); this.tweens.add({ targets: f, scaleY: 1.3, yoyo: true, duration: 160 }); } });

    // enemies
    for (const e of w.enemies) {
      const s = want(`e${e.id}`, () => {
        const sp = this.add.sprite(0, 0, `en-${e.kind}`, 0).setDepth(40);
        const ink = !['walker', 'guard'].includes(e.kind);
        sp.setOrigin(0.5, ink ? 9 / 10 : 1);
        if (e.kind !== 'hardhat' && e.kind !== 'guard') sp.play({ key: `en-${e.kind}`, startFrame: e.id % 4 });
        if (e.kind === 'guard') { sp.shieldImg = this.add.rectangle(0, 0, 3, 12, 0xcfd6e0).setStrokeStyle(1, 0x040303).setDepth(41); sp.play('en-guard'); }
        return sp;
      });
      s.setPosition(Math.round(e.x + e.w / 2), Math.round(e.y + e.h));
      s.setFlipX(e.face !== ART_FACES[e.kind]);
      if (e.kind === 'hardhat') {
        if (e.state === 'hide') { s.anims.stop(); s.setFrame(4); } else if (!s.anims.isPlaying) s.play('en-hardhat');
      }
      if (e.kind === 'bat' && e.state === 'hang') { s.anims.pause(); s.setFrame(0); } else if (e.kind === 'bat' && s.anims.isPaused) s.anims.resume();
      if (e.kind === 'walker' || e.kind === 'guard') { if (e.state === 'hop' || !e.onGround) s.anims.pause(); else if (s.anims.isPaused) s.anims.resume(); }
      if (s.shieldImg) {
        s.shieldImg.setVisible(e.shield).setPosition(Math.round(e.x + e.w / 2 + e.face * 8), Math.round(e.y + e.h - 7));
      }
      if (e.inv > 0) s.setTintFill(0xffffff);
      else if ((e.tell || e.state === 'peek' || e.state === 'open' && e.kind === 'guard') && Math.floor(now / 70) % 2) s.setTint(0xffe070);
      else s.clearTint();
    }

    // boss
    const b = w.boss;
    if (b) {
      const s = want('boss', () => this.makeBoss(b));
      this.drawBoss(s, b, now);
    }

    // player shots
    for (const sh of w.shots) {
      const s = want(`s${sh.id}`, () => {
        if (sh.kind === 'blast') { const sp = this.add.sprite(0, 0, 'fx-boom0').setScale(1.5).setDepth(60); sp.play('fx-boom'); return sp; }
        return this.add.image(0, 0, `sh-${sh.kind}`).setDepth(55);
      });
      s.setPosition(Math.round(sh.x + sh.w / 2), Math.round(sh.y + sh.h / 2));
      if (sh.kind === 'ice') s.setFlipX(sh.vx < 0);
      if (sh.kind === 'drill') s.setRotation(sh.ang);
      if (sh.kind === 'gale') s.rotation += 0.35;
      if (sh.kind === 'leaf') s.rotation += 0.2;
      if (sh.kind === 'ember') s.rotation += 0.3;
    }

    // enemy and boss bullets
    for (const o of w.bullets) {
      const s = want(`b${o.id}`, () => this.makeBullet(o));
      this.drawBullet(s, o, now);
    }

    // pickups
    for (const d of w.drops) {
      const s = want(`d${d.id}`, () => {
        if (d.kind === 'etank' || d.kind === 'life') return this.add.image(0, 0, d.kind).setOrigin(0).setDepth(30);
        return this.add.image(0, 0, 'tileset', `pk-${d.kind}-0`).setOrigin(0).setDepth(30);
      });
      s.setPosition(Math.round(d.x), Math.round(d.y));
      if (PICKUP_FRAMES[d.kind]) s.setFrame(`pk-${d.kind}-${Math.floor(now / 200) % 2}`);
      s.setVisible(!(d.ttl < 2 && Math.floor(now / 80) % 2));
    }

    for (const [id, s] of this.ents) {
      if (!seen.has(id)) { s.shieldImg?.destroy(); s.extra?.destroy(); s.destroy(); this.ents.delete(id); }
    }
    this.drawPlayer(now);
  }

  makeBoss(b) {
    if (b.kind === 'gate') {
      const s = this.add.image(0, 0, 'big-gate').setOrigin(0.5, 1).setDepth(45);
      s.extra = this.add.graphics().setDepth(46);
      return s;
    }
    if (b.kind === 'engine') return this.add.image(0, 0, 'big-engine').setOrigin(0.5).setDepth(45);
    return this.add.sprite(0, 0, `boss-${b.kind}`, 0).setOrigin(0.5, 20 / 24).setDepth(45);
  }

  drawBoss(s, b, now) {
    const w = this.w;
    const flash = b.inv > 0 && Math.floor(now / 50) % 2;
    const tell = b.tell && Math.floor(now / 90) % 2;
    if (b.kind === 'gate') {
      s.setPosition(Math.round(b.x + b.w / 2), Math.round(b.y + b.h + 3));
      const g = s.extra; g.clear();
      // the shutter over its eye: closed, opening, open
      const k = b.anim === 'closed' ? 1 : b.anim === 'opening' ? 0.5 : 0;
      if (k > 0) {
        const x0 = b.x + 3; const y0 = b.y + 6; const ww = b.w - 6; const hh = Math.round((b.h - 14) * k);
        g.fillStyle(0x47416b).fillRect(x0, y0, ww, hh);
        g.fillStyle(0x8a8fc4);
        for (let y = y0 + 1; y < y0 + hh; y += 3) g.fillRect(x0 + 1, y, ww - 2, 1);
        g.lineStyle(1, 0x040303).strokeRect(x0, y0, ww, hh);
      }
      if (flash) s.setTintFill(0xffffff); else if (tell) s.setTint(0xffe070); else s.clearTint();
      return;
    }
    if (b.kind === 'engine') {
      s.setPosition(Math.round(b.x + b.w / 2), Math.round(b.y + b.h / 2) + Math.round(Math.sin(now / 120)));
      s.setScale(1 + 0.04 * Math.sin(now / 90), 1);
      if (flash) s.setTintFill(0xffffff); else if (tell) s.setTint(0xff7060); else if (b.phase === 2) s.setTint(0xffb0b0); else s.clearTint();
      return;
    }
    s.setVisible(!b.hidden);
    s.setPosition(Math.round(b.x + b.w / 2), Math.round(b.y + b.h));
    s.setFlipX(b.face < 0);
    const key = `boss-${b.kind}`;
    let anim = 'idle';
    if (b.anim === 'jump') anim = b.vy < 0 ? 'jumpShoot' : 'fall';
    else if (b.anim === 'shoot') anim = 'shoot';
    else if (b.anim === 'skate') anim = 'runShoot';
    else if (b.anim === 'crouch') anim = 'hurt';
    if (s.anims.currentAnim?.key !== `${key}-${anim}`) s.play(`${key}-${anim}`);
    s.setScale(1, b.anim === 'crouch' ? 0.9 : 1);
    if (flash) s.setTintFill(0xffffff); else if (tell) s.setTint(0xffe070); else s.clearTint();
    // the gale boss's wind
    if (b.kind === 'gale' && b.tell === 'blow' && Math.random() < 0.5) {
      const dir = w.wind > 0 ? 1 : -1;
      const y = 20 + Math.random() * 80;
      const l = this.add.rectangle(dir > 0 ? w.camX : w.camX + VIEW_W, y, 10, 1, 0xf9f5ef, 0.7).setDepth(70);
      this.tweens.add({ targets: l, x: l.x + dir * 160, duration: 500, onComplete: () => l.destroy() });
    }
  }

  makeBullet(o) {
    switch (o.kind) {
      case 'flame': { const s = this.add.sprite(0, 0, 'eb-flame0').setOrigin(0.5, 1).setDepth(56); s.play('eb-flame'); return s; }
      case 'bolt': return this.add.rectangle(0, 0, o.r * 2, o.h * 2, 0xf0e040).setStrokeStyle(1, 0xffffff).setDepth(56);
      case 'mark': return this.add.rectangle(0, 0, 10, 2, 0xd84a4a).setDepth(56);
      case 'dust': return this.add.image(0, 0, 'fx-dot').setDepth(56).setTint(0xc08a5a);
      default: return this.add.image(0, 0, BULLET_TEX[o.kind] || 'eb').setDepth(56);
    }
  }

  drawBullet(s, o, now) {
    if (o.kind === 'flame') { s.setPosition(Math.round(o.x), Math.round(o.y + o.h)); return; }
    s.setPosition(Math.round(o.x), Math.round(o.y));
    if (o.kind === 'rock') s.setVisible(!(o.delay > 0));
    if (o.kind === 'bolt') { s.setAlpha(Math.floor(now / 40) % 2 ? 1 : 0.6); s.width = o.r * 2 + (Math.floor(now / 40) % 2 ? 2 : 0); }
    if (o.kind === 'mark') s.setVisible(Math.floor(now / 80) % 2 === 0).setSize(10 + Math.round((1 - o.ttl) * 6), 2);
    if (o.kind === 'dust') { s.setScale(1 + Math.random() * 0.8); s.setPosition(Math.round(o.x + (Math.random() - 0.5) * 8), Math.round(o.y - Math.random() * 4)); }
    if (o.kind === 'lance') s.setFlipX(o.vx < 0);
    if (o.kind === 'rang' || o.kind === 'leaf' || o.kind === 'leafOrb') s.rotation += 0.3;
    if (o.kind === 'seeker') s.setRotation(Math.atan2(o.vy, o.vx));
  }

  drawPlayer(now) {
    const w = this.w; const p = w.p; const s = this.player;
    const key = `hero-${w.weapon}`;
    const shooting = p.shootT > 0;
    let anim;
    if (p.kb > 0) anim = 'hurt';
    else if (p.climb !== null) anim = shooting ? 'shoot' : 'climb';
    else if (!p.onGround) anim = p.vy < 0 ? (shooting ? 'jumpShoot' : 'jump') : (shooting ? 'fallShoot' : 'fall');
    else if (p.moving) anim = shooting ? 'runShoot' : 'run';
    else anim = shooting ? 'shoot' : 'idle';
    const full = `${key}-${anim}`;
    if (s.anims.currentAnim?.key !== full) {
      // keep the run cycle in step when switching between running and running-while-shooting
      const frame = (anim === 'run' || anim === 'runShoot') && s.anims.currentAnim ? s.anims.currentFrame?.index - 1 : 0;
      s.play({ key: full, startFrame: Math.max(0, Math.min(3, frame || 0)) });
    }
    if (p.climb !== null && !shooting) { if (p.moving) s.anims.resume(); else s.anims.pause(); }
    s.setPosition(Math.round(p.x + p.w / 2), Math.round(p.y + p.h));
    s.setFlipX(p.climb !== null && !shooting ? false : p.face < 0);
    const dying = w.mode === 'dying' || w.mode === 'gameover';
    const ready = w.mode === 'ready';
    s.setVisible(!dying && !(ready && w.modeT < 0.55) && !(p.inv > 0 && w.mode !== 'victory' && Math.floor(now / 50) % 2));
    // teleport beam while READY
    this.beam.setVisible(ready && w.modeT < 0.55);
    if (this.beam.visible) {
      this.beam.setFillStyle(Phaser.Display.Color.HexStringToColor(WEAPONS[w.weapon].color).color);
      this.beam.setPosition(Math.round(p.x + p.w / 2), Math.round(Math.min(p.y + p.h, (w.modeT / 0.45) * (p.y + p.h))));
    }
    // charging glow
    if (p.charge >= P.chargeMid && !dying) {
      const fast = p.charge >= P.chargeFull;
      const ph = Math.floor(now / (fast ? 40 : 80)) % 3;
      if (ph === 0) s.setTint(fast ? 0xfff070 : 0xc0f0ff); else if (ph === 1 && fast) s.setTintFill(0xffffff); else s.clearTint();
    } else s.clearTint();
  }

  // ------------------------------------------------------------------ events

  handleEvents() {
    const w = this.w;
    for (const ev of w.events.splice(0)) {
      switch (ev.type) {
        case 'shoot':
          if (ev.weapon === 'buster') fx(ev.kind === 'pellet' ? 'buster' : 'chargeShot');
          else fx({ ember: 'buster', ice: 'ice', thorn: 'swap', volt: 'zap', drill: 'dig', gale: 'buster' }[ev.weapon] || 'buster');
          break;
        case 'charge': fx(ev.level === 2 ? 'charge2' : 'charge1'); break;
        case 'land': fx('land'); break;
        case 'hurt': fx('hurt'); this.hud.flashHurt(); break;
        case 'ehit': fx('ehit'); break;
        case 'ekill': this.boom(ev.x, ev.y, ev.big ? 1.2 : 0.8); fx('enemyDie'); break;
        case 'deflect': this.spark(ev.x, ev.y); fx('deflect'); break;
        case 'fizzle': case 'pop': this.dot(ev.x, ev.y); break;
        case 'blast': fx('blast'); break;
        case 'flame': break;
        case 'break': this.repaint(ev.cells); for (const [x, y] of ev.cells) this.boom(x * TILE + 4, y * TILE + 4, 0.7); fx('blast'); break;
        case 'pickup': this.onPickup(ev); break;
        case 'etankUsed': fx('fill'); break;
        case 'checkpoint': jingle('checkpoint'); this.hud.toast('Checkpoint!'); break;
        case 'hint': this.hint(ev); break;
        case 'swap': fx('swap'); this.hud.weaponFlash(); break;
        case 'empty': fx('empty'); this.hud.toast('Out of energy: pick up blue capsules.', true); break;
        case 'door': case 'doorClose': fx('door'); stopMusic(); break;
        case 'fight': playMusic('boss'); this.hud.bossIntro(BOSSES[w.boss.kind].name); break;
        case 'bossShot': case 'eshot': fx('eshot'); break;
        case 'zap': fx('zap'); break;
        case 'thunder': fx('thunder'); this.cameras.main.shake(180, 0.006); break;
        case 'stomp': fx('stomp'); this.cameras.main.shake(100, 0.004); break;
        case 'gust': fx('wind'); break;
        case 'dig': case 'emerge': fx('dig'); break;
        case 'phase2': this.cameras.main.flash(200, 255, 80, 80); break;
        case 'bhit':
          fx(ev.weak ? 'weak' : 'bossHit');
          if (ev.weak) { this.hud.popText(ev.x, ev.y - 6, 'WEAK!'); this.prog = noteWeak(this.prog, ev.kind); storeProgress({ ...loadProgress(), weakSeen: this.prog.weakSeen }); }
          break;
        case 'bossDown': this.bossBurst(ev.x, ev.y); stopMusic(); fx('bossDie'); this.time.delayedCall(1200, () => jingle('clear')); break;
        case 'death': this.deathBurst(ev.x, ev.y); stopMusic(); fx('death'); report('death'); w.tune = tuneNow(w); break;
        case 'respawn': this.sync(); playMusic(this.def.music); jingle('ready'); break;
        case 'won': this.finish(); return;
        case 'gameover': this.gameOver(); return;
        default: break;
      }
    }
  }

  onPickup(ev) {
    if (ev.kind === 'etank') { fx('pickup'); this.saveFinds(); this.hud.toast('Energy Tank! Use it from the pause menu.'); }
    else if (ev.kind === 'life') { fx('pickup'); jingle('checkpoint'); }
    else fx('fill');
  }

  hint(ev) {
    const seen = save.get('seen') || [];
    if (seen.includes(ev.id)) return;
    save.set('seen', [...seen, ev.id]);
    // wait for READY and the stage name to clear before the first tip
    const wait = Math.max(0, 2600 - this.w.clock * 1000);
    this.time.delayedCall(wait, () => this.hud?.toast(ev.text));
  }

  /** E-tanks found and lives are kept even if the stage is not finished. */
  saveFinds() {
    if (this._leaving || !this.w) return;
    const p = loadProgress();
    storeProgress({ ...p, etanks: this.w.etanks, found: [...new Set([...p.found, ...this.w.found])] });
  }

  // ------------------------------------------------------------------ effects

  boom(x, y, scale = 1) {
    const s = this.add.sprite(x, y, 'fx-boom0').setScale(scale).setDepth(80);
    s.play('fx-boom');
    s.once('animationcomplete', () => s.destroy());
  }

  spark(x, y) {
    const s = this.add.image(x, y, 'fx-spark').setDepth(80);
    this.tweens.add({ targets: s, alpha: 0, scale: 1.6, duration: 160, onComplete: () => s.destroy() });
  }

  dot(x, y) {
    const s = this.add.image(x, y, 'fx-dot').setDepth(80);
    this.tweens.add({ targets: s, alpha: 0, duration: 140, onComplete: () => s.destroy() });
  }

  /** The classic: rings of orbs flying out from where you fell. */
  deathBurst(x, y) {
    for (let i = 0; i < 16; i++) {
      const a = (i % 8) * Math.PI / 4; const r = i < 8 ? 90 : 45;
      const s = this.add.image(x, y, 'fx-ring').setDepth(80);
      this.tweens.add({ targets: s, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, duration: 1300, onComplete: () => s.destroy() });
    }
  }

  bossBurst(x, y) {
    this.cameras.main.shake(400, 0.01);
    this.deathBurst(x, y);
    for (let i = 0; i < 8; i++) this.time.delayedCall(i * 140, () => this.boom(x + (Math.random() - 0.5) * 24, y + (Math.random() - 0.5) * 20, 1.4));
  }

  // ------------------------------------------------------------------ leaving

  finish() {
    if (this._leaving) return;
    const w = this.w;
    const before = loadProgress();
    const p = winStage(before, this.stageId, w);
    storeProgress(p);
    report('boss', w.p.hp / P.maxHp);
    report('clear', w.deaths);
    this._leaving = true;
    const next = this.stageId === 'fort2' ? 'Ending' : 'Result';
    if (this.stageId === 'fort2') {
      save.set('finishes', (save.get('finishes') || 0) + 1);
      const best = save.get('bestTime');
      if (!best || p.time < best) save.set('bestTime', Math.round(p.time));
    }
    this.cameras.main.fadeOut(400, 249, 245, 239);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(next, { stage: this.stageId, first: !before.beaten.includes(this.def.boss) }));
  }

  gameOver() {
    if (this._leaving) return;
    const w = this.w;
    storeProgress(afterGameOver(absorbRun(loadProgress(), w)));
    report('gameover');
    this._leaving = true;
    jingle('gameover');
    this.time.delayedCall(600, () => this.scene.start('GameOver', { stage: this.stageId, cp: w.cp }));
  }

  /** Pause menu: leave the stage, keeping what was found. */
  quit(to) {
    if (this._leaving) return;
    storeProgress(absorbRun(loadProgress(), this.w));
    this._leaving = true;
    stopMusic();
    if (to === 'all') { window.location.href = '../'; return; }
    this.scene.start('Select');
  }
}

/** Adaptive pace changes as soon as you lose a life. */
function tuneNow(w) {
  w.skill = getSkill();
  return tuneFor(w.skill);
}

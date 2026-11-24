import Phaser from 'phaser';
import { sfx } from '../../../shared/core/sfx.js';
import { Game, newState } from '../logic/game.js';
import { TILE, COLS, ROWS, ROOM_W, ROOM_H, AREA_NAMES } from '../logic/constants.js';
import { ROOMS } from '../logic/data.js';
import { paintRoom } from './painter.js';
import { save } from '../save.js';
import { getSkill, report } from '../adaptive.js';
import { DIR_NAME, ITEM } from '../art.js';
import { playMusic, jingle, tuneFor } from '../music.js';
import { objective } from '../logic/story.js';

// The room is drawn at 2x into this part of the 360x640 screen; the HUD scene owns the rest.
export const VIEW = { x: 4, y: 48, w: ROOM_W * 2, h: ROOM_H * 2 };

const SLIME_COLOR = { slime: 'Green', slimelet: 'Green', blueSlime: 'Blue', redSlime: 'Red', slimeKing: 'Red' };
const itemFrame = (name) => ITEM[name][1] * 8 + ITEM[name][0];

export class Play extends Phaser.Scene {
  constructor() { super('Play'); }

  init(data) { this.startData = data || {}; }

  create() {
    let state = this.startData.fresh ? null : save.get('game');
    if (state && state.v !== 1) state = null;
    if (state && state.hp <= 0) state.hp = state.maxHp;
    this.g = new Game({ state: state || newState(), skill: getSkill(), seed: (Date.now() & 0xffff) + 1 });
    if (!state) save.set('game', this.g.s);
    window.__hq = this; // for browser tests and debugging

    const cam = this.cameras.main;
    cam.setViewport(VIEW.x, VIEW.y, VIEW.w, VIEW.h).setZoom(2).setBackgroundColor('#050404');
    cam.centerOn(ROOM_W / 2, ROOM_H / 2);
    cam.setRoundPixels(true);
    document.body.style.background = '#1c1618';

    this.imgs = {
      las: this.textures.get('tileset').getSourceImage(),
      lab: this.textures.get('labTiles').getSourceImage(),
      items: this.textures.get('items').getSourceImage(),
    };
    this.roomTex = [this.textures.exists('roomA') ? this.textures.get('roomA') : this.textures.createCanvas('roomA', ROOM_W, ROOM_H),
      this.textures.exists('roomB') ? this.textures.get('roomB') : this.textures.createCanvas('roomB', ROOM_W, ROOM_H)];
    this.texIdx = 0;
    this.layer = null;          // container holding the live room
    this.player = this.add.sprite(0, 0, 'U-Idle-Down').setOrigin(0.5, 23 / 32);
    this.pShadow = this.add.image(0, 0, 'shadow').setOrigin(0.5, 23 / 32).setAlpha(0.5);
    this.held = this.add.image(0, 0, 'items', 0).setVisible(false).setDepth(9000);
    this.busy = false;          // a scroll / fade is playing
    this.lastSave = 0;
    this.buildRoom();
    this.syncAll(0);

    this.scene.launch('Hud', { play: this });
    this.hud = this.scene.get('Hud');
    this.events.once('shutdown', () => this.scene.stop('Hud'));
    const flush = () => this.saveNow();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);
    this.events.once('shutdown', () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', flush); });
    cam.fadeIn(250);
  }

  /** Pause menu "Reset room": blocks back to their start. */
  resetRoom() {
    this.g.resetRoom();
    this.g.events.length = 0;
    this.dropLayer(this.layer);
    this.buildRoom();
    this.syncAll(0);
    sfx('move');
  }

  /** Jump to a room (browser tests / debugging). */
  debugGoto(id, tx, ty, dir = 'down') {
    this.g.enterRoom(id, tx * TILE + 8, ty * TILE + 8, dir);
    this.g.mode = 'play';
    this.g.events.length = 0;
    this.dropLayer(this.layer);
    this.buildRoom();
    this.syncAll(0);
    this.banner();
  }

  saveNow() { if (this.g) { save.set('game', this.g.s); this.g.dirty = false; this.lastSave = this.time.now; } }

  // ------------------------------------------------------------------ room visuals

  /** Paint the live room into the next canvas and create its sprites, offset by (ox, oy). */
  buildRoom(ox = 0, oy = 0) {
    const tex = this.roomTex[this.texIdx];
    this.texIdx = 1 - this.texIdx;
    paintRoom(tex.getContext(), this.imgs, this.g);
    tex.refresh();
    const layer = this.add.container(ox, oy);
    layer.roomTex = tex;
    layer.bg = this.add.image(0, 0, tex.key).setOrigin(0).setDepth(-1000);
    layer.add(layer.bg);
    layer.ents = new Map();
    layer.setDepth(0);
    // torches
    const r = this.g.room;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (r.map[y][x] === 't') {
          const t = this.add.sprite(x * TILE + 8, y * TILE + 6, 'tileset', 'torch0').play({ key: 'torch', startFrame: (x + y) % 4 });
          layer.add(t);
        }
      }
    }
    layer.add([this.pShadow, this.player, this.held]);
    this.layer = layer;
    return layer;
  }

  /** Destroy a room layer, keeping the player sprites (they move to the next layer). */
  dropLayer(layer) {
    if (!layer) return;
    for (const o of [this.pShadow, this.player, this.held]) layer.remove(o);
    layer.destroy();
  }

  repaint() {
    const tex = this.layer.roomTex;
    paintRoom(tex.getContext(), this.imgs, this.g);
    tex.refresh();
  }

  /** Sprites inside the layer are depth-sorted by their y each frame. */
  syncAll(dt) {
    const g = this.g; const L = this.layer;
    const seen = new Set();
    const want = (id, make) => { seen.add(id); let s = L.ents.get(id); if (!s) { s = make(); s.entId = id; L.ents.set(id, s); L.add(s); } return s; };
    for (const n of g.npcs) {
      const s = want(n.id, () => this.makeNpc(n));
      s.setPosition(n.px, n.py + 7);
      s.shadow.setPosition(n.px, n.py + 7);
      s.setDepth(n.py);
    }
    for (const b of g.blocks) {
      const s = want(b.id, () => this.add.image(0, 0, 'block'));
      s.setPosition(Math.round(b.px), Math.round(b.py)).setDepth(b.py - 4);
    }
    for (const e of g.enemies) {
      const s = want(e.id, () => this.makeEnemy(e));
      this.animEnemy(s, e);
    }
    for (const it of g.pickups) {
      const s = want(it.id, () => this.makePickup(it));
      const bob = it.carried ? 0 : Math.round(Math.sin(this.time.now / 180 + it.id) * 1.5);
      s.setPosition(Math.round(it.x), Math.round(it.y) - 2 + bob).setDepth(it.y + 200);
      s.setVisible(!(it.t < 3 && Math.floor(this.time.now / 90) % 2));
    }
    for (const sh of g.shots) {
      const s = want(sh.id, () => this.add.image(0, 0, 'rock'));
      s.setPosition(Math.round(sh.x), Math.round(sh.y) - 4).setDepth(sh.y + 300);
    }
    for (const b of g.bombs) {
      const s = want(b.id, () => this.add.image(0, 0, 'items', itemFrame('bombs')));
      const hot = b.t < 0.6;
      s.setPosition(b.x, b.y - 2).setDepth(b.y).setScale(hot ? 1 + 0.12 * Math.sin(this.time.now / 30) : 1);
      if (hot && Math.floor(this.time.now / 70) % 2) s.setTintFill(0xff6040); else s.clearTint();
    }
    if (g.boom) {
      const s = want(g.boom.id, () => this.add.image(0, 0, 'items', itemFrame('boomerang')));
      s.setPosition(g.boom.x, g.boom.y).setDepth(g.boom.y + 300);
      s.rotation += dt * 18;
    }
    for (const [id, s] of L.ents) {
      if (!seen.has(id)) {
        s.shadow?.destroy(); s.ring?.destroy(); s.bang?.destroy();
        s.destroy();
        L.ents.delete(id);
      }
    }
    this.animPlayer();
    L.sort('depth');
  }

  makeNpc(n) {
    const s = this.add.sprite(0, 0, 'npcs').setOrigin(0.5, 15 / 16).play({ key: `npc-${n.who}`, startFrame: n.id % 4 });
    s.shadow = this.add.image(0, 0, 'shadow').setOrigin(0.5, 23 / 32).setAlpha(0.4).setScale(0.6);
    this.layer.add(s.shadow);
    s.shadow.setDepth(-500);
    return s;
  }

  makeEnemy(e) {
    let s;
    if (SLIME_COLOR[e.kind]) {
      s = this.add.sprite(0, 0, `${SLIME_COLOR[e.kind]}Slime-Idle`).setOrigin(0.5, 13 / 16);
      if (e.kind === 'slimelet') s.setScale(0.7);
      if (e.kind === 'slimeKing') s.setScale(3);
    } else if (e.kind === 'gremlin' || e.kind === 'hollowKing') {
      s = this.add.sprite(0, 0, 'gremlin', '0_0').setOrigin(0.5, 23 / 32);
      if (e.kind === 'hollowKing') {
        s.setScale(2.4);
        s.baseTint = 0xc79bff;
        s.ring = this.add.circle(0, 0, 23, 0x8a8fc4, 0.25).setStrokeStyle(1, 0xc6b8ff, 0.9);
        this.layer.add(s.ring);
      }
    } else {
      s = this.add.sprite(0, 0, 'golem', '0_0').setOrigin(0.5, 36 / 48);
      if (e.kind === 'golemKing') { s.setScale(1.6); s.baseTint = 0xffb08a; }
    }
    if (s.baseTint) s.setTint(s.baseTint);
    s.shadow = this.add.image(0, 0, 'shadow').setOrigin(0.5, 23 / 32).setAlpha(0.45).setScale(e.boss ? 1.4 : e.w > 12 ? 0.9 : 0.6);
    this.layer.add(s.shadow);
    s.shadow.setDepth(-500);
    s.setAlpha(0);
    this.tweens.add({ targets: s, alpha: 1, duration: 200 });
    return s;
  }

  animEnemy(s, e) {
    const feet = e.y + e.h / 2;
    s.setPosition(Math.round(e.x), Math.round(feet)).setDepth(e.y);
    s.shadow.setPosition(Math.round(e.x), Math.round(feet));
    let key;
    if (SLIME_COLOR[e.kind]) {
      const c = `${SLIME_COLOR[e.kind]}Slime`;
      const d = DIR_NAME[e.dir];
      key = e.anim === 'walk' ? `${c}-Walk${d}` : e.anim === 'attack' ? `${c}-Attack${d}` : e.anim === 'hit' ? `${c}-Hit` : `${c}-Idle`;
      // the Slime King squashes on landing
      if (e.kind === 'slimeKing') {
        // squats down just before it jumps (the tell), stretches tall in the air
        const crouch = e.state === 'rest' && e.t < 0.35;
        s.setScale(3 + (e.state === 'hop' ? -0.15 : crouch ? 0.45 : 0.1), 3 + (e.state === 'hop' ? 0.3 : crouch ? -0.45 : -0.1));
        if (e.state === 'hop') s.y -= Math.round(Math.sin(Math.max(0, 1 - e.t / 0.7) * Math.PI) * 10);
      }
    } else {
      const sheet = e.kind === 'gremlin' || e.kind === 'hollowKing' ? 'gremlin' : 'golem';
      key = `${sheet}-${e.anim === 'hit' ? 'hit' : e.anim === 'attack' ? 'attack' : e.anim === 'walk' ? 'walk' : 'idle'}-${e.dir}`;
      if (e.state === 'windup' && e.kind !== 'hollowKing') s.x += Math.round(Math.sin(this.time.now / 25));
    }
    if (s.anims.currentAnim?.key !== key) s.play(key, true);
    // a "!" over anything about to lunge, charge or throw - the tell to step aside or raise the shield
    const tell = e.state === 'windup';
    if (tell && !s.bang) { s.bang = this.add.image(0, 0, 'bang'); this.layer.add(s.bang); }
    if (s.bang) {
      s.bang.setVisible(tell).setPosition(Math.round(e.x), Math.round(e.y - e.h / 2 - (e.boss ? 26 : 14))).setDepth(e.y + 400);
    }
    // hit flash, stun shimmer
    const flash = e.inv > 0.15 && Math.floor(this.time.now / 50) % 2;
    if (flash) s.setTintFill(0xffffff);
    else if (e.stun > 0 || e.state === 'dazed') s.setTint(Math.floor(this.time.now / 120) % 2 ? 0x8a8fc4 : (s.baseTint || 0xffffff));
    else if (s.baseTint) s.setTint(s.baseTint); else s.clearTint();
    if (e.kind === 'hollowKing') {
      s.ring.setPosition(s.x, e.y - 8).setVisible(e.shield && e.state !== 'vanish');
      s.ring.setScale(1 + 0.06 * Math.sin(this.time.now / 140));
      s.setDepth(e.y);
      s.setAlpha(e.state === 'vanish' ? Math.max(0, e.t / 0.45) : e.state === 'appear' ? 1 - e.t / 0.45 : 1);
      s.ring.setDepth(e.y + 1);
    }
  }

  makePickup(it) {
    switch (it.kind) {
      case 'heart': return this.add.image(0, 0, 'heart');
      case 'heartC': return this.add.image(0, 0, 'heartBig');
      case 'gem5': return this.add.image(0, 0, 'items', itemFrame('gem')).setScale(0.75).setTint(0xff7a7a);
      case 'gem': return this.add.image(0, 0, 'items', itemFrame('gem')).setScale(0.75);
      default: return this.add.image(0, 0, 'items', itemFrame(it.kind));
    }
  }

  animPlayer() {
    const g = this.g; const p = g.p; const s = this.player;
    const set = g.s.items.sword ? 'A' : 'U';
    const D = DIR_NAME[p.dir];
    let key;
    if (g.mode === 'dead') key = 'A-Defeat';
    else if (p.showing && g.mode === 'dialog') key = 'U-ShowItem';
    else if (p.attackT > 0) key = p.dir === 'left' ? 'IA-Attack-Right' : `IA-Attack-${D}`;
    else if (p.kt > 0) key = `${set}-Hit-${D}`;
    else if (p.pushing) key = `${set}-Push-${D}`;
    else if (p.moving) key = `${set}-Walk-${D}`;
    else key = `${set}-Idle-${D}`;
    // The pack's left swing sweeps the wrong way; the right swing mirrored reads correctly.
    s.setFlipX(p.attackT > 0 && p.dir === 'left' && g.mode !== 'dead');
    if (key === 'U-ShowItem') { if (s.texture.key !== 'U-ShowItem') s.setTexture('U-ShowItem', 1); s.anims.stop(); } else if (s.anims.currentAnim?.key !== key || (!s.anims.isPlaying && key.includes('Walk'))) s.play(key);
    s.setPosition(Math.round(p.x), Math.round(p.y + 5)).setDepth(p.y + 0.5);
    this.pShadow.setPosition(s.x, s.y).setDepth(-400);
    s.setAlpha(p.inv > 0 && g.mode === 'play' && Math.floor(this.time.now / 60) % 2 ? 0.25 : 1);
    // item held up while its message is showing
    const it = p.showing && g.mode === 'dialog' ? p.showing : null;
    if (it && it !== 'sword' && (ITEM[it] || it === 'heart')) {
      if (it === 'heart') this.held.setTexture('heartBig'); else this.held.setTexture('items', itemFrame(it === 'gems20' || it === 'gems50' ? 'gem' : it));
      this.held.setPosition(s.x, s.y - 22).setDepth(9000).setVisible(true);
    } else if (it === 'sword') { this.held.setTexture('items', itemFrame('sword')).setPosition(s.x, s.y - 22).setVisible(true); } else this.held.setVisible(false);
  }

  // ------------------------------------------------------------------ loop

  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    const g = this.g;
    if (!this.hud?.ready) return;
    const input = this.hud.readInput();   // read every frame so presses during a slide don't linger
    if (!this.busy) g.update(dt, input);
    this.handleEvents();
    if (!this.busy) this.syncAll(dt);
    else this.animPlayer();
    if (g.dirty && time - this.lastSave > 1500) this.saveNow();
    if (!this.busy) playMusic(g.mode === 'dead' ? null : tuneFor(g.room, g.enemies.some((e) => e.boss && !e.dead)));
  }

  handleEvents() {
    const g = this.g;
    const evs = g.events.splice(0);
    for (const ev of evs) {
      switch (ev.type) {
        case 'sfx': if (!jingle(ev.name)) sfx(ev.name); break;
        case 'cells': this.repaint(); break;
        case 'toast': this.hud.toast(ev.text); break;
        case 'dialog': this.hud.showDialog(ev.lines, ev.item, () => g.closeDialog()); break;
        case 'shop': this.hud.openShop(); break;
        case 'scroll': this.doScroll(ev); break;
        case 'warp': this.doWarp(ev); break;
        case 'dead': this.onDeath(); break;
        case 'ending': this.onEnding(); break;
        case 'boom': this.poof(ev.x, ev.y, 1.6, 0xffb060); this.poof(ev.x + 6, ev.y - 6, 1, 0xffffff); break;
        case 'die': this.poof(ev.x, ev.y, ev.boss ? 2.2 : 0.9, 0xffffff); if (ev.boss) { this.poof(ev.x - 14, ev.y + 4, 1.4); this.poof(ev.x + 14, ev.y - 6, 1.4); } break;
        case 'break': this.shards(ev.x, ev.y, ev.what); break;
        case 'clink': case 'block': this.spark(ev.x, ev.y); break;
        case 'shake': this.cameras.main.shake(ev.ms, 0.012); break;
        case 'hurt': this.hud.flashHurt(); break;
        case 'bossDown': report('boss', ev.hpFrac); g.setSkill(getSkill()); this.saveNow(); break;
        case 'cleared': if (!ev.hurt && g.room.area !== 'ow') { report('cleanRoom'); g.setSkill(getSkill()); } break;
        case 'swing': this.slash(ev.dir); break;
        case 'room': break;
        default: break;
      }
    }
  }

  /** A white crescent sweeping through the sword's reach, so every direction reads clearly. */
  slash(dir) {
    const p = this.g.p;
    const base = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[dir];
    const cx = p.x; const cy = p.y - 3;
    const gr = this.add.graphics().setDepth(p.y + 1);
    this.layer.add(gr);
    const st = { k: 0 };
    this.tweens.add({
      targets: st, k: 1, duration: 170,
      onUpdate: () => {
        gr.clear();
        const a0 = base - 1.1; const a1 = a0 + 2.2 * st.k;
        for (const [r, w, c, al] of [[14, 4, 0xf9f5ef, 0.9], [11, 2, 0x8a8fc4, 0.7]]) {
          gr.lineStyle(w, c, al * (1 - st.k * 0.4));
          gr.beginPath(); gr.arc(cx, cy, r, Math.max(a0, a1 - 1.3), a1); gr.strokePath();
        }
      },
      onComplete: () => this.tweens.add({ targets: gr, alpha: 0, duration: 80, onComplete: () => gr.destroy() }),
    });
  }

  poof(x, y, scale = 1, tint = 0xffffff) {
    const s = this.add.sprite(x + (this.layer?.x || 0), y + (this.layer?.y || 0), 'smoke').setScale(scale).setDepth(5000).setTint(tint);
    s.play('smoke');
    s.once('animationcomplete', () => s.destroy());
  }

  spark(x, y) {
    const s = this.add.image(x, y - 4, 'spark').setDepth(5000);
    this.tweens.add({ targets: s, scale: 2, alpha: 0, duration: 200, onComplete: () => s.destroy() });
  }

  shards(tx, ty, what) {
    const color = what === 'o' ? 0xd88038 : 0x6c8c50;
    for (let i = 0; i < 6; i++) {
      const s = this.add.rectangle(tx * TILE + 8, ty * TILE + 8, 2, 2, color).setDepth(5000);
      const a = (i / 6) * Math.PI * 2;
      this.tweens.add({ targets: s, x: s.x + Math.cos(a) * 12, y: s.y + Math.sin(a) * 10 - 4, alpha: 0, duration: 300, onComplete: () => s.destroy() });
    }
  }

  // ------------------------------------------------------------------ transitions

  doScroll(ev) {
    const old = this.layer;
    const [dx, dy] = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] }[ev.side];
    this.busy = true;
    const neu = this.buildRoom(dx * ROOM_W, dy * ROOM_H);
    this.syncAll(0);
    const cam = this.cameras.main;
    const from = { x: ROOM_W / 2, y: ROOM_H / 2 };
    const to = { x: ROOM_W / 2 + dx * ROOM_W, y: ROOM_H / 2 + dy * ROOM_H };
    const pos = { k: 0 };
    this.tweens.add({
      targets: pos, k: 1, duration: 420, ease: 'Sine.easeInOut',
      onUpdate: () => cam.centerOn(from.x + (to.x - from.x) * pos.k, from.y + (to.y - from.y) * pos.k),
      onComplete: () => {
        this.dropLayer(old);
        neu.setPosition(0, 0);
        cam.centerOn(ROOM_W / 2, ROOM_H / 2);
        this.busy = false;
        this.g.endTransition();
        this.syncAll(0);
        this.banner();
        this.hintGoal();
      },
    });
  }

  doWarp(ev) {
    this.busy = true;
    const cam = this.cameras.main;
    sfx(ev.area === 'in' || ROOMS[ev.from]?.area === 'in' ? 'move' : 'roll');
    cam.fadeOut(160, 5, 4, 4);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.dropLayer(this.layer);
      this.buildRoom();
      this.syncAll(0);
      cam.fadeIn(200, 5, 4, 4);
      this.busy = false;
      this.g.endTransition();
      this.saveNow();
      this.banner();
      this.hintGoal();
    });
  }

  /** Name of the place when you arrive somewhere new. */
  banner(force = false) {
    const r = this.g.room;
    const name = r.area === 'ow' || r.area === 'in' ? r.name : AREA_NAMES[r.area];
    if (!name || (!force && name === this.lastBanner)) return;
    this.lastBanner = name;
    this.hud?.banner?.(name);
  }

  /** "Next: ..." whenever the goal changes (and on the first step outside). */
  hintGoal() {
    const obj = objective(this.g.s);
    if (obj === this.lastObjective || !this.g.s.items.sword) return;
    this.lastObjective = obj;
    this.time.delayedCall(700, () => this.hud.toast(`Next: ${obj}`));
  }

  /** A new game: Elder Bram speaks first. */
  startIntro() {
    const g = this.g;
    if (g.s.items.sword || g.room.id !== 'in:elder' || g.mode !== 'play') return;
    const elder = g.npcs.find((n) => n.who === 'elder');
    if (elder) g.interact({ kind: 'talk', npc: elder });
  }

  onDeath() {
    this.busy = true;
    report('death');
    this.g.setSkill(getSkill());
    this.saveNow();
    sfx('lose');
    this.player.play('A-Defeat');
    this.time.delayedCall(1100, () => {
      this.hud.deathModal(() => {
        this.g.respawn();
        this.g.events.length = 0;
        this.cameras.main.fadeOut(120, 5, 4, 4);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          this.dropLayer(this.layer);
          this.buildRoom();
          this.syncAll(0);
          this.cameras.main.fadeIn(200, 5, 4, 4);
          this.busy = false;
          this.saveNow();
          this.banner(true);
        });
      });
    });
  }

  onEnding() {
    const s = this.g.s;
    s.done = true;
    save.set('finishes', (save.get('finishes') || 0) + 1);
    const best = save.get('bestTime');
    if (!best || s.time < best) save.set('bestTime', Math.round(s.time));
    // after the credits you carry on from Fernwick
    s.respawn = { room: 'ow:0,2', x: 3, y: 6, dir: 'down' };
    this.saveNow();
    this.busy = true;
    this.cameras.main.fadeOut(600, 249, 245, 239);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('Hud');
      this.scene.start('Ending', { stats: { ...s } });
    });
  }
}

// One run through a stage: the player, weapons, enemies, bullets, pickups, checkpoints, the
// boss door and the boss fight. Pure logic with a fixed 60 Hz step, no Phaser. The scene reads
// the state to draw it and drains `events` for sounds and effects.
import { TILE, DT, P, VIEW_W, MAX_ENERGY, MAX_ETANKS, MAX_LIVES, START_LIVES, WEAPONS, WEAPON_ORDER } from './constants.js';
import { Level, moveY, overlap } from './level.js';
import { newPlayer, stepPlayer, hurtPlayer } from './player.js';
import { makeEnemy, STEP, blocks } from './enemies.js';
import { makeBoss, BOSS_STEP, bossDamage, BOSSES } from './bosses.js';
import { tuneFor, rng } from './tune.js';

const clamp = (v, a, z) => Math.max(a, Math.min(z, v));
const ecx = (e) => e.x + e.w / 2;
const ecy = (e) => e.y + e.h / 2;

// Kinds of player shot that stop at walls (the rest fly through, or handle walls themselves)
const SHOT_SIZE = { pellet: [4, 4], mid: [6, 6], full: [10, 8], ember: [5, 5], blast: [22, 22], ice: [10, 3], leaf: [6, 6], volt: [5, 5], drill: [6, 6], gale: [8, 8] };
const SHOT_LIMIT = { pellet: 3, ember: 2, ice: 2, volt: 6, drill: 2, gale: 1 };

export class World {
  /**
   * opts: { stage (def), skill, weapons: [], etanks, lives, seed, found: [ids of E-tanks already taken], cp }
   */
  constructor(opts) {
    const { stage, skill = 0.35, weapons = [], etanks = 0, lives = START_LIVES, seed = 1, found = [], cp = -1 } = opts;
    this.def = stage;
    this.lv = new Level(stage);
    this.skill = skill;
    this.tune = tuneFor(skill);
    this.rand = rng(seed);
    this.weapons = WEAPON_ORDER.filter((k) => k === 'buster' || weapons.includes(k));
    this.weapon = 'buster';
    this.energy = Object.fromEntries(WEAPON_ORDER.map((k) => [k, MAX_ENERGY]));
    this.lives = lives;
    this.etanks = etanks;
    this.found = new Set(found);
    this.taken = new Set();
    this.events = [];
    this.nextId = 1;
    this.time = 0;
    this.clock = 0;
    this.cp = Math.min(cp, this.lv.checkpoints.length - 1);
    this.deaths = 0;
    this.wind = 0;
    this.prev = { jump: false, shoot: false };
    this.hintsShown = new Set();
    this.bossKind = stage.boss;
    this.respawn();
  }

  emit(type, data = {}) { this.events.push({ type, ...data }); }
  id() { return this.nextId++; }

  get p() { return this.player; }

  /** Start (or restart after losing a life) at the last checkpoint. */
  respawn() {
    const lv = this.lv;
    const at = this.cp >= 0 ? lv.checkpoints[this.cp] : lv.start;
    this.player = newPlayer(at.x, at.y);
    this.enemies = [];
    this.shots = [];
    this.bullets = [];
    this.drops = [];
    this.boss = null;
    this.wind = 0;
    lv.doorOpen = false;
    this.spawnState = lv.spawns.map(() => ({ alive: false, blocked: false }));
    for (const it of lv.items) {
      if (it.kind === 'etank' && this.found.has(it.id)) continue;
      if (this.taken.has(it.id)) continue;
      this.drops.push({ id: this.id(), kind: it.kind, x: it.x - 4, y: it.y - 8, w: 8, h: 8, vy: 0, placed: it.id, ttl: Infinity });
    }
    for (const k of WEAPON_ORDER) this.energy[k] = MAX_ENERGY;
    this.mode = 'ready';
    this.modeT = 0;
    this.updateCamera();
  }

  // ------------------------------------------------------------------ main step

  /** One fixed step. inp: held buttons { l, r, u, d, jump, shoot } plus swap (+1/-1 press). */
  step(inp = {}) {
    const dt = DT;
    const jumpP = !!inp.jump && !this.prev.jump;
    const shootP = !!inp.shoot && !this.prev.shoot;
    const shootR = !inp.shoot && this.prev.shoot;
    this.prev = { jump: !!inp.jump, shoot: !!inp.shoot };
    if (inp.swap && (this.mode === 'play' || this.mode === 'boss' || this.mode === 'ready')) this.cycleWeapon(inp.swap);
    this.modeT += dt;
    this.clock += dt;
    switch (this.mode) {
      case 'ready':
        this.time += dt;
        this.updateCamera();
        if (this.modeT >= 1.0) { this.mode = 'play'; this.modeT = 0; }
        break;
      case 'play':
      case 'boss':
        this.time += dt;
        this.playStep(inp, jumpP, shootP, shootR, dt);
        break;
      case 'door': this.doorStep(dt); break;
      case 'bossIntro': this.introStep(dt); break;
      case 'dying':
        this.time += dt;
        this.stepShots(dt, false);
        if (this.modeT >= 1.8) {
          if (this.lives > 0) { this.lives--; this.respawn(); this.emit('respawn'); } else { this.mode = 'gameover'; this.modeT = 0; this.emit('gameover'); }
        }
        break;
      case 'victory': {
        this.time += dt;
        const p = this.p;
        stepPlayer(p, { l: inp.l, r: inp.r, jump: inp.jump, jumpP }, this.lv, this.time, dt);
        p.inv = 1;
        if (p.y > this.lv.H) p.y = this.lv.H - 40;
        this.stepShots(dt, false);
        if (this.modeT >= 3.2) { this.mode = 'won'; this.modeT = 0; this.emit('won'); }
        break;
      }
      default: break; // 'won' and 'gameover' wait for the scene
    }
  }

  playStep(inp, jumpP, shootP, shootR, dt) {
    const p = this.p; const lv = this.lv;
    const ev = stepPlayer(p, { l: inp.l, r: inp.r, u: inp.u, d: inp.d, jump: inp.jump, jumpP }, lv, this.time, dt, { wind: this.wind });
    for (const e of ev) {
      if (e === 'spike') this.hurt(P.spikeDmg, p.x + p.w / 2 + p.face * 4);
      else if (e === 'pit') { this.die(true); return; }
      else this.emit(e);
    }
    this.shooting(inp, shootP, shootR, dt);
    this.updateCamera();
    if (this.mode === 'play') this.spawnEnemies();
    this.stepEnemies(dt);
    if (this.boss && this.mode === 'boss') this.stepBoss(dt);
    this.stepShots(dt, true);
    this.stepBullets(dt);
    this.stepDrops(dt);
    if (this.mode === 'play') {
      this.checkpoints();
      this.hints();
      this.checkDoor();
    }
    if (p.hp <= 0 && this.mode !== 'dying') this.die(false);
  }

  hurt(dmg, fromX) {
    const p = this.p;
    if (this.mode === 'victory') return;
    if (hurtPlayer(p, dmg, fromX)) {
      this.emit('hurt', { dmg });
      // touching an orbiting thorn ring keeps it: no change
      if (p.hp <= 0) this.die(false);
    }
  }

  die(pit) {
    if (this.mode === 'dying') return;
    this.p.hp = 0;
    this.mode = 'dying';
    this.modeT = 0;
    this.deaths++;
    this.wind = 0;
    this.bullets = [];
    this.emit('death', { x: this.p.x + this.p.w / 2, y: this.p.y + this.p.h / 2, pit });
  }

  // ------------------------------------------------------------------ camera, spawns, flags

  updateCamera() {
    const lv = this.lv; const p = this.p;
    let lo = 0; let hi = lv.W - VIEW_W;
    if (lv.doorCol >= 0) {
      if (this.boss) lo = lv.doorCol * TILE;
      else hi = Math.min(hi, (lv.doorCol + 1) * TILE - VIEW_W);
    }
    this.camX = clamp(p.x + p.w / 2 - VIEW_W / 2, lo, Math.max(lo, hi));
  }

  spawnEnemies() {
    const L = this.camX - 4; const R = this.camX + VIEW_W + 4;
    const pc = this.p.x + this.p.w / 2;
    for (const s of this.lv.spawns) {
      const st = this.spawnState[s.id];
      if (s.x < L || s.x > R) { if (s.x < L - 24 || s.x > R + 24) st.blocked = false; continue; }
      if (st.alive || st.blocked) continue;
      if (Math.abs(s.x - pc) < 28) continue; // never pop in on top of the player
      this.enemies.push(makeEnemy(s.kind, s, this, this.id()));
      st.alive = true; st.blocked = true;
    }
  }

  checkpoints() {
    const pc = this.p.x + this.p.w / 2;
    this.lv.checkpoints.forEach((c, i) => {
      if (i > this.cp && pc >= c.x) { this.cp = i; this.emit('checkpoint', { x: c.x, y: c.y }); }
    });
  }

  hints() {
    const pc = this.p.x + this.p.w / 2;
    for (const h of this.def.hints || []) {
      if (!this.hintsShown.has(h.id) && pc >= h.x * TILE) { this.hintsShown.add(h.id); this.emit('hint', { id: h.id, text: h.text }); }
    }
  }

  checkDoor() {
    const lv = this.lv; const p = this.p;
    if (lv.doorCol < 0 || this.boss) return;
    const dx = lv.doorCol * TILE;
    if (p.x + p.w >= dx - 0.05 && p.onGround) {
      const rows = [Math.floor(p.y / TILE), Math.floor((p.y + p.h - 1) / TILE)];
      if (rows.some((r) => lv.tiles[r * lv.cols + lv.doorCol] === 8)) {
        this.mode = 'door'; this.modeT = 0;
        this.shots = []; this.bullets = []; this.enemies = [];
        p.charge = 0; p.vx = 0;
        this.emit('door');
      }
    }
  }

  doorStep(dt) {
    const lv = this.lv; const p = this.p;
    this.time += dt;
    if (this.modeT < 0.5) return;            // shutter rising
    if (!lv.doorOpen) lv.doorOpen = true;
    stepPlayer(p, { r: true }, lv, this.time, dt);
    p.face = 1;
    const lo = lv.doorCol * TILE;
    this.camX = Math.min(lo, this.camX + 150 * dt);
    if (p.x >= lv.arena.x0 + 14 && this.camX >= lo) {
      lv.doorOpen = false;
      this.emit('doorClose');
      this.boss = makeBoss(this.bossKind, this);
      if (this.boss.kind !== 'gate') { this.boss.y = this.boss.kind === 'engine' ? -30 : 2 * TILE; this.boss.onGround = false; }
      this.mode = 'bossIntro'; this.modeT = 0;
      p.moving = false;
    }
  }

  introStep(dt) {
    const b = this.boss; const p = this.p;
    this.time += dt;
    stepPlayer(p, {}, this.lv, this.time, dt);
    if (b.kind === 'engine') b.y += (b.baseY - b.y) * Math.min(1, dt * 3);
    else if (b.kind !== 'gate') {
      b.vy = Math.min(260, b.vy + 520 * dt);
      const r = moveY(this.lv, b, b.vy * dt, this.time, { movers: false });
      if (r.landed && !b.onGround) { b.onGround = true; b.vy = 0; this.emit('stomp'); }
    }
    b.face = p.x < b.x ? -1 : 1;
    if (this.modeT >= 1.9) { this.mode = 'boss'; this.modeT = 0; this.emit('fight'); }
  }

  // ------------------------------------------------------------------ weapons

  cycleWeapon(dir = 1) {
    const list = this.weapons;
    if (list.length < 2) return;
    const i = list.indexOf(this.weapon);
    this.selectWeapon(list[(i + (dir > 0 ? 1 : list.length - 1)) % list.length]);
  }

  selectWeapon(name) {
    if (!this.weapons.includes(name) || name === this.weapon) return;
    this.shots = this.shots.filter((s) => !(s.kind === 'leaf' && s.orbit));
    this.weapon = name;
    this.p.charge = 0;
    this.emit('swap', { weapon: name });
  }

  /** Fill health from an E-tank (pause menu). */
  useEtank() {
    if (this.etanks <= 0 || this.p.hp >= P.maxHp || this.p.hp <= 0) return false;
    this.etanks--;
    this.p.hp = P.maxHp;
    this.emit('etankUsed');
    return true;
  }

  gun() {
    const p = this.p;
    return { x: p.x + p.w / 2 + p.face * 9, y: p.y + p.h - 5 };
  }

  addShot(kind, weapon, cx, cy, vx, vy, extra = {}) {
    const [w, h] = SHOT_SIZE[kind];
    const s = { id: this.id(), kind, weapon, x: cx - w / 2, y: cy - h / 2, w, h, vx, vy, dmg: 1, ttl: 3, t: 0, pierce: false, hit: new Set(), ...extra };
    this.shots.push(s);
    return s;
  }

  count(kind) { return this.shots.filter((s) => s.kind === kind).length; }

  shooting(inp, shootP, shootR, dt) {
    const p = this.p;
    if (this.weapon === 'buster') {
      if (shootP) this.fire('pellet');
      if (inp.shoot) {
        const before = p.charge;
        p.charge += dt;
        if (before < P.chargeMid && p.charge >= P.chargeMid) this.emit('charge', { level: 1 });
        if (before < P.chargeFull && p.charge >= P.chargeFull) this.emit('charge', { level: 2 });
      }
      if (shootR) {
        if (p.charge >= P.chargeFull) this.fire('full'); else if (p.charge >= P.chargeMid) this.fire('mid');
        p.charge = 0;
      }
      if (!inp.shoot) p.charge = 0;
    } else {
      p.charge = 0;
      if (shootP) this.fireSpecial();
    }
  }

  fire(kind) {
    const p = this.p; const g = this.gun();
    if (kind === 'pellet' && this.count('pellet') >= SHOT_LIMIT.pellet) return;
    const sp = { pellet: 160, mid: 170, full: 185 }[kind];
    this.addShot(kind, 'buster', g.x, g.y, p.face * sp, 0, { dmg: kind === 'full' ? 3 : kind === 'mid' ? 2 : 1, pierce: kind === 'full' });
    p.shootT = P.shootAnim;
    this.emit('shoot', { weapon: 'buster', kind });
  }

  fireSpecial() {
    const w = this.weapon; const p = this.p; const g = this.gun();
    const cost = WEAPONS[w].cost;
    // the thorn ring is thrown with a second press, for free
    if (w === 'thorn') {
      const ring = this.shots.filter((s) => s.kind === 'leaf' && s.orbit);
      if (ring.length) {
        for (const s of ring) { s.orbit = false; s.vx = p.face * 140; s.vy = 0; s.ttl = 2; }
        p.shootT = P.shootAnim;
        this.emit('shoot', { weapon: 'thorn', kind: 'throw' });
        return;
      }
    }
    const lim = SHOT_LIMIT[w];
    if (lim && this.shots.filter((s) => s.weapon === w).length >= lim) return;
    if (this.energy[w] < cost) { this.emit('empty'); return; }
    this.energy[w] -= cost;
    p.shootT = P.shootAnim;
    switch (w) {
      case 'ember': this.addShot('ember', w, g.x, g.y - 2, p.face * 85, -150, { dmg: 2, ttl: 3 }); break;
      case 'ice': this.addShot('ice', w, g.x, g.y, p.face * 210, 0, { dmg: 2, pierce: true }); break;
      case 'thorn':
        for (let i = 0; i < 4; i++) this.addShot('leaf', w, g.x, g.y, 0, 0, { dmg: 2, pierce: true, orbit: true, ang: (i * Math.PI) / 2, ttl: 20 });
        break;
      case 'volt':
        for (const a of [-0.42, 0, 0.42]) this.addShot('volt', w, g.x, g.y, Math.cos(a) * 165 * p.face, Math.sin(a) * 165, { dmg: 1 });
        break;
      case 'drill': this.addShot('drill', w, g.x, g.y, p.face * 85, 0, { dmg: 3, ttl: 2.6, ang: p.face > 0 ? 0 : Math.PI }); break;
      case 'gale': this.addShot('gale', w, g.x, g.y, p.face * 175, 0, { dmg: 2, pierce: true, ttl: 3, out: 0.5 }); break;
      default: break;
    }
    this.emit('shoot', { weapon: w });
  }

  /** Top up weapon energy: the one in hand, or the emptiest one if holding the buster. */
  refill(n) {
    let w = this.weapon;
    if (w === 'buster') {
      const owned = this.weapons.filter((k) => k !== 'buster');
      if (!owned.length) return;
      w = owned.reduce((a, b) => (this.energy[b] < this.energy[a] ? b : a));
    }
    this.energy[w] = Math.min(MAX_ENERGY, this.energy[w] + n);
  }

  // ------------------------------------------------------------------ enemies and boss

  stepEnemies(dt) {
    const p = this.p;
    const L = this.camX - 48; const R = this.camX + VIEW_W + 48;
    for (const e of this.enemies) {
      STEP[e.kind](e, this, dt);
      e.inv = Math.max(0, e.inv - dt);
      if (e.x + e.w < L || e.x > R || e.y > this.lv.H + 16 || e.y < -60) { e.gone = true; continue; }
      if (overlap(p, e)) this.hurt(e.dmg, ecx(e));
    }
    for (const e of this.enemies) if (e.gone) this.spawnState[e.spawn].alive = false;
    this.enemies = this.enemies.filter((e) => !e.gone);
  }

  stepBoss(dt) {
    const b = this.boss;
    b.inv = Math.max(0, b.inv - dt);
    BOSS_STEP[b.kind](b, this, dt);
    if (!b.hidden && overlap(this.p, b)) this.hurt(b.dmg, b.x + b.w / 2);
  }

  killEnemy(e) {
    e.gone = true;
    this.spawnState[e.spawn].alive = false;
    this.emit('ekill', { x: ecx(e), y: ecy(e), big: e.w > 8 });
    const chance = Math.min(0.85, 0.28 * this.tune.drop);
    if (this.rand() < chance) {
      const r = this.rand();
      const kind = r < 0.36 ? 'hpSmall' : r < 0.66 ? 'wpSmall' : r < 0.81 ? 'hpBig' : r < 0.96 ? 'wpBig' : 'life';
      this.drops.push({ id: this.id(), kind, x: ecx(e) - 4, y: ecy(e) - 4, w: 8, h: 8, vy: -80, ttl: 7 });
    }
  }

  bossDefeated() {
    const b = this.boss;
    b.hp = 0;
    this.mode = 'victory';
    this.modeT = 0;
    this.bullets = [];
    this.enemies = [];
    this.wind = 0;
    this.emit('bossDown', { x: b.x + b.w / 2, y: b.y + b.h / 2, kind: b.kind });
  }

  // ------------------------------------------------------------------ player shots

  stepShots(dt, live) {
    const lv = this.lv; const p = this.p;
    const L = this.camX - 16; const R = this.camX + VIEW_W + 16;
    for (const s of this.shots) {
      s.t += dt; s.ttl -= dt;
      const cx = s.x + s.w / 2; const cy = s.y + s.h / 2;
      switch (s.kind) {
        case 'ember':
          s.vy = Math.min(260, s.vy + 420 * dt);
          s.x += s.vx * dt; s.y += s.vy * dt;
          if (lv.solid(Math.floor((s.x + s.w / 2) / TILE), Math.floor((s.y + s.h / 2) / TILE), this.time)) this.explode(s);
          break;
        case 'blast': break;
        case 'leaf':
          if (s.orbit) {
            s.ang += 7 * dt;
            s.x = p.x + p.w / 2 + Math.cos(s.ang) * 13 - s.w / 2;
            s.y = p.y + p.h / 2 + Math.sin(s.ang) * 13 - s.h / 2;
            if (this.mode === 'dying') s.dead = true;
          } else { s.x += s.vx * dt; s.y += s.vy * dt; }
          break;
        case 'drill': {
          const tgt = this.nearestTarget(cx, cy);
          if (tgt) {
            const want = Math.atan2(tgt.y - cy, tgt.x - cx);
            let d = want - s.ang;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            s.ang += clamp(d, -3 * dt, 3 * dt);
          }
          s.vx = Math.cos(s.ang) * 90; s.vy = Math.sin(s.ang) * 90;
          s.x += s.vx * dt; s.y += s.vy * dt;
          const tx = Math.floor((s.x + s.w / 2) / TILE); const ty = Math.floor((s.y + s.h / 2) / TILE);
          if (lv.at(tx, ty) === 7) { this.breakBlocks(tx, ty); s.dead = true; } else if (lv.solid(tx, ty, this.time)) { s.dead = true; this.emit('fizzle', { x: cx, y: cy }); }
          break;
        }
        case 'gale': {
          if (s.t < s.out) { s.x += s.vx * dt; s.vx *= 1 - 2.2 * dt; } else {
            const dx = p.x + p.w / 2 - cx; const dy = p.y + p.h / 2 - cy; const d = Math.hypot(dx, dy) || 1;
            s.x += (dx / d) * 175 * dt; s.y += (dy / d) * 175 * dt;
            if (d < 6) s.dead = true;
          }
          // the rang also grabs pickups it passes
          for (const it of this.drops) if (!it.dead && overlap(s, it)) this.collect(it);
          break;
        }
        default:
          s.x += s.vx * dt; s.y += s.vy * dt;
          if (lv.solid(Math.floor((s.x + s.w / 2) / TILE), Math.floor((s.y + s.h / 2) / TILE), this.time)) { s.dead = true; this.emit('fizzle', { x: s.x + s.w / 2, y: s.y + s.h / 2 }); }
      }
      const orbiting = s.kind === 'leaf' && s.orbit;
      if (!orbiting && s.kind !== 'gale' && (s.x + s.w < L || s.x > R || s.y > lv.H + 16 || s.y < -40)) s.dead = true;
      if (s.ttl <= 0) s.dead = true;
    }
    if (live) this.shotHits();
    this.shots = this.shots.filter((s) => !s.dead);
  }

  nearestTarget(x, y) {
    let best = null; let bd = 150;
    const consider = (o) => { const d = Math.hypot(ecx(o) - x, ecy(o) - y); if (d < bd) { bd = d; best = { x: ecx(o), y: ecy(o) }; } };
    for (const e of this.enemies) consider(e);
    if (this.boss && this.mode === 'boss' && !this.boss.hidden) consider(this.boss);
    return best;
  }

  breakBlocks(tx, ty) {
    const lv = this.lv;
    const out = [];
    for (let y = ty - 1; y <= ty + 1; y++) {
      for (let x = tx - 1; x <= tx + 1; x++) {
        if (x >= 0 && y >= 0 && x < lv.cols && y < lv.rows && lv.tiles[y * lv.cols + x] === 7 && !lv.broken.has(y * lv.cols + x)) {
          lv.broken.add(y * lv.cols + x); out.push([x, y]);
        }
      }
    }
    this.emit('break', { cells: out });
  }

  explode(s) {
    s.dead = true;
    const cx = s.x + s.w / 2; const cy = s.y + s.h / 2;
    this.addShot('blast', 'ember', cx, cy, 0, 0, { dmg: 3, ttl: 0.25, pierce: true });
    this.emit('blast', { x: cx, y: cy });
  }

  deflect(s) {
    s.dead = true;
    this.emit('deflect', { x: s.x + s.w / 2, y: s.y + s.h / 2, dir: s.vx > 0 ? -1 : 1 });
  }

  shotHits() {
    const b = this.boss;
    for (const s of this.shots) {
      if (s.dead) continue;
      for (const e of this.enemies) {
        if (e.gone || s.hit.has(e.id) || !overlap(s, e)) continue;
        if (s.kind !== 'blast' && blocks(e, s)) { this.deflect(s); break; }
        if (s.kind === 'ember') { this.explode(s); break; }
        s.hit.add(e.id);
        e.hp -= s.dmg; e.inv = 0.12;
        if (e.hp <= 0) this.killEnemy(e); else this.emit('ehit', { x: ecx(e), y: ecy(e) });
        if (!s.pierce || (s.kind === 'full' && e.hp > 0)) { s.dead = true; break; }
      }
      if (s.dead) continue;
      // boss leaf shields soak up shots (fire burns them away)
      for (const o of this.bullets) {
        if (o.dead || !(o.kind === 'leafOrb' || o.shootable)) continue;
        if (!overlap(s, { x: o.x - o.r, y: o.y - o.r, w: o.r * 2, h: o.r * 2 })) continue;
        if (o.shootable || s.weapon === 'ember') { o.dead = true; this.emit('pop', { x: o.x, y: o.y }); }
        if (s.kind === 'ember') { this.explode(s); break; }
        if (s.kind !== 'blast' && !(s.pierce && o.shootable)) { s.dead = true; if (o.kind === 'leafOrb') this.emit('deflect', { x: o.x, y: o.y, dir: s.vx > 0 ? -1 : 1 }); break; }
      }
      if (s.dead || !b || this.mode !== 'boss' || b.hidden || s.hit.has('boss') || !overlap(s, b)) continue;
      if (b.inv > 0) continue;
      const dmg = b.vulnerable ? bossDamage(b.kind, s) : 0;
      if (dmg <= 0) { if (s.kind === 'ember') this.explode(s); else if (s.kind !== 'blast') this.deflect(s); continue; }
      if (s.kind === 'ember') { this.explode(s); }
      s.hit.add('boss');
      b.hp = Math.max(0, b.hp - dmg);
      b.inv = 0.5;
      const weak = s.weapon === BOSSES[b.kind].weak;
      this.emit('bhit', { weak, x: b.x + b.w / 2, y: b.y, kind: b.kind });
      if (!s.pierce) s.dead = true;
      if (b.hp <= 0) { this.bossDefeated(); return; }
    }
  }

  // ------------------------------------------------------------------ enemy bullets

  bullet(o) {
    const blt = { id: this.id(), kind: 'pellet', r: 2, g: 0, ttl: 6, t: 0, ...o };
    if (blt.h === undefined) blt.h = blt.r;
    this.bullets.push(blt);
    return blt;
  }

  stepBullets(dt) {
    const lv = this.lv; const p = this.p;
    const L = this.camX - 40; const R = this.camX + VIEW_W + 40;
    const ring = this.shots.filter((s) => s.kind === 'leaf' && s.orbit);
    for (const b of this.bullets) {
      if (b.dead) continue;
      if (b.delay > 0) { b.delay -= dt; if (b.delay <= 0) b.g = 420; continue; }
      b.t += dt; b.ttl -= dt;
      switch (b.kind) {
        case 'leafOrb': {
          const o = b.owner;
          if (!o || o.hp <= 0) { b.dead = true; break; }
          b.ang += 5 * dt;
          b.x = o.x + o.w / 2 + Math.cos(b.ang) * 14; b.y = o.y + o.h / 2 + Math.sin(b.ang) * 14;
          break;
        }
        case 'rang': {
          const o = b.owner;
          if (b.t < b.out) { b.x += b.vx * dt; b.vx *= 1 - 2 * dt; } else {
            const dx = o.x + o.w / 2 - b.x; const dy = o.y + o.h / 2 - b.y; const d = Math.hypot(dx, dy) || 1;
            b.x += (dx / d) * 125 * dt; b.y += (dy / d) * 125 * dt;
            if (d < 6) b.dead = true;
          }
          break;
        }
        case 'seeker': {
          const want = Math.atan2(p.y + p.h / 2 - b.y, p.x + p.w / 2 - b.x);
          let a = Math.atan2(b.vy, b.vx);
          let d = want - a;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          a += clamp(d, -b.homing * dt, b.homing * dt);
          b.vx = Math.cos(a) * b.speed; b.vy = Math.sin(a) * b.speed;
          b.x += b.vx * dt; b.y += b.vy * dt;
          break;
        }
        default:
          b.vy += (b.g || 0) * dt;
          b.x += b.vx * dt; b.y += b.vy * dt;
      }
      if (b.kind === 'bomb' && b.vy > 0 && lv.solid(Math.floor(b.x / TILE), Math.floor((b.y + b.r) / TILE), this.time)) {
        const top = Math.floor((b.y + b.r) / TILE) * TILE;
        Object.assign(b, { kind: 'flame', y: top - 4, vx: 0, vy: 0, g: 0, ttl: 0.75, persist: true, r: 4, h: 4, dmg: 2 });
        this.emit('flame', { x: b.x, y: top });
      } else if (b.solid && lv.solid(Math.floor(b.x / TILE), Math.floor(b.y / TILE), this.time)) {
        b.dead = true;
        if (b.kind === 'rock') this.emit('rock', { x: b.x, y: b.y });
      }
      if (b.kind !== 'bolt' && b.kind !== 'mark' && b.kind !== 'dust' && b.kind !== 'leafOrb' && b.kind !== 'rang'
        && (b.x < L || b.x > R || b.y > lv.H + 20 || b.y < -60)) b.dead = true;
      if (b.ttl <= 0) b.dead = true;
      if (b.dead) continue;
      // a thorn ring around the player eats bullets
      if (!b.persist && !b.harmless) {
        for (const s of ring) {
          if (overlap(s, { x: b.x - b.r, y: b.y - b.h, w: b.r * 2, h: b.h * 2 })) { b.dead = true; this.emit('pop', { x: b.x, y: b.y }); break; }
        }
        if (b.dead) continue;
      }
      if (!b.harmless && b.dmg > 0 && overlap(p, { x: b.x - b.r, y: b.y - b.h, w: b.r * 2, h: b.h * 2 })) {
        this.hurt(b.dmg, b.x);
        if (!b.persist) b.dead = true;
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead);
  }

  // ------------------------------------------------------------------ pickups

  stepDrops(dt) {
    const p = this.p;
    for (const d of this.drops) {
      if (d.dead) continue;
      if (!d.placed) {
        d.vy = Math.min(200, d.vy + 420 * dt);
        const r = moveY(this.lv, d, d.vy * dt, this.time);
        if (r.landed) d.vy = 0;
        d.ttl -= dt;
        if (d.ttl <= 0 || d.y > this.lv.H) d.dead = true;
      }
      if (!d.dead && overlap(p, d)) this.collect(d);
    }
    this.drops = this.drops.filter((d) => !d.dead);
  }

  collect(d) {
    if (d.dead) return;
    // a fifth Energy Tank stays where it is until you have room for it
    if (d.kind === 'etank' && this.etanks >= MAX_ETANKS) return;
    d.dead = true;
    const p = this.p;
    switch (d.kind) {
      case 'hpSmall': p.hp = Math.min(P.maxHp, p.hp + 4); break;
      case 'hpBig': p.hp = Math.min(P.maxHp, p.hp + 12); break;
      case 'wpSmall': this.refill(4); break;
      case 'wpBig': this.refill(12); break;
      case 'life': this.lives = Math.min(MAX_LIVES, this.lives + 1); break;
      case 'etank': this.etanks = Math.min(MAX_ETANKS, this.etanks + 1); break;
      default: break;
    }
    if (d.placed && (d.kind === 'life' || d.kind === 'etank')) this.taken.add(d.placed);
    if (d.kind === 'etank' && d.placed) this.found.add(d.placed);
    this.emit('pickup', { kind: d.kind, id: d.placed || null, x: d.x + 4, y: d.y + 4 });
  }

  // ------------------------------------------------------------------ for the HUD

  bossBar() {
    if (!this.boss) return null;
    if (this.mode === 'bossIntro') return Math.min(1, this.modeT / 1.6);
    return this.boss.hp / this.boss.max;
  }
}

export { DT };

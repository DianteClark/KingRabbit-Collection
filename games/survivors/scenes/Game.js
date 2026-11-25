import Phaser from 'phaser';
import { sfx } from '../../../shared/core/sfx.js';
import { reportDaily } from '../../../shared/core/trophies.js';
import { KEY } from '../art.js';
import { WIDTH, HEIGHT } from './common.js';
import { meta, setMeta } from '../save.js';
import { award, stat, GAME_ID } from '../trophies.js';
import { makeRng } from '../logic/rng.js';
import { Grid } from '../logic/grid.js';
import { ENEMIES, BOSSES, WORLD, RUN_SECONDS, MAX_ENEMIES, CHARACTERS, WEAPON_IDS } from '../logic/data.js';
import { waveAt, eventsBetween, spawnCount } from '../logic/waves.js';
import { newBuild, playerStats, xpToNext, weaponStats, hitDamage, hurtDamage, rollOffers, applyOffer, readyEvolutions, describeOffer } from '../logic/build.js';
import { recordRun, dailyScore } from '../logic/meta.js';

const GEM_MAX = 400;
const PROJ_MAX = 140;
const PICK_MAX = 40;
const NUM_MAX = 24;
const HERO_R = 6;
const TAU = Math.PI * 2;

/**
 * The run. Monsters, gems and shots are plain objects in fixed pools with one Image each; hits use
 * a uniform grid (no physics bodies). The Hud scene runs on top and owns input and overlays.
 */
export class Game extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data) { this.opts = data || {}; }

  create() {
    this.padNav = 'off';
    const o = this.opts;
    const m = meta();
    this.meta = m;
    const hero = CHARACTERS[o.hero] ? o.hero : 'wanderer';
    const seed = o.daily ? o.seed : (Math.random() * 0xffffffff) >>> 0;
    const easy = !o.daily && !!o.easy;
    const build = newBuild(hero);
    const shop = o.daily ? {} : m.shop; // the daily is the same for everyone: no shop upgrades
    const stats = playerStats(hero, shop, build.passives, easy);
    this.run = {
      hero, seed, easy, daily: !!o.daily, shop, build, stats,
      t: 0, kills: 0, coins: 0, level: 1, xp: 0, xpNext: xpToNext(1),
      hp: stats.maxHp, revives: stats.revives, x: WORLD.W / 2, y: WORLD.H / 2, face: 1, moving: false,
      invuln: 0, lastHit: 0, paused: null, pending: 0, over: false, won: false, slayer: false,
      boss: null, finalPhase: false, spawnAcc: 0, banner: null, shake: 0, lowHp: false,
    };
    this.rng = makeRng(seed);
    this.cdT = {}; // weapon cooldown timers
    this.speedMul = 1;
    this.god = false;

    this.cameras.main.setBackgroundColor('#1c1618');
    document.body.style.background = '#1c1618';
    this.floor = this.add.tileSprite(0, 0, WIDTH + 2, HEIGHT + 2, 'surv-floor').setOrigin(0).setScrollFactor(0).setDepth(-10);
    this.decorate();
    this.fxUnder = this.add.graphics().setDepth(1);
    this.fx = this.add.graphics().setDepth(20);
    this.fxList = [];

    // pools
    this.enemies = [];
    for (let i = 0; i < MAX_ENEMIES + 4; i++) {
      this.enemies.push({ i, active: false, spr: this.add.image(0, 0, KEY, 'e_bat_0').setVisible(false).setDepth(5), hitT: {} });
    }
    this.gems = [];
    for (let i = 0; i < GEM_MAX; i++) this.gems.push({ active: false, spr: this.add.image(0, 0, KEY, 'i_gem').setVisible(false).setDepth(2) });
    this.picks = [];
    for (let i = 0; i < PICK_MAX; i++) this.picks.push({ active: false, spr: this.add.image(0, 0, KEY, 'i_coin').setVisible(false).setDepth(3) });
    this.shots = [];
    for (let i = 0; i < PROJ_MAX; i++) this.shots.push({ active: false, spr: this.add.image(0, 0, KEY, 'i_knife').setVisible(false).setDepth(8), hits: [] });
    this.orbs = [];
    for (let i = 0; i < 6; i++) this.orbs.push(this.add.image(0, 0, KEY, 'i_shield').setVisible(false).setDepth(9));
    this.nums = [];
    for (let i = 0; i < NUM_MAX; i++) {
      const t = this.add.text(0, 0, '', { fontFamily: 'BoldPixels', fontSize: '16px', color: '#f9f5ef', stroke: '#040303', strokeThickness: 3 }).setOrigin(0.5).setDepth(30).setVisible(false);
      this.nums.push({ t, life: 0 });
    }
    this.grid = new Grid(WORLD.W, WORLD.H, 32, MAX_ENEMIES + 8);
    this.bufA = new Int32Array(MAX_ENEMIES + 8); // forEnemiesNear
    this.bufB = new Int32Array(MAX_ENEMIES + 8); // monster separation
    this.cullT = 0;

    this.heroSpr = this.add.image(this.run.x, this.run.y, KEY, `h_${hero}_0`).setDepth(10);
    this.hpBar = this.add.graphics().setDepth(11);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD.W, WORLD.H);
    cam.startFollow(this.heroSpr, true, 0.2, 0.2);
    cam.roundPixels = true;

    this.scene.launch('Hud', { game: this });
    this.hud = this.scene.get('Hud');
    this.events.once('shutdown', () => { this.scene.stop('Hud'); if (window.__surv?.scene === this) window.__surv.scene = null; });
    this.installDebug();
    stat('runs');
  }

  /** Trees, graves and a pine wall round the edge, placed from a fixed seed. */
  decorate() {
    const r = makeRng(1234);
    this.decor = [];
    const kinds = ['tree1', 'tree2', 'tree3', 'bush', 'grave1', 'grave2', 'cross', 'deadtree', 'pine'];
    for (let i = 0; i < 260; i++) {
      const x = 40 + r() * (WORLD.W - 80); const y = 40 + r() * (WORLD.H - 80);
      if (Math.hypot(x - WORLD.W / 2, y - WORLD.H / 2) < 90) continue;
      this.decor.push(this.add.image(Math.round(x), Math.round(y), KEY, `d_${r.pick(kinds)}`).setDepth(0).setAlpha(0.85));
    }
    for (let p = 0; p <= WORLD.W; p += 14) {
      for (const [x, y] of [[p, 4], [p, WORLD.H - 4], [4, p], [WORLD.W - 4, p]]) this.decor.push(this.add.image(x, y, KEY, r() < 0.5 ? 'd_pine' : 'd_pine2').setDepth(0));
    }
  }

  // ------------------------------------------------------------------ main loop

  update(_, dtMs) {
    const run = this.run;
    let dt = Math.min(0.05, dtMs / 1000) * this.speedMul;
    if (!run.paused && !run.over) {
      while (dt > 0) { const step = Math.min(dt, 1 / 30); this.step(step); dt -= step; if (run.paused || run.over) break; }
    } else if (run.over) this.stepNumbers(dtMs / 1000);
    this.render();
  }

  step(dt) {
    const run = this.run;
    const prevT = run.t;
    if (!run.finalPhase) run.t = Math.min(RUN_SECONDS, run.t + dt);
    run.invuln = Math.max(0, run.invuln - dt);
    this.events_(prevT, run.t);
    this.spawn(dt);
    this.moveHero(dt);
    this.moveEnemies(dt);
    this.contact();
    this.weapons(dt);
    this.moveShots(dt);
    this.movePickups(dt);
    this.stepNumbers(dt);
    if (run.t - run.lastHit >= 180 && !run.untouchable) { run.untouchable = true; award('untouchable'); }
    run.lowHp = run.hp / run.stats.maxHp < 0.3;
  }

  events_(t0, t1) {
    const run = this.run;
    if (t1 <= t0) return;
    for (const ev of eventsBetween(t0, t1)) {
      if (ev.kind === 'elite') this.spawnEnemy(this.rng.pick(waveAt(t1, run.easy).types), { elite: true });
      else if (ev.kind === 'swarm') {
        for (let k = 0; k < 24; k++) this.spawnEnemy('bat', { angle: (k / 24) * TAU, dist: 300 });
        this.banner('A swarm closes in!');
      } else if (ev.kind === 'boss') {
        if (ev.boss.final) this.startFinal();
        this.spawnEnemy(ev.boss.type, { boss: ev.boss });
        this.banner(`${ev.boss.name} appears!`);
        sfx('boom'); this.cameras.main.shake(300, 0.006);
      }
    }
    if (t1 >= 300 && t0 < 300) award('survive-5');
    if (t1 >= 600 && t0 < 600) award('survive-10');
  }

  /** 15:00: dawn. The clock stops, the horde melts, the Horned King comes. */
  startFinal() {
    const run = this.run;
    run.finalPhase = true; run.won = true;
    award('win');
    for (const e of this.enemies) if (e.active && !e.boss) this.removeEnemy(e, true);
    this.time.delayedCall(1800, () => this.banner('Defeat him for the crown!'));
  }

  spawn(dt) {
    const run = this.run;
    if (run.finalPhase) return;
    const w = waveAt(run.t, run.easy);
    const alive = this.alive ?? 0;
    const { n, acc } = spawnCount(run.spawnAcc, w.rate, dt, alive, w.cap);
    run.spawnAcc = acc;
    for (let k = 0; k < n; k++) this.spawnEnemy(this.rng.pick(w.types));
  }

  spawnEnemy(type, { elite = false, boss = null, angle, dist } = {}) {
    const e = this.enemies.find((q) => !q.active && (boss || q.i < MAX_ENEMIES));
    if (!e) return null;
    const run = this.run;
    const def = ENEMIES[type];
    const w = waveAt(run.t, run.easy);
    let x; let y;
    for (let tries = 0; tries < 8; tries++) {
      if (angle != null) { // a ring (swarms)
        x = run.x + Math.cos(angle) * dist; y = run.y + Math.sin(angle) * dist * 0.75;
      } else { // just outside the visible screen, on a random spot of its edge
        const hw = WIDTH / 2 + 28; const hh = HEIGHT / 2 + 28;
        let p = this.rng() * 2 * (hw + hh);
        if (p < 2 * hw) { x = run.x - hw + p; y = run.y + (this.rng() < 0.5 ? -hh : hh); } else { p -= 2 * hw; x = run.x + (this.rng() < 0.5 ? -hw : hw); y = run.y - hh + p; }
      }
      x = Phaser.Math.Clamp(x, 24, WORLD.W - 24); y = Phaser.Math.Clamp(y, 24, WORLD.H - 24);
      if (Math.abs(x - run.x) > WIDTH / 2 + 8 || Math.abs(y - run.y) > HEIGHT / 2 + 8) break;
    }
    const hp = boss ? boss.hp * (run.easy ? 0.7 : 1) : def.hp * w.hpMul * (elite ? 12 : 1);
    Object.assign(e, {
      active: true, type, x, y, hp, maxHp: hp, speed: boss ? boss.speed : def.speed * (elite ? 0.9 : 1) * (0.92 + this.rng() * 0.16),
      dmg: (boss ? boss.dmg : def.dmg * (elite ? 1.5 : 1)), r: def.r * (boss ? boss.scale : elite ? 1.6 : 1), xp: def.xp,
      elite, boss, fr: -1, flash: 0, kbx: 0, kby: 0, numT: 0, anim: this.rng() * 4, hitT: {},
    });
    e.spr.setVisible(true).setFrame(`e_${type}_0`).setScale(boss ? boss.scale : elite ? 1.6 : 1);
    if (elite) e.spr.setTint(0xffd84a); else if (boss) e.spr.setTint(0xff9a9a); else e.spr.clearTint();
    const dep = boss ? 7 : elite ? 6 : 5;
    if (e.spr.depth !== dep) e.spr.setDepth(dep);
    if (boss) run.boss = e;
    return e;
  }

  removeEnemy(e, poof = false) {
    e.active = false;
    e.spr.setVisible(false);
    if (poof) this.addFx({ kind: 'ring', x: e.x, y: e.y, r: 4, r2: 14, life: 0.25, color: 0x8a8fc4 });
    if (this.run.boss === e) this.run.boss = null;
  }

  moveHero(dt) {
    const run = this.run;
    const mv = this.hud?.move || { x: 0, y: 0 };
    const len = Math.hypot(mv.x, mv.y);
    run.moving = len > 0.05;
    if (run.moving) {
      const k = Math.min(1, len);
      run.x = Phaser.Math.Clamp(run.x + (mv.x / len) * k * run.stats.speed * dt, 18, WORLD.W - 18);
      run.y = Phaser.Math.Clamp(run.y + (mv.y / len) * k * run.stats.speed * dt, 18, WORLD.H - 18);
      if (Math.abs(mv.x) > 0.1) run.face = mv.x < 0 ? -1 : 1;
      run.dirX = mv.x / len; run.dirY = mv.y / len;
    }
  }

  moveEnemies(dt) {
    const run = this.run;
    const g = this.grid;
    g.clear();
    let alive = 0;
    for (const e of this.enemies) {
      if (!e.active) continue;
      alive++;
      let dx = run.x - e.x; let dy = run.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      // too far behind: come back in on the side the hero is heading
      if (d > 640 && !e.boss) {
        const a = Math.atan2(run.dirY || 0, run.dirX || 1) + (this.rng() - 0.5) * 1.6;
        e.x = Phaser.Math.Clamp(run.x + Math.cos(a) * 380, 24, WORLD.W - 24);
        e.y = Phaser.Math.Clamp(run.y + Math.sin(a) * 300, 24, WORLD.H - 24);
        continue;
      }
      dx /= d; dy /= d;
      e.x += (dx * e.speed + e.kbx) * dt;
      e.y += (dy * e.speed + e.kby) * dt;
      const decay = Math.exp(-10 * dt);
      e.kbx *= decay; e.kby *= decay;
      e.flash = Math.max(-1, e.flash - dt);
      e.anim += dt * 6;
      e.face = dx < 0 ? -1 : 1;
      g.insert(e.i, e.x, e.y);
    }
    this.alive = alive;
    // keep them from stacking into one blob: push overlapping pairs apart
    for (const e of this.enemies) {
      if (!e.active) continue;
      const buf = this.bufB; const n = g.collect(e.x, e.y, e.r * 2, buf);
      for (let q = 0; q < n; q++) {
        const j = buf[q];
        if (j <= e.i) continue;
        const f = this.enemies[j];
        const dx = f.x - e.x; const dy = f.y - e.y;
        const min = (e.r + f.r) * 0.9;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 === 0) continue;
        const d = Math.sqrt(d2); const push = (min - d) * 0.5;
        const wE = e.boss ? 0 : f.boss ? 1 : 0.5; const wF = 1 - wE;
        e.x -= (dx / d) * push * wE * 2; e.y -= (dy / d) * push * wE * 2;
        f.x += (dx / d) * push * wF * 2; f.y += (dy / d) * push * wF * 2;
      }
    }
  }

  forEnemiesNear(x, y, r, fn) {
    // nested calls (a hit that queries again) get their own buffer
    const buf = this.nearDepth ? new Int32Array(MAX_ENEMIES + 8) : this.bufA;
    this.nearDepth = (this.nearDepth || 0) + 1;
    const n = this.grid.collect(x, y, r + 24, buf);
    for (let q = 0; q < n; q++) {
      const e = this.enemies[buf[q]];
      if (!e.active) continue;
      const rr = r + e.r;
      const dx = e.x - x; const dy = e.y - y;
      if (dx * dx + dy * dy <= rr * rr && fn(e) === false) break;
    }
    this.nearDepth--;
    // bosses are big: the grid only knows their centre, so check them directly
    const b = this.run.boss;
    if (b && b.active && Math.hypot(b.x - x, b.y - y) > r + 24 && Math.hypot(b.x - x, b.y - y) <= r + b.r) fn(b);
  }

  contact() {
    const run = this.run;
    if (run.invuln > 0 || this.god) return;
    let worst = 0;
    this.forEnemiesNear(run.x, run.y, HERO_R, (e) => { worst = Math.max(worst, e.dmg); });
    if (!worst) return;
    const dmg = hurtDamage(worst, waveAt(run.t, run.easy).dmgMul, run.stats.armor);
    run.hp -= dmg;
    run.invuln = 0.45;
    run.lastHit = run.t; run.untouchableArmed = false;
    this.heroFlash = 0.15;
    this.cameras.main.shake(120, 0.005);
    sfx('thud');
    if (run.hp <= 0) this.die();
  }

  die() {
    const run = this.run;
    if (run.revives > 0) {
      run.revives--;
      run.hp = Math.round(run.stats.maxHp * 0.5);
      run.invuln = 2;
      this.forEnemiesNear(run.x, run.y, 120, (e) => { if (!e.boss) this.damageEnemy(e, 9999); });
      this.addFx({ kind: 'ring', x: run.x, y: run.y, r: 10, r2: 120, life: 0.5, color: 0xe3d245 });
      this.banner('Revived!');
      sfx('power');
      return;
    }
    run.hp = 0;
    this.finish(false);
  }

  // ------------------------------------------------------------------ weapons

  nearest(maxD = 260) {
    const run = this.run;
    let best = null; let bd = maxD * maxD;
    this.grid.query(run.x, run.y, maxD, (i) => {
      const e = this.enemies[i];
      if (!e.active) return;
      const d = (e.x - run.x) ** 2 + (e.y - run.y) ** 2;
      if (d < bd) { bd = d; best = e; }
    });
    if (!best && run.boss?.active && Math.hypot(run.boss.x - run.x, run.boss.y - run.y) < maxD + 40) best = run.boss;
    return best;
  }

  randomOnScreen() {
    const cam = this.cameras.main;
    const list = this.enemies.filter((e) => e.active && Math.abs(e.x - cam.midPoint.x) < 300 && Math.abs(e.y - cam.midPoint.y) < 170);
    return list.length ? list[this.rng.int(list.length)] : null;
  }

  /** The crowdiest monster on screen (for Meteor Storm). */
  crowded() {
    let best = null; let bn = -1;
    for (let k = 0; k < 8; k++) {
      const e = this.randomOnScreen();
      if (!e) break;
      let n = 0;
      this.forEnemiesNear(e.x, e.y, 50, () => { n++; });
      if (n > bn) { bn = n; best = e; }
    }
    return best;
  }

  weapons(dt) {
    const run = this.run;
    const { build, stats } = run;
    let orbN = 0;
    for (const id of WEAPON_IDS) {
      const lv = build.weapons[id];
      if (!lv) continue;
      const ev = build.evolved[id] || null;
      const w = weaponStats(id, lv, stats, ev);
      const dmg = hitDamage(w.dmg, stats.might);
      if (id === 'shields') {
        const n = w.count; const spin = run.t * w.spin;
        for (let k = 0; k < n; k++) {
          const a = spin + (k / n) * TAU;
          const ox = run.x + Math.cos(a) * w.radius; const oy = run.y + Math.sin(a) * w.radius;
          const s = this.orbs[orbN++];
          s.setVisible(true).setPosition(ox, oy).setFrame(ev ? 'i_goldshield' : 'i_shield').setScale(ev ? 1.2 : 1);
          this.forEnemiesNear(ox, oy, 8, (e) => {
            if ((e.hitT.sh || 0) > run.t) return;
            e.hitT.sh = run.t + 0.5;
            const kb = ev ? 160 : 60;
            this.damageEnemy(e, dmg, ((e.x - run.x) / w.radius) * kb, ((e.y - run.y) / w.radius) * kb);
          });
        }
        continue;
      }
      if (id === 'aura') {
        this.auraR = w.radius; this.auraEvo = !!ev;
        if ((this.cdT.aura = (this.cdT.aura || 0) - dt) > 0) continue;
        this.cdT.aura = w.tick;
        let hits = 0;
        this.forEnemiesNear(run.x, run.y, w.radius, (e) => { hits++; this.damageEnemy(e, dmg, 0, 0, true); });
        if (ev && hits) run.hp = Math.min(stats.maxHp, run.hp + Math.min(3, hits * w.heal));
        continue;
      }
      if ((this.cdT[id] = (this.cdT[id] || 0) - dt) > 0) continue;
      if (id === 'dagger') {
        const tgt = this.nearest(280);
        let a = tgt ? Math.atan2(tgt.y - run.y, tgt.x - run.x) : Math.atan2(run.dirY || 0, run.dirX || run.face);
        if (ev) a += Math.sin(run.t * 9) * 0.35;
        for (let k = 0; k < w.count; k++) {
          const aa = a + (k - (w.count - 1) / 2) * 0.18;
          this.shot('dagger', run.x, run.y, Math.cos(aa) * w.speed, Math.sin(aa) * w.speed, { dmg, pierce: w.pierce, life: 1.2, frame: ev ? 'i_knife' : 'i_knife', r: 5 });
        }
        if (!ev || this.rng() < 0.25) sfx('shoot');
        this.cdT[id] = w.cd;
      } else if (id === 'boomerang') {
        const tgt = this.nearest(260);
        for (let k = 0; k < w.count; k++) {
          const a = (tgt ? Math.atan2(tgt.y - run.y, tgt.x - run.x) : Math.atan2(run.dirY || 0, run.dirX || run.face)) + (k ? Math.PI : 0);
          this.shot('boom', run.x, run.y, Math.cos(a) * w.speed, Math.sin(a) * w.speed, { dmg, life: 3, frame: 'i_boomerang', r: 7 * stats.area });
        }
        this.cdT[id] = w.cd;
      } else if (id === 'lightning') {
        const first = this.nearest(220) || this.randomOnScreen();
        if (!first) { this.cdT[id] = 0.3; continue; }
        let cur = first; const hit = new Set();
        const pts = [[run.x, run.y - 6]];
        for (let c = 0; c <= w.chains && cur; c++) {
          hit.add(cur); pts.push([cur.x, cur.y]);
          this.damageEnemy(cur, dmg);
          let next = null; let nd = (w.range * stats.area) ** 2;
          this.forEnemiesNear(cur.x, cur.y, w.range * stats.area, (e) => {
            if (hit.has(e)) return;
            const d = (e.x - cur.x) ** 2 + (e.y - cur.y) ** 2;
            if (d < nd) { nd = d; next = e; }
          });
          cur = next;
        }
        this.addFx({ kind: 'bolt', pts, life: 0.18 });
        sfx('hit');
        this.cdT[id] = w.cd;
      } else if (id === 'bomb') {
        for (let k = 0; k < w.count; k++) {
          const tgt = ev ? this.crowded() : (k === 0 ? this.nearest(200) : this.randomOnScreen());
          const tx = tgt ? tgt.x : run.x + (this.rng() - 0.5) * 160; const ty = tgt ? tgt.y : run.y + (this.rng() - 0.5) * 100;
          this.shot('bomb', run.x, run.y, 0, 0, { dmg, life: 0.55, frame: 'i_bomb', tx, ty, sx: run.x, sy: run.y, radius: w.radius, r: 0 });
        }
        this.cdT[id] = w.cd;
      }
    }
    for (; orbN < this.orbs.length; orbN++) this.orbs[orbN].setVisible(false);
    if (!build.weapons.aura) this.auraR = 0;
  }

  shot(kind, x, y, vx, vy, o) {
    const s = this.shots.find((q) => !q.active);
    if (!s) return;
    Object.assign(s, { active: true, kind, x, y, vx, vy, t: 0, back: false, ...o });
    s.hits.length = 0;
    s.spr.setVisible(true).setFrame(o.frame).setRotation(kind === 'dagger' ? Math.atan2(vy, vx) : 0).setScale(1);
  }

  moveShots(dt) {
    const run = this.run;
    for (const s of this.shots) {
      if (!s.active) continue;
      s.t += dt;
      if (s.kind === 'bomb') {
        const k = Math.min(1, s.t / s.life);
        s.x = s.sx + (s.tx - s.sx) * k; s.y = s.sy + (s.ty - s.sy) * k - Math.sin(k * Math.PI) * 30;
        s.spr.setRotation(s.t * 8);
        if (k >= 1) {
          s.active = false; s.spr.setVisible(false);
          this.forEnemiesNear(s.tx, s.ty, s.radius, (e) => this.damageEnemy(e, s.dmg, (e.x - s.tx) * 2, (e.y - s.ty) * 2));
          this.addFx({ kind: 'blast', x: s.tx, y: s.ty, r: s.radius, life: 0.3 });
          if (this.rng() < 0.5) sfx('smallBoom');
        }
        continue;
      }
      if (s.kind === 'boom') {
        // flies out slowing down, then homes back on the hero
        if (!s.back) {
          s.vx *= Math.exp(-2.2 * dt); s.vy *= Math.exp(-2.2 * dt);
          if (Math.hypot(s.vx, s.vy) < 40) s.back = true;
        } else {
          const dx = run.x - s.x; const dy = run.y - s.y; const d = Math.hypot(dx, dy) || 1;
          const sp = Math.min(320, 80 + s.t * 120);
          s.vx = (dx / d) * sp; s.vy = (dy / d) * sp;
          if (d < 12) { s.active = false; s.spr.setVisible(false); continue; }
        }
        s.spr.setRotation(s.t * 14);
      }
      s.x += s.vx * dt; s.y += s.vy * dt;
      if ((s.t > s.life) || s.x < 0 || s.y < 0 || s.x > WORLD.W || s.y > WORLD.H) { s.active = false; s.spr.setVisible(false); continue; }
      this.forEnemiesNear(s.x, s.y, s.r, (e) => {
        if (s.kind === 'boom') {
          if ((e.hitT.bm || 0) > run.t) return;
          e.hitT.bm = run.t + 0.35;
          this.damageEnemy(e, s.dmg, s.vx * 0.3, s.vy * 0.3);
          return;
        }
        if (s.hits.includes(e.i)) return;
        s.hits.push(e.i);
        this.damageEnemy(e, s.dmg, s.vx * 0.25, s.vy * 0.25);
        if (s.hits.length >= s.pierce) { s.active = false; s.spr.setVisible(false); return false; }
      });
    }
  }

  damageEnemy(e, dmg, kbx = 0, kby = 0, quiet = false) {
    if (!e.active) return;
    e.hp -= dmg;
    if (!e.boss || e.flash < -0.25) e.flash = e.boss ? 0.05 : 0.08; // bosses blink, not glow
    if (!e.boss) { e.kbx += kbx; e.kby += kby; }
    if (e.numT <= this.run.t && (!quiet || e.elite || e.boss)) { e.numT = this.run.t + 0.3; this.number(e.x, e.y - 8, dmg); }
    if (!quiet && (this.hitSfxT || 0) < this.run.t) { this.hitSfxT = this.run.t + 0.09; sfx('hit'); }
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    const run = this.run;
    this.removeEnemy(e);
    run.kills++;
    this.addFx({ kind: 'ring', x: e.x, y: e.y, r: 2, r2: e.boss ? 40 : 10, life: 0.2, color: e.boss ? 0xffd84a : 0xf9f5ef });
    if (e.boss) {
      award('boss-1');
      stat('bosses');
      this.drop('chest', e.x, e.y);
      for (let k = 0; k < 10; k++) this.drop('coin', e.x + (this.rng() - 0.5) * 50, e.y + (this.rng() - 0.5) * 50);
      this.gem(e.x, e.y, 100);
      sfx('win');
      this.cameras.main.shake(400, 0.008);
      if (e.boss.final) {
        run.slayer = true; award('slayer');
        this.banner('The Horned King falls!');
        this.time.delayedCall(2500, () => this.finish(true));
      } else this.banner(`${e.boss.name} defeated!`);
      return;
    }
    if (e.elite) { this.drop('chest', e.x, e.y); this.gem(e.x, e.y, 25); return; }
    this.gem(e.x, e.y, e.xp);
    const r = this.rng();
    if (r < 0.035) this.drop('coin', e.x, e.y);
    else if (r < 0.041) this.drop('meat', e.x, e.y);
    else if (r < 0.0435) this.drop('magnet', e.x, e.y);
  }

  // ------------------------------------------------------------------ pickups

  gem(x, y, val) {
    let g = this.gems.find((q) => !q.active);
    if (!g) { // full: fold the value into a random gem
      const o = this.gems[this.rng.int(GEM_MAX)];
      o.val += val; this.styleGem(o); return;
    }
    Object.assign(g, { active: true, x, y, val, pull: false, sp: 0 });
    g.spr.setVisible(true);
    this.styleGem(g);
  }

  styleGem(g) {
    const v = g.val;
    g.spr.setTint(v >= 25 ? 0xff6a6a : v >= 5 ? 0x7ee070 : 0x6ac0ff).setScale(v >= 25 ? 0.9 : v >= 5 ? 0.75 : 0.6);
  }

  drop(kind, x, y) {
    const p = this.picks.find((q) => !q.active);
    if (!p) return;
    Object.assign(p, { active: true, kind, x, y, pull: false, sp: 0, t: 0 });
    p.spr.setVisible(true).setFrame({ coin: 'i_coin', meat: 'i_meat', magnet: 'i_horseshoe', chest: 'i_chest' }[kind]).setScale(kind === 'chest' ? 1.3 : 1);
    if (p.spr.depth !== (kind === 'chest' ? 4 : 3)) p.spr.setDepth(kind === 'chest' ? 4 : 3);
  }

  movePickups(dt) {
    const run = this.run;
    const mag = run.stats.magnet;
    const pull = (o) => {
      const dx = run.x - o.x; const dy = run.y - o.y; const d = Math.hypot(dx, dy) || 1;
      if (!o.pull && d < mag) o.pull = true;
      if (o.pull) {
        o.sp = Math.min(420, o.sp + 600 * dt);
        o.x += (dx / d) * Math.min(d, o.sp * dt); o.y += (dy / d) * Math.min(d, o.sp * dt);
      }
      return d < 10;
    };
    let xp = 0;
    for (const g of this.gems) {
      if (!g.active) continue;
      if (pull(g)) { g.active = false; g.spr.setVisible(false); xp += g.val; }
    }
    if (xp) { this.addXp(xp); if ((this.gemSfxT || 0) < run.t) { this.gemSfxT = run.t + 0.06; sfx('select'); } }
    for (const p of this.picks) {
      if (!p.active) continue;
      p.t += dt;
      // pickups only come to you when you are close; chests never fly
      const got = p.kind === 'chest' ? Math.hypot(run.x - p.x, run.y - p.y) < 14 : (Math.hypot(run.x - p.x, run.y - p.y) < 24 ? pull(p) : false);
      if (!got) continue;
      p.active = false; p.spr.setVisible(false);
      if (p.kind === 'coin') { run.coins += Math.max(1, Math.round(run.stats.coinMul * (1 + this.rng() * 2))); sfx('coin'); }
      else if (p.kind === 'meat') { run.hp = Math.min(run.stats.maxHp, run.hp + 30); sfx('power'); this.number(run.x, run.y - 14, '+30', '#7ee070'); }
      else if (p.kind === 'magnet') { for (const g of this.gems) if (g.active) g.pull = true; sfx('power'); }
      else if (p.kind === 'chest') this.openChest();
    }
  }

  /** Chest: evolves a weapon if one is ready, else levels something you own, else coins. */
  openChest() {
    const run = this.run;
    sfx('levelup');
    const ready = readyEvolutions(run.build);
    if (ready.length) { this.choose({ kind: 'evolve', id: ready[0], level: 1 }, true); return; }
    const ups = rollOffers(run.build, this.rng, 6).filter((o) => (o.kind === 'weapon' && run.build.weapons[o.id]) || (o.kind === 'passive' && run.build.passives[o.id]));
    if (ups.length) { this.choose(ups[0], true); return; }
    run.coins += 20;
    this.banner('Chest: +20 coins');
  }

  addXp(v) {
    const run = this.run;
    run.xp += v * run.stats.xpMul;
    while (run.xp >= run.xpNext) {
      run.xp -= run.xpNext;
      run.level++;
      run.xpNext = xpToNext(run.level);
      run.pending++;
      if (run.level >= 10) award('lv10');
      if (run.level >= 30) award('lv30');
    }
    if (run.pending && !run.paused) this.offerLevel();
  }

  offerLevel() {
    const run = this.run;
    if (!run.pending || run.over) return;
    run.paused = 'level';
    run.offers = rollOffers(run.build, this.rng, 3);
    sfx('levelup');
    this.hud.showLevelUp(run.offers);
  }

  /** Take a level-up card (or a chest prize). */
  choose(o, fromChest = false) {
    const run = this.run;
    const before = run.stats.maxHp;
    if (o.kind === 'gold') run.coins += 25;
    else if (o.kind === 'heal') run.hp = Math.min(run.stats.maxHp, run.hp + 30);
    else applyOffer(run.build, o);
    run.stats = playerStats(run.hero, run.shop, run.build.passives, run.easy);
    run.buildVer = (run.buildVer || 0) + 1;
    run.hp = Math.min(run.stats.maxHp, run.hp + Math.max(0, run.stats.maxHp - before));
    if (o.kind === 'evolve') { award('evolve'); stat('evolutions'); this.cameras.main.flash(250, 255, 230, 120); }
    if (WEAPON_IDS.every((id) => run.build.weapons[id])) award('arsenal');
    if (fromChest) { const d = describeOffer(o); this.banner(`Chest: ${d.name} ${d.tag}`); return; }
    run.pending--;
    run.paused = null;
    if (run.pending) this.time.delayedCall(150, () => { if (!run.paused) this.offerLevel(); });
  }

  // ------------------------------------------------------------------ feel

  number(x, y, v, color = '#f9f5ef') {
    // each number redraws a text texture: keep it to about 8 a second
    const now = this.run.t;
    if (color === '#f9f5ef' && (this.numGate || 0) > now) return;
    this.numGate = now + 0.12;
    const n = this.nums.find((q) => q.life <= 0);
    if (!n) return;
    n.life = 0.45;
    if (n.color !== color) { n.color = color; n.t.setColor(color); }
    n.t.setText(String(v)).setPosition(Math.round(x), Math.round(y)).setVisible(true).setAlpha(1);
  }

  stepNumbers(dt) {
    for (const n of this.nums) {
      if (n.life <= 0) continue;
      n.life -= dt;
      n.t.y -= 30 * dt;
      n.t.setAlpha(Math.min(1, n.life * 4));
      if (n.life <= 0) n.t.setVisible(false);
    }
    for (const f of this.fxList) f.t = (f.t || 0) + dt;
    let w = 0;
    for (let i = 0; i < this.fxList.length; i++) if (this.fxList[i].t < this.fxList[i].life) this.fxList[w++] = this.fxList[i];
    this.fxList.length = w;
    this.heroFlash = Math.max(0, (this.heroFlash || 0) - dt);
  }

  addFx(f) { if (this.fxList.length < 60) this.fxList.push({ ...f, t: 0 }); }

  banner(msg) { this.hud?.banner(msg); }

  render() {
    const run = this.run;
    const cam = this.cameras.main;
    this.floor.setTilePosition(Math.round(cam.scrollX), Math.round(cam.scrollY));
    const moving = run.moving && !run.paused && !run.over;
    this.heroSpr.setPosition(Math.round(run.x), Math.round(run.y)).setFlipX(run.face < 0);
    if (!run.over) this.heroSpr.setFrame(`h_${run.hero}_${moving ? Math.floor(run.t * 8) % 4 : 0}`);
    if (this.heroFlash > 0) this.heroSpr.setTintFill(0xff4040); else this.heroSpr.clearTint();
    this.heroSpr.setAlpha(run.invuln > 0 && !run.over ? 0.6 + 0.4 * Math.sin(run.t * 40) : 1);
    // hero health bar
    this.hpBar.clear();
    const f = Math.max(0, run.hp / run.stats.maxHp);
    this.hpBar.fillStyle(0x040303).fillRect(Math.round(run.x) - 10, Math.round(run.y) + 10, 20, 4);
    this.hpBar.fillStyle(f < 0.3 ? 0xff4040 : 0xa13d3b).fillRect(Math.round(run.x) - 9, Math.round(run.y) + 11, Math.round(18 * f), 2);
    const vx0 = cam.scrollX - 40; const vx1 = cam.scrollX + WIDTH + 40;
    const vy0 = cam.scrollY - 40; const vy1 = cam.scrollY + HEIGHT + 40;
    const on = (x, y) => x > vx0 && x < vx1 && y > vy0 && y < vy1;
    // trees and the pine wall: only what is near the screen is drawn (checked a few times a second)
    if ((this.cullT = (this.cullT || 0) - 1) <= 0) {
      this.cullT = 6;
      for (const d of this.decor) { const v = d.x > vx0 - 80 && d.x < vx1 + 80 && d.y > vy0 - 80 && d.y < vy1 + 80; if (d.visible !== v) d.setVisible(v); }
    }
    for (const e of this.enemies) {
      if (!e.active) continue;
      const vis = !!e.boss || on(e.x, e.y);
      if (e.spr.visible !== vis) e.spr.setVisible(vis);
      if (!vis) continue;
      const fr = Math.floor(e.anim) % 4;
      if (e.fr !== fr || e.frType !== e.type) { e.fr = fr; e.frType = e.type; e.spr.setFrame(`e_${e.type}_${fr}`); }
      e.spr.setPosition(Math.round(e.x), Math.round(e.y)).setFlipX(e.face < 0);
      if (e.flash > 0) e.spr.setTintFill(0xffffff);
      else if (e.spr.isTintFill) { e.spr.clearTint(); if (e.elite) e.spr.setTint(0xffd84a); else if (e.boss) e.spr.setTint(0xff9a9a); }
    }
    for (const g of this.gems) {
      if (!g.active) continue;
      const vis = on(g.x, g.y);
      if (g.spr.visible !== vis) g.spr.setVisible(vis);
      if (vis) g.spr.setPosition(Math.round(g.x), Math.round(g.y));
    }
    for (const p of this.picks) if (p.active) p.spr.setPosition(Math.round(p.x), Math.round(p.y + (p.kind === 'chest' ? 0 : Math.sin(p.t * 5) * 1.5)));
    for (const s of this.shots) if (s.active) s.spr.setPosition(Math.round(s.x), Math.round(s.y));
    // effects
    const u = this.fxUnder; u.clear();
    if (this.auraR) {
      const pulse = 0.12 + 0.05 * Math.sin(run.t * 6);
      u.fillStyle(this.auraEvo ? 0x9a407e : 0xf0d472, pulse).fillCircle(run.x, run.y, this.auraR);
      u.lineStyle(1, this.auraEvo ? 0x9a407e : 0xf0d472, 0.5).strokeCircle(run.x, run.y, this.auraR);
    }
    const g = this.fx; g.clear();
    for (const fx of this.fxList) {
      const k = fx.t / fx.life; const a = 1 - k;
      if (fx.kind === 'ring') { g.lineStyle(2, fx.color, a).strokeCircle(fx.x, fx.y, fx.r + (fx.r2 - fx.r) * k); }
      else if (fx.kind === 'blast') {
        g.fillStyle(0xd88038, 0.5 * a).fillCircle(fx.x, fx.y, fx.r * (0.6 + 0.4 * k));
        g.lineStyle(2, 0xf0d472, a).strokeCircle(fx.x, fx.y, fx.r * (0.6 + 0.4 * k));
      } else if (fx.kind === 'bolt') {
        g.lineStyle(3, 0x8a8fc4, a);
        g.beginPath();
        fx.pts.forEach(([x, y], i) => (i ? g.lineTo(x + (Math.random() - 0.5) * 4, y) : g.moveTo(x, y)));
        g.strokePath();
        g.lineStyle(1, 0xffffff, a);
        g.beginPath();
        fx.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.strokePath();
      }
    }
  }

  // ------------------------------------------------------------------ end

  /** End of the run: bank coins, trophies, daily score, then Results. */
  finish(victory) {
    const run = this.run;
    if (run.over) return;
    run.over = true;
    run.paused = null;
    this.hud.closeOverlays?.();
    const m = meta();
    recordRun(m, { time: run.t, kills: run.kills, coins: run.coins, won: run.won });
    setMeta(m);
    stat('kills', run.kills);
    award('first-run');
    if (run.kills >= 500) award('kills-500');
    if (run.kills >= 2000) award('kills-2000');
    let dailyRes = null; let score = null;
    if (run.daily) {
      score = dailyScore(run.t, run.kills);
      dailyRes = reportDaily(GAME_ID, score);
      award('daily');
    }
    const quit = victory === 'quit';
    if (!victory || quit) {
      this.heroSpr.setFrame(`h_${run.hero}_dead`).clearTint().setAlpha(1);
      if (!quit) sfx('lose');
    }
    this.time.delayedCall(quit ? 100 : 1400, () => {
      this.scene.stop('Hud');
      this.cameras.main.fadeOut(200, 28, 22, 24);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Results', {
        hero: run.hero, time: run.t, kills: run.kills, level: run.level, coins: run.coins, won: run.won, slayer: run.slayer,
        quit, daily: run.daily, seed: run.daily ? run.seed : undefined, easy: run.easy, score, dailyRes, build: run.build,
      }));
    });
  }

  /** window.__surv: test and debug hooks (speed up time, god mode, jump the clock). */
  installDebug() {
    const self = this;
    window.__surv = {
      scene: this,
      get run() { return self.run; },
      speed(n) { self.speedMul = n; },
      god(on = true) { self.god = on; },
      setTime(t) { self.run.t = t; },
      xp(n) { self.addXp(n); },
      hurt(n) { self.run.hp -= n; if (self.run.hp <= 0) self.die(); },
      alive: () => self.alive,
    };
  }
}

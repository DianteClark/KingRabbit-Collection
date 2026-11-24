// Regular enemies. Each kind has a size, hit points, contact damage and a step function.
// They read the world through a small API: w.p (player), w.lv, w.time, w.tune, w.rand(),
// w.bullet({...}) and w.emit(). tune.fire stretches shot intervals, tune.aggro speeds them up.
import { TILE } from './constants.js';
import { moveX, moveY } from './level.js';

export const ENEMY = {
  walker: { w: 12, h: 14, hp: 3, dmg: 3 },
  hardhat: { w: 8, h: 8, hp: 1, dmg: 2 },
  hopper: { w: 8, h: 7, hp: 1, dmg: 2 },
  bat: { w: 8, h: 6, hp: 1, dmg: 2, fly: true },
  flyer: { w: 8, h: 8, hp: 1, dmg: 2, fly: true },
  turret: { w: 8, h: 8, hp: 3, dmg: 2 },
  guard: { w: 12, h: 14, hp: 5, dmg: 3 },
  crawler: { w: 8, h: 6, hp: 2, dmg: 3 },
};

const G = 520;
const pcx = (w) => w.p.x + w.p.w / 2;
const pcy = (w) => w.p.y + w.p.h / 2;
const ecx = (e) => e.x + e.w / 2;
const ecy = (e) => e.y + e.h / 2;

export function makeEnemy(kind, spawn, w, id) {
  const d = ENEMY[kind];
  const e = {
    id, kind, spawn: spawn.id, x: spawn.x - d.w / 2, y: spawn.y - d.h, w: d.w, h: d.h,
    hp: d.hp, dmg: d.dmg, vx: 0, vy: 0, face: pcx(w) < spawn.x ? -1 : 1, t: 0, state: 'idle',
    shield: false, inv: 0, onGround: false, homeY: spawn.y - d.h, fly: !!d.fly,
  };
  if (kind === 'hardhat') { e.state = 'hide'; e.shield = true; e.t = 1.2; }
  if (kind === 'guard') { e.state = 'guard'; e.shield = true; e.t = 1.0; }
  if (kind === 'bat') { e.state = 'hang'; e.y = spawn.y - TILE; }      // hangs from the tile above
  if (kind === 'flyer') { e.vx = e.face * 34 * w.tune.aggro; e.baseY = e.y; }
  if (kind === 'hopper') e.t = 0.5 + w.rand() * 0.5;
  if (kind === 'turret') e.t = 1.0;
  return e;
}

function gravity(e, w, dt) {
  e.vy = Math.min(220, e.vy + G * dt);
  const r = moveY(w.lv, e, e.vy * dt, w.time);
  if (r.landed) { e.vy = 0; e.onGround = true; } else e.onGround = false;
  if (r.bumped) e.vy = 0;
}

/** Is there floor just ahead of a walker's front foot? */
function floorAhead(e, w) {
  const fx = e.face > 0 ? e.x + e.w + 1 : e.x - 1;
  const cy = Math.floor((e.y + e.h + 1) / TILE);
  const cx = Math.floor(fx / TILE);
  return w.lv.solid(cx, cy, w.time) || w.lv.oneWay(cx, cy);
}

function aimed(w, e, speed, dy = 0) {
  const dx = pcx(w) - ecx(e); const dyy = pcy(w) - ecy(e) + dy;
  const d = Math.hypot(dx, dyy) || 1;
  return { vx: (dx / d) * speed, vy: (dyy / d) * speed };
}

export const STEP = {
  walker(e, w, dt) {
    const sp = 20 * w.tune.aggro;
    if (e.onGround && !floorAhead(e, w)) e.face = -e.face;
    if (moveX(w.lv, e, e.face * sp * dt, w.time)) e.face = -e.face;
    gravity(e, w, dt);
  },

  hardhat(e, w, dt) {
    gravity(e, w, dt);
    e.t -= dt;
    const near = Math.abs(pcx(w) - ecx(e)) < 100;
    if (e.state === 'hide') {
      e.shield = true;
      if (e.t <= 0 && near) { e.state = 'peek'; e.t = 0.35; e.face = pcx(w) < ecx(e) ? -1 : 1; }
    } else if (e.state === 'peek') {
      e.shield = false;
      if (e.t <= 0) {
        for (const a of [-0.45, 0, 0.45]) {
          w.bullet({ x: ecx(e), y: ecy(e) - 1, vx: Math.cos(a) * 70 * e.face, vy: Math.sin(a) * 70, dmg: 2 });
        }
        w.emit('eshot');
        e.state = 'open'; e.t = 0.6;
      }
    } else if (e.state === 'open') {
      if (e.t <= 0) { e.state = 'hide'; e.t = 1.6 * w.tune.fire; }
    }
  },

  hopper(e, w, dt) {
    e.t -= dt;
    if (e.onGround) {
      e.vx = 0;
      if (e.t <= 0) {
        e.face = pcx(w) < ecx(e) ? -1 : 1;
        e.vy = -150; e.vx = e.face * 40 * w.tune.aggro; e.onGround = false;
        e.t = (0.85 + w.rand() * 0.5) / w.tune.aggro;
      }
    }
    if (e.vx) moveX(w.lv, e, e.vx * dt, w.time);
    gravity(e, w, dt);
  },

  bat(e, w, dt) {
    e.t += dt;
    if (e.state === 'hang') {
      if (Math.abs(pcx(w) - ecx(e)) < 64 && pcy(w) > e.y) {
        e.state = 'swoop'; e.t = 0;
        const a = aimed(w, e, 55 * w.tune.aggro);
        e.vx = a.vx; e.vy = a.vy;
        w.emit('bat');
      }
      return;
    }
    if (e.state === 'swoop') {
      const a = aimed(w, e, 55 * w.tune.aggro);
      e.vx += (a.vx - e.vx) * Math.min(1, dt * 1.5);
      e.vy += (a.vy - e.vy) * Math.min(1, dt * 1.5);
      if (e.t > 1.6) { e.state = 'rise'; e.t = 0; }
    } else if (e.state === 'rise') {
      e.vx *= 0.96; e.vy = -40;
      if (e.y <= e.homeY) { e.y = e.homeY; e.state = 'rest'; e.t = 0; e.vx = 0; e.vy = 0; }
    } else if (e.state === 'rest') {
      e.vx = 0; e.vy = 0;
      if (e.t > 1.2 * w.tune.fire) e.state = 'hang';
      return;
    }
    e.x += e.vx * dt; e.y += e.vy * dt;
    if (e.x < 0) e.x = 0;
  },

  flyer(e, w, dt) {
    e.t += dt;
    e.x += e.vx * dt;
    e.y = e.baseY + Math.sin(e.t * 3) * 12;
  },

  turret(e, w, dt) {
    e.t -= dt;
    e.face = pcx(w) < ecx(e) ? -1 : 1;
    e.tell = e.t > 0 && e.t < 0.3;
    if (e.t <= 0) {
      if (Math.abs(pcx(w) - ecx(e)) < 120) {
        const a = aimed(w, e, 72);
        w.bullet({ x: ecx(e), y: ecy(e) - 2, vx: a.vx, vy: a.vy, dmg: 3 });
        w.emit('eshot');
      }
      e.t = 2.0 * w.tune.fire;
    }
  },

  guard(e, w, dt) {
    gravity(e, w, dt);
    e.t -= dt;
    if (e.state !== 'hop') e.face = pcx(w) < ecx(e) ? -1 : 1;
    if (e.state === 'guard') {
      e.shield = true;
      if (e.t <= 0 && Math.abs(pcx(w) - ecx(e)) < 130) { e.state = 'open'; e.t = 0.35; }
    } else if (e.state === 'open') {
      e.shield = false;
      if (e.t <= 0) { e.state = 'fire'; e.t = 0.9; e.shots = 0; }
    } else if (e.state === 'fire') {
      e.shield = false;
      if (e.shots < 2 && e.t < 0.9 - e.shots * 0.3) {
        w.bullet({ x: ecx(e) + e.face * 6, y: e.y + e.h - 5, vx: e.face * 90, vy: 0, dmg: 3 });
        w.emit('eshot');
        e.shots++;
      }
      if (e.t <= 0) {
        e.shield = true;
        if (w.rand() < 0.5 * w.tune.aggro) { e.state = 'hop'; e.vy = -140; e.onGround = false; e.t = 0.6; } else { e.state = 'guard'; e.t = 1.6 * w.tune.fire; }
      }
    } else if (e.state === 'hop') {
      moveX(w.lv, e, e.face * 25 * dt, w.time);
      if (e.onGround && e.t < 0.4) { e.state = 'guard'; e.t = 1.4 * w.tune.fire; }
    }
  },

  crawler(e, w, dt) {
    if (e.onGround) e.face = pcx(w) < ecx(e) ? -1 : 1;
    if (moveX(w.lv, e, e.face * 30 * w.tune.aggro * dt, w.time)) e.face = -e.face;
    gravity(e, w, dt);
  },
};

/** Does a player shot travelling with vx get blocked by this enemy's shield? */
export function blocks(e, shot) {
  if (!e.shield) return false;
  if (e.kind === 'hardhat') return true;
  // guards hold their shield in front: shots coming at their face bounce off
  const from = shot.x + shot.w / 2 < ecx(e) ? -1 : 1;
  return from === e.face;
}

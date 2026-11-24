// Enemy types and their behaviours. Each one is readable at a glance:
//   slime       hops about at random, sometimes toward you
//   slimelet    small, quick hopper (red slimes split into two)
//   blueSlime   wobbles, then lunges in a straight line when you line up with it
//   redSlime    slowly but steadily follows you; splits in two when beaten
//   gremlin     keeps its distance and throws rocks (block them with your shield)
//   golem       plods about; when you line up it shakes, then charges until it hits a wall
//               and is dazed (dazed golems take double damage)
//   slimeKing   boss of Mossy Hollow: big hops, sheds slimes as it gets hurt
//   golemKing   boss of the Ember Lab: armour shrugs off the sword unless it is dazed
//               (bomb it, or make it charge into a wall)
//   hollowKing  final boss: a magic shield the boomerang knocks off, rock volleys, teleports
import { DIR_VEC } from './constants.js';

export const ENEMY = {
  slime: { hp: 2, w: 10, h: 8, dmg: 1 },
  slimelet: { hp: 1, w: 8, h: 6, dmg: 1 },
  blueSlime: { hp: 3, w: 10, h: 8, dmg: 1 },
  redSlime: { hp: 4, w: 10, h: 8, dmg: 1 },
  gremlin: { hp: 3, w: 10, h: 10, dmg: 1 },
  golem: { hp: 6, w: 14, h: 14, dmg: 2, heavy: true },
  slimeKing: { hp: 10, w: 32, h: 20, dmg: 1, boss: true },
  golemKing: { hp: 12, w: 26, h: 24, dmg: 2, boss: true, heavy: true },
  hollowKing: { hp: 12, w: 20, h: 22, dmg: 1, boss: true },
};

const DIRS4 = ['down', 'left', 'right', 'up'];

export function makeEnemy(id, kind, x, y, opts = {}) {
  const d = ENEMY[kind];
  return {
    id, kind, x, y, w: d.w, h: d.h, dmg: d.dmg,
    hp: opts.hp ?? d.hp, maxHp: opts.hp ?? d.hp,
    boss: !!d.boss, heavy: !!d.heavy, mini: !!opts.mini,
    dir: 'down', state: 'rest', t: 0.3 + (id % 5) * 0.15, cd: 1 + (id % 3) * 0.4,
    stun: 0, inv: 0, kx: 0, ky: 0, kt: 0, dead: false, anim: 'idle',
    shield: kind === 'hollowKing', phase: 1, spawnT: 0.35, // brief grace when a room loads
  };
}

const dirToward = (dx, dy) => (Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'));

/** Is the enemy "lined up" with the player on a row or column (within tol px), within range? */
function aligned(e, p, tol, range) {
  const dx = p.x - e.x; const dy = p.y - e.y;
  if (Math.abs(dx) < tol && Math.abs(dy) < range) return dy < 0 ? 'up' : 'down';
  if (Math.abs(dy) < tol && Math.abs(dx) < range) return dx < 0 ? 'left' : 'right';
  return null;
}

/** Contact damage applies? (dazed / stunned enemies are harmless, except a stunned boss's bulk) */
export const harmful = (e) => !e.dead && e.spawnT <= 0 && e.stun <= 0 && e.state !== 'dazed' && e.state !== 'vanish' && e.state !== 'appear'
  // the Slime King only hurts as it comes down on you; while it rests it is your turn
  && !(e.kind === 'slimeKing' && !(e.state === 'hop' && e.t < 0.4));

export function updateEnemy(e, g, dt) {
  const T = g.tune;
  e.inv = Math.max(0, e.inv - dt);
  if (e.spawnT > 0) { e.spawnT -= dt; return; }
  if (e.kt > 0) {
    e.kt -= dt;
    g.move(e, e.kx * dt, e.ky * dt);
    return;
  }
  if (e.stun > 0) {
    e.stun -= dt;
    e.anim = 'hit';
    if (e.stun <= 0 && e.kind === 'hollowKing') {
      // shield back up, and he blinks away rather than drifting into you
      e.shield = true; e.state = 'vanish'; e.t = 0.45;
      g.emit({ type: 'sfx', name: 'power' });
    }
    return;
  }
  const p = g.p;
  const dx = p.x - e.x; const dy = p.y - e.y;
  const dist = Math.hypot(dx, dy);
  e.t -= dt;
  e.cd -= dt;
  const AI = BEHAVIOUR[e.kind];
  AI(e, g, dt, { T, p, dx, dy, dist });
}

function hopper(e, g, dt, { T, dx, dy }, speed, restTime, hopTime) {
  if (e.state === 'rest') {
    e.anim = 'idle';
    if (e.t <= 0) {
      e.state = 'hop';
      e.t = hopTime * (0.8 + g.rng() * 0.5);
      e.dir = g.rng() < 0.3 * T.aggro ? dirToward(dx, dy) : DIRS4[Math.floor(g.rng() * 4)];
    }
  } else {
    e.anim = 'walk';
    const [vx, vy] = DIR_VEC[e.dir];
    const r = g.move(e, vx * speed * T.speed * dt, vy * speed * T.speed * dt);
    if (r.blocked) e.dir = DIRS4[Math.floor(g.rng() * 4)];
    if (e.t <= 0) { e.state = 'rest'; e.t = restTime * (0.6 + g.rng() * 0.8) / T.speed; }
  }
}

const BEHAVIOUR = {
  slime(e, g, dt, c) { hopper(e, g, dt, c, 28, 0.9, 0.55); },
  slimelet(e, g, dt, c) { hopper(e, g, dt, c, 44, 0.5, 0.4); },

  blueSlime(e, g, dt, c) {
    const { T, p } = c;
    if (e.state === 'windup') {
      e.anim = 'attack';
      if (e.t <= 0) { e.state = 'lunge'; e.t = 0.42; }
      return;
    }
    if (e.state === 'lunge') {
      e.anim = 'attack';
      const [vx, vy] = DIR_VEC[e.dir];
      const sp = 150 * T.speed;
      const r = g.move(e, vx * sp * dt, vy * sp * dt);
      if (e.t <= 0 || r.blocked) { e.state = 'rest'; e.t = 0.8; e.cd = 1.6 * T.cooldown; }
      return;
    }
    const line = e.cd <= 0 ? aligned(e, p, 9, 64 + 24 * T.aggro) : null;
    if (line) {
      e.dir = line; e.state = 'windup'; e.t = 0.5 * T.windup;
      g.emit({ type: 'sfx', name: 'flip' });
      return;
    }
    hopper(e, g, dt, c, 24, 0.8, 0.5);
  },

  redSlime(e, g, dt, { T, dx, dy, dist }) {
    if (e.state === 'rest') {
      e.anim = 'idle';
      if (e.t <= 0) { e.state = 'chase'; e.t = 0.9; }
      return;
    }
    e.anim = 'walk';
    if (dist > 1) {
      const sp = 26 * T.speed * (0.8 + 0.2 * T.aggro);
      e.dir = dirToward(dx, dy);
      g.move(e, (dx / dist) * sp * dt, (dy / dist) * sp * dt);
    }
    if (e.t <= 0) { e.state = 'rest'; e.t = 0.35 / T.speed; }
  },

  gremlin(e, g, dt, { T, p, dx, dy, dist }) {
    if (e.state === 'windup') {
      e.anim = 'attack';
      e.dir = dirToward(dx, dy);
      if (e.t <= 0) {
        const line = aligned(e, p, 12, 400);
        let vx; let vy;
        if (line) [vx, vy] = DIR_VEC[line];
        else { vx = dx / dist; vy = dy / dist; }
        const sp = 95 * T.projectile;
        g.throwRock(e.x + vx * 6, e.y + vy * 6, vx * sp, vy * sp);
        e.state = 'move'; e.t = 0.6; e.cd = (1.5 + g.rng() * 0.9) * T.cooldown;
      }
      return;
    }
    e.anim = 'walk';
    if (e.t <= 0) { e.t = 0.8 + g.rng(); e.strafe = g.rng() < 0.5 ? 1 : -1; }
    let mx = 0; let my = 0;
    if (dist > 0) {
      const ux = dx / dist; const uy = dy / dist;
      if (dist < 44) { mx = -ux; my = -uy; } else if (dist > 92) { mx = ux; my = uy; } else { mx = -uy * (e.strafe || 1); my = ux * (e.strafe || 1); }
    }
    const sp = 32 * T.speed;
    const r = g.move(e, mx * sp * dt, my * sp * dt);
    if (r.blocked) e.strafe = -(e.strafe || 1);
    e.dir = dist > 0 ? dirToward(dx, dy) : e.dir;
    if (e.cd <= 0 && dist < 140 && (aligned(e, p, 12, 140) || g.rng() < 0.01 * T.aggro)) {
      e.state = 'windup'; e.t = 0.45 * T.windup;
    }
  },

  golem(e, g, dt, c) { charger(e, g, dt, c, { walk: 16, charge: 125, daze: 1.4, range: 120 }); },
  golemKing(e, g, dt, c) {
    charger(e, g, dt, c, { walk: 20, charge: 118, daze: 2.0, range: 200 });
    // Keep bombs coming in the boss room so it can always be beaten.
    g.bossBombSupply(dt);
  },

  slimeKing(e, g, dt, { T, dx, dy, dist }) {
    const fast = e.hp <= e.maxHp / 2 ? 1.3 : 1;
    if (e.state === 'rest') {
      e.anim = 'idle';
      if (e.t <= 0) { e.state = 'hop'; e.t = 0.7; e.aim = dist > 0 ? [dx / dist, dy / dist] : [0, 1]; e.dir = dirToward(dx, dy); }
      return;
    }
    e.anim = 'walk';
    const sp = 46 * T.speed * fast;
    g.move(e, e.aim[0] * sp * dt, e.aim[1] * sp * dt);
    if (e.t <= 0) {
      e.state = 'rest'; e.t = (0.75 + g.rng() * 0.4) / (T.speed * fast);
      g.emit({ type: 'sfx', name: 'thud' }); g.emit({ type: 'shake', ms: 80 });
    }
  },

  hollowKing(e, g, dt, { T, dx, dy, dist }) {
    const fast = e.phase === 2 ? 1.25 : 1;
    e.dir = dirToward(dx, dy);
    if (e.state === 'vanish') {
      e.anim = 'idle';
      if (e.t <= 0) {
        const spot = g.farSpot(e, 64);
        e.x = spot[0]; e.y = spot[1];
        e.state = 'appear'; e.t = 0.45;
        g.emit({ type: 'sfx', name: 'flip' });
      }
      return;
    }
    if (e.state === 'appear') { if (e.t <= 0) { e.state = 'hover'; e.t = 1.2; } return; }
    if (e.state === 'windup') {
      e.anim = 'attack';
      if (e.t <= 0) {
        const n = e.phase === 2 ? 5 : 3;
        const base = Math.atan2(dy, dx);
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * 0.32;
          const sp = 88 * T.projectile * fast;
          g.throwRock(e.x + Math.cos(a) * 8, e.y + Math.sin(a) * 8, Math.cos(a) * sp, Math.sin(a) * sp);
        }
        e.state = 'hover'; e.t = 0.9; e.cd = (2.2 / fast) * T.cooldown;
        e.volleys = (e.volleys || 0) + 1;
      }
      return;
    }
    // hover: drift toward a target point, now and then throw or teleport
    e.anim = 'walk';
    if (!e.target || e.t <= 0) { e.target = g.randomSpot(e); e.t = 1.4; }
    const tx = e.target[0] - e.x; const ty = e.target[1] - e.y; const td = Math.hypot(tx, ty);
    if (td > 2) {
      const sp = 40 * T.speed * fast;
      g.move(e, (tx / td) * sp * dt, (ty / td) * sp * dt);
    }
    if (e.cd <= 0) {
      if ((e.volleys || 0) >= 2 && g.rng() < 0.6) { e.state = 'vanish'; e.t = 0.45; e.volleys = 0; g.emit({ type: 'sfx', name: 'flip' }); } else { e.state = 'windup'; e.t = 0.55 * T.windup; }
    }
  },
};

function charger(e, g, dt, { T, p, dx, dy }, o) {
  if (e.state === 'dazed') {
    e.anim = 'hit';
    if (e.t <= 0) { e.state = 'walk'; e.t = 1; e.cd = 0.8 * T.cooldown; }
    return;
  }
  if (e.state === 'windup') {
    e.anim = 'attack';
    if (e.t <= 0) { e.state = 'charge'; e.t = 3; g.emit({ type: 'sfx', name: 'roll' }); }
    return;
  }
  if (e.state === 'charge') {
    e.anim = 'walk';
    const [vx, vy] = DIR_VEC[e.dir];
    const sp = o.charge * T.speed;
    const r = g.move(e, vx * sp * dt, vy * sp * dt);
    if (r.blocked || e.t <= 0) {
      e.state = 'dazed'; e.t = o.daze;
      if (r.blocked) { g.emit({ type: 'sfx', name: 'thud' }); g.emit({ type: 'shake', ms: e.boss ? 160 : 90 }); }
    }
    return;
  }
  // walk
  e.anim = 'walk';
  if (e.state !== 'walk') { e.state = 'walk'; e.t = 1; }
  if (e.t <= 0) {
    e.t = 1 + g.rng() * 1.2;
    e.dir = g.rng() < 0.5 * T.aggro ? dirToward(dx, dy) : DIRS4[Math.floor(g.rng() * 4)];
  }
  const [vx, vy] = DIR_VEC[e.dir];
  const r = g.move(e, vx * o.walk * T.speed * dt, vy * o.walk * T.speed * dt);
  if (r.blocked) e.t = 0;
  const line = e.cd <= 0 ? aligned(e, p, 10, o.range) : null;
  if (line && g.lineClear(e.x, e.y, p.x, p.y)) {
    e.dir = line; e.state = 'windup'; e.t = (e.boss ? 0.8 : 0.6) * T.windup;
  }
}

/**
 * Apply a hit. src: 'sword' | 'boom' | 'bomb'. Returns 'hit' | 'clink' | 'stun' | 'none' | 'kill'.
 */
export function hurtEnemy(e, dmg, src, fx, fy) {
  if (e.dead || e.inv > 0) return 'none';
  const dazed = e.stun > 0 || e.state === 'dazed';
  if (e.kind === 'golemKing') {
    if (src === 'bomb') { e.stun = Math.max(e.stun, 3); dmg = 2; } else if (src === 'sword' && dazed) dmg = 1;
    else return 'clink';
  } else if (e.kind === 'hollowKing') {
    if (e.shield) {
      if (src === 'boom') { e.shield = false; e.stun = 2.8; e.state = 'hover'; e.inv = 0.2; return 'stun'; }
      return 'clink';
    }
    if (src === 'boom') return 'none';
  } else if (src === 'boom') {
    if (e.kind === 'slimelet') dmg = 1;
    else {
      e.stun = Math.max(e.stun, e.boss ? 1.2 : 1.8);
      return 'stun';
    }
  } else if (e.heavy && dazed && src === 'sword') dmg *= 2;
  e.hp -= dmg;
  e.inv = e.boss ? 0.5 : 0.3;
  // knockback away from the hit
  const ax = e.x - fx; const ay = e.y - fy; const d = Math.hypot(ax, ay) || 1;
  const k = e.boss || e.heavy ? 50 : 160;
  e.kx = (ax / d) * k; e.ky = (ay / d) * k; e.kt = e.boss ? 0.1 : 0.16;
  if (e.state === 'lunge' || e.state === 'windup') { e.state = 'rest'; e.t = 0.6; }
  if (e.hp <= 0) { e.dead = true; return 'kill'; }
  return 'hit';
}

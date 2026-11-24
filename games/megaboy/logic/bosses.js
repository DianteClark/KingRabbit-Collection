// The six robot bosses and the two fortress guardians. Every move starts with a tell (a pose,
// a flash or a marker on the floor) that the renderer shows, then the attack, then a rest.
// tune.bossPause only stretches the rests; boss HP is always BOSS_HP.
import { TILE, BOSS_HP } from './constants.js';
import { moveX, moveY } from './level.js';

export const BOSSES = {
  ember: { name: 'EMBER', weapon: 'ember', weak: 'ice', stage: 'foundry', dmg: 3 },
  glacia: { name: 'GLACIA', weapon: 'ice', weak: 'gale', stage: 'cryo' },
  thorn: { name: 'THORN', weapon: 'thorn', weak: 'ember', stage: 'jungle' },
  volt: { name: 'VOLT', weapon: 'volt', weak: 'drill', stage: 'power' },
  drill: { name: 'DRILL', weapon: 'drill', weak: 'thorn', stage: 'mine' },
  gale: { name: 'GALE', weapon: 'gale', weak: 'volt', stage: 'sky' },
  gate: { name: 'GATEKEEPER', weapon: null, weak: 'gale', stage: 'fort1', w: 24, h: 28, dmg: 4 },
  engine: { name: 'NULL ENGINE', weapon: null, weak: 'volt', stage: 'fort2', w: 32, h: 20, dmg: 5 },
};
export const ROBOT_BOSSES = ['ember', 'glacia', 'thorn', 'volt', 'drill', 'gale'];

const G = 520;
const pcx = (w) => w.p.x + w.p.w / 2;
const pcy = (w) => w.p.y + w.p.h / 2;
const bcx = (b) => b.x + b.w / 2;
const bcy = (b) => b.y + b.h / 2;
const clamp = (v, a, z) => Math.max(a, Math.min(z, v));

export function makeBoss(kind, w) {
  const d = BOSSES[kind];
  const bw = d.w || 10; const bh = d.h || 14;
  const at = w.lv.bossAt || { x: w.lv.arena.x1 - 40, y: 12 * TILE };
  const b = {
    kind, name: d.name, x: at.x - bw / 2, y: at.y - bh, w: bw, h: bh, hp: BOSS_HP, max: BOSS_HP,
    face: -1, vx: 0, vy: 0, state: 'idle', t: 1.0, inv: 0, onGround: true, dmg: d.dmg || 4,
    vulnerable: true, hidden: false, tell: null, anim: 'idle', n: 0, phase: 1, flip: 0,
  };
  b.floorY = at.y;
  if (kind === 'engine') { b.y = at.y - 56; b.floorY = at.y; b.state = 'sweep'; b.t = 3.5; b.dir = -1; b.baseY = at.y - 50; }
  if (kind === 'gate') { b.state = 'closed'; b.t = 1.2; b.vulnerable = false; }
  return b;
}

/** Ground bosses fall and land on the arena floor. */
function fall(b, w, dt) {
  b.vy = Math.min(260, b.vy + G * dt);
  const r = moveY(w.lv, b, b.vy * dt, w.time, { movers: false });
  const was = b.onGround;
  b.onGround = r.landed;
  if (r.landed) b.vy = 0;
  if (r.bumped) b.vy = 0;
  return r.landed && !was;
}

function slide(b, w, dx) { return moveX(w.lv, b, dx, w.time); }
const facePlayer = (b, w) => { b.face = pcx(w) < bcx(b) ? -1 : 1; };
const rest = (w, s) => s * w.tune.bossPause;

/** A lob that lands at (tx, ty) after `time` seconds under gravity g. */
function lob(b, w, tx, ty, time, g) {
  const x = bcx(b) + b.face * 6; const y = b.y + 3;
  return { x, y, vx: (tx - x) / time, vy: (ty - y) / time - 0.5 * g * time, g };
}

export const BOSS_STEP = {
  ember(b, w, dt) {
    b.t -= dt;
    const landed = fall(b, w, dt);
    switch (b.state) {
      case 'idle':
        b.anim = 'idle'; b.tell = null; facePlayer(b, w);
        if (b.t <= 0) {
          if (b.n % 3 === 2 || Math.abs(pcx(w) - bcx(b)) > 80) { b.state = 'crouch'; b.t = 0.4; } else { b.state = 'raise'; b.t = 0.45; }
          b.n++;
        }
        break;
      case 'crouch':
        b.anim = 'crouch'; b.tell = 'jump';
        if (b.t <= 0) {
          b.vy = -230; b.onGround = false;
          b.vx = clamp((pcx(w) - bcx(b)) / 0.88, -95, 95);
          b.state = 'jump'; w.emit('bossJump');
        }
        break;
      case 'jump':
        b.anim = 'jump'; b.tell = null;
        slide(b, w, b.vx * dt);
        if (landed) { b.state = 'idle'; b.t = rest(w, 0.55); w.emit('stomp'); }
        break;
      case 'raise':
        b.anim = 'shoot'; b.tell = 'throw'; facePlayer(b, w);
        if (b.t <= 0) { b.state = 'throw'; b.t = 0.8; b.shots = 0; }
        break;
      case 'throw':
        b.anim = 'shoot'; b.tell = null;
        if (b.shots < 3 && b.t < 0.8 - b.shots * 0.25) {
          const tx = pcx(w) + [-18, 0, 18][b.shots];
          w.bullet({ kind: 'bomb', ...lob(b, w, tx, b.floorY - 3, 0.8, 400), dmg: 2, r: 3 });
          w.emit('bossShot');
          b.shots++;
        }
        if (b.t <= 0) { b.state = 'idle'; b.t = rest(w, 0.8); }
        break;
      default: b.state = 'idle';
    }
  },

  glacia(b, w, dt) {
    b.t -= dt;
    fall(b, w, dt);
    switch (b.state) {
      case 'idle':
        b.anim = 'idle'; b.tell = null; facePlayer(b, w);
        if (b.t <= 0) {
          if (b.n >= 3) { b.state = 'crouch'; b.t = 0.45; b.n = 0; } else { b.state = 'aim'; b.t = 0.45; b.lane = b.n === 1 ? 'high' : 'low'; b.n++; }
        }
        break;
      case 'aim':
        b.anim = b.lane === 'high' ? 'shoot' : 'crouch'; b.tell = b.lane;
        if (b.t <= 0) {
          const y = b.lane === 'high' ? b.floorY - 22 : b.floorY - 5;
          w.bullet({ kind: 'lance', x: bcx(b) + b.face * 8, y, vx: b.face * 130, vy: 0, dmg: 3, r: 3, solid: true });
          w.emit('bossShot');
          b.state = 'idle'; b.t = rest(w, 0.55);
        }
        break;
      case 'crouch':
        b.anim = 'crouch'; b.tell = 'skate';
        if (b.t <= 0) { b.state = 'skate'; b.t = 3; b.face = bcx(b) < (w.lv.arena.x0 + w.lv.arena.x1) / 2 ? 1 : -1; w.emit('skate'); }
        break;
      case 'skate':
        b.anim = 'skate'; b.tell = null;
        if (slide(b, w, b.face * 125 * dt) || b.t <= 0) { b.face = -b.face; b.state = 'idle'; b.t = rest(w, 0.6); }
        break;
      default: b.state = 'idle';
    }
  },

  thorn(b, w, dt) {
    b.t -= dt;
    const landed = fall(b, w, dt);
    switch (b.state) {
      case 'idle':
        b.anim = 'idle'; b.tell = null; facePlayer(b, w);
        if (b.t <= 0) { b.state = 'form'; b.t = 0.6; }
        break;
      case 'form':
        b.anim = 'shoot'; b.tell = 'form';
        if (b.t <= 0) {
          for (let i = 0; i < 4; i++) w.bullet({ kind: 'leafOrb', owner: b, ang: (i * Math.PI) / 2, x: bcx(b), y: bcy(b), vx: 0, vy: 0, dmg: 3, r: 3, persist: true, ttl: 12 });
          w.emit('leaves');
          b.state = 'hop'; b.t = 0.35; b.hops = 0;
        }
        break;
      case 'hop':
        b.anim = b.onGround ? 'idle' : 'jump'; b.tell = null;
        if (b.onGround && b.t <= 0) {
          if (b.hops >= 2) { b.state = 'aim'; b.t = 0.35; break; }
          facePlayer(b, w);
          b.vy = -190; b.vx = b.face * 50; b.onGround = false; b.hops++;
        }
        if (!b.onGround) slide(b, w, b.vx * dt);
        if (landed) { b.t = rest(w, 0.3); w.emit('stomp'); }
        break;
      case 'aim':
        b.anim = 'shoot'; b.tell = 'throw'; facePlayer(b, w);
        if (b.t <= 0) {
          for (const s of w.bullets) {
            if (s.kind !== 'leafOrb' || s.owner !== b) continue;
            const dx = pcx(w) - s.x; const dy = pcy(w) - s.y; const d = Math.hypot(dx, dy) || 1;
            s.kind = 'leaf'; s.vx = (dx / d) * 100; s.vy = (dy / d) * 100; s.ttl = 3; s.persist = false;
          }
          w.emit('bossShot');
          b.state = 'idle'; b.t = rest(w, 1.1);
        }
        break;
      default: b.state = 'idle';
    }
  },

  volt(b, w, dt) {
    b.t -= dt;
    const landed = b.state === 'hover' ? false : fall(b, w, dt);
    switch (b.state) {
      case 'idle':
        b.anim = 'idle'; b.tell = null; facePlayer(b, w);
        if (b.t <= 0) {
          if (b.n % 2 === 1) { b.state = 'crouch'; b.t = 0.35; } else { b.state = 'charge'; b.t = 0.55; }
          b.n++;
        }
        break;
      case 'charge':
        b.anim = 'shoot'; b.tell = 'spark'; facePlayer(b, w);
        if (b.t <= 0) {
          const base = Math.atan2(pcy(w) - bcy(b), pcx(w) - bcx(b));
          for (const a of [-0.38, 0, 0.38]) w.bullet({ kind: 'spark', x: bcx(b), y: bcy(b), vx: Math.cos(base + a) * 95, vy: Math.sin(base + a) * 95, dmg: 3, r: 3 });
          w.emit('zap');
          b.state = 'idle'; b.t = rest(w, 0.6);
        }
        break;
      case 'crouch':
        b.anim = 'crouch'; b.tell = 'jump';
        if (b.t <= 0) {
          const mid = (w.lv.arena.x0 + w.lv.arena.x1) / 2;
          b.vy = -250; b.vx = clamp((mid - bcx(b)) / 0.9, -70, 70); b.onGround = false; b.state = 'leap'; w.emit('bossJump');
        }
        break;
      case 'leap':
        b.anim = 'jump'; b.tell = null;
        slide(b, w, b.vx * dt);
        if (b.vy >= 0) { b.state = 'hover'; b.t = 0.7; b.vy = 0; b.strikeX = clamp(pcx(w), w.lv.arena.x0 + 6, w.lv.arena.x1 - 6); w.bullet({ kind: 'mark', x: b.strikeX, y: b.floorY - 2, vx: 0, vy: 0, dmg: 0, r: 4, ttl: 0.7, harmless: true }); }
        break;
      case 'hover':
        b.anim = 'shoot'; b.tell = 'call';
        if (b.t <= 0) {
          w.bullet({ kind: 'bolt', x: b.strikeX, y: b.floorY / 2, vx: 0, vy: 0, dmg: 4, r: 5, h: b.floorY / 2, ttl: 0.35, persist: true });
          w.emit('thunder');
          b.state = 'fall'; b.vy = 0;
        }
        break;
      case 'fall':
        b.anim = 'jump'; b.tell = null;
        if (landed) { b.state = 'idle'; b.t = rest(w, 0.6); w.emit('stomp'); }
        break;
      default: b.state = 'idle';
    }
  },

  drill(b, w, dt) {
    b.t -= dt;
    switch (b.state) {
      case 'idle':
        fall(b, w, dt);
        b.anim = 'idle'; b.tell = null; b.hidden = false; b.vulnerable = true; facePlayer(b, w);
        if (b.t <= 0) { if (b.n % 2 === 0) { b.state = 'dig'; b.t = 0.4; } else { b.state = 'aim'; b.t = 0.4; } b.n++; }
        break;
      case 'dig':
        b.anim = 'crouch'; b.tell = 'dig'; b.vulnerable = false;
        if (b.t <= 0) { b.state = 'under'; b.t = 0.45; b.hidden = true; w.emit('dig'); }
        break;
      case 'under':
        b.hidden = true; b.vulnerable = false; b.tell = null;
        if (b.t <= 0) {
          b.digX = clamp(pcx(w), w.lv.arena.x0 + 10, w.lv.arena.x1 - 10);
          b.state = 'mark'; b.t = 0.65;
          w.bullet({ kind: 'dust', x: b.digX, y: b.floorY - 2, vx: 0, vy: 0, dmg: 0, r: 4, ttl: 0.65, harmless: true });
        }
        break;
      case 'mark':
        b.hidden = true; b.vulnerable = false;
        if (b.t <= 0) {
          b.x = b.digX - b.w / 2; b.y = b.floorY - b.h; b.vy = -220; b.onGround = false;
          b.hidden = false; b.vulnerable = true; b.state = 'emerge'; w.emit('emerge');
        }
        break;
      case 'emerge': {
        b.anim = 'jump'; b.tell = null;
        b.vy = Math.min(260, b.vy + G * dt); b.y += b.vy * dt;
        if (b.vy > 0 && b.y + b.h >= b.floorY) { b.y = b.floorY - b.h; b.vy = 0; b.onGround = true; b.state = 'idle'; b.t = rest(w, 0.5); w.emit('stomp'); }
        break;
      }
      case 'aim':
        fall(b, w, dt);
        b.anim = 'shoot'; b.tell = 'aim'; facePlayer(b, w);
        if (b.t <= 0) {
          for (const a of [-0.6, 0.6]) w.bullet({ kind: 'seeker', x: bcx(b) + b.face * 6, y: bcy(b), vx: b.face * 50 * Math.cos(a), vy: 50 * Math.sin(a), dmg: 3, r: 3, ttl: 3.2, homing: 1.4, speed: 50, shootable: true, solid: true });
          w.emit('bossShot');
          b.state = 'idle'; b.t = rest(w, 0.9);
        }
        break;
      default: b.state = 'idle';
    }
  },

  gale(b, w, dt) {
    b.t -= dt;
    const landed = fall(b, w, dt);
    w.wind = 0;
    switch (b.state) {
      case 'idle':
        b.anim = 'idle'; b.tell = null; facePlayer(b, w);
        if (b.t <= 0) {
          const k = b.n % 3; b.n++;
          if (k === 2) { b.state = 'gust'; b.t = 0.5; } else { b.state = 'windup'; b.t = 0.35; }
        }
        break;
      case 'windup':
        b.anim = 'shoot'; b.tell = 'throw'; facePlayer(b, w);
        if (b.t <= 0) {
          const high = b.n % 2 === 0;
          w.bullet({ kind: 'rang', owner: b, x: bcx(b) + b.face * 6, y: high ? b.floorY - 20 : b.floorY - 6, vx: b.face * 125, vy: 0, dmg: 3, r: 4, persist: true, ttl: 4, out: 0.75 });
          w.emit('bossShot');
          b.state = 'idle'; b.t = rest(w, 0.7);
        }
        break;
      case 'gust':
        b.anim = 'shoot'; b.tell = 'gust'; facePlayer(b, w);
        if (b.t <= 0) { b.state = 'blow'; b.t = 1.8; w.emit('gust'); }
        break;
      case 'blow':
        b.anim = 'shoot'; b.tell = 'blow';
        w.wind = (pcx(w) < bcx(b) ? -1 : 1) * 30;
        if (b.t <= 0) {
          w.wind = 0;
          const mid = (w.lv.arena.x0 + w.lv.arena.x1) / 2;
          const dest = bcx(b) < mid ? w.lv.arena.x1 - 30 : w.lv.arena.x0 + 30;
          b.vy = -250; b.vx = clamp((dest - bcx(b)) / 0.96, -130, 130); b.onGround = false; b.state = 'leap'; w.emit('bossJump');
        }
        break;
      case 'leap':
        b.anim = 'jump'; b.tell = null;
        slide(b, w, b.vx * dt);
        if (landed) { b.state = 'idle'; b.t = rest(w, 0.6); w.emit('stomp'); }
        break;
      default: b.state = 'idle';
    }
  },

  gate(b, w, dt) {
    b.t -= dt;
    switch (b.state) {
      case 'closed':
        b.vulnerable = false; b.tell = null; b.anim = 'closed';
        if (b.n % 2 === 1 && !b.dropped && b.t < 1.0) {
          b.dropped = true;
          for (const k of [0, 1]) {
            const x = clamp(pcx(w) + (k ? 1 : -1) * (10 + w.rand() * 30), w.lv.arena.x0 + 8, b.x - 8);
            w.bullet({ kind: 'mark', x, y: b.floorY - 2, vx: 0, vy: 0, dmg: 0, r: 4, ttl: 0.7, harmless: true });
            w.bullet({ kind: 'rock', x, y: 6, vx: 0, vy: 0, g: 0, dmg: 3, r: 4, delay: 0.7, solid: true });
          }
        }
        if (b.t <= 0) { b.state = 'opening'; b.t = 0.45; }
        break;
      case 'opening':
        b.anim = 'opening'; b.tell = 'open';
        if (b.t <= 0) { b.state = 'open'; b.t = 1.9; b.shots = 0; b.vulnerable = true; w.emit('eyeOpen'); }
        break;
      case 'open':
        b.anim = 'open'; b.tell = null; b.vulnerable = true;
        if (b.shots < 3 && b.t < 1.6 - b.shots * 0.5) {
          const sx = b.x + 4; const sy = b.y + b.h / 2;
          const dx = pcx(w) - sx; const dy = pcy(w) - sy; const d = Math.hypot(dx, dy) || 1;
          w.bullet({ kind: 'orb', x: sx, y: sy, vx: (dx / d) * 80, vy: (dy / d) * 80, dmg: 3, r: 3 });
          w.emit('bossShot');
          b.shots++;
        }
        if (b.t <= 0) { b.state = 'closing'; b.t = 0.3; }
        break;
      case 'closing':
        b.anim = 'opening'; b.vulnerable = false;
        if (b.t <= 0) { b.state = 'closed'; b.t = rest(w, 1.7); b.n++; b.dropped = false; }
        break;
      default: b.state = 'closed';
    }
  },

  engine(b, w, dt) {
    b.t -= dt;
    if (b.phase === 1 && b.hp <= BOSS_HP / 2) { b.phase = 2; w.emit('phase2'); }
    const fast = b.phase === 2 ? 1.3 : 1;
    const ax0 = w.lv.arena.x0 + 6; const ax1 = w.lv.arena.x1 - 6 - b.w;
    switch (b.state) {
      case 'sweep': {
        b.anim = 'fly'; b.tell = null; b.vulnerable = true;
        b.x += b.dir * 45 * fast * dt;
        if (b.x < ax0) { b.x = ax0; b.dir = 1; }
        if (b.x > ax1) { b.x = ax1; b.dir = -1; }
        b.flip += dt;
        b.y = b.baseY + Math.sin(b.flip * 2) * 8;
        b.fireT = (b.fireT ?? 0.8) - dt;
        if (b.fireT <= 0) {
          b.fireT = 1.2 * w.tune.bossPause / fast;
          const n = b.phase === 2 ? 5 : 3;
          const base = Math.atan2(pcy(w) - bcy(b), pcx(w) - bcx(b));
          for (let i = 0; i < n; i++) {
            const a = base + (i - (n - 1) / 2) * 0.32;
            w.bullet({ kind: 'orb', x: bcx(b), y: b.y + b.h, vx: Math.cos(a) * 75, vy: Math.sin(a) * 75, dmg: 3, r: 3 });
          }
          w.emit('bossShot');
        }
        if (b.t <= 0) { b.state = 'warn'; b.t = 0.6; }
        break;
      }
      case 'warn':
        b.anim = 'fly'; b.tell = 'dive';
        if (b.t <= 0) {
          b.state = 'dive'; b.diveDir = bcx(b) < (ax0 + ax1) / 2 ? 1 : -1; b.t = 4;
          b.diveY = b.floorY - 15 - b.h; w.emit('dive');
        }
        break;
      case 'dive':
        b.anim = 'fly'; b.tell = null;
        b.y += (b.diveY - b.y) * Math.min(1, dt * 4);
        if (Math.abs(b.y - b.diveY) < 3) b.x += b.diveDir * 85 * fast * dt;
        if (b.x < ax0 || b.x > ax1 || b.t <= 0) {
          b.x = clamp(b.x, ax0, ax1);
          b.state = 'climb'; b.t = 1;
        }
        break;
      case 'climb':
        b.anim = 'fly';
        b.y += (b.baseY - b.y) * Math.min(1, dt * 3);
        if (b.phase === 2 && !b.orbed) {
          b.orbed = true;
          w.bullet({ kind: 'seeker', x: bcx(b), y: b.y + b.h, vx: 0, vy: 40, dmg: 3, r: 3, ttl: 3.5, homing: 1.6, speed: 48, shootable: true });
        }
        if (b.t <= 0) { b.state = 'sweep'; b.t = rest(w, 3.6) / fast; b.dir = -b.diveDir; b.flip = 0; b.orbed = false; }
        break;
      default: b.state = 'sweep';
    }
  },
};

/** Damage a player shot does to a boss: 4 with its weakness, 0 with its own weapon. */
export function bossDamage(kind, shot) {
  const d = BOSSES[kind];
  if (shot.weapon === d.weak) return 4;
  if (shot.weapon === d.weapon) return 0;
  if (shot.weapon === 'buster') return shot.kind === 'full' ? 3 : shot.kind === 'mid' ? 2 : 1;
  return 1;
}

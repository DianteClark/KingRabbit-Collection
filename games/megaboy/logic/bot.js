// A boss-fighting bot for tests: proves every boss can be beaten through the real simulation.
// Each frame it tries a handful of short plans (stand, jump, step left or right, with or
// without a jump) by running the real player physics half a second ahead against where the
// bullets and the boss will be, picks the safest, faces the boss and keeps shooting.
import { DT, TILE, P, WEAPONS } from './constants.js';
import { overlap } from './level.js';
import { stepPlayer } from './player.js';
import { BOSSES } from './bosses.js';

const H = 32; // frames to look ahead

const PLANS = [
  { l: 0, r: 0, j: 0 }, { l: 0, r: 0, j: 1 },
  { l: 1, r: 0, j: 0 }, { l: 0, r: 1, j: 0 },
  { l: 1, r: 0, j: 1 }, { l: 0, r: 1, j: 1 },
];

function predictBullet(b, t) {
  switch (b.kind) {
    case 'leafOrb': case 'flame': case 'bolt': return { x: b.x, y: b.y };
    default: return { x: b.x + b.vx * t, y: b.y + b.vy * t + 0.5 * (b.g || 0) * t * t };
  }
}

/** Walk the player up to the shutter and through it; returns once the fight has begun. */
export function enterBossRoom(w, maxSteps = 4000) {
  const lv = w.lv;
  w.mode = 'play';
  const p = w.p;
  p.x = lv.doorCol * TILE - p.w - 30; p.y = lv.bossAt.y - p.h; p.vy = 0; p.onGround = true;
  w.cp = lv.checkpoints.length - 1;
  for (let i = 0; i < maxSteps && w.mode !== 'boss'; i++) w.step({ r: w.mode === 'play' });
  return w.mode === 'boss';
}

export class BossBot {
  constructor(w, { weapon = null, etanks = true } = {}) {
    this.w = w; this.weapon = weapon; this.useTanks = etanks;
    this.prevBoss = null; this.t = 0; this.plan = PLANS[0]; this.planT = 0;
  }

  input() {
    const w = this.w; const p = w.p; const b = w.boss;
    this.t++;
    if (!b || w.mode !== 'boss') return {};
    // use the chosen weapon while it has energy, then fall back to the buster
    const has = this.weapon && w.weapons.includes(this.weapon) && w.energy[this.weapon] >= WEAPONS[this.weapon].cost;
    const want0 = has ? this.weapon : 'buster';
    if (w.weapon !== want0 && !(w.weapon === 'thorn' && w.shots.some((s) => s.orbit))) w.selectWeapon(want0);
    if (this.useTanks && p.hp <= 10) w.useEtank();
    const bv = this.prevBoss ? { x: (b.x - this.prevBoss.x) / DT, y: (b.y - this.prevBoss.y) / DT } : { x: 0, y: 0 };
    this.prevBoss = { x: b.x, y: b.y };

    // choose a plan (switch when the current one gets clearly worse)
    {
      const scores = PLANS.map((pl) => this.score(pl, bv));
      let best = 0;
      for (let i = 1; i < PLANS.length; i++) if (scores[i] > scores[best] + 1e-6) best = i;
      const cur = PLANS.indexOf(this.plan);
      if (this.planT <= 0 || scores[cur] < scores[best] - 0.5) { this.plan = PLANS[best]; this.planT = 6; }
    }
    this.planT--;
    const pl = this.plan;
    const inp = { l: !!pl.l, r: !!pl.r, jump: !!pl.j && (p.onGround || p.vy < 0) };
    // face the boss: if standing still and looking the wrong way, tap toward it
    const bc = b.x + b.w / 2; const pc = p.x + p.w / 2;
    const want = bc < pc ? -1 : 1;
    if (!pl.l && !pl.r && p.face !== want && Math.abs(bc - pc) > 6) { if (want < 0) inp.l = true; else inp.r = true; }
    // shoot: tap the button whenever the boss is roughly in line (homing weapons always)
    const gunY = p.y + p.h - 5;
    const inLine = (gunY > b.y - 6 && gunY < b.y + b.h + 6) || ['drill', 'volt', 'ember', 'thorn', 'gale'].includes(w.weapon);
    inp.shoot = inLine && p.face === want && this.t % 6 < 3 && !b.hidden;
    if (w.weapon === 'thorn') inp.shoot = this.t % 20 < 2;
    return inp;
  }

  score(pl, bv) {
    const w = this.w; const lv = w.lv; const b = w.boss;
    const q = { ...w.p };
    let firstHit = H + 1;
    let aligned = false;
    let t = w.time;
    const ar = lv.arena;
    for (let f = 0; f < H; f++) {
      const inp = { l: !!pl.l, r: !!pl.r, jump: !!pl.j && f < 40, jumpP: !!pl.j && f === 0 };
      t += DT;
      stepPlayer(q, inp, lv, t, DT, { wind: w.wind });
      const dt = (f + 1) * DT;
      const bb = { x: b.x + bv.x * dt, y: b.y + bv.y * dt, w: b.w, h: b.h };
      if (!b.hidden && overlap(q, bb)) { firstHit = f; break; }
      const gy = q.y + q.h - 5;
      if (!aligned && f < 24 && gy > bb.y - 1 && gy < bb.y + bb.h + 1 && (bb.x + bb.w / 2 < q.x + q.w / 2 ? -1 : 1) === q.face) aligned = true;
      let hit = false;
      for (const o of w.bullets) {
        if (o.harmless) {
          // markers warn of a strike from above / below at that spot
          const strikeAt = (o.ttl ?? 0) - dt;
          if (strikeAt < 0.05 && strikeAt > -0.5 && Math.abs(o.x - (q.x + q.w / 2)) < 12) { hit = true; break; }
          continue;
        }
        if (o.delay > dt) continue;
        if (o.ttl !== undefined && o.ttl < dt) continue;
        const pos = predictBullet(o, dt);
        if (overlap(q, { x: pos.x - o.r - 1, y: pos.y - o.h - 1, w: o.r * 2 + 2, h: o.h * 2 + 2 })) { hit = true; break; }
      }
      if (hit) { firstHit = f; break; }
    }
    // prefer a good shooting spot: level with the boss, 40-70 px away, not in a corner
    const pc = q.x + q.w / 2; const bc = b.x + b.w / 2;
    const d = Math.abs(pc - bc);
    let pos = -Math.abs(d - 55) / 60;
    if (pc < ar.x0 + 12 || pc > ar.x1 - 12) pos -= 0.3;
    return firstHit * 1.0 + pos + (aligned ? 0.6 : 0) + (pl.j ? -0.15 : 0) + (pl.l || pl.r ? -0.05 : 0);
  }
}

/** Fight a boss to the end. Returns { won, time, hpLeft, tanksUsed }. */
export function fightBoss(w, opts = {}) {
  if (!enterBossRoom(w)) return { won: false, reason: 'no door' };
  const bot = new BossBot(w, opts);
  const tanks0 = w.etanks;
  const limit = (opts.seconds || 240) / DT;
  for (let i = 0; i < limit; i++) {
    w.step(bot.input());
    if (w.mode === 'victory' || w.mode === 'won') return { won: true, time: i * DT, hpLeft: w.p.hp, tanksUsed: tanks0 - w.etanks, bossHp: 0 };
    if (w.mode === 'dying' || w.mode === 'gameover') return { won: false, time: i * DT, bossHp: w.boss?.hp, tanksUsed: tanks0 - w.etanks };
  }
  return { won: false, reason: 'timeout', bossHp: w.boss?.hp };
}

export const weakTo = (kind) => BOSSES[kind].weak;
export { P };

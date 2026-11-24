// The hero's movement: running, variable-height jumps (with a little coyote time and jump
// buffering for touch screens), ladders, conveyors, moving platforms, knockback and spikes.
// Shooting lives in game.js; this file only moves the body, so the reach checker can reuse it.
import { TILE, P, T, HAZARD_TILES } from './constants.js';
import { moveX, moveY, touching } from './level.js';

export function newPlayer(x, feetY) {
  return {
    x: x - P.w / 2, y: feetY - P.h, w: P.w, h: P.h, vx: 0, vy: 0, face: 1,
    onGround: true, mover: null, climb: null, coyote: 0, buffer: 0,
    kb: 0, kbDir: 0, inv: 0, hp: P.maxHp, shootT: 0, charge: 0, moving: false, landT: 0,
  };
}

const cxOf = (p) => Math.floor((p.x + p.w / 2) / TILE);

/** x of the middle of the ladder at column cx (ladders are two tiles wide, a lone column works too). */
function ladderCentre(lv, cx, cy) {
  let L = cx;
  while (lv.isLadder(L - 1, cy)) L--;
  return lv.isLadder(L + 1, cy) ? (L + 1) * TILE : L * TILE + TILE / 2;
}

/** Ladder row under the body for grabbing while pressing up (centre or feet). */
function ladderRowAt(lv, p) {
  const cx = cxOf(p);
  for (const y of [p.y + p.h / 2, p.y + p.h - 1]) {
    const cy = Math.floor(y / TILE);
    if (lv.isLadder(cx, cy)) return cy;
  }
  return null;
}

/** Hurt the player (ignored while blinking). Returns true if it landed. */
export function hurtPlayer(p, dmg, fromX) {
  if (p.inv > 0 || p.hp <= 0) return false;
  p.hp = Math.max(0, p.hp - dmg);
  p.inv = P.inv;
  p.kb = P.kbTime;
  p.kbDir = fromX > p.x + p.w / 2 ? -1 : 1;
  p.climb = null;
  p.charge = 0;
  if (p.vy < 0) p.vy = 0;
  return true;
}

/**
 * One fixed step. inp = { l, r, u, d, jump, jumpP } (held + just pressed).
 * ext.wind adds a sideways push (px/s). Returns a list of event names.
 */
export function stepPlayer(p, inp, lv, time, dt, ext = {}) {
  const ev = [];
  p.inv = Math.max(0, p.inv - dt);
  p.kb = Math.max(0, p.kb - dt);
  p.shootT = Math.max(0, p.shootT - dt);
  p.landT = Math.max(0, p.landT - dt);
  p.buffer = inp.jumpP ? P.buffer : Math.max(0, p.buffer - dt);

  // ride a moving platform
  if (p.mover && !p.climb) {
    const a = lv.moverRect(p.mover, time - dt); const b = lv.moverRect(p.mover, time);
    moveX(lv, p, b.x - a.x, time);
    const dy = b.y - a.y;
    if (dy < 0) moveY(lv, p, dy, time); else p.y += dy;
  }

  if (p.climb !== null) {
    climbStep(p, inp, lv, time, dt, ev);
  } else {
    // sideways
    const want = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
    if (p.kb > 0) p.vx = p.kbDir * P.kbSpeed;
    else { if (want) p.face = want; p.vx = want * P.run; }
    p.moving = p.kb <= 0 && want !== 0;
    let push = ext.wind || 0;
    if (p.onGround && !p.mover) {
      const under = lv.at(cxOf(p), Math.floor((p.y + p.h + 1) / TILE));
      if (under === T.CONVL) push -= P.conveyor;
      else if (under === T.CONVR) push += P.conveyor;
    }
    moveX(lv, p, (p.vx + push) * dt, time);

    // jump (coyote time: a moment after walking off an edge still counts)
    p.coyote = p.onGround ? P.coyote : Math.max(0, p.coyote - dt);
    if (p.buffer > 0 && p.coyote > 0 && p.kb <= 0) {
      p.vy = -P.jumpV; p.buffer = 0; p.coyote = 0; p.onGround = false; p.mover = null;
      ev.push('jump');
    }
    if (!inp.jump && p.vy < -P.cutV) p.vy = -P.cutV;   // let go early for a short hop
    p.vy = Math.min(P.maxFall, p.vy + P.grav * dt);
    const wasGround = p.onGround;
    const r = moveY(lv, p, p.vy * dt, time);
    if (r.landed) {
      if (!wasGround && p.vy > 80) { ev.push('land'); p.landT = 0.08; }
      p.vy = 0; p.onGround = true; p.mover = r.mover;
    } else { p.onGround = false; p.mover = null; }
    if (r.bumped && p.vy < 0) p.vy = 0;

    // grab a ladder: up while over one, or down while standing on its top
    if (p.kb <= 0) {
      const cx = cxOf(p);
      const row = inp.u ? ladderRowAt(lv, p) : null;
      if (row !== null) {
        startClimb(p, lv, cx, row);
      } else if (inp.d && p.onGround) {
        const below = Math.floor((p.y + p.h + 1) / TILE);
        if (lv.isLadder(cx, below) && !lv.isLadder(cx, below - 1)) {
          startClimb(p, lv, cx, below);
          p.y += 3;
        }
      }
    }
  }

  // spikes hurt (they are solid, so touching means standing on or brushing against them)
  for (const t of touching(lv, p, 0.5)) {
    if (HAZARD_TILES.has(t)) { if (p.inv <= 0) ev.push('spike'); break; }
  }
  if (p.y > lv.H + 8) ev.push('pit');
  return ev;
}

function startClimb(p, lv, cx, row) {
  p.climb = ladderCentre(lv, cx, row);
  p.x = p.climb - p.w / 2;
  p.vx = 0; p.vy = 0; p.onGround = false; p.mover = null; p.moving = false;
}

function climbStep(p, inp, lv, time, dt, ev) {
  const want = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
  if (want) p.face = want;
  if (inp.jumpP) { p.climb = null; p.vy = 0; p.buffer = 0; return; }   // let go
  const dir = p.shootT > 0 ? 0 : (inp.d ? 1 : 0) - (inp.u ? 1 : 0);
  p.moving = dir !== 0;
  p.x = p.climb - p.w / 2;
  if (!dir) return;
  const cx = cxOf(p);
  const r = moveY(lv, p, dir * P.climb * dt, time, { drop: true, movers: false });
  if (dir > 0) {
    if (r.landed) { p.climb = null; p.onGround = true; p.vy = 0; return; }
    const mid = Math.floor((p.y + p.h / 2) / TILE); const feet = Math.floor((p.y + p.h - 1) / TILE);
    if (!lv.isLadder(cx, mid) && !lv.isLadder(cx, feet)) { p.climb = null; p.vy = 0; }  // off the bottom
    return;
  }
  if (r.bumped) return;
  // climbing up: once the feet are near the top rung, step off onto the ladder's top
  const feetRow = Math.floor((p.y + p.h - 5) / TILE);
  if (!lv.isLadder(cx, feetRow)) {
    let top = Math.floor((p.y + p.h - 1) / TILE);
    while (top < lv.rows && !lv.isLadder(cx, top)) top++;
    while (top > 0 && lv.isLadder(cx, top - 1)) top--;
    p.y = top * TILE - p.h;
    p.climb = null; p.onGround = true; p.vy = 0;
    ev.push('ladderTop');
  }
}

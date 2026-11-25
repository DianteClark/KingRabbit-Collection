// The fishing minigame, as plain numbers so it can be tested and played by bots.
// A vertical track from 0 (bottom) to 1 (top). The fish darts about; hold to push your green
// bar up, let go and it sinks. Keep the fish inside the bar to fill the catch meter.
import { FISH } from './data.js';

export function newReel(fishId, rodLevel = 0, rnd = Math.random) {
  const diff = FISH[fishId]?.diff ?? 3;
  return {
    fish: fishId, diff,
    fishY: 0.3 + rnd() * 0.4, fishV: 0, target: 0.5, wait: 0,
    barY: 0.1, barV: 0,
    barH: Math.max(0.16, 0.3 + rodLevel * 0.05 - diff * 0.012),
    progress: 0.3,
    t: 0, done: null,
  };
}

/** Advance by dt seconds. holding: finger down. Returns the reel (done: 'caught' | 'escaped' | null). */
export function stepReel(r, dt, holding, rnd = Math.random) {
  if (r.done) return r;
  dt = Math.min(dt, 0.05);
  r.t += dt;
  // fish: pick a new spot now and then, harder fish more often and further
  r.wait -= dt;
  if (r.wait <= 0) {
    const reach = 0.15 + r.diff * 0.07;
    r.target = Math.max(0.03, Math.min(0.97, r.fishY + (rnd() * 2 - 1) * reach));
    r.wait = Math.max(0.25, 1.6 - r.diff * 0.13) * (0.5 + rnd());
  }
  const speed = 0.35 + r.diff * 0.12;
  const dy = r.target - r.fishY;
  r.fishV += (dy * 9 - r.fishV * 4) * dt * (0.6 + r.diff * 0.08);
  r.fishV = Math.max(-speed, Math.min(speed, r.fishV));
  r.fishY = Math.max(0, Math.min(1, r.fishY + r.fishV * dt));
  // bar: lift while holding, gravity otherwise, a small bounce off the bottom
  r.barV += (holding ? 2.6 : -2.2) * dt;
  r.barV = Math.max(-1.4, Math.min(1.4, r.barV));
  r.barY += r.barV * dt;
  const top = 1 - r.barH;
  if (r.barY < 0) { r.barY = 0; r.barV = Math.abs(r.barV) > 0.3 ? -r.barV * 0.35 : 0; }
  if (r.barY > top) { r.barY = top; r.barV = 0; }
  // catch meter
  if (inBar(r)) r.progress += 0.32 * dt; else r.progress -= (0.17 + r.diff * 0.012) * dt;
  if (r.progress >= 1) { r.progress = 1; r.done = 'caught'; }
  if (r.progress <= 0) { r.progress = 0; r.done = 'escaped'; }
  return r;
}

export const inBar = (r) => r.fishY >= r.barY && r.fishY <= r.barY + r.barH;

/** A simple player: hold when the fish is above the middle of the bar. skill 0..1 adds reaction lag. */
export function botHold(r, skill = 1, rnd = Math.random) {
  const mid = r.barY + r.barH / 2;
  const want = r.fishY > mid + (r.barV > 0 ? 0.05 : -0.02);
  return rnd() < skill ? want : !want;
}

/** Play a whole reel with the bot (for tests and the year-one bot). */
export function autoReel(fishId, rodLevel, skill, rnd) {
  const r = newReel(fishId, rodLevel, rnd);
  for (let i = 0; i < 60 * 40 && !r.done; i++) stepReel(r, 1 / 60, botHold(r, skill, rnd), rnd);
  return r.done === 'caught';
}

/** Seconds to wait for a bite (bait halves it). */
export const biteDelay = (bait, rnd = Math.random) => (bait ? 0.6 : 1.4) + rnd() * (bait ? 1.2 : 2.6);
/** How long the '!' stays up for you to tap. */
export const HOOK_WINDOW = 0.9;

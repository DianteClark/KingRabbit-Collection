// Cups, points, the rival drivers, unlocks, ghosts and the daily challenge. Pure data in and out
// (the scenes save whatever these return).
import { CUPS, TRACKS } from './tracks.js';
import { MODELS, COLOURS } from './car.js';
import { mulberry32 } from './rng.js';

export const POINTS = [10, 8, 6, 5, 4, 3];

// Five rivals with their own cars and a little personal edge on top of the adaptive level.
export const RIVALS = [
  { name: 'Dot', model: 'buggy', colour: 'yellow', edge: -0.1, lane: -6 },
  { name: 'Max', model: 'hatch', colour: 'blue', edge: -0.05, lane: 5 },
  { name: 'Ziggy', model: 'coupe', colour: 'green', edge: 0, lane: -3 },
  { name: 'Rosa', model: 'muscle', colour: 'purple', edge: 0.04, lane: 3 },
  { name: 'Ace', model: 'rally', colour: 'white', edge: 0.08, lane: 0 },
];

/** Cup 2 and 3 field a slightly stronger pack. */
export const CUP_EDGE = [0, 0.06, 0.12];

export function rivalsFor(skill, { cup = 0, avoidColour = null } = {}) {
  return RIVALS.map((r) => ({
    ...r,
    // never the same colour as you
    colour: r.colour === avoidColour ? 'orange' : r.colour,
    skill: clamp01(skill + r.edge + (CUP_EDGE[cup] || 0)),
  }));
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function newCup(cupIndex) {
  const names = ['You', ...RIVALS.map((r) => r.name)];
  return { cup: cupIndex, race: 0, points: Object.fromEntries(names.map((n) => [n, 0])), history: [] };
}

/** Add one race's finishing order (names, winner first). Returns the updated cup. */
export function addRace(cup, order) {
  const points = { ...cup.points };
  order.forEach((name, i) => { points[name] = (points[name] || 0) + (POINTS[i] || 0); });
  return { ...cup, race: cup.race + 1, points, history: [...cup.history, order] };
}

export const cupTracks = (cup) => CUPS[cup.cup].tracks;
export const cupOver = (cup) => cup.race >= CUPS[cup.cup].tracks.length;
export const nextTrack = (cup) => CUPS[cup.cup].tracks[cup.race];

/** Standings: [{ name, points, place }], ties broken by the better last race. */
export function table(cup) {
  const last = cup.history[cup.history.length - 1] || [];
  return Object.entries(cup.points)
    .map(([name, points]) => ({ name, points }))
    .sort((a, b) => b.points - a.points || last.indexOf(a.name) - last.indexOf(b.name))
    .map((r, i) => ({ ...r, place: i + 1 }));
}

export const playerPlace = (cup) => table(cup).find((r) => r.name === 'You').place;

/** progress = { cups: [bestPlace|null, ...] }: which cups are open. */
export function cupUnlocked(progress, i) {
  if (i === 0) return true;
  const prev = (progress.cups || [])[i - 1];
  return prev != null && prev <= 3;
}

/** A track is open in Quick Race and Time Trial once its cup is open. */
export const trackUnlocked = (progress, trackId) => cupUnlocked(progress, TRACKS.find((t) => t.id === trackId)?.cup ?? 0);

/** Cars: the starters, plus one for winning each cup. */
export function carUnlocked(progress, modelId) {
  const m = MODELS.find((x) => x.id === modelId);
  if (!m || !m.unlock) return true;
  const i = CUPS.findIndex((c) => c.id === m.unlock);
  return (progress.cups || [])[i] === 1;
}

/** Record a finished cup's final place; returns { progress, newCar, newCup }. */
export function finishCup(progress, cupIndex, place) {
  const cups = [...(progress.cups || [null, null, null])];
  const before = { ...progress, cups: [...cups] };
  cups[cupIndex] = cups[cupIndex] == null ? place : Math.min(cups[cupIndex], place);
  const after = { ...progress, cups };
  const newCar = MODELS.find((m) => m.unlock && !carUnlocked(before, m.id) && carUnlocked(after, m.id)) || null;
  const nextIdx = cupIndex + 1;
  const newCup = nextIdx < CUPS.length && !cupUnlocked(before, nextIdx) && cupUnlocked(after, nextIdx) ? CUPS[nextIdx] : null;
  return { progress: after, newCar, newCup };
}

// ------------------------------------------------------------------ ghosts

/** Ghost frames are [x*2, y*2, heading*100, ...] every 2 steps. Pack to a short string. */
export function packGhost(frames) {
  // deltas fit easily in base-36 chunks; keep it simple and robust: comma list of deltas
  const out = [];
  let px = 0; let py = 0; let ph = 0;
  for (let i = 0; i < frames.length; i += 3) {
    out.push((frames[i] - px).toString(36), (frames[i + 1] - py).toString(36), (frames[i + 2] - ph).toString(36));
    px = frames[i]; py = frames[i + 1]; ph = frames[i + 2];
  }
  return out.join(',');
}

export function unpackGhost(str) {
  if (!str) return [];
  const parts = str.split(',');
  const out = [];
  let px = 0; let py = 0; let ph = 0;
  for (let i = 0; i + 2 < parts.length; i += 3) {
    px += parseInt(parts[i], 36); py += parseInt(parts[i + 1], 36); ph += parseInt(parts[i + 2], 36);
    out.push(px, py, ph);
  }
  return out;
}

/** Where the ghost is `t` seconds into its lap: { x, y, h } or null when it has finished. */
export function ghostAt(frames, t) {
  const n = frames.length / 3;
  if (!n) return null;
  const f = t / (2 / 60);
  const i = Math.floor(f);
  if (i >= n - 1) return null;
  const a = i * 3; const b = a + 3; const k = f - i;
  let dh = frames[b + 2] - frames[a + 2];
  if (dh > 314) dh -= 628; else if (dh < -314) dh += 628;
  return {
    x: (frames[a] + (frames[b] - frames[a]) * k) / 2,
    y: (frames[a + 1] + (frames[b + 1] - frames[a + 1]) * k) / 2,
    h: (frames[a + 2] + dh * k) / 100,
  };
}

// ------------------------------------------------------------------ daily challenge

/** Today's challenge from the shared daily seed: a track, a car and a colour, time trial. */
export function dailyConfig(seed) {
  const r = mulberry32(seed);
  const track = TRACKS[Math.floor(r() * TRACKS.length)];
  const model = MODELS[Math.floor(r() * MODELS.length)];
  const colour = COLOURS[Math.floor(r() * COLOURS.length)];
  return { trackId: track.id, model: model.id, colour: colour.id, laps: 3 };
}

/** 83.456 -> "1:23.45" */
export function fmtTime(t) {
  if (t == null || !isFinite(t)) return '--:--.--';
  const m = Math.floor(t / 60); const s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
}

export const ordinal = (n) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

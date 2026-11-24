// Chiptune music, jingles and a few custom effects for MegaBoy Run, on the shared Web Audio
// context from shared/core/sfx.js (which wakes up again after the phone sleeps). All tunes are
// original. Quiet by default, silent when the shared mute is on, switchable in the pause menu.
import { isMuted, audioContext, onAudioReset, sfx } from '../../shared/core/sfx.js';
import { save } from './save.js';

const VOLUME = 0.042;

const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export const freq = (n) => {
  const m = n.match(/^([A-G][#b]?)(\d)$/);
  const midi = 12 * (Number(m[2]) + 1) + NOTE[m[1]];
  return 440 * 2 ** ((midi - 69) / 12);
};
/** "C5 . E5 -" -> [freq|null|'hold'] ('.' rest, '-' hold the previous note) */
export const parse = (s) => s.replace(/\|/g, ' ').split(/\s+/).filter(Boolean).map((t) => (t === '.' ? null : t === '-' ? 'hold' : freq(t)));

// step = one eighth note for the lead, one quarter for the bass
export const SONGS = {
  title: { bpm: 138, lead: 'E5 . G5 A5 | B5 - A5 G5 | E5 . D5 E5 | G5 - - . | C6 . B5 A5 | B5 - G5 E5 | A5 G5 E5 D5 | E5 - - .', bass: 'E2 E3 C2 C3 | D2 D3 E2 E2 | A1 A2 G1 G2 | C2 D2 E2 E2' },
  select: { bpm: 120, lead: 'C5 E5 G5 E5 | D5 F5 A5 F5 | E5 G5 B5 G5 | C6 - G5 . | A4 C5 E5 C5 | B4 D5 G5 D5 | C5 E5 G5 C6 | B5 - - .', bass: 'C3 G2 D3 A2 | E3 B2 C3 C3 | A2 E3 G2 D3 | C3 G2 G2 G2' },
  foundry: { bpm: 150, lead: 'A4 A4 C5 A4 | D5 C5 A4 G4 | A4 A4 C5 E5 | D5 - C5 . | F5 F5 E5 D5 | E5 D5 C5 A4 | G4 A4 C5 D5 | E5 - - .', bass: 'A1 A2 A1 A2 | F1 F2 G1 G2 | A1 A2 C2 C3 | E2 E2 E2 E2' },
  cryo: { bpm: 124, lead: 'E5 . B4 E5 | F#5 - E5 B4 | D5 . A4 D5 | E5 - - . | C5 . G4 C5 | D5 - C5 G4 | B4 C5 D5 F#5 | E5 - - .', bass: 'E2 B2 E2 B2 | D2 A2 D2 A2 | C2 G2 C2 G2 | B1 F#2 B1 B1' },
  jungle: { bpm: 132, lead: 'G4 . B4 D5 | E5 D5 B4 . | G4 . B4 D5 | C5 - B4 . | A4 . C5 E5 | F#5 E5 C5 . | D5 E5 F#5 A5 | G5 - - .', bass: 'G2 D3 G2 D3 | C2 G2 C2 G2 | D2 A2 D2 A2 | G2 D2 G2 G2' },
  power: { bpm: 144, lead: 'D5 D5 . D5 | F5 . D5 C5 | D5 D5 . D5 | A5 . G5 F5 | Bb4 Bb4 . Bb4 | D5 . C5 Bb4 | A4 C5 E5 G5 | F5 - E5 .', bass: 'D2 D2 D2 D2 | D2 D2 C2 C2 | Bb1 Bb1 Bb1 Bb1 | A1 A1 A1 A1' },
  mine: { bpm: 112, lead: 'C5 . Eb5 . | G5 F5 Eb5 . | D5 . F5 . | Ab5 G5 F5 . | Eb5 . G5 . | C6 Bb5 Ab5 G5 | F5 Eb5 D5 B4 | C5 - - .', bass: 'C2 C2 G1 G1 | Bb1 Bb1 F1 F1 | Ab1 Ab1 Eb2 Eb2 | G1 G1 G1 G1' },
  sky: { bpm: 136, lead: 'F5 . A5 C6 | Bb5 A5 G5 . | E5 . G5 Bb5 | A5 G5 F5 . | D5 . F5 A5 | G5 F5 E5 D5 | C5 E5 G5 Bb5 | A5 - - .', bass: 'F2 C3 F2 C3 | C2 G2 C2 G2 | D2 A2 Bb1 F2 | C2 G2 F2 F2' },
  fortress: { bpm: 140, lead: 'B4 . D5 B4 | F5 . E5 D5 | B4 . D5 F5 | E5 - D5 . | C5 . E5 C5 | G5 . F5 E5 | F#5 . A5 C6 | B5 - - .', bass: 'B1 B2 B1 B2 | G1 G2 G1 G2 | A1 A2 A1 A2 | F#1 F#2 B1 B1' },
  boss: { bpm: 160, lead: 'E5 E5 G5 E5 | A5 G5 E5 D5 | E5 E5 G5 B5 | A5 G5 F#5 D5 | C5 C5 E5 C5 | D5 C5 B4 A4 | B4 D#5 F#5 B5 | B4 . B4 .', bass: 'E2 E2 E2 E2 | C2 C2 D2 D2 | C2 C2 A1 A1 | B1 B1 B1 B1' },
  ending: { bpm: 96, lead: 'C5 . E5 G5 | A5 - G5 . | F5 . A5 C6 | G5 - - . | E5 . G5 C6 | B5 - A5 G5 | F5 E5 D5 E5 | C5 - - .', bass: 'C3 G2 A2 E2 | F2 C3 G2 G2 | C3 G2 A2 E2 | F2 G2 C3 C3' },
};
for (const s of Object.values(SONGS)) { s.leadN = parse(s.lead); s.bassN = parse(s.bass); }

// short one-shots: [note, eighths] at a fixed tempo
export const JINGLES = {
  ready: { bpm: 260, wave: 'square', notes: [['C5', 1], ['E5', 1], ['G5', 1], ['C6', 3]] },
  clear: { bpm: 220, wave: 'square', notes: [['G4', 1], ['C5', 1], ['E5', 1], ['G5', 2], ['E5', 1], ['G5', 4]] },
  weapon: { bpm: 200, wave: 'square', notes: [['C5', 1], ['C5', 1], ['G5', 1], ['C6', 2], ['B5', 1], ['C6', 1], ['D6', 1], ['E6', 4]] },
  gameover: { bpm: 150, wave: 'triangle', notes: [['G4', 2], ['E4', 2], ['C4', 2], ['G3', 4]] },
  checkpoint: { bpm: 320, wave: 'square', notes: [['E5', 1], ['A5', 1], ['E6', 2]] },
};

let ctx = null; let master = null;
let current = null; let timer = null; let step = 0; let nextT = 0;

function attach(c) {
  ctx = c;
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  syncVolume();
  if (current) nextT = ctx.currentTime + 0.1;
}

function audio() {
  const c = audioContext();
  if (!c) return null;
  if (c !== ctx) attach(c);
  return ctx;
}
onAudioReset((c) => { if (ctx) attach(c); });

export const musicOn = () => save.get('music') !== false;
export function setMusicOn(on) { save.set('music', on); syncVolume(); }

function syncVolume() {
  if (!master) return;
  const v = isMuted() || !musicOn() ? 0 : VOLUME;
  master.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
}

function tone(f, t, dur, wave, vol, out = master) {
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = wave; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t); o.stop(t + dur + 0.02);
}

function tick() {
  const song = SONGS[current];
  if (!song || !ctx) return;
  syncVolume();
  const e = 60 / song.bpm / 2;
  while (nextT < ctx.currentTime + 0.25) {
    const li = step % song.leadN.length;
    const n = song.leadN[li];
    if (n && n !== 'hold') {
      let len = 1;
      while (song.leadN[(li + len) % song.leadN.length] === 'hold' && len < 8) len++;
      tone(n, nextT, e * len * 0.92, 'square', 0.45);
    }
    if (step % 2 === 0) {
      const b = song.bassN[(step / 2) % song.bassN.length];
      if (b && b !== 'hold') tone(b, nextT, e * 1.7, 'triangle', 0.9);
    }
    step++; nextT += e;
  }
}

/** Switch the background tune (a SONGS key or null). */
export function playMusic(name) {
  if (name === current) return;
  current = name;
  if (!audio()) return;
  clearInterval(timer); timer = null;
  if (!name) { syncVolume(); return; }
  step = 0; nextT = ctx.currentTime + 0.1;
  timer = setInterval(tick, 60);
  tick();
}

export function stopMusic() { playMusic(null); }

/** A short jingle over a ducked tune. */
export function jingle(name) {
  const j = JINGLES[name];
  if (!j || isMuted() || !audio()) return;
  const out = ctx.createGain(); out.gain.value = 0.09; out.connect(ctx.destination);
  const dur = j.notes.reduce((a, [, l]) => a + l, 0) * (60 / j.bpm / 2);
  if (master && musicOn()) {
    master.gain.setTargetAtTime(VOLUME * 0.2, ctx.currentTime, 0.02);
    master.gain.setTargetAtTime(VOLUME, ctx.currentTime + dur, 0.2);
  }
  let t = ctx.currentTime + 0.02;
  for (const [n, l] of j.notes) {
    const d = l * (60 / j.bpm / 2);
    tone(freq(n), t, d * 0.95, j.wave, 0.6, out);
    t += d;
  }
}

/** Game effects: a few custom blips, the rest from the shared set. */
export function fx(name) {
  if (isMuted()) return;
  const own = OWN[name];
  if (!own) { sfx(SHARED[name] || name); return; }
  if (!audio()) return;
  const out = ctx.createGain(); out.gain.value = 1; out.connect(ctx.destination);
  const t = ctx.currentTime + 0.005;
  for (const [f, d, wave, vol, delay = 0, f2] of own) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(f, t + delay);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + delay + d);
    g.gain.setValueAtTime(vol, t + delay);
    g.gain.exponentialRampToValueAtTime(0.0001, t + delay + d);
    o.connect(g).connect(out);
    o.start(t + delay); o.stop(t + delay + d + 0.02);
  }
}

// [freq, dur, wave, vol, delay, slideTo]
const OWN = {
  buster: [[1200, 0.06, 'square', 0.035, 0, 600]],
  chargeShot: [[300, 0.18, 'sawtooth', 0.05, 0, 1400], [900, 0.12, 'square', 0.03, 0.02, 300]],
  charge1: [[500, 0.08, 'triangle', 0.05, 0, 900]],
  charge2: [[900, 0.1, 'triangle', 0.05, 0, 1600]],
  jump: [[300, 0.07, 'square', 0.02, 0, 520]],
  land: [[140, 0.05, 'triangle', 0.08, 0, 70]],
  hurt: [[600, 0.06, 'square', 0.06, 0, 200], [400, 0.08, 'square', 0.05, 0.06, 120]],
  deflect: [[1800, 0.04, 'square', 0.03, 0, 2400], [2400, 0.04, 'square', 0.02, 0.04, 1800]],
  appear: [[700, 0.04, 'square', 0.025, 0, 1000]],
  empty: [[160, 0.08, 'square', 0.04]],
  swap: [[660, 0.05, 'square', 0.035], [990, 0.06, 'square', 0.035, 0.05]],
  pickup: [[880, 0.05, 'square', 0.04], [1320, 0.07, 'square', 0.04, 0.05]],
  fill: [[440, 0.04, 'square', 0.03], [550, 0.04, 'square', 0.03, 0.05], [660, 0.04, 'square', 0.03, 0.1], [880, 0.06, 'square', 0.03, 0.15]],
  door: [[110, 0.5, 'sawtooth', 0.05, 0, 220]],
  thunder: [[90, 0.3, 'sawtooth', 0.08, 0, 40]],
  zap: [[1500, 0.12, 'sawtooth', 0.03, 0, 300]],
  ice: [[2000, 0.08, 'triangle', 0.04, 0, 1200]],
  wind: [[200, 0.6, 'triangle', 0.04, 0, 420]],
  bossHit: [[220, 0.06, 'square', 0.06, 0, 110]],
  weak: [[220, 0.06, 'square', 0.07, 0, 110], [880, 0.1, 'square', 0.05, 0.05, 1760]],
  dig: [[90, 0.25, 'sawtooth', 0.05, 0, 60]],
};
const SHARED = { enemyDie: 'smallBoom', bossDie: 'boom', death: 'lose', blast: 'smallBoom', stomp: 'thud', ehit: 'hit', eshot: 'shoot', tap: 'tap' };

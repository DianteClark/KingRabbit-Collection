// Darkhold's music and its own spooky sound effects, played on the one shared Web Audio context
// from shared/core/sfx.js (never a context of our own). Quiet by default, silent whenever the
// shared mute is on, and the music can be switched off in the pause menu. All tunes are original.
import { isMuted, audioContext, onAudioReset, sfx } from '../../shared/core/sfx.js';
import { save } from './save.js';

const VOLUME = 0.05;
const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const freq = (n) => {
  const m = n.match(/^([A-G][#b]?)(\d)$/);
  return 440 * 2 ** ((12 * (Number(m[2]) + 1) + NOTE[m[1]] - 69) / 12);
};
const parse = (s) => s.replace(/\|/g, ' ').split(/\s+/).filter(Boolean).map((t) => (t === '.' ? null : t === '-' ? 'hold' : freq(t)));

// One step = an eighth note for the lead, a quarter for the bass.
const SONGS = {
  title: {
    bpm: 72, leadWave: 'triangle', bassWave: 'sine',
    lead: parse('E5 - - . | G5 - F#5 . | E5 - B4 - | - - . . | C5 - - . | D5 - B4 . | A4 - - - | - - . . | E5 - - . | G5 - A5 . | B5 - G5 - | F#5 - . . | E5 - D5 . | B4 - G4 . | E4 - - - | - - . .'),
    bass: parse('E2 . E2 . | C2 . C2 . | A1 . A1 . | B1 . B1 . | E2 . E2 . | C2 . D2 . | B1 . B1 . | E2 . . .'),
  },
  deep: {
    bpm: 64, leadWave: 'triangle', bassWave: 'sine',
    lead: parse('A4 - . . | . . C5 . | B4 - - . | . . . . | E4 - . . | . . F4 . | E4 - - - | . . . . | A4 - . . | . . D5 . | C5 - B4 . | . . . . | G#4 - - . | . . B4 . | A4 - - - | . . . .'),
    bass: parse('A1 . . . | F1 . . . | D2 . . . | E1 . . . | A1 . . . | F1 . . . | E1 . E1 . | A1 . . .'),
  },
  boss: {
    bpm: 138, leadWave: 'square', bassWave: 'triangle',
    lead: parse('A4 A4 C5 A4 | D#5 D5 C5 A4 | A4 A4 C5 E5 | D#5 - D5 - | G4 G4 Bb4 G4 | C#5 C5 Bb4 G4 | A4 C5 E5 A5 | G#5 - E5 -'),
    bass: parse('A1 A1 A1 A1 | F1 F1 F1 F1 | G1 G1 G1 G1 | E1 E1 E1 E1'),
  },
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

export function syncVolume() {
  if (!master) return;
  const v = isMuted() || !musicOn() ? 0 : VOLUME;
  master.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
}

function tone(f, t, dur, wave, vol, out = master) {
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = wave; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t); o.stop(t + dur + 0.02);
}

function tick() {
  const song = SONGS[current];
  if (!song || !ctx) return;
  syncVolume();
  const e = 60 / song.bpm / 2;
  while (nextT < ctx.currentTime + 0.3) {
    const li = step % song.lead.length;
    const n = song.lead[li];
    if (n && n !== 'hold') {
      let len = 1;
      while (song.lead[(li + len) % song.lead.length] === 'hold' && len < 8) len++;
      tone(n, nextT, e * len * 0.98, song.leadWave, song.leadWave === 'square' ? 0.35 : 0.7);
    }
    if (step % 2 === 0) {
      const b = song.bass[(step / 2) % song.bass.length];
      if (b && b !== 'hold') tone(b, nextT, e * 3.5, song.bassWave, 0.9);
    }
    step++; nextT += e;
  }
}

// Browsers only allow sound after the first tap: until then, remember the tune and start it then.
let waiting = false;
const activated = () => typeof navigator === 'undefined' || !navigator.userActivation || navigator.userActivation.hasBeenActive;
function startLater(name) {
  current = name;
  if (waiting) return;
  waiting = true;
  const go = () => {
    waiting = false;
    for (const ev of ['pointerdown', 'keydown']) window.removeEventListener(ev, go, true);
    const n = current; current = null;
    // Let the gesture finish first so the shared context can start.
    setTimeout(() => playMusic(n), 0);
  };
  for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, go, true);
}

/** Switch the background tune ('title' | 'deep' | 'boss' | null). */
export function playMusic(name) {
  if (!activated()) { startLater(name); return; }
  if (name === current) { if (name && !timer && audio()) { timer = setInterval(tick, 80); } return; }
  current = name;
  if (!audio()) return;
  clearInterval(timer); timer = null;
  if (!name) { syncVolume(); return; }
  step = 0; nextT = ctx.currentTime + 0.1;
  timer = setInterval(tick, 80);
  tick();
}

// ------------------------------------------------------------------ sound effects

function fxOut(vol) {
  if (isMuted() || !audio()) return null;
  const g = ctx.createGain();
  g.gain.value = vol;
  g.connect(ctx.destination);
  return g;
}

function noiseBurst(out, t, dur, { lowpass = 1500, highpass = 0, vol = 1 } = {}) {
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  let node = src;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = lowpass;
  node.connect(lp); node = lp;
  if (highpass) { const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = highpass; node.connect(hp); node = hp; }
  const g = ctx.createGain(); g.gain.value = vol;
  node.connect(g).connect(out);
  src.start(t);
}

function slide(out, f0, f1, t, dur, wave = 'sine', vol = 1) {
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = wave;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t); o.stop(t + dur + 0.05);
}

const FX = {
  step: () => { const o = fxOut(0.05); if (o) noiseBurst(o, ctx.currentTime, 0.04, { lowpass: 600 }); },
  door: () => { const o = fxOut(0.06); if (o) { slide(o, 180, 120, ctx.currentTime, 0.25, 'sawtooth', 0.5); noiseBurst(o, ctx.currentTime, 0.1, { lowpass: 800 }); } },
  ignite: () => { const o = fxOut(0.12); if (o) { noiseBurst(o, ctx.currentTime, 0.45, { lowpass: 2500, highpass: 300 }); slide(o, 90, 220, ctx.currentTime, 0.3, 'triangle', 0.6); } },
  wail: () => { const o = fxOut(0.05); if (o) { slide(o, 520, 300, ctx.currentTime, 0.9, 'sine', 1); slide(o, 530, 310, ctx.currentTime + 0.05, 0.9, 'sine', 0.6); } },
  stairs: () => { const o = fxOut(0.07); if (o) [0, 0.12, 0.24, 0.36].forEach((d, k) => { noiseBurst(o, ctx.currentTime + d, 0.06, { lowpass: 900 }); slide(o, 300 - k * 40, 260 - k * 40, ctx.currentTime + d, 0.1, 'triangle', 0.5); }); },
  gulp: () => { const o = fxOut(0.07); if (o) [0, 0.1, 0.2].forEach((d) => slide(o, 200, 420, ctx.currentTime + d, 0.08, 'sine', 1)); },
  scroll: () => { const o = fxOut(0.06); if (o) { noiseBurst(o, ctx.currentTime, 0.2, { lowpass: 5000, highpass: 2000 }); slide(o, 600, 1200, ctx.currentTime + 0.1, 0.3, 'triangle', 0.6); } },
  shriek: () => { const o = fxOut(0.05); if (o) { slide(o, 1400, 900, ctx.currentTime, 0.6, 'square', 0.6); slide(o, 1500, 950, ctx.currentTime, 0.6, 'square', 0.4); } },
  snuff: () => { const o = fxOut(0.12); if (o) { noiseBurst(o, ctx.currentTime, 0.7, { lowpass: 500 }); slide(o, 160, 50, ctx.currentTime, 0.8, 'sawtooth', 0.5); } },
  trap: () => { const o = fxOut(0.1); if (o) { slide(o, 900, 200, ctx.currentTime, 0.15, 'square', 0.6); noiseBurst(o, ctx.currentTime, 0.15, { lowpass: 3000 }); } },
  secret: () => { const o = fxOut(0.06); if (o) [523, 659, 784, 1047].forEach((f, k) => slide(o, f, f, ctx.currentTime + k * 0.08, 0.2, 'triangle', 0.8)); },
};

/** Play a Darkhold sound, or a shared one (shared/core/sfx.js) by name. */
export function fx(name) {
  if (FX[name]) { try { FX[name](); } catch { /* ignore */ } return; }
  sfx(name);
}

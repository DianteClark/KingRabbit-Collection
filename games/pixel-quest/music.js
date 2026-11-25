// Pixel Quest's chiptune music and jingles, played on the one shared Web Audio context from
// shared/core/sfx.js (never a context of our own). Quiet by default, silent whenever the shared
// mute is on, and the music can be switched off in Options. All tunes are original.
import { isMuted, audioContext, onAudioReset, sfx } from '../../shared/core/sfx.js';
import { save } from './save.js';

const VOLUME = 0.045;
const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const freq = (n) => {
  const m = n.match(/^([A-G][#b]?)(\d)$/);
  return 440 * 2 ** ((12 * (Number(m[2]) + 1) + NOTE[m[1]] - 69) / 12);
};
/** "C5 . E5 -" -> [freq|null|'hold'] ('.' rest, '-' hold the previous note) */
const parse = (s) => s.replace(/\|/g, ' ').split(/\s+/).filter(Boolean).map((t) => (t === '.' ? null : t === '-' ? 'hold' : freq(t)));

// One lead step = an eighth note; one bass step = a quarter note.
const SONGS = {
  title: {
    bpm: 96, leadWave: 'triangle', bassWave: 'triangle',
    lead: parse('C5 - E5 G5 | C6 - - . | B5 - A5 G5 | A5 - - . | F5 - A5 C6 | B5 - G5 . | A5 B5 C6 D6 | E6 - - - | D6 - C6 B5 | A5 - F5 . | G5 - E5 C5 | D5 - - . | F5 E5 D5 C5 | B4 - G4 . | C5 - - - | - - . .'),
    bass: parse('C3 G2 C3 E3 | F2 C3 F2 A2 | F2 C3 G2 D3 | C3 G2 C3 C3 | D3 A2 F2 C3 | G2 D3 G2 B2 | F2 G2 G2 B2 | C3 G2 C3 .'),
  },
  town: {
    bpm: 112, leadWave: 'square', bassWave: 'triangle',
    lead: parse('F5 . A5 C6 | A5 - G5 F5 | G5 . Bb5 D6 | C6 - - . | A5 . C6 F6 | E6 - D6 C6 | Bb5 A5 G5 A5 | F5 - - .'),
    bass: parse('F2 C3 F2 C3 | C3 G2 C3 G2 | F2 C3 Bb2 F2 | C3 C3 F2 F2'),
  },
  field: {
    bpm: 128, leadWave: 'square', bassWave: 'triangle',
    lead: parse('G4 . B4 D5 | G5 - F#5 E5 | D5 . B4 G4 | A4 - - . | C5 . E5 G5 | F#5 - E5 D5 | E5 D5 C5 A4 | D5 - - . | G4 . B4 D5 | G5 - A5 B5 | C6 B5 A5 G5 | E5 - - . | C5 . D5 E5 | D5 - B4 G4 | A4 B4 C5 A4 | G4 - - .'),
    bass: parse('G2 D3 G2 D3 | E2 B2 E2 B2 | C3 G2 A2 E2 | D3 A2 D3 D3 | G2 D3 E2 B2 | C3 G2 C3 E3 | C3 G2 D3 A2 | G2 D3 G2 G2'),
  },
  cave: {
    bpm: 84, leadWave: 'triangle', bassWave: 'triangle',
    lead: parse('D5 . . F5 | E5 - . A4 | D5 . C5 . | A4 - - . | Bb4 . . D5 | C5 - . F4 | G4 . A4 . | D4 - - .'),
    bass: parse('D2 D2 A2 A2 | Bb1 Bb1 F2 F2 | G2 G2 A2 A2 | D2 D2 A1 A1'),
  },
  tower: {
    bpm: 100, leadWave: 'triangle', bassWave: 'triangle',
    lead: parse('E5 . G5 B5 | A5 - G5 . | F#5 . A5 . | B5 - - . | E5 . G5 B5 | C6 - B5 A5 | G5 F#5 E5 D#5 | E5 - - .'),
    bass: parse('E2 B2 E2 B2 | D2 A2 D2 A2 | C2 G2 A2 E2 | B1 F#2 E2 E2'),
  },
  desert: {
    bpm: 112, leadWave: 'square', bassWave: 'triangle',
    lead: parse('A4 Bb4 C#5 . | D5 - C#5 Bb4 | A4 . G4 . | A4 - - . | D5 E5 F5 . | E5 - D5 C#5 | D5 C#5 Bb4 G4 | A4 - - .'),
    bass: parse('D2 A2 D2 A2 | Bb1 F2 A1 E2 | D2 A2 G2 D2 | A1 E2 A1 A1'),
  },
  snow: {
    bpm: 90, leadWave: 'triangle', bassWave: 'sine',
    lead: parse('A5 . E5 . | C6 - B5 . | A5 . G5 E5 | G5 - - . | F5 . C5 . | A5 - G5 . | F5 E5 D5 B4 | E5 - - .'),
    bass: parse('A2 E3 A2 E3 | C3 G3 C3 G3 | F2 C3 F2 C3 | E2 B2 E2 E2'),
  },
  castle: {
    bpm: 104, leadWave: 'square', bassWave: 'triangle',
    lead: parse('C5 . Eb5 G5 | F#5 - G5 . | Ab5 . G5 F5 | Eb5 - D5 . | C5 . Eb5 G5 | C6 - B5 . | Ab5 G5 F5 D5 | C5 - - .'),
    bass: parse('C2 G2 C2 G2 | Ab1 Eb2 F1 C2 | C2 G2 Ab1 Eb2 | G1 D2 C2 C2'),
  },
  battle: {
    bpm: 150, leadWave: 'square', bassWave: 'triangle',
    lead: parse('A4 C5 E5 A5 | G5 - E5 . | F5 E5 D5 C5 | D5 - B4 . | A4 C5 E5 A5 | B5 - G#5 . | A5 G5 F5 E5 | E5 - - .'),
    bass: parse('A2 A2 E2 E2 | F2 F2 G2 G2 | A2 A2 G#2 G#2 | F2 E2 E2 E2'),
  },
  boss: {
    bpm: 160, leadWave: 'square', bassWave: 'square',
    lead: parse('E5 E5 G5 E5 | F#5 E5 D5 B4 | E5 E5 G5 B5 | A5 G5 F#5 D5 | C5 C5 E5 C5 | D5 C5 B4 A4 | B4 D#5 F#5 B5 | B4 . B4 .'),
    bass: parse('E2 E2 E2 E2 | C2 C2 D2 D2 | C2 C2 A1 A1 | B1 B1 B1 B1'),
  },
  final: {
    bpm: 170, leadWave: 'square', bassWave: 'square',
    lead: parse('D5 F5 A5 D6 | C#6 - A5 . | Bb5 A5 G5 F5 | E5 - C#5 . | D5 F5 A5 D6 | E6 - C#6 . | D6 C6 Bb5 A5 | A5 - . .'),
    bass: parse('D2 D2 D2 D2 | Bb1 Bb1 A1 A1 | G1 G1 A1 A1 | D2 A1 D2 D2'),
  },
  ending: {
    bpm: 84, leadWave: 'triangle', bassWave: 'triangle',
    lead: parse('E5 - G5 C6 | B5 - G5 . | A5 - C6 E6 | D6 - - . | C6 - A5 F5 | G5 - E5 C5 | D5 E5 F5 D5 | C5 - - .'),
    bass: parse('C3 G2 E3 G2 | A2 E3 A2 E3 | F2 C3 G2 D3 | C3 G2 C3 C3'),
  },
};

const JINGLES = {
  victory: { bpm: 220, wave: 'square', notes: [['C5', 1], ['C5', 1], ['C5', 1], ['C5', 3], ['Ab4', 3], ['Bb4', 3], ['C5', 2], ['Bb4', 1], ['C5', 6]] },
  level: { bpm: 260, wave: 'square', notes: [['G5', 1], ['A5', 1], ['B5', 1], ['C6', 1], ['D6', 1], ['G6', 4]] },
  item: { bpm: 240, wave: 'triangle', notes: [['C5', 1], ['E5', 1], ['G5', 1], ['C6', 3]] },
  inn: { bpm: 150, wave: 'triangle', notes: [['C5', 2], ['E5', 2], ['G5', 2], ['E5', 2], ['F5', 2], ['D5', 2], ['C5', 4]] },
  chime: { bpm: 180, wave: 'triangle', notes: [['G5', 2], ['C6', 2], ['E6', 2], ['G6', 2], ['C7', 6]] },
  lose: { bpm: 120, wave: 'triangle', notes: [['G4', 2], ['F4', 2], ['Eb4', 2], ['D4', 2], ['C4', 6]] },
  join: { bpm: 220, wave: 'square', notes: [['E5', 1], ['G5', 1], ['C6', 2], ['G5', 1], ['C6', 3]] },
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
  g.gain.linearRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t); o.stop(t + dur + 0.02);
}

function tick() {
  const song = SONGS[current];
  if (!song || !ctx) return;
  syncVolume();
  const e = 60 / song.bpm / 2;
  // After a long stall (tab hidden), skip ahead instead of playing a burst of notes.
  if (nextT < ctx.currentTime - 0.5) nextT = ctx.currentTime + 0.05;
  while (nextT < ctx.currentTime + 0.25) {
    const li = step % song.lead.length;
    const n = song.lead[li];
    if (n && n !== 'hold') {
      let len = 1;
      while (song.lead[(li + len) % song.lead.length] === 'hold' && len < 8) len++;
      tone(n, nextT, e * len * 0.95, song.leadWave, song.leadWave === 'square' ? 0.45 : 0.8);
    }
    if (step % 2 === 0) {
      const b = song.bass[(step / 2) % song.bass.length];
      if (b && b !== 'hold') tone(b, nextT, e * 1.8, song.bassWave, song.bassWave === 'square' ? 0.3 : 0.9);
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
    setTimeout(() => playMusic(n), 0);
  };
  for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, go, true);
}

/** Switch the background tune (a SONGS key, or null for silence). */
export function playMusic(name) {
  if (!activated()) { startLater(name); return; }
  if (name === current) { if (name && !timer && audio()) timer = setInterval(tick, 70); return; }
  current = name;
  if (!audio()) return;
  clearInterval(timer); timer = null;
  if (!name) { syncVolume(); return; }
  step = 0; nextT = ctx.currentTime + 0.1;
  timer = setInterval(tick, 70);
  tick();
}

export const currentTune = () => current;

/** A short jingle over a ducked tune. */
export function jingle(name) {
  const j = JINGLES[name];
  if (!j || isMuted() || !audio()) return;
  const out = ctx.createGain(); out.gain.value = 0.08; out.connect(ctx.destination);
  const dur = j.notes.reduce((a, [, l]) => a + l, 0) * (60 / j.bpm / 2);
  if (master && musicOn()) {
    master.gain.setTargetAtTime(VOLUME * 0.2, ctx.currentTime, 0.02);
    master.gain.setTargetAtTime(VOLUME, ctx.currentTime + dur, 0.2);
  }
  let t = ctx.currentTime + 0.02;
  for (const [n, l] of j.notes) {
    const d = l * (60 / j.bpm / 2);
    tone(freq(n), t, d * 0.92, j.wave, 0.6, out);
    t += d;
  }
}

// ------------------------------------------------------------------ battle sounds

function fxOut(vol) {
  if (isMuted() || !audio()) return null;
  const g = ctx.createGain(); g.gain.value = vol; g.connect(ctx.destination);
  return g;
}
function noise(out, t, dur, lowpass = 1500, vol = 1) {
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(f).connect(g).connect(out); src.start(t);
}
function slide(out, f0, f1, t, dur, wave = 'square', vol = 1) {
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = wave; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.03);
}

const FX = {
  slash: () => { const o = fxOut(0.08); if (o) { noise(o, ctx.currentTime, 0.12, 4000, 0.8); slide(o, 900, 200, ctx.currentTime, 0.1, 'square', 0.4); } },
  hurt: () => { const o = fxOut(0.08); if (o) { slide(o, 300, 80, ctx.currentTime, 0.18, 'square', 0.7); noise(o, ctx.currentTime, 0.1, 900, 0.6); } },
  fire: () => { const o = fxOut(0.1); if (o) { noise(o, ctx.currentTime, 0.45, 2200, 1); slide(o, 120, 400, ctx.currentTime, 0.3, 'sawtooth', 0.3); } },
  ice: () => { const o = fxOut(0.06); if (o) [0, 0.06, 0.12, 0.18].forEach((d, k) => slide(o, 1800 - k * 200, 2400, ctx.currentTime + d, 0.12, 'triangle', 0.8)); },
  bolt: () => { const o = fxOut(0.09); if (o) { noise(o, ctx.currentTime, 0.3, 6000, 1); slide(o, 1400, 60, ctx.currentTime, 0.25, 'sawtooth', 0.5); } },
  holy: () => { const o = fxOut(0.06); if (o) [784, 988, 1175, 1568].forEach((f, k) => slide(o, f, f * 1.01, ctx.currentTime + k * 0.05, 0.4, 'triangle', 0.7)); },
  dark: () => { const o = fxOut(0.08); if (o) { slide(o, 220, 55, ctx.currentTime, 0.6, 'sawtooth', 0.6); noise(o, ctx.currentTime, 0.5, 500, 0.6); } },
  heal: () => { const o = fxOut(0.06); if (o) [523, 659, 784, 1047].forEach((f, k) => slide(o, f, f, ctx.currentTime + k * 0.06, 0.2, 'triangle', 0.8)); },
  buff: () => { const o = fxOut(0.06); if (o) [392, 523, 659].forEach((f, k) => slide(o, f, f * 1.5, ctx.currentTime + k * 0.07, 0.15, 'square', 0.4)); },
  status: () => { const o = fxOut(0.06); if (o) [0, 0.1, 0.2].forEach((d) => slide(o, 600, 300, ctx.currentTime + d, 0.12, 'triangle', 0.8)); },
  steal: () => { const o = fxOut(0.06); if (o) { slide(o, 400, 1600, ctx.currentTime, 0.12, 'triangle', 0.8); } },
  smoke: () => { const o = fxOut(0.1); if (o) noise(o, ctx.currentTime, 0.6, 800, 1); },
  miss: () => { const o = fxOut(0.05); if (o) slide(o, 700, 500, ctx.currentTime, 0.1, 'triangle', 0.6); },
  ko: () => { const o = fxOut(0.08); if (o) { slide(o, 400, 40, ctx.currentTime, 0.4, 'square', 0.6); } },
  step: () => { const o = fxOut(0.03); if (o) noise(o, ctx.currentTime, 0.03, 700, 1); },
  door: () => { const o = fxOut(0.06); if (o) { slide(o, 180, 120, ctx.currentTime, 0.2, 'sawtooth', 0.4); noise(o, ctx.currentTime, 0.1, 800, 0.6); } },
  stairs: () => { const o = fxOut(0.06); if (o) [0, 0.1, 0.2, 0.3].forEach((d, k) => slide(o, 300 - k * 40, 260 - k * 40, ctx.currentTime + d, 0.08, 'triangle', 0.6)); },
  switch: () => { const o = fxOut(0.07); if (o) { slide(o, 900, 300, ctx.currentTime, 0.12, 'square', 0.5); noise(o, ctx.currentTime, 0.08, 3000, 0.5); } },
  secret: () => { const o = fxOut(0.06); if (o) [523, 659, 784, 1047, 1319].forEach((f, k) => slide(o, f, f, ctx.currentTime + k * 0.07, 0.18, 'triangle', 0.8)); },
  encounter: () => { const o = fxOut(0.07); if (o) [0, 0.07, 0.14, 0.21, 0.28].forEach((d, k) => slide(o, 300 + k * 120, 340 + k * 120, ctx.currentTime + d, 0.06, 'square', 0.6)); },
};

/** A Pixel Quest sound, or a shared one (shared/core/sfx.js) by name. */
export function fx(name) {
  if (FX[name]) { try { FX[name](); } catch { /* ignore */ } return; }
  sfx(name);
}

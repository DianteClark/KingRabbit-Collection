// Little chiptune loops and jingles for Hearth Valley (Web Audio, original tunes, no files).
// Uses the one shared audio context from shared/core/sfx.js; silent when muted or music is off.
import { isMuted, audioContext, onAudioReset } from '../../shared/core/sfx.js';
import { save } from './save.js';

const VOLUME = 0.04;
const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const freq = (n) => {
  const m = n.match(/^([A-G][#b]?)(\d)$/);
  return 440 * 2 ** ((12 * (Number(m[2]) + 1) + NOTE[m[1]] - 69) / 12);
};
/** "C5 . E5 -" -> [freq|null|'hold'] ('.' rest, '-' hold) */
const parse = (s) => s.replace(/\|/g, ' ').split(/\s+/).filter(Boolean).map((t) => (t === '.' ? null : t === '-' ? 'hold' : freq(t)));

// step = one eighth note for the lead, one quarter for the bass
const SONGS = {
  spring: {
    bpm: 112, leadWave: 'triangle', bassWave: 'triangle',
    lead: parse('C5 . E5 G5 | A5 - G5 E5 | F5 . E5 D5 | E5 - - . | D5 . E5 F5 | G5 - E5 C5 | D5 E5 D5 B4 | C5 - - . | E5 . G5 C6 | B5 - A5 G5 | A5 . G5 E5 | D5 - - . | C5 . D5 E5 | G5 - A5 G5 | E5 D5 C5 D5 | C5 - - .'),
    bass: parse('C3 G2 C3 G2 | F2 C3 F2 C3 | D3 A2 G2 D3 | C3 G2 C3 C3 | A2 E3 A2 E3 | F2 C3 G2 D3 | C3 G2 F2 G2 | C3 G2 C3 C3'),
  },
  summer: {
    bpm: 128, leadWave: 'square', bassWave: 'triangle',
    lead: parse('G4 B4 D5 G5 | E5 - D5 B4 | C5 E5 G5 E5 | D5 - - . | G4 B4 D5 G5 | A5 - G5 E5 | D5 C5 B4 A4 | G4 - - .'),
    bass: parse('G2 D3 G2 D3 | C3 G2 C3 G2 | D3 A2 D3 A2 | G2 D3 G2 G2'),
  },
  fall: {
    bpm: 96, leadWave: 'triangle', bassWave: 'triangle',
    lead: parse('A4 . C5 E5 | D5 - C5 B4 | C5 . A4 . | E5 - - . | F5 . E5 D5 | C5 - B4 A4 | B4 . G#4 B4 | A4 - - .'),
    bass: parse('A2 E3 A2 E3 | F2 C3 F2 C3 | D3 A2 E2 B2 | A2 E3 A2 A2'),
  },
  winter: {
    bpm: 84, leadWave: 'triangle', bassWave: 'triangle',
    lead: parse('E5 - G5 - | B5 - A5 - | G5 - E5 - | D5 - - - | C5 - E5 - | G5 - F#5 - | E5 - - - | . . . .'),
    bass: parse('E2 B2 C3 G2 | A2 E3 B2 F#2 | E2 B2 C3 G2 | A2 B2 E2 E2'),
  },
  mine: {
    bpm: 90, leadWave: 'triangle', bassWave: 'square',
    lead: parse('D4 . F4 . | A4 - G4 . | F4 . E4 . | D4 - - . | C4 . E4 . | G4 - F4 . | E4 . C#4 . | D4 - - .'),
    bass: parse('D2 D2 A1 A1 | Bb1 Bb1 F2 F2 | G1 G1 D2 D2 | A1 A1 D2 D2'),
  },
  festival: {
    bpm: 144, leadWave: 'square', bassWave: 'triangle',
    lead: parse('C5 C5 E5 G5 | C6 - G5 . | A5 G5 F5 E5 | D5 - - . | E5 E5 G5 C6 | B5 - A5 G5 | F5 E5 D5 B4 | C5 - - .'),
    bass: parse('C3 G2 C3 G2 | F2 C3 G2 D3 | C3 G2 A2 E3 | F2 G2 C3 C3'),
  },
  night: {
    bpm: 72, leadWave: 'triangle', bassWave: 'triangle',
    lead: parse('G4 - C5 - | E5 - D5 - | C5 - A4 - | G4 - - - | F4 - A4 - | C5 - B4 - | C5 - - - | . . . .'),
    bass: parse('C3 G2 A2 E2 | F2 C3 G2 D3 | C3 G2 A2 E2 | F2 G2 C3 C3'),
  },
  title: {
    bpm: 100, leadWave: 'triangle', bassWave: 'triangle',
    lead: parse('E5 . D5 C5 | G4 - C5 . | D5 E5 F5 E5 | D5 - - . | E5 . G5 E5 | D5 - C5 . | D5 . B4 G4 | C5 - - .'),
    bass: parse('C3 G2 C3 G2 | D3 A2 G2 D3 | C3 G2 F2 C3 | G2 D3 C3 C3'),
  },
};

const JINGLES = {
  harvest: { bpm: 360, wave: 'square', notes: [['C5', 1], ['E5', 1], ['G5', 2]] },
  catch: { bpm: 280, wave: 'square', notes: [['G4', 1], ['C5', 1], ['E5', 1], ['G5', 1], ['C6', 3]] },
  bundle: { bpm: 260, wave: 'triangle', notes: [['C5', 1], ['E5', 1], ['G5', 1], ['C6', 1], ['E6', 3]] },
  fanfare: { bpm: 200, wave: 'square', notes: [['G4', 1], ['G4', 1], ['G4', 1], ['C5', 3], ['E5', 1], ['G5', 4]] },
  sad: { bpm: 140, wave: 'triangle', notes: [['E5', 2], ['D5', 2], ['C5', 2], ['A4', 4]] },
  morning: { bpm: 240, wave: 'triangle', notes: [['C5', 1], ['G5', 1], ['E5', 1], ['C6', 3]] },
  heart: { bpm: 300, wave: 'triangle', notes: [['A5', 1], ['C6', 1], ['E6', 2]] },
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
// Browsers only allow audio after a tap: never create the context before one.
let gestured = false;
const hasGesture = () => gestured || !!navigator.userActivation?.hasBeenActive;
if (typeof window !== 'undefined') {
  const first = () => {
    gestured = true;
    for (const ev of ['pointerup', 'touchend', 'keydown']) window.removeEventListener(ev, first, true);
    if (current && !timer) { const name = current; current = null; playMusic(name); }
  };
  for (const ev of ['pointerup', 'touchend', 'keydown']) window.addEventListener(ev, first, true);
}

function audio() {
  if (!ctx && !hasGesture()) return null;
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
  if (nextT < ctx.currentTime - 1) nextT = ctx.currentTime + 0.05;
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
      if (b && b !== 'hold') tone(b, nextT, e * 1.8, song.bassWave, song.bassWave === 'square' ? 0.35 : 0.8);
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

/** A short jingle (ducks the music under it). */
export function jingle(name) {
  const j = JINGLES[name];
  if (!j || isMuted() || !audio()) return;
  const out = ctx.createGain(); out.gain.value = 0.08; out.connect(ctx.destination);
  const dur = j.notes.reduce((a, [, l]) => a + l, 0) * (60 / j.bpm / 2);
  if (master && musicOn()) {
    master.gain.setTargetAtTime(VOLUME * 0.25, ctx.currentTime, 0.02);
    master.gain.setTargetAtTime(VOLUME, ctx.currentTime + dur, 0.2);
  }
  let t = ctx.currentTime + 0.02;
  for (const [n, l] of j.notes) {
    const d = l * (60 / j.bpm / 2);
    tone(freq(n), t, d * 0.95, j.wave, 0.6, out);
    t += d;
  }
}

/** Soft swish/splash noises for tools, on the shared context. */
export function swish(kind = 'water') {
  if (isMuted() || !audio()) return;
  const dur = kind === 'water' ? 0.25 : 0.12;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((i / d.length) * Math.PI);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = kind === 'water' ? 'bandpass' : 'lowpass'; f.frequency.value = kind === 'water' ? 1800 : 600;
  const g = ctx.createGain(); g.gain.value = kind === 'water' ? 0.12 : 0.18;
  src.connect(f).connect(g).connect(ctx.destination);
  src.start();
}

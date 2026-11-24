// Little chiptune loops and jingles for Alchemist's Shop (Web Audio, no files, original tunes).
// Uses the shared audio context from shared/core/sfx.js; silent when muted or when music is off.
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
  // a cosy 3/4-ish shop tune
  shop: {
    bpm: 104, leadWave: 'triangle', bassWave: 'triangle',
    lead: parse('E5 . G5 A5 | G5 - E5 . | D5 . E5 G5 | E5 - - . | C5 . D5 E5 | G5 - A5 G5 | E5 D5 C5 D5 | E5 - - . | A5 . G5 E5 | D5 - C5 . | D5 . E5 G5 | A5 - - . | G5 . E5 D5 | C5 - D5 E5 | D5 C5 A4 B4 | C5 - - .'),
    bass: parse('C3 G2 C3 G2 | A2 E3 A2 E3 | F2 C3 G2 D3 | C3 G2 C3 C3 | F2 C3 F2 C3 | G2 D3 G2 D3 | F2 C3 G2 D3 | C3 G2 C3 C3'),
  },
  gather: {
    bpm: 126, leadWave: 'square', bassWave: 'triangle',
    lead: parse('G4 . B4 D5 | E5 - D5 B4 | C5 . E5 G5 | D5 - - . | B4 . D5 G5 | A5 - G5 E5 | D5 E5 D5 B4 | G4 - - .'),
    bass: parse('G2 D3 G2 D3 | C3 G2 C3 G2 | D3 A2 D3 A2 | G2 D3 G2 G2'),
  },
  cave: {
    bpm: 92, leadWave: 'triangle', bassWave: 'triangle',
    lead: parse('A4 . C5 E5 | D5 - . C5 | B4 . G4 . | A4 - - . | F4 . A4 C5 | B4 - . G4 | E4 . G#4 B4 | A4 - - .'),
    bass: parse('A2 A2 E2 E2 | G2 G2 E2 E2 | F2 F2 C3 C3 | E2 E2 A2 A2'),
  },
  festival: {
    bpm: 140, leadWave: 'square', bassWave: 'triangle',
    lead: parse('C5 C5 E5 G5 | C6 - G5 . | A5 G5 F5 E5 | D5 - - . | E5 E5 G5 C6 | B5 - A5 G5 | F5 E5 D5 B4 | C5 - - .'),
    bass: parse('C3 G2 C3 G2 | F2 C3 G2 D3 | C3 G2 A2 E3 | F2 G2 C3 C3'),
  },
  night: {
    bpm: 76, leadWave: 'triangle', bassWave: 'triangle',
    lead: parse('E5 - D5 - | C5 - G4 - | A4 - C5 - | B4 - - - | C5 - E5 - | D5 - B4 - | C5 - - - | . . . .'),
    bass: parse('A2 E3 F2 C3 | G2 D3 E2 B2 | A2 E3 F2 C3 | G2 G2 C3 C3'),
  },
};

const JINGLES = {
  sale: { bpm: 320, wave: 'square', notes: [['E5', 1], ['G5', 1], ['C6', 2]] },
  recipe: { bpm: 260, wave: 'square', notes: [['C5', 1], ['E5', 1], ['G5', 1], ['C6', 1], ['E6', 3]] },
  upgrade: { bpm: 280, wave: 'triangle', notes: [['G4', 1], ['C5', 1], ['E5', 1], ['G5', 3]] },
  fanfare: { bpm: 200, wave: 'square', notes: [['G4', 1], ['G4', 1], ['G4', 1], ['C5', 3], ['E5', 1], ['G5', 4]] },
  sad: { bpm: 140, wave: 'triangle', notes: [['E5', 2], ['D5', 2], ['C5', 2], ['A4', 4]] },
  door: { bpm: 300, wave: 'triangle', notes: [['A5', 1], ['E5', 2]] },
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
  // pointerup/touchend (not pointerdown) count as a user gesture for touch on every browser
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
  // after a long sleep, don't try to catch up hundreds of notes
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
      if (b && b !== 'hold') tone(b, nextT, e * 1.8, song.bassWave, 0.8);
    }
    step++; nextT += e;
  }
}

/** Switch the background tune ('shop' | 'gather' | 'cave' | 'festival' | 'night' | null). */
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

/** Cauldron bubbles: a few quick rising blips. */
export function bubble(n = 3) {
  if (isMuted() || !audio()) return;
  const out = ctx.createGain(); out.gain.value = 0.05; out.connect(ctx.destination);
  for (let i = 0; i < n; i++) {
    const t = ctx.currentTime + 0.02 + i * (0.07 + Math.random() * 0.05);
    const o = ctx.createOscillator(); const g = ctx.createGain();
    const f = 220 + Math.random() * 240;
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.06);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + 0.1);
  }
}

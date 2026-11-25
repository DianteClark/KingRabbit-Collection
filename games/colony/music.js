// Colony's music, played on the one shared Web Audio context from shared/core/sfx.js. Quiet,
// silent when the shared mute is on, and can be switched off in the menu. Original tunes.
import { isMuted, audioContext, onAudioReset } from '../../shared/core/sfx.js';
import { store } from './store.js';

const VOLUME = 0.045;
const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, Bb: 10, B: 11 };
const freq = (n) => { const m = n.match(/^([A-G][#b]?)(\d)$/); return 440 * 2 ** ((12 * (Number(m[2]) + 1) + NOTE[m[1]] - 69) / 12); };
const parse = (s) => s.replace(/\|/g, ' ').split(/\s+/).filter(Boolean).map((t) => (t === '.' ? null : t === '-' ? 'hold' : freq(t)));

const SONGS = {
  // A gentle folk tune for working days.
  calm: {
    bpm: 84, lead: 'triangle', bass: 'sine',
    notes: parse('G4 - B4 . | D5 - B4 . | C5 - A4 . | G4 - - . | E4 - G4 . | A4 - B4 . | A4 - - - | . . . . | G4 - B4 . | D5 - E5 . | D5 - B4 . | A4 - G4 . | E4 - G4 . | A4 - F#4 . | G4 - - - | . . . .'),
    low: parse('G2 . D3 . | C3 . G2 . | E2 . C3 . | D3 . D2 . | G2 . D3 . | C3 . G2 . | C3 . D3 . | G2 . . .'),
  },
  // Slow and sparse for winter.
  winter: {
    bpm: 62, lead: 'sine', bass: 'sine',
    notes: parse('E5 - - . | B4 - - . | C5 - D5 . | B4 - - - | A4 - - . | G4 - - . | A4 - B4 . | E4 - - - | . . . . | E5 - - . | D5 - C5 . | B4 - - - | A4 - G4 . | F#4 - - . | E4 - - - | . . . .'),
    low: parse('E2 . . . | C2 . . . | A1 . . . | B1 . . . | E2 . . . | C2 . . . | D2 . . . | E2 . . .'),
  },
  // Drums of war for raids.
  danger: {
    bpm: 132, lead: 'square', bass: 'triangle',
    notes: parse('D4 D4 F4 D4 | G4 F4 D4 C4 | D4 D4 F4 A4 | G#4 - G4 - | C4 C4 Eb4 C4 | F4 Eb4 C4 Bb3 | D4 F4 A4 D5 | C#5 - A4 -'),
    low: parse('D2 D2 D2 D2 | Bb1 Bb1 Bb1 Bb1 | C2 C2 C2 C2 | A1 A1 A1 A1'),
  },
};

let ctx = null; let master = null; let current = null; let timer = null; let step = 0; let nextT = 0;

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

export const musicOn = () => store.get('music') !== false;
export function setMusicOn(on) { store.set('music', on); syncVolume(); }
export function syncVolume() {
  if (!master) return;
  master.gain.setTargetAtTime(isMuted() || !musicOn() ? 0 : VOLUME, ctx.currentTime, 0.05);
}

function tone(f, t, dur, wave, vol) {
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = wave; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function tick() {
  const song = SONGS[current];
  if (!song || !ctx) return;
  syncVolume();
  const e = 60 / song.bpm / 2;
  while (nextT < ctx.currentTime + 0.3) {
    const li = step % song.notes.length;
    const n = song.notes[li];
    if (n && n !== 'hold') {
      let len = 1;
      while (song.notes[(li + len) % song.notes.length] === 'hold' && len < 8) len++;
      tone(n, nextT, e * len * 0.95, song.lead, song.lead === 'square' ? 0.3 : 0.7);
    }
    if (step % 2 === 0) {
      const b = song.low[(step / 2) % song.low.length];
      if (b && b !== 'hold') tone(b, nextT, e * 3.2, song.bass, 0.85);
    }
    step++; nextT += e;
  }
}

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

/** Switch tune: 'calm' | 'winter' | 'danger' | null. */
export function playMusic(name) {
  if (!activated()) { startLater(name); return; }
  if (name === current) { if (name && !timer && audio()) timer = setInterval(tick, 80); return; }
  current = name;
  if (!audio()) return;
  clearInterval(timer); timer = null;
  if (!name) { syncVolume(); return; }
  step = 0; nextT = ctx.currentTime + 0.1;
  timer = setInterval(tick, 80);
  tick();
}
export const currentMusic = () => current;

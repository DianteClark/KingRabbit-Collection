// Tiny chiptune background music and jingles for Hollow Crown (Web Audio, no files).
// Quiet by default, silent whenever the shared mute is on, and switchable off in the pause menu.
// All tunes are original.
import { isMuted } from '../../shared/core/sfx.js';
import { save } from './save.js';

const VOLUME = 0.045;

const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const freq = (n) => {
  const m = n.match(/^([A-G][#b]?)(\d)$/);
  const midi = 12 * (Number(m[2]) + 1) + NOTE[m[1]];
  return 440 * 2 ** ((midi - 69) / 12);
};
/** "C5 . E5 -" -> [freq|null|'hold'] ('.' rest, '-' hold the previous note) */
const parse = (s) => s.replace(/\|/g, ' ').split(/\s+/).filter(Boolean).map((t) => (t === '.' ? null : t === '-' ? 'hold' : freq(t)));

// step = one eighth note for the lead, one quarter for the bass
const SONGS = {
  village: {
    bpm: 116, leadWave: 'square', bassWave: 'triangle',
    lead: parse('C5 . E5 G5 | A5 - G5 E5 | F5 . A5 C6 | G5 - - . | E5 . G5 C6 | B5 - A5 G5 | F5 E5 D5 E5 | C5 - - .'),
    bass: parse('C3 G2 C3 G2 | F2 C3 G2 D3 | C3 G2 A2 E3 | F2 G2 C3 C3'),
  },
  field: {
    bpm: 132, leadWave: 'square', bassWave: 'triangle',
    lead: parse('A4 . C5 E5 | D5 - C5 B4 | C5 . E5 A5 | G5 - E5 . | F5 . E5 D5 | E5 - C5 A4 | B4 C5 D5 B4 | A4 - - .'),
    bass: parse('A2 E3 A2 E3 | F2 C3 F2 C3 | G2 D3 G2 D3 | E2 B2 E2 E2'),
  },
  dungeon: {
    bpm: 88, leadWave: 'triangle', bassWave: 'triangle',
    lead: parse('D5 . . F5 | E5 - . A4 | D5 . C5 . | A4 - - . | Bb4 . . D5 | C5 - . F4 | G4 . A4 . | D4 - - .'),
    bass: parse('D2 D2 A2 A2 | Bb1 Bb1 F2 F2 | G2 G2 A2 A2 | D2 D2 A1 A1'),
  },
  boss: {
    bpm: 152, leadWave: 'square', bassWave: 'square',
    lead: parse('E5 E5 G5 E5 | F#5 E5 D5 B4 | E5 E5 G5 B5 | A5 G5 F#5 D5 | C5 C5 E5 C5 | D5 C5 B4 A4 | B4 D#5 F#5 B5 | B4 . B4 .'),
    bass: parse('E2 E2 E2 E2 | C2 C2 D2 D2 | C2 C2 A1 A1 | B1 B1 B1 B1'),
  },
};

// short one-shots: [note, eighths] at a fixed tempo
const JINGLES = {
  unlock: { bpm: 300, wave: 'square', notes: [['G4', 1], ['C5', 1], ['E5', 2]] },
  door: { bpm: 260, wave: 'triangle', notes: [['C4', 1], ['G4', 1], ['C5', 2]] },
  secret: { bpm: 220, wave: 'square', notes: [['C5', 1], ['E5', 1], ['G5', 1], ['C6', 1], ['B5', 1], ['G5', 1], ['E6', 3]] },
  fanfare: { bpm: 200, wave: 'square', notes: [['G4', 1], ['G4', 1], ['G4', 1], ['C5', 3], ['E5', 1], ['G5', 4]] },
};

let ctx = null; let master = null;
let current = null; let timer = null; let step = 0; let nextT = 0;

function audio() {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
      // browsers start audio only after a tap
      const resume = () => ctx.state === 'suspended' && ctx.resume();
      window.addEventListener('pointerdown', resume);
      window.addEventListener('keydown', resume);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch { return null; }
}

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
  const e = 60 / song.bpm / 2; // eighth note
  while (nextT < ctx.currentTime + 0.25) {
    const li = step % song.lead.length;
    const n = song.lead[li];
    if (n && n !== 'hold') {
      let len = 1;
      while (song.lead[(li + len) % song.lead.length] === 'hold' && len < 8) len++;
      tone(n, nextT, e * len * 0.95, song.leadWave, song.leadWave === 'square' ? 0.5 : 0.8);
    }
    if (step % 2 === 0) {
      const b = song.bass[(step / 2) % song.bass.length];
      if (b && b !== 'hold') tone(b, nextT, e * 1.8, song.bassWave, song.bassWave === 'square' ? 0.35 : 0.9);
    }
    step++; nextT += e;
  }
}

/** Switch the background tune ('village' | 'field' | 'dungeon' | 'boss' | null). */
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

/** A short local jingle; returns false if there is no such jingle (caller falls back to sfx). */
export function jingle(name) {
  const j = JINGLES[name];
  if (!j) return false;
  if (isMuted() || !audio()) return true;
  const out = ctx.createGain(); out.gain.value = 0.09; out.connect(ctx.destination);
  // duck the music under the jingle
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
  return true;
}

/** Which tune fits a room. */
export function tuneFor(room, bossAlive) {
  if (!room) return null;
  if (room.boss && bossAlive) return 'boss';
  if (room.area === 'ow') return room.theme === 'village' ? 'village' : 'field';
  if (room.area === 'in') return room.theme === 'cave' ? 'dungeon' : 'village';
  return 'dungeon';
}

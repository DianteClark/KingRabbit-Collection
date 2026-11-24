// Pocket Soccer's own sounds (whistle, kicks), synthesized like shared/core/sfx.js and silent
// whenever the shared mute is on. Everything else still uses sfx().
import { isMuted, audioContext } from '../../shared/core/sfx.js';

// Uses the shared audio context, which wakes itself up after the app was in the background.
function audio() {
  if (isMuted()) return null;
  return audioContext();
}

/** Referee's pea whistle: a high tone warbled fast by a second oscillator. */
function whistle(a, at, dur, vol = 0.06) {
  const o = a.createOscillator(); const lfo = a.createOscillator();
  const depth = a.createGain(); const g = a.createGain();
  o.type = 'square'; o.frequency.setValueAtTime(2350, at);
  lfo.type = 'sine'; lfo.frequency.setValueAtTime(32, at);
  depth.gain.setValueAtTime(170, at);
  lfo.connect(depth).connect(o.frequency);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.02);
  g.gain.setValueAtTime(vol, at + dur - 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 5000;
  o.connect(f).connect(g).connect(a.destination);
  o.start(at); lfo.start(at); o.stop(at + dur + 0.02); lfo.stop(at + dur + 0.02);
}

/** Boot on ball: a short low thump plus a click of noise. strength 0..1. */
function kick(a, at, strength) {
  const o = a.createOscillator(); const g = a.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(150 + strength * 60, at);
  o.frequency.exponentialRampToValueAtTime(55, at + 0.09);
  g.gain.setValueAtTime(0.12 + strength * 0.14, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.11);
  o.connect(g).connect(a.destination);
  o.start(at); o.stop(at + 0.13);
  const n = Math.floor(a.sampleRate * 0.03);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800;
  const ng = a.createGain(); ng.gain.value = 0.05 + strength * 0.08;
  src.connect(f).connect(ng).connect(a.destination);
  src.start(at);
}

const SOUNDS = {
  whistle: (a, t) => whistle(a, t, 0.32),                                   // kick-off, restarts
  whistleLong: (a, t) => { whistle(a, t, 0.3); whistle(a, t + 0.42, 0.75); }, // half time
  whistleFull: (a, t) => { whistle(a, t, 0.3); whistle(a, t + 0.4, 0.3); whistle(a, t + 0.8, 0.9); },
  pass: (a, t) => kick(a, t, 0.25),
  shot: (a, t) => kick(a, t, 1),
  touch: (a, t) => kick(a, t, 0),
};

export function sound(name) {
  const a = audio();
  if (!a) return;
  try { SOUNDS[name]?.(a, a.currentTime + 0.005); } catch { /* ignore */ }
}

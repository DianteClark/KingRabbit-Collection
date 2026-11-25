// Golf sounds, synthesized on the collection's one shared audio context (shared/core/sfx.js).
import { audioContext, isMuted, sfx } from '../../shared/core/sfx.js';

function ctx() { return isMuted() ? null : audioContext(); }

function tone(freq, dur, { type = 'triangle', vol = 0.08, delay = 0 } = {}) {
  const a = ctx();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(); const g = a.createGain();
  o.type = type;
  if (Array.isArray(freq)) { o.frequency.setValueAtTime(freq[0], t); o.frequency.exponentialRampToValueAtTime(freq[1], t + dur); } else o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, { vol = 0.1, delay = 0, lowpass = 1500, highpass = 0 } = {}) {
  const a = ctx();
  if (!a) return;
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * dur)), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource(); src.buffer = buf;
  let node = src;
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = lowpass; node.connect(lp); node = lp;
  if (highpass) { const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = highpass; node.connect(hp); node = hp; }
  const g = a.createGain(); g.gain.value = vol;
  node.connect(g).connect(a.destination);
  src.start(t);
}

const SOUNDS = {
  putt: (p = 0.5) => { noise(0.04, { vol: 0.08 + p * 0.1, lowpass: 3500, highpass: 600 }); tone([900 - p * 300, 500], 0.05, { type: 'sine', vol: 0.06 + p * 0.05 }); },
  wall: (v = 0.5) => tone([300 + v * 200, 200], 0.05, { vol: 0.03 + v * 0.05 }),
  cup: () => { tone(520, 0.05, { vol: 0.07, type: 'sine' }); tone(390, 0.05, { vol: 0.06, type: 'sine', delay: 0.06 }); tone(260, 0.12, { vol: 0.08, type: 'sine', delay: 0.12 }); },
  splash: () => { noise(0.5, { vol: 0.16, lowpass: 900 }); tone([500, 120], 0.25, { type: 'sine', vol: 0.05 }); },
  sizzle: () => { noise(0.6, { vol: 0.12, lowpass: 5000, highpass: 1500 }); },
  portal: () => { tone([300, 1200], 0.18, { type: 'sine', vol: 0.07 }); tone([1200, 600], 0.15, { type: 'sine', vol: 0.05, delay: 0.16 }); },
  jump: () => tone([300, 900], 0.2, { type: 'square', vol: 0.04 }),
  land: () => tone([200, 90], 0.08, { type: 'sine', vol: 0.1 }),
  bumper: () => { tone(660, 0.06, { type: 'square', vol: 0.05 }); tone(990, 0.08, { type: 'square', vol: 0.04, delay: 0.04 }); },
  boost: () => tone([400, 1100], 0.15, { type: 'sawtooth', vol: 0.03 }),
  mill: () => tone([180, 120], 0.08, { type: 'square', vol: 0.05 }),
};

/** Play a golf sound; falls back to the shared effects for the rest. */
export function play(name, arg) {
  if (isMuted()) return;
  try { if (SOUNDS[name]) SOUNDS[name](arg); else sfx(name); } catch { /* ignore */ }
}

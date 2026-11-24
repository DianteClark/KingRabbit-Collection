// Tiny synthesized sound effects (no audio files). Retro square/triangle blips via Web Audio.
// Browsers only allow sound after the first tap, so the audio context starts on first use.

const KEY = 'kingrabbit:muted';
let ctx = null;
let muted = false;
try { muted = localStorage.getItem(KEY) === '1'; } catch { /* ignore */ }

function create() {
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; }
  return ctx;
}

/**
 * The one shared Web Audio context for every game (music and effects should both use it).
 * Phones suspend audio when the app is backgrounded or the screen sleeps ('suspended', or
 * 'interrupted' on iOS), and only let it restart during a tap. wake() below handles that.
 */
export function audioContext() {
  if (!ctx) create();
  if (ctx && ctx.state !== 'running') ctx.resume?.().catch(() => {});
  return ctx;
}

function audio() {
  if (muted) return null;
  return audioContext();
}

/** Try to get sound going again. On a tap, a context that refuses to resume is replaced. */
function wake(fromGesture) {
  if (!ctx) return;
  if (ctx.state === 'running') return;
  const p = ctx.resume?.();
  if (!fromGesture || !p) return;
  p.then(() => {
    // iOS sometimes leaves a context 'interrupted' for good after a phone call or long sleep.
    if (ctx.state !== 'running') { try { ctx.close(); } catch { /* ignore */ } create(); listeners.forEach((f) => f(ctx)); }
  }).catch(() => { try { ctx.close(); } catch { /* ignore */ } create(); listeners.forEach((f) => f(ctx)); });
}

const listeners = new Set();
/** Games with their own audio graph (music) can re-attach when the context is replaced. */
export function onAudioReset(fn) { listeners.add(fn); return () => listeners.delete(fn); }

if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, () => wake(true), { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(false); });
  window.addEventListener('pageshow', () => wake(false));
  window.addEventListener('focus', () => wake(false));
}

/** One note: freq Hz (or [from, to] slide), duration s, wave type, volume, start delay s. */
function tone(freq, dur, { type = 'square', vol = 0.08, delay = 0 } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  if (Array.isArray(freq)) { o.frequency.setValueAtTime(freq[0], t); o.frequency.exponentialRampToValueAtTime(freq[1], t + dur); }
  else o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, { vol = 0.12, delay = 0, lowpass = 1200 } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = lowpass;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

const SOUNDS = {
  tap: () => tone(660, 0.05, { vol: 0.05 }),
  select: () => tone(880, 0.06, { vol: 0.05, type: 'triangle' }),
  place: () => { tone(330, 0.07, { type: 'triangle', vol: 0.1 }); },
  move: () => tone(440, 0.05, { type: 'triangle', vol: 0.07 }),
  capture: () => { tone([520, 180], 0.12, { vol: 0.08 }); noise(0.08, { vol: 0.06 }); },
  flip: () => tone([300, 600], 0.06, { type: 'triangle', vol: 0.06 }),
  error: () => tone([200, 140], 0.12, { vol: 0.06 }),
  roll: () => { for (let k = 0; k < 4; k++) noise(0.03, { vol: 0.08, delay: k * 0.05, lowpass: 3000 }); },
  card: () => noise(0.05, { vol: 0.07, lowpass: 4000 }),
  hit: () => tone([400, 900], 0.05, { vol: 0.07 }),
  bounce: () => tone(250, 0.04, { type: 'triangle', vol: 0.06 }),
  shoot: () => tone([900, 300], 0.08, { vol: 0.05 }),
  boom: () => noise(0.35, { vol: 0.2, lowpass: 700 }),
  smallBoom: () => noise(0.15, { vol: 0.12, lowpass: 1200 }),
  coin: () => { tone(988, 0.06, { vol: 0.06 }); tone(1319, 0.12, { vol: 0.06, delay: 0.06 }); },
  power: () => [523, 659, 784, 1047].forEach((f, k) => tone(f, 0.07, { vol: 0.05, delay: k * 0.05 })),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, k) => tone(f, 0.12, { vol: 0.07, delay: k * 0.09, type: 'triangle' })),
  lose: () => [392, 330, 262, 196].forEach((f, k) => tone(f, 0.16, { vol: 0.07, delay: k * 0.12, type: 'triangle' })),
  goal: () => [784, 988, 1175].forEach((f, k) => tone(f, 0.1, { vol: 0.07, delay: k * 0.07 })),
  strike: () => { noise(0.4, { vol: 0.18, lowpass: 2500 }); SOUNDS.win(); },
  pins: () => noise(0.3, { vol: 0.14, lowpass: 2000 }),
  thud: () => tone([160, 60], 0.12, { type: 'sine', vol: 0.15 }),
};

export function sfx(name) {
  if (muted) return;
  try { SOUNDS[name]?.(); } catch { /* ignore */ }
}

export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem(KEY, m ? '1' : '0'); } catch { /* ignore */ }
}

// Engine hum, tyre squeal and a few race sounds, on the shared Web Audio context from
// shared/core/sfx.js (so it wakes up again after the phone sleeps). Quiet, and silent whenever
// the shared mute is on.
import { isMuted, audioContext, onAudioReset } from '../../shared/core/sfx.js';

const ENGINE_VOL = 0.022;
const SQUEAL_VOL = 0.018;

let eng = null;   // { ctx, osc1, osc2, filt, gain, nsrc, nfilt, ngain }

function build(ctx) {
  const gain = ctx.createGain(); gain.gain.value = 0;
  const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 520; filt.Q.value = 2;
  const osc1 = ctx.createOscillator(); osc1.type = 'sawtooth'; osc1.frequency.value = 50;
  const osc2 = ctx.createOscillator(); osc2.type = 'square'; osc2.frequency.value = 25;
  const g2 = ctx.createGain(); g2.gain.value = 0.5;
  osc1.connect(filt); osc2.connect(g2).connect(filt);
  filt.connect(gain).connect(ctx.destination);
  // tyre squeal: looping noise through a band-pass
  const len = Math.floor(ctx.sampleRate * 1);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const nsrc = ctx.createBufferSource(); nsrc.buffer = buf; nsrc.loop = true;
  const nfilt = ctx.createBiquadFilter(); nfilt.type = 'bandpass'; nfilt.frequency.value = 1700; nfilt.Q.value = 6;
  const ngain = ctx.createGain(); ngain.gain.value = 0;
  nsrc.connect(nfilt).connect(ngain).connect(ctx.destination);
  osc1.start(); osc2.start(); nsrc.start();
  return { ctx, osc1, osc2, filt, gain, nsrc, nfilt, ngain };
}

let unhook = null;

/** Start the engine sound (once per race). */
export function engineStart() {
  if (eng) return;
  const ctx = audioContext();
  if (!ctx) return;
  try { eng = build(ctx); } catch { eng = null; }
  unhook ||= onAudioReset((c) => { if (eng) { engineStop(); try { eng = build(c); } catch { eng = null; } } });
}

/** speed 0..1 of top speed, drift 0/1, boost 0/1. */
export function engineUpdate(speed, drift, boost, on = true) {
  if (!eng) return;
  const { ctx } = eng;
  if (ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const quiet = isMuted() || !on;
  const f = 42 + speed * 95 + (boost ? 18 : 0);
  eng.osc1.frequency.setTargetAtTime(f, t, 0.05);
  eng.osc2.frequency.setTargetAtTime(f / 2, t, 0.05);
  eng.filt.frequency.setTargetAtTime(380 + speed * 600 + (boost ? 300 : 0), t, 0.08);
  eng.gain.gain.setTargetAtTime(quiet ? 0 : ENGINE_VOL * (0.55 + speed * 0.45), t, 0.06);
  eng.ngain.gain.setTargetAtTime(quiet || !drift ? 0 : SQUEAL_VOL, t, 0.05);
}

export function engineStop() {
  if (!eng) return;
  const e = eng; eng = null;
  try {
    const t = e.ctx.currentTime;
    e.gain.gain.setTargetAtTime(0, t, 0.03); e.ngain.gain.setTargetAtTime(0, t, 0.03);
    setTimeout(() => { try { e.osc1.stop(); e.osc2.stop(); e.nsrc.stop(); e.gain.disconnect(); e.ngain.disconnect(); } catch { /* ignore */ } }, 150);
  } catch { /* ignore */ }
}

function tone(freq, dur, { type = 'square', vol = 0.06, delay = 0 } = {}) {
  if (isMuted()) return;
  const a = audioContext();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(); const g = a.createGain();
  o.type = type;
  if (Array.isArray(freq)) { o.frequency.setValueAtTime(freq[0], t); o.frequency.exponentialRampToValueAtTime(freq[1], t + dur); } else o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}

const SOUNDS = {
  count: () => tone(440, 0.18, { vol: 0.06 }),
  go: () => tone(880, 0.4, { vol: 0.07 }),
  boost: () => { tone([220, 880], 0.35, { type: 'sawtooth', vol: 0.04 }); },
  pad: () => { tone([330, 990], 0.2, { type: 'triangle', vol: 0.06 }); },
  lap: () => { tone(784, 0.08, { vol: 0.05 }); tone(1047, 0.14, { vol: 0.05, delay: 0.08 }); },
  bump: () => tone([180, 90], 0.08, { type: 'triangle', vol: 0.08 }),
};

export function sound(name) { try { SOUNDS[name]?.(); } catch { /* ignore */ } }

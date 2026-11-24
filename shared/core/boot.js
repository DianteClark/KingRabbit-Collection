import Phaser from 'phaser';
import './base.css';
import { PALETTE } from './palette.js';

// Every game is designed at this size and scaled to fit the phone (portrait games).
export const WIDTH = 360;
export const HEIGHT = 640;
// Landscape games (startGame({ orientation: 'landscape' })) are designed at 640x360.
export const LANDSCAPE = { WIDTH: 640, HEIGHT: 360 };

/**
 * Start a portrait, pixel-art Phaser game.
 * @param {object} opts
 * @param {Phaser.Types.Scenes.SceneType[]} opts.scenes  first scene runs first
 * @param {string} [opts.background]
 * @param {'portrait'|'landscape'} [opts.orientation]
 */
export async function startGame({ scenes, background = PALETTE.night, orientation = 'portrait' }) {
  const land = orientation === 'landscape';
  document.body.classList.add('game');
  if (land) document.body.classList.add('landscape');
  addRotateOverlay(land);

  // Wait for the pixel font, or Phaser would draw the first frames in a fallback font.
  try { await document.fonts.load('16px BoldPixels'); } catch { /* fall back to monospace */ }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: land ? LANDSCAPE.WIDTH : WIDTH,
    height: land ? LANDSCAPE.HEIGHT : HEIGHT,
    backgroundColor: background,
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 4 },
    // All sound comes from shared/core/sfx.js; Phaser's own audio context would only trigger
    // 'AudioContext was not allowed to start' warnings before the first tap.
    audio: { noAudio: true },
    scene: scenes,
  });

  // Pause the game while the phone is held the wrong way.
  const wrong = window.matchMedia(land ? '(orientation: portrait) and (max-width: 540px)' : '(orientation: landscape) and (max-height: 540px)');
  const sync = () => (wrong.matches ? game.loop.sleep() : game.loop.wake());
  wrong.addEventListener?.('change', sync);
  // Phaser may already be booted by now, so check straight away as well as on 'ready'.
  game.events.once('ready', sync);
  sync();

  watchFirstScreen(game);
  registerOffline();
  tryOrientationLock(land ? 'landscape' : 'portrait');
  window.__game = game; // handy for debugging in the browser console
  return game;
}

function addRotateOverlay(land) {
  if (document.getElementById('rotate')) return;
  const el = document.createElement('div');
  el.id = 'rotate';
  el.innerHTML = land
    ? '<div class="phone"></div><div>Turn your phone sideways</div><small>This game plays in landscape</small>'
    : '<div class="phone"></div><div>Turn your phone upright</div><small>This game plays in portrait</small>';
  document.body.appendChild(el);
}

// Browsers only allow a hard orientation lock in fullscreen or when installed (mostly Android).
// Where it isn't allowed this quietly does nothing and the rotate overlay covers it.
function tryOrientationLock(mode) {
  const lock = () => screen.orientation?.lock?.(mode).catch(() => {});
  lock();
  window.addEventListener('pointerup', lock, { once: true });
}

/**
 * Keep the page's loading screen (injected by vite.config.js) showing loader progress until the
 * game's first real screen is up, then remove it.
 */
function watchFirstScreen(game) {
  const done = () => { window.__bootDone?.(); };
  const timer = setInterval(() => {
    if (!game.isBooted) return;
    const active = game.scene.getScenes(true);
    const loading = active.find((s) => s.load?.isLoading?.());
    if (loading) { window.__bootProgress?.(loading.load.progress); return; }
    const real = active.some((s) => !/boot|preload|load/i.test(s.scene.key));
    if (real) { clearInterval(timer); done(); }
  }, 100);
}

/** Cache each game on the phone after the first visit so later opens are quick, even offline. */
function registerOffline() {
  if (!('serviceWorker' in navigator) || location.hostname === 'localhost') return;
  try { navigator.serviceWorker.register(new URL('../sw.js', location.href), { scope: new URL('../', location.href).pathname }).catch(() => {}); } catch { /* ignore */ }
}

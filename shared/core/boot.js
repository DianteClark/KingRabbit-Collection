import Phaser from 'phaser';
import './base.css';
import { PALETTE } from './palette.js';

// Every game is designed at this size and scaled to fit the phone, portrait only.
export const WIDTH = 360;
export const HEIGHT = 640;

/**
 * Start a portrait, pixel-art Phaser game.
 * @param {object} opts
 * @param {Phaser.Types.Scenes.SceneType[]} opts.scenes  first scene runs first
 * @param {string} [opts.background]
 */
export async function startGame({ scenes, background = PALETTE.night }) {
  document.body.classList.add('game');
  addRotateOverlay();

  // Wait for the pixel font, or Phaser would draw the first frames in a fallback font.
  try { await document.fonts.load('16px BoldPixels'); } catch { /* fall back to monospace */ }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: background,
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 4 },
    scene: scenes,
  });

  // Pause the game while the phone is sideways.
  const landscape = window.matchMedia('(orientation: landscape) and (max-height: 540px)');
  const sync = () => (landscape.matches ? game.loop.sleep() : game.loop.wake());
  landscape.addEventListener?.('change', sync);
  game.events.once('ready', sync);

  tryPortraitLock();
  window.__game = game; // handy for debugging in the browser console
  return game;
}

function addRotateOverlay() {
  if (document.getElementById('rotate')) return;
  const el = document.createElement('div');
  el.id = 'rotate';
  el.innerHTML = '<div class="phone"></div><div>Turn your phone upright</div><small>This game plays in portrait</small>';
  document.body.appendChild(el);
}

// Browsers only allow a hard orientation lock in fullscreen or when installed (mostly Android).
// Where it isn't allowed this quietly does nothing and the rotate overlay covers it.
function tryPortraitLock() {
  const lock = () => screen.orientation?.lock?.('portrait').catch(() => {});
  lock();
  window.addEventListener('pointerup', lock, { once: true });
}

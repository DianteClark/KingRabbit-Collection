import Phaser from 'phaser';
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel, fadeTo } from '../../../shared/core/ui.js';
import { WIDTH, HEIGHT } from '../../../shared/core/boot.js';
import { showHowTo } from '../../../shared/core/howto.js';
import { sfx } from '../../../shared/core/sfx.js';
import { RULES } from '../rules.js';
import { artRef } from '../frames.js';
import { saveRun } from '../save.js';
import { RELICS } from '../logic/relics.js';
import { POTIONS } from '../logic/potions.js';
import { HEROES, drinkOnMap, discardPotion } from '../logic/run.js';

export { PALETTE, hex, text, button, panel, WIDTH, HEIGHT, sfx };

/** Which scene shows each run screen. */
const SCREEN_SCENES = {
  map: 'Map', combat: 'Battle', reward: 'Reward', bossRelic: 'Reward', event: 'Event',
  shop: 'Shop', rest: 'Rest', treasure: 'Treasure', dead: 'RunEnd', victory: 'RunEnd',
};

/** Go to another scene with a quick fade. */
export function go(scene, key, data) {
  // Ignore double taps: only the first scene change from a screen counts.
  if (scene._leaving) return;
  scene._leaving = true;
  scene.events.once('shutdown', () => { scene._leaving = false; });
  fadeTo(scene, () => scene.scene.start(key, data));
}

/**
 * Ignore taps for a moment. Used after a tap rebuilds the screen, so a quick double tap can't
 * land on whatever button appears in the same spot.
 */
export function tapCooldown(scene, ms = 300) {
  scene.input.enabled = false;
  const back = () => { scene.input.enabled = true; };
  scene.time.delayedCall(ms, back);
  scene.events.once('shutdown', back);
}

/** Save the run and show whatever screen it is on now. */
export function route(scene, run) {
  if (scene._leaving) return;
  saveRun(run);
  go(scene, SCREEN_SCENES[run.screen] || 'Map', { run });
}

export function setBackground(scene, color) {
  scene.cameras.main.setBackgroundColor(color).fadeIn(150);
  document.body.style.background = color;
}

/** Pause the scene and show the How to play sheet. */
export function openHowTo(scene) {
  if (document.getElementById('howto')) return;
  scene.scene.pause();
  showHowTo(RULES, () => scene.scene.resume());
}

/** Gold ? button (top right). */
export function helpButton(scene, x = WIDTH - 22, y = 22) {
  return button(scene, x, y, 36, 32, '?', () => openHowTo(scene), { size: 16, fill: PALETTE.gold }).setDepth(30);
}

/** An image for an art reference ('sp:3,1', 'necro:96', 'img:chest', ...). */
export function icon(scene, x, y, ref, scale = 2) {
  const a = artRef(ref);
  const img = a.kind === 'img' ? scene.add.image(x, y, a.key) : scene.add.image(x, y, a.key, a.frame);
  return img.setScale(scale);
}

/** An animated creature / boss sprite. ref 'necro:96' or 'boss2:24'. */
export function unit(scene, x, y, ref, scale = 4, flip = false) {
  const a = artRef(ref);
  const s = scene.add.sprite(x, y, a.key, a.frame).setScale(scale).setOrigin(0.5, 1).setFlipX(flip);
  const anim = `${a.key}:${a.row}:idle`;
  if (scene.anims.exists(anim)) s.play({ key: anim, startFrame: Math.floor(Math.random() * 4) });
  s.animBase = `${a.key}:${a.row}`;
  return s;
}

/** Play a one-shot animation (attack / hit / death) then go back to idle (unless death). */
export function playOnce(sprite, name) {
  const key = `${sprite.animBase}:${name}`;
  if (!sprite.scene || !sprite.anims.animationManager.exists(key)) return;
  sprite.play(key);
  if (name !== 'death') sprite.once('animationcomplete', () => { if (sprite.active) sprite.play(`${sprite.animBase}:idle`); });
}

/** Text with a dark outline, for numbers over the battlefield. */
export function outlined(scene, x, y, str, { size = 16, color = PALETTE.cream, origin = 0.5, wrap } = {}) {
  return text(scene, x, y, str, { size, color, origin, wrap }).setStroke(PALETTE.ink, size >= 32 ? 6 : 4);
}

/** Number that floats up and fades. */
export function floatText(scene, x, y, str, color = PALETTE.cream, size = 32) {
  const t = outlined(scene, x, y, str, { size, color }).setDepth(45);
  scene.tweens.add({ targets: t, y: y - 36, alpha: 0, delay: 350, duration: 500, onComplete: () => t.destroy() });
  return t;
}

/** Short message that pops up and fades away. */
export function toast(scene, msg, y = HEIGHT / 2, color = PALETTE.gold) {
  const t = outlined(scene, WIDTH / 2, y, msg, { color, wrap: WIDTH - 24 }).setDepth(80).setScrollFactor(0);
  scene.tweens.add({ targets: t, alpha: 0, delay: 1200, duration: 300, onComplete: () => t.destroy() });
  return t;
}

/** Framed box. Returns the graphics. */
export function box(scene, x, y, w, h, { fill = PALETTE.indigo, border = PALETTE.ink, inner = PALETTE.lavender } = {}) {
  return panel(scene, x, y, w, h, { fill, border, inner });
}

/**
 * Modal over everything: title, wrapped body text, buttons [[label, fn, fill, color], ...].
 * Returns the container (destroy it to close).
 */
/** Track open overlays so drag-scrolling underneath them stays off. */
export function overlayOpened(scene, c) {
  scene._overlays = (scene._overlays || 0) + 1;
  c.once('destroy', () => { scene._overlays = Math.max(0, (scene._overlays || 1) - 1); });
}

export function modal(scene, title, body, buttons, { width = 316, art, content, disabled = [] } = {}) {
  const c = scene.add.container(0, 0).setDepth(100).setScrollFactor(0);
  overlayOpened(scene, c);
  const dim = scene.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.65).setOrigin(0).setInteractive();
  const bodyText = body ? text(scene, WIDTH / 2, 0, body, { wrap: width - 36, color: PALETTE.cream }) : null;
  const artH = art ? 72 : 0;
  const bodyH = bodyText ? bodyText.height + 16 : 0;
  const contentH = content ? content.h + 12 : 0;
  const h = 64 + artH + bodyH + contentH + buttons.length * 52 + 8;
  const top = Math.round((HEIGHT - h) / 2);
  const left = Math.round((WIDTH - width) / 2);
  c.add([dim, box(scene, left, top, width, h)]);
  c.add(text(scene, WIDTH / 2, top + 30, title, { size: 16, color: PALETTE.gold, wrap: width - 30 }));
  let y = top + 54;
  if (art) { const a = icon(scene, WIDTH / 2, y + 32, art.ref, art.scale || 4); if (art.tint) a.setTint(art.tint); c.add(a); y += artH; }
  if (bodyText) { bodyText.setOrigin(0.5, 0).setPosition(WIDTH / 2, y); c.add(bodyText); y += bodyH; }
  if (content) { content.setPosition(Math.round((WIDTH - content.w) / 2), y); c.add(content); y += contentH; }
  buttons.forEach(([label, fn, fill, color], i) => {
    const b = button(scene, WIDTH / 2, y + 22 + i * 52, Math.min(240, width - 40), 42, label, () => fn?.(c), {
      fill: fill ?? (i === 0 ? PALETTE.gold : PALETTE.lavender), color: color ?? PALETTE.night,
    });
    if (disabled.includes(i)) b.setEnabled(false);
    c.add(b);
  });
  c.setAlpha(0);
  scene.tweens.add({ targets: c, alpha: 1, duration: 120 });
  return c;
}

/** Info popup with a single Close button. */
export function info(scene, title, body, opts = {}) {
  const m = modal(scene, title, body, [['Close', () => m.destroy(), PALETTE.lavender]], opts);
  return m;
}

export function relicInfo(scene, id) {
  const r = RELICS[id];
  if (!r) return null;
  const rarity = { starter: 'Starting relic', common: 'Common relic', uncommon: 'Uncommon relic', rare: 'Rare relic', boss: 'Boss relic' }[r.rarity];
  return info(scene, r.name, `${r.text}\n\n${rarity}`, { art: { ref: r.art, scale: 3 } });
}

export function potionIcon(scene, x, y, id, scale = 2) {
  const img = icon(scene, x, y, 'ar:6,8', scale);
  if (id && POTIONS[id]) img.setTint(POTIONS[id].tint);
  return img;
}

/**
 * Top bar used on every run screen: HP, gold, potions, deck, help.
 * opts: { onDeck, onMenu, onPotion(slot) } - onPotion defaults to a map-style popup.
 * Returns { refresh(), container }.
 */
export function topBar(scene, run, opts = {}) {
  const c = scene.add.container(0, 0).setDepth(40).setScrollFactor(0);
  const bg = scene.add.rectangle(0, 0, WIDTH, 44, hex(PALETTE.ink)).setOrigin(0);
  c.add(bg);
  const menu = button(scene, 22, 22, 36, 32, '', () => opts.onMenu?.(), { fill: PALETTE.lavender });
  const g = scene.add.graphics();
  g.fillStyle(hex(PALETTE.night));
  for (let i = 0; i < 3; i++) g.fillRect(-8, -7 + i * 6, 16, 3);
  menu.face.add(g);
  c.add(menu);
  c.add(icon(scene, 52, 22, 'sk:4,5', 1));
  const hp = text(scene, 62, 22, '', { origin: [0, 0.5], color: PALETTE.cream });
  c.add(hp);
  c.add(icon(scene, 136, 22, 'sk:13,1', 1));
  const gold = text(scene, 146, 22, '', { origin: [0, 0.5], color: PALETTE.gold });
  c.add(gold);
  const slots = [];
  for (let i = 0; i < 3; i++) {
    const x = 200 + i * 30;
    const frame = scene.add.rectangle(x, 22, 26, 30, hex(PALETTE.night)).setStrokeStyle(2, hex(PALETTE.indigo)).setInteractive({ useHandCursor: true });
    frame.on('pointerup', () => {
      if (!run.potions[i]) return;
      sfx('select');
      if (opts.onPotion) opts.onPotion(i); else mapPotionMenu(scene, run, i, () => refresh());
    });
    const img = potionIcon(scene, x, 22, null, 1);
    c.add([frame, img]);
    slots.push(img);
  }
  const deck = button(scene, 300, 22, 48, 32, '', () => opts.onDeck?.(), { fill: PALETTE.sand });
  const deckIcon = icon(scene, -13, 0, 'sk:19,1', 1);
  const deckN = text(scene, 9, 0, '', { color: PALETTE.night });
  deck.face.add([deckIcon, deckN]);
  c.add(deck);
  c.add(button(scene, WIDTH - 18, 22, 28, 32, '?', () => openHowTo(scene), { fill: PALETTE.gold }));

  function refresh() {
    hp.setText(`${run.hp}/${run.maxHp}`).setColor(run.hp <= run.maxHp * 0.3 ? PALETTE.orange : PALETTE.cream);
    gold.setText(String(run.gold));
    slots.forEach((img, i) => {
      const id = run.potions[i];
      img.setVisible(!!id);
      if (id) img.setTint(POTIONS[id].tint);
    });
    deckN.setText(String(run.deck.length));
  }
  refresh();
  return { refresh, container: c };
}

function mapPotionMenu(scene, run, slot, done) {
  const id = run.potions[slot];
  const p = POTIONS[id];
  const buttons = [];
  if (p.anytime) buttons.push(['Drink', (m) => { drinkOnMap(run, slot); sfx('power'); saveRun(run); m.destroy(); done(); }]);
  buttons.push(['Throw away', (m) => { discardPotion(run, slot); saveRun(run); m.destroy(); done(); }, PALETTE.red, PALETTE.cream]);
  buttons.push(['Close', (m) => m.destroy(), PALETTE.lavender]);
  modal(scene, p.name, `${p.text}${p.anytime ? '' : '\nOnly usable in a fight.'}`, buttons, { art: { ref: 'ar:6,8', scale: 3, tint: p.tint } });
}

/**
 * A row of relic icons (tap one for details). When there are too many to fit, the last slot
 * becomes a "+N" button that lists them all.
 */
export function relicRow(scene, run, x, y, { scale = 2, gap = 34, maxW = WIDTH - 16, depth = 40 } = {}) {
  const c = scene.add.container(0, 0).setDepth(depth).setScrollFactor(0);
  const fit = Math.max(1, Math.floor(maxW / gap));
  const many = run.relics.length > fit;
  const shown = many ? run.relics.slice(0, fit - 1) : run.relics;
  shown.forEach((id, i) => {
    const r = RELICS[id];
    if (!r) return;
    const img = icon(scene, x + i * gap, y, r.art, scale).setInteractive({ useHandCursor: true });
    img.on('pointerup', () => { sfx('select'); relicInfo(scene, id); });
    c.add(img);
  });
  if (many) {
    const more = outlined(scene, x + (fit - 1) * gap, y, `+${run.relics.length - shown.length}`, { color: PALETTE.gold })
      .setInteractive({ useHandCursor: true });
    more.on('pointerup', () => { sfx('select'); relicList(scene, run); });
    c.add(more);
  }
  return c;
}

/** Scrollable list of every relic the hero carries. */
export function relicList(scene, run) {
  const c = scene.add.container(0, 0).setDepth(110).setScrollFactor(0);
  overlayOpened(scene, c);
  c.add(scene.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.night)).setOrigin(0).setInteractive());
  c.add(text(scene, WIDTH / 2, 24, `Relics (${run.relics.length})`, { color: PALETTE.gold }));
  const list = scene.add.container(0, 0);
  let y = 50;
  for (const id of run.relics) {
    const r = RELICS[id];
    const body = text(scene, 52, y + 22, r.text, { origin: [0, 0], wrap: WIDTH - 64, align: 'left' });
    list.add([icon(scene, 26, y + 18, r.art, 2), text(scene, 52, y + 2, r.name, { origin: [0, 0], color: PALETTE.sand }), body]);
    y += Math.max(44, body.height + 30);
  }
  const top = 44;
  const bottom = HEIGHT - 60;
  list.setMask(scene.make.graphics().fillRect(0, top, WIDTH, bottom - top).createGeometryMask());
  c.add(list);
  // Simple drag to scroll, scoped to this overlay.
  const minY = Math.min(0, bottom - y - 8);
  let start = null;
  const hit = scene.add.zone(0, top, WIDTH, bottom - top).setOrigin(0).setInteractive();
  hit.on('pointerdown', (p) => { start = { y: p.y, c: list.y }; });
  hit.on('pointermove', (p) => { if (start && p.isDown) list.y = Math.max(minY, Math.min(0, start.c + p.y - start.y)); });
  hit.on('pointerup', () => { start = null; });
  c.add(hit);
  c.add(button(scene, WIDTH / 2, HEIGHT - 30, 200, 40, 'Close', () => c.destroy(), { fill: PALETTE.lavender }));
  return c;
}

/** Pause menu shared by run screens. */
export function runMenu(scene, run, { onAbandon } = {}) {
  const m = modal(scene, 'Paused', `${HEROES[run.hero].name} - ${run.mode === 'endless' ? 'Endless' : 'Normal'} - Floor ${run.floor}\nYour run is saved automatically.`, [
    ['Resume', () => m.destroy()],
    ['Save & quit', () => { saveRun(run); m.destroy(); go(scene, 'Menu'); }, PALETTE.lavender],
    ['Abandon run', () => {
      m.destroy();
      const sure = modal(scene, 'Abandon run?', 'This run will end and count as a loss.', [
        ['Abandon', () => { sure.destroy(); onAbandon?.(); }, PALETTE.red, PALETTE.cream],
        ['Keep playing', () => sure.destroy()],
      ]);
    }, PALETTE.red, PALETTE.cream],
  ]);
  return m;
}

/** Make a container scroll vertically by dragging inside [top, bottom]. Returns { scrollTo(y), get y() }. */
export function dragScroll(scene, container, top, bottom, contentH) {
  let startY = null;
  let startC = 0;
  let moved = false;
  const minY = Math.min(0, bottom - top - contentH);
  const clamp = (v) => Math.max(minY, Math.min(0, v));
  container.y = 0;
  scene._overlays = 0;
  scene.input.on('pointerdown', (p) => {
    if (scene._overlays > 0) { startY = null; return; }
    if (p.y >= top && p.y <= bottom) { startY = p.y; startC = container.y; moved = false; }
  });
  scene.input.on('pointermove', (p) => {
    if (startY === null || !p.isDown) return;
    if (Math.abs(p.y - startY) > 8) moved = true;
    if (moved) container.y = clamp(startC + p.y - startY);
  });
  scene.input.on('pointerup', () => { startY = null; });
  return {
    scrollTo: (y) => { container.y = clamp(-y); },
    get moved() { return moved; },
    minY,
  };
}

/** Show a list of cards in the Deck overlay (pauses this scene until closed). */
export function showCards(scene, cards, title, extra = {}) {
  scene.scene.launch('Deck', { cards, title, from: scene.scene.key, ...extra });
  scene.scene.pause();
}

/**
 * Let the player choose a card: { cards, title, subtitle, verb, preview, onPick, onCancel, cancelLabel }.
 */
export function pickCard(scene, opts) {
  const { cards, title, subtitle, verb, preview, onPick, onCancel, cancelLabel } = opts;
  showCards(scene, cards, title, { subtitle, cancelLabel, onCancel, pick: { verb, preview, onPick } });
}

export { Phaser };

// Drawing cards: the small hand card and the wide, readable card used in lists.
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text } from '../../../shared/core/ui.js';
import { CARDS, values, costOf, describe, cardName, flagsOf } from '../logic/cards.js';
import { icon } from './common.js';

export const TYPE_STYLE = {
  attack: { fill: '#6b2a2c', edge: PALETTE.red, label: 'Attack' },
  skill: { fill: '#2e3a5c', edge: '#5b6fb0', label: 'Skill' },
  power: { fill: '#4a2850', edge: PALETTE.plum, label: 'Power' },
  status: { fill: '#3a3a3a', edge: '#777777', label: 'Status' },
  curse: { fill: '#241a1c', edge: PALETTE.wine, label: 'Curse' },
};
export const RARITY_EDGE = { starter: '#c9c2b8', common: '#c9c2b8', uncommon: '#6fa8dc', rare: PALETTE.gold, special: '#777777' };
const RARITY_NAME = { starter: 'Starter', common: 'Common', uncommon: 'Uncommon', rare: 'Rare', special: '' };

/**
 * Numbers for a card's text. In a fight, pass the Combat so {dmg}/{block} include Strength,
 * Weak, Dexterity, etc. (and the target's Vulnerable if a target is given).
 */
export function cardFormatter(combat, target) {
  if (!combat) return undefined;
  return (k, base, v) => {
    if (k === 'dmg') return combat.attackDamage(base, target, v.strMult || 1);
    if (k === 'block') return combat.blockAmount(base);
    return undefined;
  };
}

export function cardText(card, combat, target) {
  return describe(card, cardFormatter(combat, target));
}

/** Short bottom line for a hand card: { parts: [[iconRef, '12', color]], label } */
function summary(card, combat) {
  const d = CARDS[card.id];
  const v = values(card);
  const parts = [];
  if (v.dmg !== undefined) {
    const real = combat ? combat.attackDamage(v.dmg, null, v.strMult || 1) : v.dmg;
    const times = d.hits === 'm' ? `x${v.m}` : d.hits ? `x${d.hits}` : '';
    parts.push(['ui:3,2', `${real}${times}`, real > v.dmg ? '#9be36b' : real < v.dmg ? '#ff8f6b' : PALETTE.cream]);
  }
  if (v.block !== undefined) {
    const real = combat ? combat.blockAmount(v.block) : v.block;
    parts.push(['ui:2,1', `${real}`, real > v.block ? '#9be36b' : real < v.block ? '#ff8f6b' : PALETTE.cream]);
  }
  return parts;
}

/**
 * Small card for the hand (76 x 104), drawn around (0,0). Returns a container with .card.
 * opts: { combat, playable }
 */
export function handCard(scene, card, { combat, playable = true, w = 76, h = 108 } = {}) {
  const d = CARDS[card.id];
  const st = TYPE_STYLE[d.type];
  const c = scene.add.container(0, 0);
  const g = scene.add.graphics();
  g.fillStyle(hex(PALETTE.ink)).fillRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 2);
  g.fillStyle(hex(RARITY_EDGE[d.rarity] || '#c9c2b8')).fillRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2);
  g.fillStyle(hex(st.edge)).fillRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6);
  g.fillStyle(hex(st.fill)).fillRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10);
  // art window
  g.fillStyle(hex(PALETTE.ink)).fillRect(-18, -2, 36, 34);
  c.add(g);
  c.add(icon(scene, 0, 15, d.art, 2));
  // Name below the cost orb, using the full card width (up to two lines).
  const name = text(scene, 0, 0, d.name, { size: 16, color: card.up ? '#9be36b' : PALETTE.cream, wrap: w - 6, origin: [0.5, 0] });
  name.setLineSpacing(-2);
  name.setY(name.height > 24 ? -h / 2 + 15 : -h / 2 + 22);
  c.add(name);
  // cost orb
  const cost = costOf(card);
  if (!flagsOf(card).unplayable) {
    const orb = scene.add.circle(-w / 2 + 4, -h / 2 + 4, 11, hex(PALETTE.gold)).setStrokeStyle(2, hex(PALETTE.ink));
    const ct = text(scene, -w / 2 + 4, -h / 2 + 4, String(cost), { color: playable ? PALETTE.night : PALETTE.red });
    c.add([orb, ct]);
    c.costText = ct;
  }
  if (card.up && ['attack', 'skill', 'power'].includes(d.type)) c.add(text(scene, w / 2 - 9, -h / 2 + 9, '+', { color: '#9be36b' }));
  // summary line
  const parts = summary(card, combat);
  const sy = h / 2 - 12;
  if (parts.length) {
    parts.forEach(([ref, str, color], i) => {
      const x = (i - (parts.length - 1) / 2) * 36;
      const t = text(scene, 0, sy, str, { color, origin: [0, 0.5] });
      const start = x - (18 + t.width) / 2;
      t.setX(start + 18);
      c.add([icon(scene, start + 8, sy, ref, 1), t]);
    });
  } else {
    c.add(text(scene, 0, sy, st.label, { color: PALETTE.lavender }));
  }
  c.setSize(w, h);
  c.card = card;
  if (!playable) c.setAlpha(0.6);
  return c;
}

/**
 * Wide readable card (w x auto height) with full text, drawn from its top-left at (0,0).
 * Returns a container with .h (height).
 */
export function wideCard(scene, card, w = 336, { combat, target, note, noteColor } = {}) {
  const d = CARDS[card.id];
  const st = TYPE_STYLE[d.type];
  const c = scene.add.container(0, 0);
  const body = text(scene, 64, 32, cardText(card, combat, target), { wrap: w - 74, origin: [0, 0], color: PALETTE.cream, align: 'left' });
  body.setLineSpacing(2);
  const h = Math.max(74, 40 + body.height + 8 + (note ? 20 : 0));
  const g = scene.add.graphics();
  g.fillStyle(hex(PALETTE.ink)).fillRect(0, 0, w, h);
  g.fillStyle(hex(RARITY_EDGE[d.rarity] || '#c9c2b8')).fillRect(2, 2, w - 4, h - 4);
  g.fillStyle(hex(st.edge)).fillRect(4, 4, w - 8, h - 8);
  g.fillStyle(hex(st.fill)).fillRect(6, 6, w - 12, h - 12);
  g.fillStyle(hex(PALETTE.ink)).fillRect(12, 20, 40, 40);
  c.add(g);
  c.add(icon(scene, 32, 40, d.art, 2));
  const cost = costOf(card);
  if (!flagsOf(card).unplayable) {
    c.add(scene.add.circle(14, 14, 11, hex(PALETTE.gold)).setStrokeStyle(2, hex(PALETTE.ink)));
    c.add(text(scene, 14, 14, String(cost), { color: PALETTE.night }));
  }
  c.add(text(scene, 64, 8, cardName(card), { origin: [0, 0], color: card.up ? '#9be36b' : PALETTE.gold }));
  c.add(text(scene, w - 10, 8, `${st.label}${RARITY_NAME[d.rarity] ? ` - ${RARITY_NAME[d.rarity]}` : ''}`, { origin: [1, 0], color: PALETTE.lavender }));
  c.add(body);
  if (note) c.add(text(scene, 64, h - 24, note, { origin: [0, 0], color: noteColor || PALETTE.sand }));
  c.h = h;
  c.w = w;
  c.setSize(w, h);
  return c;
}

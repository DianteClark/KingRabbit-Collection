// Hero sheet (stats, skills, army, artifacts, spells) and the level-up choice, as overlays.
import { PALETTE, hex } from '../../../shared/core/palette.js';
import { text, button, panel } from '../../../shared/core/ui.js';
import { sfx } from '../../../shared/core/sfx.js';
import { WIDTH, HEIGHT, modal, creatureSlot, bar, toast } from './common.js';
import { sprite, artifactFrame, spellFrame, unitFrame } from '../frames.js';
import * as G from '../logic/game.js';
import { exchange } from '../logic/game.js';
import { CREATURES, ARTIFACTS, SPELLS, SKILLS, LEVEL_WORD, FACTIONS, expForLevel } from '../logic/data.js';

const STAT_NAME = { atk: 'Attack', def: 'Defense', pow: 'Power', know: 'Knowledge' };

export function className(h) {
  return FACTIONS[h.faction].classes.find((c) => c.id === h.cls)?.name || '';
}

export function creatureInfo(scene, type, count) {
  const c = CREATURES[type];
  const abil = [];
  if (c.shots) abil.push(`Shoots (${c.shots} shots)`);
  if (c.fly) abil.push('Flies');
  if (c.noRetal) abil.push('No retaliation');
  if (c.drain) abil.push('Drains life');
  if (c.regen) abil.push('Regenerates');
  if (c.twoRetal) abil.push('Strikes back twice');
  if (c.joust) abil.push('Charge bonus');
  if (c.deathBlow) abil.push('Death blow');
  if (c.splash) abil.push('Death cloud');
  if (c.resist) abil.push('Resists magic');
  if (c.undead) abil.push('Undead');
  modal(scene, count ? `${count} ${c.name}` : c.name, [
    `Attack ${c.atk}   Defense ${c.def}`,
    `Damage ${c.min}-${c.max}   Health ${c.hp}`,
    `Speed ${c.speed}   Growth ${c.growth}/week`,
    { text: abil.join(', ') || 'No special abilities', color: PALETTE.sand },
  ], [['OK', null]], {
    extra: 56, content: (cc, y) => cc.add(sprite(scene, WIDTH / 2, y + 24, unitFrame(c.sprite), 3)),
  });
}

export function openHeroPanel(scene, h, onClose) {
  const c = scene.add.container(0, 0).setDepth(100);
  c.add(scene.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.7).setOrigin(0).setInteractive());
  c.add(panel(scene, 6, 20, WIDTH - 12, HEIGHT - 40));
  const close = () => { c.destroy(); onClose?.(); };
  // Portrait, name, class.
  const pf = scene.add.graphics();
  pf.fillStyle(hex(PALETTE.gold)).fillRect(18, 34, 60, 60);
  pf.fillStyle(hex(PALETTE.night)).fillRect(21, 37, 54, 54);
  c.add(pf);
  c.add(sprite(scene, 48, 64, ['heroIcons', h.portrait[0], h.portrait[1], 16, 16], 3));
  c.add(text(scene, 90, 46, h.name, { size: 32, origin: [0, 0.5], color: PALETTE.gold }));
  c.add(text(scene, 90, 76, `Level ${h.level} ${className(h)}`, { origin: [0, 0.5], color: PALETTE.cream }));
  const lo = expForLevel(h.level); const hi = expForLevel(h.level + 1);
  c.add(bar(scene, 90, 88, 246, 8, (h.exp - lo) / Math.max(1, hi - lo), PALETTE.lavender));
  c.add(text(scene, 336, 106, `${h.exp} / ${hi} exp`, { origin: [1, 0.5], color: PALETTE.lavender }));
  // Primary stats.
  ['atk', 'def', 'pow', 'know'].forEach((k, i) => {
    const x = 18 + i * 82;
    const g = scene.add.graphics();
    g.fillStyle(hex(PALETTE.night)).fillRect(x, 120, 76, 48);
    c.add(g);
    c.add(text(scene, x + 38, 134, STAT_NAME[k], { color: PALETTE.lavender }));
    const base = h[k]; const tot = G.heroStat(h, k);
    c.add(text(scene, x + 38, 156, tot > base ? `${tot} (+${tot - base})` : `${tot}`, { color: PALETTE.cream }));
  });
  c.add(text(scene, 18, 188, `Mana ${h.mana}/${G.heroMaxMana(h)}`, { origin: [0, 0.5], color: PALETTE.lavender }));
  c.add(text(scene, 336, 188, `Move ${h.mp}/${G.heroMaxMp(h)}`, { origin: [1, 0.5], color: PALETTE.leaf }));
  // Skills.
  c.add(text(scene, 18, 214, 'Skills', { origin: [0, 0.5], color: PALETTE.sand }));
  const sk = Object.entries(h.skills);
  sk.forEach(([id, lv], i) => {
    const x = 18 + (i % 2) * 164; const y = 236 + Math.floor(i / 2) * 22;
    const t = text(scene, x, y, `${LEVEL_WORD[lv]} ${SKILLS[id].name}`, { origin: [0, 0.5], color: PALETTE.cream });
    t.setInteractive({ useHandCursor: true }).on('pointerup', () => toast(scene, `${SKILLS[id].name}: ${SKILLS[id].desc[lv - 1]}`, 556));
    c.add(t);
  });
  // Army.
  let y = 236 + Math.ceil(Math.max(1, sk.length) / 2) * 22 + 8;
  c.add(text(scene, 18, y, 'Army', { origin: [0, 0.5], color: PALETTE.sand }));
  y += 40;
  h.army.forEach((st, i) => c.add(creatureSlot(scene, 44 + i * 68, y, st, { size: 60, onTap: st ? () => creatureInfo(scene, st.type, st.count) : null })));
  y += 46;
  // Artifacts.
  c.add(text(scene, 18, y, h.artifacts.length ? 'Artifacts (tap for details)' : 'Artifacts: none yet', { origin: [0, 0.5], color: PALETTE.sand }));
  y += 28;
  h.artifacts.slice(0, 9).forEach((a, i) => {
    const img = sprite(scene, 34 + i * 36, y, artifactFrame(ARTIFACTS[a].icon), 2);
    img.setInteractive({ useHandCursor: true }).on('pointerup', () => toast(scene, `${ARTIFACTS[a].name}: ${ARTIFACTS[a].desc}`, 556));
    c.add(img);
  });
  if (h.artifacts.length) y += 30;
  // Spells.
  c.add(text(scene, 18, y, h.spells.length ? 'Spells (tap for details)' : 'Spells: none (visit a Mage Guild)', { origin: [0, 0.5], color: PALETTE.sand }));
  y += 28;
  h.spells.forEach((sp, i) => {
    const img = sprite(scene, 34 + i * 36, y, spellFrame(SPELLS[sp].icon), 2);
    img.setInteractive({ useHandCursor: true }).on('pointerup', () => toast(scene, `${SPELLS[sp].name} (${SPELLS[sp].cost} mana): ${SPELLS[sp].desc}`, 556));
    c.add(img);
  });
  c.add(button(scene, WIDTH / 2, HEIGHT - 52, 200, 40, 'Close', close, { fill: PALETTE.gold }));
  sfx('select');
  return c;
}

/** Walk the player through all pending level-ups of a hero. */
export async function levelUpFlow(scene, h) {
  while (h.pendingLevels > 0) {
    const lu = G.prepareLevelUp(scene.s, h);
    if (!lu) break;
    sfx('power');
    const lines = [`${h.name} is now level ${h.level - h.pendingLevels + 1}!`, { text: `+1 ${STAT_NAME[lu.stat]}`, color: PALETTE.leaf }];
    const btns = lu.skills.map((s, i) => {
      const lv = (h.skills[s] || 0) + 1;
      lines.push({ text: `${LEVEL_WORD[lv]} ${SKILLS[s].name}: ${SKILLS[s].desc[lv - 1]}`, color: PALETTE.sand });
      return [`${LEVEL_WORD[lv]} ${SKILLS[s].name}`, i];
    });
    if (!btns.length) btns.push(['OK', 0]);
    const pick = await new Promise((res) => modal(scene, 'Level up!', lines, btns.map(([l, i]) => [l, () => res(i)])));
    G.applyLevelUp(scene.s, h, pick);
  }
}

/** Swap stacks between two neighbouring heroes. */
export function openExchange(scene, a, b, onClose) {
  const c = scene.add.container(0, 0).setDepth(100);
  const draw = () => {
    c.removeAll(true);
    c.add(scene.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.7).setOrigin(0).setInteractive());
    c.add(panel(scene, 6, 130, WIDTH - 12, 360));
    c.add(text(scene, WIDTH / 2, 160, 'Meeting', { size: 32, color: PALETTE.gold }));
    [a, b].forEach((h, k) => {
      const y = 200 + k * 120;
      c.add(sprite(scene, 30, y + 2, ['heroIcons', h.portrait[0], h.portrait[1], 16, 16], 2));
      c.add(text(scene, 52, y, `${h.name}, level ${h.level}`, { origin: [0, 0.5], color: PALETTE.sand }));
      h.army.forEach((st, i) => c.add(creatureSlot(scene, 44 + i * 68, y + 52, st, { size: 60, onTap: st ? () => {
        if (exchange(scene.s, h, k ? a : b, i)) sfx('place'); else { sfx('error'); toast(scene, 'Each hero keeps one stack', 470); }
        draw();
      } : null })));
    });
    c.add(text(scene, WIDTH / 2, 434, 'Tap a stack to send it across', { color: PALETTE.lavender }));
    c.add(button(scene, WIDTH / 2, 466, 200, 36, 'Done', () => { c.destroy(); onClose?.(); }, { fill: PALETTE.gold }));
  };
  draw();
  return c;
}

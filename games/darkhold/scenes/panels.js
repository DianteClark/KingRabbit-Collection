// Full-screen panels over the dungeon: bag, shop, hero sheet, map, level-up perks, message log.
// Each one swallows taps with a full-screen backdrop and counts as an open overlay, so the map
// and the pad ignore input while it is up.
import {
  PALETTE, hex, text, button, panel, WIDTH, HEIGHT, DARK, modal, itemImage, overlayOpened, outlined, creature,
} from './common.js';
import * as G from '../logic/game.js';
import { BAG_SIZE, PERKS, POTIONS, SCROLLS, MAX_FOOD, CLASSES, MELEE, RANGED, ARMORS, POTION_LOOKS } from '../logic/data.js';

function sheet(scene, title, { depth = 250 } = {}) {
  const c = scene.add.container(0, 0).setDepth(depth).setScrollFactor(0);
  overlayOpened(scene, c);
  c.add(scene.add.rectangle(0, 0, WIDTH, HEIGHT, hex(PALETTE.ink), 0.8).setOrigin(0).setInteractive());
  c.add(panel(scene, 6, 6, WIDTH - 12, HEIGHT - 12, { fill: DARK.navy, inner: DARK.blue, border: PALETTE.ink }));
  c.title = text(scene, WIDTH / 2, 30, title, { color: PALETTE.gold });
  c.add(c.title);
  return c;
}

/** Fit a single line of text into maxW by trimming it. */
function fitLine(t, maxW) {
  const full = t.text;
  let n = full.length;
  while (t.width > maxW && n > 3) { n--; t.setText(`${full.slice(0, n).trimEnd()}...`); }
  return t;
}

function row(scene, c, y, icon, label, { right, rightColor = PALETTE.gold, dim = false, onTap } = {}) {
  const bg = scene.add.rectangle(WIDTH / 2, y, WIDTH - 36, 34, hex(DARK.navy)).setStrokeStyle(2, hex(DARK.blue));
  c.add(bg);
  if (icon) c.add(itemImage(scene, 36, y, icon, 2).setAlpha(dim ? 0.4 : 1));
  const rt = right ? text(scene, WIDTH - 28, y, right, { origin: [1, 0.5], color: rightColor }) : null;
  const name = text(scene, 58, y, label, { origin: [0, 0.5], color: dim ? DARK.purple : PALETTE.cream, align: 'left' });
  fitLine(name, WIDTH - 58 - 32 - (rt ? rt.width + 10 : 0));
  c.add(name);
  if (rt) c.add(rt);
  if (onTap) {
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => bg.setFillStyle(hex(DARK.blue)));
    bg.on('pointerout', () => bg.setFillStyle(hex(DARK.navy)));
    bg.on('pointerup', () => { bg.setFillStyle(hex(DARK.navy)); if (!c.locked) onTap(); });
  }
  return bg;
}

const VERB = { potion: 'Drink', scroll: 'Read', food: 'Eat', oil: 'Use', torch: 'Light it', melee: 'Wield', ranged: 'Equip', armor: 'Wear', ring: 'Put on' };
const SLOTS = [['melee', 'Weapon'], ['ranged', 'Bow'], ['armor', 'Armour'], ['ring', 'Ring']];

function compareText(st, it) {
  const cur = st.p.eq[it.k];
  if (!cur) return '\nYou have nothing in this slot.';
  return `\nNow: ${G.itemName(st, cur)}.`;
}

/** The bag. opts.onAction(action) runs a game action after the panel closes. opts.sell: sell mode. */
export function bagPanel(scene, st, opts = {}) {
  const p = st.p;
  const c = sheet(scene, opts.sell ? 'Sell to the merchant' : `Bag ${p.inv.length}/${BAG_SIZE}`);
  const close = () => { c.locked = true; c.destroy(); };
  const runAfterClose = (a) => { close(); opts.onAction?.(a); };
  c.add(scene.add.image(28, 30, 'items', 'i:5,2'));
  c.add(text(scene, 40, 30, String(p.gold), { origin: [0, 0.5], color: PALETTE.gold }));

  if (!opts.sell) {
    SLOTS.forEach(([slot, label], i) => {
      const x = 56 + i * 82; const y = 82;
      const it = p.eq[slot];
      const box = scene.add.rectangle(x, y, 70, 52, hex(DARK.void)).setStrokeStyle(2, hex(it ? PALETTE.gold : DARK.purple));
      c.add(box);
      if (it) c.add(itemImage(scene, x, y, G.itemIcon(st, it), 2));
      c.add(text(scene, x, y + 40, label, { color: DARK.rose }));
      box.setInteractive({ useHandCursor: true });
      box.on('pointerup', () => {
        if (c.locked) return;
        if (!it) { if (slot === 'ranged' && st.cls === 'mage') { modal(scene, 'Firebolt', 'Without a bow, the Cast button throws a Firebolt using 2 mana. Mana refills as you walk.', [['Close', (m) => m.destroy(), PALETTE.lavender]], { depth: 300 }); } return; }
        const extra = slot === 'ranged' ? `\nArrows: ${p.arrows}.` : '';
        modal(scene, G.itemName(st, it), `${G.itemText(st, it)}${extra}`, [
          ['Take off', (m) => { m.destroy(); runAfterClose({ type: 'unequip', slot }); }, PALETTE.lavender],
          ['Close', (m) => m.destroy(), PALETTE.lavender],
        ], { art: { icon: G.itemIcon(st, it) }, depth: 300, disabled: p.inv.length >= BAG_SIZE ? [0] : [] });
      });
    });
  }

  const top = opts.sell ? 70 : 150;
  if (!p.inv.length) c.add(text(scene, WIDTH / 2, top + 40, 'Your bag is empty.', { color: DARK.rose }));
  p.inv.forEach((it, i) => {
    const y = top + i * 37;
    const price = opts.sell ? G.sellPrice(st, { ...it, n: 1 }) : null;
    row(scene, c, y, G.itemIcon(st, it), G.itemName(st, it), {
      right: price != null ? `${price}g` : undefined,
      onTap: () => {
        if (opts.sell) {
          modal(scene, `Sell ${G.itemName(st, { ...it, n: 1 })}?`, `The merchant offers ${price} gold.`, [
            [`Sell for ${price}`, (m) => { m.destroy(); close(); opts.onAction?.({ type: 'sell', i }); bagPanel(scene, st, opts); }],
            ['Keep it', (m) => m.destroy(), PALETTE.lavender],
          ], { art: { icon: G.itemIcon(st, it) }, depth: 300 });
          return;
        }
        const body = `${G.itemText(st, it)}${G.isEquip(it) ? compareText(st, it) : ''}`;
        modal(scene, G.itemName(st, it), body, [
          [VERB[it.k] || 'Use', (m) => { m.destroy(); runAfterClose({ type: 'use', i }); }],
          ['Drop', (m) => { m.destroy(); runAfterClose({ type: 'drop', i }); }, PALETTE.red, PALETTE.cream],
          ['Close', (m) => m.destroy(), PALETTE.lavender],
        ], { art: { icon: G.itemIcon(st, it) }, depth: 300 });
      },
    });
  });
  c.add(button(scene, WIDTH / 2, HEIGHT - 34, 220, 44, opts.sell ? 'Done' : 'Close', () => { close(); if (opts.sell) opts.onDone?.(); }, { fill: PALETTE.lavender }));
  return c;
}

const shopName = (st, it) => (it.k === 'potion' ? POTIONS[it.id].name : it.k === 'scroll' ? SCROLLS[it.id].name : G.itemName(st, it));
const shopText = (st, it) => (it.k === 'potion' ? POTIONS[it.id].text : it.k === 'scroll' ? SCROLLS[it.id].text : G.itemText(st, it));

export function shopPanel(scene, st, opts = {}) {
  const s = st.f.shop;
  const c = sheet(scene, 'The Pale Merchant');
  const close = () => { c.locked = true; c.destroy(); };
  c.add(scene.add.image(28, 30, 'items', 'i:5,2'));
  c.add(text(scene, 40, 30, String(st.p.gold), { origin: [0, 0.5], color: PALETTE.gold }));
  c.add(text(scene, WIDTH / 2, 58, '"Light and steel, for a price."', { color: DARK.rose }));
  s.stock.forEach((r, i) => {
    const y = 92 + i * 37;
    const price = G.shopPrice(st, r.item);
    row(scene, c, y, G.itemIcon(st, r.item), shopName(st, r.item), {
      right: r.sold ? 'Sold' : `${price}g`, rightColor: r.sold ? DARK.purple : st.p.gold >= price ? PALETTE.gold : PALETTE.red, dim: r.sold,
      onTap: () => {
        if (r.sold) return;
        const afford = st.p.gold >= price;
        const room = st.p.inv.length < BAG_SIZE || ['arrows'].includes(r.item.k) || st.p.inv.some((o) => o.k === r.item.k && o.id === r.item.id && ['potion', 'scroll', 'food', 'oil', 'torch'].includes(o.k));
        const why = !afford ? `\nYou have ${st.p.gold} gold.` : !room ? '\nYour bag is full.' : '';
        modal(scene, shopName(st, r.item), `${shopText(st, r.item)}${G.isEquip(r.item) ? compareText(st, r.item) : ''}${why}`, [
          [`Buy for ${price}`, (m) => { m.destroy(); opts.onAction?.({ type: 'buy', i }); close(); shopPanel(scene, st, opts); }],
          ['Close', (m) => m.destroy(), PALETTE.lavender],
        ], { art: { icon: G.itemIcon(st, r.item) }, depth: 300, disabled: afford && room ? [] : [0] });
      },
    });
  });
  const y = HEIGHT - 34;
  c.add(button(scene, 96, y, 150, 44, 'Sell items', () => { close(); bagPanel(scene, st, { ...opts, sell: true, onDone: () => shopPanel(scene, st, opts) }); }, { fill: PALETTE.sand }));
  c.add(button(scene, 264, y, 150, 44, 'Leave', () => close(), { fill: PALETTE.lavender }));
  return c;
}

export function heroPanel(scene, st) {
  const p = st.p;
  const c = sheet(scene, `${CLASSES[st.cls].name}, level ${p.lvl}`);
  c.add(creature(scene, WIDTH / 2, 84, CLASSES[st.cls].spr, 4));
  const melee = G.meleeDmg(st);
  const ra = G.rangedAttack(st);
  const next = G.nextLevelXp(st);
  const lines = [
    `HP ${p.hp}/${G.maxHp(st)}    XP ${p.xp}${next ? `/${next}` : ''}`,
    `Melee ${melee[0]}-${melee[1]}    Armour ${G.armorTotal(st)}`,
    ra ? `${ra.name} ${ra.dmg[0]}-${ra.dmg[1]}, range ${ra.range}` : st.p.eq.ranged ? 'Bow: no arrows left' : 'No ranged attack',
    `Torch ${Math.round(p.fuel / 4)}%, light radius ${G.torchRadius(st)}`,
    `Food ${Math.round((p.food / MAX_FOOD) * 100)}%${G.hungerState(st) ? ` (${G.hungerState(st)})` : ''}`,
    `Kills ${st.stats.kills}    Turns ${st.turn}`,
  ];
  c.add(text(scene, WIDTH / 2, 130, lines.join('\n'), { color: PALETTE.cream }).setOrigin(0.5, 0));
  const perks = Object.entries(p.perks).map(([id, n]) => `${PERKS[id].name}${n > 1 ? ` x${n}` : ''}: ${PERKS[id].text}`);
  c.add(text(scene, WIDTH / 2, 290, 'Perks', { color: PALETTE.gold }));
  c.add(text(scene, WIDTH / 2, 308, perks.length ? perks.join('\n') : 'None yet. You choose one at each new level.', { color: perks.length ? PALETTE.cream : DARK.rose, wrap: WIDTH - 40 }).setOrigin(0.5, 0));
  const knownP = Object.keys(POTIONS).filter((k) => st.known.potion[k]).length;
  const knownS = Object.keys(SCROLLS).filter((k) => st.known.scroll[k]).length;
  c.add(text(scene, WIDTH / 2, 520, `Known: ${knownP}/8 potions, ${knownS}/8 scrolls`, { color: DARK.rose }));
  c.add(button(scene, WIDTH / 2, 560, 220, 40, 'Known items', () => knownList(scene, st), { fill: PALETTE.sand }));
  c.add(button(scene, WIDTH / 2, HEIGHT - 34, 220, 44, 'Close', () => c.destroy(), { fill: PALETTE.lavender }));
  void MELEE; void RANGED; void ARMORS;
  return c;
}

function knownList(scene, st) {
  const c = sheet(scene, 'What you know', { depth: 270 });
  let y = 64;
  const add = (icon, label, known) => { c.add(itemImage(scene, 32, y, icon, 2).setAlpha(known ? 1 : 0.5)); c.add(fitLine(text(scene, 54, y, label, { origin: [0, 0.5], color: known ? PALETTE.cream : DARK.purple }), WIDTH - 70)); y += 32; };
  for (const id of Object.keys(POTIONS)) {
    const look = POTION_LOOKS[st.looks.potion[id]];
    add({ spr: [7, 0], tint: look[1] }, st.known.potion[id] ? `${look[0]}: ${POTIONS[id].name}` : `${look[0]}: ?`, st.known.potion[id]);
  }
  for (const id of Object.keys(SCROLLS)) add({ spr: [6, 2] }, st.known.scroll[id] ? `${SCROLLS[id].name}` : `"${G.itemName(st, { k: 'scroll', id, n: 1 }).replace(/^Scroll "|"$/g, '')}": ?`, st.known.scroll[id]);
  c.add(button(scene, WIDTH / 2, HEIGHT - 34, 220, 44, 'Close', () => c.destroy(), { fill: PALETTE.lavender }));
}

export function mapPanel(scene, st) {
  const c = sheet(scene, st.depth >= G.BOSS_DEPTH ? 'The Hall' : `Map of floor ${st.depth}`);
  const S = 10; const ox = Math.round((WIDTH - G.W * S) / 2); const oy = 70;
  const g = scene.add.graphics();
  c.add(g);
  g.fillStyle(hex(DARK.void)).fillRect(ox - 4, oy - 4, G.W * S + 8, G.H * S + 8);
  const v = G.view(st);
  for (let y = 0; y < G.H; y++) {
    for (let x = 0; x < G.W; x++) {
      const i = y * G.W + x;
      if (!st.f.seen[i]) continue;
      const t = st.f.t[i];
      if (t === '#' || t === 'S') continue;
      let col = v.vis[i] ? DARK.rose : DARK.blue;
      if (t === '+' || t === "'") col = DARK.sand;
      if (t === '>') col = PALETTE.gold;
      if (t === 'B') col = st.f.braziers.find((b) => b.x === x && b.y === y)?.lit ? DARK.flame : DARK.purple;
      g.fillStyle(hex(col)).fillRect(ox + x * S, oy + y * S, S, S);
    }
  }
  for (const it of st.f.items) if (st.f.seen[it.y * G.W + it.x]) g.fillStyle(hex(PALETTE.cream)).fillRect(ox + it.x * S + 3, oy + it.y * S + 3, 4, 4);
  if (st.f.shop && st.f.seen[st.f.shop.y * G.W + st.f.shop.x]) g.fillStyle(hex(PALETTE.leaf)).fillRect(ox + st.f.shop.x * S + 1, oy + st.f.shop.y * S + 1, 8, 8);
  for (const m of G.visibleMonsters(st)) g.fillStyle(hex(PALETTE.red)).fillRect(ox + m.x * S + 2, oy + m.y * S + 2, 6, 6);
  const pd = scene.add.rectangle(ox + st.p.x * S + S / 2, oy + st.p.y * S + S / 2, 8, 8, hex(PALETTE.orange)).setStrokeStyle(2, hex(PALETTE.cream));
  c.add(pd);
  scene.tweens.add({ targets: pd, alpha: 0.3, duration: 400, yoyo: true, repeat: -1 });
  const ly = oy + G.H * S + 22;
  const legend = [[PALETTE.orange, 'You'], [PALETTE.gold, 'Stairs'], [DARK.sand, 'Door'], [PALETTE.cream, 'Item'], [PALETTE.red, 'Monster']];
  legend.forEach(([col, label], i) => {
    const x = 20 + (i % 3) * 112; const y = ly + Math.floor(i / 3) * 24;
    c.add(scene.add.rectangle(x, y, 10, 10, hex(col)));
    c.add(text(scene, x + 12, y, label, { origin: [0, 0.5], color: PALETTE.cream }));
  });
  c.add(button(scene, WIDTH / 2, HEIGHT - 34, 220, 44, 'Close', () => c.destroy(), { fill: PALETTE.lavender }));
  return c;
}

/** Level up: choose one of three perks (no way to skip). */
export function perkPanel(scene, st, onPick) {
  const c = sheet(scene, `Level ${st.p.lvl}!`, { depth: 280 });
  c.add(text(scene, WIDTH / 2, 62, 'You feel stronger. Choose a perk:', { color: PALETTE.cream }));
  c.add(creature(scene, WIDTH / 2, 120, CLASSES[st.cls].spr, 4));
  st.levelUp.choices.forEach((id, i) => {
    const b = button(scene, WIDTH / 2, 230 + i * 92, 300, 76, `${PERKS[id].name}\n${PERKS[id].text}`, () => {
      if (c.locked) return;
      c.locked = true;
      c.destroy();
      onPick(id);
    }, { fill: i === 0 ? PALETTE.gold : PALETTE.sand });
    b.label.setWordWrapWidth(270);
    c.add(b);
  });
  c.add(text(scene, WIDTH / 2, 540, `HP ${st.p.hp}/${G.maxHp(st)}`, { color: DARK.rose }));
  return c;
}

export function logPanel(scene, st) {
  const c = sheet(scene, 'Recent events');
  const msgs = st.log.slice(-14);
  let y = HEIGHT - 70;
  for (let i = msgs.length - 1; i >= 0 && y > 60; i--) {
    const m = msgs[i];
    const t = text(scene, 20, y, m.text, { origin: [0, 1], align: 'left', wrap: WIDTH - 40, color: { good: '#9be36b', bad: PALETTE.orange }[m.c] || PALETTE.cream });
    if (y - t.height < 56) { t.destroy(); break; }
    c.add(t);
    y -= t.height + 6;
  }
  c.add(button(scene, WIDTH / 2, HEIGHT - 34, 220, 44, 'Close', () => c.destroy(), { fill: PALETTE.lavender }));
  void outlined;
  return c;
}

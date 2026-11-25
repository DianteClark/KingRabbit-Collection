// HTML panels for Pixel Quest: the menu, items, spells, gear, status, shops, options and the
// battle skill/item lists. Plain DOM over the canvas so long lists scroll naturally on a phone.
import { sfx, isMuted, setMuted } from '../../../shared/core/sfx.js';
import { frameUrl } from '../art.js';
import { CLASSES, SKILLS, ITEMS, GEAR, KEY_ITEMS, STATUS, SHOPS, itemName } from '../logic/data.js';
import { statsOf, canEquip, skillsAt, xpFor } from '../logic/stats.js';
import { MAX_LEVEL } from '../logic/data.js';
import * as G from '../logic/game.js';
import { skillProblem, itemProblem } from '../logic/battle.js';
import { musicOn, setMusicOn } from '../music.js';

const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let open = [];
let lastClose = 0;
/** True while a panel is open or was closed a moment ago (so the closing tap doesn't reach the game). */
export const blocking = () => open.length > 0 || Date.now() - lastClose < 300;
export const anyOpen = () => open.length > 0;
export function closeAll() { [...open].forEach((p) => p.close(true)); }

export function sheet({ title, sub = '', html = '', foot = '', wrap = '', onClose, handlers = {}, noX = false, closeLabel = 'Close', smallTitle = false }) {
  const el = document.createElement('div');
  el.className = `pq-wrap ${wrap}`;
  el.innerHTML = `
    <div class="pq-sheet" role="dialog" aria-label="${esc(title)}">
      <div class="pq-head"><h2 class="${smallTitle || title.length > 12 ? 'small' : ''}">${esc(title)}</h2>${noX ? '' : `<button class="x" data-act="close">${esc(closeLabel)}</button>`}</div>
      <div class="pq-sub">${sub}</div>
      <div class="pq-scroll">${html}</div>
      <div class="pq-foot">${foot}</div>
    </div>`;
  let busyUntil = 0;
  const p = {
    el,
    close(silent) {
      if (!el.isConnected) return;
      el.remove();
      open = open.filter((x) => x !== p);
      lastClose = Date.now();
      if (!silent) sfx('tap');
      onClose?.();
    },
    set(part, h) { const n = el.querySelector(`.pq-${part}`); if (n) n.innerHTML = h; },
  };
  el.addEventListener('click', (e) => {
    if (!el.isConnected) return;
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled) {
      // One action per tap, even if a finger bounces.
      if (Date.now() < busyUntil) return;
      busyUntil = Date.now() + 180;
      const act = b.dataset.act;
      if (act === 'close') { p.close(); return; }
      sfx('tap');
      handlers[act]?.(b.dataset, p);
      return;
    }
    if (e.target === el && !noX) p.close();
  });
  for (const t of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'wheel']) el.addEventListener(t, (e) => e.stopPropagation());
  document.body.appendChild(el);
  open.push(p);
  return p;
}

// ---------------------------------------------------------------- bits

const img = (frame, cls = 'pq-icon') => `<img class="${cls}" alt="" src="${frameUrl(frame)}">`;
const face = (cls) => `<div class="pq-pic">${img(`c${CLASSES[cls].ch}_6`, '')}</div>`;
const bar = (frac, color) => `<div class="pq-bar"><i style="width:${Math.max(0, Math.min(100, frac * 100)).toFixed(1)}%;background:${color}"></i></div>`;
const hpCol = (f) => (f > 0.5 ? '#6cbf4a' : f > 0.2 ? '#e3b23c' : '#d84848');
const stTag = (st) => (st ? `<span class="pq-st" style="background:${STATUS[st].color}">${STATUS[st].short}</span>` : '');

export function memberRow(m, { act = 'pick', idx = 0, note = '', sel = false, off = false } = {}) {
  const s = statsOf(m);
  const c = CLASSES[m.cls];
  const dead = m.hp <= 0;
  return `<button class="pq-row ${dead ? 'dead' : ''} ${sel ? 'sel' : ''} ${off ? 'off' : ''}" data-act="${act}" data-idx="${idx}">
    ${face(m.cls)}
    <div class="grow">
      <div class="line"><span class="name">${esc(c.name)} <span class="meta">${c.title}</span>${dead ? '<span class="pq-st" style="background:#a13d3b;color:#f9f5ef">DOWN</span>' : stTag(m.st)}</span><span class="meta">Lv ${m.lv}</span></div>
      <div class="pq-bars"><span>HP</span>${bar(m.hp / s.hp, hpCol(m.hp / s.hp))}<span>${m.hp}/${s.hp}</span>
      <span>MP</span>${bar(s.mp ? m.mp / s.mp : 0, '#5b74d0')}<span>${m.mp}/${s.mp}</span></div>
      ${note ? `<div class="note">${note}</div>` : ''}
    </div>
  </button>`;
}

/** Pick a party member. filter(m) -> reason string to disable. */
export function partyPick(st, { title = 'Who?', sub = '', filter, onPick, onClose }) {
  const html = () => st.party.map((m, i) => { const why = filter?.(m); return memberRow(m, { idx: i, off: !!why, note: why || '' }); }).join('');
  const p = sheet({
    title, sub, html: html(), onClose,
    handlers: { pick: ({ idx }) => { const i = Number(idx); const why = filter?.(st.party[i]); if (why) { sfx('error'); return; } onPick(i, p, () => p.set('scroll', html())); } },
  });
  return p;
}

// ---------------------------------------------------------------- tip cards

export function tipPanel(title, lines, onClose) {
  return sheet({
    title, closeLabel: 'OK', onClose,
    html: lines.map((l) => `<p class="pq-p">${esc(l)}</p>`).join(''),
    foot: '<button class="pq-btn gold" data-act="close">Got it</button>',
  });
}

// ---------------------------------------------------------------- main menu

export function menuPanel(st, { onSave, onTitle, onChange, playMs }) {
  const html = () => `
    <div class="pq-goal"><b>Goal:</b> ${esc(G.goal(st))}</div>
    ${st.party.map((m, i) => memberRow(m, { act: 'status', idx: i })).join('')}
    <div class="pq-grid">
      <button class="pq-btn cream" data-act="items">Items</button>
      <button class="pq-btn cream" data-act="spells">Spells</button>
      <button class="pq-btn cream" data-act="equip">Equip</button>
      <button class="pq-btn cream" data-act="options">Options</button>
      <button class="pq-btn gold" data-act="save">Save</button>
      <button class="pq-btn" data-act="title">Title screen</button>
    </div>`;
  const sub = () => `<span style="color:#e3d245">${st.gold} gold</span> &middot; Chimes ${G.chimesHeld(st)}/3 &middot; ${fmt(playMs())}`;
  const refresh = () => { p.set('scroll', html()); p.set('sub', sub()); onChange?.(); };
  const p = sheet({
    title: 'Menu', sub: sub(), html: html(),
    handlers: {
      status: ({ idx }) => statusPanel(st, Number(idx)),
      items: () => itemsPanel(st, { onChange: (e) => { if (e?.warped) { p.close(true); onChange?.(e); } else refresh(); } }),
      spells: () => spellsPanel(st, { onChange: refresh }),
      equip: () => equipPick(st, { onChange: refresh }),
      options: () => optionsPanel(st, { onChange: refresh }),
      save: () => { onSave(); p.set('sub', `${sub()} &middot; <span style="color:#8fd46a">Saved!</span>`); sfx('coin'); },
      title: () => { p.close(true); onTitle(); },
    },
  });
  return p;
}

function fmt(ms) {
  const m = Math.floor(ms / 60000);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

// ---------------------------------------------------------------- status

export function statusPanel(st, idx) {
  const m = st.party[idx];
  const c = CLASSES[m.cls];
  const s = statsOf(m);
  const next = m.lv >= MAX_LEVEL ? 'Max level' : `${xpFor(m.lv + 1) - m.xp} XP to level ${m.lv + 1}`;
  const known = skillsAt(m.cls, m.lv);
  const upcoming = c.skills.filter(([, l]) => l > m.lv).slice(0, 2);
  const html = `
    ${memberRow(m, { act: 'none', note: next })}
    <p class="pq-p">${esc(c.blurb)}</p>
    <div class="pq-stats">
      <div><span>Attack</span> ${s.atk}</div><div><span>Defence</span> ${s.def}</div>
      <div><span>Magic</span> ${s.mag}</div><div><span>Speed</span> ${s.spd}</div>
    </div>
    <h3 class="pq-h3">Gear</h3>
    ${['w', 'a', 'c'].map((slot) => `<div>${slotName(slot)}: ${m.eq[slot] ? esc(GEAR[m.eq[slot]].name) : '<span style="color:#8a86a8">none</span>'}</div>`).join('')}
    <h3 class="pq-h3">${m.cls === 'warrior' || m.cls === 'thief' ? 'Skills' : 'Spells'}</h3>
    ${known.map((id) => `<div class="pq-row static"><div class="grow"><div class="line"><span class="name">${esc(SKILLS[id].name)}</span><span class="meta">${SKILLS[id].mp} MP</span></div><div class="note">${esc(SKILLS[id].desc)}</div></div></div>`).join('')}
    ${upcoming.length ? `<p class="pq-p" style="color:#b9bce0">Next: ${upcoming.map(([id, l]) => `${esc(SKILLS[id].name)} (Lv ${l})`).join(', ')}</p>` : ''}`;
  return sheet({ title: `${c.name} the ${c.title}`, html, smallTitle: true });
}

const slotName = (s) => ({ w: 'Weapon', a: 'Armour', c: 'Charm' }[s]);

// ---------------------------------------------------------------- items

export function itemsPanel(st, { onChange } = {}) {
  const html = () => {
    const ids = Object.keys(st.bag).filter((id) => st.bag[id] > 0 && ITEMS[id]);
    const keys = Object.keys(st.keys).filter((k) => st.keys[k]);
    const gear = Object.keys(st.gear).filter((k) => st.gear[k] > 0);
    return (ids.length ? ids.map((id) => {
      const it = ITEMS[id];
      const off = it.battleOnly;
      return `<button class="pq-row ${off ? 'off' : ''}" data-act="use" data-id="${id}">${img(`i_${it.icon}`)}<div class="grow"><div class="line"><span class="name">${esc(it.name)}</span><span class="meta">x${st.bag[id]}</span></div><div class="note">${esc(it.desc)}${off ? ' (battle only)' : ''}</div></div></button>`;
    }).join('') : '<p class="pq-p">Your bag is empty. Item shops sell Herbs and more.</p>')
      + (gear.length ? `<h3 class="pq-h3">Spare gear</h3>${gear.map((id) => `<div class="pq-row static">${img(`i_${GEAR[id].icon}`)}<div class="grow"><div class="line"><span class="name">${esc(GEAR[id].name)}</span><span class="meta">x${st.gear[id]}</span></div><div class="note">${gearText(GEAR[id])} &middot; equip from Equip</div></div></div>`).join('')}` : '')
      + (keys.length ? `<h3 class="pq-h3">Key items</h3>${keys.map((k) => `<div class="pq-row static">${img(`i_${KEY_ITEMS[k].icon}`)}<div class="grow"><div class="name">${esc(KEY_ITEMS[k].name)}</div><div class="note">${esc(KEY_ITEMS[k].desc)}</div></div></div>`).join('')}` : '');
  };
  const p = sheet({
    title: 'Items', html: html(),
    handlers: {
      use: ({ id }) => {
        const it = ITEMS[id];
        if (it.battleOnly) { sfx('error'); return; }
        const done = (r) => { if (r.ok) { sfx('power'); } else sfx('error'); p.set('scroll', html()); p.set('sub', `<span style="color:${r.ok ? '#8fd46a' : '#f08080'}">${esc(r.text || '')}</span>`); onChange?.(); };
        if (it.target === 'none') {
          if (it.use === 'warp' && G.mapOf(st).id === st.lastInn.map) { done({ ok: false, text: 'You are already there.' }); return; }
          const r = G.useItemField(st, id, 0);
          done(r);
          if (r.ok && it.use === 'warp') { p.close(true); onChange?.({ warped: true, text: r.text }); }
          return;
        }
        partyPick(st, {
          title: it.name, sub: esc(it.desc),
          filter: (m) => (it.target === 'dead' ? (m.hp > 0 ? 'Not fallen' : '') : (m.hp <= 0 ? 'Fallen' : '')),
          onPick: (i, pp, refresh) => { const r = G.useItemField(st, id, i); done(r); refresh(); pp.set('sub', `<span style="color:${r.ok ? '#8fd46a' : '#f08080'}">${esc(r.text)}</span>`); if (!(st.bag[id] > 0)) pp.close(true); },
        });
      },
    },
  });
  return p;
}

// ---------------------------------------------------------------- spells (outside battle)

export function spellsPanel(st, { onChange } = {}) {
  const casters = st.party.map((m, i) => [m, i]).filter(([m]) => skillsAt(m.cls, m.lv).some((s) => SKILLS[s].field));
  const html = () => (casters.length ? casters.map(([m, i]) => {
    const list = skillsAt(m.cls, m.lv).filter((s) => SKILLS[s].field);
    return `<h3 class="pq-h3">${esc(CLASSES[m.cls].name)} &middot; MP ${m.mp}/${statsOf(m).mp}</h3>` + list.map((s) => {
      const sk = SKILLS[s];
      const off = m.hp <= 0 || m.mp < sk.mp;
      return `<button class="pq-row ${off ? 'off' : ''}" data-act="cast" data-idx="${i}" data-id="${s}"><div class="grow"><div class="line"><span class="name">${esc(sk.name)}</span><span class="meta">${sk.mp} MP</span></div><div class="note">${esc(sk.desc)}</div></div></button>`;
    }).join('');
  }).join('') : '<p class="pq-p">Nobody knows a spell that works outside battle yet.</p>');
  const p = sheet({
    title: 'Spells', html: html(), sub: 'Healing spells can be cast outside battle.',
    handlers: {
      cast: ({ idx, id }) => {
        const ci = Number(idx); const sk = SKILLS[id];
        const done = (r) => { sfx(r.ok ? 'power' : 'error'); p.set('scroll', html()); p.set('sub', `<span style="color:${r.ok ? '#8fd46a' : '#f08080'}">${esc(r.text)}</span>`); onChange?.(); };
        if (sk.target === 'allies') { done(G.castField(st, ci, id, 0)); return; }
        partyPick(st, {
          title: sk.name, sub: `${esc(sk.desc)} (${sk.mp} MP)`,
          filter: (m) => (sk.target === 'dead' ? (m.hp > 0 ? 'Not fallen' : '') : (m.hp <= 0 ? 'Fallen' : '')),
          onPick: (i, pp, refresh) => { const r = G.castField(st, ci, id, i); done(r); refresh(); pp.set('sub', `<span style="color:${r.ok ? '#8fd46a' : '#f08080'}">${esc(r.text)}</span>`); },
        });
      },
    },
  });
  return p;
}

// ---------------------------------------------------------------- equipment

export function gearText(g) {
  const parts = [];
  for (const [k, n] of [['atk', 'Atk'], ['def', 'Def'], ['mag', 'Mag'], ['spd', 'Spd'], ['mp', 'MP']]) if (g[k]) parts.push(`${n} ${g[k] > 0 ? '+' : ''}${g[k]}`);
  if (g.ward) parts.push('blocks status');
  if (g.luck) parts.push('steals, crits');
  return parts.join(' ');
}

function deltaText(d) {
  const keys = Object.keys(d);
  if (!keys.length) return '<span class="note">no change</span>';
  const name = { atk: 'Atk', def: 'Def', mag: 'Mag', spd: 'Spd', hp: 'HP', mp: 'MP' };
  return keys.map((k) => `<span class="${d[k] > 0 ? 'good' : 'bad'}">${name[k]} ${d[k] > 0 ? '+' : ''}${d[k]}</span>`).join(' ');
}

export function equipPick(st, { onChange } = {}) {
  return partyPick(st, { title: 'Equip', sub: 'Choose a hero.', onPick: (i, p, refresh) => equipPanel(st, i, { onChange: () => { refresh(); onChange?.(); } }) });
}

export function equipPanel(st, idx, { onChange } = {}) {
  const m = st.party[idx];
  let slot = 'w';
  const html = () => {
    const cur = m.eq[slot];
    const own = Object.keys(st.gear).filter((id) => st.gear[id] > 0 && GEAR[id].slot === slot);
    const rows = own.map((id) => {
      const ok = canEquip(m.cls, id);
      return `<button class="pq-row ${ok ? '' : 'off'}" data-act="eq" data-id="${id}">${img(`i_${GEAR[id].icon}`)}<div class="grow"><div class="line"><span class="name">${esc(GEAR[id].name)}</span><span class="meta">x${st.gear[id]}</span></div><div class="note">${ok ? deltaText(G.gearDelta(st, idx, id)) : `${esc(CLASSES[m.cls].name)} can't use this`}</div></div></button>`;
    }).join('');
    return `<div class="pq-row static sel">${cur ? img(`i_${GEAR[cur].icon}`) : ''}<div class="grow"><div class="line"><span class="name">${cur ? esc(GEAR[cur].name) : 'Nothing'}</span><span class="meta">equipped</span></div><div class="note">${cur ? gearText(GEAR[cur]) : ''}</div></div></div>
      ${slot === 'c' && cur ? '<button class="pq-btn small" data-act="off" style="margin-bottom:8px">Take off</button>' : ''}
      ${rows || `<p class="pq-p" style="color:#b9bce0">No spare ${slotName(slot).toLowerCase()}s. Buy them at gear shops or find them in chests.</p>`}`;
  };
  const tabs = () => ['w', 'a', 'c'].map((s) => `<button class="pq-btn ${s === slot ? 'on' : ''}" data-act="tab" data-slot="${s}">${slotName(s)}</button>`).join('');
  const sub = () => { const s = statsOf(m); return `Atk ${s.atk} &middot; Def ${s.def} &middot; Mag ${s.mag} &middot; Spd ${s.spd}`; };
  const p = sheet({
    title: CLASSES[m.cls].name, sub: sub(), html: html(),
    foot: `${tabs()}<button class="pq-btn gold" data-act="best" style="flex-basis:100%">Equip the best I have</button>`,
    handlers: {
      tab: ({ slot: s }) => { slot = s; p.set('scroll', html()); p.set('foot', `${tabs()}<button class="pq-btn gold" data-act="best" style="flex-basis:100%">Equip the best I have</button>`); },
      eq: ({ id }) => { if (!G.equip(st, idx, id)) { sfx('error'); return; } sfx('select'); p.set('scroll', html()); p.set('sub', sub()); onChange?.(); },
      off: () => { G.unequip(st, idx, 'c'); p.set('scroll', html()); p.set('sub', sub()); onChange?.(); },
      best: () => { const b = G.bestGear(st, idx); for (const id of Object.values(b)) G.equip(st, idx, id); p.set('scroll', html()); p.set('sub', sub()); onChange?.(); },
    },
  });
  return p;
}

// ---------------------------------------------------------------- shops

export function shopPanel(st, shopId, { onChange } = {}) {
  const shop = SHOPS[shopId];
  let tab = 'buy';
  const whoChips = (id) => {
    const g = GEAR[id];
    return `<div class="pq-chips">${st.party.map((m, i) => {
      if (!canEquip(m.cls, id)) return `<span class="pq-chip no">${esc(CLASSES[m.cls].name)}</span>`;
      const d = G.gearDelta(st, i, id);
      // The one number that matters most for this hero and this kind of gear.
      const caster = m.cls === 'mage' || m.cls === 'cleric';
      const key = g.slot === 'w' ? (caster && g.mag ? 'mag' : 'atk') : g.slot === 'a' ? 'def' : (['atk', 'def', 'mag', 'spd'].find((k) => g[k]) || 'atk');
      const v = d[key] || 0;
      return `<span class="pq-chip ${v > 0 ? 'ok' : ''}">${esc(CLASSES[m.cls].name)} ${v > 0 ? '+' : ''}${v || '='}</span>`;
    }).join('')}</div>`;
  };
  const html = () => {
    if (tab === 'buy') {
      return shop.items.map((id) => {
        const it = ITEMS[id] || GEAR[id];
        const price = it.price;
        const off = st.gold < price;
        const owned = ITEMS[id] ? (st.bag[id] || 0) : (st.gear[id] || 0) + st.party.filter((m) => Object.values(m.eq).includes(id)).length;
        const desc = ITEMS[id] ? esc(it.desc) : `${gearText(it)}${whoChips(id)}`;
        return `<button class="pq-row ${off ? 'off' : ''}" data-act="buy" data-id="${id}">${img(`i_${it.icon}`)}<div class="grow"><div class="line"><span class="name">${esc(it.name)}</span><span class="meta" style="color:#e3d245">${price}g</span></div><div class="note">${desc}${owned ? ` <span class="meta">(have ${owned})</span>` : ''}</div></div></button>`;
      }).join('');
    }
    const sellable = [...Object.keys(st.bag).filter((id) => st.bag[id] > 0 && ITEMS[id]?.price), ...Object.keys(st.gear).filter((id) => st.gear[id] > 0 && GEAR[id].price)];
    if (!sellable.length) return '<p class="pq-p">Nothing to sell. Spare gear and items you carry can be sold here for half price.</p>';
    return sellable.map((id) => {
      const it = ITEMS[id] || GEAR[id];
      const n = ITEMS[id] ? st.bag[id] : st.gear[id];
      return `<button class="pq-row" data-act="sell" data-id="${id}">${img(`i_${it.icon}`)}<div class="grow"><div class="line"><span class="name">${esc(it.name)} <span class="meta">x${n}</span></span><span class="meta" style="color:#e3d245">+${G.sellPrice(id)}g</span></div></div></button>`;
    }).join('');
  };
  const foot = () => `<button class="pq-btn ${tab === 'buy' ? 'gold' : ''}" data-act="tab" data-t="buy">Buy</button><button class="pq-btn ${tab === 'sell' ? 'gold' : ''}" data-act="tab" data-t="sell">Sell</button>`;
  const sub = (msg = '') => `<span style="color:#e3d245">${st.gold} gold</span>${msg ? ` &middot; ${msg}` : ''}`;
  const p = sheet({
    title: shop.name, sub: sub(), html: html(), foot: foot(),
    handlers: {
      tab: ({ t }) => { tab = t; p.set('scroll', html()); p.set('foot', foot()); },
      buy: ({ id }) => {
        if (!G.buy(st, id)) { sfx('error'); p.set('sub', sub('<span style="color:#f08080">Not enough gold</span>')); return; }
        sfx('coin');
        let msg = `Bought ${esc(itemName(id))}`;
        if (GEAR[id]) {
          // Offer to wear it straight away if it's an upgrade for someone.
          const who = st.party.findIndex((m, i) => canEquip(m.cls, id) && G.bestGear(st, i)[GEAR[id].slot] === id);
          if (who >= 0) { G.equip(st, who, id); msg = `${esc(CLASSES[st.party[who].cls].name)} equips the ${esc(GEAR[id].name)}!`; }
        }
        p.set('scroll', html()); p.set('sub', sub(`<span style="color:#8fd46a">${msg}</span>`)); onChange?.();
      },
      sell: ({ id }) => { if (G.sell(st, id)) { sfx('coin'); p.set('scroll', html()); p.set('sub', sub(`Sold ${esc(itemName(id))}`)); onChange?.(); } },
    },
  });
  return p;
}

// ---------------------------------------------------------------- options

export function optionsPanel(st, { onChange } = {}) {
  const opt = (name, key, values, labels) => `<h3 class="pq-h3">${name}</h3><div class="pq-opt">${values.map((v, i) => `<button class="pq-btn ${key() === v ? 'on' : ''}" data-act="${name}" data-v="${v}">${labels[i]}</button>`).join('')}</div>`;
  const html = () => `
    ${opt('Difficulty', () => st.difficulty, ['story', 'normal'], ['Story', 'Normal'])}
    <p class="pq-p" style="color:#b9bce0">${st.difficulty === 'story' ? 'Story: weaker monsters, smaller groups, more gold, no gold lost if the party falls.' : 'Normal: the full challenge.'}</p>
    ${opt('Battles', () => st.encRate, ['low', 'normal', 'high'], ['Fewer', 'Normal', 'More'])}
    ${opt('Music', () => (musicOn() ? 'on' : 'off'), ['on', 'off'], ['On', 'Off'])}
    ${opt('Sound', () => (isMuted() ? 'off' : 'on'), ['on', 'off'], ['On', 'Off'])}`;
  const p = sheet({
    title: 'Options', html: html(),
    handlers: {
      Difficulty: ({ v }) => { st.difficulty = v; if (v === 'story') st.everStory = true; p.set('scroll', html()); onChange?.(); },
      Battles: ({ v }) => { st.encRate = v; p.set('scroll', html()); onChange?.(); },
      Music: ({ v }) => { setMusicOn(v === 'on'); p.set('scroll', html()); },
      Sound: ({ v }) => { setMuted(v === 'off'); setMusicOn(musicOn()); p.set('scroll', html()); },
    },
  });
  return p;
}

// ---------------------------------------------------------------- battle lists

export function battleSkillPanel(b, a, { onPick, onClose }) {
  const list = a.skills;
  const html = list.map((id) => {
    const sk = SKILLS[id];
    const why = skillProblem(b, a, id);
    return `<button class="pq-row ${why ? 'off' : ''}" data-act="pick" data-id="${id}"><div class="grow"><div class="line"><span class="name">${esc(sk.name)}</span><span class="meta">${sk.mp} MP</span></div><div class="note">${why ? `<span class="bad">${esc(why)}</span>` : esc(sk.desc)}</div></div></button>`;
  }).join('');
  const p = sheet({
    title: `${a.name}: ${a.id === 'mage' || a.id === 'cleric' ? 'Spells' : 'Skills'}`, sub: `MP ${a.mp}/${a.s.mp}`, html, wrap: 'bottom', closeLabel: 'Back', onClose,
    handlers: { pick: ({ id }) => { if (skillProblem(b, a, id)) { sfx('error'); return; } p.close(true); onPick(id); } },
  });
  return p;
}

export function battleItemPanel(b, { onPick, onClose }) {
  const ids = Object.keys(b.bag).filter((id) => b.bag[id] > 0 && ITEMS[id]);
  const html = ids.length ? ids.map((id) => {
    const it = ITEMS[id];
    const why = itemProblem(b, id);
    return `<button class="pq-row ${why ? 'off' : ''}" data-act="pick" data-id="${id}">${img(`i_${it.icon}`)}<div class="grow"><div class="line"><span class="name">${esc(it.name)}</span><span class="meta">x${b.bag[id]}</span></div><div class="note">${why ? `<span class="bad">${esc(why)}</span>` : esc(it.desc)}</div></div></button>`;
  }).join('') : '<p class="pq-p">The bag is empty.</p>';
  const p = sheet({
    title: 'Items', html, wrap: 'bottom', closeLabel: 'Back', onClose,
    handlers: { pick: ({ id }) => { if (itemProblem(b, id)) { sfx('error'); return; } p.close(true); onPick(id); } },
  });
  return p;
}


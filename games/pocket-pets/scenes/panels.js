// HTML panels for Pocket Pets: party, pet summary, bag, shop, PetDex, Pet Box, learning a move.
import { sfx } from '../../../shared/core/sfx.js';
import { URLS } from '../art.js';
import { SPECIES, MOVES, ITEMS, ITEM_ORDER, DEX_ORDER, STATUS_INFO, LINES } from '../logic/data.js';
import { TYPE_INFO, WHEEL, typeMult } from '../logic/types.js';
import { statsOf, maxHp, petName, xpForLevel, MAX_LEVEL, setNick, NICK_MAX } from '../logic/pet.js';
import { itemProblem, applyItem } from '../logic/battle.js';
import * as G from '../logic/game.js';
import { hpColor } from './common.js';

const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let open = [];
let lastClose = 0;
/** True while a panel is open or was closed a moment ago (so the closing tap doesn't reach the game). */
export const blocking = () => open.length > 0 || Date.now() - lastClose < 250;
export const anyOpen = () => open.length > 0;
export function closeAll() { [...open].forEach((p) => p.close(true)); }

export function sheet({ title, sub = '', html = '', foot = '', cls = '', wrap = '', onClose, handlers = {}, noX = false }) {
  const el = document.createElement('div');
  el.className = `pp-wrap ${wrap}`;
  el.innerHTML = `
    <div class="pp-sheet ${cls}" role="dialog" aria-label="${esc(title)}">
      <div class="pp-head"><h2>${esc(title)}</h2>${noX ? '' : '<button class="x" data-act="close" aria-label="Close">Close</button>'}</div>
      <div class="pp-sub">${sub}</div>
      <div class="pp-scroll">${html}</div>
      <div class="pp-foot">${foot}</div>
    </div>`;
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
    set(part, h) { const n = el.querySelector(`.pp-${part}`); if (n) n.innerHTML = h; },
  };
  el.addEventListener('click', (e) => {
    if (!el.isConnected) return; // a second tap on a sheet that just closed
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled) {
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

/** The type wheel on one line, plus the link that closes the loop. */
const wheelHtml = () => `<div class="pp-wheel">${WHEEL.map((t) => typeTag(t)).join('<span>&gt;</span>')}</div>
  <p class="pp-p pp-loop">...and ${TYPE_INFO[WHEEL[WHEEL.length - 1]].name} beats ${TYPE_INFO[WHEEL[0]].name}, closing the wheel.</p>`;
const typeTag = (t) => `<span class="pp-type" style="background:${TYPE_INFO[t].color}">${TYPE_INFO[t].name}</span>`;
const stTag = (st) => (st ? `<span class="pp-st" style="background:${STATUS_INFO[st].color}">${STATUS_INFO[st].short}</span>` : '');
const pic = (sp, big = false) => `<div class="pp-pic ${big ? 'big' : ''}"><img alt="" src="${URLS.pets[sp] || ''}"></div>`;
const bar = (frac, color, cls = '') => `<div class="pp-bar ${cls}"><i style="width:${Math.max(0, Math.min(100, frac * 100)).toFixed(1)}%;background:${color}"></i></div>`;

export function petRow(pet, { act = 'pick', idx = 0, sel = false, note = '', off = false } = {}) {
  const mh = maxHp(pet);
  const sp = SPECIES[pet.sp];
  return `<button class="pp-row ${pet.hp <= 0 ? 'dead' : ''} ${sel ? 'sel' : ''} ${off ? 'off' : ''}" data-act="${act}" data-idx="${idx}">
    ${pic(pet.sp)}
    <div class="grow">
      <div class="line"><span class="name">${esc(petName(pet))}</span><span class="meta">Lv ${pet.lv}</span></div>
      <div class="line"><span>${typeTag(sp.type)}${stTag(pet.st)}${pet.hp <= 0 ? '<span class="pp-st" style="background:#a13d3b;color:#f9f5ef">FAINTED</span>' : ''}</span><span class="meta">${pet.hp}/${mh}</span></div>
      ${bar(pet.hp / mh, hpColor(pet.hp / mh))}
      ${note ? `<div class="meta">${note}</div>` : ''}
    </div>
  </button>`;
}

function moveRow(m, pp) {
  const mv = MOVES[m];
  const what = mv.power ? `Pow ${mv.power}` : 'Status';
  const acc = mv.acc == null ? '' : ` &middot; ${mv.acc}%`;
  const extra = moveNote(mv);
  return `<div class="pp-move" style="border-left-color:${TYPE_INFO[mv.type].color}">
    <div><div>${esc(mv.name)}</div><div class="meta">${TYPE_INFO[mv.type].name} &middot; ${what}${acc}${extra ? ` &middot; ${extra}` : ''}</div></div>
    <div class="meta">${pp != null ? `PP ${pp}/${mv.pp}` : `PP ${mv.pp}`}</div>
  </div>`;
}

export function moveNote(mv) {
  const n = [];
  if (mv.prio) n.push('goes first');
  if (mv.status) n.push(mv.chance >= 1 ? STATUS_INFO[mv.status].name.toLowerCase() : `may ${{ burn: 'burn', poison: 'poison', para: 'paralyse', sleep: 'put to sleep' }[mv.status]}`);
  if (mv.stat) n.push(`${mv.stat.who === 'self' ? 'own' : 'foe'} ${{ atk: 'Attack', def: 'Defence', spd: 'Speed' }[mv.stat.key]} ${mv.stat.n > 0 ? '+' : ''}${mv.stat.n}`);
  if (mv.drain) n.push('drains HP');
  if (mv.recoil) n.push('recoil');
  if (mv.heal) n.push('heals half HP');
  return n.join(', ');
}

// ---------------------------------------------------------------- party

/**
 * The party list. mode: 'menu' (tap for details), 'switch' (battle: pick who goes in),
 * 'faint' (must pick a new pet), 'target' (pick a pet for an item).
 */
export function partyPanel(state, { mode = 'menu', title = 'Pets', sub = '', activeIdx = -1, onPick, onChange, onClose } = {}) {
  const html = () => state.party.map((p, i) => {
    let note = '';
    if (mode === 'switch' && i === activeIdx) note = 'In battle now';
    if (i === 0 && mode === 'menu') note = 'Leads into battle';
    return petRow(p, { idx: i, sel: i === activeIdx, note });
  }).join('') + (mode === 'menu' && state.box.length ? `<p class="pp-p" style="color:#c9d3ab">${state.box.length} more in the Pet Box (swap at any clinic).</p>` : '');
  const panel = sheet({
    title, sub, html: html(), noX: mode === 'faint', wrap: 'center', onClose,
    handlers: {
      pick: ({ idx }) => {
        const i = Number(idx);
        if (mode === 'menu') { summaryPanel(state, i, { onChange: () => { panel.set('scroll', html()); onChange?.(); } }); return; }
        const p = state.party[i];
        if (mode === 'switch' || mode === 'faint') {
          if (p.hp <= 0) { sfx('error'); return; }
          if (i === activeIdx && mode === 'switch') { sfx('error'); return; }
        }
        panel.close(true);
        onPick?.(i);
      },
    },
  });
  return panel;
}

export function summaryPanel(state, idx, { onChange, readOnly = false } = {}) {
  const pet = state.party[idx];
  const sp = SPECIES[pet.sp];
  const s = statsOf(pet);
  const next = pet.lv >= MAX_LEVEL ? 0 : xpForLevel(pet.lv + 1) - pet.xp;
  const span = pet.lv >= MAX_LEVEL ? 1 : xpForLevel(pet.lv + 1) - xpForLevel(pet.lv);
  const evo = sp.evo ? `Evolves into ${SPECIES[sp.evo[0]].name} at level ${sp.evo[1]}.` : 'Fully evolved.';
  const upcoming = LINES[sp.line].filter(([l]) => l > pet.lv).slice(0, 2).map(([l, m]) => `${MOVES[m].name} (Lv ${l})`).join(', ');
  const html = `
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:8px">
      ${pic(pet.sp, true)}
      <div class="grow">
        <div>${typeTag(sp.type)}${stTag(pet.st)}${pet.nick ? ` <span style="color:#c9d3ab">${esc(sp.name)}</span>` : ''}</div>
        <div style="margin-top:4px">Level ${pet.lv} &middot; HP ${pet.hp}/${s.hp}</div>
        ${bar(pet.hp / s.hp, hpColor(pet.hp / s.hp))}
        <div class="meta" style="color:#c9d3ab;margin-top:4px">${next ? `${next} XP to level ${pet.lv + 1}` : 'Top level!'}</div>
        ${bar(1 - next / span, '#7fb2ec', 'xp')}
      </div>
    </div>
    <div class="pp-stats"><div><span>Attack</span> ${s.atk}</div><div><span>Defence</span> ${s.def}</div><div><span>Speed</span> ${s.spd}</div><div><span>Max HP</span> ${s.hp}</div></div>
    <h3 class="pp-h3">Moves</h3>
    ${pet.moves.map((m) => moveRow(m.id, m.pp)).join('')}
    <p class="pp-p" style="color:#c9d3ab;margin-top:8px">${esc(evo)}${upcoming ? ` Next moves: ${esc(upcoming)}.` : ''}</p>
    <p class="pp-p">${esc(sp.dex)}</p>`;
  const foot = readOnly ? '' : `
    <button class="pp-btn small" data-act="rename">Rename</button>
    <button class="pp-btn gold" data-act="lead" ${idx === 0 ? 'disabled' : ''}>Make lead</button>
    <button class="pp-btn small" data-act="up" ${idx === 0 ? 'disabled' : ''}>Up</button>
    <button class="pp-btn small" data-act="down" ${idx === state.party.length - 1 ? 'disabled' : ''}>Down</button>`;
  return sheet({
    title: petName(pet), html, foot, wrap: 'center',
    handlers: {
      lead: (d, p) => { G.makeLead(state, idx); onChange?.(); p.close(true); },
      rename: (d, p) => { p.close(true); nicknamePanel(pet, () => onChange?.()); },
      up: (d, p) => { G.moveInParty(state, idx, -1); onChange?.(); p.close(true); },
      down: (d, p) => { G.moveInParty(state, idx, 1); onChange?.(); p.close(true); },
    },
  });
}

// ---------------------------------------------------------------- bag

/**
 * The bag. In battle pass battle info: { wild, activeIdx, onAction(action) } and the panel closes
 * when an action is chosen. Outside battle, items are used straight away (onChange after).
 */
export function bagPanel(state, { battle = null, onChange } = {}) {
  const items = () => ITEM_ORDER.filter((id) => state.bag[id] > 0);
  const html = () => {
    const list = items();
    if (!list.length) return '<p class="pp-p">Your bag is empty. Pet Shops sell Capsules and medicine.</p>';
    return list.map((id) => {
      const it = ITEMS[id];
      const off = it.kind === 'capsule' && (!battle || !battle.wild);
      return `<button class="pp-row ${off ? 'off' : ''}" data-act="item" data-id="${id}">
        <img class="pp-item" alt="" src="${URLS.items[id]}">
        <div class="grow"><div class="line"><span class="name">${esc(it.name)}</span><span class="meta">x${state.bag[id]}</span></div>
        <div class="meta" style="white-space:normal">${esc(it.desc)}</div></div></button>`;
    }).join('');
  };
  const sub = battle ? '' : `<span class="pp-coins">${state.coins} coins</span>`;
  const panel = sheet({
    title: 'Bag', sub, html: html(), wrap: 'center',
    handlers: {
      item: ({ id }) => {
        const it = ITEMS[id];
        if (it.kind === 'capsule') {
          if (!battle) { sfx('error'); flash(panel, 'Capsules are thrown at wild pets in battle.'); return; }
          if (!battle.wild) { sfx('error'); flash(panel, 'You can\'t catch another tamer\'s pet!'); return; }
          panel.close(true);
          battle.onAction({ type: 'catch', item: id });
          return;
        }
        const target = partyPanel(state, {
          mode: 'target', title: it.name, sub: 'Use it on which pet?', activeIdx: battle ? battle.activeIdx : -1,
          onPick: (i) => {
            const why = itemProblem(state.bag, id, state.party[i]);
            if (why) { sfx('error'); flash(panel, why); return; }
            if (battle) { panel.close(true); battle.onAction({ type: 'item', item: id, target: i }); return; }
            state.bag[id] -= 1;
            const msg = applyItem(id, state.party[i]);
            sfx('power');
            panel.set('scroll', html());
            flash(panel, msg);
            onChange?.();
          },
        });
        return target;
      },
    },
  });
  return panel;
}

function flash(panel, msg) {
  panel.set('sub', `<span style="color:#f0d472">${esc(msg)}</span>`);
}

// ---------------------------------------------------------------- shop

export function shopPanel(state, stock, name, { onChange } = {}) {
  const ids = G.shopStock(state, stock);
  const html = () => ids.map((id) => {
    const it = ITEMS[id];
    return `<div class="pp-row off">
      <img class="pp-item" alt="" src="${URLS.items[id]}">
      <div class="grow"><div class="line"><span class="name">${esc(it.name)}</span><span class="meta">${it.price}c</span></div>
      <div class="meta" style="white-space:normal">${esc(it.desc)} You have ${state.bag[id] || 0}.</div></div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="pp-btn small gold" data-act="buy" data-id="${id}" data-n="1" ${state.coins < it.price ? 'disabled' : ''}>Buy 1</button>
        <button class="pp-btn small" data-act="buy" data-id="${id}" data-n="5" ${state.coins < it.price * 5 ? 'disabled' : ''}>Buy 5</button>
      </div></div>`;
  }).join('') + (ids.length < 9 ? '<p class="pp-p" style="color:#c9d3ab">More goods arrive as you earn badges.</p>' : '');
  const sub = () => `<span class="pp-coins">${state.coins} coins</span>`;
  const panel = sheet({
    title: name, sub: sub(), html: html(), wrap: 'center',
    handlers: {
      buy: ({ id, n }) => {
        const why = G.buy(state, id, Number(n));
        if (why) { sfx('error'); return; }
        sfx('coin');
        panel.set('scroll', html());
        panel.set('sub', sub());
        onChange?.();
      },
    },
  });
  return panel;
}

// ---------------------------------------------------------------- dex

export function dexPanel(state) {
  const c = G.dexCounts(state);
  const html = `${wheelHtml()}
    <div class="pp-dex">${DEX_ORDER.map((sp, i) => {
    const caught = state.dex.caught[sp]; const seen = state.dex.seen[sp];
    const cls = caught ? 'caught' : seen ? 'seen' : 'unseen';
    const name = seen ? SPECIES[sp].name : '???';
    return `<button class="${cls}" data-act="entry" data-sp="${sp}">
      <div class="pp-pic">${seen ? `<img alt="" src="${URLS.pets[sp]}">` : ''}</div><span>${String(i + 1).padStart(2, '0')} ${esc(name)}</span></button>`;
  }).join('')}</div>`;
  return sheet({
    title: 'PetDex', sub: `Caught ${c.caught} &middot; Seen ${c.seen} &middot; of ${c.total}`, html, wrap: 'center',
    handlers: {
      entry: ({ sp }) => {
        const seen = state.dex.seen[sp]; const caught = state.dex.caught[sp];
        const s = SPECIES[sp];
        if (!seen) { sfx('error'); return; }
        const t = s.type;
        const strong = WHEEL.filter((d) => typeMult(t, d) > 1).map((d) => TYPE_INFO[d].name);
        const weak = WHEEL.filter((a) => typeMult(a, t) > 1).map((a) => TYPE_INFO[a].name);
        const body = `<div style="display:flex;gap:12px;align-items:center;margin-bottom:8px">${pic(sp, true)}
          <div>${typeTag(t)}<div style="margin-top:6px;color:#c9d3ab">${caught ? 'Caught' : 'Seen only'}</div></div></div>
          <p class="pp-p">${caught ? esc(s.dex) : 'Catch one to learn more about it.'}</p>
          <p class="pp-p" style="color:#c9d3ab">${strong.length ? `Strong against ${strong.join(', ')}.` : 'No type strengths.'} ${weak.length ? `Weak to ${weak.join(', ')}.` : 'No type weaknesses.'}</p>
          ${s.evo ? `<p class="pp-p" style="color:#c9d3ab">Evolves at level ${s.evo[1]}.</p>` : ''}`;
        sheet({ title: s.name, html: body, wrap: 'center' });
      },
    },
  });
}

// ---------------------------------------------------------------- box

export function boxPanel(state, { onChange } = {}) {
  let tab = 'party';
  const html = () => {
    if (tab === 'party') {
      return state.party.map((p, i) => petRow(p, { act: 'dep', idx: i, note: 'Tap to put in the box' })).join('');
    }
    if (!state.box.length) return '<p class="pp-p">The Pet Box is empty. When your party is full, new catches are sent here.</p>';
    return state.box.map((p, i) => petRow(p, { act: 'wd', idx: i, note: 'Tap to take with you' })).join('');
  };
  const tabs = () => `<div class="pp-tabs"><button class="pp-btn ${tab === 'party' ? 'on' : ''}" data-act="tab" data-t="party">Party (${state.party.length}/6)</button><button class="pp-btn ${tab === 'box' ? 'on' : ''}" data-act="tab" data-t="box">Box (${state.box.length})</button></div>`;
  const panel = sheet({
    title: 'Pet Box', sub: tabs(), html: html(), wrap: 'center',
    handlers: {
      tab: ({ t }) => { tab = t; panel.set('sub', tabs()); panel.set('scroll', html()); },
      dep: ({ idx }) => {
        const why = G.depositPet(state, Number(idx));
        if (why) { sfx('error'); panel.set('sub', `${tabs()}<span style="color:#f0d472">${why}</span>`); return; }
        panel.set('sub', tabs()); panel.set('scroll', html()); onChange?.();
      },
      wd: ({ idx }) => {
        const why = G.withdrawPet(state, Number(idx));
        if (why) { sfx('error'); panel.set('sub', `${tabs()}<span style="color:#f0d472">${why}</span>`); return; }
        panel.set('sub', tabs()); panel.set('scroll', html()); onChange?.();
      },
    },
  });
  return panel;
}

// ---------------------------------------------------------------- learn a move

/** Ask which move to forget so `pet` can learn `move`. cb(slot) with slot null = don't learn. */
export function learnPanel(pet, move, cb) {
  const html = `<p class="pp-p">${esc(petName(pet))} wants to learn <b style="font-weight:normal;color:#f0d472">${esc(MOVES[move].name)}</b>, but it already knows four moves.</p>
    ${moveRow(move)}
    <h3 class="pp-h3">Forget which move?</h3>
    ${pet.moves.map((m, i) => `<button class="pp-row" data-act="forget" data-i="${i}" style="display:block;padding:0;border:0;background:none">${moveRow(m.id, m.pp)}</button>`).join('')}`;
  const panel = sheet({
    title: 'New move', html, noX: true, wrap: 'center',
    foot: '<button class="pp-btn" data-act="skip">Don\'t learn it</button>',
    handlers: {
      forget: ({ i }) => { panel.close(true); cb(Number(i)); },
      skip: () => { panel.close(true); cb(null); },
    },
  });
  return panel;
}

// ---------------------------------------------------------------- nicknames

/** Ask for a nickname. cb(name) after OK or skip. */
export function nicknamePanel(pet, cb, { title = 'Nickname' } = {}) {
  const sp = SPECIES[pet.sp].name;
  const html = `<div style="display:flex;gap:12px;align-items:center;margin-bottom:10px">${pic(pet.sp)}
      <p class="pp-p" style="margin:0">Give ${esc(petName(pet))} a nickname? Leave it blank to keep "${esc(sp)}".</p></div>
    <input class="pp-input" type="text" maxlength="${NICK_MAX}" autocomplete="off" autocapitalize="words" spellcheck="false"
      value="${esc(pet.nick || '')}" placeholder="${esc(sp)}" aria-label="Nickname">`;
  const done = (name) => { const n = setNick(pet, name); panel.close(true); sfx('select'); cb(n); };
  const panel = sheet({
    title, html, noX: true, wrap: 'center',
    foot: '<button class="pp-btn gold" data-act="ok">OK</button><button class="pp-btn" data-act="skip">No thanks</button>',
    handlers: {
      ok: () => done(panel.el.querySelector('input').value),
      skip: () => { panel.close(true); cb(petName(pet)); },
    },
  });
  const input = panel.el.querySelector('input');
  for (const t of ['keydown', 'keyup', 'keypress']) input.addEventListener(t, (e) => { e.stopPropagation(); if (t === 'keydown' && e.key === 'Enter') done(input.value); });
  return panel;
}

// ---------------------------------------------------------------- tips

/** A one-off tip card. lines: strings (may hold the type wheel via wheel: true). */
export function tipPanel(title, lines, cb, { wheel = false } = {}) {
  const html = `${wheel ? wheelHtml() : ''}${lines.map((l) => `<p class="pp-p">${esc(l)}</p>`).join('')}`;
  const panel = sheet({
    title, html, noX: true, wrap: 'center',
    foot: '<button class="pp-btn gold" data-act="ok">Got it</button>',
    handlers: { ok: () => { panel.close(true); cb?.(); } },
  });
  return panel;
}

// HTML sheets for Star Drifter: events, stores, rewards, the ship screen and records.
// Lists and long text read better as HTML; every sheet stops touches from reaching the canvas.
import { sfx } from '../../../shared/core/sfx.js';
import { showHowTo } from '../../../shared/core/howto.js';
import { SHEETS } from '../frames.js';
import { RULES } from '../rules.js';
import { SYSTEMS, SYSTEM_ORDER, WEAPONS, DRONES, SPECIES, SKILLS, SKILL_NAMES, weaponText, REACTOR_MAX } from '../logic/data.js';
import { EVENTS, visibleChoices } from '../logic/events.js';
import * as R from '../logic/run.js';
import { aliveCrew, skillLevel, placeCrew, occupancy, capacity, power as sysPower } from '../logic/ship.js';

const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let open = [];
let lastClose = 0;
/** True while a sheet is open or was closed a moment ago (so the closing tap can't reach the canvas). */
export const blocking = () => open.length > 0 || Date.now() - lastClose < 300;
export const anyOpen = () => open.length > 0;
export function closeAll() { [...open].forEach((p) => p.close(true)); }

const SIZES = { ts: [72, 296], ch: [48, 208], it: [48, 48], f2: [16, 88] };
/** A 32px icon from a sheet as an inline element ('it:3,2'). */
export function ico(ref, title = '') {
  const [key, f] = ref.split(':');
  const [c, r] = f.split(',').map(Number);
  const [w, h] = SIZES[key];
  return `<i class="sd-ico" aria-hidden="true" title="${esc(title)}" style="background-image:url(${SHEETS[key]});background-size:${w * 4}px ${h * 4}px;background-position:-${c * 32}px -${(8 + r * 8) * 4}px"></i>`;
}
const crewIco = (c) => ico(`ch:0,${(c.sprite - 8) / 8}`, c.name);

function pips(n, max, extra = 0) {
  let h = '';
  for (let i = 0; i < max; i++) h += `<i class="${i < n ? 'on' : i < n + extra ? 'new' : ''}"></i>`;
  return `<span class="sd-pips">${h}</span>`;
}

/**
 * A sheet: { title, big, sub, html, foot, handlers, onClose, tall, left: [label, act] | null }.
 * data-act="x" buttons call handlers[x](dataset). The gold ? is always there.
 */
export function sheet({ title, big = false, sub = '', html = '', foot = '', handlers = {}, onClose, tall = false, left = null, dim = true }) {
  const el = document.createElement('div');
  el.className = 'sd-wrap';
  if (!dim) el.style.background = 'transparent';
  el.innerHTML = `
    <div class="sd-sheet ${tall ? 'tall' : ''}" role="dialog" aria-label="${esc(title)}">
      <div class="sd-head">
        ${left ? `<button class="sd-icon-btn" data-act="${left[1]}">${esc(left[0])}</button>` : '<span style="width:44px"></span>'}
        <h2 class="${big ? 'big' : ''}">${esc(title)}</h2>
        <button class="sd-icon-btn help" data-act="__help" aria-label="How to play">?</button>
      </div>
      <div class="sd-sub">${sub}</div>
      <div class="sd-scroll">${html}</div>
      <div class="sd-foot">${foot}</div>
    </div>`;
  const p = {
    el,
    busy: false,
    close(silent) {
      if (!el.isConnected) return;
      el.remove();
      open = open.filter((x) => x !== p);
      lastClose = Date.now();
      if (!silent) sfx('tap');
      onClose?.();
    },
    last: {},
    /** Replace a part's HTML (kept if unchanged, scroll position kept). */
    set(part, h) {
      if (p.last[part] === h) return;
      const n = el.querySelector(`.sd-${part}`);
      if (!n) return;
      const top = n.scrollTop;
      n.innerHTML = h;
      n.scrollTop = top;
      p.last[part] = h;
    },
  };
  p.last = { sub, scroll: html, foot };
  let lastAct = 0;
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled || p.busy) return;
    // A quick double tap only counts once (the first tap may have rebuilt the sheet under the finger).
    if (Date.now() - lastAct < 250) return;
    lastAct = Date.now();
    const act = b.dataset.act;
    if (act === '__help') { sfx('tap'); showHowTo(RULES); return; }
    handlers[act]?.(b.dataset, b);
  });
  for (const t of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'wheel']) el.addEventListener(t, (e) => e.stopPropagation());
  document.body.appendChild(el);
  open.push(p);
  return p;
}

/** Plain message sheet with buttons [[label, cls, fn]]. */
export function message(title, body, buttons) {
  const handlers = {};
  const foot = buttons.map(([label, cls], i) => { return `<button class="sd-btn ${cls || ''}" data-act="b${i}">${esc(label)}</button>`; }).join('');
  let p;
  buttons.forEach(([, , fn], i) => { handlers[`b${i}`] = () => { if (p.busy) return; p.busy = true; p.close(true); fn?.(); }; });
  p = sheet({ title, html: `<p class="sd-p">${esc(body).replace(/\n/g, '<br>')}</p>`, foot, handlers });
  return p;
}

const resBar = (run) => `<div class="sd-res"><span>Scrap <b>${run.scrap}</b></span><span>Fuel <b>${run.fuel}</b></span><span>Missiles <b>${run.ship.missiles}</b></span><span>Parts <b>${run.ship.droneParts}</b></span><span>Hull <b>${run.ship.hull}/${run.ship.maxHull}</b></span></div>`;

// ---------------------------------------------------------------- events

/** ctx: { save(), next() (route to whatever screen the run is on now), menu() } */
export function showEvent(run, ctx) {
  const e = run.event;
  const ev = EVENTS[e.id];
  let p;
  const render = () => {
    const ev2 = EVENTS[run.event.id];
    if (run.event.stage === 'choose') {
      const choices = visibleChoices(run, ev2).map(({ c, i, block }) => {
        const tag = c.req ? `<span class="sd-tag blue">${esc(reqLabel(c.req))}</span>` : '';
        return `<button class="sd-btn sd-choice ${c.req ? 'blue' : ''}" data-act="choose" data-i="${i}" ${block ? 'disabled' : ''}>${tag}${esc(c.text.replace(/^\([^)]*\)\s*/, ''))}${block ? `<small>${esc(block)}</small>` : ''}</button>`;
      }).join('');
      return { html: `<p class="sd-p">${esc(ev2.text)}</p>${choices}`, foot: '' };
    }
    const r = run.event;
    const lines = r.lines.length ? `<ul class="sd-lines">${r.lines.map((l) => `<li class="${/^-|hurt|gone/.test(l) ? 'bad' : ''}">${esc(l)}</li>`).join('')}</ul>` : '';
    const label = r.fight ? 'Battle stations!' : r.store ? 'Browse the market' : 'Continue';
    return { html: `<p class="sd-p dim">${esc(ev2.choices[r.choice].text.replace(/^\([^)]*\)\s*/, ''))}</p><p class="sd-p">${esc(r.text)}</p>${lines}`, foot: `<button class="sd-btn ${r.fight ? 'red' : 'gold'}" data-act="cont">${label}</button>` };
  };
  const first = render();
  p = sheet({
    title: ev.title, sub: resBar(run), html: first.html, foot: first.foot, left: ['Menu', 'menu'],
    handlers: {
      menu: () => ctx.menu(),
      choose: ({ i }) => {
        if (!R.chooseEvent(run, +i)) return;
        sfx(run.event.fight ? 'thud' : 'select');
        ctx.save();
        const r = render();
        p.set('sub', resBar(run)); p.set('scroll', r.html); p.set('foot', r.foot);
        p.el.querySelector('.sd-scroll').scrollTop = 0;
      },
      cont: () => {
        if (p.busy) return;
        p.busy = true;
        sfx('tap');
        R.continueEvent(run);
        ctx.save();
        p.close(true);
        ctx.next();
      },
    },
  });
  return p;
}

function reqLabel(r) {
  if (r.species) return SPECIES[r.species].name;
  if (r.sys) return `${SYSTEMS[r.sys].name} ${r.lvl}`;
  if (r.weaponType) return `${r.weaponType[0].toUpperCase()}${r.weaponType.slice(1)} weapon`;
  if (r.droneParts) return 'Drone part';
  if (r.fuel) return `${r.fuel} fuel`;
  return 'Special';
}

// ---------------------------------------------------------------- rewards

export function showReward(run, ctx) {
  const r = run.reward;
  const lines = r.lines.length ? `<ul class="sd-lines">${r.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : '<p class="sd-p dim">Nothing to collect.</p>';
  let p;
  p = sheet({
    title: r.title, html: `<p class="sd-p">${esc(r.text)}</p>${lines}`, sub: resBar(run),
    foot: '<button class="sd-btn gold" data-act="ok">Back to the map</button>', left: ['Menu', 'menu'],
    handlers: {
      menu: () => ctx.menu(),
      ok: () => { if (p.busy) return; p.busy = true; sfx('tap'); R.closeReward(run); ctx.save(); p.close(true); ctx.next(); },
    },
  });
  return p;
}

// ---------------------------------------------------------------- store

export function showStore(run, ctx) {
  let tab = 'buy';
  let note = ctx.firstVisit ? 'Tip: hull damage stays between fights. Repair it here, and keep some fuel for jumps.' : '';
  let p;
  const render = () => {
    const st = run.store;
    const tabs = `<div class="sd-tabs"><button class="sd-btn ${tab === 'buy' ? 'on' : ''}" data-act="tab" data-t="buy">Buy</button><button class="sd-btn ${tab === 'sell' ? 'on' : ''}" data-act="tab" data-t="sell">Sell</button></div>`;
    let html = '';
    if (tab === 'buy') {
      const res = [
        ['fuel', 'Fuel', 'Used for every jump', 'ts:2,0'],
        ['missiles', 'Missile', 'Ammo for missile weapons', 'f2:0,7'],
        ['droneParts', 'Drone part', 'Used when a drone launches', 'it:3,2'],
      ].map(([k, name, what, art]) => {
        const block = R.buyBlockRes(run, k);
        return `<div class="sd-row">${ico(art)}<div class="grow"><div class="name">${name} <span class="meta">(${st.stock[k]} left)</span></div><div class="meta">${what}</div></div><button class="sd-btn small gold" data-act="res" data-k="${k}" ${block ? 'disabled' : ''}>${st.prices[k]} scrap</button></div>`;
      }).join('');
      const hullBlock = R.buyBlockRes(run, 'hull');
      const need = run.ship.maxHull - run.ship.hull;
      const allCost = Math.min(need, Math.floor(run.scrap / st.prices.hull)) * st.prices.hull;
      const hull = `<div class="sd-row">${ico('it:3,4')}<div class="grow"><div class="name">Hull repair</div><div class="meta">${run.ship.hull}/${run.ship.maxHull}, ${st.prices.hull} scrap per point</div></div><button class="sd-btn small gold" data-act="res" data-k="hull" ${hullBlock ? 'disabled' : ''}>+1</button><button class="sd-btn small gold" data-act="repairAll" ${hullBlock ? 'disabled' : ''}>All<small>${allCost}</small></button></div>`;
      const items = st.items.map((it, i) => {
        const block = R.buyBlock(run, i);
        return `<div class="sd-row">${itemIcon(it)}<div class="grow"><div class="name">${esc(itemName(it))}</div><div class="meta">${esc(itemText(run, it))}</div></div><button class="sd-btn small ${it.sold ? '' : 'gold'}" data-act="item" data-i="${i}" ${block ? 'disabled' : ''}>${it.sold ? 'Sold' : `${it.price} scrap`}${block && !it.sold ? `<small>${esc(shortBlock(block))}</small>` : ''}</button></div>`;
      }).join('');
      html = `<div class="sd-h3">Supplies</div>${res}${hull}<div class="sd-h3">For sale</div>${items}`;
    } else {
      const rows = [];
      run.ship.weapons.forEach((w, i) => rows.push(sellRow(run, 'weapon', i, 'weapon', w.id, 'on the ship')));
      run.ship.drones.forEach((d, i) => rows.push(sellRow(run, 'drone', i, 'drone', d.id, 'on the ship')));
      run.cargo.forEach((c, i) => rows.push(sellRow(run, 'cargo', i, c.kind, c.id, 'in the cargo hold')));
      html = `<p class="sd-p dim">Sell weapons and drones for half what they cost.</p>${rows.join('')}`;
    }
    return { sub: `${resBar(run)}${tabs}${note ? `<div class="sd-sub" style="color:var(--sand)">${esc(note)}</div>` : ''}`, html };
  };
  const refresh = () => { const r = render(); p.set('sub', r.sub); p.set('scroll', r.html); };
  const r0 = render();
  p = sheet({
    title: 'Store', sub: r0.sub, html: r0.html, tall: true, left: ['Menu', 'menu'],
    foot: '<button class="sd-btn" data-act="ship">Ship</button><button class="sd-btn gold" data-act="leave">Leave store</button>',
    handlers: {
      menu: () => ctx.menu(),
      tab: ({ t }) => { sfx('tap'); tab = t; note = ''; refresh(); p.el.querySelector('.sd-scroll').scrollTop = 0; },
      res: ({ k }) => { if (R.buyRes(run, k)) { sfx('coin'); note = ''; ctx.save(); refresh(); } },
      repairAll: () => { const n = R.repairAll(run); if (n) { sfx('coin'); note = `Repaired ${n} hull.`; ctx.save(); refresh(); } },
      item: ({ i }) => { const msg = R.buyItem(run, +i); if (msg) { sfx('coin'); note = msg; ctx.save(); refresh(); } },
      sell: ({ w, i }) => { const v = R.sell(run, w, +i); if (v) { sfx('coin'); note = `Sold for ${v} scrap.`; ctx.save(); refresh(); } },
      ship: () => { sfx('tap'); showShip(run, { save: ctx.save, onClose: refresh }); },
      leave: () => { if (p.busy) return; p.busy = true; sfx('tap'); R.closeStore(run); ctx.save(); p.close(true); ctx.next(); },
    },
  });
  return p;
}

function sellRow(run, where, i, kind, id, place) {
  const block = R.sellBlock(run, where, i);
  const def = kind === 'weapon' ? WEAPONS[id] : DRONES[id];
  return `<div class="sd-row">${itemIcon({ kind, id })}<div class="grow"><div class="name">${esc(def.name)}</div><div class="meta">${place}</div></div><button class="sd-btn small" data-act="sell" data-w="${where}" data-i="${i}" ${block ? 'disabled' : ''}>Sell ${R.sellValue(kind, id)}${block ? `<small>${esc(shortBlock(block))}</small>` : ''}</button></div>`;
}

const shortBlock = (b) => ({ 'Not enough scrap': 'Need scrap', 'Keep at least one weapon': 'Last gun', 'Already installed': 'Have it', 'Needs a drone bay': 'No bay', 'Crew is full': 'Full', 'No room': 'No room' }[b] || b);

function itemName(it) {
  if (it.kind === 'weapon') return WEAPONS[it.id].name;
  if (it.kind === 'drone') return DRONES[it.id].name;
  if (it.kind === 'system') return `${SYSTEMS[it.id].name} (system)`;
  return `${SPECIES[it.id].name} crew member`;
}

function itemText(run, it) {
  if (it.kind === 'weapon') return weaponText(it.id).replace('\n', ' ');
  if (it.kind === 'drone') return `${DRONES[it.id].desc} ${DRONES[it.id].power} power.`;
  if (it.kind === 'system') return SYSTEMS[it.id].desc;
  return SPECIES[it.id].blurb;
}

function itemIcon(it) {
  if (it.kind === 'weapon') return ico(WEAPONS[it.id].type === 'missile' ? 'f2:0,7' : WEAPONS[it.id].type === 'ion' ? 'f2:0,1' : 'it:0,2');
  if (it.kind === 'drone') return ico('f2:0,3');
  if (it.kind === 'system') return ico(it.id === 'drones' ? 'f2:0,3' : 'it:1,3');
  return ico(`ch:0,${(SPECIES[it.id].sprites[0] - 8) / 8}`);
}

// ---------------------------------------------------------------- ship screen

/** 'Shields', or 'Hall A' for rooms without a working system. */
export function roomName(ship, r) {
  if (r.sys && ship.sys[r.sys]) return SYSTEMS[r.sys].name;
  const halls = ship.rooms.filter((x) => !(x.sys && ship.sys[x.sys]));
  return `Hall ${'ABCDEFGH'[halls.indexOf(r)] || ''}`;
}

const SYS_ICON = { shields: 'f2:0,1', engines: 'it:5,3', weapons: 'it:0,2', oxygen: 'it:4,2', medbay: 'it:1,3', drones: 'f2:0,3', piloting: 'ts:0,1', sensors: 'ts:1,0' };

/** Upgrades, crew stations and weapons/cargo. ctx: { save(), onClose() } */
export function showShip(run, ctx, startTab = 'systems') {
  let tab = startTab;
  let moving = null; // crew id choosing a new station
  let note = '';
  let p;
  const ship = run.ship;
  const render = () => {
    const tabs = `<div class="sd-tabs">${[['systems', 'Systems'], ['crew', 'Crew'], ['weapons', 'Weapons']].map(([t, l]) => `<button class="sd-btn ${tab === t ? 'on' : ''}" data-act="tab" data-t="${t}">${l}</button>`).join('')}</div>`;
    let html = '';
    if (tab === 'systems') {
      const cost = R.upgradeCost(run, 'reactor');
      const rb = R.upgradeBlock(run, 'reactor');
      html += `<div class="sd-row">${ico('f2:0,0')}<div class="grow"><div class="name">Reactor ${ship.reactor}/${REACTOR_MAX}</div><div class="meta">Total power to share between systems.</div></div><button class="sd-btn small ${rb ? '' : 'gold'}" data-act="up" data-s="reactor" ${rb ? 'disabled' : ''}>${cost === null ? 'Max' : `+1<small>${cost} scrap</small>`}</button></div>`;
      for (const id of SYSTEM_ORDER) {
        const s = ship.sys[id];
        const d = SYSTEMS[id];
        if (!s) { html += `<div class="sd-row">${ico(SYS_ICON[id])}<div class="grow"><div class="name">${d.name}</div><div class="meta">Not installed. Stores sometimes sell it.</div></div></div>`; continue; }
        const c = R.upgradeCost(run, id);
        const b = R.upgradeBlock(run, id);
        html += `<div class="sd-row">${ico(SYS_ICON[id])}<div class="grow"><div class="name">${d.name} ${pips(s.level, d.max)}</div><div class="meta">${esc(d.desc)}</div></div><button class="sd-btn small ${b ? '' : 'gold'}" data-act="up" data-s="${id}" ${b ? 'disabled' : ''}>${c === null ? 'Max' : `Lv ${s.level + 1}<small>${c} scrap</small>`}</button></div>`;
      }
    } else if (tab === 'crew') {
      html += '<p class="sd-p dim">Each crew member mans their station when a fight starts. Skills grow with practice.</p>';
      for (const c of aliveCrew(ship)) {
        const room = ship.rooms[c.room];
        const where = roomName(ship, room);
        const skills = SKILLS.map((k) => `${SKILL_NAMES[k]} ${'*'.repeat(skillLevel(c, k)) || '-'}`).join(', ');
        html += `<div class="sd-row">${crewIco(c)}<div class="grow"><div class="name">${esc(c.name)} <span class="meta">${SPECIES[c.species].name}, ${Math.ceil(c.hp)}/${c.maxHp}</span></div><div class="meta">${esc(skills)}</div></div><button class="sd-btn small" data-act="move" data-c="${c.id}">${esc(where)}</button></div>`;
        if (moving === c.id) {
          const opts = ship.rooms.map((r) => {
            const full = r.id !== c.room && occupancy(ship, r.id) >= capacity(r);
            const name = roomName(ship, r);
            return `<button class="sd-btn small ${r.id === c.room ? 'gold' : ''}" data-act="place" data-c="${c.id}" data-r="${r.id}" ${full ? 'disabled' : ''}>${esc(name)}</button>`;
          }).join('');
          html += `<div class="sd-foot" style="padding:4px 0 10px">${opts}</div>`;
        }
      }
      html += `<p class="sd-p dim">Skill stars: * trained, ** expert. ${esc(SPECIES.terran.name)}s learn 50% faster.</p>`;
    } else {
      const need = ship.weapons.reduce((a, w) => a + WEAPONS[w.id].power, 0);
      const lvl = ship.sys.weapons?.level || 0;
      html += `<p class="sd-p ${need > lvl ? '' : 'dim'}">Weapons system level ${lvl}; your weapons need ${need} power to all fire.${need > lvl ? ' Upgrade the weapons system to power them all.' : ''} The first weapons stay powered longest when the system is hit.</p>`;
      html += `<div class="sd-h3">Weapons (${ship.weapons.length}/${ship.weaponSlots} slots)</div>`;
      ship.weapons.forEach((w, i) => {
        const ub = R.unequipBlock(run, 'weapon', i);
        html += `<div class="sd-row">${itemIcon({ kind: 'weapon', id: w.id })}<div class="grow"><div class="name">${esc(WEAPONS[w.id].name)}</div><div class="meta">${esc(weaponText(w.id).split('\n')[0])}</div></div><button class="sd-btn small" data-act="mv" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">Up</button><button class="sd-btn small" data-act="unequip" data-k="weapon" data-i="${i}" ${ub ? 'disabled' : ''}>Stow</button></div>`;
      });
      html += `<div class="sd-h3">Drones (${ship.sys.drones ? `${ship.drones.length}/${ship.droneSlots}` : 'no drone bay'})</div>`;
      if (!ship.drones.length) html += '<p class="sd-p dim">None.</p>';
      ship.drones.forEach((d, i) => {
        const ub = R.unequipBlock(run, 'drone', i);
        html += `<div class="sd-row">${ico('f2:0,3')}<div class="grow"><div class="name">${esc(DRONES[d.id].name)}</div><div class="meta">${esc(DRONES[d.id].desc)} ${DRONES[d.id].power} power.</div></div><button class="sd-btn small" data-act="unequip" data-k="drone" data-i="${i}" ${ub ? 'disabled' : ''}>Stow</button></div>`;
      });
      html += `<div class="sd-h3">Cargo hold (${run.cargo.length}/${R.CARGO_MAX})</div>`;
      if (!run.cargo.length) html += '<p class="sd-p dim">Empty. Spare weapons and drones wait here.</p>';
      run.cargo.forEach((it, i) => {
        const eb = R.equipBlock(run, i);
        const def = it.kind === 'weapon' ? WEAPONS[it.id] : DRONES[it.id];
        html += `<div class="sd-row">${itemIcon(it)}<div class="grow"><div class="name">${esc(def.name)}</div><div class="meta">${esc(it.kind === 'weapon' ? weaponText(it.id).split('\n')[0] : def.desc)}</div></div><button class="sd-btn small gold" data-act="equip" data-i="${i}" ${eb ? 'disabled' : ''}>Fit${eb ? `<small>${esc(eb === 'Weapon slots full' || eb === 'Drone slots full' ? 'Slots full' : shortBlock(eb))}</small>` : ''}</button></div>`;
      });
    }
    return { sub: `${resBar(run)}${tabs}${note ? `<div class="sd-sub" style="color:var(--sand)">${esc(note)}</div>` : ''}`, html };
  };
  const refresh = () => { const r = render(); p.set('sub', r.sub); p.set('scroll', r.html); };
  const r0 = render();
  p = sheet({
    title: run.ship.name, sub: r0.sub, html: r0.html, tall: true, left: ['Back', 'close'],
    foot: '<button class="sd-btn gold" data-act="close">Done</button>',
    onClose: () => ctx.onClose?.(),
    handlers: {
      close: () => { if (p.busy) return; p.busy = true; p.close(); },
      tab: ({ t }) => { sfx('tap'); tab = t; moving = null; note = ''; refresh(); p.el.querySelector('.sd-scroll').scrollTop = 0; },
      up: ({ s }) => {
        if (!R.upgrade(run, s)) return;
        sfx('power');
        note = s === 'reactor' ? `Reactor now ${ship.reactor}.` : `${SYSTEMS[s].name} upgraded to level ${ship.sys[s].level}.`;
        ctx.save(); refresh();
      },
      move: ({ c }) => { sfx('tap'); moving = moving === +c ? null : +c; refresh(); },
      place: ({ c, r }) => {
        const cr = ship.crew.find((x) => x.id === +c);
        if (cr && placeCrew(ship, cr, +r)) { sfx('select'); moving = null; ctx.save(); refresh(); }
      },
      mv: ({ i, d }) => { if (R.moveWeapon(run, +i, +d)) { sfx('tap'); ctx.save(); refresh(); } },
      unequip: ({ k, i }) => { if (R.unequip(run, k, +i)) { sfx('tap'); note = 'Moved to the cargo hold.'; ctx.save(); refresh(); } },
      equip: ({ i }) => { if (R.equip(run, +i)) { sfx('select'); note = 'Fitted to the ship.'; ctx.save(); refresh(); } },
    },
  });
  return p;
}

export { sysPower };

// ---------------------------------------------------------------- new run & records

/** Pick a ship and a mode. opts: { unlocked(ship), onStart(ship, mode), existing } */
export function showNewRun(opts) {
  let ship = 'wayfarer';
  let mode = 'normal';
  let p;
  const ships = Object.entries(R.SHIPS);
  const render = () => {
    const shipRows = ships.map(([id, s]) => {
      const ok = opts.unlocked(id);
      return `<button class="sd-btn sd-choice ${ship === id ? 'gold' : ''}" data-act="ship" data-s="${id}" ${ok ? '' : 'disabled'}>${esc(s.name)}${ok ? '' : ' (locked)'}<small>${esc(ok ? s.blurb : 'Win a run to unlock this ship.')}</small></button>`;
    }).join('');
    const modes = [['normal', 'Normal', 'The full challenge.'], ['cruise', 'Cruise', 'More hull, scrap and fuel. Gentler enemies and a slower fleet.']]
      .map(([id, name, d]) => `<button class="sd-btn sd-choice ${mode === id ? 'gold' : ''}" data-act="mode" data-m="${id}">${name}<small>${esc(d)}</small></button>`).join('');
    const warn = opts.existing ? '<p class="sd-p" style="color:var(--orange)">Starting a new run ends the one in progress (it counts as a loss).</p>' : '';
    return `<div class="sd-h3">Ship</div>${shipRows}<div class="sd-h3">Mode</div>${modes}${warn}`;
  };
  p = sheet({
    title: 'New run', html: render(), left: ['Back', 'back'], tall: false,
    foot: '<button class="sd-btn gold" data-act="go">Launch</button>',
    handlers: {
      back: () => { if (p.busy) return; p.busy = true; p.close(); },
      ship: ({ s }) => { sfx('select'); ship = s; p.set('scroll', render()); },
      mode: ({ m }) => { sfx('select'); mode = m; p.set('scroll', render()); },
      go: () => { if (p.busy) return; p.busy = true; p.close(true); sfx('power'); opts.onStart(ship, mode); },
    },
  });
  return p;
}

export function showRecords(r, skills) {
  const last = r.last ? `<p class="sd-p">Last run: ${esc(R.SHIPS[r.last.ship]?.name || '')} (${r.last.mode}) ${r.last.won ? 'won!' : `fell in sector ${r.last.sector}`}. Score ${r.last.score}.</p>` : '';
  const html = `
    <div class="sd-row"><div class="grow">Runs played</div><b>${r.runs}</b></div>
    <div class="sd-row"><div class="grow">Wins (Normal / Cruise)</div><b>${r.wins.normal} / ${r.wins.cruise}</b></div>
    <div class="sd-row"><div class="grow">Best sector (Normal / Cruise)</div><b>${r.bestSector.normal} / ${r.bestSector.cruise}</b></div>
    <div class="sd-row"><div class="grow">Best score (Normal / Cruise)</div><b>${r.bestScore.normal} / ${r.bestScore.cruise}</b></div>
    <div class="sd-row"><div class="grow">Ships defeated</div><b>${r.ships}</b></div>
    <div class="sd-row"><div class="grow">Enemy captains (1-10, adapts to you)</div><b>${skills.normal} / ${skills.cruise}</b></div>
    ${last}`;
  let p;
  p = sheet({ title: 'Records', html, left: ['Back', 'back'], foot: '<button class="sd-btn gold" data-act="back">Close</button>', handlers: { back: () => { if (p.busy) return; p.busy = true; p.close(); } } });
  return p;
}

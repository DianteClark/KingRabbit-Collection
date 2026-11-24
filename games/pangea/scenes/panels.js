// HTML panels for Pangea: city, research, rivals, empire, battle odds, reports, offers, setup.
import { sfx, isMuted, setMuted } from '../../../shared/core/sfx.js';
import * as G from '../logic/game.js';
import {
  UNITS, BUILDINGS, WONDERS, WONDER_ICON, TECHS, TECH_LIST, ERAS, CIVS, COLORS, CIV_BY_ID,
  TERRAIN, FEATURES, RESOURCES,
} from '../logic/data.js';
import { ICONS, TECH_ICONS, UNIT_ICONS, AVATARS_URL } from '../art.js';
import '../pangea.css';

const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const bar = (v, cls = '') => `<div class="pg-bar ${cls}"><i style="width:${Math.max(0, Math.min(100, v))}%"></i></div>`;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
export const face = (avatar, small = false) => `<div class="pg-face ${small ? 'small' : ''}" style="background-image:url(${AVATARS_URL});background-position:-${avatar * (small ? 48 : 64)}px 0"></div>`;
const img = (url, big) => (url ? `<img class="pg-icon ${big ? 'big' : ''}" src="${url}" alt="">` : '<span class="pg-icon"></span>');
export const civColor = (s, c) => COLORS[s.civs[c].color].hex;

export function itemIcon(item) {
  if (item.kind === 'unit') return UNIT_ICONS[`${UNITS[item.id].art}Icon`];
  if (item.kind === 'bld') return ICONS[BUILDINGS[item.id].icon];
  return ICONS[WONDER_ICON[item.id]];
}
const itemName = (item) => G.itemDef(item).name;

let open = [];
let lastClose = 0;
/** True while a panel is open or was closed a moment ago (so the closing tap doesn't reach the map). */
export const blocking = () => open.length > 0 || Date.now() - lastClose < 300 || !!document.querySelector('.pg-cover') || !!document.getElementById('howto');
export function closeAll() { [...open].forEach((p) => p.close(true)); }
export const anyOpen = () => open.length > 0;

/**
 * A sheet. handlers: { act: (dataset, button) => ... } for [data-act] buttons.
 * Returns { el, close(), set(part, html) }.
 */
export function sheet({ title, small = false, sub = '', html = '', foot = '', wrap = '', cls = '', onClose, handlers = {}, noX = false }) {
  const el = document.createElement('div');
  el.className = `pg-wrap ${wrap}`;
  el.innerHTML = `
    <div class="pg-sheet ${cls}" role="dialog" aria-label="${esc(title)}">
      <div class="pg-head"><h2 class="${small || title.length > 14 ? 'small' : ''}">${esc(title)}</h2>${noX ? '' : '<button class="x" data-act="close" aria-label="Close">X</button>'}</div>
      <div class="pg-sub">${sub}</div>
      <div class="pg-scroll">${html}</div>
      <div class="pg-foot">${foot}</div>
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
    last: {},
    set(part, h) { if (p.last[part] === h) return; const n = el.querySelector(`.pg-${part}`); if (n) { n.innerHTML = h; p.last[part] = h; } },
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled) {
      // One action per tap: ignore a second click that lands within 250ms (double taps).
      if (Date.now() < busyUntil) return;
      busyUntil = Date.now() + 250;
      const act = b.dataset.act;
      if (act === 'close') { p.close(); return; }
      if (!b.dataset.silent) sfx('tap');
      handlers[act]?.(b.dataset, b);
      return;
    }
    if (e.target === el && !noX) p.close();
  });
  for (const t of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'wheel']) el.addEventListener(t, (e) => e.stopPropagation());
  document.body.appendChild(el);
  open.push(p);
  return p;
}

export function confirm({ title, text, yes = 'Yes', no = 'Cancel', yesCls = 'gold', onYes, onNo }) {
  const p = sheet({
    title, wrap: 'center', html: `<p class="pg-p">${text}</p>`,
    foot: `<button class="pg-btn ${yesCls}" data-act="yes">${esc(yes)}</button><button class="pg-btn" data-act="no">${esc(no)}</button>`,
    onClose: () => onNo?.(),
    handlers: { yes: () => { p.close(true); onYes?.(); }, no: () => { p.close(); } },
  });
  return p;
}

export function message(title, text, ok = 'OK', onOk) {
  const p = sheet({
    title, wrap: 'center', html: `<p class="pg-p">${text}</p>`,
    foot: `<button class="pg-btn gold" data-act="ok">${esc(ok)}</button>`, onClose: () => onOk?.(),
    handlers: { ok: () => p.close() },
  });
  return p;
}

// ---------------------------------------------------------------- city

function yieldLine(s, ct, y) {
  const need = G.growNeed(ct.pop);
  let grow;
  if (y.surplus < 0 || (y.food - y.eat < 0)) grow = '<span class="pg-tag bad">Starving</span>';
  else if (y.capped) grow = '<span class="pg-tag alert">Needs an Aqueduct</span>';
  else if (y.unhappy) grow = '<span class="pg-tag alert">Unhappy: not growing</span>';
  else if (y.surplus === 0) grow = 'Not growing';
  else grow = `Grows in ${plural(Math.max(1, Math.ceil((need - ct.food) / y.surplus)), 'turn')}`;
  return `<div class="pg-stats">
    <div><span>Food</span> ${y.food} (eat ${y.eat})</div><div>${grow}</div>
    <div><span>Production</span> ${y.prod}</div><div><span>Gold</span> ${y.gold}</div>
    <div><span>Science</span> ${y.sci}</div><div><span>Culture</span> ${y.culture}</div>
  </div>${bar(ct.food / need * 100, 'food')}`;
}

function cityHtml(g, ct) {
  const s = g.s;
  const y = G.cityYield(s, ct);
  const mine = ct.owner === g.me;
  if (!mine) {
    const def = G.militaryAt(s, ct.x, ct.y);
    return `<p class="pg-p">${esc(s.civs[ct.owner].name)} city, size ${ct.pop}.${ct.capital ? ' Their capital.' : ''}</p>
      <p class="pg-p">${def ? `Defended by a ${esc(UNITS[def.type].name)} (health ${def.hp}/10).` : 'No defender is in sight.'}${ct.blds.includes('walls') ? ' It has walls.' : ''}</p>
      ${ct.wonders.length ? `<p class="pg-p">Wonders: ${ct.wonders.map((w) => esc(WONDERS[w].name)).join(', ')}</p>` : ''}`;
  }
  const parts = [];
  if (g.coachText) parts.push(`<div class="pg-coach">${esc(g.coachText)}</div>`);
  parts.push(yieldLine(s, ct, y));
  parts.push('<h3 class="pg-h3">Focus</h3><div class="pg-chips two">');
  for (const [k, label] of Object.entries(G.FOCUS)) parts.push(`<button class="pg-btn ${ct.focus === k ? 'on' : ''}" data-act="focus" data-k="${k}">${label}</button>`);
  parts.push('</div>');
  // Queue.
  parts.push('<h3 class="pg-h3">Building</h3>');
  if (!ct.queue.length) parts.push('<p class="pg-p" style="color:var(--orange)">Nothing! Pick something below.</p>');
  let acc = 0;
  ct.queue.forEach((q, i) => {
    const cost = G.itemCost(q);
    const left = Math.max(0, cost - (i === 0 ? ct.prod : 0));
    acc += Math.ceil(left / Math.max(1, y.prod));
    const blocked = q.kind === 'unit' && UNITS[q.id].pop && ct.pop < 2;
    const buy = i === 0 ? G.buyCost(s, ct) : null;
    const canBuy = buy != null && s.civs[ct.owner].gold >= buy && !ct.bought && !blocked;
    parts.push(`<div class="pg-row">${img(itemIcon(q))}<div class="grow"><div class="name">${esc(itemName(q))}</div>
      <div class="meta">${i === 0 ? `${Math.min(ct.prod, cost)}/${cost}, ` : ''}${ct.bought && i === 0 ? 'bought, ready next turn' : plural(Math.max(1, acc), 'turn')}${blocked ? ' (waits for size 2)' : ''}</div>
      ${i === 0 ? bar(ct.prod / cost * 100) : ''}</div>
      ${i === 0 && buy != null && !ct.bought ? `<button class="pg-btn gold" data-act="buy" ${canBuy ? '' : 'disabled'}>Buy<small>${buy}g</small></button>` : ''}
      <button class="pg-btn red" data-act="remove" data-i="${i}" aria-label="Remove">X</button></div>`);
  });
  // Options.
  const opts = G.buildOptions(s, ct);
  const full = ct.queue.length >= 6;
  const group = (kind, label) => {
    const list = opts.filter((o) => o.kind === kind);
    if (!list.length) return;
    parts.push(`<h3 class="pg-h3">${label}</h3>`);
    for (const o of list) {
      const d = G.itemDef(o);
      const turns = Math.max(1, Math.ceil(d.cost / Math.max(1, y.prod)));
      let blurb = d.blurb || '';
      if (kind === 'unit' && !d.civ) blurb = `Strength ${d.str}, moves ${d.move}. ${blurb}`;
      if (kind === 'bld' && d.upkeep) blurb += `. Upkeep ${d.upkeep} gold`;
      parts.push(`<div class="pg-row tap" data-act="add" data-kind="${o.kind}" data-id="${o.id}">${img(itemIcon(o))}<div class="grow"><div class="name">${esc(d.name)} <span class="meta">${d.cost} (${plural(turns, 'turn')})</span></div><div class="meta">${esc(blurb)}</div></div><button class="pg-btn" data-act="add" data-kind="${o.kind}" data-id="${o.id}" ${full ? 'disabled' : ''}>Add</button></div>`);
    }
  };
  group('unit', 'Units');
  group('bld', 'Buildings');
  group('wonder', 'Wonders');
  if (full) parts.push('<p class="pg-p" style="color:var(--lavender)">The queue is full (6).</p>');
  // Built.
  if (ct.blds.length || ct.wonders.length) {
    parts.push('<h3 class="pg-h3">Built here</h3>');
    for (const b of ct.blds) parts.push(`<div class="pg-row">${img(ICONS[BUILDINGS[b].icon])}<div class="grow"><div class="name">${esc(BUILDINGS[b].name)}</div><div class="meta">${esc(BUILDINGS[b].blurb)}${BUILDINGS[b].upkeep ? `. Upkeep ${BUILDINGS[b].upkeep}` : ''}</div></div></div>`);
    for (const w of ct.wonders) parts.push(`<div class="pg-row">${img(ICONS[WONDER_ICON[w]])}<div class="grow"><div class="name">${esc(WONDERS[w].name)} <span class="pg-tag gold">Wonder</span></div><div class="meta">${esc(WONDERS[w].blurb)}</div></div></div>`);
  }
  return parts.join('');
}

function citySub(g, ct) {
  const s = g.s;
  const own = ct.owner === g.me;
  return `Size ${ct.pop}${ct.capital ? ' &middot; Capital' : ''}${own ? '' : ` &middot; ${esc(s.civs[ct.owner].name)}`}${own ? ` &middot; Gold ${s.civs[g.me].gold}` : ''}`;
}

export function showCity(g, cityId, { onClose } = {}) {
  closeAll();
  const s = g.s;
  const ct = G.cityById(s, cityId);
  if (!ct) return null;
  const mine = ct.owner === g.me;
  const mineCities = () => G.citiesOf(s, g.me);
  const p = sheet({
    title: ct.name, cls: mine ? 'tall' : '', wrap: mine ? '' : 'center',
    sub: citySub(g, ct), html: cityHtml(g, ct),
    foot: mine && mineCities().length > 1 ? '<button class="pg-btn" data-act="prev">&lt; Prev</button><button class="pg-btn" data-act="next">Next &gt;</button><button class="pg-btn gold" data-act="close">Done</button>' : '<button class="pg-btn gold" data-act="close">Done</button>',
    onClose: () => { g.changed(); onClose?.(); },
    handlers: {
      focus: ({ k }) => { ct.focus = k; refresh(); g.changed(); },
      add: ({ kind, id }) => {
        if (G.enqueue(s, ct, { kind, id })) { sfx('select'); refresh(); g.changed(); g.coachEvent?.('queued'); } else sfx('error');
      },
      remove: ({ i }) => { G.dequeue(s, ct, +i); refresh(); g.changed(); },
      buy: () => { if (G.buy(s, ct)) { sfx('coin'); refresh(); g.changed(); } else sfx('error'); },
      prev: () => cycle(-1),
      next: () => cycle(1),
    },
  });
  const refresh = () => {
    const c = G.cityById(s, cityId);
    if (!c || c.owner !== g.me) { p.set('scroll', cityHtml(g, ct)); return; }
    p.set('sub', citySub(g, c));
    const sc = p.el.querySelector('.pg-scroll');
    const top = sc.scrollTop;
    p.set('scroll', cityHtml(g, c));
    sc.scrollTop = top;
  };
  const cycle = (d) => {
    const list = mineCities();
    const i = list.findIndex((x) => x.id === cityId);
    const nx = list[(i + d + list.length) % list.length];
    p.close(true);
    g.centerOn(nx.x, nx.y);
    showCity(g, nx.id, { onClose });
  };
  return p;
}

// ---------------------------------------------------------------- research

function techHtml(g) {
  const s = g.s; const c = g.me; const cv = s.civs[c];
  const sci = G.civTotals(s, c).sci;
  const parts = [];
  if (g.coachText) parts.push(`<div class="pg-coach">${esc(g.coachText)}</div>`);
  if (cv.research) {
    const cost = G.techCost(s, cv.research);
    parts.push(`<div class="pg-row">${img(TECH_ICONS[TECHS[cv.research].icon], true)}<div class="grow"><div class="name">Studying ${esc(TECHS[cv.research].name)}</div><div class="meta">${Math.min(cv.progress, cost)}/${cost}, ${plural(G.turnsToResearch(s, c), 'turn')}${cv.goal ? `. Goal: ${esc(TECHS[cv.goal].name)}` : ''}</div>${bar(cv.progress / cost * 100, 'sci')}</div></div>`);
  } else parts.push('<p class="pg-p" style="color:var(--orange)">Pick a technology to study.</p>');
  parts.push(`<p class="pg-p" style="color:var(--lavender)">${cv.techs.length} of ${TECH_LIST.length} known. Tap a tech to study it; tap a locked one to set it as a goal.</p>`);
  ERAS.forEach((era, e) => {
    parts.push(`<h3 class="pg-era">${era} era</h3>`);
    for (const t of TECH_LIST.filter((x) => x.era === e)) {
      const have = cv.techs.includes(t.id);
      const avail = G.techAvailable(s, c, t.id);
      const now = cv.research === t.id;
      const goal = cv.goal === t.id;
      const turns = Math.max(1, Math.ceil(G.techCost(s, t.id) / Math.max(1, sci)));
      const missing = t.req.filter((r) => !cv.techs.includes(r)).map((r) => TECHS[r].name);
      const status = have ? '<span class="pg-tag good">Known</span>' : now ? '<span class="pg-tag gold">Studying</span>' : goal ? '<span class="pg-tag alert">Goal</span>' : avail ? `${plural(turns, 'turn')}` : `Needs ${esc(missing.join(', '))}`;
      parts.push(`<div class="pg-tech ${have ? 'have' : avail ? '' : 'locked'} ${now ? 'now' : ''} ${goal ? 'goal' : ''}" data-act="${have ? 'noop' : 'pick'}" data-t="${t.id}">${img(TECH_ICONS[t.icon])}<div class="grow"><div class="name">${esc(t.name)}</div><div class="meta">${esc(t.blurb)}</div><div class="meta">${status}</div></div></div>`);
    }
  });
  return parts.join('');
}

export function showTech(g, { onClose } = {}) {
  closeAll();
  const s = g.s;
  const sub = () => `Science +${G.civTotals(s, g.me).sci} a turn`;
  const p = sheet({
    title: 'Research', cls: 'tall', sub: sub(), html: techHtml(g),
    foot: '<button class="pg-btn gold" data-act="close">Done</button>',
    onClose: () => { g.changed(); onClose?.(); },
    handlers: {
      noop: () => {},
      pick: ({ t }) => {
        if (G.setResearch(s, g.me, t)) { sfx('select'); g.changed(); g.coachEvent?.('research'); }
        const sc = p.el.querySelector('.pg-scroll'); const top = sc.scrollTop;
        p.set('scroll', techHtml(g)); sc.scrollTop = top;
      },
    },
  });
  // Show the current era.
  requestAnimationFrame(() => { const now = p.el.querySelector('.pg-tech.now') || p.el.querySelector('.pg-tech:not(.have)'); if (now && !g.coachText) now.scrollIntoView({ block: 'center' }); });
  return p;
}

// ---------------------------------------------------------------- rivals and diplomacy

function rivalsHtml(g) {
  const s = g.s; const me = g.me;
  const myPow = G.militaryPower(s, me);
  const met = s.civs.filter((o) => o.id !== me && s.civs[me].met[o.id]);
  const parts = [];
  if (!met.length) parts.push('<p class="pg-p">You haven\'t met anyone yet. Explore with your units to find the other civilizations.</p>');
  for (const o of met) {
    if (!o.alive) {
      parts.push(`<div class="pg-row">${face(o.avatar, true)}<div class="grow"><div class="name">${esc(o.name)}</div><div class="meta">Destroyed</div></div></div>`);
      continue;
    }
    const r = G.rel(s, me, o.id);
    const att = o.human ? 'Player' : G.attitudeLabel(G.attitude(s, o.id, me));
    const pow = G.militaryPower(s, o.id);
    const army = pow > myPow * 1.3 ? 'stronger than yours' : pow < myPow * 0.75 ? 'weaker than yours' : 'about as strong as yours';
    const tags = [r.war ? '<span class="pg-tag bad">At war</span>' : '<span class="pg-tag good">Peace</span>'];
    if (r.pact) tags.push('<span class="pg-tag gold">Trade pact</span>');
    tags.push(`<span class="pg-tag">${att}</span>`);
    const btns = [];
    if (r.war) {
      const wait = G.PEACE_LOCK - (s.turn - r.since);
      btns.push(`<button class="pg-btn green" data-act="peace" data-c="${o.id}" ${wait > 0 ? 'disabled' : ''}>Propose peace${wait > 0 ? `<small>in ${plural(wait, 'turn')}</small>` : ''}</button>`);
    } else {
      btns.push(`<button class="pg-btn red" data-act="war" data-c="${o.id}">Declare war</button>`);
      btns.push(r.pact ? `<button class="pg-btn" data-act="unpact" data-c="${o.id}">End pact</button>` : `<button class="pg-btn gold" data-act="pact" data-c="${o.id}">Trade pact<small>+3 gold each</small></button>`);
      btns.push(`<button class="pg-btn" data-act="swap" data-c="${o.id}">Swap techs</button>`);
      btns.push(`<button class="pg-btn" data-act="gift" data-c="${o.id}" ${s.civs[me].gold < 25 ? 'disabled' : ''}>Gift<small>25 gold</small></button>`);
    }
    parts.push(`<div class="pg-row" style="flex-wrap:wrap">${face(o.avatar, true)}<div class="grow"><div class="name" style="color:${civColor(s, o.id)}">${esc(o.name)}</div><div class="meta">${esc(o.leader)}</div><div>${tags.join('')}</div>
      <div class="meta">${plural(G.citiesOf(s, o.id).length, 'city').replace('citys', 'cities')}, score ${G.score(s, o.id)}. Army ${army}.</div></div>
      <div class="pg-chips" style="width:100%">${btns.join('')}</div></div>`);
  }
  const unmet = s.civs.filter((o) => o.id !== me && !s.civs[me].met[o.id]).length;
  if (unmet) parts.push(`<p class="pg-p" style="color:var(--lavender)">${plural(unmet, 'civilization')} not met yet.</p>`);
  return parts.join('');
}

export function showRivals(g) {
  closeAll();
  const s = g.s; const me = g.me;
  const p = sheet({
    title: 'Rivals', cls: 'tall', sub: `Gold ${s.civs[me].gold}`, html: rivalsHtml(g),
    foot: '<button class="pg-btn gold" data-act="close">Done</button>',
    onClose: () => g.changed(),
    handlers: {
      war: ({ c }) => {
        const o = s.civs[+c];
        confirm({
          title: 'Declare war?', text: `Go to war with ${esc(o.name)}? Peace can't be signed for ${G.PEACE_LOCK} turns, and other civs will trust you less.`,
          yes: 'Declare war', yesCls: 'red',
          onYes: () => { G.declareWar(s, me, +c); sfx('error'); g.changed(); showRivals(g); },
          onNo: () => showRivals(g),
        });
      },
      peace: ({ c }) => {
        const o = s.civs[+c];
        if (o.human || G.acceptsPeace(s, +c, me)) { G.makePeace(s, me, +c); sfx('win'); g.changed(); reopen(`${esc(o.leader)} agrees. The war with ${esc(o.name)} is over.`); } else { sfx('error'); reopen(`${esc(o.leader)} refuses. ${esc(o.name)} wants to keep fighting.`); }
      },
      pact: ({ c }) => {
        const o = s.civs[+c];
        if (o.human || G.acceptsPact(s, +c, me)) { G.signPact(s, me, +c); sfx('coin'); g.changed(); reopen(`${esc(o.leader)} signs a trade pact: +3 gold a turn for both of you.`); } else { sfx('error'); reopen(`${esc(o.leader)} doesn't trust you enough for a pact. Gifts and time help.`); }
      },
      unpact: ({ c }) => { G.cancelPact(s, me, +c); g.changed(); showRivals(g); },
      gift: ({ c }) => { if (G.giftGold(s, me, +c, 25)) { sfx('coin'); g.changed(); reopen(`${esc(s.civs[+c].leader)} thanks you for the gift.`); } },
      swap: ({ c }) => { p.close(true); showSwap(g, +c); },
    },
  });
  const reopen = (msg) => { p.close(true); message('Diplomacy', msg, 'OK', () => showRivals(g)); };
  return p;
}

function showSwap(g, other) {
  const s = g.s; const me = g.me;
  const theirs = G.tradeableTechs(s, other, me);
  const mine = G.tradeableTechs(s, me, other);
  let get = theirs[0]; let give = mine[0];
  const html = () => {
    if (!theirs.length || !mine.length) {
      return `<p class="pg-p">${!theirs.length ? `${esc(s.civs[other].name)} knows nothing you don't.` : `You know nothing ${esc(s.civs[other].name)} doesn't.`}</p>`;
    }
    const row = (list, sel, act) => list.map((t) => `<div class="pg-tech ${t === sel ? 'now' : ''}" data-act="${act}" data-t="${t}">${img(TECH_ICONS[TECHS[t].icon])}<div class="grow"><div class="name">${esc(TECHS[t].name)}</div><div class="meta">${esc(TECHS[t].blurb)}</div></div></div>`).join('');
    return `<h3 class="pg-h3">You get</h3>${row(theirs, get, 'get')}<h3 class="pg-h3">You give</h3>${row(mine, give, 'give')}`;
  };
  const p = sheet({
    title: 'Swap techs', cls: 'tall', sub: `With ${esc(s.civs[other].name)}`, html: html(),
    foot: `${theirs.length && mine.length ? '<button class="pg-btn gold" data-act="offer">Offer the swap</button>' : ''}<button class="pg-btn" data-act="back">Back</button>`,
    onClose: () => g.changed(),
    handlers: {
      get: ({ t }) => { get = t; p.set('scroll', html()); },
      give: ({ t }) => { give = t; p.set('scroll', html()); },
      back: () => { p.close(true); showRivals(g); },
      offer: () => {
        const o = s.civs[other];
        p.close(true);
        if (o.human || G.acceptsSwap(s, other, me, get, give)) {
          G.swapTechs(s, me, other, give, get);
          sfx('power'); g.changed();
          message('Deal!', `You learned ${esc(TECHS[get].name)} and taught them ${esc(TECHS[give].name)}.`, 'OK', () => showRivals(g));
        } else {
          sfx('error');
          message('No deal', `${esc(o.leader)} won't trade ${esc(TECHS[get].name)} for ${esc(TECHS[give].name)}. Offer something worth more, or try when relations are better.`, 'OK', () => showSwap(g, other));
        }
      },
    },
  });
  return p;
}

// ---------------------------------------------------------------- empire

function empireHtml(g) {
  const s = g.s; const me = g.me; const cv = s.civs[me];
  const t = G.civTotals(s, me);
  const j = t.joy;
  const lux = G.luxuriesOf(s, me);
  const cities = G.citiesOf(s, me);
  const conq = G.conquestProgress(s, me);
  const arkOwner = s.wonders.ark;
  const known = s.civs.filter((o) => o.id === me || cv.met[o.id]).sort((a, b) => G.score(s, b.id) - G.score(s, a.id));
  const parts = [];
  parts.push(`<div class="pg-stats">
    <div><span>Turn</span> ${s.turn} of ${s.maxTurn}</div><div><span>Score</span> ${G.score(s, me)}</div>
    <div><span>Gold</span> ${cv.gold} (${t.net >= 0 ? '+' : ''}${t.net})</div><div><span>Science</span> +${t.sci}</div>
    <div><span>Happiness</span> ${j.net >= 0 ? '+' : ''}${j.net}</div><div><span>Era</span> ${G.eraName(s, me)}</div>
  </div>`);
  parts.push('<h3 class="pg-h3">Gold each turn</h3>');
  parts.push(`<div class="pg-stats"><div><span>Cities</span> +${t.gold}</div><div><span>Trade pacts</span> +${t.pact}</div><div><span>Buildings</span> -${G.buildingUpkeep(s, me)}</div><div><span>Units</span> -${G.unitUpkeep(s, me)}</div></div>`);
  parts.push('<h3 class="pg-h3">Happiness</h3>');
  parts.push(`<p class="pg-p">+${j.plus} from base ${G.BASE_JOY}, luxuries (${lux.length ? lux.map((r) => RESOURCES[r].name).join(', ') : 'none'}), buildings and wonders. -${j.minus} from ${plural(cities.length, 'city').replace('citys', 'cities')} and citizens.${j.net < 0 ? ' <span class="pg-tag bad">Cities have stopped growing</span>' : ''}</p>`);
  parts.push('<h3 class="pg-h3">Victory</h3>');
  parts.push(`<p class="pg-p">Conquest: you hold ${conq.done} of ${conq.of} rival capitals.<br>Science: ${arkOwner != null ? `${esc(s.civs[arkOwner].name)} launched the Space Ark` : cv.techs.includes('spaceflight') ? 'build the Space Ark in a city!' : 'research Spaceflight, then build the Space Ark.'}<br>Score: highest score on turn ${s.maxTurn} wins.</p>`);
  parts.push('<h3 class="pg-h3">Scores</h3>');
  for (const o of known) parts.push(`<div class="pg-row">${face(o.avatar, true)}<div class="grow"><div class="name" style="color:${civColor(s, o.id)}">${esc(o.name)}${o.id === me ? ' (you)' : ''}</div><div class="meta">${o.alive ? `${plural(G.citiesOf(s, o.id).length, 'city').replace('citys', 'cities')}, ${plural(o.techs.length, 'tech')}` : 'Destroyed'}</div></div><div class="name">${G.score(s, o.id)}</div></div>`);
  parts.push('<h3 class="pg-h3">Your cities</h3>');
  if (!cities.length) parts.push('<p class="pg-p">No cities yet. Use a Settler to found one.</p>');
  for (const ct of cities) {
    const q = ct.queue[0];
    parts.push(`<div class="pg-row tap" data-act="city" data-id="${ct.id}"><div class="grow"><div class="name">${esc(ct.name)} (${ct.pop})${ct.capital ? ' <span class="pg-tag">Capital</span>' : ''}</div><div class="meta">${q ? `${esc(itemName(q))}, ${plural(G.turnsToBuild(s, ct), 'turn')}` : '<span style="color:var(--orange)">Nothing to build</span>'}</div></div><button class="pg-btn" data-act="city" data-id="${ct.id}">Open</button></div>`);
  }
  return parts.join('');
}

export function showEmpire(g) {
  closeAll();
  const p = sheet({
    title: 'Empire', cls: 'tall', sub: `${esc(g.s.civs[g.me].name)}, led by ${esc(g.s.civs[g.me].leader)}`, html: empireHtml(g),
    foot: `<button class="pg-btn" data-act="sound">${isMuted() ? 'Sound: off' : 'Sound: on'}</button><button class="pg-btn" data-act="menu">Main menu</button><button class="pg-btn gold" data-act="close">Done</button>`,
    onClose: () => g.changed(),
    handlers: {
      city: ({ id }) => { const ct = G.cityById(g.s, +id); p.close(true); g.centerOn(ct.x, ct.y); showCity(g, +id); },
      sound: (_d, b) => { setMuted(!isMuted()); b.textContent = isMuted() ? 'Sound: off' : 'Sound: on'; },
      menu: () => { p.close(true); g.leave(); },
    },
  });
  return p;
}

// ---------------------------------------------------------------- battle odds

const modText = (mods) => (mods.length ? mods.map(([n, v]) => `${esc(n)} ${v > 0 ? '+' : ''}${v}%`).join(', ') : 'no bonuses');

export function showForecast(g, u, info, onGo) {
  closeAll();
  const s = g.s;
  const owner = s.civs[info.owner];
  const warLine = info.needsWar ? `<p class="pg-p"><span class="pg-tag bad">War</span> You are at peace with ${esc(owner.name)}. This declares war!</p>` : '';
  let title; let html; let btn;
  if (info.kind === 'capture') {
    title = info.city ? `Take ${info.city.name}?` : 'Capture?';
    html = `${warLine}<p class="pg-p">${info.city ? `${esc(info.city.name)} has no defender. March in and it is yours.` : `The ${esc(UNITS[info.civil.type].name)} is alone. Your ${esc(UNITS[u.type].name)} can capture it${info.civil.type === 'settler' ? ' (it becomes a Worker)' : ''}.`}</p>`;
    btn = info.city ? 'Capture city' : 'Capture';
  } else {
    const pct = Math.round(info.win * 100);
    const color = pct >= 70 ? 'var(--leaf)' : pct >= 45 ? 'var(--gold)' : 'var(--red)';
    title = 'Attack?';
    html = `${warLine}
      <div class="pg-row">${img(UNIT_ICONS[`${UNITS[u.type].art}Icon`])}<div class="grow"><div class="name">Your ${esc(UNITS[u.type].name)}</div><div class="meta">Strength ${UNITS[u.type].str} &rarr; ${info.A.toFixed(1)}, health ${u.hp}/10</div><div class="meta">${modText(info.aMods)}</div></div></div>
      <div class="pg-row">${img(UNIT_ICONS[`${UNITS[info.def.type].art}Icon`])}<div class="grow"><div class="name" style="color:${civColor(s, info.owner)}">${esc(owner.name)} ${esc(UNITS[info.def.type].name)}</div><div class="meta">Strength ${UNITS[info.def.type].str} &rarr; ${info.D.toFixed(1)}, health ${info.def.hp}/10</div><div class="meta">${modText(info.dMods)}</div></div></div>
      <div class="pg-big" style="color:${color}">Win ${pct}%</div>
      <p class="pg-p pg-center" style="color:var(--lavender)">The loser is destroyed.${info.city ? ' Beat the last defender, then walk in to take the city.' : ''}</p>`;
    btn = 'Attack';
  }
  const p = sheet({
    title, wrap: 'center', html,
    foot: `<button class="pg-btn red" data-act="go" data-silent="1">${btn}</button><button class="pg-btn" data-act="close">Cancel</button>`,
    handlers: { go: () => { p.close(true); onGo(); } },
  });
  return p;
}

// ---------------------------------------------------------------- reports, offers, hand-off, game over

export function showReport(g, lines, onClose) {
  closeAll();
  const p = sheet({
    title: `Turn ${g.s.turn}`, wrap: 'center',
    html: `<ul style="margin:0;padding-left:18px">${lines.map((l) => `<li class="pg-p" style="color:${l.color || 'var(--cream)'}">${esc(l.text)}</li>`).join('')}</ul>`,
    foot: '<button class="pg-btn gold" data-act="close">OK</button>',
    onClose,
  });
  return p;
}

export function showOffer(g, offer, onAnswer) {
  closeAll();
  const s = g.s; const o = s.civs[offer.from];
  const text = offer.kind === 'peace' ? `${o.leader} of ${o.name} offers to end the war.` : `${o.leader} of ${o.name} offers a trade pact: +3 gold a turn for both of you.`;
  const p = sheet({
    title: offer.kind === 'peace' ? 'Peace offer' : 'Trade pact', wrap: 'center', noX: true,
    html: `<div class="pg-row">${face(o.avatar)}<div class="grow"><p class="pg-p">${esc(text)}</p></div></div>`,
    foot: '<button class="pg-btn gold" data-act="yes">Accept</button><button class="pg-btn" data-act="no">Refuse</button>',
    handlers: { yes: () => { p.close(true); onAnswer(true); }, no: () => { p.close(true); onAnswer(false); } },
  });
  return p;
}

export function showHandoff(s, c, onReady) {
  document.querySelector('.pg-cover')?.remove();
  const cv = s.civs[c];
  const el = document.createElement('div');
  el.className = 'pg-cover';
  el.innerHTML = `${face(cv.avatar)}<div style="font-size:32px;color:${COLORS[cv.color].hex}">${esc(cv.name)}</div>
    <div>Turn ${s.turn}. Pass the phone to the ${esc(cv.name)} player.</div>
    <button class="pg-btn gold" type="button">I'm ready</button>`;
  for (const t of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend']) el.addEventListener(t, (e) => e.stopPropagation());
  let done = false;
  el.querySelector('button').addEventListener('click', () => {
    if (done) return;
    done = true;
    sfx('select');
    el.remove();
    lastClose = Date.now();
    onReady();
  });
  document.body.appendChild(el);
}

export function showGameOver(g, { won, title, text, onNew, onMenu, onLook }) {
  closeAll();
  const s = g.s;
  const rows = s.civs.slice().sort((a, b) => G.score(s, b.id) - G.score(s, a.id)).map((o) => `<div class="pg-row">${face(o.avatar, true)}<div class="grow"><div class="name" style="color:${civColor(s, o.id)}">${esc(o.name)}${o.human ? ' (player)' : ''}</div><div class="meta">${o.alive ? `${plural(G.citiesOf(s, o.id).length, 'city').replace('citys', 'cities')}, ${plural(o.techs.length, 'tech')}` : 'Destroyed'}</div></div><div class="name">${G.score(s, o.id)}</div></div>`).join('');
  const p = sheet({
    title, wrap: 'center', noX: true,
    html: `<p class="pg-p">${esc(text)}</p><h3 class="pg-h3">Final scores</h3>${rows}`,
    foot: `<button class="pg-btn gold" data-act="new">New game</button><button class="pg-btn" data-act="menu">Menu</button><button class="pg-btn" data-act="look">See map</button>`,
    handlers: { new: () => { p.close(true); onNew(); }, menu: () => { p.close(true); onMenu(); }, look: () => { p.close(true); onLook(); } },
  });
  sfx(won ? 'win' : 'lose');
  return p;
}

// ---------------------------------------------------------------- tile info (text for the bottom bar)

export function tileText(s, x, y) {
  const t = G.tileAt(s, x, y);
  const name = t.f ? `${FEATURES[t.f].name}${t.t !== 'grass' ? ` (${TERRAIN[t.t].name})` : ''}` : TERRAIN[t.t].name;
  const yv = G.tileValue(s, null, G.idx(s, x, y));
  const parts = [`${name}${t.r ? `, ${RESOURCES[t.r].name}` : ''}${t.imp ? `, ${t.imp === 'farm' ? 'Farm' : 'Mine'}` : ''}`];
  parts.push(t.f === 'mountain' ? 'Impassable' : `Food ${yv[0]}  Prod ${yv[1]}  Gold ${yv[2]}`);
  return parts;
}

// ---------------------------------------------------------------- setup (menu)

export function showSetup({ mode, skillText, onStart, onClose }) {
  closeAll();
  const hot = mode === 'hotseat';
  const st = {
    civ: CIVS[Math.floor(Math.random() * CIVS.length)].id, size: 'small', rivals: 3, length: 150,
    players: 2, cpus: 1, picks: [],
  };
  const pickFree = (taken) => CIVS.find((c) => !taken.includes(c.id)).id;
  const ensurePicks = () => {
    while (st.picks.length < st.players) st.picks.push(pickFree(st.picks));
    st.picks.length = st.players;
  };
  ensurePicks();
  const chips = (act, opts, cur) => `<div class="pg-chips">${opts.map(([v, l]) => `<button class="pg-btn ${v === cur ? 'on' : ''}" data-act="${act}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const html = () => {
    const parts = [];
    if (!hot) {
      const c = CIV_BY_ID[st.civ];
      parts.push(`<div class="pg-row">${face(c.avatar)}<div class="grow"><div class="name" style="font-size:32px;line-height:1.1">${esc(c.name)}</div><div class="meta">${esc(c.leader)}</div><div class="meta">${c.war > 0.6 ? 'Warlike' : c.sci > 0.6 ? 'Scholarly' : c.grow > 0.65 ? 'Expansive' : 'Balanced'} (rivals' personalities differ)</div></div></div>`);
      parts.push('<h3 class="pg-h3">Your civilization</h3><div class="pg-grid">');
      for (const cv of CIVS) parts.push(`<button class="pick ${cv.id === st.civ ? 'on' : ''}" data-act="civ" data-v="${cv.id}">${face(cv.avatar, true)}<span>${esc(cv.name)}</span></button>`);
      parts.push('</div>');
      parts.push('<h3 class="pg-h3">Computer rivals</h3>');
      parts.push(chips('rivals', [[2, '2'], [3, '3'], [4, '4']], st.rivals));
      parts.push(`<p class="pg-p" style="color:var(--lavender)">${esc(skillText)}</p>`);
    } else {
      parts.push('<h3 class="pg-h3">Players on this phone</h3>');
      parts.push(chips('players', [[2, '2'], [3, '3'], [4, '4']], st.players));
      st.picks.forEach((id, i) => {
        const c = CIV_BY_ID[id];
        parts.push(`<div class="pg-row">${face(c.avatar, true)}<div class="grow"><div class="name" style="color:${COLORS[i].hex}">Player ${i + 1}: ${esc(c.name)}</div><div class="meta">${esc(c.leader)}</div></div><button class="pg-btn" data-act="cycle" data-i="${i}">Change</button></div>`);
      });
      parts.push('<h3 class="pg-h3">Computer rivals</h3>');
      parts.push(chips('cpus', [0, 1, 2, 3].filter((n) => n + st.players <= 5).map((n) => [n, `${n}`]), st.cpus));
    }
    parts.push('<h3 class="pg-h3">Map</h3>');
    parts.push(chips('size', [['small', 'Small'], ['medium', 'Medium']], st.size));
    parts.push('<h3 class="pg-h3">Game length</h3>');
    parts.push(chips('length', [[100, 'Quick (100)'], [150, 'Standard (150)']], st.length));
    return parts.join('');
  };
  const rerender = () => { const sc = p.el.querySelector('.pg-scroll'); const top = sc.scrollTop; p.set('scroll', html()); sc.scrollTop = top; };
  const p = sheet({
    title: hot ? 'Pass and Play' : 'New Game', cls: 'tall', html: html(),
    foot: '<button class="pg-btn gold" data-act="start" data-silent="1">Start</button><button class="pg-btn" data-act="close">Back</button>',
    onClose,
    handlers: {
      civ: ({ v }) => { st.civ = v; rerender(); },
      rivals: ({ v }) => { st.rivals = +v; rerender(); },
      size: ({ v }) => { st.size = v; rerender(); },
      length: ({ v }) => { st.length = +v; rerender(); },
      players: ({ v }) => { st.players = +v; if (st.players + st.cpus > 5) st.cpus = 5 - st.players; ensurePicks(); rerender(); },
      cpus: ({ v }) => { st.cpus = +v; rerender(); },
      cycle: ({ i }) => {
        const taken = st.picks.filter((_, k) => k !== +i);
        let k = CIVS.findIndex((c) => c.id === st.picks[+i]);
        do { k = (k + 1) % CIVS.length; } while (taken.includes(CIVS[k].id));
        st.picks[+i] = CIVS[k].id;
        rerender();
      },
      start: () => { p.close(true); onStart({ ...st, hot }); },
    },
  });
  return p;
}

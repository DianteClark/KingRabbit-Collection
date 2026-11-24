// HTML panels for Alchemist's Shop: market, recipe book, shelves, pricing, night ledger, upgrades, tips.
import { sfx } from '../../../shared/core/sfx.js';
import {
  INGREDIENTS, POTIONS, RECIPE_ORDER, MARKET, UPGRADES, UPGRADE_ORDER, AREAS, AREA_ORDER, EL_INFO, ELEMENTS, FESTIVAL,
} from '../logic/data.js';
import * as G from '../logic/game.js';
import { IMG } from './common.js';

const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let open = [];
let lastClose = 0;
export const anyOpen = () => open.length > 0 || !!document.getElementById('howto');
/** True while a panel is open or was closed a moment ago (so the closing tap can't reach the game). */
export const blocking = () => anyOpen() || Date.now() - lastClose < 250;
export function closeAll() { [...open].forEach((p) => p.close(true)); }

function canvasInput(on) {
  const g = window.__game;
  if (!g) return;
  for (const sc of g.scene.getScenes(true)) if (sc.input) sc.input.enabled = on;
}

export function sheet({ title, sub = '', html = '', foot = '', cls = '', wrap = '', onClose, handlers = {}, noX = false, small = false }) {
  const el = document.createElement('div');
  el.className = `al-wrap ${wrap}`;
  el.innerHTML = `
    <div class="al-sheet ${cls}" role="dialog" aria-label="${esc(title)}">
      <div class="al-head"><h2 class="${small || title.length > 16 ? 'small' : ''}">${esc(title)}</h2>${noX ? '' : '<button class="x" data-act="close" aria-label="Close">Close</button>'}</div>
      <div class="al-sub">${sub}</div>
      <div class="al-scroll">${html}</div>
      <div class="al-foot">${foot}</div>
    </div>`;
  // A click only counts if the finger also went down on this panel: the tap that opened it
  // (which went down on the canvas) can't press anything inside it, without any delay for real taps.
  // A press in the first 200 ms is the second half of a double tap on the opening button: ignored too.
  const opened = Date.now();
  let pressed = false;
  const p = {
    el,
    close(silent) {
      if (!el.isConnected) return;
      el.remove();
      open = open.filter((x) => x !== p);
      lastClose = Date.now();
      if (!silent) sfx('tap');
      if (!open.length) setTimeout(() => { if (!anyOpen()) canvasInput(true); }, 220);
      onClose?.();
    },
    set(part, h) { const n = el.querySelector(`.al-${part}`); if (n) n.innerHTML = h; },
  };
  let lastAct = 0;
  el.addEventListener('click', (e) => {
    if (!el.isConnected) return;
    if (!pressed) return;
    pressed = false;
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled) {
      // no double-fire from a quick double tap
      if (Date.now() - lastAct < 180) return;
      lastAct = Date.now();
      const act = b.dataset.act;
      if (act === 'close') { p.close(); return; }
      if (!b.dataset.silent) sfx('tap');
      handlers[act]?.(b.dataset, p);
      return;
    }
    if (e.target === el && !noX) p.close();
  });
  for (const t of ['pointerdown', 'mousedown', 'touchstart']) el.addEventListener(t, () => { pressed = Date.now() - opened >= 200; });
  for (const t of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'wheel']) el.addEventListener(t, (e) => e.stopPropagation());
  document.body.appendChild(el);
  open.push(p);
  canvasInput(false);
  return p;
}

// ---------------------------------------------------------------- bits

export function ingIcon(id) {
  const f = INGREDIENTS[id].icon;
  return `<span class="al-ing" style="background-image:url(${IMG.ingSheet});background-size:256px 192px;background-position:-${(f % 8) * 32}px -${Math.floor(f / 8) * 32}px"></span>`;
}
export const potIcon = (id, cls = '') => `<img class="al-pot ${cls}" alt="" src="${IMG.potion[id] || ''}">`;
export const starsHtml = (n) => `<span class="al-stars">${[0, 1, 2].map((i) => `<img alt="" src="${i < n ? IMG.star : IMG.starOff}">`).join('')}</span>`;
export function dotsHtml(el) {
  let out = '';
  for (const e of ELEMENTS) for (let i = 0; i < (el[e] || 0); i++) out += `<img alt="" src="${IMG.el[e]}">`;
  return `<span class="al-dots">${out}</span>`;
}
export const elTag = (e) => `<span class="al-el" style="background:${EL_INFO[e].color}">${EL_INFO[e].name}</span>`;
const elTags = (els) => els.map(elTag).join('');

/** What a request asks for, in words. */
export function reqLabel(req) {
  if (!req) return '';
  const what = req.potion ? POTIONS[req.potion].name : `any ${EL_INFO[req.el].name} potion`;
  return `${what}${req.stars >= 2 ? `, ${req.stars} stars or more` : ''}`;
}

// ---------------------------------------------------------------- tips and confirms

export function showTip(title, html, onClose, { btn = 'Got it', extra = [] } = {}) {
  const handlers = { ok: () => p.close(true) };
  const more = extra.map((b, i) => { handlers[`x${i}`] = () => { p.close(true); b.fn(); }; return `<button class="al-btn ${b.cls || ''}" data-act="x${i}">${esc(b.label)}</button>`; }).join('');
  const p = sheet({
    title, wrap: 'center', noX: true, html,
    foot: `<button class="al-btn ${extra.length ? '' : 'gold'}" data-act="ok">${esc(btn)}</button>${more}`,
    handlers,
    onClose,
  });
  return p;
}

export function showConfirm(title, text, yes, onYes, no = 'Cancel') {
  const p = sheet({
    title, wrap: 'center', noX: true, html: `<p class="al-p">${esc(text)}</p>`,
    foot: `<button class="al-btn" data-act="no">${esc(no)}</button><button class="al-btn gold" data-act="yes">${esc(yes)}</button>`,
    handlers: { no: () => p.close(true), yes: () => { p.close(true); onYes(); } },
  });
  return p;
}

// ---------------------------------------------------------------- market

export function showMarket(s, onChange) {
  const render = () => {
    const rows = MARKET.map((m) => ({ ing: m.ing, price: m.price, left: s.market[m.ing] }));
    if (s.special) rows.push({ ing: s.special.ing, price: s.special.price, left: s.special.stock, special: true });
    return rows.map((r) => `<div class="al-row">
      ${ingIcon(r.ing)}
      <div class="grow"><div class="name">${esc(INGREDIENTS[r.ing].name)}${r.special ? ' <span class="al-coins">(special)</span>' : ''}</div>
      <div class="meta">${dotsHtml(INGREDIENTS[r.ing].el)} ${r.left} left</div></div>
      <button class="al-btn small gold" data-act="buy" data-ing="${r.ing}" data-silent="1" ${r.left > 0 && s.coins >= r.price ? '' : 'disabled'}>Buy<small>${r.price} c</small></button>
    </div>`).join('');
  };
  const sub = () => `You have <span class="al-coins">${s.coins} coins</span>. Stock refills every morning.`;
  const p = sheet({
    title: 'Market Stall', sub: sub(), html: render(),
    handlers: {
      buy: ({ ing }) => {
        const r = G.buy(s, ing);
        if (r.ok) { sfx('coin'); onChange?.(); } else sfx('error');
        p.set('sub', sub()); p.set('scroll', render());
      },
    },
  });
  return p;
}

// ---------------------------------------------------------------- recipe book

export function showBook(s, tab = 'potions') {
  const found = RECIPE_ORDER.filter((id) => s.known[id]).length;
  const potions = () => RECIPE_ORDER.map((id) => {
    const p = POTIONS[id];
    const k = s.known[id];
    if (!k) {
      const hintEls = p.legendary ? '<span class="meta">Needs rare finds from guarded spots.</span>' : elTags(p.els);
      return `<div class="al-row dim">${potIcon(id, 'mystery')}<div class="grow"><div class="name">???</div><div>${hintEls}</div><div class="meta">${esc(p.use)}</div></div></div>`;
    }
    const combo = k.combo.map((i) => ingIcon(i)).join('');
    return `<div class="al-row">${potIcon(id)}<div class="grow"><div class="name">${esc(p.name)} ${starsHtml(k.best)}</div>
      <div>${p.legendary ? '<span class="meta">Legendary</span>' : elTags(p.els)}</div>
      <div class="meta">${esc(p.use)} Worth about ${p.value}.</div><div>${combo}</div></div></div>`;
  }).join('') + (s.known.sludge ? `<div class="al-row dim">${potIcon('sludge')}<div class="grow"><div class="name">Murky Sludge</div><div class="meta">${esc(POTIONS.sludge.use)}</div></div></div>` : '');
  const ingredients = () => {
    const ids = Object.keys(INGREDIENTS).filter((id) => {
      const a = INGREDIENTS[id].area;
      return a === 'market' || a === 'garden' || s.areas[a];
    });
    return `<p class="al-p">Each dot is one element. Add up the dots in the pot: an element with twice as many dots as any other makes its pure potion; otherwise the two strongest make a pair potion.</p>` + ids.map((id) => {
      const ing = INGREDIENTS[id];
      return `<div class="al-row">${ingIcon(id)}<div class="grow"><div class="name">${esc(ing.name)} <span class="meta">x${s.inv[id] || 0}</span></div><div>${dotsHtml(ing.el)} <span class="meta">${ELEMENTS.filter((e) => ing.el[e]).map((e) => `${EL_INFO[e].name} ${ing.el[e]}`).join(', ')}</span></div>
      <div class="meta">${ing.area === 'market' ? 'Market' : AREAS[ing.area].name}${ing.rare ? ' (guarded)' : ''}</div></div></div>`;
    }).join('');
  };
  const tabs = (t) => `<div class="al-tabs" style="padding:0"><button class="al-btn ${t === 'potions' ? 'on' : ''}" data-act="tab" data-t="potions">Potions</button><button class="al-btn ${t === 'ing' ? 'on' : ''}" data-act="tab" data-t="ing">Ingredients</button></div>`;
  const p = sheet({
    title: 'Recipe Book', sub: `Found ${found} of ${RECIPE_ORDER.length} recipes.` + tabs(tab),
    html: tab === 'potions' ? potions() : ingredients(),
    handlers: { tab: ({ t }) => { p.set('sub', `Found ${found} of ${RECIPE_ORDER.length} recipes.` + tabs(t)); p.set('scroll', t === 'potions' ? potions() : ingredients()); p.el.querySelector('.al-scroll').scrollTop = 0; } },
  });
  return p;
}

// ---------------------------------------------------------------- shelves

/**
 * The potion shelves. mode: 'view' (pour out), 'offer' (pick one for a customer), 'festival' (pick one for a round).
 */
export function showShelf(s, { mode = 'view', customer, round, onPick, onChange, onClose } = {}) {
  const render = () => {
    let list = G.shelfList(s);
    // best fits first when choosing for a customer or a festival round
    if (mode === 'offer' && customer?.req) list = list.map((e) => ({ e, k: G.matches(customer.req, e.potion) ? (e.stars >= (customer.req.stars || 1) ? 2 : 1) : 0 })).sort((a, b) => b.k - a.k).map((x) => x.e);
    if (mode === 'festival') list = list.slice().sort((a, b) => G.festivalScore(round, b.potion, b.stars).score - G.festivalScore(round, a.potion, a.stars).score);
    if (!list.length) return `<div class="al-empty">Your shelves are empty.${mode === 'view' ? ' Brew something in the cauldron!' : ''}</div>`;
    return list.map((e) => {
      const p = POTIONS[e.potion];
      let note = `<span class="meta">Fair price ${G.fairPrice(e.potion, e.stars)}</span>`;
      if (mode === 'offer' && customer?.req) {
        const ok = G.matches(customer.req, e.potion);
        const weak = ok && e.stars < (customer.req.stars || 1);
        note = ok ? (weak ? '<span class="bad">Fits, but too weak</span>' : '<span class="good">Fits the request</span>') : '<span class="meta">Not what they asked for</span>';
      }
      if (mode === 'festival') {
        const sc = G.festivalScore(round, e.potion, e.stars);
        note = `${sc.match ? '<span class="good">Fits the theme</span>' : '<span class="bad">Off theme</span>'} <span class="meta">${sc.score} points</span>`;
      }
      const inner = `${potIcon(e.potion)}<div class="grow"><div class="name">${esc(p.name)} ${starsHtml(e.stars)}</div><div>${note}</div></div><div class="right">x${e.n}</div>`;
      if (mode === 'view') return `<div class="al-row">${inner}<button class="al-btn small red" data-act="pour" data-key="${e.key}">Pour<small>out</small></button></div>`;
      return `<button class="al-row" data-act="pick" data-key="${e.key}">${inner}</button>`;
    }).join('');
  };
  const sub = () => {
    if (mode === 'offer') return `They want: <span class="al-coins">${esc(reqLabel(customer.req))}</span>`;
    if (mode === 'festival') return `<span class="al-coins">${esc(FESTIVAL[round].text)}</span>`;
    return `${G.shelfCount(s)} of ${G.shelfCap(s)} spaces used.`;
  };
  const title = mode === 'offer' ? 'Offer a potion' : mode === 'festival' ? 'Enter a potion' : 'Your Shelves';
  const p = sheet({
    title, sub: sub(), html: render(), onClose,
    handlers: {
      pick: ({ key }) => { p.close(true); onPick?.(key); },
      pour: ({ key }) => {
        // two taps: the first asks, the second pours
        const b = p.el.querySelector(`[data-act="pour"][data-key="${key}"]`);
        if (b && !b.dataset.armed) {
          p.el.querySelectorAll('[data-armed]').forEach((x) => { delete x.dataset.armed; x.innerHTML = 'Pour<small>out</small>'; });
          b.dataset.armed = '1'; b.innerHTML = 'Sure?<small>tap</small>';
          return;
        }
        if (G.pourOut(s, key)) { sfx('place'); onChange?.(); }
        p.set('sub', sub()); p.set('scroll', render());
      },
    },
  });
  return p;
}

/** Choose a price for a potion. onOffer(price); onBack() returns to the shelf. */
export function showPrice(s, key, customer, onOffer, onBack) {
  const { potion, stars } = G.parseKey(key);
  const fair = G.fairPrice(potion, stars);
  let price = fair;
  const weak = customer.req && stars < (customer.req.stars || 1);
  const body = () => `
    <div class="al-row">${potIcon(potion, 'big')}<div class="grow"><div class="name">${esc(POTIONS[potion].name)}</div>${starsHtml(stars)}<div class="meta">Fair price ${fair} coins${weak ? '<br><span class="bad">Weaker than they wanted: expect less.</span>' : ''}</div></div></div>
    <div class="al-price">
      <button class="al-btn" data-act="adj" data-d="-5" data-silent="1">-5</button>
      <button class="al-btn" data-act="adj" data-d="-1" data-silent="1">-1</button>
      <span class="val">${price}</span>
      <button class="al-btn" data-act="adj" data-d="1" data-silent="1">+1</button>
      <button class="al-btn" data-act="adj" data-d="5" data-silent="1">+5</button>
    </div>
    <p class="al-p meta" style="text-align:center">${price < fair ? 'A bargain! They will like that.' : price === fair ? 'A fair price.' : price <= Math.round(fair * 1.2) ? 'A little steep. They might haggle.' : 'Expensive! Expect haggling, and some bad feeling.'}</p>`;
  const p = sheet({
    title: 'Set your price', wrap: 'center', noX: true, html: body(),
    foot: '<button class="al-btn" data-act="back">Back</button><button class="al-btn gold" data-act="offer">Offer it</button>',
    handlers: {
      adj: ({ d }) => { price = Math.max(1, Math.min(999, price + Number(d))); sfx('select'); p.set('scroll', body()); },
      back: () => { p.close(true); onBack?.(); },
      offer: () => { p.close(true); onOffer(price); },
    },
  });
  return p;
}

// ---------------------------------------------------------------- upgrades

export function showUpgrades(s, onChange) {
  const render = () => {
    const ups = UPGRADE_ORDER.map((k) => {
      const u = G.upgradeInfo(s, k);
      const next = u.next ? `<div class="meta">Next: ${esc(u.next.label)}. ${esc(u.next.desc || '')}</div>` : '<div class="good">Fully upgraded</div>';
      const btn = u.next ? `<button class="al-btn small gold" data-act="up" data-k="${k}" data-silent="1" ${u.can ? '' : 'disabled'}>Buy<small>${u.next.cost} c</small></button>` : '';
      return `<div class="al-row"><div class="grow"><div class="name">${esc(u.now.label)}</div>${next}${!u.can && u.next ? `<div class="bad">${esc(u.why)}</div>` : ''}</div>${btn}</div>`;
    }).join('');
    const areas = AREA_ORDER.filter((a) => a !== 'garden').map((a) => {
      const info = G.areaInfo(s, a);
      if (info.open) return `<div class="al-row"><div class="grow"><div class="name">${AREAS[a].name}</div><div class="good">Open for gathering</div></div></div>`;
      return `<div class="al-row"><div class="grow"><div class="name">${AREAS[a].name} (locked)</div><div class="meta">${a === 'forest' ? 'Toadstools, owl feathers, dew crystals and a gremlin.' : 'Cinnabar, ember stones, frost diamonds, and a golem guarding treasure.'}</div>${info.can ? '' : `<div class="bad">${esc(info.why)}</div>`}</div>
        <button class="al-btn small gold" data-act="area" data-a="${a}" data-silent="1" ${info.can ? '' : 'disabled'}>Open<small>${info.cost} c</small></button></div>`;
    }).join('');
    return `<div class="al-h3">Places to gather</div>${areas}<div class="al-h3">Shop upgrades</div>${ups}`;
  };
  const sub = () => `You have <span class="al-coins">${s.coins} coins</span>. Rent tonight: ${G.rentFor(s.day)}${G.wageFor(s) ? `, wage ${G.wageFor(s)}` : ''}.`;
  const p = sheet({
    title: 'Upgrades', sub: sub(), html: render(),
    handlers: {
      up: ({ k }) => { if (G.buyUpgrade(s, k).ok) { sfx('power'); onChange?.('up', k); } else sfx('error'); p.set('sub', sub()); p.set('scroll', render()); },
      area: ({ a }) => { if (G.unlockArea(s, a).ok) { sfx('power'); onChange?.('area', a); } else sfx('error'); p.set('sub', sub()); p.set('scroll', render()); },
    },
  });
  return p;
}

// ---------------------------------------------------------------- night ledger

export function showNight(s, r, { onSleep, onUpgrades }) {
  const net = r.income - r.rent - r.wage;
  const log = r.log.map((l) => `<div class="al-row"><div class="grow"><span class="name">${esc(l.name)}</span> <span class="meta">${esc(l.text)}</span></div><div class="${l.good ? 'al-ok' : 'al-warn'}">${l.good ? 'Happy' : 'Unhappy'}</div></div>`).join('');
  let warn = '';
  if (r.closed) warn = '<p class="al-p al-warn">Three nights in debt. The landlord has locked the door...</p>';
  else if (r.debt) warn = `<p class="al-p al-warn">You are in debt! Night ${s.debtNights} of ${G.DEBT_NIGHTS}: if you are still in debt after ${G.DEBT_NIGHTS - s.debtNights === 1 ? 'tomorrow night' : `${G.DEBT_NIGHTS - s.debtNights} more nights`}, the shop closes. Sell more and spend less!</p>`;
  const next = s.mode === 'story' && r.day + 1 === 30 ? '<p class="al-p al-ok">Tomorrow is the Festival of Flasks! Brew your best and choose wisely.</p>' : '';
  const html = `
    <div class="al-grid2">
      <span>Customers</span><span>${r.customers} (${r.happy} happy)</span>
      <span>Potions sold</span><span>${r.sold}</span>
      <span>Takings</span><span>+${r.income}</span>
      <span>Rent</span><span>-${r.rent}</span>
      ${r.wage ? `<span>Apprentice wage</span><span>-${r.wage}</span>` : ''}
      <span>Today</span><span class="${net >= 0 ? 'al-ok' : 'al-warn'}">${net >= 0 ? '+' : ''}${net}</span>
      <span>Coins now</span><span class="${s.coins < 0 ? 'al-warn' : ''}">${s.coins}</span>
      <span>Reputation</span><span>${r.rep} (${r.repDelta >= 0 ? '+' : ''}${r.repDelta})</span>
    </div>${warn}${next}
    ${log ? `<div class="al-h3">Today's customers</div>${log}` : ''}
    ${r.closed ? '' : `<p class="al-p" style="margin-top:8px">Rent tomorrow: ${G.rentFor(r.day + 1)}.</p>`}`;
  const p = sheet({
    title: `Night ${r.day}`, cls: 'paper', wrap: 'center', noX: true, sub: 'The shop ledger', html,
    foot: r.closed ? '<button class="al-btn gold" data-act="sleep">Oh no...</button>' : '<button class="al-btn" data-act="ups">Upgrades</button><button class="al-btn gold" data-act="sleep">Go to sleep</button>',
    handlers: {
      ups: () => { p.close(true); onUpgrades?.(); },
      sleep: () => { p.close(true); onSleep?.(); },
    },
  });
  return p;
}

// HTML panels for Hearth Valley: bag, shipping bin, shops, crafting, the community board,
// letters, friends, the menu and the end-of-day summary.
import { sfx, isMuted, setMuted } from '../../../shared/core/sfx.js';
import { iconUrl } from '../art.js';
import * as G from '../logic/game.js';
import * as D from '../logic/data.js';
import { musicOn, setMusicOn } from '../music.js';

const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => Math.floor(n).toLocaleString('en-US');

let open = [];
let lastClose = 0;
/** True while a panel is open or was closed a moment ago (so the closing tap doesn't reach the game). */
export const blocking = () => open.length > 0 || Date.now() - lastClose < 300;
export const anyOpen = () => open.length > 0;
export function closeAll() { [...open].forEach((p) => p.close(true)); }

let scene = null;
/** Panels draw item icons from the game's atlas; World/Title tell us which scene to read it from. */
export function usePanelScene(sc) { scene = sc; }
const icon = (frame, cls = '') => `<img class="hv-ico ${cls}" alt="" src="${scene ? iconUrl(scene, frame) : ''}">`;
const itemIcon = (id, cls) => icon(D.ITEMS[id]?.icon || 'i_stone', cls);
const face = (row) => icon(`npc${row}_0`, 'face');

export function sheet({ title, sub = '', html = '', foot = '', cls = '', wrap = '', onClose, handlers = {}, noX = false, small = false }) {
  const el = document.createElement('div');
  el.className = `hv-wrap ${wrap}`;
  el.innerHTML = `
    <div class="hv-sheet ${cls}" role="dialog" aria-label="${esc(title)}">
      <div class="hv-head"><h2 class="${small || title.length > 16 ? 'small' : ''}">${esc(title)}</h2>${noX ? '' : '<button class="x" data-act="close" aria-label="Close">Close</button>'}</div>
      <div class="hv-sub">${sub}</div>
      <div class="hv-scroll">${html}</div>
      <div class="hv-foot">${foot}</div>
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
    set(part, h) { const n = el.querySelector(`.hv-${part}`); if (n) n.innerHTML = h; },
  };
  el.addEventListener('click', (e) => {
    if (!el.isConnected) return;
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled) {
      // one action per tap, even if the browser sends a burst of clicks
      const now = Date.now();
      if (now < busyUntil) return;
      busyUntil = now + 120;
      const act = b.dataset.act;
      if (act === 'close') { p.close(); return; }
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

const itemsOf = (s, filter = () => true) => Object.keys(s.inv).filter((id) => s.inv[id] > 0 && filter(id))
  .sort((a, b) => kindOrder(a) - kindOrder(b) || D.ITEMS[a].name.localeCompare(D.ITEMS[b].name));
const KIND_ORDER = ['seed', 'crop', 'forage', 'fish', 'animal', 'artisan', 'food', 'fertilizer', 'tackle', 'place', 'stair', 'resource', 'mineral', 'gem'];
const kindOrder = (id) => KIND_ORDER.indexOf(D.ITEMS[id].kind);

// ---------------------------------------------------------------- bag

/** The bag. forSlot: choosing what to hold in hand slot 0 or 1. */
export function bagPanel(s, { forSlot = null, onChange } = {}) {
  let sel = null;
  const render = () => {
    const ids = itemsOf(s);
    const grid = ids.length ? `<div class="hv-grid">${ids.map((id) => `
      <button data-act="pick" data-id="${id}" class="${sel === id ? 'sel' : ''}" aria-label="${esc(D.ITEMS[id].name)}">
        ${itemIcon(id)}<span class="n">${s.inv[id]}</span></button>`).join('')}</div>` : '<p class="hv-p hv-dim">Your bag is empty.</p>';
    const tools = D.TOOLS.map((t) => `<div class="hv-kv"><span>${D.TOOL_LEVELS[s.tools[t]]}${D.TOOL_INFO[t].name}</span><span class="hv-dim">${t === 'can' ? `${s.water}/${D.CAN_SIZE[s.tools.can]} water` : ''}</span></div>`).join('');
    p.set('scroll', `${forSlot != null ? `<p class="hv-p">Tap an item to hold it in hand slot ${forSlot + 1}.</p>` : ''}${grid}<h3 class="hv-h3">Tools</h3>${tools}`);
    p.set('foot', detail());
  };
  const detail = () => {
    if (!sel || !s.inv[sel]) return forSlot != null ? '<button class="hv-btn" data-act="empty">Empty this hand</button>' : '<p class="hv-p hv-dim" style="margin:0">Tap an item to see it.</p>';
    const it = D.ITEMS[sel];
    const val = G.sellable(sel) ? `sells for ${it.price}g` : '';
    const eat = it.energy ? `, +${it.energy} energy` : '';
    return `<div style="width:100%"><div class="hv-row" style="margin:0">${itemIcon(sel, 'big')}<div class="grow"><div class="name">${esc(it.name)} x${s.inv[sel]}</div><div class="note">${val}${eat}</div></div></div></div>
      <button class="hv-btn gold" data-act="hold" data-slot="0">Hand 1</button>
      <button class="hv-btn gold" data-act="hold" data-slot="1">Hand 2</button>
      ${it.energy ? '<button class="hv-btn green" data-act="eat">Eat</button>' : ''}`;
  };
  const p = sheet({
    title: forSlot != null ? 'Hold what?' : 'Bag', sub: `<span class="hv-gold">${fmt(s.gold)}g</span>`,
    handlers: {
      pick: ({ id }) => {
        sfx('select');
        if (forSlot != null) { G.setHand(s, forSlot, id); s.slot = D.TOOLS.length + forSlot; onChange?.(); p.close(true); return; }
        sel = id; render();
      },
      hold: ({ slot }) => { G.setHand(s, Number(slot), sel); s.slot = D.TOOLS.length + Number(slot); sfx('select'); onChange?.(); p.close(true); },
      eat: () => { if (G.eat(s, sel)) { sfx('power'); onChange?.(); } if (!s.inv[sel]) sel = null; render(); p.set('sub', `<span class="hv-gold">${fmt(s.gold)}g</span> &nbsp; Energy ${s.energy}/${D.MAX_ENERGY}`); },
      empty: () => { s.hand[forSlot] = null; onChange?.(); p.close(true); },
    },
  });
  render();
  return p;
}

// ---------------------------------------------------------------- shipping bin

export function shipPanel(s, { onChange } = {}) {
  const render = () => {
    const bin = Object.entries(s.bin);
    const binHtml = bin.length ? bin.map(([id, n]) => `<button class="hv-row" data-act="back" data-id="${id}">${itemIcon(id)}<div class="grow"><div class="line"><span class="name">${esc(D.ITEMS[id].name)} x${n}</span><span class="meta">${fmt(D.ITEMS[id].price * n)}g</span></div><div class="note">Tap to take back</div></div></button>`).join('') : '<p class="hv-p hv-dim">The bin is empty.</p>';
    const ids = itemsOf(s, G.sellable);
    const bag = ids.length ? ids.map((id) => `<div class="hv-row">${itemIcon(id)}<div class="grow"><div class="name">${esc(D.ITEMS[id].name)} x${s.inv[id]}</div><div class="note">${D.ITEMS[id].price}g each</div></div>
      <button class="hv-btn small" data-act="ship1" data-id="${id}">1</button><button class="hv-btn small gold" data-act="ship" data-id="${id}">All</button></div>`).join('') : '<p class="hv-p hv-dim">Nothing to sell yet. Harvest, forage, fish or mine!</p>';
    p.set('sub', `Paid overnight: <span class="hv-gold">${fmt(G.binValue(s))}g</span>`);
    p.set('scroll', `<h3 class="hv-h3" style="margin-top:0">In the bin</h3>${binHtml}<h3 class="hv-h3">Your bag</h3>${bag}`);
  };
  const p = sheet({
    title: 'Shipping Bin',
    handlers: {
      ship: ({ id }) => { if (G.ship(s, id)) sfx('coin'); onChange?.(); render(); },
      ship1: ({ id }) => { if (G.ship(s, id, 1)) sfx('coin'); onChange?.(); render(); },
      back: ({ id }) => { G.unship(s, id); sfx('tap'); onChange?.(); render(); },
    },
  });
  render();
  return p;
}

// ---------------------------------------------------------------- shops

export function shopPanel(s, shopId, { onChange, onAnimal } = {}) {
  const sh = D.SHOPS[shopId];
  let tab = 'buy';
  const render = () => {
    p.set('sub', `You have <span class="hv-gold">${fmt(s.gold)}g</span>`);
    let html = '';
    if (tab === 'buy') {
      html = sh.stock(s).map((l) => {
        const it = D.ITEMS[l.id];
        const crop = it.kind === 'seed' ? D.CROPS[it.crop] : null;
        const note = crop ? `${crop.days} days${crop.regrow ? `, fruits every ${crop.regrow}` : ''}. Sells ${D.ITEMS[it.crop].price}g` : it.energy ? `+${it.energy} energy` : it.kind === 'fertilizer' ? 'Crops grow faster' : '';
        return `<div class="hv-row">${itemIcon(l.id)}<div class="grow"><div class="line"><span class="name">${esc(it.name)}</span><span class="meta">${l.price}g</span></div><div class="note">${esc(note)}${s.inv[l.id] ? ` (have ${s.inv[l.id]})` : ''}</div></div>
          <button class="hv-btn small" data-act="buy" data-id="${l.id}" data-n="1" ${s.gold < l.price ? 'disabled' : ''}>Buy</button>
          <button class="hv-btn small gold" data-act="buy" data-id="${l.id}" data-n="5" ${s.gold < l.price * 5 ? 'disabled' : ''}>x5</button></div>`;
      }).join('');
      if (sh.animals) {
        html += '<h3 class="hv-h3">Animals</h3>';
        for (const [k, a] of Object.entries(D.ANIMALS)) {
          const n = G.animalCount(s, k);
          html += `<div class="hv-row">${icon(a.frames[0])}<div class="grow"><div class="line"><span class="name">${a.name}</span><span class="meta">${fmt(a.price)}g</span></div><div class="note">Gives ${D.ITEMS[a.product].name.toLowerCase()}. ${a.home === 'coop' ? 'Coop' : 'Barn'}: ${n}/${a.cap}</div></div>
            <button class="hv-btn small gold" data-act="animal" data-k="${k}" ${s.gold < a.price || n >= a.cap ? 'disabled' : ''}>Buy</button></div>`;
        }
      }
    } else {
      html = '<p class="hv-p">Bram upgrades a tool on the spot. Copper hoes and cans work 3 tiles in a row; iron, a 3x3 patch. Upgraded axes, picks and swords hit harder. A better rod gives a bigger bar.</p>';
      html += D.TOOLS.map((t) => {
        const u = G.upgradeInfo(s, t);
        if (u.max) return `<div class="hv-row">${icon(D.TOOL_INFO[t].icon)}<div class="grow"><div class="name">Iron ${esc(D.TOOL_INFO[t].name)}</div><div class="note">Fully upgraded</div></div></div>`;
        return `<div class="hv-row">${icon(D.TOOL_INFO[t].icon)}<div class="grow"><div class="name">${D.TOOL_LEVELS[u.level]}${esc(D.TOOL_INFO[t].name)}</div><div class="note">${fmt(u.gold)}g + ${u.n} ${D.ITEMS[u.bar].name} (have ${s.inv[u.bar] || 0})</div></div>
          <button class="hv-btn small gold" data-act="up" data-t="${t}" ${u.can ? '' : 'disabled'}>Upgrade</button></div>`;
      }).join('');
    }
    p.set('scroll', html);
  };
  const p = sheet({
    title: sh.name, small: true,
    foot: sh.upgrades ? '<div class="hv-tabs" style="padding:0;width:100%"><button class="hv-btn on" data-act="tab" data-t="buy">Buy</button><button class="hv-btn" data-act="tab" data-t="up">Upgrade tools</button></div>' : '',
    handlers: {
      tab: ({ t }) => { tab = t; p.el.querySelectorAll('[data-act=tab]').forEach((b) => b.classList.toggle('on', b.dataset.t === t)); render(); },
      buy: ({ id, n }) => { if (G.buy(s, shopId, id, Number(n))) sfx('coin'); else sfx('error'); onChange?.(); render(); },
      up: ({ t }) => { if (G.upgrade(s, t)) { sfx('power'); onChange?.(`Your ${D.TOOL_INFO[t].name} is now ${D.TOOL_LEVELS[s.tools[t]].trim()}!`); } render(); },
      animal: ({ k }) => { const a = G.buyAnimal(s, k); if (a) { sfx('win'); onAnimal?.(a); p.close(true); } else sfx('error'); },
    },
  });
  render();
  return p;
}

// ---------------------------------------------------------------- crafting

export function craftPanel(s, { onChange } = {}) {
  const render = () => {
    const html = D.RECIPE_ORDER.filter((r) => s.recipes.includes(r)).map((rid) => {
      const r = D.RECIPES[rid];
      const parts = (needs) => Object.entries(needs).map(([id, n]) => `<span class="${G.has(s, id, n) ? 'hv-good' : 'hv-bad'}">${n} ${esc(D.ITEMS[id].name)} (${s.inv[id] || 0})</span>`).join(', ');
      const can = !!G.canCraft(s, rid);
      return `<div class="hv-row">${itemIcon(rid)}<div class="grow"><div class="line"><span class="name">${esc(r.name)}${r.makes > 1 ? ` x${r.makes}` : ''}</span></div>
        <div class="note">${esc(r.tip)}</div><div class="note">${parts(r.needs)}${r.alt ? `<br>or ${parts(r.alt)}` : ''}</div></div>
        <button class="hv-btn small gold" data-act="craft" data-r="${rid}" ${can ? '' : 'disabled'}>Make</button></div>`;
    }).join('');
    const unknown = D.RECIPE_ORDER.length - s.recipes.length;
    p.set('scroll', html + (unknown ? `<p class="hv-p hv-dim">${unknown} more recipe${unknown > 1 ? 's' : ''} to learn from letters and friends.</p>` : ''));
  };
  const p = sheet({
    title: 'Craft',
    handlers: { craft: ({ r }) => { if (G.craft(s, r)) { sfx('place'); onChange?.(`Made ${D.RECIPES[r].name}${D.RECIPES[r].makes > 1 ? ` x${D.RECIPES[r].makes}` : ''}!`); } render(); } },
  });
  render();
  return p;
}

// ---------------------------------------------------------------- community board

export function boardPanel(s, { onBundle } = {}) {
  const render = () => {
    p.set('sub', `${G.goalText(s)}. Tap a green item to give it.`);
    const html = D.BUNDLES.map((b) => {
      const pr = G.bundleProgress(s, b);
      const parts = pr.parts.map((x) => {
        const done = x.have >= x.n;
        const label = x.id === 'gold' ? `${fmt(x.have)}/${fmt(x.n)}g` : `${x.have}/${x.n}`;
        const can = !pr.done && !done && (x.id === 'gold' ? s.gold > 0 : G.has(s, x.id));
        const ic = x.id === 'gold' ? icon('i_crown') : itemIcon(x.id);
        const name = x.id === 'gold' ? 'Gold' : D.ITEMS[x.id].name;
        return can ? `<button class="part" data-act="give" data-b="${b.id}" data-id="${x.id}" aria-label="Give ${esc(name)}">${ic}${esc(name)} ${label}</button>`
          : `<span class="part ${done || pr.done ? 'done' : ''}">${ic}${esc(name)} ${label}</span>`;
      }).join('');
      return `<div class="hv-row" style="display:block"><div class="line"><span class="name ${pr.done ? 'hv-good' : ''}">${esc(b.name)}${pr.done ? ' - done!' : ''}</span><span class="meta">${esc(b.rewardText)}</span></div><div class="hv-need">${parts}</div></div>`;
    }).join('');
    p.set('scroll', html);
  };
  const p = sheet({
    title: 'Community Board', small: false,
    handlers: {
      give: ({ b, id }, panel) => {
        const r = G.contribute(s, b, id);
        if (r.added) sfx('coin');
        render();
        if (r.done) { panel.close(true); onBundle?.(r, b); }
      },
    },
  });
  render();
  return p;
}

// ---------------------------------------------------------------- letters

export function letterPanel(letter, { more = false, onNext, onClose } = {}) {
  return sheet({
    title: letter.title, small: true, wrap: 'center',
    html: `<div class="hv-letter">${letter.body.map((b) => `<p>${esc(b)}</p>`).join('')}<p class="from">- ${esc(letter.from)}</p></div>${letter.recipe ? `<p class="hv-p hv-good">You learned the ${esc(D.RECIPES[letter.recipe].name)} recipe! (Craft)</p>` : ''}`,
    foot: more ? '<button class="hv-btn gold" data-act="next">Next letter</button>' : '<button class="hv-btn gold" data-act="close">OK</button>',
    handlers: { next: (_, p) => { p.close(true); onNext?.(); } },
    onClose,
  });
}

// ---------------------------------------------------------------- friends

function heartsHtml(n) {
  return `<div class="hv-hearts">${Array.from({ length: D.MAX_HEARTS }, (_, i) => icon(i < n ? 'heart' : 'heartEmpty')).join('')}</div>`;
}
export function friendsPanel(s) {
  const today = G.dayIndex(s);
  const html = D.VILLAGER_ORDER.map((id) => {
    const v = D.VILLAGERS[id];
    const f = s.friends[id];
    const h = G.hearts(s, id);
    const met = s.flags[`met_${id}`];
    const bday = `${D.SEASONS[v.birthday[0]]} ${v.birthday[1]}`;
    const loves = v.loves.map((x) => D.ITEMS[x].name).join(', ');
    const likes = v.likes.slice(0, 4).map((x) => D.ITEMS[x].name).join(', ');
    return `<div class="hv-row" style="align-items:flex-start">${face(v.row)}<div class="grow"><div class="line"><span class="name">${esc(v.name)}</span><span class="meta">${f.talk === today ? 'Talked' : ''}${f.gift === today ? ', gift' : ''}</span></div>
      ${heartsHtml(h)}<div class="note">${met ? `${esc(v.job)}. Birthday ${bday}.` : 'Not met yet.'}</div>
      ${h >= 1 || met ? `<div class="note">Loves: ${esc(loves)}</div><div class="note">Likes: ${esc(likes)}</div>` : ''}</div></div>`;
  }).join('');
  return sheet({ title: 'Friends', html });
}

// ---------------------------------------------------------------- pick an item (gifts, the fair)

export function pickItemPanel(s, { title, sub = '', filter = () => true, label = (id) => D.ITEMS[id].name, onPick, onCancel }) {
  let picked = false;
  const ids = itemsOf(s, filter);
  const html = ids.length ? ids.map((id) => `<button class="hv-row" data-act="pick" data-id="${id}">${itemIcon(id)}<div class="grow"><div class="line"><span class="name">${esc(D.ITEMS[id].name)} x${s.inv[id]}</span><span class="meta">${esc(label(id))}</span></div></div></button>`).join('')
    : '<p class="hv-p hv-dim">You have nothing suitable.</p>';
  return sheet({
    title, sub, small: true, html,
    handlers: { pick: ({ id }, p) => { picked = true; sfx('select'); p.close(true); onPick(id); } },
    onClose: () => { if (!picked) onCancel?.(); },
  });
}

// ---------------------------------------------------------------- menu

export function menuPanel(s, { onFriends, onBoard, onTitle, onChange } = {}) {
  const render = () => {
    const caught = Object.keys(s.stats.fish).length;
    p.set('scroll', `
      <div class="hv-kv"><span>Date</span><span>Year ${s.year}, ${esc(G.dateText(s))}</span></div>
      <div class="hv-kv"><span>Gold</span><span class="hv-gold">${fmt(s.gold)}g</span></div>
      <div class="hv-kv"><span>Earned from shipping</span><span>${fmt(s.earned)}g</span></div>
      <div class="hv-kv"><span>Goal</span><span>${s.bundlesDone.length}/${D.BUNDLES.length} bundles</span></div>
      <div class="hv-kv"><span>Crops harvested</span><span>${s.stats.harvested}</span></div>
      <div class="hv-kv"><span>Fish species</span><span>${caught}/${D.FISH_ORDER.length}</span></div>
      <div class="hv-kv"><span>Deepest mine floor</span><span>${s.mineDeepest || '-'}</span></div>
      <div class="hv-kv"><span>Animals</span><span>${s.animals.length}</span></div>
      <h3 class="hv-h3">Fish caught</h3><div class="hv-need">${D.FISH_ORDER.map((id) => (s.stats.fish[id] ? `<span class="part done">${itemIcon(id)}${esc(D.ITEMS[id].name)}</span>` : '<span class="part">?</span>')).join('')}</div>`);
    p.set('foot', `<button class="hv-btn" data-act="friends">Friends</button><button class="hv-btn" data-act="board">Town hall</button>
      <button class="hv-btn ${musicOn() ? 'green' : ''}" data-act="music">Music ${musicOn() ? 'on' : 'off'}</button><button class="hv-btn ${isMuted() ? '' : 'green'}" data-act="sound">Sound ${isMuted() ? 'off' : 'on'}</button>
      <button class="hv-btn red" data-act="title" style="flex-basis:100%">Save and go to title</button>`);
  };
  const p = sheet({
    title: 'Menu',
    handlers: {
      friends: () => { p.close(true); onFriends?.(); },
      board: () => { p.close(true); onBoard?.(); },
      music: () => { setMusicOn(!musicOn()); render(); onChange?.(); },
      sound: () => { setMuted(!isMuted()); render(); onChange?.(); },
      title: () => { p.close(true); onTitle?.(); },
    },
  });
  render();
  return p;
}

// ---------------------------------------------------------------- the end of a day

const WEATHER_TEXT = { sun: 'Sunny', rain: 'Rain', storm: 'Thunderstorm', snow: 'Snow' };
export const weatherText = (w) => WEATHER_TEXT[w] || 'Sunny';

export function summaryPanel(s, sum, { onClose } = {}) {
  const shipped = sum.shipped.length ? sum.shipped.map(([id, n, v]) => `<div class="hv-row">${itemIcon(id)}<div class="grow"><div class="line"><span class="name">${esc(D.ITEMS[id].name)} x${n}</span><span class="meta">${fmt(v)}g</span></div></div></div>`).join('')
    : '<p class="hv-p hv-dim">Nothing shipped yesterday.</p>';
  const notes = [];
  if (sum.passedOut) notes.push(`<p class="hv-p hv-bad">You passed out! Someone carried you home${sum.lost ? ` and charged ${fmt(sum.lost)}g` : ''}.</p>`);
  if (sum.grown) notes.push(`<p class="hv-p hv-good">${sum.grown} crop${sum.grown > 1 ? 's are' : ' is'} ready to harvest.</p>`);
  if (sum.products) notes.push(`<p class="hv-p hv-good">Your animals have ${sum.products} product${sum.products > 1 ? 's' : ''} for you.</p>`);
  for (const e of sum.events) notes.push(`<p class="hv-p hv-gold">${esc(e)}</p>`);
  if (G.unread(s)) notes.push(`<p class="hv-p">You have mail (${G.unread(s)}).</p>`);
  const f = G.festivalToday(s);
  if (f) notes.push(`<p class="hv-p hv-gold">Today: the ${esc(f.name)} in town, 9am to 2pm!</p>`);
  return sheet({
    title: sum.date, small: true, noX: true, wrap: 'center',
    sub: `Year ${s.year}. ${weatherText(sum.weather)} today, ${weatherText(sum.tomorrow).toLowerCase()} tomorrow.`,
    html: `<h3 class="hv-h3" style="margin-top:0">Shipped</h3>${shipped}<div class="hv-kv"><span>Earned</span><span class="hv-gold">${fmt(sum.income)}g</span></div><div class="hv-kv"><span>Gold now</span><span class="hv-gold">${fmt(s.gold)}g</span></div>${notes.join('')}`,
    foot: '<button class="hv-btn gold" data-act="go">Good morning!</button>',
    handlers: { go: (_, p) => { p.close(true); onClose?.(); } },
  });
}

export function animalPanel(s, home) {
  const herd = s.animals.filter((a) => D.ANIMALS[a.kind].home === home);
  const cap = home === 'coop' ? D.ANIMALS.chicken.cap : D.ANIMALS.cow.cap;
  const html = herd.length ? herd.map((a) => `<div class="hv-row">${icon(D.ANIMALS[a.kind].frames[0])}<div class="grow"><div class="line"><span class="name">${esc(a.name)}</span><span class="meta">${a.product ? 'Has ' + esc(D.ITEMS[a.product].name) : ''}</span></div>
    <div class="note">Mood ${a.mood}/100${a.petted ? ', petted today' : ', wants a pat'}</div><div class="hv-bar"><i style="width:${a.mood}%"></i></div></div></div>`).join('')
    : `<p class="hv-p">No ${home === 'coop' ? 'chickens' : 'cows'} yet. Granny Wren sells them at the ranch in town.</p>`;
  return sheet({
    title: home === 'coop' ? 'Coop' : 'Barn',
    sub: `${herd.length}/${cap} animals. Hay in the trough: ${s.troughs[home]}/${herd.length}. Hay in your bag: ${s.inv.hay || 0}.`,
    html,
  });
}

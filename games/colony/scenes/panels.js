// HTML panels for Colony: settler sheets, tile info, crafting, the colony menu and log, big-event
// popups, the trader, the end screen and the new-game picker.
import { sfx, isMuted, setMuted } from '../../../shared/core/sfx.js';
import * as S from '../logic/sim.js';
import * as Wd from '../logic/world.js';
import { ITEMS, BUILDS, RECIPES, SKILLS, SKILL_NAMES, TRAITS, WORK, PLANTS, ROCKS, T, P, Z, WIN_DAYS, DAILY_DAYS, TPH, TPD, RADIO_HOURS, FUEL_MAX, DAYS_PER_SEASON } from '../logic/data.js';
import { THOUGHTS, SIT, moodTarget } from '../logic/life.js';
import { canTrade, fmt } from '../logic/story.js';
import { frameURL } from './Boot.js';
import { musicOn, setMusicOn, syncVolume } from '../music.js';

export const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (v) => `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
const bar = (v, color) => `<div class="co-bar"><i style="width:${pct(v)};${color ? `background:${color}` : ''}"></i></div>`;
const barCol = (v) => (v < 0.25 ? 'var(--red)' : v < 0.5 ? 'var(--orange)' : 'var(--leaf)');

let open = [];
let lastClose = 0;
/** True while a modal panel is open, or one closed a moment ago (so the closing tap doesn't reach the map). */
export const blocking = () => open.some((p) => p.modal) || Date.now() - lastClose < 300;
export const anyOpen = () => open.length > 0;
export const topKind = () => open[open.length - 1]?.kind;
export const isOpen = (kind) => open.some((p) => p.kind === kind);
export function closeAll() { [...open].forEach((p) => p.close(true)); }
export function closeKind(kind) { open.filter((p) => p.kind === kind).forEach((p) => p.close(true)); }

/**
 * A sheet. modal: dims the map and blocks it. once: buttons with data-once fire only once.
 */
export function sheet({ kind = '', title, big = false, face = '', sub = '', tabs = '', html = '', foot = '', cls = '', wrap = '', modal = true, noX = false, onClose, handlers = {} }) {
  const el = document.createElement('div');
  el.className = `co-wrap ${wrap} ${modal ? '' : 'clear'}`;
  el.innerHTML = `
    <div class="co-sheet ${cls}" role="dialog" aria-label="${esc(title || kind)}">
      ${title ? `<div class="co-head">${face ? `<img class="face" src="${face}" alt="">` : ''}<h2 class="${big ? 'big' : ''}">${esc(title)}</h2>${noX ? '' : '<button class="x" data-act="close" aria-label="Close">X</button>'}</div>` : ''}
      <div class="co-sub">${sub}</div>
      ${tabs ? `<div class="co-tabs">${tabs}</div>` : ''}
      <div class="co-scroll">${html}</div>
      <div class="co-foot">${foot}</div>
    </div>`;
  let fired = false;
  const p = {
    el, kind, modal,
    close(silent) {
      if (!el.isConnected) return;
      el.remove();
      open = open.filter((x) => x !== p);
      lastClose = Date.now();
      clearInterval(p.timer);
      if (!silent) sfx('tap');
      onClose?.();
    },
    last: {},
    set(part, h) {
      if (p.last[part] === h) return;
      const n = el.querySelector(`.co-${part}`);
      if (!n) return;
      const keep = part === 'scroll' ? n.scrollTop : 0;
      n.innerHTML = h; p.last[part] = h;
      if (keep) n.scrollTop = keep;
    },
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled) {
      const act = b.dataset.act;
      if (act === 'close') { p.close(); return; }
      if (b.hasAttribute('data-once')) { if (fired) return; fired = true; }
      sfx('tap');
      handlers[act]?.(b.dataset, b);
      return;
    }
    if (e.target === el && !noX && modal) p.close();
  });
  for (const t of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'wheel']) el.addEventListener(t, (e) => e.stopPropagation());
  document.body.appendChild(el);
  open.push(p);
  return p;
}

export function confirm({ title, text, yes = 'Yes', no = 'Cancel', onYes, danger = false }) {
  const p = sheet({
    kind: 'confirm', title, wrap: 'center', html: `<p class="co-p">${esc(text)}</p>`,
    foot: `<button class="co-btn ${danger ? 'red' : 'gold'}" data-act="yes" data-once>${esc(yes)}</button><button class="co-btn" data-act="close">${esc(no)}</button>`,
    handlers: { yes: () => { p.close(true); onYes(); } },
  });
  return p;
}

const icon = (g, frame, scale = 3) => `<img class="co-ico" src="${frameURL(g.game, frame, scale)}" alt="">`;
const itemIcon = (g, k) => icon(g, `i:${k}`);
const face = (g, m) => frameURL(g.game, m.kind === 'settler' ? `c${m.look}:p` : m.kind === 'raider' ? `e${m.look}:p` : m.def.sprite.startsWith('e') ? `${m.def.sprite}:p` : m.def.sprite, 5);

// ---------------------------------------------------------------- settler sheet

export function showSettler(g, id, tab = 'status') {
  closeKind('info');
  const s = g.s;
  const m = () => s.mobs.find((x) => x.id === id);
  if (!m()) return;
  let cur = tab;
  const tabs = () => ['status', 'skills', 'work', 'people'].map((t) => `<button class="${t === cur ? 'on' : ''}" data-act="tab" data-t="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('');
  const body = () => {
    const p = m();
    if (!p) return '';
    if (p.dead) return `<p class="co-p co-neg">${esc(p.name)} died: ${esc(p.cause)}.</p>`;
    if (cur === 'status') {
      const thoughts = [
        ...(p.sit || []).filter((k) => SIT[k][1] !== 0).map((k) => [SIT[k][0], SIT[k][1]]),
        ...p.thoughts.map((t) => [THOUGHTS[t.k][0], t.v]),
      ].sort((a, b) => a[1] - b[1]);
      const cond = [];
      if (p.downed) cond.push(`<span class="co-tag bad">${p.bleed ? 'Down and bleeding' : 'Down'}</span>`);
      if (p.sick) cond.push(`<span class="co-tag bad">${esc(p.sick.name)}${p.sick.kind === 'poison' ? '' : ` ${pct(p.sick.sev)}`}</span>`);
      if (p.brk) cond.push('<span class="co-tag bad">Breakdown</span>');
      if (p.cold > 0.3) cond.push('<span class="co-tag bad">Freezing</span>');
      if (p.mood > 0.85) cond.push('<span class="co-tag good">Inspired</span>');
      const gear = Object.entries(p.gear).filter(([, v]) => v).map(([, v]) => `${itemIcon(g, v)} ${ITEMS[v].name}`).join(' &nbsp; ') || '<span class="meta">No gear yet</span>';
      return `
        ${cond.length ? `<p class="co-p">${cond.join(' ')}</p>` : ''}
        <div class="co-need"><span>Food</span>${bar(p.food, barCol(p.food))}<span>${pct(p.food)}</span></div>
        <div class="co-need"><span>Rest</span>${bar(p.rest, barCol(p.rest))}<span>${pct(p.rest)}</span></div>
        <div class="co-need"><span>Mood</span>${bar(p.mood, barCol(p.mood))}<span>${pct(p.mood)}</span></div>
        <div class="co-need"><span>Health</span>${bar(p.hp / 100, barCol(p.hp / 100))}<span>${Math.round(p.hp)}</span></div>
        <div class="co-h3">Thoughts</div>
        <ul class="co-log">${thoughts.map(([t, v]) => `<li><b class="${v >= 0 ? 'co-pos' : 'co-neg'}">${v > 0 ? '+' : ''}${v}</b>${esc(t)}</li>`).join('') || '<li class="meta">Nothing much on their mind.</li>'}</ul>
        <div class="co-h3">Gear</div><p class="co-p">${gear}</p>
        <div class="co-h3">Traits</div>
        ${p.traits.map((t) => `<p class="co-p"><span class="co-tag">${esc(TRAITS[t].name)}</span>${esc(TRAITS[t].desc)}</p>`).join('')}`;
    }
    if (cur === 'skills') {
      return SKILLS.map((k) => `<div class="co-skill"><span>${SKILL_NAMES[k]}</span><b>${p.skills[k]}</b></div>${bar(p.skills[k] / 10)}`).join('<div style="height:6px"></div>')
        + `<p class="co-p" style="margin-top:10px;color:var(--lavender)">Skills grow with practice. Higher skill means faster work. Kills: ${p.kills || 0}. Joined on day ${p.joined}.</p>`;
    }
    if (cur === 'work') {
      return `<p class="co-p" style="color:var(--lavender)">Untick work they should skip. Focus puts one kind of work first.</p>`
        + WORK.map((w) => `<div class="co-row"><button class="co-check grow ${p.off[w.id] ? '' : 'on'}" data-act="work" data-w="${w.id}"><i></i><span class="grow">${esc(w.name)}${w.skill ? ` <span class="meta">(${SKILL_NAMES[w.skill]} ${p.skills[w.skill]})</span>` : ''}</span></button><button class="co-btn small ${p.focus === w.id ? 'on' : ''}" data-act="focus" data-w="${w.id}">${p.focus === w.id ? 'Focus' : 'Focus'}</button></div>`).join('');
    }
    const others = Wd.settlers(s).filter((o) => o !== p);
    if (!others.length) return '<p class="co-p meta">Nobody else to talk to.</p>';
    return others.map((o) => {
      const v = Math.round(p.rel[o.id] || 0);
      const label = v >= 75 ? 'Best friend' : v >= 30 ? 'Friend' : v <= -30 ? 'Rival' : v > 5 ? 'Friendly' : v < -5 ? 'Cold' : 'Acquaintance';
      return `<div class="co-row tap" data-act="goto" data-id="${o.id}"><img src="${face(g, o)}" alt=""><span class="grow">${esc(o.name)}<br><span class="meta">${label}</span></span><b class="${v >= 0 ? 'co-pos' : 'co-neg'}">${v > 0 ? '+' : ''}${v}</b></div>`;
    }).join('');
  };
  const sub = () => { const p = m(); return p ? `${esc(p.status || '')}${p.carry ? `, carrying ${p.carry.n} ${esc(ITEMS[p.carry.k].name.toLowerCase())}` : ''}` : ''; };
  const foot = () => `<button class="co-btn ${g.followId === id ? 'gold' : ''}" data-act="follow">${g.followId === id ? 'Following' : 'Follow'}</button>`;
  const p = sheet({
    kind: 'info', title: m().name, face: face(g, m()), sub: sub(), tabs: tabs(), html: body(), foot: foot(), cls: 'half', modal: false,
    onClose: () => { if (g.selected === id) g.select(null); },
    handlers: {
      tab: ({ t }) => { cur = t; p.set('scroll', body()); p.el.querySelector('.co-tabs').innerHTML = tabs(); p.el.querySelector('.co-scroll').scrollTop = 0; },
      work: ({ w }) => { S.toggleWork(s, id, w); p.set('scroll', body()); g.save(); },
      focus: ({ w }) => { S.setFocus(s, id, w); p.set('scroll', body()); g.save(); },
      follow: () => { g.followId = g.followId === id ? null : id; p.set('foot', foot()); },
      goto: ({ id: o }) => { g.select(+o); },
    },
  });
  p.timer = setInterval(() => {
    if (!m()) { p.close(true); return; }
    p.set('sub', sub());
    if (cur !== 'work') p.set('scroll', body());
  }, 500);
  g.tutorialEvent('settler');
  return p;
}

// ---------------------------------------------------------------- animals and raiders

export function showCreature(g, id) {
  closeKind('info');
  const s = g.s;
  const m = () => s.mobs.find((x) => x.id === id && !x.dead);
  const a = m();
  if (!a) return;
  const name = a.kind === 'raider' ? 'Goblin raider' : a.def.name;
  const body = () => {
    const x = m();
    if (!x) return '<p class="co-p">Gone.</p>';
    if (x.kind === 'raider') return `<p class="co-p">Armed with a ${esc(ITEMS[x.weapon].name.toLowerCase())}. Health ${Math.round(x.hp)}.</p><p class="co-p meta">${x.fleeing ? 'Running away.' : 'Here to raid your colony.'}</p>`;
    return `<p class="co-p">${x.hostile ? '<span class="co-tag bad">Hunting your settlers</span>' : x.hunt ? '<span class="co-tag">Marked for hunting</span>' : 'Wild.'} Health ${Math.round(x.hp)} of ${x.def.hp}.</p>
      <p class="co-p meta">Gives ${x.def.meat} meat${x.def.leather ? ` and ${x.def.leather} leather` : ''}.${x.def.fierce >= 0.3 ? ' Fights back: hunt it with a weapon.' : ''}</p>`;
  };
  const foot = () => { const x = m(); return x && x.kind === 'animal' && !x.hostile ? `<button class="co-btn ${x.hunt ? '' : 'gold'}" data-act="hunt">${x.hunt ? 'Cancel hunt' : 'Hunt'}</button>` : ''; };
  const p = sheet({
    kind: 'info', title: name, face: face(g, a), html: body(), foot: foot(), cls: 'half', modal: false,
    onClose: () => g.select(null),
    handlers: { hunt: () => { const x = m(); if (x) { S.huntAnimal(s, id, !x.hunt); sfx('select'); p.set('foot', foot()); p.set('scroll', body()); g.save(); } } },
  });
  p.timer = setInterval(() => { if (!m()) { p.close(true); return; } p.set('scroll', body()); }, 500);
}

// ---------------------------------------------------------------- a tile

export function showTile(g, i) {
  closeKind('info');
  const s = g.s;
  const parts = () => {
    const b = Wd.bAt(s, i);
    const it = s.items[i];
    const rows = [];
    let title = '';
    let foot = '';
    if (b) {
      const def = BUILDS[b.k];
      title = def.name;
      if (!b.done) {
        const need = Object.entries(def.cost).map(([k, n]) => `${itemIcon(g, k)} ${b.have[k] || 0}/${n} ${ITEMS[k].name.toLowerCase()}`).join(' &nbsp; ');
        rows.push(`<p class="co-p">Blueprint. ${Object.keys(Wd.missing(b)).length ? 'Waiting for materials.' : `Being built: ${pct(b.work / def.work)}.`}</p><p class="co-p">${need}</p>`);
        foot += '<button class="co-btn red" data-act="cancelB" data-once>Cancel</button>';
      } else {
        rows.push(`<p class="co-p meta">${esc(def.desc)}</p><p class="co-p">Condition ${pct(b.hp / def.hp)}</p>`);
        if (def.fuel) rows.push(`<p class="co-p">Wood: ${b.fuel.toFixed(1)} of ${FUEL_MAX}${b.fuel <= 0 ? ' <span class="co-tag bad">Out</span>' : ''}</p>${bar(b.fuel / FUEL_MAX)}`);
        if (b.k === 'bed') { const o = Wd.settlers(s).find((m) => m.bed === b.id); rows.push(`<p class="co-p">${o ? `${esc(o.name)}'s bed` : 'Nobody sleeps here yet.'}</p>`); }
        if (b.k === 'workbench') foot += '<button class="co-btn gold" data-act="craft">Crafting</button>';
        if (b.k === 'radio') {
          const r = s.radio;
          if (r.called) rows.push(`<p class="co-p">Rescue lands in ${Math.max(0, Math.ceil((r.rescueAt - s.t) / TPD))} days.</p>`);
          else if (r.calling) rows.push(`<p class="co-p">Calling: ${pct(r.hours / RADIO_HOURS)}</p>${bar(r.hours / RADIO_HOURS)}<p class="co-p meta">A settler is on the radio (Craft work).</p>`);
          else { rows.push(`<p class="co-p">Ready to call for rescue. Help takes ${RADIO_HOURS} hours of radio work, then ${5} days to arrive.${s.mode !== 'peaceful' ? ' Raiders may hear the call!' : ''}</p>`); foot += '<button class="co-btn gold" data-act="call" data-once>Call for rescue</button>'; }
        }
        if (s.des[i] === 'remove') foot += '<button class="co-btn" data-act="keep">Keep it</button>';
        else foot += '<button class="co-btn red" data-act="remove">Take down</button>';
      }
    } else {
      const t = s.ter[i];
      title = t === T.WATER ? 'Water' : t === T.ROCK ? 'Rock' : t === T.ORE ? 'Iron ore' : s.zone[i] === Z.FARM ? 'Farm plot' : s.zone[i] === Z.STOCK ? 'Stockpile' : s.plant[i] ? PLANTS[s.plant[i]].name : t === T.DIRT ? 'Dirt' : 'Grass';
      if (ROCKS[t]) rows.push(`<p class="co-p meta">Mine it for ${ROCKS[t].n} ${ITEMS[ROCKS[t].item].name.toLowerCase()}.</p>`);
      if (s.plant[i]) {
        const pl = PLANTS[s.plant[i]];
        rows.push(`<p class="co-p meta">${pl.order === 'chop' ? `Chop for ${pl.n} wood.` : s.pgrow[i] > 0 ? `Regrowing: ready in ${Math.ceil(s.pgrow[i] / TPD)} days.` : Wd.season(s).id === 'wi' && s.plant[i] === P.BUSH ? 'No berries in winter.' : `Harvest for ${pl.n} ${ITEMS[pl.item].name.toLowerCase()}.`}</p>`);
      }
      if (s.zone[i] === Z.FARM) rows.push(`<p class="co-p">${s.crop[i] < 0 ? (Wd.season(s).grow ? 'Waiting to be sown.' : 'Nothing grows in winter.') : s.crop[i] >= 1 ? 'Ripe corn, ready to harvest.' : `Corn growing: ${pct(s.crop[i])}`}</p>`);
      if (s.zone[i] === Z.STOCK) rows.push('<p class="co-p meta">Settlers bring loose items here.</p>');
      const d = s.des[i];
      if (d) { rows.push(`<p class="co-p"><span class="co-tag">Order: ${d}</span></p>`); foot += '<button class="co-btn" data-act="cancelD">Cancel order</button>'; }
      else if (s.plant[i] === P.TREE || s.plant[i] === P.PINE) foot += '<button class="co-btn gold" data-act="order" data-o="chop">Chop</button>';
      else if (s.plant[i] === P.BUSH || s.plant[i] === P.HERB) foot += '<button class="co-btn gold" data-act="order" data-o="harvest">Harvest</button>';
      else if (ROCKS[t]) foot += '<button class="co-btn gold" data-act="order" data-o="mine">Mine</button>';
    }
    if (it) rows.push(`<p class="co-p">${itemIcon(g, it.k)} ${it.n} ${esc(ITEMS[it.k].name.toLowerCase())}${ITEMS[it.k].rot ? ` <span class="meta">(${pct(1 - it.r)} fresh)</span>` : ''}</p>`);
    if (s.fire[i]) rows.push('<p class="co-p"><span class="co-tag bad">On fire!</span></p>');
    const temp = Wd.tileTemp(s, i);
    rows.push(`<p class="co-p meta">${Wd.isIndoors(s, i) ? 'Indoors' : 'Outdoors'}, ${Math.round(temp)}°C</p>`);
    return { title, html: rows.join(''), foot };
  };
  const first = parts();
  const p = sheet({
    kind: 'info', title: first.title, html: first.html, foot: first.foot, cls: 'half', modal: false,
    onClose: () => g.select(null),
    handlers: {
      cancelB: () => { const b = Wd.bAt(s, i); if (b && !b.done) Wd.removeBuilding(s, b); p.close(true); g.afterChange(); },
      remove: () => { S.designate(s, 'remove', [i]); refresh(); g.afterChange(); },
      keep: () => { delete s.des[i]; Wd.markTile(s, i); refresh(); g.afterChange(); },
      cancelD: () => { S.designate(s, 'cancel', [i]); refresh(); g.afterChange(); },
      order: ({ o }) => { S.designate(s, o, [i]); sfx('select'); refresh(); g.afterChange(); },
      craft: () => { p.close(true); showCraft(g); },
      call: () => { if (S.callRescue(s)) { sfx('power'); g.afterChange(); } refresh(); },
    },
  });
  const refresh = () => { const x = parts(); p.set('scroll', x.html); p.set('foot', x.foot); };
  p.timer = setInterval(refresh, 600);
  return p;
}

// ---------------------------------------------------------------- crafting

export function showCraft(g) {
  closeAll();
  const s = g.s;
  g.hold('panel');
  const body = () => {
    const bench = Wd.builtOf(s, 'workbench').length;
    const st = Wd.stock(s);
    const rows = Object.entries(RECIPES).map(([k, r]) => {
      const can = Object.entries(r.need).every(([m, n]) => (st[m] || 0) >= n);
      const need = Object.entries(r.need).map(([m, n]) => `<span class="${(st[m] || 0) >= n ? '' : 'co-neg'}">${n} ${ITEMS[m].name.toLowerCase()}</span>`).join(', ');
      return `<div class="co-row">${itemIcon(g, k)}<span class="grow">${esc(r.name)} <span class="meta">(have ${st[k] || 0})</span><br><span class="meta">${esc(r.desc)}. Needs ${need}${can ? '' : ''}</span></span>
        <button class="co-btn small" data-act="minus" data-k="${k}" ${s.bills[k] ? '' : 'disabled'} aria-label="One less">-</button><span class="co-count">${s.bills[k]}</span><button class="co-btn small" data-act="plus" data-k="${k}" ${s.bills[k] >= 20 ? 'disabled' : ''} aria-label="One more">+</button></div>`;
    }).join('');
    return `${bench ? '' : '<p class="co-p co-neg">Build a workbench first (Build menu). Orders wait until then.</p>'}<p class="co-p meta">Queue how many to make. Settlers with Craft work fetch the materials and make them.</p>${rows}`;
  };
  const p = sheet({
    kind: 'craft', title: 'Crafting', html: body(), cls: 'tall', foot: '<button class="co-btn gold" data-act="close">Done</button>',
    onClose: () => { g.release('panel'); g.save(); },
    handlers: {
      plus: ({ k }) => { S.setBill(s, k, s.bills[k] + 1); p.set('scroll', body()); },
      minus: ({ k }) => { S.setBill(s, k, s.bills[k] - 1); p.set('scroll', body()); },
    },
  });
}

// ---------------------------------------------------------------- the colony menu

export function showMenu(g) {
  closeAll();
  const s = g.s;
  g.hold('panel');
  const sum = S.summary(s);
  const goal = s.mode === 'daily'
    ? `Daily: survive to the end of day ${DAILY_DAYS}. Day ${Math.min(sum.day, DAILY_DAYS)} now. Score so far: ${S.dailyScore(s)}.`
    : s.radio.called ? `Rescue lands in ${Math.max(0, Math.ceil((s.radio.rescueAt - s.t) / TPD))} days. Hold on!`
      : `Survive ${WIN_DAYS} days (day ${sum.day} now), or build a radio and call for rescue.`;
  const html = `
    <p class="co-p">${esc(goal)}</p>
    ${bar(s.mode === 'daily' ? (sum.day - 1) / DAILY_DAYS : (sum.day - 1) / WIN_DAYS)}
    <div class="co-grid" style="margin-top:10px">
      <span>Settlers</span><b>${sum.pop}</b><span>Lost</span><b>${s.stats.deaths}</b>
      <span>Wealth</span><b>${sum.wealth}</b><span>Raids beaten</span><b>${s.stats.raidsWon}</b>
      <span>Meals cooked</span><b>${s.stats.meals}</b><span>Harvests</span><b>${s.stats.harvests}</b>
      <span>Mode</span><b>${esc(s.mode === 'daily' ? `Daily: ${S.DAILY_SCENARIOS.find((d) => d.id === s.scenario)?.name}` : s.mode === 'peaceful' ? 'Peaceful' : 'Standard')}</b>
    </div>`;
  const foot = () => `
    <button class="co-btn half" data-act="people">Settlers</button>
    <button class="co-btn half" data-act="log">Colony log</button>
    <button class="co-btn half" data-act="stock">Stock</button>
    <button class="co-btn half" data-act="sound">${isMuted() ? 'Sound: off' : 'Sound: on'}</button>
    <button class="co-btn half" data-act="music">${musicOn() ? 'Music: on' : 'Music: off'}</button>
    <button class="co-btn half" data-act="howto">How to play</button>
    <button class="co-btn red half" data-act="quit" data-once>Save and quit</button>`;
  const p = sheet({
    kind: 'menu', title: 'Colony', html, foot: foot(), cls: 'tall',
    onClose: () => g.release('panel'),
    handlers: {
      people: () => { p.close(true); showSettlers(g); },
      log: () => { p.close(true); showLog(g); },
      stock: () => { p.close(true); showStock(g); },
      sound: () => { setMuted(!isMuted()); syncVolume(); p.set('foot', foot()); },
      music: () => { setMusicOn(!musicOn()); g.syncMusic(); p.set('foot', foot()); },
      howto: () => { p.close(true); g.howTo(); },
      quit: () => { p.close(true); g.toTitle(true); },
    },
  });
}

export function showSettlers(g) {
  closeAll();
  const s = g.s;
  g.hold('panel');
  const body = () => {
    const ps = s.mobs.filter((m) => m.kind === 'settler');
    return ps.map((m) => `<div class="co-row ${m.dead ? '' : 'tap'}" ${m.dead ? '' : `data-act="pick" data-id="${m.id}"`}><img src="${face(g, m)}" alt=""><span class="grow">${esc(m.name)}<br><span class="meta">${m.dead ? `Died: ${esc(m.cause)}` : esc(m.status || '')}</span></span>${m.dead ? '' : `<span style="width:64px">${bar(m.mood, barCol(m.mood))}${bar(m.hp / 100, barCol(m.hp / 100))}</span>`}</div>`).join('');
  };
  const p = sheet({
    kind: 'people', title: 'Settlers', sub: 'Bars: mood, health. Tap someone to see them.', html: body(), cls: 'tall',
    onClose: () => g.release('panel'),
    handlers: { pick: ({ id }) => { p.close(true); g.select(+id); } },
  });
  p.timer = setInterval(() => p.set('scroll', body()), 800);
}

export function showLog(g) {
  closeAll();
  const s = g.s;
  g.hold('panel');
  const items = s.log.slice().reverse().map((l, k) => {
    const d = Math.floor(l.t / TPD) + 1;
    return `<li class="${l.kind} ${l.at != null ? 'tap' : ''}" ${l.at != null ? `data-act="jump" data-at="${l.at}"` : ''}><b>Day ${d}</b>${esc(l.text)}</li>`;
  }).join('');
  const p = sheet({
    kind: 'log', title: 'Colony log', sub: 'Underlined entries show you where it happened.', html: `<ul class="co-log">${items || '<li>Nothing yet.</li>'}</ul>`, cls: 'tall',
    onClose: () => g.release('panel'),
    handlers: { jump: ({ at }) => { p.close(true); g.jumpTo(+at); } },
  });
}

export function showStock(g) {
  closeAll();
  const s = g.s;
  g.hold('panel');
  const st = Wd.stock(s);
  const keys = Object.keys(ITEMS).filter((k) => st[k]);
  const html = keys.length ? keys.map((k) => `<div class="co-row">${itemIcon(g, k)}<span class="grow">${esc(ITEMS[k].name)}</span><b>${st[k]}</b></div>`).join('') : '<p class="co-p">Nothing at all.</p>';
  sheet({ kind: 'stock', title: 'Stock', sub: `Everything the colony owns. Food: ${Wd.foodCount(s)}.`, html, cls: 'tall', onClose: () => g.release('panel') });
}

// ---------------------------------------------------------------- big events

export function showEvent(g) {
  const s = g.s;
  const pd = s.pending;
  if (!pd) return;
  closeAll();
  sfx(pd.kind === 'raid' || pd.kind === 'wolves' ? 'error' : 'select');
  if (pd.kind === 'trader') { showTrader(g); return; }
  const choices = pd.choices.map((c, k) => `<button class="co-btn co-choice ${k === 0 ? 'gold' : ''}" data-act="pick" data-c="${c.id}" data-once>${esc(c.label)}${c.detail ? `<small>${esc(c.detail)}</small>` : ''}</button>`).join('');
  const who = pd.settler || pd.settlers?.[0];
  const p = sheet({
    kind: 'event', title: pd.title, big: true, wrap: 'center', noX: true,
    face: who ? frameURL(g.game, `c${who.look}:p`, 5) : '',
    html: `<p class="co-p">${esc(pd.text)}</p>`, foot: `<div style="width:100%">${choices}</div>`,
    handlers: { pick: ({ c }) => { p.close(true); g.resolveEvent(c); } },
  });
}

function showTrader(g) {
  const s = g.s;
  const body = () => {
    const pd = s.pending;
    if (!pd) return '';
    return `<p class="co-p">${esc(pd.text)}</p>` + pd.deals.map((d, i) => {
      const give = Object.entries(d.give).map(([k, n]) => `${itemIcon(g, k)} ${n} ${esc(ITEMS[k].name.toLowerCase())}`).join(' ');
      const get = Object.entries(d.get).map(([k, n]) => `${itemIcon(g, k)} ${n} ${esc(ITEMS[k].name.toLowerCase())}`).join(' ');
      return `<div class="co-row"><span class="grow">Give ${give}<br>Get ${get}</span><button class="co-btn small ${d.done ? '' : 'gold'}" data-act="trade" data-i="${i}" ${canTrade(s, d) ? '' : 'disabled'}>${d.done ? 'Done' : 'Trade'}</button></div>`;
    }).join('');
  };
  const p = sheet({
    kind: 'event', title: 'Trader', big: true, wrap: 'center', noX: true, cls: 'tall', html: body(),
    foot: '<button class="co-btn" data-act="leave" data-once>Done trading</button>',
    handlers: {
      trade: ({ i }, btn) => { btn.disabled = true; if (S.trade(s, +i)) sfx('coin'); p.set('scroll', body()); },
      leave: () => { p.close(true); g.resolveEvent('leave'); },
    },
  });
}

// ---------------------------------------------------------------- end of the game

export function showResult(g, r, extra = '') {
  closeAll();
  const s = g.s;
  const lost = s.mobs.filter((m) => m.kind === 'settler' && m.dead).map((m) => m.name);
  const html = `<p class="co-p">${esc(r.reason)}</p>
    <div class="co-grid">
      <span>Days</span><b>${Math.min(r.day, s.mode === 'daily' ? DAILY_DAYS : 999)}</b><span>Survivors</span><b>${r.alive}</b>
      <span>Raids beaten</span><b>${s.stats.raidsWon}</b><span>Meals</span><b>${s.stats.meals}</b>
      ${s.mode === 'daily' ? `<span>Score</span><b>${r.score}</b>` : ''}
    </div>
    ${extra}
    ${lost.length ? `<p class="co-p" style="margin-top:8px">In memory of ${esc(lost.join(', '))}.</p>` : ''}`;
  sheet({
    kind: 'result', title: r.won ? (r.how === 'rescued' ? 'Rescued!' : 'You made it!') : 'Colony lost', big: true, wrap: 'center', noX: true, html,
    foot: '<button class="co-btn gold" data-act="title" data-once>Back to title</button><button class="co-btn" data-act="look">Look around</button>',
    handlers: { title: () => g.toTitle(true), look: () => closeAll() },
  });
}

// ---------------------------------------------------------------- new game

export function showNewGame(onPick, skills) {
  const p = sheet({
    kind: 'new', title: 'New colony', wrap: 'center',
    html: '<p class="co-p">How tough should the wild be?</p>',
    foot: `<div style="width:100%">
      <button class="co-btn co-choice gold" data-act="pick" data-m="standard" data-once>Standard<small>Raids, wolves, sickness and fire. The storyteller adapts to you (level ${skills.standard}/10).</small></button>
      <button class="co-btn co-choice" data-act="pick" data-m="peaceful" data-once>Peaceful<small>No raids or wolf packs. More supplies. Gentler sickness and fire.</small></button>
    </div>`,
    handlers: { pick: ({ m }) => { p.close(true); onPick(m); } },
  });
}

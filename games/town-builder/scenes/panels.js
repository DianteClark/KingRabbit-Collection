// HTML panels for Tiny Town Builder: inspect, budget, maps, advisors, city stats, disasters,
// milestones, results and confirmations. Each one pauses the city while it is open.
import { sfx } from '../../../shared/core/sfx.js';
import * as S from '../logic/sim.js';
import { ZONE_INFO, MILESTONES, SCENARIOS, ECON } from '../logic/defs.js';
import { tips, ADVISORS } from '../logic/advisors.js';

export const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const money = (n) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
const pctBar = (v, color) => `<div class="tb-bar"><i style="width:${Math.max(0, Math.min(100, v))}%;${color ? `background:${color}` : ''}"></i></div>`;

let open = [];
let lastClose = 0;
/** True while a panel is open or was closed a moment ago (so the closing tap never reaches the map). */
export const blocking = () => open.length > 0 || Date.now() - lastClose < 250;
export const anyOpen = () => open.length > 0;
export function closeAll() { [...open].forEach((p) => p.close(true)); }

export function sheet({ title, small = false, sub = '', html = '', foot = '', cls = '', wrap = '', onClose, handlers = {}, noX = false, g, hold = true }) {
  const el = document.createElement('div');
  el.className = `tb-wrap ${wrap}`;
  el.innerHTML = `
    <div class="tb-sheet ${cls}" role="dialog" aria-label="${esc(title)}">
      <div class="tb-head"><h2 class="${small ? 'small' : ''}">${esc(title)}</h2>${noX ? '' : '<button class="x" data-act="close" aria-label="Close">X</button>'}</div>
      <div class="tb-sub">${sub}</div>
      <div class="tb-scroll">${html}</div>
      <div class="tb-foot">${foot}</div>
    </div>`;
  const key = `panel${Math.random()}`;
  if (g && hold) g.hold(key);
  let busy = false;
  const p = {
    el,
    close(silent) {
      if (!el.isConnected) return;
      el.remove();
      open = open.filter((x) => x !== p);
      lastClose = Date.now();
      clearInterval(p.timer);
      if (g && hold) g.release(key);
      if (!silent) sfx('tap');
      onClose?.();
    },
    last: {},
    set(part, h) { if (p.last[part] === h) return; const n = el.querySelector(`.tb-${part}`); if (n) { n.innerHTML = h; p.last[part] = h; } },
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled) {
      if (busy) return; // one action per tap, even if the browser sends two clicks
      busy = true; setTimeout(() => { busy = false; }, 120);
      const act = b.dataset.act;
      if (act === 'close') { p.close(); return; }
      if (!b.dataset.silent) sfx('tap');
      handlers[act]?.(b.dataset, b);
      return;
    }
    if (e.target === el && !noX) p.close();
  });
  for (const t of ['pointerdown', 'pointerup', 'pointermove', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'touchmove', 'wheel']) el.addEventListener(t, (e) => e.stopPropagation());
  document.body.appendChild(el);
  open.push(p);
  return p;
}

export function confirm({ title, text, yes = 'Yes', no = 'Cancel', onYes, g, danger = false }) {
  const p = sheet({
    title, g, wrap: 'center', html: `<p class="tb-p">${esc(text)}</p>`,
    foot: `<button class="tb-btn cream" data-act="close">${esc(no)}</button><button class="tb-btn ${danger ? 'red' : 'gold'}" data-act="yes">${esc(yes)}</button>`,
    handlers: { yes: () => { p.close(true); onYes(); } },
  });
  return p;
}

// ---------------------------------------------------------------- inspect

export function showInfo(g, x, y) {
  closeAll();
  const s = g.s;
  const render = () => {
    const inf = S.info(s, x, y);
    if (!inf) return null;
    const warn = inf.warn.map((w) => `<p class="tb-warn">${esc(w)}</p>`).join('');
    const stats = inf.stats.map(([k, v]) => `<span>${esc(k)}</span><b class="num">${esc(v)}</b>`).join('');
    const appeal = inf.appeal != null ? `<p class="tb-p">Appeal ${inf.appeal}%</p>${pctBar(inf.appeal, inf.appeal < 30 ? 'var(--red)' : inf.appeal < 50 ? 'var(--orange)' : 'var(--leaf)')}` : '';
    const html = `${inf.fire ? '<p class="tb-warn">ON FIRE!</p>' : ''}${inf.main ? `<p class="tb-p">${esc(inf.main)}</p>` : ''}${warn}${appeal}<div class="tb-stats">${stats}</div>`;
    const foot = inf.b ? `<button class="tb-btn red" data-act="doze">Bulldoze ${money(S.planBulldoze(s, [{ x: inf.b.x, y: inf.b.y }]).cost)}</button><button class="tb-btn cream" data-act="close">Close</button>` : '<button class="tb-btn cream" data-act="close">Close</button>';
    return { inf, html, foot };
  };
  const first = render();
  if (!first) return;
  const p = sheet({
    title: first.inf.title, small: first.inf.title.length > 18, cls: 'half', g, html: first.html, foot: first.foot,
    handlers: {
      doze: () => {
        const b = S.bldAt(s, x, y);
        if (!b) return;
        const res = S.bulldoze(s, [{ x: b.x, y: b.y }]);
        if (res.ok) { sfx('smallBoom'); g.afterChange(); p.close(true); } else { sfx('error'); g.toast(res.reason); }
      },
    },
  });
  p.timer = setInterval(() => { const r = render(); if (r) { p.set('scroll', r.html); } }, 500);
}

// ---------------------------------------------------------------- budget

export function showBudget(g) {
  closeAll();
  const s = g.s;
  const render = () => {
    const b = S.budget(s);
    const inc = b.income.map(([k, v]) => `<div class="tb-row"><span class="grow">${esc(k)}</span><span class="num">${money(v)}</span></div>`).join('');
    const taxes = ['R', 'C', 'I'].map((z) => `<div class="tb-row"><span class="grow" style="color:${ZONE_INFO[z].css}">${ZONE_INFO[z].name}</span>
      <button class="tb-btn sq" data-act="tax" data-z="${z}" data-d="-1" ${s.tax[z] <= 0 ? 'disabled' : ''} aria-label="Lower">-</button><span class="val">${s.tax[z]}%</span>
      <button class="tb-btn sq" data-act="tax" data-z="${z}" data-d="1" ${s.tax[z] >= 20 ? 'disabled' : ''} aria-label="Raise">+</button></div>`).join('');
    const funds = b.expense.filter(([, , k]) => k !== 'loan').map(([label, v, k]) => `<div class="tb-row"><span class="grow">${esc(label)}<br><span class="meta">${money(v)}</span></span>
      <button class="tb-btn sq" data-act="fund" data-k="${k}" data-d="-10" ${s.fund[k] <= 0 ? 'disabled' : ''} aria-label="Less">-</button><span class="val">${s.fund[k]}%</span>
      <button class="tb-btn sq" data-act="fund" data-k="${k}" data-d="10" ${s.fund[k] >= 150 ? 'disabled' : ''} aria-label="More">+</button></div>`).join('');
    const loans = s.loans.map((l, i) => `<div class="tb-row"><span class="grow">Loan: ${money(l.pay)} a month<br><span class="meta">${l.left} months left</span></span>
      <button class="tb-btn" data-act="repay" data-i="${i}" ${s.money < S.loanPayoff(l) ? 'disabled' : ''}>Repay ${money(S.loanPayoff(l))}</button></div>`).join('');
    const sc = S.scenario(s);
    const html = `
      <div class="tb-row"><span class="grow">Money</span><span class="num" style="color:${s.money < 0 ? '#f3b0a8' : 'var(--gold)'}">${money(s.money)}</span></div>
      <div class="tb-row"><span class="grow">Each month</span><span class="num ${b.net < 0 ? 'tb-bad' : 'tb-good'}">${b.net >= 0 ? '+' : ''}${money(b.net)}</span></div>
      <h3 class="tb-h3">Income ${money(b.tin)}</h3>${inc}
      <h3 class="tb-h3">Tax rates</h3><p class="tb-p meta" style="color:var(--lavender)">Lower taxes bring people in; higher taxes slow growth.</p>${taxes}
      <h3 class="tb-h3">Spending ${money(b.tout)}</h3><p class="tb-p" style="color:var(--lavender)">Funding below 100% saves money but services reach less far.</p>${funds}
      <h3 class="tb-h3">Loans</h3>${loans || '<p class="tb-p" style="color:var(--lavender)">No loans.</p>'}
      ${sc?.noDebt ? '<p class="tb-warn">Scenario goal: no loans and no debt when you reach the target.</p>' : ''}
      <button class="tb-btn gold" style="width:100%;margin-top:8px" data-act="loan" ${s.loans.length >= ECON.maxLoans ? 'disabled' : ''}>Take a ${money(ECON.loanAmount)} loan<small>${money(ECON.loanAmount * (1 + ECON.loanRate) / ECON.loanMonths)} a month for 5 years</small></button>`;
    return html;
  };
  const p = sheet({
    title: 'Budget', g, html: render(),
    handlers: {
      tax: ({ z, d }) => { S.setTax(s, z, s.tax[z] + +d); p.set('scroll', render()); g.refreshHud(); },
      fund: ({ k, d }) => { S.setFund(s, k, s.fund[k] + +d); S.refresh(s); p.set('scroll', render()); },
      loan: () => { if (S.takeLoan(s)) { sfx('coin'); g.save(); p.set('scroll', render()); g.refreshHud(); } },
      repay: ({ i }) => { if (S.repayLoan(s, +i)) { sfx('coin'); g.save(); p.set('scroll', render()); g.refreshHud(); } else sfx('error'); },
    },
  });
}

// ---------------------------------------------------------------- maps

export function showMaps(g) {
  closeAll();
  const cur = g.overlay;
  const btn = (k, label) => `<button class="tb-btn ${cur === k ? 'on' : ''}" data-act="pick" data-k="${k}">${esc(label)}</button>`;
  const html = `<p class="tb-p">Color the map to see where things are good (green) or bad (red).</p>
    <div class="tb-grid">${btn('', 'Normal map')}${Object.entries(S.OVERLAYS).map(([k, l]) => btn(k, l)).join('')}</div>`;
  const p = sheet({ title: 'Maps', g, html, handlers: { pick: ({ k }) => { g.setOverlay(k); p.close(true); } } });
}

// ---------------------------------------------------------------- advisors

export function showAdvisors(g) {
  closeAll();
  const list = tips(g.s).slice(0, 8);
  const html = list.map((t) => {
    const a = ADVISORS[t.who];
    return `<div class="tb-tip"><div class="dot" style="background:${a.color}"></div><div><b style="color:${a.color}">${esc(a.name)}</b>${esc(t.text)}</div></div>`;
  }).join('');
  sheet({ title: 'Advisors', g, html, foot: '<button class="tb-btn cream" data-act="close">Thanks</button>' });
}

// ---------------------------------------------------------------- city stats

function chart(hist, key, color) {
  if (hist.length < 2) return '<p class="tb-p" style="color:var(--lavender)">The chart starts after a month or two.</p>';
  const vals = hist.map((h) => h[key]);
  const lo = Math.min(0, ...vals); const hi = Math.max(1, ...vals);
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * 300},${76 - ((v - lo) / (hi - lo)) * 72}`).join(' ');
  const zero = lo < 0 ? `<line x1="0" x2="300" y1="${76 - ((0 - lo) / (hi - lo)) * 72}" y2="${76 - ((0 - lo) / (hi - lo)) * 72}" stroke="#a13d3b" stroke-width="1"/>` : '';
  return `<svg class="tb-chart" viewBox="0 0 300 80" preserveAspectRatio="none">${zero}<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"/></svg>`;
}

export function showStats(g) {
  closeAll();
  const s = g.s;
  const render = () => {
    const ms = S.milestone(s); const nx = S.nextMilestone(s);
    const prog = nx ? ((s.pop - ms.pop) / (nx.pop - ms.pop)) * 100 : 100;
    const h = S.happiness(s);
    const names = { services: 'Services', pollution: 'Pollution', crime: 'Crime', taxes: 'Taxes', jobs: 'Jobs', power: 'Power', water: 'Water', traffic: 'Traffic', landmarks: 'Landmarks' };
    const parts = Object.entries(h.parts).filter(([, v]) => Math.abs(v) >= 0.5)
      .map(([k, v]) => `<span>${names[k]}</span><b class="num ${v < 0 ? 'tb-bad' : 'tb-good'}">${v > 0 ? '+' : ''}${Math.round(v)}</b>`).join('');
    const jobs = s.jobs.C + s.jobs.I + s.jobs.F;
    const r = S.rt(s);
    const g2 = S.goalStatus(s);
    const goal = g2 ? `<h3 class="tb-h3">Goal: ${esc(g2.sc.name)}</h3>${g2.items.map((it) => `<p class="tb-p ${it.done ? 'tb-good' : ''}">${it.done ? '[x]' : '[ ]'} ${esc(it.label)}</p>`).join('')}
      <p class="tb-p" style="color:var(--lavender)">${s.result ? (s.result.won ? 'Scenario won!' : 'Scenario over.') : `${Math.max(0, g2.monthsLeft)} months left`}</p>` : '';
    return `${goal}
      <h3 class="tb-h3">${esc(ms.name)}: ${s.pop.toLocaleString('en-US')} people</h3>
      ${nx ? `<p class="tb-p" style="color:var(--lavender)">${(nx.pop - s.pop).toLocaleString('en-US')} more to become a ${esc(nx.name)}</p>${pctBar(prog)}` : '<p class="tb-p tb-good">The biggest it gets. Well done, Mayor!</p>'}
      ${chart(s.hist, 'pop', '#e3d245')}
      <h3 class="tb-h3">Happiness ${Math.round(s.happy)}%</h3>${pctBar(s.happy, s.happy < 40 ? 'var(--red)' : s.happy < 60 ? 'var(--orange)' : 'var(--leaf)')}
      <div class="tb-stats"><span>Starting point</span><b class="num">55</b>${parts}</div>
      <h3 class="tb-h3">Work</h3>
      <div class="tb-stats"><span>Workers</span><b class="num">${s.workers.toLocaleString('en-US')}</b><span>Jobs (shops / industry / farms)</span><b class="num">${s.jobs.C} / ${s.jobs.I} / ${s.jobs.F}</b>
      <span>Out of work</span><b class="num">${Math.max(0, s.workers - jobs).toLocaleString('en-US')}</b>
      <span>Power used</span><b class="num ${r.need > r.supply ? 'tb-bad' : ''}">${Math.round(r.need)} / ${Math.round(r.supply)}</b></div>
      <h3 class="tb-h3">Money</h3>${chart(s.hist, 'money', '#6ec05a')}`;
  };
  const p = sheet({ title: 'Your City', g, html: render() });
  p.timer = setInterval(() => p.set('scroll', render()), 1000);
}

// ---------------------------------------------------------------- RCI explained

export function showDemand(g) {
  closeAll();
  const s = g.s;
  const row = (z) => {
    const v = s.demand[z];
    const word = v > 0.5 ? 'Wanted a lot' : v > 0.1 ? 'Wanted' : v > -0.1 ? 'About right' : 'Too much';
    return `<div class="tb-row"><span class="grow" style="color:${ZONE_INFO[z].css}">${ZONE_INFO[z].name}</span><span class="num">${word}</span></div>`;
  };
  sheet({
    title: 'Demand', g, cls: 'half',
    html: `<p class="tb-p">What people want more of. Zone more of what is wanted. Low taxes raise demand, high taxes lower it.</p>${['R', 'C', 'I', 'F'].map(row).join('')}`,
    foot: '<button class="tb-btn cream" data-act="close">OK</button>',
  });
}

// ---------------------------------------------------------------- disasters

export function showRisks(g) {
  closeAll();
  const s = g.s;
  const sandbox = s.mode === 'sandbox';
  const render = () => `
    <p class="tb-p">Disasters are off by default for a calm game. Fire stations put out fires; police drive off UFOs.</p>
    <button class="tb-btn ${s.dis ? 'gold' : 'cream'}" style="width:100%" data-act="toggle">Random disasters: ${s.dis ? 'ON' : 'OFF'}</button>
    ${sandbox ? `<h3 class="tb-h3">Start one now</h3><div class="tb-grid">
      ${[['fire', 'Fire'], ['quake', 'Earthquake'], ['meteor', 'Meteor'], ['tornado', 'Tornado'], ['ufo', 'UFO']].map(([k, l]) => `<button class="tb-btn red" data-act="go" data-k="${k}" ${s.blds.length && !s.active.length ? '' : 'disabled'}>${l}</button>`).join('')}
    </div>${s.blds.length ? '' : '<p class="tb-p" style="color:var(--lavender)">Build something first.</p>'}` : ''}`;
  const p = sheet({
    title: 'Disasters', g, html: render(),
    handlers: {
      toggle: () => { s.dis = !s.dis; g.save(); p.set('scroll', render()); },
      go: ({ k }) => { p.close(true); g.startDisaster(k); },
    },
  });
}

// ---------------------------------------------------------------- milestones and results

export function showMilestone(g, ev) {
  const m = MILESTONES[ev.ms];
  const list = ev.unlocks.map((u) => `<li>${esc(u)}</li>`).join('');
  sfx('win');
  sheet({
    title: `${m.name}!`, g, wrap: 'center',
    html: `<p class="tb-big">${s0(g.s.pop)} people</p><p class="tb-p">Your town has grown into a ${esc(m.name)}. New things to build:</p><ul>${list}</ul>`,
    foot: '<button class="tb-btn gold" data-act="close">Great!</button>',
  });
}
const s0 = (n) => n.toLocaleString('en-US');
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
/** 27 -> "2 years and 3 months". */
export function span(months) {
  const y = Math.floor(months / 12); const m = months % 12;
  if (!y) return plural(Math.max(1, m), 'month');
  return m ? `${plural(y, 'year')} and ${plural(m, 'month')}` : plural(y, 'year');
}

export function showResult(g, won, reason) {
  closeAll();
  const s = g.s; const sc = S.scenario(s);
  const html = won
    ? `<p class="tb-big">You did it!</p><p class="tb-p">${esc(sc.name)} complete in ${span(s.result?.t ?? Math.floor(s.t))}, with ${s0(s.pop)} people.</p><p class="tb-p">Keep building this city for fun, or go back and try another scenario.</p>`
    : `<p class="tb-big">${reason === 'debt' ? 'Bankrupt' : 'Time is up'}</p><p class="tb-p">${reason === 'debt' ? 'The city was in debt for a whole year, so the state took over the budget.' : `The goal was: ${esc(sc.goal)}`}</p><p class="tb-p">You reached ${s0(s.pop)} people. Try again: the map is the same, so you can plan ahead.</p>`;
  sfx(won ? 'win' : 'lose');
  const p = sheet({
    title: won ? 'Scenario won' : 'Scenario lost', g, wrap: 'center', noX: true, html,
    foot: won ? '<button class="tb-btn cream" data-act="title">Title</button><button class="tb-btn gold" data-act="keep">Keep building</button>'
      : '<button class="tb-btn cream" data-act="title">Title</button><button class="tb-btn cream" data-act="keep">Keep playing</button><button class="tb-btn gold" data-act="retry">Try again</button>',
    handlers: {
      keep: () => { p.close(true); S.keepGoing(s); g.save(); g.refreshHud(); },
      title: () => { closeAll(); g.toTitle(); },
      retry: () => { closeAll(); g.restart(s.mode); },
    },
  });
}

// ---------------------------------------------------------------- title screen: scenarios

export function showScenarios(onPick, best) {
  closeAll();
  const html = Object.values(SCENARIOS).map((sc) => {
    const b = best[sc.id];
    return `<div class="tb-scen"><h3>${esc(sc.name)}</h3><p>${esc(sc.blurb)}</p>
      ${b ? `<p class="tb-good">Won in ${span(b.months)}</p>` : '<p style="color:var(--lavender)">Not won yet</p>'}
      <button class="tb-btn gold" style="width:100%" data-act="pick" data-id="${sc.id}">Play</button></div>`;
  }).join('');
  const p = sheet({ title: 'Scenarios', html, handlers: { pick: ({ id }) => { p.close(true); onPick(id); } } });
}


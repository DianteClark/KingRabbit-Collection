// HTML panels for City Chief: incidents, big events, the force, cases, budget, newspaper, day end.
import { sfx } from '../../../shared/core/sfx.js';
import * as S from '../logic/sim.js';
import { DISTRICTS } from '../logic/city.js';
import { RANKS, GROUP_TYPES, MAYOR } from '../logic/data.js';

const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (n) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
const bar = (v, color) => `<div class="cc-bar"><i style="width:${Math.max(0, Math.min(100, v))}%;${color ? `background:${color}` : ''}"></i></div>`;

let open = [];
let lastClose = 0;
/** True while a panel is open or was closed a moment ago (so the closing tap doesn't reach the map). */
export const blocking = () => open.length > 0 || Date.now() - lastClose < 250;

/** Close every panel (optionally except the one passed). */
export function closeAll() { [...open].forEach((p) => p.close(true)); }
export const anyOpen = () => open.length > 0;

function sheet({ title, sub = '', html = '', foot = '', cls = '', wrap = '', onClose, handlers = {}, noX = false }) {
  const el = document.createElement('div');
  el.className = `cc-wrap ${wrap}`;
  el.innerHTML = `
    <div class="cc-sheet ${cls}" role="dialog" aria-label="${esc(title)}">
      ${title ? `<div class="cc-head"><h2>${esc(title)}</h2>${noX ? '' : '<button class="x" data-act="close" aria-label="Close">X</button>'}</div>` : ''}
      <div class="cc-sub">${sub}</div>
      <div class="cc-scroll">${html}</div>
      <div class="cc-foot">${foot}</div>
    </div>`;
  const p = {
    el,
    close(silent) {
      if (!el.isConnected) return;
      el.remove();
      open = open.filter((x) => x !== p);
      lastClose = Date.now();
      clearInterval(p.timer);
      if (!silent) sfx('tap');
      onClose?.();
    },
    set(part, h) { const n = el.querySelector(`.cc-${part}`); if (n && n.innerHTML !== h) n.innerHTML = h; },
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled) {
      const act = b.dataset.act;
      if (act === 'close') { p.close(); return; }
      sfx('tap');
      handlers[act]?.(b.dataset);
      return;
    }
    if (e.target === el && !noX && !wrap.includes('clear')) p.close();
  });
  for (const t of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'wheel']) el.addEventListener(t, (e) => e.stopPropagation());
  document.body.appendChild(el);
  open.push(p);
  return p;
}

// ---------------------------------------------------------------- incidents

const STATUS = { new: 'Waiting for a car', enroute: 'Cars on the way', scene: 'Officers on scene', chase: 'CAR CHASE', done: 'Closed' };

function incidentParts(g, inc) {
  const s = g.s;
  const units = inc.units.map((id) => s.units.find((u) => u.id === id)).filter(Boolean);
  const crews = units.map((u) => `Unit ${u.id} (${u.crew.map((id) => S.label(s.officers.find((o) => o.id === id))).join(' &amp; ') || 'empty'})`);
  const free = S.freeUnits(s).length;
  const outcome = inc.outcome ? `<span class="cc-tag ${inc.outcome === 'solved' ? 'good' : 'bad'}">${inc.outcome === 'solved' ? 'Solved' : 'Failed'}</span>` : '';
  const sub = `${esc(S.streetAt(inc.door))}, ${esc(S.districtName(inc.district))} &middot; ${STATUS[inc.status]} ${outcome}`;
  const auto = inc.units.length && !inc.chief ? '<p class="cc-p" style="color:var(--orange)">The dispatcher sent one car. Is that enough?</p>' : '';
  const log = inc.log.slice().reverse().map((l) => `<li><b>${S.clock(l.t)}</b>${esc(l.text)}</li>`).join('');
  const html = `
    <p class="cc-p">${esc(inc.text)}</p>
    ${auto}<p class="cc-p" style="color:var(--lavender)">${crews.length ? `Responding: ${crews.join(', ')}` : 'No cars assigned yet.'}</p>
    <ul class="cc-log">${log}</ul>`;
  const done = inc.status === 'done';
  const first = !inc.units.length;
  const sendBtns = done ? '' : [1, 2, 3].map((n) => `<button class="cc-btn ${n === 1 ? 'gold' : ''}" data-act="send" data-n="${n}" ${free < n ? 'disabled' : ''}>Send ${n}${first ? '' : ' more'}<small>${n === 1 ? `${free} free` : ''}&nbsp;</small></button>`).join('');
  const foot = `${sendBtns}<button class="cc-btn" data-act="follow">Watch</button>`;
  return { sub, html, foot };
}

export function showIncident(g, incId) {
  closeAll();
  const inc = () => g.s.incidents.find((i) => i.id === incId);
  const first = inc();
  if (!first) return;
  const waiting = !first.chief && first.status !== 'done' && first.status !== 'chase';
  if (waiting) g.hold('incident');
  const parts = incidentParts(g, first);
  const p = sheet({
    title: first.name, cls: 'half', wrap: 'clear', ...parts,
    onClose: () => g.release('incident'),
    handlers: {
      send: ({ n }) => {
        const sent = S.dispatch(g.s, incId, +n, true);
        if (sent) sfx('select');
        g.release('incident');
        g.save();
        refresh();
      },
      follow: () => { g.follow({ inc: incId }); p.close(); },
    },
  });
  const refresh = () => {
    const i = inc();
    if (!i) { p.close(true); return; }
    const x = incidentParts(g, i);
    p.set('sub', x.sub); p.set('scroll', x.html); p.set('foot', x.foot);
  };
  p.timer = setInterval(refresh, 400);
}

// ---------------------------------------------------------------- first day

export function showWelcome(g) {
  closeAll();
  g.hold('welcome');
  const s = g.s;
  const p = sheet({
    title: 'Welcome, Chief', wrap: 'center', noX: true,
    sub: s.mode === 'endless' ? 'Endless mode: take it easy' : 'Career: keep your job',
    html: `<p class="cc-p">Tiny Town is yours to protect. The city runs on its own; you make the calls that matter.</p>
      <ul class="cc-log">
        <li><b>1</b>Markers show calls. A bouncing one is a big call you haven't looked at. Tap it, read the clues and send backup.</li>
        <li><b>2</b>The dispatcher sends one car to everything. Small calls usually need just that.</li>
        <li><b>3</b>Big events stop the clock and wait for your decision.</li>
        <li><b>4</b>Watch Safety, the Mayor's trust and Morale at the top.${s.mode === 'career' ? ' If Safety or the Mayor\'s trust hits zero, you\'re fired.' : ''}</li>
        <li><b>5</b>Drag to look around, pinch to zoom. Speed up time with the 1x button.</li>
      </ul>`,
    foot: '<button class="cc-btn gold" data-act="go">Start the shift</button>',
    handlers: { go: () => { s.welcomed = true; g.save(); p.close(true); g.release('welcome'); g.toast('Day 1. Good luck, Chief.'); } },
  });
}

// ---------------------------------------------------------------- big events

export function showMajor(g) {
  closeAll();
  const s = g.s;
  const m = s.pendingMajor;
  if (!m) return;
  g.hold('major');
  sfx('error');
  const free = S.committable(s).length;
  const choices = m.choices.map((c, i) => `<button class="cc-btn cc-choice ${i === 0 ? 'gold' : ''}" data-act="pick" data-i="${i}">${esc(c.label)}<small>${esc(c.detail)}${c.units > free ? ` (only ${free} free)` : ''}</small></button>`).join('');
  const p = sheet({
    title: m.title, wrap: 'center', noX: true,
    sub: `${esc(S.districtName(m.district))} &middot; ${free} cars you can send`,
    html: `<p class="cc-p">${esc(m.text)}</p>${choices}`,
    handlers: {
      pick: ({ i }) => {
        g.follow({ door: m.door });
        const res = S.resolveMajor(s, +i);
        if (res.chaseInc) g.follow({ inc: res.chaseInc });
        sfx(res.chase ? 'power' : res.ok ? 'win' : 'lose');
        g.save();
        p.set('sub', res.chase ? '<span class="cc-tag alert">Pursuit!</span>' : res.ok ? '<span class="cc-tag good">It worked</span>' : '<span class="cc-tag bad">It went wrong</span>');
        p.set('scroll', `<p class="cc-p">${esc(res.text)}</p>`);
        p.set('foot', '<button class="cc-btn gold" data-act="done">Back to the city</button>');
      },
      done: () => { p.close(true); g.release('major'); g.afterMajor(); },
    },
  });
}

// ---------------------------------------------------------------- the force

const ZONES = [null, ...DISTRICTS.map((d) => d.id)];

function forceHtml(s) {
  const units = s.units.map((u) => {
    const crew = u.crew.map((id) => s.officers.find((o) => o.id === id)).filter(Boolean);
    const task = { patrol: 'Patrolling', return: 'Patrolling', respond: 'Responding', scene: 'On a call', chase: 'In a chase', event: 'Big event' }[u.task.type];
    return `<div class="cc-row"><div class="grow"><div class="name">Car ${u.id}: ${crew.length ? crew.map((o) => esc(S.label(o))).join(' &amp; ') : '<span class="cc-tag bad">No driver</span>'}</div>
      <div class="meta">${task}</div></div>
      <button class="cc-btn" data-act="zone" data-u="${u.id}">${u.zone ? esc(S.districtName(u.zone)) : 'Citywide'}</button></div>`;
  }).join('');
  const people = s.officers.filter((o) => o.status === 'active')
    .sort((a, b) => ['sergeant', 'detective', 'officer', 'rookie'].indexOf(a.rank) - ['sergeant', 'detective', 'officer', 'rookie'].indexOf(b.rank))
    .map((o) => {
      const tags = [];
      if (o.injured) tags.push(`<span class="cc-tag bad">Injured ${o.injured}d</span>`);
      if (o.rideAlong != null) tags.push('<span class="cc-tag alert">Ride-along</span>');
      if (o.caseId != null) tags.push('<span class="cc-tag">On a case</span>');
      return `<div class="cc-row"><div class="grow"><div class="name">${esc(RANKS[o.rank].title)} ${esc(o.name)} ${tags.join('')}</div>
        <div class="meta">${Math.floor(o.years)} yrs &middot; ${o.solved}/${o.calls} calls solved &middot; ${S.salaryOf(s, o)}/day</div>
        <div style="display:flex;gap:8px"><div style="flex:1">Skill${bar(o.skill / 1.6 * 100)}</div><div style="flex:1">Morale${bar(o.morale, o.morale < 35 ? 'var(--red)' : 'var(--leaf)')}</div></div></div></div>`;
    }).join('');
  const lost = s.officers.filter((o) => o.status !== 'active').map((o) => `<div class="meta">${esc(o.name)}: ${o.status === 'dead' ? 'killed in the line of duty' : 'retired'}</div>`).join('');
  return `<h3 class="cc-h3">Squad cars (${s.cars})</h3>
    <p class="cc-p" style="color:var(--lavender)">Tap a car's area to keep it patrolling there. Patrols lower crime where they drive and get to calls faster.</p>${units}
    <h3 class="cc-h3">Officers</h3>${people}${lost ? `<h3 class="cc-h3">Remembered</h3>${lost}` : ''}`;
}

export function showForce(g) {
  closeAll();
  const p = sheet({
    title: 'The force', html: forceHtml(g.s),
    sub: `${S.activeOfficers(g.s).length} officers fit for duty, ${g.s.cars} cars`,
    handlers: {
      zone: ({ u }) => {
        const unit = g.s.units.find((x) => x.id === +u);
        unit.zone = ZONES[(ZONES.indexOf(unit.zone) + 1) % ZONES.length];
        if (unit.task.type === 'patrol') unit.path = [];
        g.save();
        p.set('scroll', forceHtml(g.s));
      },
    },
  });
}

// ---------------------------------------------------------------- cases

function casesHtml(s) {
  const groups = s.groups.map((gr) => {
    const dets = gr.detectives.map((id) => S.label(s.officers.find((o) => o.id === id))).join(', ');
    return `<div class="cc-row"><div class="grow">
      <div class="name">${esc(gr.name)} <span class="cc-tag">${esc(GROUP_TYPES[gr.type].title)}</span></div>
      <div class="meta">${esc(S.districtName(gr.district))} &middot; ${dets ? `Working it: ${esc(dets)}` : 'Nobody is on this case'}</div>
      <div style="display:flex;gap:8px"><div style="flex:1">Strength${bar(gr.strength, 'var(--red)')}</div><div style="flex:1">Case${bar(gr.case, 'var(--leaf)')}</div></div></div>
      ${gr.raidReady ? `<button class="cc-btn red" data-act="raid" data-g="${gr.id}">Raid!</button>` : ''}</div>`;
  }).join('') || '<p class="cc-p">No organised crime in town right now. Keep crime low and patrols out, and it stays that way.</p>';
  const dets = s.officers.filter((o) => o.status === 'active' && o.rank === 'detective');
  const detRows = dets.map((o) => {
    const gname = s.groups.find((x) => x.id === o.caseId)?.name;
    const rookie = s.officers.find((r) => r.rideAlong === o.id && r.status === 'active');
    return `<div class="cc-row"><div class="grow"><div class="name">${esc(S.label(o))}${o.injured ? ' <span class="cc-tag bad">Injured</span>' : ''}</div>
      <div class="meta">${rookie ? `Ride-along: ${esc(S.label(rookie))}` : 'Working alone'}</div></div>
      <button class="cc-btn" data-act="case" data-o="${o.id}">${gname ? esc(gname) : 'No case'}</button></div>`;
  }).join('') || '<p class="cc-p">You have no detectives. Promote experienced officers when they earn it.</p>';
  const rookies = s.officers.filter((o) => o.status === 'active' && o.rank === 'rookie');
  const rkRows = rookies.map((r) => {
    const d = s.officers.find((o) => o.id === r.rideAlong);
    return `<div class="cc-row"><div class="grow"><div class="name">${esc(S.label(r))}</div><div class="meta">${d ? 'Learns fast, but it is dangerous work' : 'On patrol'}</div></div>
      <button class="cc-btn" data-act="ride" data-o="${r.id}">${d ? `With ${esc(S.label(d))}` : 'Patrol'}</button></div>`;
  }).join('');
  return `<p class="cc-p" style="color:var(--lavender)">Gangs grow when nobody works their case. Put detectives on them; when a case is full you can raid.</p>
    ${groups}<h3 class="cc-h3">Detectives</h3>${detRows}${rkRows ? `<h3 class="cc-h3">Rookie ride-alongs</h3>${rkRows}` : ''}`;
}

export function showCases(g) {
  closeAll();
  const s = g.s;
  const p = sheet({
    title: 'Cases', html: casesHtml(s), sub: `${s.groups.length} crime group${s.groups.length === 1 ? '' : 's'} in town`,
    handlers: {
      case: ({ o }) => {
        const det = s.officers.find((x) => x.id === +o);
        const ids = [null, ...s.groups.map((x) => x.id)];
        const next = ids[(ids.indexOf(det.caseId) + 1) % ids.length];
        if (next == null) { for (const gr of s.groups) gr.detectives = gr.detectives.filter((id) => id !== det.id); det.caseId = null; } else S.assignDetective(s, det.id, next);
        g.save(); p.set('scroll', casesHtml(s));
      },
      ride: ({ o }) => {
        const r = s.officers.find((x) => x.id === +o);
        const dets = [null, ...s.officers.filter((x) => x.status === 'active' && x.rank === 'detective').map((x) => x.id)];
        S.setRideAlong(s, r.id, dets[(dets.indexOf(r.rideAlong ?? null) + 1) % dets.length]);
        g.save(); p.set('scroll', casesHtml(s));
      },
      raid: ({ g: gid }) => { p.close(true); if (S.planRaid(s, +gid)) showMajor(g); },
    },
  });
}

// ---------------------------------------------------------------- budget

function budgetHtml(s) {
  const pay = S.payroll(s);
  const items = S.SHOP.map((it) => {
    const c = it.cost(s);
    const lvl = it.level ? ` (level ${s[it.level]}/3)` : '';
    return `<div class="cc-row"><div class="grow"><div class="name">${esc(it.label)}${lvl}</div><div class="meta">${esc(it.detail)}</div></div>
      <button class="cc-btn ${c != null && s.money >= c ? 'gold' : ''}" data-act="buy" data-id="${it.id}" ${c == null || s.money < c ? 'disabled' : ''}>${c == null ? (it.id === 'outreach' ? 'Done today' : 'Max') : money(c)}</button></div>`;
  }).join('');
  return `<div class="cc-stats"><div><span>In the bank</span><br>${money(s.money)}</div><div><span>City budget</span><br>${money(s.budget)}/day</div>
    <div><span>Wages and cars</span><br>${money(pay)}/day</div><div><span>Each day</span><br>${money(s.budget - pay)}</div></div>
    <p class="cc-p" style="color:var(--lavender);margin-top:8px">Meet ${MAYOR} every 3 days for more funding. ${s.mode === 'career' ? 'Below -$2,500 the council takes over.' : ''}</p>${items}`;
}

export function showBudget(g) {
  closeAll();
  const p = sheet({
    title: 'Budget', html: budgetHtml(g.s),
    handlers: { buy: ({ id }) => { if (S.buy(g.s, id)) { sfx('coin'); g.save(); g.refreshHud(); } p.set('scroll', budgetHtml(g.s)); } },
  });
}

// ---------------------------------------------------------------- paper and log

function paperHtml(s, paper) {
  if (!paper) return '<p class="cc-p">The first edition comes out tomorrow morning.</p>';
  const st = paper.stats;
  const arrow = (v) => (v >= 0.5 ? `<span class="up">up ${Math.round(v)}</span>` : v <= -0.5 ? `<span class="down">down ${Math.round(-v)}</span>` : 'steady');
  return `<div class="headline">${esc(paper.headline)}</div><div class="lede">${esc(paper.sub)}</div>
    ${paper.stories.map((x) => `<div class="story"><b>${esc(x.headline)}</b>${esc(x.sub)}</div>`).join('')}
    <div class="story"><b>City Hall</b>${esc(paper.mood)}</div>
    ${paper.forecast ? `<div class="story"><b>Weather</b>${paper.forecast === 'rain' ? 'Rain all day. Drivers, slow down: expect crashes.' : 'Clear skies today.'}</div>` : ''}
    <div class="box"><div class="cc-stats">
      <div><span>Calls</span> ${st.calls}</div><div><span>Solved</span> ${st.solved}</div>
      <div><span>Failed</span> ${st.failed}</div><div><span>Avg. response</span> ${st.resp ?? '-'} min</div>
      <div><span>Officers hurt</span> ${st.injuries}</div><div><span>Killed</span> ${st.deaths}</div>
      <div><span>Fires</span> ${st.fires}</div><div><span>Buildings lost</span> ${st.firesLost}</div>
      <div><span>Safety</span> ${arrow(paper.dSafety)}</div><div><span>Mayor's trust</span> ${arrow(paper.dTrust)}</div>
    </div></div>`;
}

function paperSheet(s, paper, opts = {}) {
  const el = sheet({
    title: '', cls: 'paper', wrap: 'center', noX: !!opts.foot, html: paperHtml(s, paper), foot: opts.foot || '<button class="cc-btn" data-act="close">Close</button>', handlers: opts.handlers,
  });
  el.el.querySelector('.cc-sheet').insertAdjacentHTML('afterbegin', `<div class="mast"><h1>Tiny Town Tribune</h1><div><span>Day ${paper ? paper.day : s.day}</span><span>25 cents</span></div></div>`);
  return el;
}

export function showPaper(g) { closeAll(); paperSheet(g.s, g.s.paper); }

export function showLog(g) {
  closeAll();
  const s = g.s;
  const items = s.log.slice().reverse().map((l, i) => `<li class="${l.tone} ${l.inc ? 'tap' : ''}" ${l.inc ? `data-act="inc" data-id="${l.inc}"` : ''}><b>${S.clock(l.t)}</b>${esc(l.text)}</li>`).join('');
  sheet({
    title: 'Radio log', sub: `Day ${s.day}`, html: `<ul class="cc-log">${items || '<li>All quiet.</li>'}</ul>`,
    handlers: { inc: ({ id }) => { if (s.incidents.some((x) => x.id === +id)) showIncident(g, +id); else g.toast('That call is closed.'); } },
  });
}

// ---------------------------------------------------------------- day end

export function showDayEnd(g, result) {
  closeAll();
  g.hold('dayend');
  sfx('flip');
  const s = g.s;
  const steps = [];
  steps.push(() => {
    const p = paperSheet(s, result.paper, {
      foot: '<button class="cc-btn gold" data-act="next">Continue</button>',
      handlers: { next: () => { p.close(true); next(); } },
    });
  });
  if (result.briefing.length) {
    steps.push(() => {
      const render = () => result.briefing.map((b, i) => {
        if (b.kind === 'promote' && !b.done) {
          return `<div class="cc-row"><div class="grow">${esc(b.text)}</div></div>
            <div class="cc-foot" style="padding:4px 0 8px"><button class="cc-btn gold" data-act="pro" data-i="${i}" data-r="detective">Detective</button>
            <button class="cc-btn" data-act="pro" data-i="${i}" data-r="sergeant">Sergeant</button><button class="cc-btn" data-act="pro" data-i="${i}" data-r="">Not now</button></div>`;
        }
        return `<div class="cc-row"><div class="grow ${b.kind === 'bad' ? '' : ''}">${b.kind === 'bad' ? '<span class="cc-tag bad">!</span>' : b.kind === 'good' ? '<span class="cc-tag good">+</span>' : ''}${esc(b.done || b.text)}</div></div>`;
      }).join('');
      const p = sheet({
        title: 'Morning briefing', wrap: 'center', noX: true, html: render(),
        sub: 'Detectives work cases; sergeants make their car stronger.',
        foot: '<button class="cc-btn gold" data-act="next">Continue</button>',
        handlers: {
          pro: ({ i, r }) => {
            const b = result.briefing[+i];
            const o = s.officers.find((x) => x.id === b.officer);
            if (r) { S.promote(s, b.officer, r); b.done = `${o.name} is now a ${RANKS[r].title.toLowerCase()}.`; sfx('coin'); } else b.done = `${o.name} stays on patrol for now.`;
            p.set('scroll', render());
          },
          next: () => { p.close(true); next(); },
        },
      });
    });
  }
  if (result.meeting && !s.over) {
    steps.push(() => {
      const demand = s.demand ? `<p class="cc-p">Last time he asked you to get ${esc(S.districtName(s.demand.district))} crime down to ${s.demand.target}. It is at ${Math.round(s.districts[s.demand.district].crime)}.</p>` : '';
      const p = sheet({
        title: `Meeting with ${MAYOR}`, wrap: 'center', noX: true,
        sub: `Trust ${Math.round(s.trust)}/100 &middot; Budget ${money(s.budget)}/day`,
        html: `${demand}<p class="cc-p">"So, Chief. What do you need from me?"</p>${S.MAYOR_OPTIONS.map((o) => `<button class="cc-btn cc-choice" data-act="ask" data-id="${o.id}">${esc(o.label)}<small>${esc(o.detail)}</small></button>`).join('')}`,
        handlers: {
          ask: ({ id }) => {
            const lines = S.mayorMeeting(s, id);
            p.set('scroll', lines.map((l) => `<p class="cc-p">${esc(l)}</p>`).join(''));
            p.set('foot', '<button class="cc-btn gold" data-act="next">Continue</button>');
            g.refreshHud();
          },
          next: () => { p.close(true); next(); },
        },
      });
    });
  }
  steps.push(() => {
    if (s.over) { showGameOver(g); return; }
    if (s.won && !s.wonShown) { s.wonShown = true; showWin(g); return; }
    g.release('dayend');
    g.save();
    g.toast(`Day ${s.day}`);
  });
  let k = 0;
  const next = () => { const f = steps[k++]; if (f) f(); };
  next();
}

export function showGameOver(g) {
  closeAll();
  const s = g.s;
  g.hold('over');
  sfx('lose');
  g.endRun();
  sheet({
    title: 'Relieved of duty', wrap: 'center', noX: true,
    sub: `Day ${s.day} &middot; Career over`,
    html: `<p class="cc-p">${esc(s.over.reason)}</p><div class="cc-stats">
      <div><span>Days served</span> ${s.day - 1}</div><div><span>Calls solved</span> ${s.stats.solved}</div>
      <div><span>Gangs busted</span> ${s.stats.groupsBusted}</div><div><span>Officers lost</span> ${s.stats.deaths}</div></div>`,
    foot: '<button class="cc-btn gold" data-act="again">New career</button><button class="cc-btn" data-act="title">Title</button>',
    handlers: { again: () => { closeAll(); g.newRun('career'); }, title: () => { closeAll(); g.toTitle(); } },
  });
}

function showWin(g) {
  const s = g.s;
  sfx('win');
  const p = sheet({
    title: 'Thirty days as chief!', wrap: 'center', noX: true,
    html: `<p class="cc-p">You made it through your first month. The council votes to keep you on, and ${MAYOR} shakes your hand on the steps of City Hall.</p>
      <div class="cc-stats"><div><span>Calls solved</span> ${s.stats.solved}</div><div><span>Gangs busted</span> ${s.stats.groupsBusted}</div></div>
      <p class="cc-p" style="margin-top:8px">Keep going: the city only gets tougher, and you can still be fired.</p>`,
    foot: '<button class="cc-btn gold" data-act="go">Keep serving</button>',
    handlers: { go: () => { p.close(true); g.release('dayend'); g.save(); } },
  });
}

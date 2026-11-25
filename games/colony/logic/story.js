// The storyteller: paces good and bad events. Big ones stop the clock and ask for a decision
// (s.pending). It adapts: s.skill (0..1, from how earlier colonies went) sets how hard threats
// hit and how often, and a colony that is struggling right now gets a breather.
import { TPD, TPH, ITEMS, FOODS, GAME_ANIMALS, W, H } from './data.js';
import { next, rand, randInt, chance, pick, weighted, shuffle } from './rng.js';
import {
  settlers, log, note, stock, foodCount, takeAt, dropNear, dayOf, season, wealth, hostiles, idx, tx, ty, builtOf,
  passSettler, markTile, near, bAt,
} from './world.js';
import { makeSettler, has } from './life.js';
import { spawnRaid, spawnAnimal, randomWalkable } from './mobs.js';
import { BUILDS, P, TRAITS, SKILL_NAMES } from './data.js';
import { START } from './map.js';

export function initStory(s, opts = {}) {
  s.story = {
    next: s.t + TPD * 1.5, lastThreat: -1e9, lastPlague: -1e9, lastBlight: -1e9, lastTrader: -1e9, lastJoin: -1e9,
    firstThreat: opts.firstThreat ?? 6, tempMod: 0, tempUntil: 0, chasers: null, finalRaid: null, threats: 0,
  };
}

const struggling = (s) => {
  const ps = settlers(s);
  return ps.length <= 1 || ps.some((p) => p.downed || (p.sick && p.sick.sev > 0.5)) || foodCount(s) < ps.length * 2;
};
const peaceful = (s) => s.mode === 'peaceful';

function threatReady(s) {
  if (peaceful(s) || hostiles(s).length) return false;
  if (dayOf(s) < s.story.firstThreat) return false;
  const cd = (7.5 - 3 * s.skill + (struggling(s) ? 2.5 : 0)) * TPD;
  return s.t - s.story.lastThreat >= cd;
}

/** How hard the next raid hits. */
export function threatPoints(s) {
  const pop = settlers(s).length;
  const base = 0.8 + dayOf(s) * 0.05 + wealth(s) / 2200 + pop * 0.3;
  return base * (0.7 + 0.6 * s.skill) * (s.mode === 'daily' && s.scenario === 'bandit' ? 1.15 : 1);
}

export function storyHour(s) {
  const st = s.story;
  if (st.tempUntil && s.t >= st.tempUntil) { st.tempMod = 0; st.tempUntil = 0; log(s, 'The weather is back to normal.', 'info'); }
  if (st.chasers && s.t >= st.chasers.at) {
    const n = st.chasers.n; st.chasers = null;
    ask(s, 'raid', { n, chasers: true });
    return;
  }
  if (st.finalRaid && s.t >= st.finalRaid) {
    st.finalRaid = null;
    ask(s, 'raid', { n: Math.max(3, Math.round(threatPoints(s) * 1.4)), final: true });
    return;
  }
  if (s.t < st.next) return;
  st.next = s.t + Math.round(rand(s, 1.1, 2.4) * TPD);
  const day = dayOf(s);
  const se = season(s).id;
  const pop = settlers(s).length;
  const hard = struggling(s);
  const threat = threatReady(s);
  const crops = s.crop.filter((c) => c >= 0 && c < 1).length;
  const ev = weighted(s, [
    { id: 'raid', w: threat ? (day > 12 ? 5 : 4) : 0 },
    { id: 'wolves', w: threat ? 2 : 0 },
    { id: 'fire', w: day > 3 && !hard ? (se === 'su' ? 1.6 : se === 'wi' ? 0 : 0.6) * (peaceful(s) ? 0.4 : 1) : 0 },
    { id: 'plague', w: day > 8 && pop >= 2 && s.t - st.lastPlague > 14 * TPD && !hard ? (peaceful(s) ? 0.5 : 1.2) : 0 },
    { id: 'blight', w: crops >= 6 && s.t - st.lastBlight > 12 * TPD && !hard ? 0.8 : 0 },
    { id: 'rats', w: foodCount(s) > 30 && !hard ? 0.6 : 0 },
    { id: 'coldsnap', w: (se === 'wi' || se === 'fa') && !st.tempUntil ? 0.8 : 0 },
    { id: 'heatwave', w: se === 'su' && !st.tempUntil ? 0.6 : 0 },
    { id: 'wanderer', w: pop < 12 && s.t - st.lastJoin > 4 * TPD ? (pop <= 2 ? 3 : 1.4) * (s.scenario === 'lone' ? 2 : 1) : 0 },
    { id: 'refugees', w: pop < 11 && day > 5 && s.t - st.lastJoin > 6 * TPD ? 0.8 : 0 },
    { id: 'stranger', w: pop < 12 && day > 3 && s.t - st.lastJoin > 5 * TPD ? 0.6 : 0 },
    { id: 'trader', w: day > 3 && s.t - st.lastTrader > 6 * TPD ? 1.4 : 0 },
    { id: 'cargo', w: hard ? 1.6 : 0.6 },
    { id: 'herd', w: se !== 'wi' ? 0.8 : 0.2 },
    { id: 'quiet', w: 1.5 },
  ]);
  if (ev) EVENTS[ev.id](s);
}

// ---------------------------------------------------------------- popups

function ask(s, kind, data = {}) {
  const def = ASK[kind];
  const p = def.make(s, data);
  if (!p) return false;
  s.pending = { kind, ...p, data };
  note(s, { type: 'popup', kind });
  return true;
}

function edgeNear(s) {
  for (let k = 0; k < 100; k++) {
    const side = randInt(s, 0, 3);
    const x = side === 0 ? 1 : side === 1 ? W - 2 : randInt(s, 2, W - 3);
    const y = side === 2 ? 1 : side === 3 ? H - 2 : randInt(s, 2, H - 3);
    const i = idx(x, y);
    if (passSettler(s, i)) return i;
  }
  return idx(START.x, START.y);
}
export function homeTile(s) {
  const f = builtOf(s, 'campfire')[0] || builtOf(s, 'stove')[0];
  return f ? f.i : idx(START.x, START.y);
}

function describe(p) {
  const best = Object.entries(p.skills).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${SKILL_NAMES[k]} ${v}`).join(', ');
  return `${p.name} (${p.traits.map((t) => TRAITS[t].name).join(', ')}), best at ${best}`;
}

const ASK = {
  raid: {
    make(s, { n, chasers, final }) {
      const text = chasers ? `The people chasing your refugees have arrived: ${n} goblin raiders.`
        : final ? `They heard your radio call. ${n} goblin raiders are coming to take everything before the ship lands.`
          : `${n} goblin raider${n === 1 ? ' is' : 's are'} coming for your colony.`;
      return {
        title: 'Raiders!', text: `${text} Armed settlers fight best. Walls and doors slow raiders down.`,
        choices: [
          { id: 'fight', label: 'Fight', detail: 'Settlers who can fight attack. The rest take cover.' },
          { id: 'hide', label: 'Take cover', detail: 'Everyone hides and only fights if cornered.' },
        ],
      };
    },
    resolve(s, c, d) {
      spawnRaid(s, d.n, { bows: 0.25 + s.skill * 0.2 });
      s.alert = c;
      s.story.lastThreat = s.t; s.story.threats++;
      log(s, `${d.n} raiders have arrived.`, 'bad');
      note(s, { type: 'music', name: 'danger' });
    },
  },
  wolves: {
    make(s, { n }) {
      return {
        title: 'Wolf pack!', text: `A pack of ${n} starving wolves is hunting your settlers. Wolves can't open doors.`,
        choices: [
          { id: 'fight', label: 'Fight', detail: 'Settlers who can fight attack.' },
          { id: 'hide', label: 'Take cover', detail: 'Everyone hides indoors if they can.' },
        ],
      };
    },
    resolve(s, c, d) {
      const at = edgeNear(s);
      for (let k = 0; k < d.n; k++) spawnAnimal(s, 'wolf', randomWalkable(s, (i) => passSettler(s, i), at, 2), true);
      s.alert = c;
      s.story.lastThreat = s.t; s.story.threats++;
      log(s, `${d.n} wolves are on the hunt.`, 'bad');
      note(s, { type: 'music', name: 'danger' });
    },
  },
  wanderer: {
    make(s) {
      const p = makeSettler(s, edgeNear(s));
      return { title: 'A wanderer', text: `A lone traveller asks to join you. ${describe(p)}.`, choices: [{ id: 'yes', label: 'Welcome them' }, { id: 'no', label: 'Send them away' }], settler: p };
    },
    resolve(s, c) {
      s.story.lastJoin = s.t;
      if (c !== 'yes') return;
      join(s, s.pending.settler);
    },
  },
  refugees: {
    make(s) {
      const at = edgeNear(s);
      const a = makeSettler(s, at);
      s.mobs.push(a);
      const b = makeSettler(s, at);
      s.mobs.pop();
      const danger = s.mode !== 'peaceful';
      return {
        title: 'Refugees', text: `Two refugees beg to be taken in. ${describe(a)}. ${describe(b)}.${danger ? ' Someone is chasing them.' : ''}`,
        choices: [{ id: 'yes', label: 'Take them in', detail: danger ? 'Raiders will follow them here.' : '' }, { id: 'no', label: 'Turn them away' }], settlers: [a, b],
      };
    },
    resolve(s, c) {
      s.story.lastJoin = s.t;
      if (c !== 'yes') return;
      for (const p of s.pending.settlers) join(s, p);
      if (s.mode !== 'peaceful') s.story.chasers = { at: s.t + 8 * TPH, n: Math.max(2, Math.round(threatPoints(s) * 0.7)) };
    },
  },
  stranger: {
    make(s) {
      const p = makeSettler(s, edgeNear(s));
      return { title: 'Injured stranger', text: `Someone lies hurt at the edge of the forest. Rescue them and they will join you once they heal. ${describe(p)}.`, choices: [{ id: 'yes', label: 'Rescue them', detail: 'They need a doctor soon.' }, { id: 'no', label: 'Leave them' }], settler: p };
    },
    resolve(s, c) {
      s.story.lastJoin = s.t;
      if (c !== 'yes') return;
      const p = s.pending.settler;
      p.hp = 18; p.downed = true; p.bleed = true; p.wasDowned = true;
      join(s, p, 'is hurt and needs tending');
    },
  },
  trader: {
    make(s) {
      return { title: 'Trader', text: 'A trader\'s cart rolls in. Swap what you have spare. The goods are left by your stockpile.', choices: [{ id: 'leave', label: 'Done trading' }], deals: makeDeals(s) };
    },
    resolve(s) { s.story.lastTrader = s.t; log(s, 'The trader moved on.', 'info'); },
  },
  info: {
    make(s, d) { return { title: d.title, text: d.text, choices: [{ id: 'ok', label: 'OK' }] }; },
    resolve() {},
  },
};

function join(s, p, what = 'has joined the colony') {
  s.mobs.push(p);
  p.joined = dayOf(s);
  s.stats.joined++;
  log(s, `${p.name} ${what}.`, 'good', p.at);
  note(s, { type: 'joined', id: p.id });
  for (const q of settlers(s)) if (q !== p) { q.thoughts = q.thoughts.filter((t) => t.k !== 'joined'); q.thoughts.push({ k: 'joined', v: 3, until: s.t + 36 * TPH }); }
}

export function resolvePending(s, choice) {
  const pd = s.pending;
  if (!pd) return false;
  const def = ASK[pd.kind];
  def.resolve(s, choice, pd.data || {});
  s.pending = null;
  return true;
}

// ---------------------------------------------------------------- trading

const DEALS = [
  { give: { wood: 20 }, get: { metal: 6 } },
  { give: { stone: 20 }, get: { metal: 5 } },
  { give: { meal: 8 }, get: { medicine: 3 } },
  { give: { leather: 6 }, get: { parka: 1 } },
  { give: { metal: 8 }, get: { spear: 1 } },
  { give: { berries: 12 }, get: { herbs: 6 } },
  { give: { wood: 30 }, get: { meal: 10 } },
  { give: { metal: 10 }, get: { tools: 1 } },
  { give: { stone: 15 }, get: { crop: 12 } },
  { give: { crop: 15 }, get: { leather: 8 } },
  { give: { wood: 15 }, get: { bow: 1 } },
  { give: { metal: 5 }, get: { medicine: 2 } },
];
function makeDeals(s) {
  return shuffle(s, DEALS.map((d, i) => i)).slice(0, 5).map((i) => ({ ...DEALS[i], done: false }));
}
export function canTrade(s, deal) {
  const st = stock(s);
  return !deal.done && Object.entries(deal.give).every(([k, n]) => (st[k] || 0) >= n);
}
export function trade(s, i) {
  const pd = s.pending;
  if (!pd || pd.kind !== 'trader') return false;
  const deal = pd.deals[i];
  if (!deal || !canTrade(s, deal)) return false;
  for (const [k, n] of Object.entries(deal.give)) takeKind(s, k, n);
  const at = dropSpot(s);
  for (const [k, n] of Object.entries(deal.get)) dropNear(s, at, k, n);
  deal.done = true;
  log(s, `Traded ${fmt(deal.give)} for ${fmt(deal.get)}.`, 'good', at);
  return true;
}
export const fmt = (o) => Object.entries(o).map(([k, n]) => `${n} ${ITEMS[k].name.toLowerCase()}`).join(', ');

/** Remove n of kind k from anywhere (loose items first, then stockpiles). */
export function takeKind(s, k, n) {
  const list = Object.entries(s.items).filter(([, it]) => it.k === k).map(([i]) => +i);
  list.sort((a, b) => (s.zone[a] ? 1 : 0) - (s.zone[b] ? 1 : 0));
  let left = n;
  for (const i of list) { if (left <= 0) break; const got = takeAt(s, i, left); left -= got ? got.n : 0; }
  return n - left;
}
function dropSpot(s) {
  for (let i = 0; i < s.zone.length; i++) if (s.zone[i] === 1 && !s.items[i] && !s.bld[i]) return i;
  return homeTile(s);
}

// ---------------------------------------------------------------- events

const EVENTS = {
  quiet() {},
  raid(s) { ask(s, 'raid', { n: Math.max(1, Math.min(10, Math.round(threatPoints(s)))) }); },
  wolves(s) { ask(s, 'wolves', { n: Math.max(2, Math.min(8, Math.round(threatPoints(s) * 0.9) + 1)) }); },
  wanderer(s) { ask(s, 'wanderer'); },
  refugees(s) { ask(s, 'refugees'); },
  stranger(s) { ask(s, 'stranger'); },
  trader(s) { ask(s, 'trader'); },
  fire(s) {
    const home = homeTile(s);
    const cands = [];
    for (let i = 0; i < s.plant.length; i++) {
      const d = Math.hypot(tx(i) - tx(home), ty(i) - ty(home));
      if (d > 14 || d < 3) continue;
      if (s.plant[i] === P.TREE || s.plant[i] === P.PINE) cands.push(i);
      else if (bAt(s, i)?.done && BUILDS[bAt(s, i).k].flam && chance(s, 0.15)) cands.push(i);
    }
    if (!cands.length) return;
    const i = pick(s, cands);
    s.fire[i] = 0.35; markTile(s, i);
    log(s, 'Lightning struck! A fire has started.', 'bad', i);
    note(s, { type: 'fire', at: i });
  },
  plague(s) {
    const ps = shuffle(s, settlers(s).filter((p) => !p.sick && !p.downed));
    const n = Math.min(ps.length, randInt(s, 1, 2));
    if (!n) return;
    const name = pick(s, ['flu', 'fever', 'plague']);
    for (const p of ps.slice(0, n)) p.sick = { kind: 'sick', name, sev: 0.1, imm: 0 };
    s.story.lastPlague = s.t;
    ask(s, 'info', { title: 'Sickness', text: `${ps.slice(0, n).map((p) => p.name).join(' and ')} caught the ${name}. A doctor should tend them twice a day, and rest in bed helps. Medicine makes tending better.` });
  },
  blight(s) {
    let killed = 0;
    for (let i = 0; i < s.crop.length; i++) if (s.crop[i] >= 0 && s.crop[i] < 1 && chance(s, 0.6)) { s.crop[i] = -1; markTile(s, i); killed++; }
    s.story.lastBlight = s.t;
    if (killed) ask(s, 'info', { title: 'Blight', text: `A blight withered ${killed} of your growing crops. Hunt, forage and keep some food in storage.` });
  },
  rats(s) {
    let lost = 0;
    for (const [key, it] of Object.entries(s.items)) {
      if (!ITEMS[it.k].food || bAt(s, +key)?.k === 'storage') continue;
      const n = Math.floor(it.n * 0.35);
      if (n > 0) { takeAt(s, +key, n); lost += n; }
    }
    if (lost) ask(s, 'info', { title: 'Rats!', text: `Rats got into the food and spoiled ${lost} portions. Food kept in a Storage crate is safe from rats.` });
  },
  coldsnap(s) {
    s.story.tempMod = -8; s.story.tempUntil = s.t + 2 * TPD;
    log(s, 'A cold snap! It will be 8 degrees colder for two days. Keep the fires fed and get indoors.', 'bad');
    note(s, { type: 'toast', text: 'Cold snap! Keep the fires going.' });
  },
  heatwave(s) {
    s.story.tempMod = 10; s.story.tempUntil = s.t + 2 * TPD;
    log(s, 'A heat wave! Food rots faster for two days.', 'bad');
    note(s, { type: 'toast', text: 'Heat wave!' });
  },
  cargo(s) {
    const at = homeTile(s);
    const loot = pick(s, [{ meal: 12 }, { medicine: 4 }, { metal: 15 }, { wood: 40 }, { meal: 8, medicine: 2 }, { tools: 1 }, { parka: 2 }]);
    for (const [k, n] of Object.entries(loot)) dropNear(s, at, k, n);
    log(s, `Supplies fell from the sky: ${fmt(loot)}.`, 'good', at);
    note(s, { type: 'toast', text: 'Cargo pods landed!' });
    for (const p of settlers(s)) { p.thoughts = p.thoughts.filter((t) => t.k !== 'cargo'); p.thoughts.push({ k: 'cargo', v: 4, until: s.t + 24 * TPH }); }
  },
  herd(s) {
    const sp = pick(s, ['sheep', 'boar', 'goose', 'sheep']);
    const at = edgeNear(s);
    const n = randInt(s, 3, 6);
    for (let k = 0; k < n; k++) { const a = spawnAnimal(s, sp, randomWalkable(s, (i) => passSettler(s, i), at, 3)); if (a) a.home = homeTile(s); }
    log(s, `A herd of ${n} ${ANIMAL_PLURAL[sp]} wandered in. Good hunting!`, 'good', at);
  },
};
const ANIMAL_PLURAL = { sheep: 'wild sheep', boar: 'boars', goose: 'geese' };

/** For tests and the debug hook: force an event. */
export function forceEvent(s, id) { EVENTS[id](s); }

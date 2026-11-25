// Trophies, play stats and daily challenges shared by every game. The launcher's Profile and
// Daily pages read the same storage, so games never need to touch shared files to add trophies.
//
// In a game:
//   import { registerTrophies, award, recordPlay } from '../../shared/core/trophies.js';
//   registerTrophies('my-game', [
//     { id: 'first-win', name: 'First Win', desc: 'Win a match', tier: 'bronze' },
//     { id: 'champion', name: 'Champion', desc: 'Win the cup', tier: 'gold' },
//     { id: 'secret', name: 'Hidden', desc: 'Find the secret room', tier: 'silver', secret: true },
//   ]);
//   recordPlay('my-game');            // once when the game starts
//   award('my-game', 'first-win');    // shows a small toast the first time only
//
// Daily challenges (one seeded challenge per local calendar day):
//   registerDaily('my-game', { title: 'Daily Run', desc: 'Same dungeon for everyone today' });
//   const seed = dailySeed('my-game');          // same number all day, new tomorrow
//   reportDaily('my-game', score);               // keeps today's best and the streak
//   reportDaily('my-game', moves, { lower: true }) // when a smaller score is better
import { sfx } from './sfx.js';

const KEY = 'kingrabbit:profile';
const TIERS = { bronze: 10, silver: 25, gold: 50 };

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function save(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage full or blocked */ } }
function game(p, id) {
  p.games ||= {};
  return (p.games[id] ||= { trophies: {}, defs: [], plays: 0, first: null, last: null, stats: {} });
}

/** Tell the collection which trophies this game has (stored so the launcher can list them). */
export function registerTrophies(gameId, defs) {
  const p = load();
  const g = game(p, gameId);
  g.defs = defs.map(({ id, name, desc, tier = 'bronze', secret = false }) => ({ id, name, desc, tier, secret }));
  save(p);
}

export function hasTrophy(gameId, id) { return !!load().games?.[gameId]?.trophies?.[id]; }

/** Earn a trophy. Returns true the first time (and shows a toast), false if already earned. */
export function award(gameId, id) {
  const p = load();
  const g = game(p, gameId);
  if (g.trophies[id]) return false;
  g.trophies[id] = Date.now();
  save(p);
  const def = g.defs.find((d) => d.id === id);
  toast(def ? def.name : id, def?.tier || 'bronze');
  return true;
}

/** Count a play (call once per launch) for the profile's play stats. */
export function recordPlay(gameId) {
  const p = load();
  const g = game(p, gameId);
  g.plays++;
  g.first ||= Date.now();
  g.last = Date.now();
  save(p);
}

/** Add to a named counter shown on the profile, e.g. bumpStat('soccer', 'goals', 2). */
export function bumpStat(gameId, key, n = 1) {
  const p = load();
  const g = game(p, gameId);
  g.stats[key] = (g.stats[key] || 0) + n;
  save(p);
  return g.stats[key];
}

/** Everything the profile page needs. */
export function profile() {
  const p = load();
  let points = 0; let earned = 0; let total = 0;
  for (const g of Object.values(p.games || {})) {
    total += g.defs.length;
    for (const d of g.defs) if (g.trophies[d.id]) { earned++; points += TIERS[d.tier] || 10; }
  }
  return { games: p.games || {}, points, earned, total, daily: p.daily || {} };
}

// ---------------------------------------------------------------- daily challenges

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** A seed that is the same for everyone all day and changes at local midnight. */
export const dailySeed = (gameId, day = today()) => hash(`${gameId}:${day}`);

export function registerDaily(gameId, { title, desc }) {
  const p = load();
  p.daily ||= {};
  const d = (p.daily[gameId] ||= { best: {}, streak: 0, lastDay: null });
  d.title = title; d.desc = desc;
  save(p);
}

/** Record a daily result. Returns { best, isBest, streak }. */
export function reportDaily(gameId, score, { lower = false } = {}) {
  const p = load();
  p.daily ||= {};
  const d = (p.daily[gameId] ||= { best: {}, streak: 0, lastDay: null });
  const day = today();
  const prev = d.best[day];
  const isBest = prev == null || (lower ? score < prev : score > prev);
  if (isBest) d.best[day] = score;
  d.lower = lower;
  if (d.lastDay !== day) {
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yesterday = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    d.streak = d.lastDay === yesterday ? d.streak + 1 : 1;
    d.lastDay = day;
  }
  // Keep the last 30 days only.
  const days = Object.keys(d.best).sort();
  while (days.length > 30) delete d.best[days.shift()];
  save(p);
  return { best: d.best[day], isBest, streak: d.streak };
}

export const playedDailyToday = (gameId) => load().daily?.[gameId]?.best?.[today()] != null;

// ---------------------------------------------------------------- toast

function toast(name, tier) {
  sfx('coin');
  const el = document.createElement('div');
  const color = { bronze: '#d88038', silver: '#b9b6c9', gold: '#e3d245' }[tier] || '#e3d245';
  el.setAttribute('role', 'status');
  el.style.cssText = `position:fixed;left:50%;top:max(12px,env(safe-area-inset-top));transform:translate(-50%,-140%);z-index:120;
    display:flex;align-items:center;gap:10px;padding:8px 14px;max-width:90vw;background:#1c1618;color:#f9f5ef;
    border:3px solid #040303;box-shadow:inset 0 0 0 2px ${color},0 4px 0 #040303;font:16px BoldPixels,monospace;
    transition:transform .25s steps(4);pointer-events:none`;
  el.innerHTML = `<span style="width:18px;height:18px;background:${color};border:2px solid #040303;flex:none"></span>
    <span><span style="color:${color}">Trophy</span><br></span>`;
  el.lastElementChild.append(name);
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.transform = 'translate(-50%,0)'; });
  setTimeout(() => { el.style.transform = 'translate(-50%,-140%)'; setTimeout(() => el.remove(), 400); }, 2600);
}

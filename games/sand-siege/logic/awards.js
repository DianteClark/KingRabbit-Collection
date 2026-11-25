// Which trophies a game has earned. Pure functions so the rules are tested; trophies.js shows them.
import { CAMPAIGN } from './maps.js';

export const GAME_ID = 'sand-siege';

export const TROPHIES = [
  { id: 'first-win', name: 'First Stand', desc: 'Win your first map', tier: 'bronze' },
  { id: 'three-stars', name: 'Untouched', desc: 'Earn 3 stars on a map', tier: 'bronze' },
  { id: 'specialist', name: 'Specialist', desc: 'Upgrade a tower to a specialty', tier: 'bronze' },
  { id: 'early', name: 'Eager', desc: 'Call 5 waves early in one game', tier: 'bronze' },
  { id: 'boss', name: 'Giant Slayer', desc: 'Destroy a boss', tier: 'bronze' },
  { id: 'airstrike', name: 'Danger Close', desc: 'Destroy 5 enemies with one airstrike', tier: 'bronze' },
  { id: 'daily', name: 'Daily Duty', desc: 'Finish a daily challenge', tier: 'bronze' },
  { id: 'halfway', name: 'Halfway There', desc: 'Clear The Labyrinth (map 8)', tier: 'silver' },
  { id: 'hard-win', name: 'Iron Will', desc: 'Win a map on Hard', tier: 'silver' },
  { id: 'endless', name: 'Endless Sands', desc: 'Hold 30 waves in Endless', tier: 'silver' },
  { id: 'tycoon', name: 'War Chest', desc: 'Hold 1,500 funds at once', tier: 'silver' },
  { id: 'maze', name: 'Maze Master', desc: 'Make enemies walk 60 cells on a maze map', tier: 'silver', secret: true },
  { id: 'campaign', name: 'Siege Breaker', desc: 'Clear all 15 campaign maps', tier: 'gold' },
  { id: 'all-stars', name: 'Perfect General', desc: '3 stars on every campaign map', tier: 'gold' },
  { id: 'flawless', name: 'Flawless', desc: 'Win a map on Hard without losing a life', tier: 'gold', secret: true },
];

/** Trophies that can happen at any moment of a game (checked as it runs). */
export function liveTrophies(s) {
  const out = [];
  if (s.towers.some((t) => t.level >= 3)) out.push('specialist');
  if (s.stats.early >= 5) out.push('early');
  if (s.stats.bossKills > 0) out.push('boss');
  if (s.stats.strikeBest >= 5) out.push('airstrike');
  if (s.stats.maxFunds >= 1500) out.push('tycoon');
  if (s.kind === 'maze' && s.stats.maxRoute >= 60) out.push('maze');
  if (s.mode === 'endless' && s.wave - 1 >= 30) out.push('endless');
  return out;
}

/** Trophies for a finished game. stars: campaign stars after recording this result ({ mapId: n }). */
export function endTrophies(s, stars = {}) {
  const out = liveTrophies(s);
  if (s.mode === 'daily') out.push('daily');
  if (s.over !== 'win' || s.mode !== 'campaign') return out;
  out.push('first-win');
  if (s.hard) out.push('hard-win');
  if (s.hard && s.lives === s.maxLives) out.push('flawless');
  if (Object.values(stars).some((n) => n >= 3)) out.push('three-stars');
  const idx = (id) => CAMPAIGN.findIndex((m) => m.id === id);
  if (stars.labyrinth || CAMPAIGN.slice(idx('labyrinth')).some((m) => stars[m.id])) out.push('halfway');
  if (CAMPAIGN.every((m) => stars[m.id])) out.push('campaign');
  if (CAMPAIGN.every((m) => stars[m.id] >= 3)) out.push('all-stars');
  return out;
}

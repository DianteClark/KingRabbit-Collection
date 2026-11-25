// Trophies, the daily challenge and the storyteller's adaptive setting.
import { registerTrophies, award, recordPlay, bumpStat, registerDaily, dailySeed, reportDaily, today } from '../../shared/core/trophies.js';
import { store } from './store.js';

export const ID = 'colony';

export const TROPHIES = [
  { id: 'first-night', name: 'First Night', desc: 'Make it through the first night', tier: 'bronze' },
  { id: 'hot-meal', name: 'Hot Meal', desc: 'Cook your first meal', tier: 'bronze' },
  { id: 'harvest', name: 'Harvest Time', desc: 'Bring in a crop', tier: 'bronze' },
  { id: 'roof', name: 'A Bed Each', desc: 'Have a bed for every settler (3 or more)', tier: 'bronze' },
  { id: 'armed', name: 'Armed', desc: 'Craft a spear or a bow', tier: 'bronze' },
  { id: 'firefighter', name: 'Firefighter', desc: 'Put out a fire', tier: 'bronze', secret: true },
  { id: 'daily', name: 'Daily Settler', desc: 'Finish a daily challenge', tier: 'bronze' },
  { id: 'repelled', name: 'Not Today', desc: 'See off a raid', tier: 'silver' },
  { id: 'winter', name: 'Spring Again', desc: 'Survive a winter', tier: 'silver' },
  { id: 'crowd', name: 'Growing Colony', desc: 'Have 8 settlers at once', tier: 'silver' },
  { id: 'year', name: 'One Year On', desc: 'Survive a full year', tier: 'silver' },
  { id: 'best-friends', name: 'Best Friends', desc: 'Two settlers become best friends', tier: 'silver', secret: true },
  { id: 'survivor', name: 'Here to Stay', desc: 'Survive two years', tier: 'gold' },
  { id: 'rescued', name: 'Going Home', desc: 'Get rescued by radio', tier: 'gold' },
  { id: 'ironman', name: 'Nobody Left Behind', desc: 'Win without losing a settler (not Peaceful)', tier: 'gold' },
];

export const DAILY = { title: 'Daily Colony', desc: 'Same map and start for everyone. Survive 15 days; score is your wealth.' };

let started = false;
export function startProgress() {
  if (started) return;
  started = true;
  registerTrophies(ID, TROPHIES);
  registerDaily(ID, DAILY);
  recordPlay(ID);
}
export const give = (id) => award(ID, id);
export const stat = (k, n = 1) => bumpStat(ID, k, n);
export const todaySeed = () => dailySeed(ID);
export const todayKey = () => today();
export const finishDaily = (score) => reportDaily(ID, score);

// ---------------------------------------------------------------- adaptive storyteller
const START = 0.35;
export function getSkill(mode) {
  const v = (store.get('skill') || {})[mode];
  return typeof v === 'number' ? v : START;
}
/** kind: 'death' | 'raidWon' | 'win' | 'lose' | 'season' */
export function adapt(mode, kind) {
  if (mode === 'daily') return;
  const d = { death: -0.05, raidWon: 0.03, win: 0.06, lose: -0.1, season: 0.015 }[kind] || 0;
  const all = { ...(store.get('skill') || {}) };
  all[mode] = Math.max(0, Math.min(1, getSkill(mode) + d));
  store.set('skill', all);
}
export const skillLabel = (mode) => Math.round(getSkill(mode) * 9) + 1;

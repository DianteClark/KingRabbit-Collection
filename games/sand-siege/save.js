import { createSave } from '../../shared/core/save.js';
import { CAMPAIGN } from './logic/maps.js';
import { POWERS, POWER_ORDER } from './logic/data.js';

// game:     the game in progress (serialized sim state) so you can close the page mid-wave
// campaign: { stars: { mapId: 1-3 }, hard: { mapId: lives left }, endless: { mapId: best waves } }
// seen:     enemy types already introduced; coach: the first-map tips are done
export const save = createSave('sand-siege', {
  game: null, campaign: { stars: {}, hard: {}, endless: {} }, skill: {}, skillGames: {}, seen: [], coach: false, tips: true,
});

export const saveGame = (str) => save.set('game', str);
export const loadGame = () => save.get('game');
export const clearGame = () => save.set('game', null);

export function campaign() {
  const c = save.get('campaign') || {};
  return { stars: {}, hard: {}, endless: {}, ...c };
}
/** How many maps in a row from the start have been won (the next one is playable). */
export function cleared() {
  const c = campaign();
  let n = 0;
  while (n < CAMPAIGN.length && c.stars[CAMPAIGN[n].id]) n++;
  return n;
}
export const isUnlocked = (i) => i <= cleared();
export const powersUnlocked = () => POWER_ORDER.filter((p) => cleared() >= POWERS[p].unlock);

export function recordWin(mapId, stars, hard, lives) {
  const c = campaign();
  c.stars = { ...c.stars, [mapId]: Math.max(stars, c.stars[mapId] || 0) };
  if (hard) c.hard = { ...c.hard, [mapId]: Math.max(lives, c.hard[mapId] ?? -1) };
  save.set('campaign', c);
}
export function recordEndless(mapId, waves) {
  const c = campaign();
  const best = c.endless[mapId] || 0;
  if (waves > best) { c.endless = { ...c.endless, [mapId]: waves }; save.set('campaign', c); return true; }
  return false;
}
export const totalStars = () => Object.values(campaign().stars).reduce((a, b) => a + b, 0);

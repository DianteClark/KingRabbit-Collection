import { createSave } from '../../shared/core/save.js';

// battle:   the battle in progress (JSON string) so you can close the tab mid-mission
// campaign: { unlocked: index of the furthest mission you can play, best: { missionId: days } }
// records:  { mapId: { w, l } } for skirmish against the computer
export const save = createSave('sand-tactics', {
  battle: null, campaign: { unlocked: 0, best: {} }, records: {}, skill: {}, skillGames: {}, fast: false, seenTips: false,
});

export const saveBattle = (state) => save.set('battle', JSON.stringify(state));
export function loadBattle() {
  try { const s = save.get('battle'); return s ? JSON.parse(s) : null; } catch { return null; }
}
export const clearBattle = () => save.set('battle', null);

export function campaign() { return { unlocked: 0, best: {}, ...(save.get('campaign') || {}) }; }

/** Record a won mission (index i in the campaign list). */
export function missionWon(i, id, days) {
  const c = campaign();
  c.unlocked = Math.max(c.unlocked, i + 1);
  if (!c.best[id] || days < c.best[id]) c.best = { ...c.best, [id]: days };
  save.set('campaign', c);
}

export function getRecord(id) { return { w: 0, l: 0, ...(save.get('records')[id] || {}) }; }
export function recordSkirmish(id, won) {
  const r = getRecord(id);
  if (won) r.w++; else r.l++;
  save.set('records', { ...save.get('records'), [id]: r });
}

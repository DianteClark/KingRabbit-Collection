import { createSave } from '../../shared/core/save.js';
import { newProgress, PROGRESS_VERSION, joinHeroes, finishCampaignBattle } from './logic/progress.js';

// progress: the campaign (heroes, gear, gold, cleared nodes)
// battle:   the fight in progress { battle, ctx } (any mode), saved after every action
// tower:    the endless climb in progress { hero, floor, hp, seed }
export const save = createSave('gem-quest', {
  progress: null,
  battle: null,
  tower: null,
  towerBest: 0,
  skill: 0.35,
  skillGames: 0,
  tips: {},
});

export function getProgress() {
  let p = save.get('progress');
  if (!p || p.v !== PROGRESS_VERSION) { p = newProgress(); save.set('progress', p); }
  joinHeroes(p);
  return p;
}
export const setProgress = (p) => save.set('progress', p);

/** The battle in progress (a finished one too, until its rewards are paid on the results screen). */
export const getBattle = () => {
  const b = save.get('battle');
  return b && b.battle && b.battle.v === 1 && b.ctx ? b : null;
};
export const setBattle = (b) => save.set('battle', b);
export const clearBattle = () => save.set('battle', null);

/** One-time tips (tutorial steps): seen(key) is true after markSeen(key). */
export const seen = (k) => !!(save.get('tips') || {})[k];
export const markSeen = (k) => save.set('tips', { ...(save.get('tips') || {}), [k]: true });

/** Drop the battle in progress: a campaign fight counts as a loss, a tower climb ends. */
export function abandonBattle() {
  const cur = getBattle();
  clearBattle();
  if (!cur) return;
  if (cur.ctx.mode === 'campaign') {
    const p = getProgress();
    if (!cur.battle.over) cur.battle.over = 'lose';
    finishCampaignBattle(p, cur.ctx.node, cur.battle, cur.ctx.hero);
    setProgress(p);
  } else if (cur.ctx.mode === 'tower') save.set('tower', null);
}

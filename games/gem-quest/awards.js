// Trophies (shared/core/trophies.js) and the daily challenge.
import { registerTrophies, award, recordPlay, registerDaily, bumpStat } from '../../shared/core/trophies.js';

export const GAME_ID = 'gem-quest';

export const TROPHIES = [
  { id: 'first-win', name: 'First Blood', desc: 'Win your first battle', tier: 'bronze' },
  { id: 'line-gem', name: 'Line Up', desc: 'Make a line gem with a match of 4', tier: 'bronze' },
  { id: 'star-gem', name: 'Starmaker', desc: 'Make a star gem with a match of 5', tier: 'silver' },
  { id: 'chain-5', name: 'Avalanche', desc: 'Set off a chain of 5 cascades in one move', tier: 'silver' },
  { id: 'boss-1', name: 'Hydra Slayer', desc: 'Defeat the Swamp Hydra', tier: 'bronze' },
  { id: 'champion', name: 'Dragonbane', desc: 'Defeat the Red Dragon and finish the campaign', tier: 'gold' },
  { id: 'party', name: 'Full Party', desc: 'Have all four heroes join you', tier: 'silver' },
  { id: 'level-10', name: 'Seasoned', desc: 'Raise a hero to level 10', tier: 'silver' },
  { id: 'puzzles', name: 'Riddle Master', desc: 'Solve all four riddle stones', tier: 'silver' },
  { id: 'quests', name: 'Errand Runner', desc: 'Finish every side quest', tier: 'gold' },
  { id: 'tower-10', name: 'Climber', desc: 'Reach floor 10 of the Endless Tower', tier: 'silver' },
  { id: 'tower-25', name: 'Sky High', desc: 'Reach floor 25 of the Endless Tower', tier: 'gold' },
  { id: 'daily', name: 'Daily Duelist', desc: 'Finish a Daily Duel', tier: 'bronze' },
  { id: 'overkill', name: 'Overkill', desc: 'Deal 60 damage in a single turn', tier: 'silver', secret: true },
  { id: 'close-call', name: 'By a Hair', desc: 'Win a battle with 5 HP or less', tier: 'bronze', secret: true },
];

export function setupAwards() {
  registerTrophies(GAME_ID, TROPHIES);
  registerDaily(GAME_ID, { title: 'Daily Duel', desc: 'Same hero, monster and board for everyone today' });
  recordPlay(GAME_ID);
}

export const give = (id) => award(GAME_ID, id);
export const stat = (key, n = 1) => bumpStat(GAME_ID, key, n);

/** Trophies earned by what happened in a battle (checked after every hero action). */
export function checkBattleTrophies(st) {
  const s = st.stats;
  if (s.made.h + s.made.v > 0) give('line-gem');
  if (s.made.star > 0) give('star-gem');
  if (s.maxChain >= 5) give('chain-5');
  if (s.maxTurnDmg >= 60) give('overkill');
}

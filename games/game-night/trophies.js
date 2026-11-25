// Trophies, lifetime stats and daily challenge for this game, on top of the shared profile storage.
// Pure data plus thin wrappers: in node (tests, bots) every call is a no-op.
import { registerTrophies, award, recordPlay, bumpStat, registerDaily, reportDaily, dailySeed, today, profile } from '../../shared/core/trophies.js';

export const GAME_ID = 'game-night';

const B = 'bronze'; const S = 'silver'; const G = 'gold';
const t = (id, name, desc, tier, secret = false) => ({ id, name, desc, tier, secret });

export const TROPHIES = [
  // Board (a win vs the CPU at each table, plus a feat here and there)
  t('ttt-win', 'Three in a Row', 'Beat the CPU at Tic-Tac-Toe', B),
  t('ttt-draw', "Cat's Game", 'Draw at Tic-Tac-Toe against the CPU', B, true),
  t('reversi-win', 'Flip Side', 'Beat the CPU at Reversi', B),
  t('reversi-big', 'Landslide', 'Win Reversi with 45 or more discs', S),
  t('checkers-win', 'Jump King', 'Beat the CPU at Checkers', B),
  t('chess-win', 'Checkmate', 'Beat the CPU at Chess', S),
  t('go-win', 'Territory', 'Beat the CPU at Go', S),
  t('tables-win', 'Bear Off', 'Beat the CPU at Tables', B),
  t('dominoes-win', 'Bone Yard', 'Beat the CPU at Dominoes', B),
  t('seabattle-win', 'Admiral', 'Beat the CPU at Sea Battle', B),
  t('seabattle-fast', 'Sharpshooter', 'Win Sea Battle in 45 shots or fewer', S),
  // Cards and dice
  t('yacht-win', 'High Roller', 'Beat the CPU at Yacht Dice', B),
  t('yacht-yacht', 'Yacht!', 'Roll five of a kind in Yacht Dice', B),
  t('yacht-250', 'Full Card', 'Score 250 in Yacht Dice', S),
  t('solitaire-win', 'Patience', 'Win a game of Solitaire', B),
  t('solitaire-fast', 'Quick Shuffle', 'Win Solitaire in under 3 minutes', S),
  t('solitaire-daily', 'Daily Deal', 'Win the Daily Deal', B),
  t('solitaire-streak', 'Regular', 'Win the Daily Deal 3 days in a row', S),
  t('wildcards-win', 'Wild Win', 'Beat the CPU at Wild Cards', B),
  // Arcade
  t('airhockey-win', 'Puck Stop', 'Beat the CPU at Air Hockey', B),
  t('airhockey-shutout', 'Shutout', 'Win Air Hockey without letting a goal in', S),
  t('bb-clear', 'Wall Breaker', 'Clear a level of Block Breaker', B),
  t('bb-5000', 'Brick Buster', 'Score 5,000 in Block Breaker', S),
  t('rocks-2000', 'Rock Hopper', 'Score 2,000 in Space Rocks', B),
  t('rocks-10000', 'Asteroid Ace', 'Score 10,000 in Space Rocks', S),
  t('bowl-strike', 'Strike!', 'Bowl a strike', B),
  t('bowl-200', 'Two Hundred Club', 'Score 200 in Bowling', S),
  t('bowl-300', 'Perfect Game', 'Bowl a perfect 300', G, true),
  t('pool-win', 'Eight Ball', 'Beat the CPU at Pool', B),
  t('tanks-stage', 'Base Defender', 'Clear a stage of Tank Battle', B),
  t('tanks-10000', 'Tank Commander', 'Score 10,000 in Tank Battle', S),
  // Puzzle
  t('box-8', 'Warehouse Hand', 'Solve 8 Box Box levels', S),
  t('box-all', 'Box Master', 'Solve every Box Box level', G),
  t('six-1000', 'Six Pack', 'Score 1,000 in Six Ball', B),
  t('six-5000', 'Chain Reaction', 'Score 5,000 in Six Ball', S),
  t('mole-1', 'Gem Digger', 'Clear a level of Mole Runner', B),
  t('mole-3', 'Deep Digger', 'Clear 3 Mole Runner levels in one game', S),
  // The whole collection
  t('explorer', 'Table Hopper', 'Try 10 different tables', B),
  t('tourist', 'Night Owl', 'Try every table', S),
  t('pvp', 'Pass the Phone', 'Finish a 2-player game', B),
  t('five-tables', 'All-Rounder', 'Beat the CPU at 5 different tables', S),
  t('all-tables', 'House Champion', 'Beat the CPU at every table', G),
  t('wins-50', 'Regular Winner', 'Win 50 games against the CPU', S),
  t('wins-200', 'Game Night Legend', 'Win 200 games against the CPU', G),
  t('sharp', 'Sharp Mind', 'Beat a CPU at level 8 or higher', G),
];

export const DAILY = { title: 'Daily Deal', desc: 'One Solitaire deal for everyone; fewest moves' };

const live = typeof document !== 'undefined';
const got = new Set();

/** Call once per launch. */
export function initTrophies() {
  if (!live) return;
  registerTrophies(GAME_ID, TROPHIES);
  if (DAILY) registerDaily(GAME_ID, DAILY);
  recordPlay(GAME_ID);
}

/** Earn a trophy (shows a toast the first time). */
export function earn(id) {
  if (!live || got.has(id)) return false;
  got.add(id);
  return award(GAME_ID, id);
}

/** Add to a lifetime counter shown on the launcher's Trophies page. */
export function stat(key, n = 1) { if (live && n) bumpStat(GAME_ID, key, n); }

/** Today's daily seed: the same for everyone all day. */
export const todaySeed = () => dailySeed(GAME_ID);
export { today };

/** Record a daily result; one started on an earlier day (resumed after midnight) doesn't count. */
export function daily(score, day = today(), opts) {
  return live && DAILY && day === today() ? reportDaily(GAME_ID, score, opts) : null;
}

/** Today's best Daily Deal (fewest moves), or null when it hasn't been won today. */
export const playedDailyDeal = () => (live ? profile().daily[GAME_ID]?.best?.[today()] ?? null : null);

/** A small seeded random generator (mulberry32) for the Daily Deal. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

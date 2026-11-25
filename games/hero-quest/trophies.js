// Hollow Crown's trophies and lifetime counters (shared/core/trophies.js shows them in the
// collection's profile). awardsFor() is plain logic so tests can check which events earn what.
import { registerTrophies, recordPlay, award, bumpStat } from '../../shared/core/trophies.js';

export const GAME = 'hero-quest';

export const TROPHIES = [
  { id: 'sword', name: 'Sword and Shield', desc: "Take up Elder Bram's old sword", tier: 'bronze' },
  { id: 'slime-king', name: 'Slime Slayer', desc: 'Beat the master of the Mossy Hollow', tier: 'bronze' },
  { id: 'puzzle', name: 'Block Pusher', desc: 'Solve a push-block puzzle', tier: 'bronze' },
  { id: 'shield', name: 'Rock Wall', desc: 'Block 10 thrown rocks with your shield', tier: 'bronze' },
  { id: 'charm', name: 'Big Spender', desc: "Buy the Heart Charm at Odo's shop", tier: 'bronze' },
  { id: 'golem-king', name: 'Stone Breaker', desc: 'Beat the master of the Ember Lab', tier: 'silver' },
  { id: 'cave', name: 'Lakeside Secret', desc: 'Find the hidden cave by the lake', tier: 'silver', secret: true },
  { id: 'slimes', name: 'Slime Sweeper', desc: 'Defeat 100 slimes', tier: 'silver' },
  { id: 'steady', name: 'Steady Hand', desc: 'Bring the Crown home without falling once', tier: 'silver' },
  { id: 'crown', name: 'The Hollow Crown', desc: 'Bring the Crown home', tier: 'gold' },
  { id: 'untouched', name: 'Untouched', desc: 'Beat a dungeon master without being hit', tier: 'gold' },
  { id: 'treasure', name: 'Treasure Hunter', desc: 'Open every chest in Fernwick Vale', tier: 'gold' },
  { id: 'swift', name: 'Swift Hero', desc: 'Bring the Crown home in under 30 minutes', tier: 'gold', secret: true },
];

/** Once per launch. */
export function initTrophies() {
  registerTrophies(GAME, TROPHIES);
  recordPlay(GAME);
}

/**
 * What a game event is worth: { awards: [id], stats: { key: n } }.
 * ctx: { s (game state), allChestsOpen(), stat(key) -> lifetime value after this event's bumps }
 */
export function awardsFor(ev, ctx) {
  const awards = []; const stats = {};
  const s = ctx.s;
  switch (ev.type) {
    case 'get':
      if (ev.item === 'sword') awards.push('sword');
      if (ev.item === 'heart' && ev.room === 'in:cave') awards.push('cave');
      if (ev.item.startsWith('gems')) stats.gems = Number(ev.item.slice(4));
      if (ctx.allChestsOpen()) awards.push('treasure');
      break;
    case 'gems': stats.gems = ev.n; break;
    case 'die':
      stats.enemies = 1;
      if (/lime/.test(ev.kind)) stats.slimes = 1;
      break;
    case 'block': stats.blocks = 1; break;
    case 'trigger': if (ev.kind === 'switch') awards.push('puzzle'); break;
    case 'bought': if (ev.id === 'heart') awards.push('charm'); break;
    case 'bossDown':
      if (ev.area === 'd1') awards.push('slime-king');
      if (ev.area === 'd2') awards.push('golem-king');
      if (!ev.hurt) awards.push('untouched');
      break;
    case 'ending':
      awards.push('crown');
      if (s.deaths === 0) awards.push('steady');
      if (s.time < 30 * 60) awards.push('swift');
      break;
    default: break;
  }
  return { awards, stats };
}

/** Apply an event: bump counters, then award (counter trophies check the new totals). */
export function handleTrophyEvent(ev, ctx) {
  const { awards, stats } = awardsFor(ev, ctx);
  const totals = {};
  for (const [k, n] of Object.entries(stats)) if (n) totals[k] = bumpStat(GAME, k, n);
  if (totals.blocks >= 10) awards.push('shield');
  if (totals.slimes >= 100) awards.push('slimes');
  for (const id of awards) award(GAME, id);
}

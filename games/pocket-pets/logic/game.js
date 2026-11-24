// The journey: party, bag, coins, badges, dex, where you stand and what you've done.
// Everything here is plain data so it can be saved as JSON. No Phaser.
import { SPECIES, ITEMS, STARTERS, DEX_ORDER } from './data.js';
import { MAPS, LEADERS, BADGES, SHOPS, WALKABLE, GRASS, DIRS, tileAt, buildingAt, doorOf, rivalTeam } from './world.js';
import { createPet, healPet, maxHp, petName, canEvolve, evolve } from './pet.js';
import { rngFrom } from './rng.js';

export const PARTY_MAX = 6;
export const START = { map: 'sproutvale', x: 2, y: 6 };

export function newGame(seed = (Date.now() >>> 0)) {
  return {
    v: 1,
    rng: { s: seed >>> 0 },
    nextUid: 1,
    map: START.map, x: START.x, y: START.y, face: 'down',
    respawn: { ...START },
    party: [], box: [],
    bag: { capsule: 0, potion: 2 },
    coins: 300,
    badges: [],
    flags: {},
    beaten: {},
    taken: {},
    dex: { seen: {}, caught: {} },
    steps: 0,
    champion: false,
    stats: { battles: 0, wins: 0, caught: 0, blackouts: 0 },
    started: Date.now(),
  };
}

export const rngOf = (state) => rngFrom(state.rng);

export function makePet(state, sp, lv) {
  return createPet(sp, lv, { uid: state.nextUid++ });
}

// ---------------------------------------------------------------- party, box, dex

export function markSeen(state, sp) { state.dex.seen[sp] = true; }
export function markCaught(state, sp) { state.dex.seen[sp] = true; state.dex.caught[sp] = true; }
export const dexCounts = (state) => ({
  seen: DEX_ORDER.filter((s) => state.dex.seen[s]).length,
  caught: DEX_ORDER.filter((s) => state.dex.caught[s]).length,
  total: DEX_ORDER.length,
});

/** Add a pet to the party, or the box when the party is full. Returns 'party' or 'box'. */
export function addPet(state, pet) {
  markCaught(state, pet.sp);
  if (state.party.length < PARTY_MAX) { state.party.push(pet); return 'party'; }
  state.box.push(pet);
  return 'box';
}

export function chooseStarter(state, sp) {
  if (!STARTERS.includes(sp) || state.flags.starter) return null;
  const pet = makePet(state, sp, 5);
  addPet(state, pet);
  state.flags.starter = sp;
  state.bag.capsule = (state.bag.capsule || 0) + 5;
  return pet;
}

export const alivePets = (state) => state.party.filter((p) => p.hp > 0);
export const canFight = (state) => alivePets(state).length > 0;

/** Move a party pet to the front (it leads into battle). */
export function makeLead(state, idx) {
  if (idx <= 0 || idx >= state.party.length) return;
  const [p] = state.party.splice(idx, 1);
  state.party.unshift(p);
}

export function moveInParty(state, idx, dir) {
  const j = idx + dir;
  if (j < 0 || j >= state.party.length) return;
  [state.party[idx], state.party[j]] = [state.party[j], state.party[idx]];
}

/** Box <-> party. Keeps at least one pet in the party. */
export function depositPet(state, idx) {
  if (state.party.length <= 1) return 'You need at least one pet with you.';
  const [p] = state.party.splice(idx, 1);
  state.box.push(p);
  return '';
}
export function withdrawPet(state, idx) {
  if (state.party.length >= PARTY_MAX) return 'Your party is full (6 pets).';
  const [p] = state.box.splice(idx, 1);
  state.party.push(p);
  return '';
}
export function swapWithBox(state, partyIdx, boxIdx) {
  const a = state.party[partyIdx]; const b = state.box[boxIdx];
  if (!a || !b) return;
  state.party[partyIdx] = b; state.box[boxIdx] = a;
}

export function healAll(state) {
  for (const p of state.party) healPet(p);
  for (const p of state.box) healPet(p);
}

/** Pets that are ready to evolve now. */
export const pendingEvolutions = (state) => state.party.filter((p) => canEvolve(p));
export function evolvePet(state, pet) {
  const r = evolve(pet);
  if (r) markCaught(state, r.to);
  return r;
}

// ---------------------------------------------------------------- bag and shop

export function addItem(state, item, n = 1) { state.bag[item] = (state.bag[item] || 0) + n; }

export function shopStock(state, stockId) {
  return SHOPS[stockId].filter((id) => (ITEMS[id].badges || 0) <= state.badges.length);
}

export function buy(state, item, n = 1) {
  const cost = ITEMS[item].price * n;
  if (state.coins < cost) return 'Not enough coins.';
  state.coins -= cost;
  addItem(state, item, n);
  return '';
}

// ---------------------------------------------------------------- the map

export const currentMap = (state) => MAPS[state.map];

function needMet(state, need) {
  if (!need) return true;
  if (need.badges != null && state.badges.length < need.badges) return false;
  return true;
}

/** NPCs on a map as they stand right now (moved aside, hidden, beaten...). */
export function npcsOn(state, mapId = state.map) {
  const map = MAPS[mapId];
  const out = [];
  for (const n of map.npcs || []) {
    const beaten = !!state.beaten[n.id];
    if (n.hideWhenBeaten && beaten) continue;
    let { x, y } = n;
    let moved = false;
    if (n.aside) {
      if (n.kind === 'gate' && needMet(state, n.need)) moved = true;
      if (n.asideFlag && state.flags[n.asideFlag]) moved = true;
      if (n.kind === 'leader' && beaten) moved = true;
    }
    if (moved) [x, y] = n.aside;
    out.push({ ...n, x, y, beaten, moved });
  }
  return out;
}

export function itemsOn(state, mapId = state.map) {
  return (MAPS[mapId].items || []).filter((it) => !state.taken[it.id]);
}

export function npcAt(state, x, y) { return npcsOn(state).find((n) => n.x === x && n.y === y) || null; }

/** Can the player stand on this tile? */
export function walkable(state, x, y) {
  const map = currentMap(state);
  if (!WALKABLE.has(tileAt(map, x, y))) return false;
  if (buildingAt(map, x, y)) return false;
  if (npcAt(state, x, y)) return false;
  if ((map.signs || []).some((s) => s.x === x && s.y === y)) return false;
  return true;
}

/** Shortest path (list of [x, y] steps, not including the start) with BFS, or null. */
export function findPath(state, tx, ty, { adjacent = false } = {}) {
  const map = currentMap(state);
  const w = map.tiles[0].length; const h = map.tiles.length;
  const key = (x, y) => y * w + x;
  const prev = new Map([[key(state.x, state.y), null]]);
  const q = [[state.x, state.y]];
  const goal = (x, y) => (adjacent ? Math.abs(x - tx) + Math.abs(y - ty) === 1 : x === tx && y === ty);
  if (goal(state.x, state.y)) return [];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of Object.values(DIRS)) {
      const nx = x + dx; const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || prev.has(key(nx, ny))) continue;
      if (!walkable(state, nx, ny)) continue;
      prev.set(key(nx, ny), [x, y]);
      if (goal(nx, ny)) {
        const path = [[nx, ny]];
        let p = prev.get(key(nx, ny));
        while (p && !(p[0] === state.x && p[1] === state.y)) { path.unshift(p); p = prev.get(key(p[0], p[1])); }
        return path;
      }
      q.push([nx, ny]);
    }
  }
  return null;
}

export const dirTo = (fx, fy, tx, ty) => (tx > fx ? 'right' : tx < fx ? 'left' : ty > fy ? 'down' : 'up');

/**
 * Take one step. Returns { moved, events } where events can be:
 *   { t: 'exit', to }  { t: 'item', item, n }  { t: 'spotted', npc }  { t: 'wild', sp, lv }
 * A blocked step just turns the player to face that way.
 */
export function step(state, dir, { encounters = true } = {}) {
  const [dx, dy] = DIRS[dir];
  state.face = dir;
  const nx = state.x + dx; const ny = state.y + dy;
  const map = currentMap(state);
  const exit = (map.exits || []).find((e) => e.x === nx && e.y === ny);
  if (!walkable(state, nx, ny)) return { moved: false, events: [] };
  state.x = nx; state.y = ny;
  state.steps += 1;
  const events = [];
  if (exit) {
    changeMap(state, exit.to, exit.tx, exit.ty);
    events.push({ t: 'exit', to: exit.to });
    const amb = npcsOn(state).find((n) => n.ambush && !n.beaten && trainerReady(state, n));
    if (amb) events.push({ t: 'spotted', npc: amb });
    return { moved: true, events };
  }
  const it = itemsOn(state).find((i) => i.x === nx && i.y === ny);
  if (it) { state.taken[it.id] = true; addItem(state, it.item, it.n); events.push({ t: 'item', item: it.item, n: it.n }); }
  const spot = spottedBy(state);
  if (spot) { events.push({ t: 'spotted', npc: spot }); return { moved: true, events }; }
  if (encounters && GRASS.has(tileAt(map, nx, ny)) && map.wild && canFight(state)) {
    const rng = rngOf(state);
    if (rng() < map.wild.rate) events.push({ t: 'wild', ...rollWild(map.wild.grass, rng) });
  }
  return { moved: true, events };
}

export function changeMap(state, to, x, y) {
  state.map = to; state.x = x; state.y = y;
}

export function rollWild(table, rng) {
  const total = table.reduce((a, r) => a + r[3], 0);
  let roll = rng() * total;
  for (const [sp, lo, hi, w] of table) {
    roll -= w;
    if (roll <= 0) return { sp, lv: rng.int(lo, hi) };
  }
  const [sp, lo, hi] = table[table.length - 1];
  return { sp, lv: rng.int(lo, hi) };
}

const trainerReady = (state, n) => (n.kind === 'trainer' || n.kind === 'leader') && !n.beaten && (!n.needFlag || state.flags[n.needFlag]);

/** A trainer who can see the player (in a straight line, nothing in between). */
export function spottedBy(state) {
  if (!canFight(state)) return null;
  for (const n of npcsOn(state)) {
    if (!trainerReady(state, n) || !n.sight) continue;
    const [dx, dy] = DIRS[n.face || 'down'];
    for (let k = 1; k <= n.sight; k++) {
      const x = n.x + dx * k; const y = n.y + dy * k;
      if (x === state.x && y === state.y) return n;
      if (!WALKABLE.has(tileAt(currentMap(state), x, y)) || npcAt(state, x, y)) break;
    }
  }
  return null;
}

/** The tile in front of the player. */
export function facing(state) {
  const [dx, dy] = DIRS[state.face];
  return { x: state.x + dx, y: state.y + dy };
}

/**
 * What happens when the player uses the tile at x, y (next to them). Returns an action:
 *   { t: 'talk', lines, npc? }  { t: 'battle', setup }  { t: 'heal', name }  { t: 'shop', stock, name }
 *   { t: 'starter' }  { t: 'gift', item, n, lines }  null
 */
export function interact(state, x, y) {
  const map = currentMap(state);
  const npc = npcAt(state, x, y);
  if (npc) return talkTo(state, npc);
  const sign = (map.signs || []).find((s) => s.x === x && s.y === y);
  if (sign) return { t: 'talk', lines: sign.text };
  const b = buildingAt(map, x, y);
  if (b) {
    const d = doorOf(b);
    if (d.x !== x || d.y !== y) return null;
    return enterBuilding(state, b);
  }
  return null;
}

function talkTo(state, npc) {
  if (npc.kind === 'prof') {
    if (!state.flags.starter) return { t: 'starter', npc };
    return { t: 'talk', npc, lines: profLines(state) };
  }
  if (npc.kind === 'gate') {
    if (!npc.moved) return { t: 'talk', npc, lines: npc.text };
    return { t: 'talk', npc, lines: ['Guard: You may pass. Good luck!'] };
  }
  if (npc.kind === 'gift') {
    if (state.taken[npc.id]) return { t: 'talk', npc, lines: npc.after };
    state.taken[npc.id] = true;
    addItem(state, npc.item, npc.n);
    return { t: 'gift', npc, item: npc.item, n: npc.n, lines: npc.text };
  }
  if (npc.kind === 'trainer') {
    if (npc.beaten) return { t: 'talk', npc, lines: npc.lose };
    if (!trainerReady(state, npc)) return { t: 'talk', npc, lines: ['...'] };
    return { t: 'battle', npc, setup: trainerSetup(state, npc) };
  }
  if (npc.kind === 'leader') {
    const L = LEADERS[npc.id];
    if (npc.beaten) return { t: 'talk', npc, lines: [`${L.name}: Go on through. You've earned it.`] };
    return { t: 'battle', npc, setup: leaderSetup(state, npc.id) };
  }
  return { t: 'talk', npc, lines: npc.text || ['...'] };
}

function profLines(state) {
  const c = dexCounts(state);
  const lines = [`Prof. Rowan: Your PetDex has ${c.caught} of ${c.total} pets caught.`];
  if (c.caught < 8) lines.push('Catch lots of different pets! Each type has its strengths.');
  else if (c.caught < c.total) lines.push('Splendid progress! Keep looking in every patch of grass and the cave.');
  else lines.push('A complete PetDex! You are a true Pocket Pets master!');
  return lines;
}

function enterBuilding(state, b) {
  if (b.kind === 'clinic' || b.kind === 'home') return { t: 'heal', name: b.name, home: b.kind === 'home' };
  if (b.kind === 'shop') return { t: 'shop', stock: b.stock, name: b.name };
  if (b.kind === 'lab') return { t: 'talk', lines: profLines(state).concat(state.flags.starter ? [] : ['(The professor is waiting outside, by the north road.)']) };
  if (b.kind === 'house') return { t: 'talk', lines: b.text };
  if (b.kind === 'hall') {
    const L = LEADERS[b.leader];
    if (state.beaten[b.leader]) return { t: 'talk', lines: [`${L.name}: You already have the ${L.badgeName}. Keep it shining!`] };
    if (!canFight(state)) return { t: 'talk', lines: ['Your pets are too tired to battle.'] };
    return { t: 'battle', setup: leaderSetup(state, b.leader) };
  }
  if (b.kind === 'tower') {
    if (state.badges.length < BADGES.length) return { t: 'talk', lines: ['The tower door is sealed. Four badges are needed.'] };
    return { t: 'battle', setup: leaderSetup(state, 'aria') };
  }
  return null;
}

// ---------------------------------------------------------------- battles

export function wildSetup(state, sp, lv) {
  markSeen(state, sp);
  return { kind: 'wild', foeParty: [createPet(sp, lv, { uid: -1 })], foe: { name: '' } };
}

export function trainerSetup(state, npc) {
  const team = npc.rival ? rivalTeam(npc.team, state.flags.starter) : npc.team;
  return {
    kind: 'trainer', id: npc.id, rival: !!npc.rival, friendly: !!npc.friendly,
    foeParty: team.map(([sp, lv], i) => createPet(sp, lv, { uid: -10 - i })),
    foe: { name: npc.name, title: npc.title || 'Tamer', items: npc.items || {}, ch: npc.ch, id: npc.id },
    intro: npc.intro || [], lose: npc.lose || [], win: npc.win || [],
    reward: npc.reward * Math.max(...team.map(([, lv]) => lv)),
    weight: npc.skillWeight ?? 0.35,
  };
}

export function leaderSetup(state, id) {
  const L = LEADERS[id];
  return {
    kind: 'trainer', id, leader: true, champion: !!L.champion, badge: L.badge,
    foeParty: L.team.map(([sp, lv], i) => createPet(sp, lv, { uid: -10 - i })),
    foe: { name: L.name, title: L.title, items: L.items || {}, ch: L.ch, id },
    intro: L.intro, lose: L.lose, win: L.win,
    reward: L.reward * Math.max(...L.team.map(([, lv]) => lv)),
    weight: L.skillWeight ?? 1,
  };
}

/**
 * Apply a finished battle to the journey. result: 'win' | 'lose' | 'caught' | 'ran'.
 * Returns { lines, coins, badge, blackout, caughtTo }.
 */
export function afterBattle(state, setup, result, caughtPet) {
  const out = { lines: [], coins: 0, badge: null, blackout: false };
  state.stats.battles += 1;
  for (const p of setup.foeParty) markSeen(state, p.sp);
  if (result === 'win') {
    state.stats.wins += 1;
    if (setup.kind === 'trainer') {
      state.beaten[setup.id] = true;
      state.coins += setup.reward;
      out.coins = setup.reward;
      out.lines.push(`You got ${setup.reward} coins for winning!`);
      if (setup.leader && !setup.champion && !state.badges.includes(setup.id)) {
        state.badges.push(setup.id);
        out.badge = setup.id;
        out.lines.push(`You received the ${LEADERS[setup.id].badgeName}!`);
      }
      if (setup.champion) { state.champion = true; state.flags.championAt = state.flags.championAt || Date.now(); }
    }
  } else if (result === 'caught' && caughtPet) {
    const pet = { ...caughtPet, uid: state.nextUid++ };
    delete pet.xpGiven;
    state.stats.caught += 1;
    out.caughtTo = addPet(state, pet);
    out.caught = pet;
    if (out.caughtTo === 'box') out.lines.push(`Your party is full, so ${petName(pet)} was sent to the Pet Box.`);
  } else if (result === 'lose') {
    if (setup.friendly) {
      // The first rival battle is just for fun: it counts as done and costs nothing.
      state.beaten[setup.id] = true;
      healAll(state);
      out.lines.push('Your pets are tired. You give them a rest.');
    } else blackout(state, out);
  }
  return out;
}

/** All your pets fainted: lose some coins and wake up at the last place you rested. */
export function blackout(state, out = { lines: [] }) {
  const lost = Math.floor(state.coins * 0.3);
  state.coins -= lost;
  state.stats.blackouts += 1;
  healAll(state);
  state.map = state.respawn.map; state.x = state.respawn.x; state.y = state.respawn.y; state.face = 'down';
  out.blackout = true;
  out.lost = lost;
  out.lines.push(`You dropped ${lost} coins in the panic...`, 'You hurried back to rest your pets.');
  return out;
}

/** Rest at a clinic or at home: heal everyone and remember this spot. */
export function restHere(state) {
  healAll(state);
  state.respawn = { map: state.map, x: state.x, y: state.y };
}

export function hpSummary(state) {
  return state.party.map((p) => `${petName(p)} ${p.hp}/${maxHp(p)}`).join(', ');
}

export const speciesName = (sp) => SPECIES[sp].name;

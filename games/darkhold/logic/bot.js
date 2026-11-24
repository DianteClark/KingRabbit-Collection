// A simple bot that plays whole runs through the same actions the player uses. It only uses what
// the player could know (the remembered map, visible monsters). Used by the balance tests.
import * as G from './game.js';
import { MELEE, RANGED, ARMORS, MONSTERS } from './data.js';

const PERK_ORDER = ['tough', 'brawler', 'stalwart', 'vampire', 'secondwind', 'alchemist', 'nimble', 'hunter', 'nightsight', 'frugal', 'marksman', 'scavenger', 'lightfoot'];
const avg = (d) => (d[0] + d[1]) / 2;

function gearScore(it) {
  switch (it.k) {
    case 'melee': return avg(MELEE[it.id].dmg) + (it.e || 0) + MELEE[it.id].acc * 10;
    case 'ranged': return avg(RANGED[it.id].dmg) + (it.e || 0) + RANGED[it.id].range * 0.3;
    case 'armor': return ARMORS[it.id].armor + (it.e || 0);
    case 'ring': return { vigor: 5, guard: 4, might: 4, regen: 4.5, light: 3, stealth: 2 }[it.id];
    default: return 0;
  }
}

/** Choose the next action for the run. */
export function botAction(st) {
  const p = st.p;
  if (st.levelUp) return { type: 'perk', id: [...st.levelUp.choices].sort((a, b) => PERK_ORDER.indexOf(a) - PERK_ORDER.indexOf(b))[0] };
  const inv = p.inv;
  const find = (fn) => inv.findIndex(fn);
  const hpFrac = p.hp / G.maxHp(st);
  const seen = G.visibleMonsters(st).filter((m) => !m.disguised);
  const adjacent = seen.filter((m) => Math.abs(m.x - p.x) + Math.abs(m.y - p.y) === 1);
  const threat = seen.filter((m) => m.st === 'hunt');

  // Emergencies.
  if (hpFrac < 0.4 && (threat.length || hpFrac < 0.25)) {
    let i = find((it) => it.k === 'potion' && (it.id === 'healing' || it.id === 'restore') && st.known.potion[it.id]);
    if (i < 0 && hpFrac < 0.3) i = find((it) => it.k === 'potion' && !st.known.potion[it.id]);
    if (i >= 0) return { type: 'use', i };
    const t = find((it) => it.k === 'scroll' && it.id === 'teleport' && st.known.scroll.teleport);
    if (t >= 0 && hpFrac < 0.25 && adjacent.length) return { type: 'use', i: t };
  }
  // Upkeep.
  for (let i = 0; i < inv.length; i++) {
    const it = inv[i];
    if (!G.isEquip(it)) continue;
    const cur = p.eq[it.k];
    if (!cur || gearScore(it) > gearScore(cur) + 0.1) return { type: 'use', i };
  }
  if (p.fuel < 140) {
    const i = find((it) => it.k === (p.fuel < 40 ? 'torch' : 'oil')) >= 0 ? find((it) => it.k === (p.fuel < 40 ? 'torch' : 'oil')) : find((it) => it.k === 'oil' || it.k === 'torch');
    if (i >= 0) return { type: 'use', i };
    const fl = find((it) => it.k === 'potion' && it.id === 'flame' && st.known.potion.flame);
    if (fl >= 0 && p.fuel < 60) return { type: 'use', i: fl };
  }
  if (p.food < 150) { const i = find((it) => it.k === 'food'); if (i >= 0) return { type: 'use', i }; }

  // The Hollow King: keep the braziers burning so blows land.
  const king = seen.find((m) => m.kind === 'king' && m.st === 'hunt');
  if (king && !G.kingLit(st, king)) {
    const unlit = st.f.braziers.filter((b) => !b.lit).map((b) => ({ b, path: G.pathTo(st, b.x, b.y) })).filter((o) => o.path).sort((a, c) => a.path.length - c.path.length)[0];
    if (unlit && unlit.path.length <= 6) return step(p, unlit.path[0]);
  }
  // Fight.
  if (adjacent.length) {
    const m = adjacent.sort((a, b) => a.hp - b.hp)[0];
    return { type: 'move', dx: m.x - p.x, dy: m.y - p.y };
  }
  const ts = G.targets(st).filter((m) => m.st === 'hunt' || m.st === 'sleep');
  if (ts.length) return { type: 'fire', target: ts[0].id };
  // Go after awake monsters that are close (better than being shot at while exploring).
  const near = threat.filter((m) => !MONSTERS[m.kind].tags.includes('fearLight') && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 6).sort((a, b) => (Math.abs(a.x - p.x) + Math.abs(a.y - p.y)) - (Math.abs(b.x - p.x) + Math.abs(b.y - p.y)));
  if (near.length && hpFrac > 0.3) {
    const path = G.pathTo(st, near[0].x, near[0].y);
    if (path && path.length) return step(p, path[0]);
  }

  // Try out unknown things when it is calm.
  if (!threat.length && hpFrac > 0.7) {
    const s = find((it) => it.k === 'scroll' && !st.known.scroll[it.id]);
    if (s >= 0) return { type: 'use', i: s };
    if (hpFrac > 0.9) { const q = find((it) => it.k === 'potion' && !st.known.potion[it.id]); if (q >= 0) return { type: 'use', i: q }; }
    const e = find((it) => it.k === 'scroll' && it.id === 'enchant');
    if (e >= 0) return { type: 'use', i: e };
  }
  if (inv.length >= 11) {
    const junk = find((it) => (it.k === 'potion' && ['poison', 'shadow'].includes(it.id) && st.known.potion[it.id]) || (it.k === 'scroll' && ['summon', 'noise'].includes(it.id) && st.known.scroll[it.id]) || (G.isEquip(it) && p.eq[it.k] && gearScore(it) <= gearScore(p.eq[it.k])));
    if (junk >= 0) return { type: 'drop', i: junk };
  }

  // Shop.
  if (G.shopNear(st)) {
    const want = st.f.shop.stock.findIndex((r) => !r.sold && G.shopPrice(st, r.item) <= p.gold && (r.item.k === 'potion' || r.item.k === 'oil' || (r.item.k === 'food' && p.food < 600) || (r.item.k === 'armor' && (!p.eq.armor || gearScore(r.item) > gearScore(p.eq.armor))) || (r.item.k === 'melee' && gearScore(r.item) > gearScore(p.eq.melee))));
    if (want >= 0 && p.inv.length < 12) return { type: 'buy', i: want };
  }

  // Going back and forth? Clear the way by fighting whatever is closest.
  const hist = (st._botPos ||= []);
  hist.push(p.y * G.W + p.x);
  if (hist.length > 16) hist.shift();
  if (hist.length === 16 && new Set(hist).size <= 3 && seen.length) {
    const m = [...seen].sort((a, c) => (Math.abs(a.x - p.x) + Math.abs(a.y - p.y)) - (Math.abs(c.x - p.x) + Math.abs(c.y - p.y)))[0];
    const path = G.pathTo(st, m.x, m.y, { ignoreMonsters: true });
    if (path && path.length) return step(p, path[0]);
  }
  const onStairs = G.tile(st, p.x, p.y) === '>';
  const goal = exploreTarget(st);
  if (onStairs && (!goal || st.floorTurns > 260 || (p.fuel < 60 && find((it) => it.k === 'oil') < 0))) return { type: 'descend' };
  if (goal) {
    const path = G.pathTo(st, goal[0], goal[1]) || G.pathTo(st, goal[0], goal[1], { ignoreMonsters: true });
    if (path && path.length) return step(p, path[0]);
  }
  // Nothing left: head for the stairs, or search for secret doors.
  if (st.f.stairs && st.f.seen[st.f.stairs.y * G.W + st.f.stairs.x]) {
    const path = G.pathTo(st, st.f.stairs.x, st.f.stairs.y) || G.pathTo(st, st.f.stairs.x, st.f.stairs.y, { ignoreMonsters: true });
    if (path && path.length) return step(p, path[0]);
    if (onStairs) return { type: 'descend' };
  }
  return { type: 'search' };
}

function step(p, [x, y]) { return { type: 'move', dx: x - p.x, dy: y - p.y }; }

/** Nearest useful place to go: an item, an unlit brazier, the shop, or the edge of the known map. */
export function exploreTarget(st) {
  return exploreFrom(st, false) || exploreFrom(st, true);
}

function exploreFrom(st, throughTraps) {
  const f = st.f;
  const W = G.W; const H = G.H;
  const p = st.p;
  const start = p.y * W + p.x;
  const prev = new Map([[start, -1]]);
  const q = [start];
  const wantShop = f.shop && f.seen[f.shop.y * W + f.shop.x] && !st._botShopped?.[st.depth] && p.gold >= 40;
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi];
    const x = c % W; const y = Math.floor(c / W);
    if (c !== start) {
      if (f.items.some((it) => it.x === x && it.y === y && !it.left)) return [x, y];
    }
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx; const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const i = ny * W + nx;
      const b = G.brazierAt(st, nx, ny);
      if (b && !b.lit && f.seen[i]) return [nx, ny];
      if (wantShop && f.shop.x === nx && f.shop.y === ny) {
        st._botShopped = { ...(st._botShopped || {}), [st.depth]: true };
        return [x, y];
      }
      if (!f.seen[i] && c !== start) return [x, y];
      if (!f.seen[i] && c === start) continue;
      if (prev.has(i)) continue;
      const t = f.t[i];
      if (!G.tile(st, nx, ny) || !['.', '+', "'", '>'].includes(t)) continue;
      if (f.shop && f.shop.x === nx && f.shop.y === ny) continue;
      const trap = G.trapAt(st, nx, ny);
      if (trap && trap.found && !throughTraps) continue;
      prev.set(i, c);
      q.push(i);
    }
  }
  return null;
}

/** Play a whole run. Returns a summary. */
export function playRun(opts, { maxActions = 30000 } = {}) {
  const st = G.newRun(opts);
  let stuck = 0;
  for (let n = 0; n < maxActions && !st.over; n++) {
    const before = st.turn;
    const depth = st.depth;
    const a = botAction(st);
    G.act(st, stuck > 4 ? { type: 'wait' } : a);
    stuck = st.turn === before && st.depth === depth ? stuck + 1 : 0;
  }
  return { won: st.over === 'won', depth: st.depth, turns: st.turn, cause: st.killedBy, lvl: st.p.lvl, st };
}

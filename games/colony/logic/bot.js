// A simple player for tests: lays out a camp around the landing spot, keeps orders topped up and
// answers every popup. botStep(s) is called once per game hour.
import { W, H, T, P, Z, TPD, BUILDS } from './data.js';
import { START, idx, tx, ty, inMap } from './map.js';
import { settlers, stock, foodCount, bAt, builtOf, dayOf, season, hostiles, canPlace } from './world.js';
import * as S from './sim.js';
import { canTrade } from './story.js';

const rect = (x0, y0, w, h) => { const out = []; for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (inMap(x, y)) out.push(idx(x, y)); return out; };

export function botStep(s) {
  if (s.pending) answer(s);
  if (s.result) return;
  const ps = settlers(s);
  const st = stock(s);
  const cx = START.x; const cy = START.y;
  const day = dayOf(s);
  const has = (k) => Object.values(s.blds).some((b) => b.k === k);
  const count = (k) => Object.values(s.blds).filter((b) => b.k === k).length;
  if (!s.zone.some((z) => z === Z.STOCK)) S.zone(s, 'stock', rect(cx - 3, cy + 3, 6, 4));
  if (!has('campfire')) S.build(s, 'campfire', idx(cx, cy - 2));
  // Beds in a ring around the fire, inside its warmth.
  const ring = [[-2, -1], [2, -1], [-2, -3], [2, -3], [0, -4], [-1, -4], [1, -4], [-2, -2], [2, -2], [0, 0], [-1, 0], [1, 0]];
  for (const [dx, dy] of ring) {
    if (count('bed') >= ps.length) break;
    const i = idx(cx + dx, cy - 2 + dy);
    if (canPlace(s, 'bed', i).ok) S.build(s, 'bed', i);
  }
  const farmTiles = s.zone.filter((z) => z === Z.FARM).length;
  if (farmTiles < ps.length * 8 && season(s).grow) {
    const w = 5; const rows = Math.ceil((ps.length * 8) / w);
    S.zone(s, 'farm', rect(cx + 4, cy - 3, w, rows));
  }
  if ((st.wood || 0) < 70) designateNear(s, 'chop', (i) => s.plant[i] === P.TREE || s.plant[i] === P.PINE, 6);
  designateNear(s, 'harvest', (i) => s.plant[i] === P.BUSH || s.plant[i] === P.HERB, 20, 16);
  if (day >= 2 && ((st.stone || 0) < 30 || (st.metal || 0) < 30)) {
    designateNear(s, 'mine', (i) => s.ter[i] === ((st.metal || 0) < 30 ? T.ORE : T.ROCK), 3);
  }
  if (foodCount(s) < ps.length * 10) {
    const a = s.mobs.filter((m) => m.kind === 'animal' && !m.dead && !m.hostile && !m.hunt && m.def.fierce < 0.3)
      .sort((x, y) => Math.hypot(tx(x.at) - cx, ty(x.at) - cy) - Math.hypot(tx(y.at) - cx, ty(y.at) - cy))[0];
    if (a && !s.mobs.some((m) => m.hunt && !m.dead)) a.hunt = true;
  }
  if (day >= 2 && !has('workbench')) S.build(s, 'workbench', idx(cx - 3, cy - 2));
  if (day >= 3 && count('storage') < 2) for (const dx of [-4, -5]) { const i = idx(cx + dx, cy + 3); if (canPlace(s, 'storage', i).ok) S.build(s, 'storage', i); }
  if (builtOf(s, 'workbench').length) {
    const owned = (k) => (st[k] || 0) + ps.filter((p) => Object.values(p.gear).includes(k)).length;
    if (owned('tools') + s.bills.tools < ps.length) S.setBill(s, 'tools', s.bills.tools + 1);
    if (owned('parka') + s.bills.parka < ps.length && (st.leather || 0) >= 6) S.setBill(s, 'parka', s.bills.parka + 1);
    if ((st.medicine || 0) + s.bills.medicine < 4 && (st.herbs || 0) >= 3) S.setBill(s, 'medicine', s.bills.medicine + 1);
    if (s.mode !== 'peaceful' && owned('spear') + owned('bow') + owned('club') + s.bills.spear < ps.length) S.setBill(s, 'spear', s.bills.spear + 1);
  }
  if (day >= 6 && !has('stove') && (st.metal || 0) >= 10 && (st.stone || 0) >= 8) S.build(s, 'stove', idx(cx + 1, cy - 2));
  if (s.botRadio && day >= 10 && !has('radio') && (st.metal || 0) >= 30) S.build(s, 'radio', idx(cx - 3, cy - 4));
  if (s.botRadio && builtOf(s, 'radio').length && !s.radio.calling) S.callRescue(s);
  if (hostiles(s).length && !s.alert) S.setAlert(s, 'fight');
}

function designateNear(s, kind, test, want, maxR = 30) {
  const cur = Object.values(s.des).filter((d) => d === kind).length;
  if (cur >= want) return;
  const cand = [];
  for (let i = 0; i < s.plant.length; i++) {
    if (s.des[i] || !test(i)) continue;
    const d = Math.hypot(tx(i) - START.x, ty(i) - START.y);
    if (d <= maxR) cand.push([d, i]);
  }
  cand.sort((a, b) => a[0] - b[0]);
  S.designate(s, kind, cand.slice(0, want - cur).map((c) => c[1]));
}

function answer(s) {
  const pd = s.pending;
  if (pd.kind === 'trader') {
    pd.deals.forEach((d, i) => { if (canTrade(s, d) && (d.get.meal || d.get.medicine || d.get.metal || d.get.crop)) S.trade(s, i); });
    S.resolve(s, 'leave');
  } else if (pd.kind === 'raid' || pd.kind === 'wolves') S.resolve(s, 'fight');
  else if (pd.choices.some((c) => c.id === 'yes')) S.resolve(s, 'yes');
  else S.resolve(s, pd.choices[0].id);
}

/** Run a whole game with the bot. Returns the final state. */
export function playBot(mode, seed, days, opts = {}) {
  const s = S.newGame(mode, { seed, skill: opts.skill, scenario: opts.scenario });
  if (opts.radio) s.botRadio = true;
  const end = s.t + days * TPD;
  while (s.t < end && !s.result) {
    botStep(s);
    for (let k = 0; k < 20 && !s.pending && !s.result; k++) { S.tick(s); opts.each?.(s); }
    if (s.pending) botStep(s);
  }
  return s;
}

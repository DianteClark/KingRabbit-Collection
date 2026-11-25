// A bot that plays Pixel Quest from the first step to the ending using only the game's pure
// logic (no Phaser): it walks with the real step() rules (random battles included), talks,
// shops, rests, solves the puzzles and fights every battle with the Auto battle AI.
import * as G from '../games/pixel-quest/logic/game.js';
import * as B from '../games/pixel-quest/logic/battle.js';
import { MAPS, npcSpots, chestsOf, leversOf, locksOf, torchesOf, tileDef } from '../games/pixel-quest/logic/maps.js';
import { SHOPS, GEAR, ITEMS, CLASS_LETTER } from '../games/pixel-quest/logic/data.js';
import { statsOf, canEquip } from '../games/pixel-quest/logic/stats.js';

const DIRS = G.DIRS;

export class Bot {
  constructor(st, { log = false } = {}) {
    this.st = st;
    this.rng = G.rngOf(st);
    this.verbose = log;
    this.stats = { battles: 0, rounds: 0, wipes: 0, steps: 0, lines: 0, bossTries: {}, levels: {} };
  }

  log(...a) { if (this.verbose) console.log(...a); }

  // ---------------------------------------------------------------- planning

  /** BFS over (map, x, y, switch) using the real step() rules. Returns actions or null. */
  plan(target) {
    const st = this.st;
    const goal = (n) => n.map === target.map && (target.adjacent ? Math.abs(n.x - target.x) + Math.abs(n.y - target.y) === 1 : n.x === target.x && n.y === target.y);
    const start = { map: st.map, x: st.x, y: st.y, sw: !!st.flags.tw_sw };
    const key = (n) => `${n.map}|${n.x}|${n.y}|${n.sw ? 1 : 0}`;
    const prev = new Map([[key(start), null]]);
    const q = [start];
    while (q.length) {
      const n = q.shift();
      if (goal(n)) {
        const acts = [];
        let k = key(n);
        while (prev.get(k)) { const p = prev.get(k); acts.unshift(p.act); k = p.from; }
        return acts;
      }
      const scratch = { ...st, map: n.map, x: n.x, y: n.y, flags: { ...st.flags, tw_sw: n.sw }, repel: 1e9, grace: 1e9, steps: 0 };
      for (const dir of Object.keys(DIRS)) {
        const s2 = { ...scratch, flags: scratch.flags };
        const r = G.step(s2, dir, () => 1);
        if (!r.moved) continue;
        const nn = { map: s2.map, x: s2.x, y: s2.y, sw: n.sw };
        const k = key(nn);
        if (prev.has(k)) continue;
        prev.set(k, { from: key(n), act: dir });
        q.push(nn);
      }
      const map = MAPS[n.map];
      if (map.bar) {
        for (const [dx, dy] of Object.values(DIRS)) {
          const ch = map.tiles[n.y + dy]?.[n.x + dx];
          if (ch === 'Z') {
            const nn = { ...n, sw: !n.sw };
            const k = key(nn);
            if (!prev.has(k)) { prev.set(k, { from: key(n), act: { toggle: [n.x + dx, n.y + dy] } }); q.push(nn); }
          }
        }
      }
    }
    return null;
  }

  /** Walk to a target, fighting whatever turns up. Returns true when there. */
  travel(target, tries = 6) {
    for (let t = 0; t < tries; t++) {
      const acts = this.plan(target);
      if (!acts) throw new Error(`No route to ${JSON.stringify(target)} from ${this.st.map} ${this.st.x},${this.st.y}`);
      let ok = true;
      for (const a of acts) {
        if (typeof a === 'object') {
          const [cx, cy] = a.toggle;
          this.st.face = G.dirTo(this.st.x, this.st.y, cx, cy);
          G.toggleCrystal(this.st);
          continue;
        }
        const r = G.step(this.st, a, this.rng);
        this.stats.steps++;
        if (!r.moved) { ok = false; break; }
        for (const e of r.events) {
          if (e.lines) this.stats.lines += e.lines.length;
          if (e.t === 'battle') {
            const res = this.fight(e.enemies);
            if (res === 'lose') { ok = false; break; }
            this.maintain();
            if (this.partyWeak() && !this.resting) { this.resting = true; this.goHomeAndRest(); this.resting = false; ok = false; break; }
          }
        }
        if (!ok) break;
      }
      if (ok) return true;
    }
    throw new Error('travel failed');
  }

  // ---------------------------------------------------------------- battles

  fight(enemies, boss = null) {
    const st = this.st;
    const startHp = st.party.map((m) => `${m.hp}/${statsOf(m).hp}:${m.mp}`).join(' ');
    const weak = this.partyWeak();
    const b = B.createBattle({ party: st.party, enemies, bag: st.bag, rng: this.rng, boss: !!boss, ...G.battleOpts(st), ...(boss ? { phase2: G.bossSetup(boss).phase2 } : {}) });
    let rounds = 0;
    while (!b.over && rounds < 300) {
      // Already worn out before this fight: run, like a player would.
      const flee = !boss && weak && b.canRun;
      const ev = B.runRound(b, flee ? b.allies.map(() => ({ type: 'run' })) : B.autoCommands(b));
      for (const e of ev) if (e.t === 'steal') st.steals++;
      rounds++;
    }
    const res = B.finish(b);
    st.battles++;
    this.stats.battles++;
    this.stats.rounds += rounds;
    if (b.over === 'win') G.applyWin(st, res, { boss });
    else if (b.over === 'lose') { G.applyWipe(st); this.stats.wipes++; this.log('WIPE', enemies.join(','), 'lv', st.party.map((m) => m.lv).join('/'), 'start', startHp, 'rounds', rounds, st.map); }
    return b.over;
  }

  /** Heal up between battles with spells and items, like a player would. */
  maintain() {
    const st = this.st;
    const ci = st.party.findIndex((m) => m.cls === 'cleric');
    for (let guard = 0; guard < 12; guard++) {
      const dead = st.party.findIndex((m) => m.hp <= 0);
      if (dead >= 0) {
        if (ci >= 0 && st.party[ci].hp > 0 && G.castField(st, ci, 'raise', dead).ok) continue;
        if (G.useItemField(st, 'lifeleaf', dead).ok) continue;
      }
      const low = st.party.map((m, i) => [m, i]).filter(([m]) => m.hp > 0 && m.hp < statsOf(m).hp * 0.6).sort((a, b) => a[0].hp - b[0].hp)[0];
      if (!low) break;
      if (ci >= 0 && st.party[ci].hp > 0 && st.party[ci].mp > statsOf(st.party[ci]).mp * 0.3 && G.castField(st, ci, 'heal', low[1]).ok) continue;
      if (low[0].hp < statsOf(low[0]).hp * 0.35 && G.useItemField(st, 'herb', low[1]).ok) continue;
      break;
    }
    for (let i = 0; i < st.party.length; i++) {
      const m = st.party[i];
      if (m.st === 'poison' && !(ci >= 0 && G.castField(st, ci, 'cure', i).ok)) G.useItemField(st, 'antidote', i);
    }
  }

  partyWeak() {
    const st = this.st;
    const hp = st.party.reduce((s, m) => s + Math.max(0, m.hp), 0);
    const max = st.party.reduce((s, m) => s + statsOf(m).hp, 0);
    const cl = st.party.find((m) => m.cls === 'cleric');
    const mg = st.party.find((m) => m.cls === 'mage');
    return st.party.some((m) => m.hp <= 0) || hp < max * 0.5 || (cl && cl.mp < statsOf(cl).mp * 0.2) || (mg && mg.mp < statsOf(mg).mp * 0.15);
  }

  // ---------------------------------------------------------------- towns

  /** Stand where you can talk to an NPC (across a counter if needed) and face them. */
  talkPos(mapId, letter) {
    const p = npcSpots(MAPS[mapId])[letter];
    const below = MAPS[mapId].tiles[p.y + 1]?.[p.x];
    if (below === '+') return { map: mapId, x: p.x, y: p.y + 2, face: 'up' };
    return { map: mapId, x: p.x, y: p.y, adjacent: true };
  }

  talk(mapId, letter) {
    const pos = this.talkPos(mapId, letter);
    this.travel(pos);
    const st = this.st;
    const p = npcSpots(MAPS[mapId])[letter];
    st.face = pos.face || G.dirTo(st.x, st.y, p.x, p.y);
    const f = G.facing(st);
    const act = G.interact(st, f.x, f.y);
    if (!act || act.t !== 'talk') throw new Error(`Could not talk to ${letter} on ${mapId}`);
    this.stats.lines += act.lines.length;
    return act;
  }

  innTown() {
    const lm = this.st.lastInn.map;
    return MAPS[lm].kind === 'town' ? lm : 'bw';
  }

  rest(town = this.innTown()) {
    const act = this.talk(town, 'a');
    const price = G.innPrice(act.do.split(':')[1]);
    if (!G.rest(this.st, price)) { G.restoreParty(this.st); this.st.lastInn = { map: this.st.map, x: this.st.x, y: this.st.y }; }
  }

  goHomeAndRest() {
    const st = this.st;
    if (st.bag.wing > 0) G.useItemField(st, 'wing', 0);
    this.rest();
  }

  shop(town) {
    const st = this.st;
    const gearShop = `${town === 'bw' ? 'bw' : town}_gear`;
    const itemShop = `${town}_items`;
    // Gear: for each member, the best affordable upgrade per slot.
    if (SHOPS[gearShop]) {
      this.talk(town, 'g');
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < st.party.length; i++) {
          const m = st.party[i];
          for (const slot of ['w', 'a', 'c']) {
            const cur = GEAR[m.eq[slot]];
            const val = (g) => (g ? (g.atk || 0) * (m.cls === 'mage' ? 0.3 : 1) + (g.def || 0) + (g.mag || 0) * (m.cls === 'mage' || m.cls === 'cleric' ? 1.4 : 0.1) + (g.spd || 0) * 0.5 : 0);
            const opts = SHOPS[gearShop].items.filter((id) => GEAR[id].slot === slot && canEquip(m.cls, id) && val(GEAR[id]) > val(cur) + 1 && !(st.gear[id] > 0))
              .sort((a, b) => val(GEAR[b]) - val(GEAR[a]));
            const reserve = slot === 'c' ? 300 : 40;
            const pick = opts.find((id) => GEAR[id].price + reserve <= st.gold);
            if (pick) { G.buy(st, pick); G.equip(st, i, pick); }
          }
        }
      }
      G.autoEquip(st);
      // Sell old gear.
      for (const id of Object.keys(st.gear)) while (st.gear[id] > 0 && GEAR[id].price) G.sell(st, id);
    }
    this.talk(town, 'b');
    const want = { herb: 6, antidote: 2, tonic: 5, ether: 3, wing: 3, lifeleaf: 2 };
    for (const [id, n] of Object.entries(want)) {
      if (!SHOPS[itemShop].items.includes(id)) continue;
      while ((st.bag[id] || 0) < n && st.gold >= ITEMS[id].price + 20) G.buy(st, id);
    }
  }

  // ---------------------------------------------------------------- dungeons

  openChests(mapId) {
    const st = this.st;
    chestsOf(MAPS[mapId]).forEach((c, i) => {
      if (st.opened[`${mapId}:${i}`]) return;
      if (!this.plan({ map: mapId, x: c.x, y: c.y, adjacent: true })) return;
      this.travel({ map: mapId, x: c.x, y: c.y, adjacent: true });
      st.face = G.dirTo(st.x, st.y, c.x, c.y);
      const r = G.openChest(st, i);
      if (r.mimic) {
        if (this.fight([r.mimic]) === 'win') G.markOpened(st, r.id);
        else return;
      }
      this.maintain();
    });
    G.autoEquip(st);
  }

  pullLevers(mapId) {
    leversOf(MAPS[mapId]).forEach((l, i) => {
      if (this.st.flags[MAPS[mapId].levers[i]]) return;
      this.travel({ map: mapId, x: l.x, y: l.y, adjacent: true });
      G.pullLever(this.st, i);
    });
  }

  unlock(mapId, i) {
    const l = locksOf(MAPS[mapId])[i];
    this.travel({ map: mapId, x: l.x, y: l.y, adjacent: true });
    this.st.face = G.dirTo(this.st.x, this.st.y, l.x, l.y);
    const a = G.interact(this.st, l.x, l.y);
    if (a?.t !== 'unlock') throw new Error(`Cannot unlock ${mapId} ${i}`);
    G.unlock(this.st, i);
  }

  solveTorches(mapId) {
    const map = MAPS[mapId];
    const ts = torchesOf(map);
    // Lights-out on a line: try every press pattern.
    for (let mask = 0; mask < 1 << ts.length && !this.st.flags[map.red]; mask++) {
      const sim = ts.map((_, i) => !!this.st.flags[`${map.torches}_t${i}`]);
      for (let i = 0; i < ts.length; i++) if (mask & (1 << i)) for (const j of [i - 1, i, i + 1]) if (j >= 0 && j < ts.length) sim[j] = !sim[j];
      if (!sim.every(Boolean)) continue;
      for (let i = 0; i < ts.length; i++) {
        if (!(mask & (1 << i))) continue;
        this.travel({ map: mapId, x: ts[i].x, y: ts[i].y, adjacent: true });
        G.toggleTorch(this.st, i);
      }
    }
    if (!this.st.flags[map.red]) throw new Error('torches unsolved');
  }

  /** Fight random battles on a map until the party's average level is reached. */
  grind(mapId, level) {
    const st = this.st;
    let n = 0;
    while (G.avgLevel(st) < level && n++ < 4000) {
      if (this.partyWeak()) { this.maintain(); if (this.partyWeak()) { const back = { map: st.map, x: st.x, y: st.y }; this.goHomeAndRest(); this.travel(back); } }
      if (st.map !== mapId) this.travel(this.anySpot(mapId));
      const dirs = Object.keys(DIRS);
      const d = dirs[this.rng.int(0, 3)];
      const before = st.map;
      const r = G.step(st, d, this.rng);
      this.stats.steps++;
      if (st.map !== before) { this.travel(this.anySpot(mapId)); continue; }
      for (const e of r.events) if (e.t === 'battle') { this.fight(e.enemies); this.maintain(); }
    }
  }

  anySpot(mapId) {
    const map = MAPS[mapId];
    for (let y = 1; y < map.tiles.length - 1; y++) {
      for (let x = 1; x < map.tiles[0].length - 1; x++) {
        const d = tileDef(map, map.tiles[y][x]);
        if (map.tiles[y][x] === '.' && d.walk && this.plan({ map: mapId, x, y })) return { map: mapId, x, y };
      }
    }
    throw new Error(`no spot on ${mapId}`);
  }

  boss(mapId, letter, id, level, grindMap = mapId) {
    const st = this.st;
    for (let tries = 0; tries < 8; tries++) {
      if (level) this.grind(grindMap, level + tries);
      this.goHomeAndRest();
      const act = this.talk(mapId, letter);
      if (act.do !== `boss:${id}`) throw new Error(`expected boss ${id}`);
      this.stats.bossTries[id] = (this.stats.bossTries[id] || 0) + 1;
      this.stats.levels[id] = st.party.map((m) => m.lv);
      const res = this.fight([id], id);
      if (res === 'win') { this.maintain(); return true; }
    }
    throw new Error(`boss ${id} not beaten`);
  }

  doTalk(mapId, letter) {
    const act = this.talk(mapId, letter);
    if (act.do) {
      const lines = G.runDo(this.st, act.do);
      if (lines) this.stats.lines += lines.length;
    }
    return act;
  }

  // ---------------------------------------------------------------- the whole game

  run() {
    const st = this.st;
    this.doTalk('bw', 'r');
    this.shop('bw');
    this.grind('world', 3);
    this.rest('bw');
    // Mole Cave
    this.travel({ map: 'mc1', x: 8, y: 14 });
    this.pullLevers('mc1');
    this.openChests('mc1');
    this.grind('mc1', 4);
    this.travel({ map: 'mc2', x: 9, y: 6 });
    this.openChests('mc2');
    this.unlock('mc2', 1);
    this.doTalk('mc2', 'k');
    this.unlock('mc2', 0);
    this.goHomeAndRest();
    this.shop('bw');
    this.boss('mc2', 's', 'stonehide', 6);
    this.openChests('mc2');
    // Ferrow and the Wind Tower
    this.goHomeAndRest();
    this.travel({ map: 'fe', x: 9, y: 1 });
    this.doTalk('fe', 'w');
    this.rest('fe');
    this.shop('fe');
    this.grind('world', 9);
    this.rest('fe');
    this.shop('fe');
    for (const m of ['tw1', 'tw2', 'tw3']) { this.travel(this.anySpot(m)); this.openChests(m); }
    this.boss('tw4', 'g', 'galewing', 12, 'tw3');
    this.openChests('tw4');
    // Emberfall and the Ember Cave
    this.goHomeAndRest();
    this.travel({ map: 'em', x: 9, y: 16 });
    this.rest('em');
    this.shop('em');
    this.grind('world', 15);
    this.rest('em');
    this.shop('em');
    this.travel({ map: 'ec1', x: 10, y: 10 });
    this.openChests('ec1');
    this.solveTorches('ec1');
    this.travel(this.anySpot('ec2'));
    this.openChests('ec2');
    this.boss('ec2', 'p', 'pyrescorp', 17);
    this.openChests('ec2');
    // Frosthollow and Nightspire
    this.goHomeAndRest();
    this.travel({ map: 'fr', x: 9, y: 16 });
    this.doTalk('fr', 's');
    this.rest('fr');
    this.shop('fr');
    this.grind('world', 20);
    this.rest('fr');
    this.shop('fr');
    this.travel({ map: 'cs1', x: 9, y: 12 });
    this.openChests('cs1');
    this.unlock('cs1', 0);
    this.travel(this.anySpot('cs2'));
    this.pullLevers('cs2');
    this.openChests('cs2');
    this.boss('cs2', 'w', 'wyvern', 22);
    this.boss('cs2', 'h', 'hive', 24);
    this.openChests('cs2');
    this.rest('fr');
    this.shop('fr');
    this.boss('cs3', 'v', 'vesper', 24, 'cs2');
    return this.summary();
  }

  summary() {
    const st = this.st;
    // Rough real-time estimate: steps, battle rounds (with fast-forward on) and dialogue.
    const minutes = (this.stats.steps * 0.2 + this.stats.rounds * 5 + this.stats.battles * 5 + this.stats.lines * 2.5) / 60;
    return { done: !!st.flags.vesper, final: st.party.map((m) => m.lv), ...this.stats, minutes: Math.round(minutes), gold: st.gold, chests: G.chestCounts(st) };
  }
}

export function playThrough(opts = {}) {
  const st = G.newGame({ seed: opts.seed ?? 12345, difficulty: opts.difficulty || 'normal' });
  const bot = new Bot(st, opts);
  const sum = bot.run();
  return { st, sum };
}

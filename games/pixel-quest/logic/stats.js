// Levels, stats and gear maths.
import { CLASSES, GEAR, MONSTERS, ARCH, MAX_LEVEL, CLASS_LETTER, SKILLS } from './data.js';

export const STATS = ['hp', 'mp', 'atk', 'def', 'mag', 'spd'];

/** Total XP needed to reach a level. */
export function xpFor(lv) {
  if (lv <= 1) return 0;
  const n = lv - 1;
  return Math.round(8 * n ** 2.4 + 8 * n);
}

export function levelFromXp(xp) {
  let lv = 1;
  while (lv < MAX_LEVEL && xp >= xpFor(lv + 1)) lv++;
  return lv;
}

/** Stats from class and level only. */
export function baseStats(cls, lv) {
  const c = CLASSES[cls];
  const out = {};
  for (const k of STATS) out[k] = Math.floor(c.base[k] + c.grow[k] * (lv - 1));
  return out;
}

/** Stats with gear. */
export function statsOf(m) {
  const s = baseStats(m.cls, m.lv);
  for (const slot of ['w', 'a', 'c']) {
    const g = GEAR[m.eq?.[slot]];
    if (!g) continue;
    for (const k of STATS) if (g[k]) s[k] += g[k];
  }
  s.spd = Math.max(1, s.spd);
  return s;
}

export const maxHp = (m) => statsOf(m).hp;
export const maxMp = (m) => statsOf(m).mp;

export function canEquip(cls, id) {
  const g = GEAR[id];
  return !!g && g.who.includes(CLASS_LETTER[cls]);
}

export function hasCharm(m, flag) { return !!GEAR[m.eq?.c]?.[flag]; }

/** Skills known at a level. */
export function skillsAt(cls, lv) {
  return CLASSES[cls].skills.filter(([, l]) => l <= lv).map(([id]) => id);
}

export function newMember(cls, lv = 1) {
  const c = CLASSES[cls];
  const m = { cls, lv, xp: xpFor(lv), hp: 0, mp: 0, st: null, eq: { w: c.gear.w, a: c.gear.a, c: null } };
  const s = statsOf(m);
  m.hp = s.hp; m.mp = s.mp;
  return m;
}

/** Add XP. Returns a list of { lv, gains, learned } for each level gained. */
export function gainXp(m, xp) {
  const ups = [];
  if (m.lv >= MAX_LEVEL) return ups;
  m.xp += xp;
  while (m.lv < MAX_LEVEL && m.xp >= xpFor(m.lv + 1)) {
    const before = statsOf(m);
    const known = skillsAt(m.cls, m.lv);
    m.lv++;
    const after = statsOf(m);
    const gains = {};
    for (const k of STATS) gains[k] = after[k] - before[k];
    if (m.hp > 0) { m.hp += gains.hp; m.mp += gains.mp; }
    const learned = skillsAt(m.cls, m.lv).filter((s) => !known.includes(s));
    ups.push({ lv: m.lv, gains, learned: learned.map((s) => SKILLS[s].name) });
  }
  if (m.lv >= MAX_LEVEL) m.xp = Math.min(m.xp, xpFor(MAX_LEVEL));
  return ups;
}

/** Monster stats from its level and archetype. diff: difficulty scale for HP and attack. */
export function monsterStats(id, diff = 1) {
  const d = MONSTERS[id];
  if (d.fixed) return { ...d.fixed, mp: 99 };
  const a = ARCH[d.arch];
  const L = d.lv;
  const hp = (10 + L * 7.5 + L * L * 0.55) * a.hp * (d.hp || 1);
  const atk = (7 + L * 3.0) * a.atk;
  const def = (3 + L * 2.2) * a.def;
  const mag = (5 + L * 2.6) * a.mag;
  const spd = (3 + L * 1.5) * a.spd;
  const boss = d.boss ? 1 : 0;
  return {
    hp: Math.max(1, Math.round(hp * (boss ? (diff < 1 ? 0.72 : 1) : diff))),
    mp: 999,
    atk: Math.round(atk * (diff < 1 ? 0.85 : 1)),
    def: Math.round(def),
    mag: Math.round(mag * (diff < 1 ? 0.85 : 1)),
    spd: Math.round(spd),
  };
}

export function monsterXp(id) {
  const d = MONSTERS[id];
  if (d.xp && d.fixed) return d.xp;
  const L = d.lv;
  return Math.round((2 + L * 1.2 + L * L * 0.26) * (d.xp ?? 1));
}

export function monsterGold(id) {
  const d = MONSTERS[id];
  if (d.fixed) return d.gold;
  const L = d.lv;
  return Math.round((2 + L * 2.6 + L * L * 0.1) * (d.gold ?? 1));
}

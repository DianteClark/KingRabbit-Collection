// The type wheel. Every type beats the next one round the wheel (x2) and is weak against the one
// before it (x0.5). Plain sits outside the wheel: it never hits hard and is never hit hard.
//
//   Flame -> Leaf -> Stone -> Spark -> Tide -> (back to Flame)
//   Flame burns Leaf, Leaf roots crack Stone, Stone grounds Spark, Spark shocks Tide, Tide douses Flame.

export const WHEEL = ['flame', 'leaf', 'stone', 'spark', 'tide'];
export const TYPES = [...WHEEL, 'plain'];

export const TYPE_INFO = {
  flame: { name: 'Flame', color: '#e0703a', light: '#f6b26b', dark: '#7a2a1c', why: 'burns Leaf' },
  leaf: { name: 'Leaf', color: '#4f9a3c', light: '#a9d977', dark: '#1f4a25', why: 'cracks Stone' },
  stone: { name: 'Stone', color: '#8a8478', light: '#cfc6b2', dark: '#3e3a34', why: 'grounds Spark' },
  spark: { name: 'Spark', color: '#d9b625', light: '#f5e27a', dark: '#6b5210', why: 'shocks Tide' },
  tide: { name: 'Tide', color: '#3f74c9', light: '#8fc0f0', dark: '#1c2f6b', why: 'douses Flame' },
  plain: { name: 'Plain', color: '#b0789a', light: '#f2c4d6', dark: '#5a2a44', why: 'no strengths or weaknesses' },
};

/** The type this one beats (or null for Plain). */
export function beats(type) {
  const i = WHEEL.indexOf(type);
  return i < 0 ? null : WHEEL[(i + 1) % WHEEL.length];
}

/** The type that beats this one (or null for Plain). */
export function beatenBy(type) {
  const i = WHEEL.indexOf(type);
  return i < 0 ? null : WHEEL[(i + WHEEL.length - 1) % WHEEL.length];
}

/** Damage multiplier for a move of type `atk` hitting a pet of type `def`. */
export function typeMult(atk, def) {
  if (beats(atk) === def) return 2;
  if (beats(def) === atk) return 0.5;
  return 1;
}

export const typeName = (t) => TYPE_INFO[t]?.name ?? t;

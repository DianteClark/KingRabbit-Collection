// Prints every art reference the game uses, for tools/pack.py.
//   node games/gem-quest/tools/refs.mjs > /tmp/gq-refs.json && python3 games/gem-quest/tools/pack.py /tmp/gq-refs.json
import { SKILLS } from '../logic/skills.js';
import { HEROES, GEAR } from '../logic/heroes.js';
import { ENEMIES } from '../logic/world.js';
import { MAP_ART } from '../art.js';

const units = new Set([...Object.values(HEROES).map((h) => h.sprite), ...Object.values(ENEMIES).map((e) => e.sprite)]);
const icons = new Set([...Object.values(SKILLS).map((s) => s.icon), ...Object.values(GEAR).map((g) => g.icon)]);
for (const v of Object.values(MAP_ART)) (Array.isArray(v) ? v : [v]).forEach((r) => icons.add(r));
console.log(JSON.stringify({ units: [...units].sort(), icons: [...icons].sort() }));

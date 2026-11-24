// First-minutes guide: a short list of steps, each finished by something the player does.
// Pure logic: the scene shows the text and highlights the tool button named in `tray`.
import { PLACE } from './defs.js';
import { rt } from './sim.js';

const count = (s, fn) => { let n = 0; for (let i = 0; i < s.zone.length; i++) if (fn(i)) n++; return n; };

export const STEPS = [
  {
    id: 'road', tray: 'road', tool: 'road',
    text: 'Welcome, Mayor! Tap Roads, pick Road, then drag on the grass to build a road off the highway.',
    done: (s) => count(s, (i) => s.road[i]) >= (s.tutRoads0 || 15) + 6,
  },
  {
    id: 'zoneR', tray: 'zone', tool: 'zone:R',
    text: 'Tap Zones, pick Residential (green) and drag a rectangle beside your road. Homes grow there.',
    done: (s) => count(s, (i) => s.zone[i] === 'R' && rt(s).roadDist[i] <= 3) >= 6,
  },
  {
    id: 'power', tray: 'util', tool: 'wind',
    text: 'Homes need power. Tap Utilities and put a Wind Turbine right next to your road or zones.',
    done: (s) => s.blds.some((b) => PLACE[b.k]?.power),
  },
  {
    id: 'jobs', tray: 'zone', tool: 'zone:C',
    text: 'People need jobs. Zone some Commercial (blue) and Industrial (yellow) land by a road.',
    done: (s) => count(s, (i) => s.zone[i] === 'C') >= 3 && count(s, (i) => s.zone[i] === 'I') >= 3,
  },
  {
    id: 'water', tray: 'util', tool: 'wtower',
    text: 'Add a Water Tower near your zones so houses can grow bigger later.',
    done: (s) => s.blds.some((b) => PLACE[b.k]?.svc === 'water'),
  },
  {
    id: 'grow', tray: null, tool: null,
    text: 'Now tap 3x at the top to speed up time and watch your town grow. Reach 60 people!',
    done: (s) => s.pop >= 60,
  },
];

export const tutStep = (s) => (s.tut != null && s.tut < STEPS.length ? STEPS[s.tut] : null);

/** Move on past every step already done. Returns true when the step changed. */
export function tutCheck(s) {
  let moved = false;
  while (s.tut != null && s.tut < STEPS.length && STEPS[s.tut].done(s)) { s.tut++; moved = true; }
  if (s.tut >= STEPS.length) s.tut = null;
  return moved;
}

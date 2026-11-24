// First-minutes guide: a short list of steps, each finished by something the player does.
// Pure logic: the scene shows the text and highlights the tool button named in `tray`.
import { PLACE } from './defs.js';
import { rt } from './sim.js';

const count = (s, fn) => { let n = 0; for (let i = 0; i < s.zone.length; i++) if (fn(i)) n++; return n; };

export const STEPS = [
  {
    id: 'road', tray: 'road', tool: 'road',
    text: 'Welcome, Mayor! Tap Road, pick the road, then drag on the grass to build a road off the highway.',
    done: (s) => count(s, (i) => s.road[i]) >= (s.tutRoads0 || 15) + 6,
  },
  {
    id: 'zoneR', tray: 'zone', tool: 'zone:R',
    text: 'Tap Zone, pick Residential (green R) and drag a rectangle beside your road. Homes grow there.',
    done: (s) => count(s, (i) => s.zone[i] === 'R' && rt(s).roadDist[i] <= 3) >= 6,
  },
  {
    id: 'power', tray: 'util', tool: 'wind',
    text: (s) => (s.blds.some((b) => PLACE[b.k]?.power)
      ? 'That plant is not linked up. Undo and place it touching your road or zones, or draw a Power Line to it.'
      : 'Homes need power. Tap Power, pick the Wind Turbine and tap the map right next to your road or zones.'),
    done: (s) => s.blds.some((b) => PLACE[b.k]?.power) && s.zone.some((z, i) => z && rt(s).lotPower[i]),
  },
  {
    id: 'jobs', tray: 'zone',
    tool: (s) => (count(s, (i) => s.zone[i] === 'C') >= 3 ? 'zone:I' : 'zone:C'),
    text: (s) => (count(s, (i) => s.zone[i] === 'C') >= 3
      ? 'Shops done! Now pick Industrial (yellow I) and zone some land by a road, a little away from homes.'
      : 'People need jobs. Zone some Commercial (blue C) land by a road, then some Industrial (yellow I).'),
    done: (s) => count(s, (i) => s.zone[i] === 'C') >= 3 && count(s, (i) => s.zone[i] === 'I') >= 3,
  },
  {
    id: 'water', tray: 'util', tool: 'wtower',
    text: (s) => (s.blds.some((b) => PLACE[b.k]?.svc === 'water')
      ? 'Water towers need power too. Undo and place it touching your road or zones.'
      : 'Tap Power again and add a Water Tower by your zones, so houses can grow bigger later.'),
    done: (s) => s.zone.some((z, i) => z && rt(s).water[i] > 0),
  },
  {
    id: 'grow', tray: null, tool: null,
    text: 'Now tap 3x at the top to speed up time and watch your town grow. Reach 60 people!',
    done: (s) => s.pop >= 60,
  },
];

export const tutStep = (s) => (s.tut != null && s.tut < STEPS.length ? STEPS[s.tut] : null);
export const tutText = (s, step) => (typeof step.text === 'function' ? step.text(s) : step.text);
export const tutTool = (s, step) => (typeof step.tool === 'function' ? step.tool(s) : step.tool);

/** Move on past every step already done. Returns true when the step changed. */
export function tutCheck(s) {
  let moved = false;
  while (s.tut != null && s.tut < STEPS.length && STEPS[s.tut].done(s)) { s.tut++; moved = true; }
  if (s.tut >= STEPS.length) s.tut = null;
  return moved;
}

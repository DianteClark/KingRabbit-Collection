// The mayor's advisors: short tips worked out from the state of the city. Pure logic.
import { PLACE, ZONE_INFO } from './defs.js';
import { rt, budget } from './sim.js';

export const ADVISORS = {
  Planner: { name: 'Pat, Planner', color: '#6ec05a', icon: 23 },
  Treasurer: { name: 'Penny, Treasurer', color: '#e3d245', icon: 28 },
  Safety: { name: 'Chief Ruiz, Safety', color: '#d88038', icon: 16 },
  Health: { name: 'Dr. Lind, Health & Schools', color: '#8a8fc4', icon: 17 },
  Transit: { name: 'Gus, Transport', color: '#5aa0e6', icon: 29 },
};

/** Every tip that applies right now, most urgent first: { id, who, text, tone, prio }. */
export function tips(s) {
  const r = rt(s);
  const out = [];
  const add = (id, who, prio, text, tone = '') => out.push({ id, who, prio, text, tone });
  const grow = s.blds.filter((b) => b.k === 'grow');
  const plants = s.blds.filter((b) => PLACE[b.k]?.power);
  const has = (svc) => s.blds.some((b) => PLACE[b.k]?.svc === svc);
  const zoned = { R: 0, C: 0, I: 0, F: 0 }; const emptyZ = { R: 0, C: 0, I: 0, F: 0 };
  for (let i = 0; i < s.zone.length; i++) if (s.zone[i]) { zoned[s.zone[i]]++; if (!r.tileB[i]) emptyZ[s.zone[i]]++; }
  const roadCount = s.road.reduce((a, v) => a + v, 0);

  if (roadCount < 20) add('road', 'Planner', 90, 'Build some roads off the highway. Zones only grow within 3 tiles of a road.');
  if (zoned.R === 0) add('zoneR', 'Planner', 85, 'Zone some Residential land next to a road so people can move in.');
  if (!plants.length && zoned.R + zoned.C + zoned.I > 0) add('power', 'Planner', 95, 'Nothing grows without power. Build a Wind Turbine or Coal Plant touching a road or zone.', 'bad');
  if (r.need > r.supply && plants.length) add('morepower', 'Planner', 92, `We need more power: using ${Math.round(r.need)} but making ${Math.round(r.supply)}. Build another plant.`, 'bad');
  const unpowered = grow.filter((b) => !b.pw && b.z !== 'F').length;
  if (unpowered > 3 && r.need <= r.supply) add('link', 'Planner', 88, `${unpowered} buildings have no power. Link them to a plant with roads or power lines.`, 'bad');
  const dry = grow.filter((b) => b.tier >= 1 && b.z !== 'F' && !(r.water[b.y * 48 + b.x] > 0)).length;
  if (s.pop > 60 && dry > grow.length * 0.4) add('water', 'Planner', 80, 'Homes and shops need water to grow bigger. Place Water Towers near them.');
  for (const z of ['R', 'C', 'I']) {
    if (s.demand[z] > 0.4 && emptyZ[z] < 3 && s.pop > 0) add(`more${z}`, 'Planner', 70, `People want more ${ZONE_INFO[z].short.toLowerCase()}. Zone more ${ZONE_INFO[z].name} land (see the RCI meter).`);
  }
  if (s.demand.R < -0.3 && s.pop > 50) add('jobs', 'Planner', 72, 'Not enough jobs for everyone. Zone Commercial and Industrial land.');
  const b = budget(s);
  if (s.money < 0) add('debt', 'Treasurer', 99, 'We are in debt! Raise taxes a little, cut some funding, or take a loan.', 'bad');
  else if (b.net < 0 && s.money < 3000) add('deficit', 'Treasurer', 86, `We lose $${Math.round(-b.net)} a month. Raise taxes or trim service funding before the money runs out.`, 'bad');
  if (s.loans.length && s.money > 15000) add('repay', 'Treasurer', 40, 'We have plenty of cash. Pay off a loan in the Budget to save on interest.');
  if (s.money > 30000 && s.tax.R > 7) add('rich', 'Treasurer', 30, 'The treasury is full. Lower taxes a bit and the town will grow faster.', 'good');
  if (s.pop > 150 && !has('police')) add('police', 'Safety', 75, 'Crime is creeping in. A Police Station will keep things calm.');
  if (s.pop > 150 && !has('fire')) add('fire', 'Safety', 76, 'One spark and we have nothing to fight it with. Build a Firehouse.');
  if (s.fires.length) add('fires', 'Safety', 97, s.blds.some((x) => PLACE[x.k]?.svc === 'fire') ? 'Buildings are burning! Fire crews in range will put them out.' : 'Buildings are burning and no firehouse is in range!', 'bad');
  if (s.ms >= 1 && !has('health')) add('clinic', 'Health', 65, 'People are asking for a doctor. Build a Clinic.');
  if (s.ms >= 1 && !has('edu')) add('school', 'Health', 64, 'Families want a School. It also raises land value.');
  let polR = 0; let n = 0;
  for (const g of grow) if (g.z === 'R') { polR += r.pol[g.y * 48 + g.x]; n++; }
  if (n && polR / n > 30) add('smog', 'Health', 78, 'Homes are breathing factory smoke. Keep industry away from houses, or add parks.', 'bad');
  if (s.ms >= 1 && !has('park')) add('park', 'Planner', 50, 'Parks raise land value so houses can grow bigger.');
  let jam = 0; let roads = 0;
  for (let i = 0; i < s.road.length; i++) if (s.road[i]) { roads++; if (r.traffic[i] > 0.8) jam++; }
  if (roads && jam > roads * 0.08) add('traffic', 'Transit', 74, 'Traffic is backing up. Add more roads between homes and jobs, or Bus Stops.', 'bad');
  if (s.ms >= 1 && !s.blds.some((x) => x.k === 'mansion')) add('mansion', 'Planner', 45, 'You are a Village now: build the Mayor\'s Mansion for a happiness boost!', 'good');
  if (s.happy < 40 && s.pop > 100) add('unhappy', 'Health', 82, 'People are unhappy. Check taxes, services, pollution and jobs.', 'bad');
  if (!out.length) add('fine', 'Planner', 1, 'Everything looks good, Mayor. Keep growing!', 'good');
  return out.sort((a, b2) => b2.prio - a.prio);
}

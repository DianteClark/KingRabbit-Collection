// Big events that need the chief's call. Each has setup() -> what the dialog shows,
// and resolve() -> what happened. `units`/`power` are the squad cars actually committed.

const cl = (v) => Math.max(0, Math.min(100, v));
const pct = (p) => `${Math.round(Math.max(0.05, Math.min(0.95, p)) * 100)}%`;
const odds = (power, need) => 1 / (1 + Math.exp(-(power - need) * 1.4 - 0.4));

function lotIn(s, rng, h, district) {
  const lots = h.city.lots.filter((l) => l.kind === 'building' && (!district || l.district === district));
  return h.pick(rng, lots);
}

export const MAJORS = {
  bank: {
    setup(s, rng, ctx, h) {
      const bank = h.city.landmark('bank');
      const n = 3 + Math.floor(rng() * 3);
      return {
        title: 'Bank robbery', district: bank.district, door: bank.door, lot: bank.id, n,
        text: `${n} masked robbers are inside First City Bank with the tellers and a dozen customers. A getaway van is waiting out front. How do you want to play it?`,
        choices: [
          { label: 'Surround and negotiate', detail: 'Uses 4 cars, slow but safe', units: 4, busy: 180, style: 'talk' },
          { label: 'Storm the bank', detail: 'Uses 4 cars, quick but risky', units: 4, busy: 90, style: 'storm' },
          { label: 'Let them run, then chase', detail: 'Uses 3 cars, a high-speed chase', units: 3, busy: 60, style: 'chase' },
        ],
      };
    },
    resolve(s, rng, pm, opt, h) {
      const need = pm.n * 0.9;
      if (opt.style === 'talk') {
        const p = odds(h.power + s.trust / 40, need);
        if (h.chance(rng, p)) {
          s.trust = cl(s.trust + 7); s.safety = cl(s.safety + 5);
          h.notable(13, 'Bank standoff ends peacefully', `After hours of talks, ${pm.n} robbers walked out of First City Bank with their hands up. Nobody was hurt.`);
          return { ok: true, text: `After four tense hours the robbers give up. Every hostage walks out unharmed. The city breathes again.` };
        }
        s.trust = cl(s.trust - 6); s.safety = cl(s.safety - 5); s.money -= 0;
        h.notable(12, 'Robbers slip away during bank standoff', 'Talks dragged on while the crew escaped through a back alley with the cash.');
        return { ok: false, text: 'While you talked, the crew broke out the back with the cash. Embarrassing.' };
      }
      if (opt.style === 'storm') {
        const p = odds(h.power + s.gearLevel * 0.6, need + 0.8);
        if (h.chance(rng, p)) {
          s.trust = cl(s.trust + 5); s.safety = cl(s.safety + 6);
          h.notable(13, 'Police storm bank, arrest robbery crew', 'A fast entry ended the robbery in minutes.');
          return { ok: true, text: 'Your officers go in fast and hard. In under three minutes, the whole crew is face-down on the marble floor.' };
        }
        s.trust = cl(s.trust - 10); s.safety = cl(s.safety - 8);
        h.notable(14, 'Shootout at First City Bank', 'Customers were hurt when police stormed the bank. The council wants answers.');
        return { ok: false, text: 'Shots ring out inside. Customers are hurt and two robbers escape in the chaos. Expect hard questions.', hurt: true };
      }
      const p = Math.min(0.9, 0.35 + 0.15 * h.units.length + 0.12 * s.carLevel);
      const caught = h.chance(rng, p);
      if (caught) { s.trust = cl(s.trust + 4); s.safety = cl(s.safety + 4); h.notable(12, 'Bank robbers caught after high-speed chase', 'The getaway van was boxed in after a chase across town.'); }
      else { s.trust = cl(s.trust - 7); s.safety = cl(s.safety - 5); h.notable(12, 'Bank robbers escape after chase', 'The getaway van lost police in traffic.'); }
      return { ok: caught, text: 'The van screeches away and your cars pile in after it. Watch the chase!', chase: { name: 'Bank getaway', text: 'Bank robbers fleeing in a van.', caught } };
    },
  },

  hostage: {
    setup(s, rng, ctx, h) {
      const lot = lotIn(s, rng, h);
      const st = h.streetAt(lot.door);
      return {
        title: 'Hostage situation', district: lot.district, door: lot.door, lot: lot.id,
        text: `An armed man has barricaded himself in an apartment on ${st} (${h.districtName(lot.district)}) with his family. He says he'll talk only to the chief.`,
        choices: [
          { label: 'Negotiate', detail: 'Uses 2 cars, depends on public trust', units: 2, busy: 240, style: 'talk' },
          { label: 'Tactical breach', detail: 'Uses 4 cars, better with vests and training', units: 4, busy: 90, style: 'breach' },
          { label: 'Wait for a clear shot', detail: 'Uses 3 cars, ends it quickly but costs trust', units: 3, busy: 120, style: 'snipe' },
        ],
      };
    },
    resolve(s, rng, pm, opt, h) {
      let p;
      if (opt.style === 'talk') p = 0.45 + s.trust / 300 + s.trainLevel * 0.06;
      else if (opt.style === 'breach') p = 0.35 + 0.1 * s.gearLevel + 0.08 * s.trainLevel + 0.04 * h.units.length;
      else p = 0.6 + 0.08 * s.trainLevel;
      if (h.chance(rng, p)) {
        const t = opt.style === 'snipe' ? -2 : 6;
        s.trust = cl(s.trust + t); s.safety = cl(s.safety + 4);
        h.notable(13, 'Hostages freed unharmed', opt.style === 'talk' ? 'The chief talked the gunman down after a long night.' : 'Police ended the standoff and the family walked free.');
        const how = { talk: 'After hours on the phone, he puts the gun down and walks out. The family is safe.', breach: 'The team breaches on your signal and has him in cuffs before he can react. Everyone is safe.', snipe: 'A single shot ends it. The family is safe, but some ask whether it had to end this way.' }[opt.style];
        return { ok: true, text: how };
      }
      s.trust = cl(s.trust - 12); s.safety = cl(s.safety - 8);
      h.notable(15, 'Hostage standoff ends in tragedy', 'A family member was badly hurt before police ended the standoff.');
      return { ok: false, text: 'It goes wrong. A hostage is badly hurt before your officers can end it. The city is shaken.', hurt: true };
    },
  },

  gangwar: {
    setup(s, rng, ctx, h) {
      const [a, b] = [...s.groups].sort(() => rng() - 0.5);
      if (!a || !b) return null;
      const lot = lotIn(s, rng, h, a.district);
      return {
        title: 'Gang war', district: a.district, door: lot.door, lot: lot.id, groups: [a.id, b.id],
        text: `${a.name} and ${b.name} are shooting it out on ${h.streetAt(lot.door)}. Shop owners are pulling down their shutters.`,
        choices: [
          { label: 'Flood the streets', detail: 'Uses 5 cars for 3 hours', units: 5, busy: 180, style: 'flood' },
          { label: 'Targeted arrests', detail: 'Uses 3 cars, stronger with open cases', units: 3, busy: 120, style: 'target' },
          { label: 'Let them burn out', detail: 'No cars: both gangs weaken, the public suffers', units: 0, busy: 0, style: 'wait' },
        ],
      };
    },
    resolve(s, rng, pm, opt, h) {
      const gs = pm.groups.map((id) => s.groups.find((g) => g.id === id)).filter(Boolean);
      if (opt.style === 'wait') {
        gs.forEach((g) => { g.strength = Math.max(5, g.strength * 0.65); });
        s.safety = cl(s.safety - 9); s.trust = cl(s.trust - 7);
        h.notable(13, 'Police stand by as gangs fight it out', 'Bystanders were hurt while officers waited at the edge of the fighting.');
        return { ok: true, text: 'The gangs tear into each other for hours. Both are weaker now, but bystanders were hurt and people saw police waiting.' };
      }
      const caseBoost = opt.style === 'target' ? gs.reduce((a, g) => a + g.case / 60, 0) : 0;
      const need = gs.reduce((a, g) => a + g.strength / 22, 0);
      if (h.chance(rng, odds(h.power + caseBoost, need))) {
        gs.forEach((g) => { g.strength = Math.max(5, g.strength * (opt.style === 'target' ? 0.5 : 0.7)); });
        s.safety = cl(s.safety + 5); s.trust = cl(s.trust + 5);
        h.notable(13, 'Police break up gang war', `Dozens of arrests as ${gs.map((g) => g.name).join(' and ')} are pushed off the streets.`);
        return { ok: true, text: 'Your officers move in block by block. Dozens of arrests; both gangs are badly hurt.' };
      }
      s.safety = cl(s.safety - 6); s.trust = cl(s.trust - 5);
      gs.forEach((g) => { g.strength = Math.min(100, g.strength + 5); });
      h.notable(13, 'Gang war rages despite police', 'Officers were outnumbered and outgunned.');
      return { ok: false, text: 'Your officers are outnumbered. The fighting only stops when the gangs choose to stop.', hurt: true };
    },
  },

  riot: {
    setup(s, rng, ctx, h) {
      const lot = lotIn(s, rng, h, 'downtown');
      return {
        title: 'Riot downtown', district: 'downtown', door: lot.door, lot: lot.id,
        text: 'Anger over crime has boiled over. A crowd of hundreds is smashing windows on Main St and marching toward City Hall.',
        choices: [
          { label: 'Hold back and talk', detail: 'Uses 2 cars, calm things down slowly', units: 2, busy: 180, style: 'talk' },
          { label: 'Disperse the crowd', detail: 'Uses 5 cars, fast but harsh', units: 5, busy: 120, style: 'force' },
          { label: 'Ask the mayor to speak', detail: 'No cars, needs his trust (50+)', units: 0, busy: 0, style: 'mayor' },
        ],
      };
    },
    resolve(s, rng, pm, opt, h) {
      if (opt.style === 'mayor') {
        if (s.trust >= 50 && h.chance(rng, 0.75)) { s.safety = cl(s.safety + 10); s.trust = cl(s.trust - 2); h.notable(12, 'Mayor calms the crowd', 'Hollis promised more police on the streets.'); return { ok: true, text: 'The mayor speaks from the steps of City Hall. The crowd slowly goes home.' }; }
        s.trust = cl(s.trust - 8); s.safety = cl(s.safety - 6);
        h.notable(12, 'Mayor booed off stage', 'The mayor blames the police chief.');
        return { ok: false, text: 'The crowd boos him off the steps. He is not happy with you.' };
      }
      if (opt.style === 'force') {
        if (h.chance(rng, odds(h.power + s.gearLevel * 0.5, 4))) { s.safety = cl(s.safety + 8); s.trust = cl(s.trust - 4); h.notable(12, 'Police clear the streets', 'Critics call the response heavy-handed.'); return { ok: true, text: 'Your lines push the crowd back street by street. It is over by midnight, but the images look rough.' }; }
        s.safety = cl(s.safety - 8); s.trust = cl(s.trust - 9);
        h.notable(14, 'Riot spreads after police charge', 'Shops burned across downtown.');
        return { ok: false, text: 'The charge makes things worse. Fires spread across downtown.', hurt: true };
      }
      if (h.chance(rng, 0.5 + s.trust / 200)) { s.safety = cl(s.safety + 6); s.trust = cl(s.trust + 4); h.notable(12, 'Chief walks with protesters', 'A long night of talking ended without serious injuries.'); return { ok: true, text: 'You walk out to meet the crowd. It takes all night, but nobody else gets hurt.' }; }
      s.safety = cl(s.safety - 6); s.trust = cl(s.trust - 4);
      h.notable(12, 'Night of looting downtown', 'Police were stretched thin.');
      return { ok: false, text: 'Talk doesn\'t reach everyone. Shops are looted through the night.' };
    },
  },

  raid: {
    setup(s, rng, ctx, h) {
      const g = s.groups.find((x) => x.id === ctx.group);
      if (!g) return null;
      const lot = lotIn(s, rng, h, g.district);
      return {
        title: `Raid on ${g.name}`, district: g.district, door: lot.door, lot: lot.id, group: g.id,
        text: `Your detectives have the evidence. ${g.name} use a building on ${h.streetAt(lot.door)} as their base. Strength: ${Math.round(g.strength)}. How big a raid?`,
        choices: [
          { label: 'Dawn raid', detail: 'Uses 4 cars', units: 4, busy: 150, style: 'raid' },
          { label: 'Everything we have', detail: 'Uses 7 cars, safer, the city is bare for a while', units: 7, busy: 150, style: 'all' },
          { label: 'Not yet', detail: 'Keep watching them', units: 0, busy: 0, style: 'wait' },
        ],
      };
    },
    resolve(s, rng, pm, opt, h) {
      const g = s.groups.find((x) => x.id === pm.group);
      if (!g || opt.style === 'wait') return { ok: true, text: 'The raid can wait. The case stays open.', keep: true };
      const need = g.strength / 20 + 1;
      if (h.chance(rng, odds(h.power + s.gearLevel * 0.4, need))) {
        s.groups = s.groups.filter((x) => x.id !== g.id);
        s.officers.forEach((o) => { if (o.caseId === g.id) o.caseId = null; });
        s.districts[g.district].crime = Math.max(0, s.districts[g.district].crime - 15);
        s.trust = cl(s.trust + 8); s.safety = cl(s.safety + 8); s.stats.groupsBusted++;
        h.notable(15, `${g.name} taken down in police raid`, 'Leaders arrested, weapons and cash seized.');
        return { ok: true, text: `Doors go in at once across ${h.districtName(g.district)}. The leaders of ${g.name} are in custody. They're finished.` };
      }
      g.case = 45; g.raidReady = false;
      s.trust = cl(s.trust - 6);
      h.notable(13, `Raid on ${g.name} comes up empty`, 'Someone tipped them off.');
      return { ok: false, text: 'Someone tipped them off. The building is half empty and the bosses are gone. The case has to be rebuilt.', hurt: h.chance(rng, 0.4) };
    },
  },

  officerDown: {
    setup(s, rng, ctx, h) {
      const o = s.officers.find((x) => x.id === ctx.officer);
      if (!o) return null;
      return {
        title: 'Officer down', district: ctx.district, door: ctx.door, officer: o.id,
        text: `${o.name} was killed in the line of duty after ${Math.max(1, Math.floor(o.years))} years on the force. The department is grieving and the city is watching how you respond.`,
        choices: [
          { label: 'Full honours funeral', detail: '$800, morale and trust up', units: 0, busy: 0, style: 'honor' },
          { label: 'Manhunt for the killer', detail: 'Uses 3 cars for 2 hours', units: 3, busy: 120, style: 'hunt' },
          { label: 'Small private service', detail: 'Costs nothing; morale suffers', units: 0, busy: 0, style: 'quiet' },
        ],
      };
    },
    resolve(s, rng, pm, opt, h) {
      const o = s.officers.find((x) => x.id === pm.officer);
      const all = s.officers.filter((x) => x.status === 'active');
      if (opt.style === 'honor') {
        all.forEach((x) => { x.morale = Math.min(100, x.morale + 10); });
        s.trust = cl(s.trust + 3);
        h.notable(11, `City says goodbye to ${o.name}`, 'Officers from three counties lined the streets for the funeral.');
        return { ok: true, text: 'Hundreds line the streets. Your officers stand a little taller.', cost: 800 };
      }
      if (opt.style === 'hunt') {
        if (h.chance(rng, 0.4 + 0.12 * h.units.length)) {
          all.forEach((x) => { x.morale = Math.min(100, x.morale + 8); });
          s.trust = cl(s.trust + 5); s.safety = cl(s.safety + 3);
          h.notable(12, `Killer of Officer ${o.name} arrested`, 'A two-hour manhunt ended with an arrest.');
          return { ok: true, text: 'Your officers find the shooter hiding in a garage. He goes quietly.' };
        }
        all.forEach((x) => { x.morale = Math.max(0, x.morale - 4); });
        return { ok: false, text: 'The trail goes cold. The killer is still out there.' };
      }
      all.forEach((x) => { x.morale = Math.max(0, x.morale - 6); });
      return { ok: true, text: 'A small service for family and close colleagues. Some officers feel the department let them down.' };
    },
  },
};

export const describeOdds = pct;

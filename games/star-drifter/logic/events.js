// Text events at "?" beacons. Each choice has an optional requirement (crew species, a system
// level, resources) and an optional cost, then one outcome or a weighted list of outcomes.
//
// Outcome fields: text, scrap, fuel, missiles, droneParts, hull, crewHurt (damage to one crew),
// crewLose, crewGain ('random' or a species), weapon ('random' or id), drone ('random' or id),
// upgrade ('random' = one free system level), reactor (+N), fight ({ kind?, bonus? }), store.
// Scrap amounts grow with the sector.

export const EVENTS = {
  derelict: {
    title: 'Derelict Freighter',
    text: 'A cargo hauler drifts with its lights out. Scans show no life signs, but the hull is scarred by weapons fire.',
    choices: [
      { text: 'Send a team to search the holds.', outcomes: [[5, { text: 'The holds are full of salvage. Your team hauls back what it can carry.', scrap: 18, fuel: 2 }], [3, { text: 'Something was living in the vents. Your team escapes, bruised.', crewHurt: 35, scrap: 8 }], [2, { text: 'It was bait! Raiders drop out of the dark.', fight: { bonus: { scrap: 10 } } }]] },
      { text: '(Zephi) Pick the sealed vault lock.', req: { species: 'zephi' }, outcome: { text: 'Quick fingers open the vault in seconds. Inside: weapon parts.', scrap: 15, weapon: 'random' } },
      { text: 'Leave it alone.', outcome: { text: 'You leave the dead ship to the stars.' } },
    ],
  },
  distress: {
    title: 'Distress Call',
    text: 'A weak signal repeats: "Life support failing... anyone..." It comes from a small shuttle tumbling near an asteroid.',
    choices: [
      { text: 'Pull the shuttle into your bay.', outcomes: [[5, { text: 'A grateful survivor asks to join your crew.', crewGain: 'random' }], [3, { text: 'The pilot thanks you with all the fuel they have left.', fuel: 3, scrap: 5 }], [2, { text: 'The "survivors" draw weapons. You fight them off, but someone is hurt.', crewHurt: 40, scrap: 12 }]] },
      { text: '(Medbay level 2) Treat the injured on board.', req: { sys: 'medbay', lvl: 2 }, outcome: { text: 'Your medbay saves everyone. One of them is a skilled engineer who stays.', crewGain: 'random', scrap: 10 } },
      { text: 'Ignore it.', outcome: { text: 'The signal fades behind you.' } },
    ],
  },
  merchant: {
    title: 'Wandering Trader',
    text: 'A battered trade barge hails you. "Fuel, rockets, a bit of everything! Cash only."',
    choices: [
      { text: 'Buy 3 fuel for 12 scrap.', cost: { scrap: 12 }, outcome: { text: 'The trader pumps fuel into your tanks.', fuel: 3 } },
      { text: 'Buy 3 missiles for 15 scrap.', cost: { scrap: 15 }, outcome: { text: 'Three fresh missiles are loaded.', missiles: 3 } },
      { text: 'Sell 2 fuel for 10 scrap.', req: { fuel: 3 }, cost: { fuel: 2 }, outcome: { text: 'The trader pays up.', scrap: 10, noScale: true } },
      { text: 'Wave them off.', outcome: { text: 'The barge drifts away, horns blaring.' } },
    ],
  },
  asteroid: {
    title: 'Mineral Field',
    text: 'Your sensors light up: the asteroids here are rich in metal. Mining is slow and the rocks keep moving.',
    choices: [
      { text: 'Mine with the ship\'s guns.', outcomes: [[6, { text: 'You blast loose a good haul of ore, and some frozen fuel.', scrap: 20, fuel: 1 }], [4, { text: 'A rock clips the hull while you work.', scrap: 12, hull: -3 }]] },
      { text: '(Rokkan) Send a Rokkan out to dig by hand.', req: { species: 'rokkan' }, outcome: { text: 'The Rokkan hardly notices the cold of space and digs out the best veins.', scrap: 30 } },
      { text: 'Move on.', outcome: { text: 'You leave the rocks to drift.' } },
    ],
  },
  pirates: {
    title: 'Reaver Toll',
    text: 'A Reaver ship blocks your path. "This lane is ours. Pay the toll or we take it from your wreck."',
    choices: [
      { text: 'Pay 20 scrap.', cost: { scrap: 20 }, outcome: { text: 'They take the scrap and let you pass, laughing.' } },
      { text: 'Fight!', outcome: { text: 'You power up your weapons.', fight: { kind: 'raider', bonus: { scrap: 8 } } } },
      { text: '(Shields level 4) Show them your shields and stare them down.', req: { sys: 'shields', lvl: 4 }, outcome: { text: 'They look at your double shields and decide you are not worth it. They even toss you a bribe.', scrap: 10 } },
    ],
  },
  nebula: {
    title: 'Glowing Nebula',
    text: 'You drift into a cloud of glowing gas. Your sensors fizz. Somewhere inside, something is pinging.',
    choices: [
      { text: 'Follow the ping.', outcomes: [[5, { text: 'It is an old supply cache!', missiles: 3, droneParts: 1, scrap: 8, fuel: 2 }], [3, { text: 'Static fries a circuit. You find nothing.', hull: -2 }], [2, { text: 'An automated sentry wakes up.', fight: { kind: 'automaton', bonus: { scrap: 10 } } }]] },
      { text: '(Sensors level 2) Pinpoint the signal.', req: { sys: 'sensors', lvl: 2 }, outcome: { text: 'Your sensors cut straight to the cache.', missiles: 3, droneParts: 2, scrap: 12 } },
      { text: 'Steer around it.', outcome: { text: 'You go the long way round.' } },
    ],
  },
  station: {
    title: 'Repair Station',
    text: 'An old repair dock still runs on solar power. The droids inside wave you in.',
    choices: [
      { text: 'Pay 15 scrap for repairs.', cost: { scrap: 15 }, outcome: { text: 'The droids patch your hull.', hull: 10 } },
      { text: 'Let them work for free.', outcomes: [[6, { text: 'They fix a few dents and send you on your way.', hull: 4 }], [4, { text: 'The droids malfunction and strip a few parts before you pull away.', hull: -2, scrap: -5 }]] },
      { text: 'Leave.', outcome: { text: 'You undock.' } },
    ],
  },
  kesh: {
    title: 'Kesh Warriors',
    text: 'A Kesh war-band hails you. "We seek a worthy fight. Send your best to the arena, or face our ship."',
    choices: [
      { text: 'Send your toughest crew member.', outcomes: [[6, { text: 'A brutal bout, but your champion wins. The Kesh pay in scrap and respect.', crewHurt: 45, scrap: 22 }], [4, { text: 'Your champion is beaten badly but lives. The Kesh shrug.', crewHurt: 70 }]] },
      { text: '(Kesh) Your Kesh crew member speaks for you.', req: { species: 'kesh' }, outcome: { text: 'They talk a long time. The war-band leaves you a gift and a recruit.', crewGain: 'kesh', scrap: 10 } },
      { text: 'Refuse. Raise shields!', outcome: { text: 'They take that as a yes.', fight: { kind: 'boarder', bonus: { scrap: 10 } } } },
    ],
  },
  refugees: {
    title: 'Refugee Convoy',
    text: 'Three slow ships flee the Hegemony. Their captain begs for fuel to reach the next system.',
    choices: [
      { text: 'Give them 2 fuel.', req: { fuel: 2 }, cost: { fuel: 2 }, outcomes: [[6, { text: 'They give you what they can spare, and a volunteer.', crewGain: 'random', scrap: 5 }], [4, { text: 'They thank you and hand over some scrap.', scrap: 18 }]] },
      { text: 'Wish them luck.', outcome: { text: 'The convoy limps on.' } },
    ],
  },
  wreckfield: {
    title: 'Battle Wreckage',
    text: 'Burned-out hulls from a recent battle. Some of the weapons look intact.',
    choices: [
      { text: 'Salvage the weapons.', outcomes: [[4, { text: 'You pry loose a working weapon!', weapon: 'random' }], [4, { text: 'Only scrap metal and a half-full fuel tank.', scrap: 16, fuel: 2 }], [2, { text: 'A dormant mine goes off next to you.', hull: -4, scrap: 6 }]] },
      { text: '(Drone parts) Send a drone in first.', req: { droneParts: 1 }, cost: { droneParts: 1 }, outcome: { text: 'The drone tags the mines and finds the best salvage.', weapon: 'random', scrap: 8 } },
      { text: 'Leave the dead in peace.', outcome: { text: 'You move on.' } },
    ],
  },
  ambush: {
    title: 'Quiet Beacon',
    text: 'The beacon is silent. Too silent. A ship powers up behind an asteroid!',
    choices: [
      { text: 'Battle stations!', outcome: { text: 'Here they come.', fight: { bonus: { scrap: 5 } } } },
      { text: '(Engines level 4) Outrun them.', req: { sys: 'engines', lvl: 4 }, outcome: { text: 'Your engines roar and you leave them far behind.' } },
    ],
  },
  scientist: {
    title: 'Research Outpost',
    text: 'A lonely scientist offers to test a prototype on your ship. "Perfectly safe. Probably."',
    choices: [
      { text: 'Let her tune your reactor.', outcomes: [[6, { text: 'It works! Your reactor puts out more power.', reactor: 1 }], [4, { text: 'Sparks fly. Something burns out.', hull: -4 }]] },
      { text: '(Synth) Have your Synth check her work first.', req: { species: 'synth' }, outcome: { text: 'Your Synth spots the flaw and fixes it. The upgrade works perfectly.', reactor: 1, scrap: 5 } },
      { text: 'No thanks.', outcome: { text: 'She looks disappointed.' } },
    ],
  },
  smugglers: {
    title: 'Smuggler Den',
    text: 'A hollow asteroid hides a smuggler market. The goods are cheap and nobody asks questions.',
    choices: [
      { text: 'Browse the market.', outcome: { text: 'You dock and look around.', store: true } },
      { text: 'Leave before trouble starts.', outcome: { text: 'You slip away.' } },
    ],
  },
  hegemony: {
    title: 'Hegemony Checkpoint',
    text: 'A Hegemony patrol scans you. "Unregistered vessel. Power down and prepare to be boarded."',
    choices: [
      { text: 'Fight your way through.', outcome: { text: 'Weapons hot!', fight: { kind: 'patrol', bonus: { scrap: 15 } } } },
      { text: 'Bribe the officer (25 scrap).', cost: { scrap: 25 }, outcome: { text: 'The officer pockets the scrap and waves you on.' } },
      { text: '(Sensors level 2) Forge clean papers.', req: { sys: 'sensors', lvl: 2 }, outcome: { text: 'Your sensors spoof a registry code. They let you through.' } },
    ],
  },
  sun: {
    title: 'Solar Flare',
    text: 'The star here is restless. A flare is building and will hit within minutes.',
    choices: [
      { text: 'Ride it out behind your shields.', outcomes: [[5, { text: 'The shields hold.', }], [5, { text: 'The flare scorches your hull.', hull: -4 }]] },
      { text: 'Use the flare to recharge your fuel cells.', outcomes: [[5, { text: 'It works! Your tanks fill up.', fuel: 3 }], [5, { text: 'It works, but the heat cooks the hull.', fuel: 2, hull: -5 }]] },
    ],
  },
  gambler: {
    title: 'The Gambler',
    text: 'A grinning alien shuffles glowing cards. "One game. Double or nothing, captain."',
    choices: [
      { text: 'Bet 15 scrap.', cost: { scrap: 15 }, outcomes: [[5, { text: 'You win! Double your stake.', scrap: 30, noScale: true }], [5, { text: 'You lose. The alien cackles.' }]] },
      { text: 'Bet a crew member\'s lucky charm.', outcomes: [[5, { text: 'You win a drone part and some missiles.', droneParts: 1, missiles: 2 }], [5, { text: 'You lose. Morale drops, but nothing more.' }]] },
      { text: 'Decline.', outcome: { text: '"Your loss!"' } },
    ],
  },
  probe: {
    title: 'Old Probe',
    text: 'An ancient survey probe is still transmitting star charts.',
    choices: [
      { text: 'Download the charts.', outcome: { text: 'The charts show the whole sector.', reveal: true } },
      { text: 'Strip it for parts.', outcome: { text: 'Old but solid parts, and its fuel cell.', scrap: 12, droneParts: 1, fuel: 1 } },
    ],
  },
  stowaway: {
    title: 'Stowaway',
    text: 'During the jump your crew finds someone hiding in the cargo hold.',
    choices: [
      { text: 'Let them join the crew.', outcome: { text: 'They are eager to prove themselves.', crewGain: 'random' } },
      { text: 'Drop them at the next station with some supplies.', outcome: { text: 'They leave you a little scrap and fuel as thanks.', scrap: 8, fuel: 1 } },
    ],
  },
  plague: {
    title: 'Sick Bay Ship',
    text: 'A medical ship begs for help: its crew has a fever and its doctor is dead.',
    choices: [
      { text: 'Send help aboard.', outcomes: [[5, { text: 'You save them. They pay with medical supplies and scrap.', scrap: 20 }], [5, { text: 'Your crew catches the fever and suffers before it passes.', crewHurt: 50, scrap: 10 }]] },
      { text: '(Medbay level 2) Bring the sick into your medbay.', req: { sys: 'medbay', lvl: 2 }, outcome: { text: 'Your medbay cures them all. Their captain insists on rewarding you.', scrap: 25, missiles: 2 } },
      { text: 'Keep your distance.', outcome: { text: 'You leave them behind.' } },
    ],
  },
  sentinel: {
    title: 'Ancient Sentinel',
    text: 'A huge automated guardian floats around a sealed vault. It has not noticed you yet.',
    choices: [
      { text: 'Attack the guardian.', outcome: { text: 'It turns its guns on you.', fight: { kind: 'automaton', level: 1, bonus: { scrap: 25, droneParts: 1 } } } },
      { text: '(Ion weapon) Disable it with ion fire.', req: { weaponType: 'ion' }, outcome: { text: 'A clean ion shot locks it down. The vault is yours.', scrap: 25, droneParts: 1 } },
      { text: 'Sneak past.', outcome: { text: 'You hold your breath and slip past.' } },
    ],
  },
  fuelleak: {
    title: 'Fuel Leak',
    text: 'An alarm blares: a fuel line split during the last jump.',
    choices: [
      { text: 'Seal it fast (someone may get burned).', outcomes: [[6, { text: 'Sealed, with only a little lost.', fuel: -1 }], [4, { text: 'Sealed, but a crew member gets burned.', crewHurt: 30 }]] },
      { text: '(Rokkan) Let the Rokkan handle the hot pipes.', req: { species: 'rokkan' }, outcome: { text: 'Fire does not bother a Rokkan. Sealed without a drop lost.' } },
    ],
  },
  armsdealer: {
    title: 'Arms Dealer',
    text: '"Looking for firepower? I have something special, slightly used." The dealer shows off a weapon.',
    choices: [
      { text: 'Buy the weapon (35 scrap).', cost: { scrap: 35 }, outcome: { text: 'It is yours.', weapon: 'random' } },
      { text: 'Buy a drone (30 scrap).', cost: { scrap: 30 }, outcome: { text: 'A drone schematic and the parts to build it.', drone: 'random', droneParts: 1 } },
      { text: 'Just looking.', outcome: { text: '"Come back any time!"' } },
    ],
  },
  engineer: {
    title: 'Retired Engineer',
    text: 'An old engineer living on a moon offers to tune one of your systems in return for company and stories.',
    choices: [
      { text: 'Spend a day with her.', outcomes: [[7, { text: 'She upgrades a system for free!', upgrade: 'random' }], [3, { text: 'Lovely stories. She gives you some spare parts.', scrap: 10 }]] },
      { text: 'No time, the fleet is coming.', outcome: { text: 'You wave goodbye.' } },
    ],
  },
  slavers: {
    title: 'Captive Crew',
    text: 'A Reaver ship is towing a pod full of captives. They have not seen you yet.',
    choices: [
      { text: 'Attack and free the captives.', outcome: { text: 'You open fire.', fight: { kind: 'hunter', bonus: { crewGain: 'random', scrap: 5 } } } },
      { text: 'Let it go.', outcome: { text: 'You look away.' } },
    ],
  },
  quiet: {
    title: 'Empty Space',
    text: 'Nothing here but distant stars. Your crew takes a breather.',
    choices: [
      { text: 'Rest and run diagnostics.', outcome: { text: 'Everyone feels better. Small repairs done.', hull: 2 } },
      { text: 'Scan for debris.', outcomes: [[6, { text: 'You pick up a few bits of scrap and a fuel cell.', scrap: 6, fuel: 1 }], [4, { text: 'Nothing but a little fuel.', fuel: 1 }]] },
    ],
  },
};

export const EVENT_IDS = Object.keys(EVENTS);

/** Can the run take this choice? Returns '' or a reason. */
export function choiceBlock(run, choice) {
  const r = choice.req;
  const cost = choice.cost || {};
  for (const [k, v] of Object.entries(cost)) if (getRes(run, k) < v) return `Needs ${v} ${k === 'droneParts' ? 'drone parts' : k}`;
  if (!r) return '';
  const crew = run.ship.crew.filter((c) => c.side === 'player' && c.hp > 0);
  if (r.species && !crew.some((c) => c.species === r.species)) return 'Needs crew';
  if (r.sys) {
    const s = run.ship.sys[r.sys];
    if (!s || s.level < r.lvl) return 'Needs system';
  }
  if (r.fuel && run.fuel < r.fuel) return `Needs ${r.fuel} fuel`;
  if (r.droneParts && run.ship.droneParts < r.droneParts) return 'Needs drone parts';
  if (r.weaponType && !run.ship.weapons.some((w) => WEAPON_TYPES[w.id] === r.weaponType)) return 'Needs weapon';
  return '';
}

/** Choices with a requirement that is not met are hidden unless they only cost resources. */
export function visibleChoices(run, ev) {
  return ev.choices.map((c, i) => ({ c, i, block: choiceBlock(run, c) })).filter((x) => !x.c.req || !x.block || x.c.cost);
}

/** Scrap and fuel live on the run; missiles and drone parts on the ship. */
export const getRes = (run, k) => ((k === 'missiles' || k === 'droneParts') ? run.ship[k] : run[k]) ?? 0;

import { WEAPONS } from './data.js';
const WEAPON_TYPES = Object.fromEntries(Object.entries(WEAPONS).map(([k, w]) => [k, w.type]));

// Teams: kit colours (shirt + shorts, swapped into the sprite sheet's shirt layer) and strength.
// strength is added to the adaptive CPU skill, so a "strong" team plays a bit better than your
// current level and a weak one a bit worse.

export const PLAYER_TEAM = { id: 'rabbits', name: 'Rabbits FC', short: 'RAB', shirt: '#285cc4', shorts: '#f9f5ef', strength: 0 };

export const TEAMS = [
  { id: 'foxes', name: 'Red Foxes', short: 'FOX', shirt: '#df3e23', shorts: '#f9f5ef', strength: -0.16 },
  { id: 'sun', name: 'Sun City', short: 'SUN', shirt: '#ffd541', shorts: '#403353', strength: -0.11 },
  { id: 'tide', name: 'Teal Tide', short: 'TID', shirt: '#20d6c7', shorts: '#1c1618', strength: -0.06 },
  { id: 'ants', name: 'Orange Ants', short: 'ANT', shirt: '#f9a31b', shorts: '#1c1618', strength: -0.02 },
  { id: 'plums', name: 'Plum Rovers', short: 'PLU', shirt: '#9a407e', shorts: '#f9f5ef', strength: 0.03 },
  { id: 'owls', name: 'Snow Owls', short: 'OWL', shirt: '#eef0f4', shorts: '#47416b', strength: 0.08 },
  { id: 'bears', name: 'Iron Bears', short: 'BEA', shirt: '#3a3845', shorts: '#df3e23', strength: 0.13 },
  { id: 'kings', name: 'Coral Kings', short: 'KNG', shirt: '#f06aa0', shorts: '#f9f5ef', strength: 0.18 },
];

export const teamById = (id) => (id === PLAYER_TEAM.id ? PLAYER_TEAM : TEAMS.find((t) => t.id === id));

// Keepers wear something that clashes with neither team.
const KEEPER_KITS = ['#14a02e', '#8b93af', '#ffd541', '#1c1618'];

/** Keeper shirt colours [home, away] that differ from both outfield kits and each other. */
export function keeperKits(home, away) {
  const used = [home.shirt, away.shirt];
  const free = KEEPER_KITS.filter((c) => !used.includes(c));
  return [free[0], free[1]];
}

/** 1-5 stars for the team picker. */
export const stars = (t) => Math.max(1, Math.min(5, Math.round((t.strength + 0.2) / 0.4 * 4) + 1));

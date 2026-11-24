// The list the launcher shows. Add a game here when it's ready to be seen.
//   status: 'playable' shows normally, 'soon' shows greyed out, 'hidden' isn't listed
//   (a hidden game can still be opened at its own link for testing).
//   cat: which shelf it sits on in the launcher (see CATEGORIES).
//   landscape: true for games played with the phone on its side.
export const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'action', label: 'Action' },
  { id: 'classic', label: 'Board & Puzzle' },
  { id: 'sim', label: 'Sim' },
];

export const GAMES = [
  { id: 'game-night', title: 'Game Night', tagline: '20 board, card, arcade and puzzle games', cat: 'classic', status: 'playable' },
  { id: 'city-chief', title: 'City Chief', tagline: 'Run the police force of Tiny Town', cat: 'sim', status: 'playable' },
  { id: 'pocket-pets', title: 'Pocket Pets', tagline: 'Catch, train and battle pets for four badges', cat: 'adventure', status: 'playable' },
  { id: 'hero-quest', title: 'Hollow Crown', tagline: 'Sword, shield and three dungeons', cat: 'adventure', status: 'playable', landscape: true },
  { id: 'spire-roguelite', title: 'Spire Roguelite', tagline: 'Deck-building dungeon climb', cat: 'strategy', status: 'playable' },
  { id: 'heroes-lite', title: 'Heroes Lite', tagline: 'Pocket Heroes of Might & Magic', cat: 'strategy', status: 'playable' },
  { id: 'sand-tactics', title: 'Sand Tactics', tagline: 'Turn-based desert war', cat: 'strategy', status: 'playable' },
  { id: 'soccer', title: 'Pocket Soccer', tagline: '5-a-side arcade football', cat: 'action', status: 'playable', landscape: true },
  { id: 'robbox', title: 'Robbox', tagline: 'Program a robot through 40 puzzles', cat: 'classic', status: 'playable' },
  { id: 'alchemist', title: "Alchemist's Shop", tagline: 'Brew potions, keep customers happy', cat: 'sim', status: 'playable' },
  { id: 'star-drifter', title: 'Star Drifter', tagline: 'Crew a ship across a hostile galaxy', cat: 'strategy', status: 'playable' },
  { id: 'pangea', title: 'Pangea', tagline: 'Found cities, grow an empire', cat: 'strategy', status: 'playable' },
  { id: 'megaboy', title: 'MegaBoy Run', tagline: 'Run, jump, blast, steal boss weapons', cat: 'action', status: 'playable', landscape: true },
  { id: 'darkhold', title: 'Darkhold', tagline: 'A dungeon crawl by torchlight', cat: 'adventure', status: 'playable' },
  { id: 'town-builder', title: 'Tiny Town Builder', tagline: 'Zone, build and grow a little city', cat: 'sim', status: 'playable' },
];

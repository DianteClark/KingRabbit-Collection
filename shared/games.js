// The list the launcher shows. Add a game here when it's ready to be seen.
//   status: 'playable' shows normally, 'soon' shows greyed out, 'hidden' isn't listed
//   (a hidden game can still be opened at its own link for testing).
export const GAMES = [
  {
    id: 'game-night',
    title: 'Game Night',
    tagline: '20 board, card, arcade and puzzle games',
    art: 'mas',
    status: 'playable',
  },
  { id: 'spire-roguelite', title: 'Spire Roguelite', tagline: 'Spells, relics and an overworld', art: 'has', status: 'soon' },
  { id: 'heroes-lite', title: 'Heroes Lite', tagline: 'Pocket Heroes of Might & Magic', art: 'has', status: 'soon' },
  { id: 'city-chief', title: 'City Chief', tagline: 'Run the police force of Tiny Town', art: 'city', status: 'playable' },
];

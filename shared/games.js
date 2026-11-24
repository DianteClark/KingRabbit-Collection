// The list the launcher shows. Add a game here when it's ready to be seen.
//   status: 'playable' shows normally, 'soon' shows greyed out, 'hidden' isn't listed
//   (a hidden game can still be opened at its own link for testing).
export const GAMES = [
  {
    id: 'game-night',
    title: 'Game Night',
    tagline: 'Tic-Tac-Toe, Reversi and Yacht dice',
    art: 'mas',
    status: 'playable',
  },
  { id: 'spire-roguelite', title: 'Spire Roguelite', tagline: 'Spells, relics and an overworld', art: 'has', status: 'soon' },
  { id: 'heroes-lite', title: 'Heroes Lite', tagline: 'Pocket Heroes of Might & Magic', art: 'has', status: 'soon' },
  { id: 'tiny-city', title: 'Tiny City', tagline: 'Build a town, survive disasters', art: 'city', status: 'soon' },
];

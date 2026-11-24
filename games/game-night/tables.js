// Every table in Game Night. `scene: null` shows the tile as "Coming soon".
//   modes: which play modes the table offers (cpu = vs computer, pvp = 2 players on one phone, solo)
//   score: 'record' keeps wins/draws/losses vs CPU, 'best' keeps a high score, 'low' keeps a lowest score
//   icon:  [sheet frame key, scale] drawn on the menu tile

export const CATEGORIES = [
  { id: 'board', name: 'Board' },
  { id: 'cards', name: 'Cards' },
  { id: 'arcade', name: 'Arcade' },
  { id: 'puzzle', name: 'Puzzle' },
];

export const TABLES = [
  // Board
  { id: 'ttt', scene: 'TicTacToe', name: 'Tic-Tac-Toe', cat: 'board', modes: ['cpu', 'pvp'], score: 'record', icon: ['ttt:x', 2] },
  { id: 'reversi', scene: 'Reversi', name: 'Reversi', cat: 'board', modes: ['cpu', 'pvp'], score: 'record', icon: ['reversi:dark', 4] },
  { id: 'checkers', scene: 'Checkers', name: 'Checkers', cat: 'board', modes: ['cpu', 'pvp'], score: 'record', icon: ['checkers:light', 4] },
  { id: 'chess', scene: 'Chess', name: 'Chess', cat: 'board', modes: ['cpu', 'pvp'], score: 'record', icon: ['chess:wN', 4] },
  { id: 'go', scene: 'Go', name: 'Go', cat: 'board', modes: ['cpu', 'pvp'], score: 'record', icon: ['go:dark', 4] },
  { id: 'tables', scene: 'Tables', name: 'Tables', cat: 'board', modes: ['cpu', 'pvp'], score: 'record', icon: ['tables:d6', 2.5] },
  { id: 'dominoes', scene: 'Dominoes', name: 'Dominoes', cat: 'board', modes: ['cpu'], score: 'record', icon: ['dominoes:icon', 2] },
  { id: 'seabattle', scene: 'SeaBattle', name: 'Sea Battle', cat: 'board', modes: ['cpu'], score: 'record', icon: ['seabattle:boom', 4] },
  // Cards & dice
  { id: 'yacht', scene: 'Yacht', name: 'Yacht Dice', cat: 'cards', modes: ['solo'], score: 'best', icon: ['yacht:d5', 2.5] },
  { id: 'solitaire', scene: 'Solitaire', name: 'Solitaire', cat: 'cards', modes: ['solo'], score: 'record', icon: ['cards:back', 1.5] },
  { id: 'wildcards', scene: 'WildCards', name: 'Wild Cards', cat: 'cards', modes: ['cpu'], score: 'record', icon: ['wild:icon', 1] },
  // Arcade
  { id: 'airhockey', scene: 'AirHockey', name: 'Air Hockey', cat: 'arcade', modes: ['cpu'], score: 'record', icon: ['airhockey:red', 4] },
  { id: 'blockbreaker', scene: 'BlockBreaker', name: 'Block Breaker', cat: 'arcade', modes: ['solo'], score: 'best', icon: ['blocks:ball', 4] },
  { id: 'spacerocks', scene: 'SpaceRocks', name: 'Space Rocks', cat: 'arcade', modes: ['solo'], score: 'best', icon: ['rocks:rockM', 2.5] },
  { id: 'bowling', scene: 'Bowling', name: 'Bowling', cat: 'arcade', modes: ['solo'], score: 'best', icon: ['bowling:pin', 4] },
  { id: 'pool', scene: 'Pool', name: 'Pool', cat: 'arcade', modes: ['cpu', 'pvp'], score: 'record', icon: ['pool:b8', 4] },
  { id: 'tanks', scene: 'Tanks', name: 'Tank Battle', cat: 'arcade', modes: ['solo'], score: 'best', icon: ['tanks:icon', 4] },
  // Puzzle
  { id: 'boxbox', scene: 'BoxBox', name: 'Box Box', cat: 'puzzle', modes: ['solo'], score: 'best', icon: ['boxbox:box', 4] },
  { id: 'sixball', scene: 'SixBall', name: 'Six Ball', cat: 'puzzle', modes: ['solo'], score: 'best', icon: ['sixball:g1', 4] },
  { id: 'molerunner', scene: 'MoleRunner', name: 'Mole Runner', cat: 'puzzle', modes: ['solo'], score: 'best', icon: ['mole:gem', 4] },
];

export const tableById = (id) => TABLES.find((t) => t.id === id);

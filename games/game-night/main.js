import { startGame } from '../../shared/core/boot.js';
import { Boot } from './scenes/Boot.js';
import { Menu } from './scenes/Menu.js';
import { TicTacToe } from './scenes/TicTacToe.js';
import { Reversi } from './scenes/Reversi.js';
import { Yacht } from './scenes/Yacht.js';

startGame({ scenes: [Boot, Menu, TicTacToe, Reversi, Yacht] });

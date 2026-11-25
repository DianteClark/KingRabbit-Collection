import { startGame } from '../../shared/core/boot.js';
import { Boot } from './scenes/Boot.js';
import { Menu } from './scenes/Menu.js';
import { TicTacToe } from './scenes/TicTacToe.js';
import { Reversi } from './scenes/Reversi.js';
import { Checkers } from './scenes/Checkers.js';
import { Chess } from './scenes/Chess.js';
import { Go } from './scenes/Go.js';
import { Tables } from './scenes/Tables.js';
import { Dominoes } from './scenes/Dominoes.js';
import { SeaBattle } from './scenes/SeaBattle.js';
import { Yacht } from './scenes/Yacht.js';
import { Solitaire } from './scenes/Solitaire.js';
import { WildCards } from './scenes/WildCards.js';
import { BoxBox } from './scenes/BoxBox.js';
import { SixBall } from './scenes/SixBall.js';
import { AirHockey } from './scenes/AirHockey.js';
import { BlockBreaker } from './scenes/BlockBreaker.js';
import { SpaceRocks } from './scenes/SpaceRocks.js';
import { Bowling } from './scenes/Bowling.js';
import { Pool } from './scenes/Pool.js';
import { Tanks } from './scenes/Tanks.js';
import { MoleRunner } from './scenes/MoleRunner.js';
import { initTrophies } from './trophies.js';
import { installPad } from './padkit.js';

initTrophies();

startGame({
  scenes: [Boot, Menu, TicTacToe, Reversi, Checkers, Chess, Go, Tables, Dominoes, SeaBattle, Yacht,
    Solitaire, WildCards, BoxBox, SixBall,
    AirHockey, BlockBreaker, SpaceRocks, Bowling, Pool, Tanks, MoleRunner],
}).then(installPad);

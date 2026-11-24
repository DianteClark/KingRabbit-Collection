import { startGame } from '../../shared/core/boot.js';
import { Boot } from './scenes/Boot.js';
import { Menu } from './scenes/Menu.js';
import { Levels } from './scenes/Levels.js';
import { Play } from './scenes/Play.js';

startGame({ scenes: [Boot, Menu, Levels, Play] });

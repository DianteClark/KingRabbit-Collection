import { startGame } from '../../shared/core/boot.js';
import { Boot } from './scenes/Boot.js';
import { Menu } from './scenes/Menu.js';
import { World } from './scenes/World.js';

startGame({ scenes: [Boot, Menu, World] });

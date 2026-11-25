import { startGame } from '../../shared/core/boot.js';
import { Boot } from './scenes/Boot.js';
import { Menu } from './scenes/Menu.js';
import { Battle } from './scenes/Battle.js';
import { installPad } from '../../shared/core/padkit.js';
import { initTrophies } from './trophies.js';

initTrophies();

startGame({ scenes: [Boot, Menu, Battle] }).then(installPad);

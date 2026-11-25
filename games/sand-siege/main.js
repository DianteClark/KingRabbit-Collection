import { startGame } from '../../shared/core/boot.js';
import { Boot } from './scenes/Boot.js';
import { Menu } from './scenes/Menu.js';
import { Play } from './scenes/Play.js';
import { installPad } from '../../shared/core/padkit.js';
import { setupTrophies } from './trophies.js';

setupTrophies();
startGame({ scenes: [Boot, Menu, Play] }).then(installPad);

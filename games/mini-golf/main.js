import { startGame } from '../../shared/core/boot.js';
import { Boot } from './scenes/Boot.js';
import { Menu } from './scenes/Menu.js';
import { Courses } from './scenes/Courses.js';
import { Party } from './scenes/Party.js';
import { installPad } from '../../shared/core/padkit.js';
import { Play } from './scenes/Play.js';

startGame({ scenes: [Boot, Menu, Courses, Party, Play] }).then(installPad);

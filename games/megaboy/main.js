import { startGame } from '../../shared/core/boot.js';
import { Boot } from './scenes/Boot.js';
import { Title } from './scenes/Title.js';
import { Intro } from './scenes/Intro.js';
import { Select } from './scenes/Select.js';
import { Stage } from './scenes/Stage.js';
import { Hud } from './scenes/Hud.js';
import { Result } from './scenes/Result.js';
import { GameOver } from './scenes/GameOver.js';
import { Ending } from './scenes/Ending.js';
import { initTrophies } from './trophies.js';
import { installPad } from './padkit.js';

initTrophies();

// Landscape: the stage fills the screen at 3x, the controls sit over the bottom corners.
startGame({ scenes: [Boot, Title, Intro, Select, Stage, Hud, Result, GameOver, Ending], orientation: 'landscape', background: '#000000' }).then(installPad);

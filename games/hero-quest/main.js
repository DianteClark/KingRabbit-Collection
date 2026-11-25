import { startGame } from '../../shared/core/boot.js';
import { Boot } from './scenes/Boot.js';
import { Title } from './scenes/Title.js';
import { Play } from './scenes/Play.js';
import { Hud } from './scenes/Hud.js';
import { installPad } from '../../shared/core/padkit.js';
import { Ending } from './scenes/Ending.js';

// Landscape: the room fills the full height in the middle, controls sit in the side margins.
startGame({ scenes: [Boot, Title, Play, Hud, Ending], orientation: 'landscape' }).then(installPad);

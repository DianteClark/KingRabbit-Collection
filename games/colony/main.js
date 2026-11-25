import { startGame } from '../../shared/core/boot.js';
import './colony.css';
import { Boot } from './scenes/Boot.js';
import { Title } from './scenes/Title.js';
import { installPad } from '../../shared/core/padkit.js';
import { Play } from './scenes/Play.js';

startGame({ scenes: [Boot, Title, Play], background: '#1c1618' }).then(installPad);

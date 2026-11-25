import { startGame } from '../../shared/core/boot.js';
import './hv.css';
import { Boot } from './scenes/Boot.js';
import { Title } from './scenes/Title.js';
import { World } from './scenes/World.js';
import { Fish } from './scenes/Fish.js';
import { installPad } from '../../shared/core/padkit.js';
import { Ending } from './scenes/Ending.js';

startGame({ scenes: [Boot, Title, World, Fish, Ending] }).then(installPad);

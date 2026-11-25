import { startGame } from '../../shared/core/boot.js';
import './shop.css';
import { Boot } from './scenes/Boot.js';
import { Title } from './scenes/Title.js';
import { Shop } from './scenes/Shop.js';
import { Gather } from './scenes/Gather.js';
import { Brew } from './scenes/Brew.js';
import { Festival } from './scenes/Festival.js';
import { Ending } from './scenes/Ending.js';
import { initTrophies } from './trophies.js';

initTrophies();

startGame({ scenes: [Boot, Title, Shop, Gather, Brew, Festival, Ending], background: '#1c1618' });

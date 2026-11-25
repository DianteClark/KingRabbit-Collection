import { startGame } from '../../shared/core/boot.js';
import './pq.css';
import { Boot } from './scenes/Boot.js';
import { Title } from './scenes/Title.js';
import { World } from './scenes/World.js';
import { Battle } from './scenes/Battle.js';
import { Ending } from './scenes/Ending.js';
import { initTrophies } from './trophies.js';

initTrophies();
startGame({ scenes: [Boot, Title, World, Battle, Ending] });

import { startGame } from '../../shared/core/boot.js';
import './city.css';
import { Boot } from './scenes/Boot.js';
import { Title } from './scenes/Title.js';
import { City } from './scenes/City.js';

startGame({ scenes: [Boot, Title, City], background: '#1c1618' });

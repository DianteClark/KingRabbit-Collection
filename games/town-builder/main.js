import { startGame } from '../../shared/core/boot.js';
import './tb.css';
import { Boot } from './scenes/Boot.js';
import { Title } from './scenes/Title.js';
import { Game } from './scenes/Game.js';

startGame({ scenes: [Boot, Title, Game], background: '#1c1618' });

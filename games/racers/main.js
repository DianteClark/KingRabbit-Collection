import { startGame } from '../../shared/core/boot.js';
import { Boot } from './scenes/Boot.js';
import { Title } from './scenes/Title.js';
import { Garage } from './scenes/Garage.js';
import { Tracks } from './scenes/Tracks.js';
import { Cup } from './scenes/Cup.js';
import { RaceScene } from './scenes/RaceScene.js';
import { Hud } from './scenes/Hud.js';
import { Results } from './scenes/Results.js';

startGame({ scenes: [Boot, Title, Garage, Tracks, Cup, RaceScene, Hud, Results], orientation: 'landscape' });

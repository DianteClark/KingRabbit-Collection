import { startGame } from '../../shared/core/boot.js';
import { installPad } from '../../shared/core/padkit.js';
import { Boot } from './scenes/Boot.js';
import { Title } from './scenes/Title.js';
import { Shop } from './scenes/Shop.js';
import { Game } from './scenes/Game.js';
import { Hud } from './scenes/Hud.js';
import { Results } from './scenes/Results.js';

startGame({ scenes: [Boot, Title, Shop, Game, Hud, Results], orientation: 'landscape' }).then(installPad);

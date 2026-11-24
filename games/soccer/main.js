import { startGame } from '../../shared/core/boot.js';
import { Boot } from './scenes/Boot.js';
import { Menu } from './scenes/Menu.js';
import { Pick } from './scenes/Pick.js';
import { Cup } from './scenes/Cup.js';
import { Endless } from './scenes/Endless.js';
import { MatchScene } from './scenes/MatchScene.js';
import { Hud } from './scenes/Hud.js';
import { Penalties } from './scenes/Penalties.js';

startGame({ scenes: [Boot, Menu, Pick, Cup, Endless, MatchScene, Hud, Penalties], orientation: 'landscape' });
